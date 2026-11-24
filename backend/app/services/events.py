from datetime import datetime, timezone
from typing import Any

from app.models.schemas import EventStatus


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def ensure_aware(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def is_registration_open(event: dict[str, Any], now: datetime | None = None) -> bool:
    now = now or utcnow()
    status = event.get("status")
    if status in (EventStatus.cancelled.value, EventStatus.ended.value, EventStatus.draft.value):
        return False
    deadline = ensure_aware(event["registration_deadline"])
    if now > deadline:
        return False
    if event.get("registration_count", 0) >= event.get("capacity", 0):
        return False
    return True


def can_start_attempt(event: dict[str, Any], now: datetime | None = None) -> bool:
    now = now or utcnow()
    status = event.get("status")
    if status in (EventStatus.cancelled.value, EventStatus.draft.value, EventStatus.ended.value):
        return False
    # Organizer "Go live" unlocks attempts immediately.
    if status == EventStatus.live.value:
        end_at = event.get("end_at")
        if end_at and now > ensure_aware(end_at):
            return False
        return True
    start_at = ensure_aware(event["start_at"])
    if now < start_at:
        return False
    end_at = event.get("end_at")
    if end_at and now > ensure_aware(end_at):
        return False
    return True


def serialize_event(
    event: dict[str, Any],
    question_count: int = 0,
    org_name: str | None = None,
) -> dict[str, Any]:
    return {
        "id": str(event["_id"]),
        "org_id": str(event["org_id"]),
        "org_name": org_name or event.get("org_name") or "Organizer",
        "title": event["title"],
        "theme": event["theme"],
        "description": event.get("description", ""),
        "type": event["type"],
        "capacity": event["capacity"],
        "registration_count": event.get("registration_count", 0),
        "registration_deadline": event["registration_deadline"],
        "start_at": event["start_at"],
        "end_at": event.get("end_at"),
        "per_question_seconds": event["per_question_seconds"],
        "status": event["status"],
        "registration_open": is_registration_open(event),
        "question_count": question_count,
        "cover_image": event.get("cover_image"),
        "join_code": event.get("join_code"),
        "live_phase": event.get("live_phase") or "waiting",
        "live_question_index": int(event.get("live_question_index") or 0),
    }


def user_in_org(user: dict[str, Any], org_id: str) -> bool:
    return any(str(i) == org_id for i in user.get("org_ids", []))


def is_event_expired(event: dict[str, Any], now: datetime | None = None) -> bool:
    """Past / closed events sort after upcoming ones on home and org lists."""
    now = now or utcnow()
    status = event.get("status")
    if status in (EventStatus.ended.value, EventStatus.cancelled.value):
        return True
    if status == EventStatus.draft.value:
        return False
    end_at = event.get("end_at")
    if end_at and ensure_aware(end_at) < now:
        return True
    if ensure_aware(event["start_at"]) < now and status not in (
        EventStatus.open.value,
        EventStatus.registration_closed.value,
        EventStatus.live.value,
    ):
        return True
    return False


def sort_events_upcoming_first(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    now = utcnow()

    def sort_key(event: dict[str, Any]) -> tuple[int, float]:
        expired = is_event_expired(event, now)
        start_ts = ensure_aware(event["start_at"]).timestamp()
        # Upcoming: soonest first. Expired: newest expired first, older last.
        return (1 if expired else 0, start_ts if not expired else -start_ts)

    return sorted(events, key=sort_key)
