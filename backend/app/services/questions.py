from typing import Any
from uuid import uuid4


def build_options(option_texts: list[str]) -> list[dict[str, str]]:
    return [{"id": uuid4().hex[:12], "text": text} for text in option_texts]


def question_public(doc: dict[str, Any], include_correct: bool = False) -> dict[str, Any]:
    out = {
        "id": str(doc["_id"]),
        "event_id": str(doc["event_id"]),
        "order": doc["order"],
        "text": doc["text"],
        "options": [{"id": o["id"], "text": o["text"]} for o in doc["options"]],
        "source": doc.get("source", "manual"),
    }
    if include_correct:
        out["correct_option_id"] = doc.get("correct_option_id")
    else:
        out["correct_option_id"] = None
    return out
