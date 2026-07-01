"""Pytest fixtures and configuration for backend tests.

Uses SQLite (aiosqlite) as a lightweight test database, overriding the MySQL
get_db dependency via FastAPI's dependency_overrides mechanism.
"""

import asyncio
import os

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db.models import Base
from app.db.session import get_db
from app.main import app

# ── SQLite test engine ──────────────────────────────────────────────────────

TEST_DB_PATH = os.path.join(os.path.dirname(__file__), "test.db")
TEST_DATABASE_URL = f"sqlite+aiosqlite:///{TEST_DB_PATH}"

test_engine = create_async_engine(TEST_DATABASE_URL, echo=False)


@event.listens_for(test_engine.sync_engine, "connect")
def _set_sqlite_pragma(dbapi_connection, _connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


TestSessionLocal = async_sessionmaker(
    test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


# ── Dependency override ─────────────────────────────────────────────────────


async def override_get_db() -> AsyncSession:
    """Override get_db to yield a SQLite session instead of MySQL."""
    async with TestSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


app.dependency_overrides[get_db] = override_get_db


# ── Fixtures ────────────────────────────────────────────────────────────────


@pytest.fixture(autouse=True)
async def setup_database():
    """Create all tables before each test, drop them afterward."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture(scope="session", autouse=True)
def cleanup_test_db():
    """Remove the test database file after the entire test session."""
    yield
    # Dispose engine to release file handles (required on Windows)
    asyncio.run(test_engine.dispose())
    if os.path.exists(TEST_DB_PATH):
        os.remove(TEST_DB_PATH)


@pytest.fixture
async def client():
    """Async HTTP client that talks directly to the FastAPI app via ASGI."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
async def db_session():
    """Direct database session for side-channel assertions in tests."""
    async with TestSessionLocal() as session:
        yield session


@pytest.fixture
async def auth_headers(client):
    """Register a test user, log in, and return Authorization headers."""
    resp = await client.post("/api/auth/register", json={
        "username": "testuser",
        "password": "testpass123",
        "email": "test@example.com",
    })
    assert resp.status_code == 200, f"Failed to register test user: {resp.text}"
    data = resp.json()
    return {"Authorization": f"Bearer {data['token']}"}
