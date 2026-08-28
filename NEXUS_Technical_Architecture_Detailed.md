# NEXUS: Complete Technical Architecture & Design
## SIH 2026 | Team CapsLock

---

## Part 1: System Overview

### What is NEXUS?

A **decision-support platform** for emergency transport and resource allocation that combines **real-time operational data**, **intelligent prediction**, and **constrained optimization** to recommend the best resource-to-incident assignment and routing — all under **human approval authority**.

### Core Principle
```
NEXUS does NOT automate. NEXUS RECOMMENDS.

Incident → Predict → Optimize → Recommend → [HUMAN DECISION] → Execute → Learn
```

---

## Part 2: Three-Layer Architecture (The Brain)

```
┌─────────────────────────────────────────────────────────────┐
│                   PRESENTATION LAYER                        │
│         React Dashboard + WebSocket (live updates)           │
└──────────────────────────┬──────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
┌───────▼────────┐ ┌──────▼────────┐ ┌──────▼────────┐
│  API Gateway   │ │     REST      │ │   WebSocket  │
│   (Nginx)      │ │   Endpoints   │ │ (Live Feed)  │
└───────┬────────┘ └───────────────┘ └──────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│                APPLICATION LAYER (FastAPI)                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │ OPERATIONAL LAYER│  │ INTELLIGENCE     │                │
│  │                  │  │ LAYER (Async)    │                │
│  │ • Incident CRUD  │  │                  │                │
│  │ • Vehicle CRUD   │  │ • ETA Prediction │                │
│  │ • Assignment     │  │ • Demand         │                │
│  │ • Status mgmt    │  │   Prediction     │                │
│  │ • Auth           │  │ • Congestion     │                │
│  │                  │  │   Scoring        │                │
│  └──────────────────┘  └──────────────────┘                │
│                                                              │
│  ┌──────────────────────────────────────────┐              │
│  │ DECISION LAYER (Async)                   │              │
│  │                                           │              │
│  │ • Resource Discovery (SQL + PostGIS)     │              │
│  │ • Route Optimization (OR-Tools)          │              │
│  │ • Recommendation Ranking                 │              │
│  │ • Scenario Simulation (read-only copy)   │              │
│  │ • Analytics queries                      │              │
│  └──────────────────────────────────────────┘              │
│                                                              │
│  Message Queue Bridge (Redis Pub/Sub)                      │
│  ├─ Incident events                                         │
│  ├─ Prediction results                                      │
│  └─ Optimization results                                    │
│                                                              │
└───────────────┬──────────────────────┬──────────────────────┘
                │                      │
        ┌───────▼──────────┐  ┌────────▼─────────┐
        │  MESSAGE QUEUE   │  │  BACKGROUND JOBS │
        │  (Redis/Celery)  │  │  • Model retrain │
        │                  │  │  • Metric export │
        │                  │  │  • Cleanup jobs  │
        └──────────────────┘  └──────────────────┘
                │
        ┌───────┴────────┬─────────────┬──────────────┐
        ▼                ▼             ▼              ▼
    ┌────────────┐ ┌──────────────┐ ┌──────┐ ┌─────────────┐
    │ PostgreSQL │ │    Redis     │ │ S3/  │ │Prometheus  │
    │ + PostGIS  │ │ (Live state) │ │Object│ │  metrics   │
    │            │ │ (Cache)      │ │Stor. │ │            │
    │ • Incidents│ │ (pub/sub)    │ │      │ │(time-series)
    │ • Vehicles │ │              │ │Models│ │            │
    │ • Routes   │ │              │ │Logs  │ │            │
    │ • History  │ │              │ │      │ │            │
    │ • Geo Data │ │              │ │      │ │            │
    └────────────┘ └──────────────┘ └──────┘ └─────────────┘
```

### Why This Three-Layer Separation?

| Layer | Responsibility | Why Separate? |
|---|---|---|
| **Operational** | Manage current state (incidents, vehicles, assignments) | Must be fast, always available, source of truth. Decoupling ensures incidents don't get lost due to ML failures. |
| **Intelligence** | Predict future conditions (ETA, demand, congestion) | Can be slow (few seconds), asynchronous. If it fails, system degrades to rule-based. Can be replaced/improved independently. |
| **Decision** | Optimize assignments, routes, generate recommendations | CPU-intensive, batch-like. Can spike under load. Separation allows independent scaling. |

