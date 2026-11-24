"""Conductor-driven live quiz sync + speed scoring."""

from datetime import datetime, timezone
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.deps import get_current_user, get_optional_participant, get_participant, oid
from app.db.mongo import get_db
from app.services.events import ensure_aware, user_in_org, utcnow
from app.services.questions import question_public

router = APIRouter(tags=["live"])

BASE_POINTS = 1000
# Points decay from BASE to 0 over the question window (ms granularity).


def _require_subscriber(user: dict[str, Any]) -> None:
    role = user.get("role")
    if role == "admin":
        return
    if role == "subscriber":
        sub = user.get("subscription") or {}
        if sub.get("status") == "active":
            return
        # one-time plan still active if status active
    if role in ("organizer", "subscriber"):
        # allow legacy organizers during migration
        return
    raise HTTPException(status_code=403, detail="Active subscription required")


async def _owned_event(user: dict[str, Any], event_id: str) -> dict[str, Any]:
    _require_subscriber(user)
    db = get_db()
    event = await db.events.find_one({"_id": oid(event_id)})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if not user_in_org(user, str(event["org_id"])) and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Forbidden")
    return event


async def _questions(event_id: Any) -> list[dict[str, Any]]:
    db = get_db()
    return [q async for q in db.questions.find({"event_id": event_id}).sort("order", 1)]


def _seconds_left(event: dict[str, Any]) -> int | None:
    if event.get("live_phase") != "question":
        return None
    opened = event.get("question_opened_at")
    if not opened:
        return None
    opened = ensure_aware(opened)
    elapsed = (utcnow() - opened).total_seconds()
    left = int(event.get("per_question_seconds", 30) - elapsed)
    return max(0, left)


def _compute_points(correct: bool, elapsed_ms: int, window_seconds: int) -> int:
    if not correct:
        return 0
    window_ms = max(window_seconds, 1) * 1000
    remaining = max(0, window_ms - elapsed_ms)
    return int(BASE_POINTS * (remaining / window_ms))


def _public_live_state(
    event: dict[str, Any],
    questions: list[dict[str, Any]],
    *,
    include_correct: bool = False,
    conductor_extras: dict[str, Any] | None = None,
) -> dict[str, Any]:
    idx = int(event.get("live_question_index") or 0)
    phase = event.get("live_phase") or "waiting"
    q = None
    if phase in ("question", "reveal") and 0 <= idx < len(questions):
        q = question_public(questions[idx], include_correct=include_correct and phase == "reveal")
        if phase == "reveal" and include_correct:
            q = question_public(questions[idx], include_correct=True)
        elif phase == "question":
            q = question_public(questions[idx], include_correct=False)

    out: dict[str, Any] = {
        "event_id": str(event["_id"]),
        "title": event["title"],
        "join_code": event.get("join_code"),
        "live_phase": phase,
        "live_question_index": idx,
        "total_questions": len(questions),
        "per_question_seconds": event.get("per_question_seconds", 30),
        "question_opened_at": event.get("question_opened_at"),
        "seconds_left": _seconds_left(event),
        "question": q,
        "start_at": event.get("start_at"),
        "status": event.get("status"),
    }
    if conductor_extras:
        out.update(conductor_extras)
    return out


@router.get("/events/join/{code}")
async def get_by_join_code(code: str) -> dict[str, Any]:
    db = get_db()
    event = await db.events.find_one({"join_code": code.upper().strip()})
    if not event or event.get("status") == "draft":
        raise HTTPException(status_code=404, detail="Event not found")
    questions = await _questions(event["_id"])
    return {
        "id": str(event["_id"]),
        "title": event["title"],
        "description": event.get("description", ""),
        "theme": event.get("theme"),
        "start_at": event["start_at"],
        "join_code": event.get("join_code"),
        "registration_open": True,  # QR path allowed until capacity
        "capacity": event["capacity"],
        "registration_count": event.get("registration_count", 0),
        "live_phase": event.get("live_phase") or "waiting",
        "question_count": len(questions),
        "org_name": "Organizer",
    }


