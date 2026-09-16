# NEXUS — Ambulance Dispatch Prototype

Built exactly per BUILD_SPEC.md. No Docker needed — SQLite is the default
database (one file, `nexus.db`, created automatically on first run).

## Run it (two terminals)

**Terminal 1 — backend:**
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```
Backend runs at http://localhost:8000 (interactive docs at /docs)

**Terminal 2 — frontend:**
```bash
cd frontend
npm install
npm run dev
```
Frontend runs at http://localhost:3000

That's it. No database install, no Docker, no other services.

## Switching to Postgres later (not needed today)

Set one env var before starting the backend, nothing else changes:
```bash
export DATABASE_URL="postgresql://user:pass@localhost:5432/nexus"
```

## Status: tested end-to-end, working

Verified with real HTTP calls against a running instance:
- ✅ `POST /ambulances` — creates ambulance
- ✅ `POST /incidents` — creates incident
- ✅ `GET /recommendation/{incident_id}` — returns best ambulance pick
- ✅ Fallback path (OSRM unreachable) — returns straight-line distance + rough ETA instead of crashing
- ✅ `POST /recommendation/{id}/accept` — ambulance status flips to `busy`
- ✅ No-ambulance-available case — returns clean 404, not a crash

**Not yet tested:** real OSRM road-routing response (network in the build
environment couldn't reach the public OSRM server, so only the fallback path
was exercised). On a normal internet connection this should just work — if
OSRM is slow/rate-limited, the fallback kicks in automatically, which is by
design.

**Not yet tested:** the frontend against a live backend (npm run dev). The
frontend code is written and matches the API exactly, but wasn't click-tested
in this environment. Run it and see what breaks — that's the next step.
