from datetime import datetime, timedelta, timezone
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.core.config import get_settings
from app.core.deps import get_current_user, user_out
from app.core.security import create_access_token, hash_password
from app.db.mongo import get_db
from app.models.schemas import (
    MessageOut,
    SubscribeRequest,
    SubscriptionPlanOut,
    UserOut,
)

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])

PLANS = [
    {
        "id": "once",
        "name": "Once",
        "price_inr": 999,
        "interval": "one_time",
        "description": "One-time access to create and run events.",
    },
    {
        "id": "monthly",
        "name": "Monthly",
        "price_inr": 2499,
        "interval": "month",
        "description": "Unlimited events for one month. Cancel anytime.",
    },
    {
        "id": "yearly",
        "name": "Yearly",
        "price_inr": 24999,
        "interval": "year",
        "description": "Best value — full year of EventHive for your company.",
    },
]


def _plan(plan_id: str) -> dict[str, Any]:
    for p in PLANS:
        if p["id"] == plan_id:
            return p
    raise HTTPException(status_code=400, detail="Invalid plan")


@router.get("/plans", response_model=list[SubscriptionPlanOut])
async def list_plans() -> list[dict[str, Any]]:
    return PLANS


@router.post("/subscribe", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def subscribe(body: SubscribeRequest, response: Response) -> dict[str, Any]:
    """Create subscriber account after mock payment confirmation."""
    plan = _plan(body.plan_id)
    db = get_db()
    email = body.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered — please log in")

    now = datetime.now(timezone.utc)
    if plan["interval"] == "month":
        expires = now + timedelta(days=30)
    elif plan["interval"] == "year":
        expires = now + timedelta(days=365)
    else:
        expires = None  # one-time / lifetime credit

    user_doc = {
        "name": body.name.strip(),
        "email": email,
        "phone": body.phone.strip(),
        "password_hash": hash_password(body.password),
        "role": "subscriber",
        "company_name": body.company_name.strip(),
        "gst": (body.gst or "").strip() or None,
        "org_ids": [],
        "subscription": {
            "plan_id": plan["id"],
            "status": "active",
            "payment_method": body.payment_method,
            "amount_inr": plan["price_inr"],
            "started_at": now,
            "expires_at": expires,
        },
        "created_at": now,
    }
    user_result = await db.users.insert_one(user_doc)
    user_doc["_id"] = user_result.inserted_id

    org_doc = {
        "name": body.company_name.strip(),
        "owner_user_id": user_result.inserted_id,
        "member_user_ids": [user_result.inserted_id],
        "created_at": now,
    }
    org_result = await db.organizations.insert_one(org_doc)
    await db.users.update_one(
        {"_id": user_result.inserted_id},
        {"$addToSet": {"org_ids": org_result.inserted_id}},
    )
    user_doc["org_ids"] = [org_result.inserted_id]

    await db.subscriptions.insert_one(
        {
            "user_id": user_result.inserted_id,
            "plan_id": plan["id"],
            "status": "active",
            "payment_method": body.payment_method,
            "amount_inr": plan["price_inr"],
            "gst": user_doc["gst"],
            "created_at": now,
            "expires_at": expires,
            "mock": True,
        }
    )

    token = create_access_token(str(user_result.inserted_id), {"role": "subscriber"})
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
    return user_out(user_doc)


@router.get("/me", response_model=dict[str, Any])
async def my_subscription(user: Annotated[dict[str, Any], Depends(get_current_user)]) -> dict[str, Any]:
    sub = user.get("subscription") or {}
    return {
        "role": user.get("role"),
        "active": sub.get("status") == "active" or user.get("role") == "admin",
        "subscription": sub,
    }


@router.post("/admin/bootstrap", response_model=MessageOut)
async def bootstrap_admin() -> dict[str, str]:
    """Dev helper: ensure a default admin exists (email admin@eventhive.local / Admin@12345)."""
    db = get_db()
    email = "admin@eventhive.local"
    existing = await db.users.find_one({"email": email})
    if existing:
        return {"message": "Admin already exists"}
    await db.users.insert_one(
        {
            "name": "Platform Admin",
            "email": email,
            "password_hash": hash_password("Admin@12345"),
            "role": "admin",
            "org_ids": [],
            "created_at": datetime.now(timezone.utc),
        }
    )
    return {"message": "Admin created"}
