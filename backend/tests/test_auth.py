"""Tests for authentication endpoints: register, login, and profile."""

import pytest


class TestRegister:
    """POST /api/auth/register — user registration."""

    @pytest.mark.asyncio
    async def test_register_success(self, client):
        """A new user can register and receives a valid response."""
        resp = await client.post("/api/auth/register", json={
            "username": "newuser",
            "password": "secret123",
            "email": "new@example.com",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "token" in data
        assert data["username"] == "newuser"
        assert data["user_id"] > 0
        assert data["role"] == "user"

    @pytest.mark.asyncio
    async def test_register_duplicate(self, client):
        """Registering the same username twice returns 409."""
        payload = {"username": "dupuser", "password": "secret123"}

        resp1 = await client.post("/api/auth/register", json=payload)
        assert resp1.status_code == 200

        resp2 = await client.post("/api/auth/register", json=payload)
        assert resp2.status_code == 409

    @pytest.mark.asyncio
    async def test_register_short_password(self, client):
        """A password shorter than the minimum length returns a 422."""
        resp = await client.post("/api/auth/register", json={
            "username": "shortpw",
            "password": "ab",
        })
        assert resp.status_code == 422


class TestLogin:
    """POST /api/auth/login — user login."""

    @pytest.mark.asyncio
    async def test_login_success(self, client):
        """A registered user can log in with correct credentials."""
        payload = {"username": "loginuser", "password": "secret123"}

        reg_resp = await client.post("/api/auth/register", json=payload)
        assert reg_resp.status_code == 200

        login_resp = await client.post("/api/auth/login", json=payload)
        assert login_resp.status_code == 200
        data = login_resp.json()
        assert "token" in data
        assert data["username"] == "loginuser"

    @pytest.mark.asyncio
    async def test_login_wrong_password(self, client):
        """Login with an incorrect password returns 401."""
        payload = {"username": "wrongpwuser", "password": "secret123"}

        reg_resp = await client.post("/api/auth/register", json=payload)
        assert reg_resp.status_code == 200

        bad_resp = await client.post("/api/auth/login", json={
            "username": "wrongpwuser",
            "password": "badpassword",
        })
        assert bad_resp.status_code == 401

    @pytest.mark.asyncio
    async def test_login_nonexistent_user(self, client):
        """Login with a nonexistent username returns 401."""
        resp = await client.post("/api/auth/login", json={
            "username": "ghost",
            "password": "whatever",
        })
        assert resp.status_code == 401


class TestMe:
    """GET /api/auth/me — current-user profile."""

    @pytest.mark.asyncio
    async def test_me_with_valid_token(self, client, auth_headers):
        """A valid token returns the current user's information."""
        resp = await client.get("/api/auth/me", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["username"] == "testuser"
        assert data["user_id"] > 0
        assert data["role"] == "user"

    @pytest.mark.asyncio
    async def test_me_without_token(self, client):
        """A request without an Authorization header returns 422."""
        resp = await client.get("/api/auth/me")
        assert resp.status_code == 422
