from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.deps import get_current_user, get_participant, oid
from app.db.mongo import get_db
from app.models.schemas import AnswerSubmit, AttemptQuestionOut, AttemptResultOut
from app.services.events import can_start_attempt, ensure_aware, user_in_org, utcnow
from app.services.questions import question_public

router = APIRouter(tags=["quiz"])

GRACE_SECONDS = 2


async def _questions(event_id: Any) -> list[dict[str, Any]]:
    db = get_db()
    return [q async for q in db.questions.find({"event_id": event_id}).sort("order", 1)]


def _timed_out(attempt: dict[str, Any], per_question_seconds: int) -> bool:
    started = ensure_aware(attempt["question_started_at"])
    elapsed = (utcnow() - started).total_seconds()
    return elapsed > (per_question_seconds + GRACE_SECONDS)


async def _advance_or_finish(
    attempt: dict[str, Any],
    questions: list[dict[str, Any]],
    event: dict[str, Any],
    option_id: str | None,
    timed_out: bool,
) -> dict[str, Any]:
    db = get_db()
    idx = attempt["current_question_index"]
    question = questions[idx]
    correct = False
    if not timed_out and option_id and event["type"] == "quiz":
        correct = option_id == question.get("correct_option_id")
    elif event["type"] == "survey" and option_id and not timed_out:
        correct = True  # surveys don't score correctness; count answered

    answer = {
        "question_id": str(question["_id"]),
        "option_id": option_id,
        "answered_at": utcnow(),
        "correct": correct if event["type"] == "quiz" else None,
        "timed_out": timed_out,
    }
    answers = list(attempt.get("answers", []))
    answers.append(answer)

    next_idx = idx + 1
    if next_idx >= len(questions):
        if event["type"] == "quiz":
            score = sum(1 for a in answers if a.get("correct") is True)
        else:
            score = sum(1 for a in answers if a.get("option_id"))
        updated = {
            "answers": answers,
            "status": "completed",
            "finished_at": utcnow(),
            "score": score,
            "max_score": len(questions),
            "current_question_index": next_idx,
        }
        await db.attempts.update_one({"_id": attempt["_id"]}, {"$set": updated})
        attempt.update(updated)
        return attempt

    updated = {
        "answers": answers,
        "current_question_index": next_idx,
        "question_started_at": utcnow(),
    }
    await db.attempts.update_one({"_id": attempt["_id"]}, {"$set": updated})
    attempt.update(updated)
    return attempt


def _payload(attempt: dict[str, Any], questions: list[dict[str, Any]], event: dict[str, Any]) -> dict[str, Any]:
    completed = attempt.get("status") == "completed"
    idx = attempt["current_question_index"]
    question = None
    if not completed and idx < len(questions):
        question = question_public(questions[idx], include_correct=False)
    return {
        "attempt_id": str(attempt["_id"]),
        "question_index": min(idx, len(questions)),
        "total_questions": len(questions),
        "per_question_seconds": event["per_question_seconds"],
        "question_started_at": attempt.get("question_started_at") or attempt["started_at"],
        "question": question,
        "completed": completed,
        "score": attempt.get("score"),
        "max_score": attempt.get("max_score"),
    }


@router.post("/events/{event_id}/attempts/start", response_model=AttemptQuestionOut)
async def start_attempt(
    event_id: str,
    registration: Annotated[dict[str, Any], Depends(get_participant)],
) -> dict[str, Any]:
    if str(registration["event_id"]) != event_id:
        raise HTTPException(status_code=403, detail="Registration does not match event")

    db = get_db()
    event = await db.events.find_one({"_id": oid(event_id)})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if not can_start_attempt(event):
        raise HTTPException(status_code=403, detail="Event is not open for attempts yet")

    questions = await _questions(event["_id"])
    if not questions:
        raise HTTPException(status_code=400, detail="Event has no questions")

    existing = await db.attempts.find_one(
        {"event_id": event["_id"], "registration_id": registration["_id"]}
    )
    if existing:
        if existing.get("status") == "completed":
            return _payload(existing, questions, event)
        return _payload(existing, questions, event)

    doc = {
        "event_id": event["_id"],
        "registration_id": registration["_id"],
        "status": "in_progress",
        "started_at": utcnow(),
        "finished_at": None,
        "current_question_index": 0,
        "question_started_at": utcnow(),
        "answers": [],
        "score": 0,
        "max_score": len(questions),
    }
    result = await db.attempts.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _payload(doc, questions, event)