---

## Part 3: Data Model (Entity-Relationship)

### Core Entities

```
┌──────────────────┐
│      User        │
├──────────────────┤
│ id (PK)          │
│ email            │
│ name             │
│ role             │ ─┐
│ department       │  │
│ phone            │  │
│ created_at       │  │
│ last_login       │  │
└──────────────────┘  │
                      │
┌──────────────────┐  │
│ VehicleType      │  │
├──────────────────┤  │
│ id (PK)          │  │
│ name             │  │
│ capacity         │  │
│ crew_needed      │  │
│ specialization   │  │
└──────────────────┘  │
      ▲               │
      │ has           │
┌─────┴──────────────┬┴──────────────┐
│    Vehicle         │               │
├────────────────────┤               │
│ id (PK)            │               │
│ vehicle_id         │               │
│ vehicle_type_id(FK)               │
│ current_location   │◄─ PostGIS    │
│ status             │  geometry     │
│ assigned_to_unit   │               │
│ last_gps_update    │    ◄────────┘
│ capacity_used      │
│ constraint_tags    │
│ created_at         │
└────────────────────┘

┌──────────────────────────────────┐
│        Incident                  │
├──────────────────────────────────┤
│ id (PK)                          │
│ external_id (optional, from CAD) │
│ location (geometry + PostGIS)     │
│ incident_type                    │
│ severity (1-5 or LOW/MED/HIGH)   │
│ status                           │
│ required_resources[]             │
│ description                      │
│ reported_by (User FK)            │
│ created_at                       │
│ resolved_at                      │
└──────────────────────────────────┘
         │
         │ has
         ▼
┌──────────────────────────────────┐
│      Assignment                  │
├──────────────────────────────────┤
│ id (PK)                          │
│ incident_id (FK)                 │
│ vehicle_id (FK)                  │
│ assigned_by (User FK)            │
│ assignment_timestamp             │
│ estimated_arrival                │
│ actual_arrival (optional)         │
│ actual_distance_driven           │
│ actual_time_taken                │
│ status (assigned/en_route/...)   │
└──────────────────────────────────┘

┌──────────────────────────────────┐
│        Route                     │
├──────────────────────────────────┤
│ id (PK)                          │
│ assignment_id (FK)               │
│ vehicle_id (FK)                  │
│ waypoints (geometry array)        │
│ distance_m                       │
│ predicted_eta_seconds            │
│ actual_eta_seconds (optional)    │
│ generated_by (algorithm type)    │
│ traffic_factor_applied           │
│ created_at                       │
└──────────────────────────────────┘

┌──────────────────────────────────┐
│    Recommendation                │
├──────────────────────────────────┤
│ id (PK)                          │
│ incident_id (FK)                 │
│ recommended_vehicle_id (FK)      │
│ recommended_route_id (FK)        │
│ confidence_score (0-100)         │
│ reasoning_json                   │
│ alternatives[] (alt assignments) │
│ status (pending/approved/...)    │
│ approved_by (User FK, nullable)  │
│ approval_timestamp               │
│ created_at                       │
└──────────────────────────────────┘

┌──────────────────────────────────┐
│      Prediction                  │
├──────────────────────────────────┤
│ id (PK)                          │
│ prediction_type (ETA/demand/...)│
│ subject_id (vehicle/route/area) │
│ predicted_value                  │
│ confidence                       │
│ inputs_used_json                 │
│ model_version                    │
│ created_at                       │
│ actual_value (optional, after)   │
│ prediction_error (calculated)    │
└──────────────────────────────────┘

┌──────────────────────────────────┐
│    SimulationScenario            │
├──────────────────────────────────┤
│ id (PK)                          │
│ name                             │
│ description                      │
│ base_state_snapshot (JSON)       │
│ modifications (e.g. road closed) │
│ created_by (User FK)             │
│ created_at                       │
│ is_active (for read-only queries)│
└──────────────────────────────────┘
         │
         │ runs against
         ▼
┌──────────────────────────────────┐
│    SimulationResult              │
├──────────────────────────────────┤
│ id (PK)                          │
│ scenario_id (FK)                 │
│ affected_vehicles[]              │
│ affected_incidents[]             │
│ eta_deltas (map vehicle→delta)   │
│ alternative_routes[]             │
│ generated_at                     │
└──────────────────────────────────┘

┌──────────────────────────────────┐
│      AuditLog                    │
├──────────────────────────────────┤
│ id (PK)                          │
│ event_type (INCIDENT_CREATED...) │
│ entity_type (Incident/Assignment)│
│ entity_id                        │
│ actor (User FK)                  │
│ changes_json                     │
│ timestamp                        │
│ source_ip (for security)         │
└──────────────────────────────────┘

┌──────────────────────────────────┐
│    OperationalMetric             │
├──────────────────────────────────┤
│ id (PK)                          │
│ metric_name                      │
│ metric_value                     │
│ timestamp                        │
│ dimensions (JSON: department...) │
└──────────────────────────────────┘
```

