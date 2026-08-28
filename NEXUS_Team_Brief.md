# NEXUS: Quick Team Reference
## What is NEXUS? (In Plain English)

A **decision-support system** that helps emergency dispatch officials make faster, smarter decisions about which vehicle to send where, using real-time data, predictions, and optimization.

**Key principle:** NEXUS **recommends**, it doesn't command. The human officer always makes the final call.

---

## The Workflow (What Happens)

```
Officer reports incident
         ↓
System predicts ETA for nearby vehicles
         ↓
System optimizes: which vehicle should go?
         ↓
System recommends the best option
         ↓
Officer sees recommendation on dashboard
         ↓
Officer approves, modifies, or rejects
         ↓
Vehicle dispatched
         ↓
System records what actually happened
         ↓
System learns from the outcome
```

---

## System Architecture (Three Layers)

```
┌─────────────────────────────────────────┐
│    DASHBOARD (React + live map)         │
└─────────────────────┬───────────────────┘
                      │
         ┌────────────┼────────────┐
         │            │            │
         ▼            ▼            ▼
   ┌─────────┐  ┌──────────┐  ┌─────────┐
   │ Live    │  │ Real-time│  │ WebSocket
   │Vehicle  │  │ Updates  │  │ Feed
   │Feed     │  │          │  │
   └─────────┘  └──────────┘  └─────────┘
         │            │            │
         └────────────┼────────────┘
                      │
                      ▼
              ┌───────────────┐
              │  API Gateway  │
              │   (Nginx)     │
              └───────┬───────┘
                      │
      ┌───────────────┼───────────────┐
      │               │               │
      ▼               ▼               ▼
 ┌─────────────┐ ┌──────────────┐ ┌──────────────┐
 │   CORE API  │ │  PREDICTION  │ │ OPTIMIZATION │
 │ (FastAPI)   │ │  SERVICE     │ │ SERVICE      │
 │             │ │              │ │              │
 │ Manages:    │ │ Predicts:    │ │ Decides:     │
 │ • Incidents │ │ • ETA        │ │ • Which      │
 │ • Vehicles  │ │ • Severity   │ │   vehicle    │
 │ • Status    │ │              │ │ • Best route │
 │ • Auth      │ │ (XGBoost ML) │ │              │
 │             │ │              │ │ (OR-Tools)   │
 └─────────────┘ └──────────────┘ └──────────────┘
      │               │               │
      └───────────────┼───────────────┘
                      │
        ┌─────────────┴─────────────┐
        ▼                           ▼
   ┌──────────────┐         ┌────────────────┐
   │  PostgreSQL  │         │     Redis      │
   │  + PostGIS   │         │                │
   │              │         │ Stores:        │
   │ Stores:      │         │ • Live vehicle │
   │ • All data   │         │   positions    │
   │ • History    │         │ • Cache        │
   │ • Geography  │         │ • Pub/sub msgs │
   └──────────────┘         └────────────────┘
```

---

## Who Does What?

| Role | What They Do | Uses |
|---|---|---|
| **Transport Officer** | Reviews incident, approves dispatch recommendation | Dashboard, approves/rejects suggestions |
| **Incident Operator** | Reports emergency, says what's needed | Mobile app or phone, creates incidents |
| **System Admin** | Manages users, vehicles, system config | Admin panel, database |
| **Analyst** | Looks at metrics, performance reports | Analytics dashboard |

---

## Tech Stack (Why Each?)

| What | Technology | Why |
|---|---|---|
| **Maps & location queries** | PostgreSQL + PostGIS | Industry standard for "which vehicle is closest" questions |
| **Live vehicle positions** | Redis | Super fast, handles hundreds of GPS pings per second |
| **Vehicle assignment & routing** | OR-Tools | Built specifically for "which vehicle goes where" problems |
| **ETA prediction** | XGBoost | Learns from past data, predicts accurately, runs fast |
| **Backend API** | FastAPI | Modern, handles many requests, very fast |
| **Dashboard** | React + MapLibre | React popular, MapLibre open-source (no hidden fees) |
| **Background jobs** | Celery + Redis | Lets system handle slow AI/optimization without hanging |
| **Monitoring** | Prometheus + Grafana | Track system health in real-time |
| **Containers** | Docker | Reproducible, works everywhere |
| **CI/CD** | GitHub Actions | Automatic testing before deploying |

---

## Database Schema (What We Store)

```
Vehicles
├─ ID, name, location, status (available/busy/offline)
├─ Type (ambulance/fire/rescue)
└─ Capacity, constraints

Incidents
├─ ID, location, type (accident/flood/etc)
├─ Severity, status (new/assigned/resolved)
└─ Required resources, description

Assignments
├─ Which vehicle → which incident
├─ Assigned time, actual arrival time
└─ Actual distance, actual time taken

Routes
├─ From origin → destination
├─ Distance, predicted ETA, actual ETA
└─ Waypoints

Recommendations
├─ "Send vehicle V17 via Route B in 8 mins"
├─ Confidence score, reasoning
├─ Status (pending/approved/rejected)
└─ Who approved it, when

AuditLog
└─ Every decision logged (for accountability)
```

---

## The Three Key Algorithms

### 1. Prediction (XGBoost)
```
Inputs: distance, time of day, vehicle type, traffic, history
         ↓
     XGBoost model
         ↓
Output: Predicted arrival time
```
**Why it matters:** Allows us to pick the vehicle that will arrive *fastest*, not just the one that's physically nearest.

