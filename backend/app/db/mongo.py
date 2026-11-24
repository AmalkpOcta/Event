from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.core.config import get_settings

_client: AsyncIOMotorClient | None = None


def get_client() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        settings = get_settings()
        _client = AsyncIOMotorClient(settings.mongodb_uri)
    return _client


def get_db() -> AsyncIOMotorDatabase:
    settings = get_settings()
    return get_client()[settings.mongodb_db]


async def close_client() -> None:
    global _client
    if _client is not None:
        _client.close()
        _client = None


async def ensure_indexes() -> None:
    db = get_db()
    await db.users.create_index("email", unique=True)
    await db.organizations.create_index("owner_user_id")
    await db.events.create_index([("status", 1), ("start_at", 1)])
    await db.events.create_index("org_id")
    await db.questions.create_index([("event_id", 1), ("order", 1)])
    await db.registrations.create_index([("event_id", 1), ("email", 1)], unique=True)
    await db.attempts.create_index([("event_id", 1), ("registration_id", 1)], unique=True)
    await db.events.create_index("join_code", unique=True, sparse=True)
    await db.subscriptions.create_index("user_id")
