# AGENT.md — NEXUS Build Instructions
> Read this file FIRST, every session, before writing any code.
> This is the permanent source of truth. If anything in chat contradicts this file, THIS FILE WINS unless the user explicitly says "update AGENT.md."

---

## 0. What This Project Is (one paragraph)

NEXUS is a decision-support platform for **Emergency Transport & Resource Allocation** (one hero use case — not general logistics, not general transport). It predicts ETA/severity, optimizes vehicle-to-incident assignment and routing, and recommends an action to a human dispatcher who must approve/modify/reject it. Built for Smart India Hackathon 2026, Team CapsLock. Designed to be demo-able now and honestly extensible to production later — no overclaiming.

---

## 1. Non-Negotiable Rules (do not violate, do not "helpfully" change)

0. **Always start the conversation with the user name**never start a response without the user name and "if you dont know ask the user for his name "
1. **Human-in-the-loop is mandatory.** No feature may auto-execute a dispatch without a human approval step. Never build "auto-accept" as a default.
2. **Graceful degradation is mandatory.** Every AI/optimization call must have a rule-based fallback path (nearest-available-unit) if the service fails or times out. Do not remove fallback code "to simplify."
3. **No overclaiming in code comments, docs, or UI text.** Never write "guarantees," "eliminates," "production-ready" unless it's literally true and tested. Use "reduces," "production-oriented," "designed for."
4. **Data is synthetic/open-source only, and must be labeled as such** anywhere it appears (comments, UI, docs). Never imply real government data is being used.
5. **Vehicle tracking in the MVP is simulated GPS** (a script moves vehicles along routes and pushes lat/lon periodically) — not real hardware. Label it clearly in code (`# SIMULATED GPS — see /scripts/vehicle_simulator.py`).
6. **Don't add scope.** If a task isn't in the MVP feature list (Section 5), do not build it "while I'm in there," even if it seems useful. Flag it instead and ask.
7. **Don't introduce new services/technologies not listed in Section 4 (Tech Stack)** without explicitly asking the user first.
8. **reuse the code in varius parts ,forms and varienats** check before writing any peice of code if there any code which is reusable in the code base so you do not create two or more same feature, funcation or method which works the same and it also save time and reduce token usage 

---

## 2. Architecture — Exact Model (do not reinterpret)

**Custom layered architecture: modular monolith + 2 justified extracted services.**

Not full microservices. Not a single monolith either.

```
React Dashboard
      ↓ HTTPS / WebSocket
API Gateway (Nginx)
      ↓
   ┌──────────────┬────────────────┬─────────────────────┐
Core API       Prediction Svc    Optimization Svc
(FastAPI)      (XGBoost)         (OR-Tools)
   │  I/O-bound     │  ML inference    │  CPU-heavy solve
   └──────────────┬────────────────┬─────────────────────┘
                  ↓
      Message Queue (Redis + Celery)
                  ↓
   PostgreSQL+PostGIS  ·  Redis (live state/cache)  ·  Object storage
```

**Why split Prediction & Optimization out, and nothing else:** they have genuinely different resource profiles (ML inference vs. CPU-heavy solving vs. I/O-bound CRUD) and need independent scaling. No other service gets split out unless a new, equally concrete resource-based reason emerges — reference this rule if asked to "microservice everything."

**Three logical layers inside the system (not literal folders, a design lens):**
- **Operational layer** — current state: incidents, vehicles, assignments (source of truth, must never be lost)
- **Intelligence layer** — predictions: ETA, severity (async, can fail → fallback)
- **Decision layer** — optimization: assignment, routing, recommendation (async, can fail → fallback)

---

## 3. Core Workflow (the one loop everything serves)

```
1. Incident reported → saved to Postgres immediately (source of truth first)
2. Job queued (predict + optimize) — async, doesn't block the API response
3. Prediction worker: XGBoost → ETA + severity
4. Optimization worker: OR-Tools → best vehicle + route
   → if either fails/times out: fallback to nearest-available-unit rule
5. Recommendation pushed to dashboard via WebSocket
6. Dispatcher: Accept / Modify / Reject (mandatory human step)
7. Outcome logged: actual time, actual route
8. Nightly batch job retrains XGBoost on fresh outcome data
```