### Key Design Decisions

**PostGIS for Geography:**
- Nearest-unit queries are pure geographic operations
- `ST_Distance(vehicle_location, incident_location)` is the right tool
- Also supports buffer queries: "find all resources within 5km"

**JSON columns for flexibility:**
- `Recommendation.reasoning_json` — stores why this recommendation was chosen
- `Incident.required_resources[]` — flexible schema for different incident types
- This allows schema evolution without migrations

**Audit trail via AuditLog:**
- Every operational decision is logged
- Supports "who changed what, when" queries
- Critical for government accountability

**SimulationScenario as a "parallel universe":**
- Stored separately so it never interferes with live data
- Queries against it explicitly reference the scenario_id
- No risk of simulation overwriting real state

---

## Part 4: API Structure (FastAPI Endpoints)

### Authentication & Core
```
POST   /auth/login
POST   /auth/logout
POST   /auth/refresh-token
GET    /health
GET    /readiness
```

### Vehicles (CRUD)
```
POST   /vehicles
GET    /vehicles
GET    /vehicles/{vehicle_id}
PATCH  /vehicles/{vehicle_id}
PUT    /vehicles/{vehicle_id}/location      # GPS update
PUT    /vehicles/{vehicle_id}/status        # available/busy/offline
GET    /vehicles/search?location_lat=&location_lon=&radius_km=5
```

### Incidents (CRUD)
```
POST   /incidents
GET    /incidents
GET    /incidents/{incident_id}
PATCH  /incidents/{incident_id}
PUT    /incidents/{incident_id}/status      # new/assigned/in_progress/resolved
GET    /incidents/active
```

### Predictions (Intelligence Layer)
```
POST   /predict/eta
       Body: {vehicle_id, origin, destination, route_waypoints?}
       Returns: {estimated_time_seconds, confidence, inputs_used}

POST   /predict/demand
       Body: {area_geometry, time_range}
       Returns: {predicted_incidents_count, confidence}

POST   /predict/congestion
       Body: {road_ids[], time_window}
       Returns: {congestion_score_per_road, predicted_delay_factors}
```

### Resource Discovery & Optimization (Decision Layer)
```
POST   /optimize/find-resources
       Body: {incident_id, required_resources[]}
       Returns: {candidates: [{vehicle, distance, eta, suitability_score}]}

POST   /optimize/route
       Body: {vehicle_id, origin, destination, constraints?, priority?}
       Returns: {route, distance_m, estimated_eta, alternatives: []}

POST   /optimize/assign
       Body: {incident_id, candidate_vehicles[]}
       Returns: {optimal_assignment: [{vehicle, route, eta, cost}],
                reason: "..."}
```

### Recommendations
```
POST   /recommendations/generate
       Body: {incident_id}
       Returns: {recommended_vehicle, recommended_route, eta, confidence,
                reasoning, alternatives, status: "pending"}

GET    /recommendations/{recommendation_id}

PUT    /recommendations/{recommendation_id}/approve
       Body: {approved_by_user_id, modifications?}

PUT    /recommendations/{recommendation_id}/reject
       Body: {rejected_by_user_id, reason}

PUT    /recommendations/{recommendation_id}/modify
       Body: {new_vehicle?, new_route?, notes}
```

