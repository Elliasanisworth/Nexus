# PROGRESS_LOG.md — NEXUS Build Status
> UPDATE THIS FILE at the end of every work session, before context runs out.
> Whoever (or whichever AI) picks up next reads this file SECOND, right after AGENT.md.

---

## How to Use This File

1. **Starting a session?** Read AGENT.md → CONTEXT.md → this file's "CURRENT STATE" section, in that order.
2. **Ending a session (or running low on context/tokens)?** Update "CURRENT STATE" and fill in the "HANDOFF PROMPT" box below with everything the next AI needs — don't assume it remembers this conversation.
3. **Switching to a different AI tool entirely?** Paste AGENT.md + CONTEXT.md + this file's handoff prompt as the first message. That's enough for a fresh session to continue at full quality.

---

## CURRENT STATE (last updated: 26 Aug 2026 — planning phase complete, build not started)

### ✅ DONE
- [x] Problem scoped to single hero use case (Emergency Transport & Resource Allocation)
- [x] Architecture finalized (modular monolith + Prediction + Optimization services)
- [x] Data model finalized (see CONTEXT.md Section 1)
- [x] API contract drafted (see CONTEXT.md Section 2)
- [x] Algorithm specs written (XGBoost features, OR-Tools constraints, fallback rule)
- [x] Tech stack locked (see AGENT.md Section 4)
- [x] MVP scope cut-line locked (see AGENT.md Section 5)
- [x] Synthetic data strategy defined (vehicle simulator + incident generator specs)
- [x] Pitch deck built (NEXUS_SIH_Presentation.pptx)
- [x] AGENT.md, CONTEXT.md created

### 🔲 NOT STARTED YET (build phase)
- [ ] Repo scaffolding (folder structure per AGENT.md Section 7)
- [ ] `docker-compose.yml` — empty skeleton (FastAPI + Postgres + Redis booting, no features)
- [ ] `scripts/vehicle_simulator.py` — CRITICAL PATH, build early, other features depend on it
- [ ] `scripts/incident_generator.py`
- [ ] Database models (SQLAlchemy, matching CONTEXT.md Section 1 exactly)
- [ ] Alembic migration setup
- [ ] Vehicle CRUD endpoints
- [ ] Incident CRUD endpoints
- [ ] XGBoost training script + prediction endpoint
- [ ] OR-Tools assignment logic + fallback rule
- [ ] Recommendation generation + approve/modify/reject endpoints
- [ ] WebSocket setup
- [ ] React dashboard skeleton
- [ ] React: map component, incident feed, recommendation card
- [ ] End-to-end integration test (synthetic incident → recommendation → approval → outcome)
- [ ] Basic analytics endpoints

### 🚧 BLOCKED / NEEDS DECISION
- None right now.

### ⚠️ SPIKE NEEDED (unverified assumptions)
- [ ] Confirm OR-Tools + XGBoost both install/import cleanly in the target Python version — do a 15-min "hello world" test before building around them
- [ ] Confirm PostGIS extension enables cleanly in the chosen Postgres Docker image

---

## SESSION LOG (append, don't overwrite — newest on top)

### Session: 26 Aug 2026
- Built AGENT.md, CONTEXT.md, PROGRESS_LOG.md (this file)
- Locked architecture, tech stack, MVP scope, data model, API contract
- Answered: data sourcing strategy (synthetic + open data), vehicle tracking strategy (simulated GPS)
- Next session should start with repo scaffolding + docker-compose skeleton

---

## HANDOFF PROMPT (copy-paste this into a new AI session if switching tools or context resets)

```
I'm building NEXUS, an emergency transport/resource allocation decision-support 
platform for Smart India Hackathon 2026 (Team CapsLock). 

Read these three files I'm attaching before doing anything:
1. AGENT.md — rules, architecture, tech stack, MVP scope (non-negotiable, follow exactly)
2. CONTEXT.md — exact data model, API contract, algorithm specs
3. PROGRESS_LOG.md — what's built so far, what's next

Current status: [PASTE the "CURRENT STATE" section from PROGRESS_LOG.md here]

What I need you to build next: [FILL IN — e.g. "the docker-compose.yml skeleton" 
or "the Vehicle SQLAlchemy model + CRUD endpoints"]

Rules:
- Don't deviate from the tech stack in AGENT.md Section 4
- Don't add features outside AGENT.md Section 5 MVP scope
- Match field names/types exactly as in CONTEXT.md — don't invent your own schema
- Human-in-the-loop and graceful degradation are mandatory, not optional
- End your response with an updated PROGRESS_LOG.md "CURRENT STATE" section 
  reflecting what you just built, so I can carry it forward
```

---

## QUICK STATUS CHECK TEMPLATE (fill and paste when resuming with me)

```
Since you last saw this project:
- I built: [what you did, e.g. "docker-compose skeleton, boots clean"]
- I'm stuck on: [any blocker]
- Next I want: [what to build next]
```
