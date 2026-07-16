"""Hello Sara — Phase 1 backend end-to-end pytest suite.

Covers meta/health, AI providers, dual-auth (JWT + Emergent session),
profile, settings, memories, history, reminders and user isolation.
Uses the public EXPO_PUBLIC_BACKEND_URL preview endpoint.
"""
import os
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL")
if not BASE_URL:
    # fallback to non-public env name used by some services
    BASE_URL = os.environ.get("EXPO_BACKEND_URL")
assert BASE_URL, "EXPO_PUBLIC_BACKEND_URL must be set"
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"


# --- helpers -----------------------------------------------------------------
def _unique_email(prefix="TEST_p1"):
    return f"{prefix}_{uuid.uuid4().hex[:10]}@hellosara-test.com".lower()


@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="session")
def user_a(s):
    email = _unique_email("TEST_a")
    r = s.post(f"{API}/auth/register", json={
        "email": email, "password": "HelloSaraTest123!", "name": "User A",
    }, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    return {"email": email, "token": data["token"], "user": data["user"]}


@pytest.fixture(scope="session")
def user_b(s):
    email = _unique_email("TEST_b")
    r = s.post(f"{API}/auth/register", json={
        "email": email, "password": "HelloSaraTest123!", "name": "User B",
    }, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    return {"email": email, "token": data["token"], "user": data["user"]}


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


# --- meta --------------------------------------------------------------------
class TestMeta:
    def test_health(self, s):
        r = s.get(f"{API}/health", timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert body.get("status") == "ok"
        assert "time" in body

    def test_ai_providers(self, s):
        r = s.get(f"{API}/ai/providers", timeout=15)
        assert r.status_code == 200
        providers = r.json()
        assert isinstance(providers, list)
        ids = {p["id"] for p in providers}
        expected = {"ollama", "llama_cpp", "vllm", "lm_studio", "openrouter"}
        assert expected.issubset(ids), f"missing providers: {expected - ids}"
        for p in providers:
            assert "label" in p and "default_base_url" in p
            assert "supports_streaming" in p and "example_models" in p


# --- auth --------------------------------------------------------------------
class TestAuth:
    def test_register_creates_user_and_settings(self, s):
        email = _unique_email("TEST_reg")
        r = s.post(f"{API}/auth/register", json={
            "email": email, "password": "GoodPass1234!", "name": "Reg User",
        }, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["token_type"] == "jwt"
        assert data["token"]
        user = data["user"]
        assert user["email"] == email
        assert user["provider"] == "email"
        assert user["onboarding_completed"] is False
        # no mongo _id leak
        assert "_id" not in user

        # settings should be auto-seeded on first GET
        r2 = s.get(f"{API}/settings", headers=_auth(data["token"]), timeout=15)
        assert r2.status_code == 200
        sett = r2.json()
        assert sett["theme"] == "dark"
        assert sett["ai_provider"] == "ollama"
        assert "_id" not in sett

    def test_register_duplicate_email_409(self, s, user_a):
        r = s.post(f"{API}/auth/register", json={
            "email": user_a["email"], "password": "GoodPass1234!", "name": "Dup",
        }, timeout=15)
        assert r.status_code == 409, r.text

    def test_register_short_password_422(self, s):
        r = s.post(f"{API}/auth/register", json={
            "email": _unique_email("TEST_short"),
            "password": "short",
            "name": "Short",
        }, timeout=15)
        assert r.status_code == 422

    def test_login_success(self, s, user_a):
        r = s.post(f"{API}/auth/login", json={
            "email": user_a["email"], "password": "HelloSaraTest123!",
        }, timeout=15)
        assert r.status_code == 200
        assert r.json()["token"]

    def test_login_wrong_password_401(self, s, user_a):
        r = s.post(f"{API}/auth/login", json={
            "email": user_a["email"], "password": "wrongwrongwrong",
        }, timeout=15)
        assert r.status_code == 401

    def test_google_session_invalid_401(self, s):
        r = s.post(f"{API}/auth/google/session", json={
            "session_token": "definitely-not-a-real-token",
        }, timeout=30)
        assert r.status_code == 401

    def test_me_with_token(self, s, user_a):
        r = s.get(f"{API}/auth/me", headers=_auth(user_a["token"]), timeout=15)
        assert r.status_code == 200
        assert r.json()["email"] == user_a["email"]

    def test_me_without_token_401(self, s):
        r = s.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 401


# --- profile & settings ------------------------------------------------------
class TestProfileSettings:
    def test_update_onboarding_persists(self, s, user_a):
        r = s.patch(
            f"{API}/profile", headers=_auth(user_a["token"]),
            json={"onboarding_completed": True}, timeout=15,
        )
        assert r.status_code == 200
        assert r.json()["onboarding_completed"] is True

        r2 = s.get(f"{API}/auth/me", headers=_auth(user_a["token"]), timeout=15)
        assert r2.json()["onboarding_completed"] is True

    def test_patch_settings(self, s, user_a):
        payload = {
            "theme": "amoled",
            "language": "es",
            "ai_provider": "vllm",
            "ai_provider_base_url": "http://localhost:8000/v1",
        }
        r = s.patch(
            f"{API}/settings", headers=_auth(user_a["token"]),
            json=payload, timeout=15,
        )
        assert r.status_code == 200
        got = r.json()
        for k, v in payload.items():
            assert got[k] == v, f"{k}: {got[k]} != {v}"

        r2 = s.get(f"{API}/settings", headers=_auth(user_a["token"]), timeout=15)
        for k, v in payload.items():
            assert r2.json()[k] == v


# --- memories ----------------------------------------------------------------
class TestMemories:
    def test_memory_crud_and_search(self, s, user_a):
        h = _auth(user_a["token"])
        # create
        r = s.post(f"{API}/memories", headers=h, json={
            "title": "TEST_favorite color",
            "content": "My favorite color is periwinkle.",
            "tags": ["prefs", "color"],
        }, timeout=15)
        assert r.status_code == 201, r.text
        mem = r.json()
        assert mem["memory_id"].startswith("mem_")
        assert "_id" not in mem
        mem_id = mem["memory_id"]

        # list
        r2 = s.get(f"{API}/memories", headers=h, timeout=15)
        assert r2.status_code == 200
        assert any(m["memory_id"] == mem_id for m in r2.json())

        # search by q
        r3 = s.get(f"{API}/memories?q=periwinkle", headers=h, timeout=15)
        assert r3.status_code == 200
        assert any(m["memory_id"] == mem_id for m in r3.json())

        # filter by tag
        r4 = s.get(f"{API}/memories?tag=color", headers=h, timeout=15)
        assert r4.status_code == 200
        assert any(m["memory_id"] == mem_id for m in r4.json())

        # patch
        r5 = s.patch(f"{API}/memories/{mem_id}", headers=h, json={
            "title": "TEST_favorite color updated",
        }, timeout=15)
        assert r5.status_code == 200
        assert r5.json()["title"] == "TEST_favorite color updated"

        # delete
        r6 = s.delete(f"{API}/memories/{mem_id}", headers=h, timeout=15)
        assert r6.status_code == 200

        # delete again → 404
        r7 = s.delete(f"{API}/memories/{mem_id}", headers=h, timeout=15)
        assert r7.status_code == 404


# --- history -----------------------------------------------------------------
class TestHistory:
    def test_history_create_list_sort_and_clear(self, s, user_a):
        h = _auth(user_a["token"])
        # clear existing first for a clean slate
        s.delete(f"{API}/history", headers=h, timeout=15)
        ids = []
        for i in range(3):
            r = s.post(f"{API}/history", headers=h, json={
                "title": f"TEST_hist_{i}",
                "snippet": f"snippet {i}",
                "turns": i + 1,
            }, timeout=15)
            assert r.status_code == 201, r.text
            ids.append(r.json()["history_id"])

        r = s.get(f"{API}/history", headers=h, timeout=15)
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 3
        # sorted desc by created_at → last inserted should be first
        assert items[0]["history_id"] == ids[-1]

        # clear-all
        r = s.delete(f"{API}/history", headers=h, timeout=15)
        assert r.status_code == 200
        r = s.get(f"{API}/history", headers=h, timeout=15)
        assert r.json() == []


# --- reminders ---------------------------------------------------------------
class TestReminders:
    def test_reminder_crud(self, s, user_a):
        h = _auth(user_a["token"])
        when = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
        r = s.post(f"{API}/reminders", headers=h, json={
            "title": "TEST_call mum",
            "notes": "Sunday brunch",
            "remind_at": when,
        }, timeout=15)
        assert r.status_code == 201, r.text
        rem = r.json()
        assert rem["reminder_id"].startswith("rem_")
        assert "_id" not in rem
        rem_id = rem["reminder_id"]

        r2 = s.get(f"{API}/reminders", headers=h, timeout=15)
        assert any(x["reminder_id"] == rem_id for x in r2.json())

        r3 = s.delete(f"{API}/reminders/{rem_id}", headers=h, timeout=15)
        assert r3.status_code == 200


# --- isolation ---------------------------------------------------------------
class TestIsolation:
    def test_users_cannot_see_each_other_data(self, s, user_a, user_b):
        ha, hb = _auth(user_a["token"]), _auth(user_b["token"])
        # user A creates a memory
        r = s.post(f"{API}/memories", headers=ha, json={
            "title": "TEST_iso secret", "content": "only A", "tags": ["iso"],
        }, timeout=15)
        assert r.status_code == 201
        a_mem_id = r.json()["memory_id"]

        # user B lists memories → should not see it
        r2 = s.get(f"{API}/memories", headers=hb, timeout=15)
        assert r2.status_code == 200
        assert all(m["memory_id"] != a_mem_id for m in r2.json())

        # user B cannot delete A's memory (returns 404 due to user_id scoping)
        r3 = s.delete(f"{API}/memories/{a_mem_id}", headers=hb, timeout=15)
        assert r3.status_code == 404

        # cleanup
        s.delete(f"{API}/memories/{a_mem_id}", headers=ha, timeout=15)
