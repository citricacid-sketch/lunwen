import json
import logging
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from app.models.er_diagram import (
    DiagramRequest,
    DiagramResponse,
    DiagramStreamDoneData,
    ERDiagramRequest,
    ERDiagramResponse,
    ERDiagramStreamDoneData,
)
from app.services.er_diagram_service import DiagramService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["diagram"])
service = DiagramService()


def _make_sse_response(generator):
    return StreamingResponse(
        generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/diagram/generate/stream")
async def diagram_generate_stream(request: DiagramRequest):
    async def event_generator():
        full_output = ""
        try:
            async for chunk in service.generate_stream(
                request.description, request.diagram_type
            ):
                full_output += chunk
                yield f"event: delta\ndata: {json.dumps({'content': chunk}, ensure_ascii=False)}\n\n"

            parsed = service._parse_output(full_output, request.diagram_type)
            done_data = DiagramStreamDoneData(
                html_code=parsed["html_code"],
                diagram_type=request.diagram_type,
                entities=parsed.get("entities", []),
                relationships=parsed.get("relationships", []),
            )
            yield f"event: done\ndata: {done_data.model_dump_json()}\n\n"
        except Exception as e:
            logger.error(f"Diagram stream error: {e}")
            error_data = {"message": f"图表生成失败: {str(e)}", "code": "LLM_ERROR"}
            yield f"event: error\ndata: {json.dumps(error_data, ensure_ascii=False)}\n\n"

    return _make_sse_response(event_generator)


@router.post("/diagram/generate", response_model=DiagramResponse)
async def diagram_generate(request: DiagramRequest):
    try:
        result = await service.generate(request.description, request.diagram_type)
        return DiagramResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Diagram generation error: {e}")
        raise HTTPException(status_code=500, detail=f"图表生成出错: {str(e)}")


# Backward-compatible ER diagram endpoints
@router.post("/er-diagram/generate/stream")
async def er_diagram_generate_stream(request: ERDiagramRequest):
    wrapped = DiagramRequest(description=request.description, diagram_type="er")
    return await diagram_generate_stream(wrapped)


@router.post("/er-diagram/generate", response_model=ERDiagramResponse)
async def er_diagram_generate(request: ERDiagramRequest):
    try:
        result = await service.generate(request.description, "er")
        return ERDiagramResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"ER diagram generation error: {e}")
        raise HTTPException(status_code=500, detail=f"ER图生成出错: {str(e)}")