### Scenario Simulation
```
POST   /simulations
       Body: {name, description, modifications: [{type, detail}]}
       Returns: {simulation_id}

GET    /simulations/{simulation_id}

POST   /simulations/{simulation_id}/run
       Body: {scenario_state}
       Returns: {affected_vehicles, affected_routes, eta_deltas, alternatives}

DELETE /simulations/{simulation_id}
```

### Analytics
```
GET    /analytics/average-response-time?start_date=&end_date=
GET    /analytics/fleet-utilization?start_date=&end_date=
GET    /analytics/route-efficiency?start_date=&end_date=
GET    /analytics/prediction-accuracy?metric_type=ETA&days=30
GET    /analytics/resource-allocation-distribution
GET    /analytics/incident-heatmap?geohash_precision=7
```

### Admin / Audit
```
GET    /audit-log?entity_type=Incident&days=7&limit=100
GET    /users
POST   /users
PATCH  /users/{user_id}
PUT    /users/{user_id}/role
```

### WebSocket (Live Updates)
```
WS     /ws/incidents
       Events: {incident_created, incident_updated, incident_resolved}

WS     /ws/vehicles
       Events: {vehicle_location_updated, vehicle_status_changed}

WS     /ws/recommendations
       Events: {recommendation_generated, recommendation_updated}

WS     /ws/analytics
       Events: {metric_updated}
```

---

## Part 5: Algorithm & AI Details

### A. ETA Prediction (XGBoost)

**Inputs (features):**
- Distance (meters)
- Time of day (cyclical: hour, day-of-week)
- Traffic factor (from live API if available; else historical)
- Road type (highway, city, local)
- Vehicle type (affects speed, routing)
- Historical ETA for similar trips
- Weather conditions (if available)
- Incident type (affects routing restrictions)

**Output:**
- Predicted ETA in seconds

**Why XGBoost, not neural networks?**
- Tabular data, not images/text
- Gradient boosting naturally handles categorical features (time of day, road type)
- Faster training (we retrain nightly)
- Explainable: feature importance tells you which factors matter most
- Smaller model, easier to deploy

**Retraining:**
- Every night at 2 AM (off-peak)
- Uses past 90 days of actual outcomes
- Stores model version + timestamp in database
- Serves latest model from in-memory cache

### B. Demand Prediction

**Inputs:**
- Historical incident counts by area, time, day-of-week
- Population density heatmap
- Special events (if data available)
- Seasonal trends

**Output:**
- Expected number of incidents in area over next N hours

**Purpose:**
- Proactive resource pre-positioning
- Analytics reports

### C. Congestion Scoring

**Simple approach for MVP:**
- If traffic API available: use directly
- Else: "based on time of day, this road is typically congested" (historical)
- Multiplier on ETA: 1.0 (no congestion) to 1.5 (heavy)

### D. Resource Allocation (OR-Tools Vehicle Routing Problem)

**The Problem:**
```
Given:
- N incidents (each with a location, required resources, priority)
- M vehicles (each with location, capacity, constraints, current workload)

Minimize:
- Total distance
- Total time
- Resource mismatch

Constraints:
- Each incident assigned exactly one suitable vehicle
- Vehicle capacity not exceeded
- Vehicle type matches resource requirement
- High-priority incidents get closer/faster vehicles
```

**Why OR-Tools?**
- Purpose-built for VRP (Vehicle Routing Problem)
- Handles constraints naturally
- Much faster than trying to do this with ML
- Deterministic output (same input → same output), easier to debug

