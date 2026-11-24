from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.db.mongo import close_client, ensure_indexes
from app.routers import auth, events, live, orgs, questions, quiz, registrations, subscriptions


@asynccontextmanager
async def lifespan(_: FastAPI):
    await ensure_indexes()
    yield
    await close_client()


settings = get_settings()
app = FastAPI(title="Event Platform API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(orgs.router, prefix="/api")
app.include_router(events.router, prefix="/api")
app.include_router(questions.router, prefix="/api")
app.include_router(registrations.router, prefix="/api")
app.include_router(quiz.router, prefix="/api")
app.include_router(subscriptions.router, prefix="/api")
app.include_router(live.router, prefix="/api")


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
