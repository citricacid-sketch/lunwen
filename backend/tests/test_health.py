"""Tests for the health-check endpoint."""

import pytest


class TestHealth:
    """GET /api/health — health-check endpoint."""

    @pytest.mark.asyncio
    async def test_health_check(self, client):
        """The health endpoint returns 200 with the expected keys."""
        response = await client.get("/api/health")
        assert response.status_code == 200

        data = response.json()
        assert "status" in data
        assert data["status"] == "ok"
        assert "version" in data
        assert "provider" in data
        assert "model" in data
        assert "llm_available" in data
