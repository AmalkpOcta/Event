from datetime import datetime, timezone
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.deps import get_current_user, oid
from app.db.mongo import get_db
from app.models.schemas import OrgCreate, OrgOut

router = APIRouter(prefix="/orgs", tags=["orgs"])


@router.post("", response_model=OrgOut, status_code=status.HTTP_201_CREATED)
async def create_org(
    body: OrgCreate,
    user: Annotated[dict[str, Any], Depends(get_current_user)],
) -> dict[str, Any]:
    db = get_db()
    doc = {
        "name": body.name.strip(),
        "owner_user_id": user["_id"],
        "member_user_ids": [user["_id"]],
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.organizations.insert_one(doc)
    await db.users.update_one({"_id": user["_id"]}, {"$addToSet": {"org_ids": result.inserted_id}})
    return {
        "id": str(result.inserted_id),
        "name": doc["name"],
        "owner_user_id": str(user["_id"]),
        "member_user_ids": [str(user["_id"])],
    }


@router.get("/me", response_model=list[OrgOut])
async def my_orgs(user: Annotated[dict[str, Any], Depends(get_current_user)]) -> list[dict[str, Any]]:
    db = get_db()
    org_ids = user.get("org_ids", [])
    if not org_ids:
        return []
    cursor = db.organizations.find({"_id": {"$in": org_ids}})
    out = []
    async for org in cursor:
        out.append(
            {
                "id": str(org["_id"]),
                "name": org["name"],
                "owner_user_id": str(org["owner_user_id"]),
                "member_user_ids": [str(i) for i in org.get("member_user_ids", [])],
            }
        )
    return out


@router.get("/{org_id}", response_model=OrgOut)
async def get_org(
    org_id: str,
    user: Annotated[dict[str, Any], Depends(get_current_user)],
) -> dict[str, Any]:
    db = get_db()
    org = await db.organizations.find_one({"_id": oid(org_id)})
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    if user["_id"] not in org.get("member_user_ids", []) and str(org["owner_user_id"]) != str(user["_id"]):
        raise HTTPException(status_code=403, detail="Forbidden")
    return {
        "id": str(org["_id"]),
        "name": org["name"],
        "owner_user_id": str(org["owner_user_id"]),
        "member_user_ids": [str(i) for i in org.get("member_user_ids", [])],
    }
