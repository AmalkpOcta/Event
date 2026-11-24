from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, EmailStr, Field, field_validator


class EventType(str, Enum):
    quiz = "quiz"
    survey = "survey"


class EventStatus(str, Enum):
    draft = "draft"
    open = "open"
    registration_closed = "registration_closed"
    live = "live"
    ended = "ended"
    cancelled = "cancelled"


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    name: str
    email: EmailStr
    role: str
    org_ids: list[str] = []
    company_name: str | None = None
    subscription_active: bool = False
    subscription_plan: str | None = None


class OrgCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)


class OrgOut(BaseModel):
    id: str
    name: str
    owner_user_id: str
    member_user_ids: list[str] = []


class EventCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    theme: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=5000)
    type: EventType = EventType.quiz
    capacity: int = Field(default=50, ge=1, le=10000)
    registration_deadline: datetime
    start_at: datetime
    end_at: datetime | None = None
    per_question_seconds: int = Field(default=30, ge=5, le=600)


class EventUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    theme: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    capacity: int | None = Field(default=None, ge=1, le=10000)
    registration_deadline: datetime | None = None
    start_at: datetime | None = None
    end_at: datetime | None = None
    per_question_seconds: int | None = Field(default=None, ge=5, le=600)
    status: EventStatus | None = None


class EventOut(BaseModel):
    id: str
    org_id: str
    org_name: str = "Organizer"
    title: str
    theme: str
    description: str
    type: EventType
    capacity: int
    registration_count: int
    registration_deadline: datetime
    start_at: datetime
    end_at: datetime | None
    per_question_seconds: int
    status: EventStatus
    registration_open: bool
    question_count: int = 0
    cover_image: str | None = None
    join_code: str | None = None
    live_phase: str = "waiting"
    live_question_index: int = 0


class OptionIn(BaseModel):
    text: str = Field(min_length=1, max_length=500)


class QuestionCreate(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    options: list[OptionIn] = Field(min_length=2, max_length=8)
    correct_option_index: int | None = Field(default=None, ge=0)
    order: int | None = None

    @field_validator("options")
    @classmethod
    def options_unique(cls, v: list[OptionIn]) -> list[OptionIn]:
        texts = [o.text.strip().lower() for o in v]
        if len(texts) != len(set(texts)):
            raise ValueError("Option texts must be unique")
        return v


class QuestionUpdate(BaseModel):
    text: str | None = Field(default=None, min_length=1, max_length=2000)
    options: list[OptionIn] | None = Field(default=None, min_length=2, max_length=8)
    correct_option_index: int | None = Field(default=None, ge=0)
    order: int | None = None


class OptionOut(BaseModel):
    id: str
    text: str


class QuestionOut(BaseModel):
    id: str
    event_id: str
    order: int
    text: str
    options: list[OptionOut]
    correct_option_id: str | None = None
    source: str = "manual"


class GenerateQuestionsRequest(BaseModel):
    subject: str = Field(min_length=1, max_length=200)
    count: int = Field(default=5, ge=1, le=20)
    difficulty: str = Field(default="medium", max_length=40)


class RegistrationCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    phone: str = Field(min_length=7, max_length=20)

    @field_validator("phone")
    @classmethod
    def phone_digits(cls, v: str) -> str:
        cleaned = "".join(ch for ch in v if ch.isdigit() or ch in "+- ")
        digits = sum(ch.isdigit() for ch in cleaned)
        if digits < 7:
            raise ValueError("Phone must include at least 7 digits")
        return cleaned.strip()


class RegistrationOut(BaseModel):
    id: str
    event_id: str
    name: str
    email: EmailStr
    phone: str
    registered_at: datetime
    access_token: str | None = None


class AnswerSubmit(BaseModel):
    question_id: str
    option_id: str | None = None


class AttemptQuestionOut(BaseModel):
    attempt_id: str
    question_index: int
    total_questions: int
    per_question_seconds: int
    question_started_at: datetime
    question: QuestionOut | None
    completed: bool = False
    score: int | None = None
    max_score: int | None = None


class AttemptResultOut(BaseModel):
    attempt_id: str
    event_id: str
    status: str
    score: int
    max_score: int
    answers: list[dict[str, Any]] = []


class MessageOut(BaseModel):
    message: str


class SubscriptionPlanOut(BaseModel):
    id: str
    name: str
    price_inr: int
    interval: str
    description: str


class SubscribeRequest(BaseModel):
    plan_id: str
    name: str = Field(min_length=1, max_length=120)
    phone: str = Field(min_length=7, max_length=20)
    email: EmailStr
    company_name: str = Field(min_length=1, max_length=200)
    gst: str | None = Field(default=None, max_length=30)
    password: str = Field(min_length=8, max_length=128)
    payment_method: str = Field(min_length=1, max_length=40)

    @field_validator("phone")
    @classmethod
    def phone_ok(cls, v: str) -> str:
        digits = sum(ch.isdigit() for ch in v)
        if digits < 7:
            raise ValueError("Phone must include at least 7 digits")
        return v.strip()
