# EventHive

Subscription-based quiz/survey events — FastAPI + Next.js + MongoDB.

See [PROJECT.md](./PROJECT.md) for the full specification.

## Prerequisites

- Python 3.11+
- Node.js 20+
- MongoDB running locally (default `mongodb://localhost:27017`)

## Backend

```bash
cd backend
python -m venv .venv
# Windows
.\.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API docs: http://127.0.0.1:8000/docs

## Frontend

```bash
cd frontend
npm install
# Set NEXT_PUBLIC_APP_URL in .env.local to your PC LAN IP (see Mobile below)
npm run dev
```

- PC: http://localhost:3000  
- Phone (same Wi‑Fi): http://YOUR_LAN_IP:3000  

Next.js listens on `0.0.0.0:3000` and proxies `/api/*` to the backend.

## Phone / same Wi‑Fi

1. On the PC run `ipconfig` and note the Wi‑Fi **IPv4** (e.g. `192.168.1.15`).
2. In `frontend/.env.local` set:
   ```env
   NEXT_PUBLIC_APP_URL=http://192.168.1.15:3000
   ```
3. In `backend/.env` add that origin to `CORS_ORIGINS`.
4. Restart `npm run dev` (needed after changing `NEXT_PUBLIC_*`).
5. On the phone open `http://192.168.1.15:3000`.
6. QR codes use `NEXT_PUBLIC_APP_URL`, so they work even if you opened the host UI via localhost.
7. Allow Windows Firewall for Node on **Private** networks if the phone can’t connect.

## Quick demo flow

1. Open `/subscribe`, pick a plan, complete the (mock) payment.
2. Create an event, add questions (manual or AI), **Publish**.
3. Open **Conduct live** — show QR to participants.
4. Participants scan → register → waiting room → live synced quiz.

## Optional AI

Set `LLM_API_KEY` in `backend/.env` for real question generation.