@router.get("/events/{event_id}/attempts/current", response_model=AttemptQuestionOut)
async def current_attempt(
    event_id: str,
    registration: Annotated[dict[str, Any], Depends(get_participant)],
) -> dict[str, Any]:
    if str(registration["event_id"]) != event_id:
        raise HTTPException(status_code=403, detail="Registration does not match event")
    db = get_db()
    event = await db.events.find_one({"_id": oid(event_id)})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    questions = await _questions(event["_id"])
    attempt = await db.attempts.find_one(
        {"event_id": event["_id"], "registration_id": registration["_id"]}
    )
    if not attempt:
        raise HTTPException(status_code=404, detail="No attempt started")

    if attempt.get("status") != "completed" and _timed_out(attempt, event["per_question_seconds"]):
        attempt = await _advance_or_finish(attempt, questions, event, None, timed_out=True)

    return _payload(attempt, questions, event)


@router.post("/events/{event_id}/attempts/answer", response_model=AttemptQuestionOut)
async def submit_answer(
    event_id: str,
    body: AnswerSubmit,
    registration: Annotated[dict[str, Any], Depends(get_participant)],
) -> dict[str, Any]:
    if str(registration["event_id"]) != event_id:
        raise HTTPException(status_code=403, detail="Registration does not match event")

    db = get_db()
    event = await db.events.find_one({"_id": oid(event_id)})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    questions = await _questions(event["_id"])
    attempt = await db.attempts.find_one(
        {"event_id": event["_id"], "registration_id": registration["_id"]}
    )
    if not attempt or attempt.get("status") == "completed":
        raise HTTPException(status_code=400, detail="No active attempt")

    idx = attempt["current_question_index"]
    if idx >= len(questions) or str(questions[idx]["_id"]) != body.question_id:
        raise HTTPException(status_code=400, detail="Question mismatch")

    timed_out = _timed_out(attempt, event["per_question_seconds"])
    option_id = None if timed_out else body.option_id
    if option_id:
        valid_ids = {o["id"] for o in questions[idx]["options"]}
        if option_id not in valid_ids:
            raise HTTPException(status_code=400, detail="Invalid option")

    attempt = await _advance_or_finish(attempt, questions, event, option_id, timed_out=timed_out)
    return _payload(attempt, questions, event)


@router.get("/events/{event_id}/attempts/result", response_model=AttemptResultOut)
async def my_result(
    event_id: str,
    registration: Annotated[dict[str, Any], Depends(get_participant)],
) -> dict[str, Any]:
    if str(registration["event_id"]) != event_id:
        raise HTTPException(status_code=403, detail="Registration does not match event")
    db = get_db()
    attempt = await db.attempts.find_one(
        {"event_id": oid(event_id), "registration_id": registration["_id"]}
    )
    if not attempt:
        raise HTTPException(status_code=404, detail="No attempt found")
    return {
        "attempt_id": str(attempt["_id"]),
        "event_id": event_id,
        "status": attempt["status"],
        "score": attempt.get("score", 0),
        "max_score": attempt.get("max_score", 0),
        "answers": attempt.get("answers", []),
    }


@router.get("/events/{event_id}/results")
async def organizer_results(
    event_id: str,
    user: Annotated[dict[str, Any], Depends(get_current_user)],
) -> dict[str, Any]:
    db = get_db()
    event = await db.events.find_one({"_id": oid(event_id)})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if not user_in_org(user, str(event["org_id"])):
        raise HTTPException(status_code=403, detail="Forbidden")

    registrations = {
        str(r["_id"]): r
        async for r in db.registrations.find({"event_id": event["_id"]})
    }
    attempts = []
    async for a in db.attempts.find({"event_id": event["_id"]}):
        reg = registrations.get(str(a["registration_id"]), {})
        attempts.append(
            {
                "attempt_id": str(a["_id"]),
                "registration_id": str(a["registration_id"]),
                "name": reg.get("name"),
                "email": reg.get("email"),
                "status": a["status"],
                "score": a.get("score", 0),
                "max_score": a.get("max_score", 0),
                "finished_at": a.get("finished_at"),
            }
        )
    return {
        "event_id": event_id,
        "registration_count": event.get("registration_count", 0),
        "attempt_count": len(attempts),
        "attempts": attempts,
    }