@router.get("/events/{event_id}/live/state")
async def live_state(
    event_id: str,
    registration: Annotated[dict[str, Any] | None, Depends(get_optional_participant)] = None,
) -> dict[str, Any]:
    db = get_db()
    event = await db.events.find_one({"_id": oid(event_id)})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    questions = await _questions(event["_id"])
    phase = event.get("live_phase") or "waiting"

    # Auto-flip to reveal when timer hits 0 (keeps phones in sync without conductor click)
    if phase == "question" and (_seconds_left(event) or 0) == 0:
        await db.events.update_one(
            {"_id": event["_id"]},
            {"$set": {"live_phase": "reveal", "updated_at": utcnow()}},
        )
        event = await db.events.find_one({"_id": event["_id"]})
        phase = "reveal"

    my_answers: list[dict[str, Any]] = []
    if registration and str(registration["event_id"]) == event_id:
        attempt = await db.attempts.find_one(
            {"event_id": event["_id"], "registration_id": registration["_id"]}
        )
        if attempt:
            my_answers = attempt.get("answers", [])

    state = _public_live_state(event, questions, include_correct=phase == "reveal")
    state["my_answers"] = [
        {
            "question_id": a.get("question_id"),
            "correct": a.get("correct"),
            "points": a.get("points", 0),
            "elapsed_ms": a.get("elapsed_ms"),
        }
        for a in my_answers
    ]
    return state


@router.get("/events/{event_id}/live/conductor")
async def conductor_state(
    event_id: str,
    user: Annotated[dict[str, Any], Depends(get_current_user)],
) -> dict[str, Any]:
    event = await _owned_event(user, event_id)
    db = get_db()
    questions = await _questions(event["_id"])
    phase = event.get("live_phase") or "waiting"
    if phase == "question" and (_seconds_left(event) or 0) == 0:
        await db.events.update_one(
            {"_id": event["_id"]},
            {"$set": {"live_phase": "reveal", "updated_at": utcnow()}},
        )
        event = await db.events.find_one({"_id": event["_id"]})
        phase = "reveal"

    correct_board: list[dict[str, Any]] = []
    if phase == "reveal" and questions:
        idx = int(event.get("live_question_index") or 0)
        if 0 <= idx < len(questions):
            qid = str(questions[idx]["_id"])
            async for attempt in db.attempts.find({"event_id": event["_id"]}):
                for a in attempt.get("answers", []):
                    if a.get("question_id") == qid and a.get("correct"):
                        reg = await db.registrations.find_one({"_id": attempt["registration_id"]})
                        correct_board.append(
                            {
                                "name": reg.get("name") if reg else "Participant",
                                "elapsed_ms": a.get("elapsed_ms"),
                                "points": a.get("points", 0),
                            }
                        )
            correct_board.sort(key=lambda x: (x.get("elapsed_ms") is None, x.get("elapsed_ms", 10**9)))

    leaderboard: list[dict[str, Any]] = []
    async for attempt in db.attempts.find({"event_id": event["_id"]}):
        reg = await db.registrations.find_one({"_id": attempt["registration_id"]})
        leaderboard.append(
            {
                "name": reg.get("name") if reg else "Participant",
                "score": attempt.get("score", 0),
                "correct_count": sum(1 for a in attempt.get("answers", []) if a.get("correct")),
            }
        )
    leaderboard.sort(key=lambda x: x["score"], reverse=True)

    return _public_live_state(
        event,
        questions,
        include_correct=True,
        conductor_extras={
            "correct_this_question": correct_board,
            "leaderboard": leaderboard[:20],
            "registration_count": event.get("registration_count", 0),
        },
    )


@router.post("/events/{event_id}/live/start")
async def live_start(
    event_id: str,
    user: Annotated[dict[str, Any], Depends(get_current_user)],
) -> dict[str, Any]:
    event = await _owned_event(user, event_id)
    db = get_db()
    questions = await _questions(event["_id"])
    if not questions:
        raise HTTPException(status_code=400, detail="Add questions first")
    await db.events.update_one(
        {"_id": event["_id"]},
        {
            "$set": {
                "status": "live",
                "live_phase": "question",
                "live_question_index": 0,
                "question_opened_at": utcnow(),
                "updated_at": utcnow(),
            }
        },
    )
    event = await db.events.find_one({"_id": event["_id"]})
    return _public_live_state(event, questions, include_correct=False)