**Implementation:**
```python
from ortools.linear_solver import pywraplp

# Create solver
solver = pywraplp.Solver.CreateSolver('SCIP')

# Define decision variables: x[incident][vehicle] = 1 if vehicle assigned
x = {}
for i in incidents:
    for v in vehicles:
        x[(i, v)] = solver.IntVar(0, 1, f'x_{i}_{v}')

# Constraint 1: Each incident assigned exactly once
for i in incidents:
    solver.Add(sum(x[(i, v)] for v in vehicles) == 1)

# Constraint 2: Vehicle capacity
for v in vehicles:
    solver.Add(
        sum(incidents[i].required_capacity * x[(i, v)] 
            for i in incidents) <= vehicles[v].capacity
    )

# Objective: Minimize total distance + priority weighting
objective = solver.Objective()
for i in incidents:
    for v in vehicles:
        distance = distance_matrix[i][v]
        priority_weight = incidents[i].priority  # high priority = higher weight
        objective.SetCoefficient(x[(i, v)], distance * priority_weight)

solver.Minimize(objective)

# Solve
status = solver.Solve()
if status == pywraplp.Solver.OPTIMAL:
    return {v: [i for i in incidents if x[(i, v)].solution_value() > 0.5]
            for v in vehicles}
```

---

## Part 6: Complete Workflow (Incident → Resolution)

```
┌─────────────────────────────────────────────────────────────┐
│ STEP 1: INCIDENT REPORTED                                   │
│         (via phone, CAD system, or mobile app)               │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
         ┌──────────────────┐
         │ POST /incidents  │
         └────────┬─────────┘
                  │
                  ▼
   ┌──────────────────────────────────┐
   │ Validate input                    │
   │ Assign incident_id (UUID)         │
   │ Geolocate (lat/lon)               │
   │ Set status = NEW                  │
   │ Save to PostgreSQL immediately    │
   └──────────────────┬────────────────┘
                      │
                      ▼
          ┌─────────────────────────┐
          │ Broadcast via WebSocket │
          │ to all connected clients │
          └─────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ STEP 2: ASYNCHRONOUS PREDICTION & OPTIMIZATION JOBS QUEUED   │
│         (Jobs added to message queue immediately)            │
└────────────────┬────────────────────────────────────────────┘
                 │
         ┌───────┴─────────┐
         ▼                 ▼
    ┌─────────────┐  ┌──────────────┐
    │ Job: Predict│  │Job: Optimize │
    └──────┬──────┘  └───────┬──────┘
           │                 │
           ▼                 ▼
  ┌──────────────────┐ ┌──────────────────┐
  │ Prediction Worker│ │Optimization Work.│
  │ (async)          │ │ (async)          │
  │                  │ │                  │
  │ XGBoost model    │ │ OR-Tools solver  │
  │ load             │ │ Find resources   │
  │                  │ │ Calculate routes │
  │ ETA predict      │ │ Rank solutions   │
  │                  │ │                  │
  │ (can fail)       │ │ (can fail)       │
  └────────┬─────────┘ └────────┬─────────┘
           │                    │
           ▼                    ▼
      ┌─────────────────────────────────┐
      │ Results published to Redis       │
      │ pub/sub for subscribers          │
      └────────┬────────────────────────┘
               │
               ▼
    ┌───────────────────────────────────┐
    │ Generate Recommendation            │
    │ - Best vehicle assignment          │
    │ - Best route                       │
    │ - Confidence score                 │
    │ - Reasoning explanation            │
    │ - Alternative options              │
    │ Status: PENDING                    │
    └───────┬───────────────────────────┘
            │
            ▼
   ┌──────────────────────────────────┐
   │ Broadcast recommendation to       │
   │ dashboard via WebSocket           │
   │ Officer sees it in real-time      │
   └──────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ STEP 3: HUMAN DECISION POINT                                │
│         (Officer reviews recommendation on dashboard)        │
└────────────────┬────────────────────────────────────────────┘
                 │
        ┌────────┼────────┐
        │        │        │
        ▼        ▼        ▼
     ACCEPT   MODIFY   REJECT
        │        │        │
        ├────────┼────────┤
        │        │        │
        ▼        ▼        ▼
   ┌─────────────────────────────────────┐
   │ Log officer's decision to AuditLog   │
   │ Update recommendation status        │
   └───────────┬───────────────────────┘
               │
               ▼
   ┌─────────────────────────────────────┐
   │ Dispatch vehicle                    │
   │ Assign to incident                  │
   │ Create Assignment record            │
   │ Send SMS/notification to vehicle    │
   │ Update incident status→IN_PROGRESS  │
   └─────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ STEP 4: EXECUTION & MONITORING                              │
│         (Vehicle en route, real-time tracking)              │
└────────────────┬────────────────────────────────────────────┘
                 │
    ┌────────────┴──────────────┐
    │                           │
    ▼                           ▼
 Vehicle sends GPS      System calculates
 updates every 10s      actual distance/time
    │                           │
    ├───────────────┬───────────┤
    │               │           │
    ▼               ▼           ▼
 Store in Redis  Compare to   ETA update
 (live state)    predicted    dashboard
                 Calculate
                 error margin

┌─────────────────────────────────────────────────────────────┐
│ STEP 5: INCIDENT RESOLVED                                   │
│         (Vehicle arrived, incident handled)                 │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
   ┌─────────────────────────────────────┐
   │ Update incident status→RESOLVED     │
   │ Update assignment status→COMPLETED  │
   │ Record actual arrival time          │
   │ Record actual distance driven       │
   │ Update operational metrics          │
   └───────────┬───────────────────────┘
               │
               ▼
   ┌─────────────────────────────────────┐
   │ Calculate prediction error:         │
   │ |predicted_eta - actual_time|       │
   └───────────┬───────────────────────┘
               │
               ▼
   ┌─────────────────────────────────────┐
   │ Store all outcome data for retraining│
   │ (nightly batch job uses this)        │
   └─────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ STEP 6: NIGHTLY FEEDBACK LOOP (Automatic)                   │
│         (System learns from outcomes)                        │
└────────────────┬────────────────────────────────────────────┘
                 │ (2 AM, cron job)
                 ▼
   ┌─────────────────────────────────────┐
   │ Fetch all resolved incidents from   │
   │ last 24 hours                       │
   │ Extract features + actual outcomes  │
   └───────────┬───────────────────────┘
               │
               ▼
   ┌─────────────────────────────────────┐
   │ Retrain XGBoost ETA model           │
   │ Evaluate on validation set          │
   │ Check for regression                │
   │ If better: promote to production    │
   │ If worse: rollback, alert team      │
   └───────────┬───────────────────────┘
               │
               ▼
   ┌─────────────────────────────────────┐
   │ Update metrics dashboard            │
   │ - Prediction accuracy (MAE)         │
   │ - Average response time             │
   │ - Fleet utilization                 │
   │ - Resource allocation efficiency    │
   └─────────────────────────────────────┘
```

