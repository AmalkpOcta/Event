from datetime import datetime, timezone
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.core.config import get_settings
from app.core.deps import get_current_user, oid, user_out
from app.core.security import create_access_token, hash_password, verify_password
from app.db.mongo import get_db
from app.models.schemas import MessageOut, TokenResponse, UserCreate, UserLogin, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(body: UserCreate, response: Response) -> dict[str, Any]:
    db = get_db()
    existing = await db.users.find_one({"email": body.email.lower()})
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    doc = {
        "name": body.name.strip(),
        "email": body.email.lower(),
        "password_hash": hash_password(body.password),
        # Public self-register disabled for organizers — use /subscriptions/subscribe.
        # Kept for admin tooling / tests as subscriber without payment.
        "role": "subscriber",
        "org_ids": [],
        "subscription": {"plan_id": "once", "status": "active", "started_at": datetime.now(timezone.utc)},
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.users.insert_one(doc)
    doc["_id"] = result.inserted_id

    token = create_access_token(str(result.inserted_id), {"role": "subscriber"})
    settings = get_settings()
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        max_age=settings.access_token_expire_minutes * 60,
        path="/",
    )
    return user_out(doc)


@router.post("/login", response_model=TokenResponse)
async def login(body: UserLogin, response: Response) -> dict[str, str]:
    db = get_db()
    user = await db.users.find_one({"email": body.email.lower()})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    token = create_access_token(str(user["_id"]), {"role": user.get("role", "organizer")})
    settings = get_settings()
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        max_age=settings.access_token_expire_minutes * 60,
        path="/",
    )
    return {"access_token": token, "token_type": "bearer"}


@router.post("/logout", response_model=MessageOut)
async def logout(response: Response) -> dict[str, str]:
    response.delete_cookie("access_token", path="/")
    return {"message": "Logged out"}


@router.get("/me", response_model=UserOut)
async def me(user: Annotated[dict[str, Any], Depends(get_current_user)]) -> dict[str, Any]:
    return user_out(user)
