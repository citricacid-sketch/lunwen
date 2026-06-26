"""Auth API — register, login, profile management."""

import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db, User, LLMProfile
from app.auth import create_token, hash_password, verify_password, get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(tags=["auth"])


# ── Request / Response models ──

class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=2, max_length=50)
    password: str = Field(..., min_length=6, max_length=100)
    email: str | None = None


class LoginRequest(BaseModel):
    username: str
    password: str


class AuthResponse(BaseModel):
    token: str
    username: str
    user_id: int
    role: str


class UserInfo(BaseModel):
    user_id: int
    username: str
    email: str | None
    role: str
    created_at: str


# ── Routes ──

@router.post("/auth/register", response_model=AuthResponse)
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.username == req.username))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="用户名已存在")

    user = User(
        username=req.username,
        password_hash=hash_password(req.password),
        email=req.email,
    )
    db.add(user)
    await db.flush()

    # Create default LLM profile
    profile = LLMProfile(
        user_id=user.id,
        name="默认配置",
        provider="openai",
        base_url="https://api.openai.com/v1",
        model="gpt-4o",
        is_active=True,
    )
    db.add(profile)
    await db.commit()

    token = create_token(user.id, user.username, user.role)
    logger.info(f"User registered: {user.username}")
    return AuthResponse(token=token, username=user.username, user_id=user.id, role=user.role)


@router.post("/auth/login", response_model=AuthResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == req.username))
    user = result.scalar_one_or_none()

    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="用户名或密码错误")

    token = create_token(user.id, user.username, user.role)
    return AuthResponse(token=token, username=user.username, user_id=user.id, role=user.role)


@router.get("/auth/me", response_model=UserInfo)
async def me(user: User = Depends(get_current_user)):
    return UserInfo(
        user_id=user.id,
        username=user.username,
        email=user.email,
        role=user.role,
        created_at=user.created_at.isoformat() if user.created_at else "",
    )
