from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pymongo.errors import DuplicateKeyError

from app.core.config import get_settings
from app.core.deps import get_current_user, oid
from app.core.security import create_access_token
from app.db.mongo import get_db
from app.models.schemas import RegistrationCreate, RegistrationOut
from app.services.events import is_registration_open, user_in_org, utcnow

router = APIRouter(tags=["registrations"])


@router.post("/events/{event_id}/register", response_model=RegistrationOut, status_code=status.HTTP_201_CREATED)
async def register_for_event(
    event_id: str,
    body: RegistrationCreate,
    response: Response,
) -> dict[str, Any]:
    db = get_db()
    event = await db.events.find_one({"_id": oid(event_id)})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if not is_registration_open(event):
        raise HTTPException(status_code=409, detail="Registration closed")

    claim = await db.events.update_one(
        {
            "_id": event["_id"],
            "registration_count": {"$lt": event["capacity"]},
            "status": {"$nin": ["draft", "cancelled", "ended"]},
        },
        {"$inc": {"registration_count": 1}},
    )
    if claim.modified_count == 0:
        raise HTTPException(status_code=409, detail="Registration closed or full")

    doc = {
        "event_id": event["_id"],
        "name": body.name.strip(),
        "email": body.email.lower(),
        "phone": body.phone,
        "registered_at": utcnow(),
    }
    try:
        result = await db.registrations.insert_one(doc)
    except DuplicateKeyError:
        await db.events.update_one({"_id": event["_id"]}, {"$inc": {"registration_count": -1}})
        raise HTTPException(status_code=409, detail="Already registered for this event")

    token = create_access_token(
        str(result.inserted_id),
        {"typ": "participant", "event_id": str(event["_id"])},
    )
    settings = get_settings()
    response.set_cookie(
        key="participant_token",
        value=token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        max_age=60 * 60 * 24 * 7,
        path="/",
    )
    return {
        "id": str(result.inserted_id),
        "event_id": str(event["_id"]),
        "name": doc["name"],
        "email": doc["email"],
        "phone": doc["phone"],
        "registered_at": doc["registered_at"],
        "access_token": token,
    }


@router.get("/events/{event_id}/registrations", response_model=list[RegistrationOut])
async def list_registrations(
    event_id: str,
    user: Annotated[dict[str, Any], Depends(get_current_user)],
) -> list[dict[str, Any]]:
    db = get_db()
    event = await db.events.find_one({"_id": oid(event_id)})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if not user_in_org(user, str(event["org_id"])):
        raise HTTPException(status_code=403, detail="Forbidden")

    cursor = db.registrations.find({"event_id": event["_id"]}).sort("registered_at", -1)
    out = []
    async for reg in cursor:
        out.append(
            {
                "id": str(reg["_id"]),
                "event_id": str(reg["event_id"]),
                "name": reg["name"],
                "email": reg["email"],
                "phone": reg["phone"],
                "registered_at": reg["registered_at"],
                "access_token": None,
            }
        )
    return out