---

## Part 7: Production-Level Concerns

### A. Failure Modes & Graceful Degradation

| Failure Mode | What Happens | Recovery |
|---|---|---|
| Prediction service down | Fall back to static routing estimates | Rules: "vehicle A is X km away, ETA = distance / avg_speed" |
| Optimization service down | Fall back to nearest-available-unit rule | Officers can manually assign if needed |
| Redis down | Live state lost temporarily | Restart Redis, reload from Postgres. GPS updates queue up until Redis restarts. |
| Database down | System is down. | Backup/read-replica failover (minutes). This is why you don't put it in the cloud without failover. |
| WebSocket connection drops | Dashboard reconnects automatically | Fetch missed updates from REST endpoint. |

### B. Observability (Prometheus + Grafana)

**Key metrics to track:**

```
# Request latency
http_request_duration_seconds{endpoint="/incidents", quantile="0.95"}
http_request_duration_seconds{endpoint="/recommend", quantile="0.99"}

# Error rates
http_request_errors_total{endpoint, error_code}

# Queue depth
message_queue_depth{queue="prediction_jobs"}
message_queue_depth{queue="optimization_jobs"}

# Model performance
prediction_error_mae{model="xgboost_eta", window="24h"}
prediction_error_mae{model="xgboost_eta", window="7d"}

# Dispatch performance
incidents_resolved_total{severity}
average_response_time_seconds{priority}
fleet_utilization_percent

# System health
active_connections_count
db_connection_pool_usage_percent
redis_memory_bytes
cache_hit_rate
```

### C. Security

**Authentication:**
- JWT tokens (issued on login)
- Roles: Admin, Operations Officer, Incident Operator, Analyst
- Token expiration: 8 hours; refresh tokens live 30 days

**Authorization:**
- Role-based access control (RBAC)
- Operations Officer cannot access audit logs
- Analyst cannot approve recommendations
- Only authorized departments can see certain incident data

