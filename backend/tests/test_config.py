"""Tests for LLM config / profile management endpoints."""

import pytest


class TestGetConfig:
    """GET /api/config — list profiles and provider presets."""

    @pytest.mark.asyncio
    async def test_get_config_empty(self, client, auth_headers):
        """An authenticated request returns a profiles list (with defaults) and presets."""
        resp = await client.get("/api/config", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "profiles" in data
        assert isinstance(data["profiles"], list)
        assert "presets" in data
        assert isinstance(data["presets"], dict)
        # A default profile is created during registration
        assert len(data["profiles"]) >= 1


class TestCreateProfile:
    """POST /api/config/profile — create or update an LLM profile."""

    @pytest.mark.asyncio
    async def test_create_profile(self, client, auth_headers, db_session):
        """A new profile can be created and is persisted in the database."""
        payload = {
            "name": "Test Profile",
            "provider": "openai",
            "api_key": "sk-test123",
            "base_url": "",
            "model": "gpt-4o-mini",
        }
        resp = await client.post("/api/config/profile", json=payload, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["ok"] is True
        assert "id" in data
        assert data["id"] > 0

        # Verify it appears in the profiles list
        list_resp = await client.get("/api/config", headers=auth_headers)
        profiles = list_resp.json()["profiles"]
        created = next((p for p in profiles if p["id"] == data["id"]), None)
        assert created is not None
        assert created["name"] == "Test Profile"
        assert created["model"] == "gpt-4o-mini"

    @pytest.mark.asyncio
    async def test_create_profile_no_auth(self, client):
        """Creating a profile without authentication returns 422 (missing header)."""
        resp = await client.post("/api/config/profile", json={
            "name": "Unauthorized",
            "provider": "openai",
            "api_key": "sk-xyz",
        })
        assert resp.status_code == 422


class TestUpdateProfile:
    """Update an existing LLM profile via POST /api/config/profile with an id."""

    @pytest.mark.asyncio
    async def test_update_profile(self, client, auth_headers):
        """An existing profile can be updated while keeping the same name."""
        create_payload = {
            "name": "Updatable",
            "provider": "openai",
            "api_key": "sk-oldkey",
            "base_url": "",
            "model": "gpt-4o",
        }
        create_resp = await client.post(
            "/api/config/profile", json=create_payload, headers=auth_headers,
        )
        assert create_resp.status_code == 200
        profile_id = create_resp.json()["id"]

        update_payload = {
            "id": profile_id,
            "name": "Updatable",
            "provider": "deepseek",
            "api_key": "sk-newkey",
            "base_url": "",
            "model": "deepseek-chat",
        }
        update_resp = await client.post(
            "/api/config/profile", json=update_payload, headers=auth_headers,
        )
        assert update_resp.status_code == 200

        # Verify the update was applied
        list_resp = await client.get("/api/config", headers=auth_headers)
        profiles = list_resp.json()["profiles"]
        updated = next((p for p in profiles if p["id"] == profile_id), None)
        assert updated is not None
        assert updated["name"] == "Updatable"
        assert updated["provider"] == "deepseek"
        assert updated["model"] == "deepseek-chat"


class TestActivateProfile:
    """POST /api/config/activate/{profile_id} — toggle active profile."""

    @pytest.mark.asyncio
    async def test_activate_profile(self, client, auth_headers):
        """Activating a profile toggles is_active on the correct one and
        deactivates others."""
        # Create two additional profiles (registration already made one)
        p1_resp = await client.post("/api/config/profile", json={
            "name": "Profile One",
            "provider": "openai",
            "api_key": "sk-one",
            "base_url": "",
            "model": "gpt-4o",
        }, headers=auth_headers)
        assert p1_resp.status_code == 200
        pid1 = p1_resp.json()["id"]

        p2_resp = await client.post("/api/config/profile", json={
            "name": "Profile Two",
            "provider": "deepseek",
            "api_key": "sk-two",
            "base_url": "",
            "model": "deepseek-chat",
        }, headers=auth_headers)
        assert p2_resp.status_code == 200
        pid2 = p2_resp.json()["id"]

        # Activate profile 1
        act_resp = await client.post(
            f"/api/config/activate/{pid1}", headers=auth_headers,
        )
        assert act_resp.status_code == 200

        # Verify only profile 1 is active
        list_resp = await client.get("/api/config", headers=auth_headers)
        profiles = list_resp.json()["profiles"]
        p1 = next(p for p in profiles if p["id"] == pid1)
        p2 = next(p for p in profiles if p["id"] == pid2)
        assert p1["is_active"] is True
        assert p2["is_active"] is False


class TestDeleteProfile:
    """DELETE /api/config/profile/{profile_id} — remove a profile."""

    @pytest.mark.asyncio
    async def test_delete_profile(self, client, auth_headers):
        """A profile can be created and then deleted."""
        create_resp = await client.post("/api/config/profile", json={
            "name": "To Be Deleted",
            "provider": "openai",
            "api_key": "sk-del",
            "base_url": "",
            "model": "gpt-4o",
        }, headers=auth_headers)
        assert create_resp.status_code == 200
        pid = create_resp.json()["id"]

        del_resp = await client.delete(
            f"/api/config/profile/{pid}", headers=auth_headers,
        )
        assert del_resp.status_code == 200
        assert del_resp.json()["ok"] is True

        # Verify the profile is gone
        list_resp = await client.get("/api/config", headers=auth_headers)
        profiles = list_resp.json()["profiles"]
        assert not any(p["id"] == pid for p in profiles)