### 2. Optimization (OR-Tools)
```
Problem: 5 incidents waiting, 10 vehicles available
Problem: Match them optimally (minimize distance + time)

OR-Tools solver
         ↓
Output: "Send V1 to Inc1, V2 to Inc2, ..." (optimal assignment)
```
**Why it matters:** Solves a complex puzzle instantly instead of a human guessing.

### 3. Scenario Simulation
```
"What if Road X closes?"
         ↓
System calculates impact:
- Which vehicles affected?
- How much longer will routes take?
- Any vehicles trapped?
         ↓
Shows decision-maker the consequences before they happen
```

---

## What Happens If Something Breaks?

| If this fails | We do this |
|---|---|
| Prediction service crashes | Use simple distance-based ETA instead of AI prediction |
| Optimization service crashes | Use "nearest available vehicle" rule instead |
| Redis crashes | Restart it, live data reloads from database |
| Database crashes | Activate read-replica backup (automatic failover) |

**In all cases:** dispatch doesn't stop, it just gets less smart.

---

## Workflow in Pictures

### Normal Incident Flow
```
INCIDENT CREATED
        ↓
[1 second later]
        ├─ Prediction worker: "V17 will arrive in 8 min"
        ├─ Optimization worker: "V17 is best choice"
        └─ Dashboard shows: "Send V17 via Route B (8 min ETA)"
        ↓
OFFICER APPROVES
        ↓
V17 DISPATCHED
        ↓
[V17 drives]
        ↓
V17 ARRIVES
        ↓
INCIDENT RESOLVED
        ↓
[Next night, system learns from this]
```

### Human Approval Moment
```
NEXUS says: "Send V17"
        │
        ├─ Officer sees it on dashboard
        │
        ├─ Can approve ✓
        ├─ Can modify ("No, send V18 instead")
        └─ Can reject ("Need 2 vehicles, not 1")
```

---

## Deployment (How We Ship It)

### Local Development
```
docker-compose up
```
All services start locally, dashboard at http://localhost:3000

### Live Demo (Hackathon)
```
docker-compose with synthetic incident data
Shows system working end-to-end
```

### Production (Future)
```
GitHub Actions automatically tests all code
If tests pass: built into Docker image
Deployed to server with health monitoring
Prometheus tracks system performance
```

---

## Key Files for the Team

```
Where's What?

Frontend (React dashboard)
└─ frontend/src/components/
   ├─ IncidentMap.jsx         ← Live map display
   ├─ RecommendationCard.jsx  ← Shows recommendations
   └─ AnalyticsDashboard.jsx  ← Metrics

Backend (API)
└─ backend/app/
   ├─ routes/                 ← Endpoints
   ├─ services/               ← Business logic
   └─ ai/                     ← ML models

Database
└─ backend/app/db/
   └─ models.py               ← Database tables

Configuration
└─ docker-compose.yml         ← Start everything
```

---

## Features We're Building

### MVP (Hackathon)
- ✅ Create incidents
- ✅ Track vehicles
- ✅ Predict ETA (AI)
- ✅ Recommend assignment (AI + optimization)
- ✅ Officer approves/rejects
- ✅ Dashboard display
- ✅ Basic metrics

### Later (Production)
- 🔄 Mobile app for drivers
- 🔄 SMS notifications
- 🔄 What-if scenarios (close a road, see impact)
- 🔄 Demand prediction
- 🔄 Multi-city coordination
- 🔄 Historical analytics

---

## Success Metrics (What We Measure)

```
Response Time
├─ How fast does a vehicle arrive?
└─ Goal: Faster than manual dispatch

Route Efficiency
├─ Are vehicles taking optimal routes?
└─ Goal: Shorter routes = less fuel

Fleet Utilization
├─ Are vehicles being used well?
└─ Goal: Vehicles not sitting idle

Prediction Accuracy
├─ How accurate are our ETA predictions?
└─ Goal: < 2 minute average error

Officer Approval Rate
├─ Do officers trust the recommendations?
└─ Goal: > 85% approve without modification
```

---

## Questions the Team Might Have

**Q: Can the AI make wrong decisions?**
A: Yes, but that's why humans have the final say. The officer can override anytime.

**Q: What if there's no traffic data?**
A: We use historical patterns (this time of day is usually congested). Not perfect, but better than guessing.

**Q: Can multiple vehicles be sent to one incident?**
A: Yes, if the incident specifies "2 ambulances needed", the system will assign 2.

**Q: What if a vehicle goes offline mid-incident?**
A: Recommendation engine recalculates with remaining vehicles, officer is notified.

**Q: How long does optimization take?**
A: < 2 seconds for typical problem sizes (10-20 incidents, 50-100 vehicles).

**Q: Can dispatchers reject the recommendation?**
A: Absolutely. They can pick a different vehicle or route. The system learns from this too.

---

## How to Run It

### Dev Environment
```bash
# 1. Clone repo
git clone <repo>

# 2. Start everything
docker-compose up

# 3. Load sample data
python backend/scripts/load_sample_incidents.py

# 4. Open dashboard
http://localhost:3000

# 5. Create an incident and watch the system work
```

### Demo with Simulated Data
```bash
# Run incident generator (creates fake incidents every 30 seconds)
python backend/scripts/simulate_incidents.py

# Watch dashboard show recommendations in real-time
```

---

## Key Takeaway

**NEXUS = Data-driven decision support**

Not automation. Not replacing humans.

**Smart recommendations + human judgment = better, faster decisions.**

That's it. Everything else is just the plumbing to make that work.