**Data sensitivity:**
- Operational data (vehicles, incidents, routes) is sensitive
- TLS 1.3 in transit
- Encrypted at rest (database encryption, object storage encryption)
- Database backups encrypted

**Audit trail:**
- Every change logged to AuditLog table
- Who, what, when, source IP
- Retaining 2 years of logs (compliance)

### D. Deployment (CI/CD)

```
Developer commits to main
        ↓
GitHub Actions triggers
        ├─ Unit tests
        ├─ Integration tests
        ├─ Linting (pylint, flake8)
        ├─ Docker build
        ├─ Push to registry
        └─ Deploy to staging
        ↓
Manual smoke test (demo works?)
        ↓
If OK: Deploy to production (canary, 10% traffic)
        ↓
Monitor metrics for 10 mins
        ↓
If no errors: Roll out to 100%
        ↓
If errors: Automatic rollback
```

### E. Database

**Schema versioning:**
- Alembic (migration tool) for all schema changes
- Every change tracked in `alembic_versions/`
- Migrations are reversible

**Backups:**
- Daily full backup to S3 (encrypted)
- Point-in-time recovery for 7 days
- Read replica in standby for failover

**Indexing strategy:**
```sql
-- Most frequent queries
CREATE INDEX idx_incidents_status ON incidents(status);
CREATE INDEX idx_vehicles_location ON vehicles USING GIST(current_location);
CREATE INDEX idx_assignments_incident ON assignments(incident_id);
CREATE INDEX idx_assignments_vehicle ON assignments(vehicle_id);

-- Time-series queries
CREATE INDEX idx_audit_log_timestamp ON audit_log(timestamp DESC);
CREATE INDEX idx_predictions_created_at ON predictions(created_at DESC);
```

---

## Part 8: Scaling Considerations

### MVP (Hackathon)
- Single deployment
- 1 Core API instance
- 1 Prediction worker
- 1 Optimization worker
- 1 Postgres, 1 Redis
- Can handle ~100 incidents/day

### Production (Year 1)
- API behind load balancer (3 instances)
- 2-3 Prediction workers (ML inference is lightweight)
- 1-2 Optimization workers (CPU-bound, scale as needed)
- Postgres with read replicas
- Redis Cluster (HA)
- Separate monitoring stack
- ~1000 incidents/day

### Large scale (Year 3+)
- Kubernetes cluster
- Horizontal auto-scaling based on queue depth
- Model serving layer (separate from API)
- Time-series DB for metrics (InfluxDB/Prometheus remote storage)
- Spatial index optimization
- Multi-region deployment (if multi-state)

---

## Part 9: Technology Justification Table

| Component | Choice | Alternatives Considered | Why Not? |
|---|---|---|---|
| Backend | FastAPI | Django, Flask | Flask too minimal; Django overkill for this. FastAPI is async-native, auto-documents, Pydantic validation. |
| DB | PostgreSQL + PostGIS | MongoDB, Neo4j | PostGIS is the standard for spatial queries. MongoDB lacks geo indexing. Neo4j good for graphs, not geospatial. |
| Live state | Redis | Memcached, Cassandra | Memcached no pub/sub. Cassandra overkill. Redis pub/sub is perfect for broadcasting updates. |
| Queue | Celery + Redis | RabbitMQ, Kafka | RabbitMQ works but Redis simpler (already deployed). Kafka overkill for this throughput. |
| ML prediction | XGBoost | TensorFlow/PyTorch, LightGBM | TensorFlow overkill for tabular data. LightGBM is competitive but XGBoost more mature. XGBoost faster training. |
| Optimization | OR-Tools | PuLP, Gurobi | PuLP is Python wrapper but OR-Tools more optimized. Gurobi is commercial, not worth it for hackathon. |
| Frontend | React + MapLibre | Vue, Angular, MapBox | MapLibre is open-source (no API fees). React has largest ecosystem. |
| Monitoring | Prometheus + Grafana | DataDog, New Relic | DataDog/NR are SaaS, costly, vendor lock-in. Prometheus is free, open-source, industry standard. |
| Container | Docker | Podman | Docker ecosystem more mature, better tooling, more team familiarity. |
| CI/CD | GitHub Actions | GitLab CI, Jenkins | GitHub Actions free with repo, simple YAML. Jenkins overkill for this stage. |

