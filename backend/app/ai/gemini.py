"""Minimal Gemini client over the REST API.

Deliberately dependency-light: uses httpx (already a backend dep) instead of a
heavy SDK, so the AI layer is transparent and easy to reason about. Reads
GEMINI_API_KEY / GEMINI_MODEL from backend/.env.
"""
from __future__ import annotations

import os
import time

import httpx
from dotenv import load_dotenv

# load backend/.env (this file is backend/app/ai/gemini.py -> ../../.env)
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

API_KEY = os.getenv("GEMINI_API_KEY", "")
MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
BASE = "https://generativelanguage.googleapis.com/v1beta"


class GeminiError(RuntimeError):
    pass


def _post(url: str, body: dict, timeout: float, retries: int = 3) -> httpx.Response:
    """POST with retry on transient 429/503 (Gemini load) and network errors.

    We never sleep after the final attempt: when the quota is exhausted the call
    will keep failing, so the caller should fall through to its fallback fast
    rather than block the request (this is on the demo critical path)."""
    last: Exception | None = None
    for attempt in range(retries):
        try:
            r = httpx.post(url, json=body, timeout=timeout)
        except httpx.HTTPError as e:
            last = GeminiError(f"request failed: {e}")
        else:
            if r.status_code not in (429, 503):
                return r
            last = GeminiError(f"HTTP {r.status_code}: {r.text[:160]}")
        if attempt < retries - 1:
            time.sleep(0.8 * (attempt + 1))
    raise last or GeminiError("request failed after retries")


def generate(
    prompt: str,
    system: str | None = None,
    temperature: float = 0.3,
    model: str | None = None,
    timeout: float = 60.0,
) -> str:
    """Single-turn text generation. Returns the model's text, or raises GeminiError."""
    if not API_KEY:
        raise GeminiError("GEMINI_API_KEY not set in backend/.env")
    m = model or MODEL
    url = f"{BASE}/models/{m}:generateContent?key={API_KEY}"
    body: dict = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": temperature},
    }
    if system:
        body["systemInstruction"] = {"parts": [{"text": system}]}

    r = _post(url, body, timeout)
    if r.status_code != 200:
        raise GeminiError(f"HTTP {r.status_code}: {r.text[:300]}")

    data = r.json()
    try:
        return data["candidates"][0]["content"]["parts"][0]["text"].strip()
    except (KeyError, IndexError):
        # safety block or empty completion
        raise GeminiError(f"no text in response: {str(data)[:300]}")


def embed(text: str, model: str = "gemini-embedding-001", timeout: float = 30.0) -> list[float]:
    """Return the embedding vector for `text` (used by the disaster-memory RAG)."""
    if not API_KEY:
        raise GeminiError("GEMINI_API_KEY not set in backend/.env")
    url = f"{BASE}/models/{model}:embedContent?key={API_KEY}"
    body = {"model": f"models/{model}", "content": {"parts": [{"text": text}]}}
    r = _post(url, body, timeout)
    if r.status_code != 200:
        raise GeminiError(f"embed HTTP {r.status_code}: {r.text[:300]}")
    try:
        return r.json()["embedding"]["values"]
    except (KeyError, TypeError):
        raise GeminiError(f"no embedding in response: {r.text[:300]}")
