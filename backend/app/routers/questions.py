from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.deps import get_current_user, oid
from app.db.mongo import get_db
from app.models.schemas import GenerateQuestionsRequest, MessageOut, QuestionCreate, QuestionOut, QuestionUpdate
from app.services.ai import generate_mcq
from app.services.events import user_in_org, utcnow
from app.services.questions import build_options, question_public

router = APIRouter(tags=["questions"])


async def _owned_event(user: dict[str, Any], event_id: str) -> dict[str, Any]:
    db = get_db()
    event = await db.events.find_one({"_id": oid(event_id)})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if not user_in_org(user, str(event["org_id"])):
        raise HTTPException(status_code=403, detail="Forbidden")
    return event


@router.get("/events/{event_id}/questions", response_model=list[QuestionOut])
async def list_questions(
    event_id: str,
    user: Annotated[dict[str, Any], Depends(get_current_user)],
) -> list[dict[str, Any]]:
    await _owned_event(user, event_id)
    db = get_db()
    cursor = db.questions.find({"event_id": oid(event_id)}).sort("order", 1)
    return [question_public(q, include_correct=True) async for q in cursor]


@router.post("/events/{event_id}/questions", response_model=QuestionOut, status_code=status.HTTP_201_CREATED)
async def create_question(
    event_id: str,
    body: QuestionCreate,
    user: Annotated[dict[str, Any], Depends(get_current_user)],
) -> dict[str, Any]:
    event = await _owned_event(user, event_id)
    if body.correct_option_index is None and event["type"] == "quiz":
        raise HTTPException(status_code=400, detail="correct_option_index required for quiz")
    if body.correct_option_index is not None and body.correct_option_index >= len(body.options):
        raise HTTPException(status_code=400, detail="correct_option_index out of range")

    db = get_db()
    order = body.order
    if order is None:
        order = await db.questions.count_documents({"event_id": oid(event_id)})

    options = build_options([o.text for o in body.options])
    correct_id = None
    if body.correct_option_index is not None:
        correct_id = options[body.correct_option_index]["id"]

    doc = {
        "event_id": oid(event_id),
        "order": order,
        "text": body.text.strip(),
        "options": options,
        "correct_option_id": correct_id,
        "source": "manual",
        "created_at": utcnow(),
    }
    result = await db.questions.insert_one(doc)
    doc["_id"] = result.inserted_id
    return question_public(doc, include_correct=True)


@router.patch("/questions/{question_id}", response_model=QuestionOut)
async def update_question(
    question_id: str,
    body: QuestionUpdate,
    user: Annotated[dict[str, Any], Depends(get_current_user)],
) -> dict[str, Any]:
    db = get_db()
    question = await db.questions.find_one({"_id": oid(question_id)})
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    await _owned_event(user, str(question["event_id"]))

    updates: dict[str, Any] = {}
    if body.text is not None:
        updates["text"] = body.text.strip()
    if body.order is not None:
        updates["order"] = body.order
    if body.options is not None:
        options = build_options([o.text for o in body.options])
        updates["options"] = options
        if body.correct_option_index is not None:
            if body.correct_option_index >= len(options):
                raise HTTPException(status_code=400, detail="correct_option_index out of range")
            updates["correct_option_id"] = options[body.correct_option_index]["id"]
    elif body.correct_option_index is not None:
        options = question["options"]
        if body.correct_option_index >= len(options):
            raise HTTPException(status_code=400, detail="correct_option_index out of range")
        updates["correct_option_id"] = options[body.correct_option_index]["id"]

    if updates:
        await db.questions.update_one({"_id": question["_id"]}, {"$set": updates})
    question = await db.questions.find_one({"_id": question["_id"]})
    return question_public(question, include_correct=True)


@router.delete("/questions/{question_id}", response_model=MessageOut)
async def delete_question(
    question_id: str,
    user: Annotated[dict[str, Any], Depends(get_current_user)],
) -> dict[str, str]:
    db = get_db()
    question = await db.questions.find_one({"_id": oid(question_id)})
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    await _owned_event(user, str(question["event_id"]))
    await db.questions.delete_one({"_id": question["_id"]})
    return {"message": "Question deleted"}


@router.post("/events/{event_id}/generate-questions", response_model=list[QuestionOut])
async def generate_questions(
    event_id: str,
    body: GenerateQuestionsRequest,
    user: Annotated[dict[str, Any], Depends(get_current_user)],
) -> list[dict[str, Any]]:
    await _owned_event(user, event_id)
    drafts = await generate_mcq(body.subject, body.count, body.difficulty)
    db = get_db()
    start_order = await db.questions.count_documents({"event_id": oid(event_id)})
    created = []
    for i, draft in enumerate(drafts):
        options = build_options(draft["options"])
        idx = draft["correct_option_index"]
        doc = {
            "event_id": oid(event_id),
            "order": start_order + i,
            "text": draft["text"],
            "options": options,
            "correct_option_id": options[idx]["id"],
            "source": "ai",
            "created_at": utcnow(),
        }
        result = await db.questions.insert_one(doc)
        doc["_id"] = result.inserted_id
        created.append(question_public(doc, include_correct=True))
    return created
