# EventHive — Project Specification (v2)

> Subscription-based event platform: public marketing site, paid organizers (subscribers), QR join for participants, and **conductor-driven live quizzes** with synced screens and speed-based scoring.

---

## Recommendations (adopted)

1. **Conductor-driven sync** — The organizer advances questions; participants mirror server state (WebSocket + short polling). Do not let each phone run its own independent quiz timer.
2. **QR = join URL** — Encode `/join/{code}` so any phone camera opens registration without an app store install.
3. **Mock payments first** — UI for cards / UPI / netbanking; confirm locally. Wire **Razorpay** (India-friendly UPI) later.
4. **Roles** — `admin` (platform), `subscriber` (paid organizer), participants are registration tokens (not full accounts).
5. **Scoring** — Correct answer + time bonus: `points = base + max(0, remaining_ms / scale)`. Leaderboard = higher points first (ties → faster answer).
6. **Home stays public** — Marketing + browse; **Subscribe** replaces Sign up for organizers. **Log in** for existing subscribers.

---

## Roles

| Role | Access |
|------|--------|
| Public | Home, about, contact, browse published events |
| Subscriber | After paid plan: create/conduct events, QR, live control |
| Admin | Platform oversight (later) |
| Participant | Scan QR → register → countdown → live quiz |

---

## Flows

### Subscribe
1. Click **Subscribe** → plans (Once / Monthly / Yearly)
2. Form: name, phone, email, company, GST (optional), password
3. Payment method → mock pay
4. Account + org created → dashboard

### Create & run event
1. Subscriber creates event (name, images, description, capacity, subject, questions, per-question time)
2. Manual Q&A or **Generate with AI**
3. Publish → **QR code** for `/join/{code}`
4. Conductor screen: QR + countdown; **Start** when ready
5. Live: same question/timer for conductor + all participants
6. After timer: reveal correct answer; conductor sees who got it right + times; participants see Q status strip (green/red)
7. Next question (synced). Final leaderboard.

---

## Tech stack

- Next.js + Tailwind · FastAPI · MongoDB · JWT cookies · LLM for AI questions · WebSocket live channel

## Monorepo

`backend/` · `frontend/` · `.cursor/rules/` · this file

---

## Live state (server)

```text
live_phase: waiting | question | reveal | finished
live_question_index: number
question_opened_at: datetime (UTC)
per_question_seconds: number
```

Participants poll/WS `GET /api/events/{id}/live/state`.  
Conductor: `POST .../live/start`, `.../reveal`, `.../next`, `.../finish`.

---

## Subscription plans (defaults)

| Plan | Price (INR demo) | Notes |
|------|------------------|--------|
| Once | ₹999 | One-time access credit |
| Monthly | ₹2,499 / mo | Recurring |
| Yearly | ₹24,999 / yr | Recurring |

Payment gateway: mock until Razorpay keys are configured.

---

## Document control

| Field | Value |
|-------|--------|
| Version | 2.0 |
| Updated | 2026-11-24 |