@router.post("/events/{event_id}/live/reveal")
async def live_reveal(
    event_id: str,
    user: Annotated[dict[str, Any], Depends(get_current_user)],
) -> dict[str, Any]:
    event = await _owned_event(user, event_id)
    db = get_db()
    await db.events.update_one(
        {"_id": event["_id"]},
        {"$set": {"live_phase": "reveal", "updated_at": utcnow()}},
    )
    event = await db.events.find_one({"_id": event["_id"]})
    questions = await _questions(event["_id"])
    return await conductor_state(event_id, user)


@router.post("/events/{event_id}/live/next")
async def live_next(
    event_id: str,
    user: Annotated[dict[str, Any], Depends(get_current_user)],
) -> dict[str, Any]:
    event = await _owned_event(user, event_id)
    db = get_db()
    questions = await _questions(event["_id"])
    idx = int(event.get("live_question_index") or 0) + 1
    if idx >= len(questions):
        await db.events.update_one(
            {"_id": event["_id"]},
            {"$set": {"live_phase": "finished", "status": "ended", "updated_at": utcnow()}},
        )
    else:
        await db.events.update_one(
            {"_id": event["_id"]},
            {
                "$set": {
                    "live_phase": "question",
                    "live_question_index": idx,
                    "question_opened_at": utcnow(),
                    "updated_at": utcnow(),
                }
            },
        )
    return await conductor_state(event_id, user)


@router.post("/events/{event_id}/live/answer")
async def live_answer(
    event_id: str,
    body: dict[str, Any],
    registration: Annotated[dict[str, Any], Depends(get_participant)],
) -> dict[str, Any]:
    if str(registration["event_id"]) != event_id:
        raise HTTPException(status_code=403, detail="Wrong event")
    db = get_db()
    event = await db.events.find_one({"_id": oid(event_id)})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event.get("live_phase") != "question":
        raise HTTPException(status_code=400, detail="Answering is closed for this question")

    left = _seconds_left(event)
    if left is not None and left <= 0:
        raise HTTPException(status_code=400, detail="Time is up")

    questions = await _questions(event["_id"])
    idx = int(event.get("live_question_index") or 0)
    if idx >= len(questions):
        raise HTTPException(status_code=400, detail="No active question")
    question = questions[idx]
    qid = str(question["_id"])
    if body.get("question_id") != qid:
        raise HTTPException(status_code=400, detail="Question mismatch")

    option_id = body.get("option_id")
    valid = {o["id"] for o in question["options"]}
    if option_id not in valid:
        raise HTTPException(status_code=400, detail="Invalid option")

    opened = ensure_aware(event["question_opened_at"])
    elapsed_ms = int((utcnow() - opened).total_seconds() * 1000)
    correct = option_id == question.get("correct_option_id")
    points = _compute_points(correct, elapsed_ms, event.get("per_question_seconds", 30))

    attempt = await db.attempts.find_one(
        {"event_id": event["_id"], "registration_id": registration["_id"]}
    )
    if not attempt:
        attempt = {
            "event_id": event["_id"],
            "registration_id": registration["_id"],
            "status": "in_progress",
            "started_at": utcnow(),
            "answers": [],
            "score": 0,
            "max_score": len(questions) * BASE_POINTS,
        }
        result = await db.attempts.insert_one(attempt)
        attempt["_id"] = result.inserted_id

    answers = [a for a in attempt.get("answers", []) if a.get("question_id") != qid]
    answers.append(
        {
            "question_id": qid,
            "option_id": option_id,
            "correct": correct,
            "elapsed_ms": elapsed_ms,
            "points": points,
            "answered_at": utcnow(),
        }
    )
    score = sum(a.get("points", 0) for a in answers)
    await db.attempts.update_one(
        {"_id": attempt["_id"]},
        {"$set": {"answers": answers, "score": score, "updated_at": utcnow()}},
    )
    return {"correct": correct, "points": points, "elapsed_ms": elapsed_ms, "score": score}
