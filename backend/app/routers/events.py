import secrets
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.deps import get_current_user, oid
from app.db.mongo import get_db
from app.models.schemas import EventCreate, EventOut, EventStatus, EventUpdate, MessageOut
from app.services.events import ensure_aware, serialize_event, user_in_org, utcnow


def _join_code() -> str:
    return secrets.token_hex(3).upper()

router = APIRouter(tags=["events"])


async def _require_org_member(user: dict[str, Any], org_id: str) -> None:
    if user.get("role") == "admin":
        return
    if not user_in_org(user, org_id):
        raise HTTPException(status_code=403, detail="Forbidden")
    if user.get("role") == "subscriber":
        sub = user.get("subscription") or {}
        if sub.get("status") != "active":
            raise HTTPException(status_code=403, detail="Active subscription required")


async def _org_name(db: Any, org_id: Any) -> str:
    org = await db.organizations.find_one({"_id": org_id if not isinstance(org_id, str) else oid(org_id)})
    return org["name"] if org else "Organizer"


async def _event_out(db: Any, event: dict[str, Any]) -> dict[str, Any]:
    qcount = await db.questions.count_documents({"event_id": event["_id"]})
    name = await _org_name(db, event["org_id"])
    return serialize_event(event, qcount, org_name=name)


@router.post("/orgs/{org_id}/events", response_model=EventOut, status_code=status.HTTP_201_CREATED)
async def create_event(
    org_id: str,
    body: EventCreate,
    user: Annotated[dict[str, Any], Depends(get_current_user)],
) -> dict[str, Any]:
    await _require_org_member(user, org_id)
    db = get_db()
    org = await db.organizations.find_one({"_id": oid(org_id)})
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    deadline = ensure_aware(body.registration_deadline)
    start_at = ensure_aware(body.start_at)
    if deadline >= start_at:
        raise HTTPException(status_code=400, detail="Registration deadline must be before event start")

    code = _join_code()
    # ensure uniqueness
    while await db.events.find_one({"join_code": code}):
        code = _join_code()

    doc = {
        "org_id": oid(org_id),
        "title": body.title.strip(),
        "theme": body.theme.strip(),
        "description": body.description.strip(),
        "type": body.type.value,
        "capacity": body.capacity,
        "registration_count": 0,
        "registration_deadline": deadline,
        "start_at": start_at,
        "end_at": ensure_aware(body.end_at) if body.end_at else None,
        "per_question_seconds": body.per_question_seconds,
        "status": EventStatus.draft.value,
        "join_code": code,
        "live_phase": "waiting",
        "live_question_index": 0,
        "question_opened_at": None,
        "created_by": user["_id"],
        "created_at": utcnow(),
        "updated_at": utcnow(),
    }
    result = await db.events.insert_one(doc)
    doc["_id"] = result.inserted_id
    return serialize_event(doc, 0, org_name=org["name"])


@router.get("/events", response_model=list[EventOut])
async def list_public_events() -> list[dict[str, Any]]:
    db = get_db()
    cursor = db.events.find(
        {"status": {"$in": [EventStatus.open.value, EventStatus.registration_closed.value, EventStatus.live.value, EventStatus.ended.value]}}
    ).sort("start_at", 1)
    events = [event async for event in cursor]
    org_ids = list({event["org_id"] for event in events})
    org_names: dict[Any, str] = {}
    if org_ids:
        async for org in db.organizations.find({"_id": {"$in": org_ids}}):
            org_names[org["_id"]] = org["name"]
    out = []
    for event in events:
        qcount = await db.questions.count_documents({"event_id": event["_id"]})
        out.append(
            serialize_event(
                event,
                qcount,
                org_name=org_names.get(event["org_id"], "Organizer"),
            )
        )
    return out


@router.get("/events/{event_id}", response_model=EventOut)
async def get_event(event_id: str) -> dict[str, Any]:
    db = get_db()
    event = await db.events.find_one({"_id": oid(event_id)})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event["status"] == EventStatus.draft.value:
        raise HTTPException(status_code=404, detail="Event not found")
    return await _event_out(db, event)


