from typing import Annotated, Any

from bson import ObjectId
from fastapi import Cookie, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.security import decode_access_token
from app.db.mongo import get_db

bearer_scheme = HTTPBearer(auto_error=False)


def oid(value: str) -> ObjectId:
    if not ObjectId.is_valid(value):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid id")
    return ObjectId(value)


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)] = None,
    access_token: Annotated[str | None, Cookie(alias="access_token")] = None,
) -> dict[str, Any]:
    token = None
    if credentials and credentials.credentials:
        token = credentials.credentials
    elif access_token:
        token = access_token
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    # Participant registration tokens are handled separately
    if payload.get("typ") == "participant":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Organizer account required")

    db = get_db()
    user = await db.users.find_one({"_id": oid(payload["sub"])})
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


async def get_optional_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)] = None,
    access_token: Annotated[str | None, Cookie(alias="access_token")] = None,
) -> dict[str, Any] | None:
    try:
        return await get_current_user(credentials=credentials, access_token=access_token)
    except HTTPException:
        return None


async def get_participant(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)] = None,
    participant_token: Annotated[str | None, Cookie(alias="participant_token")] = None,
) -> dict[str, Any]:
    token = None
    if credentials and credentials.credentials:
        token = credentials.credentials
    elif participant_token:
        token = participant_token
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not registered for this event")

    payload = decode_access_token(token)
    if not payload or payload.get("typ") != "participant":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid participant session")

    db = get_db()
    registration = await db.registrations.find_one({"_id": oid(payload["sub"])})
    if not registration:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Registration not found")
    if str(registration["event_id"]) != payload.get("event_id"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid participant session")
    return registration


async def get_optional_participant(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)] = None,
    participant_token: Annotated[str | None, Cookie(alias="participant_token")] = None,
) -> dict[str, Any] | None:
    try:
        return await get_participant(credentials=credentials, participant_token=participant_token)
    except HTTPException:
        return None


def user_out(user: dict[str, Any]) -> dict[str, Any]:
    sub = user.get("subscription") or {}
    return {
        "id": str(user["_id"]),
        "name": user["name"],
        "email": user["email"],
        "role": user.get("role", "organizer"),
        "org_ids": [str(i) for i in user.get("org_ids", [])],
        "company_name": user.get("company_name"),
        "subscription_active": user.get("role") == "admin" or sub.get("status") == "active",
        "subscription_plan": sub.get("plan_id"),
    }