---

## Part 10: MVP vs. Production Roadmap

### MVP (Hackathon Scope)
**What's built:**
- ✅ Vehicle management (CRUD)
- ✅ Incident creation & tracking
- ✅ Resource discovery (SQL + PostGIS query)
- ✅ Route optimization (OR-Tools)
- ✅ ETA prediction (basic XGBoost, trained on synthetic data)
- ✅ Recommendation generation
- ✅ Human approval workflow
- ✅ Basic analytics
- ✅ Audit logging
- ✅ Docker deployment
- ✅ GitHub Actions CI

**What's NOT in MVP:**
- Demand prediction (can add later)
- Congestion scoring (use dummy multiplier)
- Scenario simulation (marked for future)
- Multi-region deployment (single region)
- Kubernetes (use Docker Compose)
- Advanced security (basic JWT sufficient)

### Year 1 Production Roadmap
1. Real data integration (replace synthetic)
2. Congestion API integration
3. SMS/push notifications to vehicles
4. Mobile app for drivers
5. Advanced analytics dashboard
6. Scenario simulation UI
7. Multi-authority federation (multiple cities)

### Year 2+
- Demand prediction
- Autonomous assignment (reduce human approval, but with high confidence threshold)
- Route learning (feedback improves routes over time)
- Predictive resource pre-positioning
- Cross-department incident correlation

---

## Part 11: Key Files (For Team Reference)

```
nexus/
├── backend/
│   ├── app/
│   │   ├── main.py                 # FastAPI app setup
│   │   ├── models/                 # SQLAlchemy ORM
│   │   ├── schemas/                # Pydantic input/output
│   │   ├── routes/                 # API endpoints
│   │   │   ├── incidents.py
│   │   │   ├── vehicles.py
│   │   │   ├── predictions.py
│   │   │   ├── recommendations.py
│   │   │   └── analytics.py
│   │   ├── services/               # Business logic
│   │   │   ├── incident_service.py
│   │   │   ├── prediction_service.py
│   │   │   ├── optimization_service.py
│   │   │   └── recommendation_service.py
│   │   ├── ai/                     # ML models
│   │   │   ├── xgboost_eta.py
│   │   │   ├── demand_predictor.py
│   │   │   └── model_registry.py
│   │   ├── workers/                # Celery async jobs
│   │   │   ├── prediction_jobs.py
│   │   │   ├── optimization_jobs.py
│   │   │   └── retraining_jobs.py
│   │   ├── db/                     # Database
│   │   │   ├── database.py
│   │   │   ├── session.py
│   │   │   └── migrations/         # Alembic
│   │   └── utils/
│   │       ├── geo.py              # PostGIS helpers
│   │       ├── websocket.py        # WebSocket manager
│   │       └── auth.py             # JWT, roles
│   ├── tests/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── celery_config.py
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── IncidentMap.jsx
│   │   │   ├── VehicleList.jsx
│   │   │   ├── RecommendationCard.jsx
│   │   │   └── AnalyticsDashboard.jsx
│   │   ├── api/
│   │   │   └── client.js           # REST + WebSocket
│   │   └── App.jsx
│   └── package.json
├── deployment/
│   ├── docker-compose.yml          # Local dev + demo
│   ├── kubernetes/                 # Future: Helm charts
│   └── nginx.conf                  # API Gateway config
├── monitoring/
│   ├── prometheus.yml
│   ├── grafana-dashboards/
│   └── alerts.yml
└── README.md
```

---

## Summary

**NEXUS is a three-layer system:**
1. **Operational layer** — manages current state (fast, reliable, source of truth)
2. **Intelligence layer** — predicts future conditions (async, can fail gracefully)
3. **Decision layer** — optimizes and recommends (async, CPU-heavy, independent)

**Human is always in control.** The system recommends; the officer decides.

**Graceful degradation built in.** If ML fails, rules-based fallback keeps dispatch running.

**Observability from day one.** Prometheus + Grafana show you exactly what's happening.

**Scalable design.** Architecture supports growth from 100 incidents/day → 10,000+ without major redesign.

This is a **genuinely production-ready design**, not just buzzwords on a slide.
