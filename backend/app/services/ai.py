import json
import re
from typing import Any

import httpx

from app.core.config import get_settings


def _extract_json(text: str) -> Any:
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]*\}|\[[\s\S]*\]", text)
        if not match:
            raise ValueError("Model did not return JSON")
        return json.loads(match.group(0))


async def generate_mcq(subject: str, count: int, difficulty: str = "medium") -> list[dict[str, Any]]:
    """Generate quiz drafts. Requires LLM_API_KEY. Falls back to local templates if unset."""
    settings = get_settings()
    subject = subject.strip()[:200]

    if not settings.llm_api_key:
        return _fallback_questions(subject, count)

    system = (
        "You generate multiple-choice quiz questions. "
        "Return ONLY valid JSON: an array of objects with keys "
        "text (string), options (array of 4 strings), correct_option_index (0-3). "
        "No markdown fences."
    )
    user = (
        f"Subject: {subject}\n"
        f"Difficulty: {difficulty}\n"
        f"Generate exactly {count} questions."
    )

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            f"{settings.llm_base_url.rstrip('/')}/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.llm_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": settings.llm_model,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                "temperature": 0.4,
            },
        )
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"]

    data = _extract_json(content)
    if not isinstance(data, list):
        raise ValueError("Expected a JSON array of questions")

    validated: list[dict[str, Any]] = []
    for item in data[:count]:
        text = str(item.get("text", "")).strip()
        options = item.get("options") or []
        idx = int(item.get("correct_option_index", 0))
        if not text or len(options) < 2:
            continue
        options = [str(o).strip() for o in options][:8]
        if idx < 0 or idx >= len(options):
            idx = 0
        validated.append({"text": text, "options": options, "correct_option_index": idx})

    if len(validated) < 1:
        raise ValueError("No valid questions generated")
    return validated


def _fallback_questions(subject: str, count: int) -> list[dict[str, Any]]:
    out = []
    for i in range(1, count + 1):
        out.append(
            {
                "text": f"[{subject}] Sample question {i}: which option is correct?",
                "options": [
                    f"Correct answer for {subject} #{i}",
                    f"Distractor A #{i}",
                    f"Distractor B #{i}",
                    f"Distractor C #{i}",
                ],
                "correct_option_index": 0,
            }
        )
    return out