@router.get("/orgs/{org_id}/events", response_model=list[EventOut])
async def list_org_events(
    org_id: str,
    user: Annotated[dict[str, Any], Depends(get_current_user)],
) -> list[dict[str, Any]]:
    await _require_org_member(user, org_id)
    db = get_db()
    org = await db.organizations.find_one({"_id": oid(org_id)})
    org_name = org["name"] if org else "Organizer"
    cursor = db.events.find({"org_id": oid(org_id)}).sort("created_at", -1)
    out = []
    async for event in cursor:
        qcount = await db.questions.count_documents({"event_id": event["_id"]})
        out.append(serialize_event(event, qcount, org_name=org_name))
    return out


@router.get("/org/events/{event_id}", response_model=EventOut)
async def get_org_event(
    event_id: str,
    user: Annotated[dict[str, Any], Depends(get_current_user)],
) -> dict[str, Any]:
    db = get_db()
    event = await db.events.find_one({"_id": oid(event_id)})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    await _require_org_member(user, str(event["org_id"]))
    return await _event_out(db, event)


@router.patch("/events/{event_id}", response_model=EventOut)
async def update_event(
    event_id: str,
    body: EventUpdate,
    user: Annotated[dict[str, Any], Depends(get_current_user)],
) -> dict[str, Any]:
    db = get_db()
    event = await db.events.find_one({"_id": oid(event_id)})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    await _require_org_member(user, str(event["org_id"]))

    updates = body.model_dump(exclude_unset=True)
    if "status" in updates and updates["status"] is not None:
        updates["status"] = updates["status"].value if hasattr(updates["status"], "value") else updates["status"]
    for key in ("registration_deadline", "start_at", "end_at"):
        if key in updates and updates[key] is not None:
            updates[key] = ensure_aware(updates[key])
    updates["updated_at"] = utcnow()
    await db.events.update_one({"_id": event["_id"]}, {"$set": updates})
    event = await db.events.find_one({"_id": event["_id"]})
    return await _event_out(db, event)


@router.post("/events/{event_id}/publish", response_model=EventOut)
async def publish_event(
    event_id: str,
    user: Annotated[dict[str, Any], Depends(get_current_user)],
) -> dict[str, Any]:
    db = get_db()
    event = await db.events.find_one({"_id": oid(event_id)})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    await _require_org_member(user, str(event["org_id"]))

    qcount = await db.questions.count_documents({"event_id": event["_id"]})
    if qcount < 1:
        raise HTTPException(status_code=400, detail="Add at least one question before publishing")

    updates: dict[str, Any] = {"status": EventStatus.open.value, "updated_at": utcnow()}
    if not event.get("join_code"):
        code = _join_code()
        while await db.events.find_one({"join_code": code}):
            code = _join_code()
        updates["join_code"] = code
        updates["live_phase"] = "waiting"

    await db.events.update_one(
        {"_id": event["_id"]},
        {"$set": updates},
    )
    event = await db.events.find_one({"_id": event["_id"]})
    return await _event_out(db, event)


@router.post("/events/{event_id}/go-live", response_model=EventOut)
async def go_live(
    event_id: str,
    user: Annotated[dict[str, Any], Depends(get_current_user)],
) -> dict[str, Any]:
    db = get_db()
    event = await db.events.find_one({"_id": oid(event_id)})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    await _require_org_member(user, str(event["org_id"]))
    await db.events.update_one(
        {"_id": event["_id"]},
        {"$set": {"status": EventStatus.live.value, "updated_at": utcnow()}},
    )
    event = await db.events.find_one({"_id": event["_id"]})
    return await _event_out(db, event)


@router.post("/events/{event_id}/end", response_model=MessageOut)
async def end_event(
    event_id: str,
    user: Annotated[dict[str, Any], Depends(get_current_user)],
) -> dict[str, str]:
    db = get_db()
    event = await db.events.find_one({"_id": oid(event_id)})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    await _require_org_member(user, str(event["org_id"]))
    await db.events.update_one(
        {"_id": event["_id"]},
        {"$set": {"status": EventStatus.ended.value, "updated_at": utcnow()}},
    )
    return {"message": "Event ended"}