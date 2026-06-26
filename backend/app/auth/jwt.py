"""JWT token creation and verification."""

import time
import jwt
from app.config import settings

ALGORITHM = settings.jwt_algorithm
SECRET = settings.jwt_secret
EXPIRE_HOURS = settings.jwt_expire_hours


def create_token(user_id: int, username: str, role: str = "user") -> str:
    """Create a JWT access token."""
    now = int(time.time())
    payload = {
        "sub": str(user_id),
        "username": username,
        "role": role,
        "iat": now,
        "exp": now + EXPIRE_HOURS * 3600,
    }
    return jwt.encode(payload, SECRET, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    """Decode and verify a JWT token. Returns payload dict."""
    return jwt.decode(token, SECRET, algorithms=[ALGORITHM])
