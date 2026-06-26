"""Rewrite API — multi-agent rewrite + history management."""

import json
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db, User, History
from app.auth import get_current_user
from app.models.rewrite import RewriteRequest, RewriteIterateRequest, ChatRequest
from app.services.rewrite_service import RewriteService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["rewrite"])
service = RewriteService()


def _sse(generator):
    return StreamingResponse(
        generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )


# ── Original endpoints (keep backward compatible, no auth required) ──

@router.post("/rewrite/stream")
async def rewrite_stream(request: RewriteRequest):
    async def gen():
        result = ""
        try:
            async for chunk in service.process_stream(
                request.text, request.mode, request.style,
                request.language, request.intro_or_conclusion,
            ):
                result += chunk
                yield f"event: delta\ndata: {json.dumps({'content': chunk}, ensure_ascii=False)}\n\n"

            done = {
                "original_length": len(request.text),
                "rewritten_length": len(result),
                "mode": request.mode,
                "style": request.style,
                "is_iteration": False,
            }
            yield f"event: done\ndata: {json.dumps(done, ensure_ascii=False)}\n\n"
        except Exception as e:
            logger.error(f"Stream error: {type(e).__name__}: {e}")
            yield f"event: error\ndata: {json.dumps({'message': '服务处理失败，请稍后重试', 'code': 'LLM_ERROR'}, ensure_ascii=False)}\n\n"

    return _sse(gen)


@router.post("/rewrite/iterate/stream")
async def rewrite_iterate_stream(request: RewriteIterateRequest):
    async def gen():
        result = ""
        try:
            async for chunk in service.iterate_stream(
                request.original_text, request.current_text,
                request.instruction, request.mode, request.style,
            ):
                result += chunk
                yield f"event: delta\ndata: {json.dumps({'content': chunk}, ensure_ascii=False)}\n\n"

            done = {
                "original_length": len(request.original_text),
                "rewritten_length": len(result),
                "mode": request.mode,
                "style": request.style,
                "is_iteration": True,
            }
            yield f"event: done\ndata: {json.dumps(done, ensure_ascii=False)}\n\n"
        except Exception as e:
            logger.error(f"Iterate stream error: {e}")
            yield f"event: error\ndata: {json.dumps({'message': '服务处理失败，请稍后重试', 'code': 'LLM_ERROR'}, ensure_ascii=False)}\n\n"

    return _sse(gen)


@router.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    async def gen():
        result = ""
        try:
            messages = [m.model_dump() for m in request.messages]
            async for chunk in service.chat_stream(messages):
                result += chunk
                yield f"event: delta\ndata: {json.dumps({'content': chunk}, ensure_ascii=False)}\n\n"

            yield f"event: done\ndata: {json.dumps({'length': len(result)}, ensure_ascii=False)}\n\n"
        except Exception as e:
            logger.error(f"Chat stream error: {e}")
            yield f"event: error\ndata: {json.dumps({'message': '服务处理失败，请稍后重试', 'code': 'LLM_ERROR'}, ensure_ascii=False)}\n\n"

    return _sse(gen)


# ── Agent pipeline endpoint (auth required) ──

class AgentRewriteRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=50000)
    mode: str = Field(default="rewrite")
    style: str = Field(default="formal")
    use_rag: bool = Field(default=False)
    enable_review: bool = Field(default=True)


@router.post("/rewrite/agent/stream")
async def agent_rewrite_stream(
    request: AgentRewriteRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Full multi-agent pipeline: preprocess → RAG → [rewrite → review] × N."""
    from app.agents.orchestrator import AgentOrchestrator

    orchestrator = AgentOrchestrator()

    async def gen():
        try:
            async for sse_dict in orchestrator.run_stream(
                text=request.text,
                mode=request.mode,
                style=request.style,
                use_rag=request.use_rag,
                enable_review=request.enable_review,
            ):
                event = sse_dict["event"]
                data = sse_dict["data"]
                yield f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"
        except Exception as e:
            logger.error(f"Agent stream error: {e}")
            yield f"event: error\ndata: {json.dumps({'message': '服务处理失败，请稍后重试', 'code': 'AGENT_ERROR'}, ensure_ascii=False)}\n\n"

    return _sse(gen)


# ── History endpoints (auth required) ──

class SaveHistoryRequest(BaseModel):
    type: str = Field(..., pattern="^(rewrite|diagram)$")
    mode: str | None = None
    original_text: str | None = None
    result_text: str | None = None
    quality_report: dict | None = None
    label: str | None = None


@router.get("/history")
async def list_history(
    history_type: str | None = Query(None, alias="type"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(History).where(History.user_id == user.id)
    if history_type:
        stmt = stmt.where(History.type == history_type)
    stmt = stmt.order_by(History.created_at.desc()).limit(100)
    result = await db.execute(stmt)
    records = result.scalars().all()
    return [
        {
            "id": r.id,
            "type": r.type,
            "mode": r.mode,
            "original_text": r.original_text,
            "result_text": r.result_text,
            "quality_report": r.quality_report,
            "label": r.label,
            "created_at": r.created_at.isoformat() if r.created_at else "",
        }
        for r in records
    ]


@router.post("/history")
async def save_history(
    req: SaveHistoryRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    record = History(
        user_id=user.id,
        type=req.type,
        mode=req.mode,
        original_text=req.original_text,
        result_text=req.result_text,
        quality_report=req.quality_report,
        label=req.label,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return {"id": record.id}


@router.delete("/history/{history_id}")
async def delete_history(
    history_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = delete(History).where(History.id == history_id, History.user_id == user.id)
    result = await db.execute(stmt)
    await db.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="记录不存在")
    return {"ok": True}