---

## 4. Tech Stack — Locked (do not substitute without asking)

| Layer | Technology | Notes |
|---|---|---|
| Backend framework | FastAPI (Python) | Async |
| Database | PostgreSQL + PostGIS | Geo queries, source of truth |
| Cache/live state | Redis | Pub/sub for WebSocket, vehicle live positions |
| Async jobs | Celery + Redis broker | Prediction & optimization jobs |
| Prediction | XGBoost | ETA + severity — NOT deep learning |
| Optimization | Google OR-Tools | Assignment + routing — NOT ML |
| Road graph | NetworkX (prototype) | Note in code: production target is OSRM |
| Frontend | React + MapLibre | NOT Google Maps (cost/lock-in reasons) |
| API Gateway | Nginx | Prototype-optional but keep config ready |
| Containers | Docker + Docker Compose | NOT Kubernetes for MVP |
| CI/CD | GitHub Actions | Test → build → (deploy later) |
| Monitoring | Prometheus + Grafana | Add once core features work, not first |
| Auth | JWT | Roles: Admin, Transport Officer, Incident Operator, Analyst |

---

## 5. MVP Scope — Locked Cut-Line

### IN SCOPE for hackathon build:
- Vehicle CRUD + simulated GPS movement
- Incident CRUD
- Resource discovery (PostGIS nearest-unit query)
- ETA prediction (XGBoost, trained on synthetic data)
- Route optimization (OR-Tools)
- Recommendation generation + human approval workflow (accept/modify/reject)
- Basic analytics (response time, fleet utilization)
- Audit logging
- Docker Compose deployment
- Synthetic incident + vehicle simulator script

### OUT OF SCOPE — do not build unless user explicitly reopens scope:
- Demand prediction
- Congestion prediction (use a dummy time-of-day multiplier instead)
- Scenario simulation ("what if road X closes")
- Kubernetes / multi-region deployment
- Mobile app for drivers
- SMS/push notifications
- Multi-department federation

If asked to build something in the OUT OF SCOPE list, respond: *"This is marked out-of-MVP-scope in AGENT.md Section 5 — want me to build it anyway, or stay on the cut-line?"*

---

## 6. Data Model — Entity Reference (see CONTEXT.md for full field list)

Core entities: `User, Vehicle, VehicleType, Incident, Assignment, Route, Recommendation, Prediction, AuditLog`

Do not invent new top-level entities without checking CONTEXT.md first — extend existing ones if possible.

---

## 7. File/Repo Structure (target — build toward this)

```
nexus/
├── backend/app/{main.py, models/, schemas/, routes/, services/, ai/, workers/, db/, utils/}
├── backend/tests/
├── frontend/src/{components/, api/, App.jsx}
├── scripts/vehicle_simulator.py       ← build early, everything depends on it
├── scripts/incident_generator.py
├── deployment/{docker-compose.yml, nginx.conf}
└── monitoring/ (add later, not first)
```

---

## 8. How to Work With the User (Shashwat)

- Team name: **CapsLock**. Project name: **NEXUS**.
- User prefers direct, blunt technical honesty over encouragement — call out weak claims, don't soften bad ideas.
- User is building in **pieces** — expect to be handed one module/feature at a time, not the whole system at once.
- **Always end each piece of work with a HANDOFF block** (see PROGRESS_LOG.md) so work can be picked up by another AI or resumed later without context loss.
- Don't rebuild things already marked DONE in PROGRESS_LOG.md — check it first.
- If token/context limits are a concern, prioritize: (1) update PROGRESS_LOG.md, (2) give a clean handoff prompt, over finishing "one more thing."

---

## 9. Companion Files (read these too)

- **CONTEXT.md** — full data model, API contract, algorithm specs (the detailed reference)
- **PROGRESS_LOG.md** — what's built, what's next, current handoff prompt (UPDATE THIS EVERY SESSION)
- **NEXUS_Technical_Architecture_Detailed.md** — original full design doc (background reading)
- **NEXUS_Team_Brief.md** — plain-English explainer (for team, not for building)
- **NEXUS_Production_DevOps.md** — deployment/ops reference (for later phases)
