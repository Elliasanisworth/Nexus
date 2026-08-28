# CONTEXT.md — NEXUS Technical Reference
> Detailed spec to prevent hallucination. When building any piece, check here for exact field names, types, and contracts before inventing your own.

---

## 1. Data Model — Full Field Reference

### User
```
id: UUID (PK)
email: str, unique
name: str
role: enum [ADMIN, TRANSPORT_OFFICER, INCIDENT_OPERATOR, ANALYST]
department: str
phone: str
password_hash: str
created_at: datetime
last_login: datetime
```

### VehicleType
```
id: UUID (PK)
name: str            # e.g. "Ambulance", "Fire Truck", "Rescue Van"
capacity: int
crew_needed: int
specialization: str  # e.g. "medical", "fire", "flood_rescue"
```

### Vehicle
```
id: UUID (PK)
vehicle_code: str, unique     # e.g. "AMB-017"
vehicle_type_id: FK -> VehicleType
current_location: geometry(Point, 4326)   # PostGIS
status: enum [AVAILABLE, BUSY, OFFLINE]
assigned_to_incident_id: FK -> Incident, nullable
last_gps_update: datetime
capacity_used: int
constraint_tags: str[]        # e.g. ["needs_2_crew", "no_highway"]
created_at: datetime
```

### Incident
```
id: UUID (PK)
external_id: str, nullable       # for future CAD system integration
location: geometry(Point, 4326)
incident_type: enum [ACCIDENT, FIRE, FLOOD, MEDICAL, OTHER]
severity: enum [LOW, MEDIUM, HIGH, CRITICAL]
status: enum [NEW, ASSIGNED, IN_PROGRESS, RESOLVED, CANCELLED]
required_resources: jsonb        # e.g. [{"type": "Ambulance", "count": 1}]
description: text
reported_by: FK -> User
created_at: datetime
resolved_at: datetime, nullable
```

### Assignment
```
id: UUID (PK)
incident_id: FK -> Incident
vehicle_id: FK -> Vehicle
assigned_by: FK -> User, nullable   # null if auto-fallback assigned
assignment_timestamp: datetime
estimated_arrival: datetime
actual_arrival: datetime, nullable
actual_distance_driven_m: float, nullable
actual_time_taken_s: int, nullable
status: enum [ASSIGNED, EN_ROUTE, ARRIVED, COMPLETED, CANCELLED]
```

### Route
```
id: UUID (PK)
assignment_id: FK -> Assignment
vehicle_id: FK -> Vehicle
waypoints: geometry(LineString, 4326)
distance_m: float
predicted_eta_s: int
actual_eta_s: int, nullable
generated_by: enum [OPTIMIZER, FALLBACK_RULE]
traffic_factor_applied: float
created_at: datetime
```

### Recommendation
```
id: UUID (PK)
incident_id: FK -> Incident
recommended_vehicle_id: FK -> Vehicle
recommended_route_id: FK -> Route
confidence_score: float (0-100)
reasoning: jsonb          # e.g. {"factors": ["nearest_suitable", "lowest_eta"]}
alternatives: jsonb       # list of alt {vehicle_id, route_id, eta}
generated_by: enum [AI_PIPELINE, FALLBACK_RULE]   # IMPORTANT: always set this
status: enum [PENDING, APPROVED, MODIFIED, REJECTED]
approved_by: FK -> User, nullable
approval_timestamp: datetime, nullable
created_at: datetime
```

### Prediction
```
id: UUID (PK)
prediction_type: enum [ETA, SEVERITY]     # demand/congestion are OUT OF SCOPE for MVP
subject_id: UUID          # vehicle_id or route_id depending on type
predicted_value: float
confidence: float
inputs_used: jsonb
model_version: str
created_at: datetime
actual_value: float, nullable      # filled in after outcome known
prediction_error: float, nullable  # calculated post-hoc
```

### AuditLog
```
id: UUID (PK)
event_type: str          # e.g. "INCIDENT_CREATED", "RECOMMENDATION_APPROVED"
entity_type: str
entity_id: UUID
actor: FK -> User
changes: jsonb
timestamp: datetime
source_ip: str
```

---

## 2. API Contract — Exact Routes

Base URL prefix: `/api/v1`

### Auth
```
POST /auth/login          {email, password} -> {access_token, refresh_token, expires_in}
POST /auth/refresh        {refresh_token} -> {access_token}
GET  /health               -> {status: "alive"}
GET  /readiness            -> {status, details: {database, redis, workers}}
```

### Vehicles
```
POST   /vehicles                  {vehicle_code, vehicle_type_id, current_location}
GET    /vehicles                  ?status=&type=
GET    /vehicles/{id}
PATCH  /vehicles/{id}
PUT    /vehicles/{id}/location    {lat, lon}          # called by simulator every N seconds
PUT    /vehicles/{id}/status      {status}
GET    /vehicles/nearby           ?lat=&lon=&radius_km=&type=
```

### Incidents
```
POST   /incidents                 {location, incident_type, severity, required_resources, description}
GET    /incidents                 ?status=&severity=
GET    /incidents/{id}
PATCH  /incidents/{id}
PUT    /incidents/{id}/status     {status}
GET    /incidents/active
```

### Predictions (Prediction Service)
```
POST /predict/eta   {vehicle_id, origin, destination} -> {eta_seconds, confidence, model_version}
```
> NOTE: severity prediction endpoint exists but MVP can hardcode from user input if time is short — flag this as a shortcut in code comments, don't silently skip it.

### Optimization (Optimization Service)
```
POST /optimize/find-resources  {incident_id} -> {candidates: [{vehicle_id, distance_m, eta_s, suitability_score}]}
POST /optimize/route           {vehicle_id, origin, destination} -> {route, distance_m, eta_s, alternatives: []}
POST /optimize/assign          {incident_id, candidate_vehicle_ids[]} -> {assignment, reason}
```

### Recommendations
```
POST /recommendations/generate         {incident_id} -> Recommendation object (status=PENDING)
GET  /recommendations/{id}
PUT  /recommendations/{id}/approve     {approved_by}
PUT  /recommendations/{id}/reject      {rejected_by, reason}
PUT  /recommendations/{id}/modify      {new_vehicle_id?, new_route_id?, notes}
```

### Analytics
```
GET /analytics/response-time            ?start=&end=
GET /analytics/fleet-utilization        ?start=&end=
GET /analytics/prediction-accuracy      ?days=30
```

### WebSocket
```
WS /ws/incidents          -> {incident_created, incident_updated}
WS /ws/vehicles           -> {vehicle_location_updated, vehicle_status_changed}
WS /ws/recommendations    -> {recommendation_generated, recommendation_updated}
```

---

## 3. Algorithm Specs

### ETA Prediction (XGBoost)
**Features (exact list — don't add/remove without updating this file):**
```
distance_m: float
hour_of_day: int (0-23)
day_of_week: int (0-6)
road_type: categorical [highway, arterial, local]
vehicle_type: categorical
historical_avg_eta_same_route: float (0 if none)
traffic_factor: float (1.0 default if no data)
```
**Target:** `actual_time_taken_s`
**Retrain trigger:** nightly cron, only if ≥ 20 new resolved incidents since last train (avoid overfitting on tiny batches)

### Optimization (OR-Tools)
**Problem type:** Assignment problem (not full VRP for MVP — keep it simple: 1 incident → 1 best vehicle, not multi-stop routing)
**Constraints:**
```
- vehicle.status == AVAILABLE
- vehicle_type.specialization matches incident requirement
- vehicle.capacity >= incident required capacity
```
**Objective:** minimize (distance × severity_weight), where severity_weight = {LOW:1, MEDIUM:1.5, HIGH:2, CRITICAL:3}

### Fallback Rule (when AI pipeline fails)
```python
# Exact fallback logic — implement this FIRST, before the AI paths
def fallback_assign(incident):
    candidates = [v for v in vehicles 
                  if v.status == "AVAILABLE" 
                  and v.vehicle_type.specialization matches incident.type]
    if not candidates:
        return None  # surface "no available resource" to dispatcher, don't crash
    nearest = min(candidates, key=lambda v: distance(v.location, incident.location))
    return nearest
```

---

## 4. Synthetic Data Generation Spec

### Vehicle Simulator (`scripts/vehicle_simulator.py`)
```
- Spawns N vehicles at random points within city bounding box
- Every 5 seconds, if vehicle has an active route:
    move it along route waypoints proportional to elapsed time
    PUT /vehicles/{id}/location
- If no active route: stay stationary (or slow random walk within a small radius)
- MUST log clearly: "[SIMULATED GPS]" prefix in all output
```

### Incident Generator (`scripts/incident_generator.py`)
```
- Generates incidents at intervals following a Poisson-ish distribution
  weighted higher during "rush hours" (configurable, e.g. 8-10am, 5-8pm)
- Locations weighted toward denser areas of the bounding box (not uniform random)
- incident_type and severity drawn from a configurable probability table
- MUST log clearly: "[SYNTHETIC DATA]" prefix in all output
```

---

## 5. Environment Variables (keep consistent across all modules)

```
DATABASE_URL=postgresql://user:pass@postgres:5432/nexus
REDIS_URL=redis://redis:6379
CELERY_BROKER_URL=redis://redis:6379
JWT_SECRET=<never hardcode, load from env/secret store>
JWT_EXPIRY_HOURS=8
MODEL_STORAGE_PATH=/app/models
SIMULATION_MODE=true          # always true for MVP — gate any "real GPS" code behind this being false
```

---

## 6. Naming Conventions (keep consistent)

- Python: `snake_case` for functions/variables, `PascalCase` for classes
- API routes: plural nouns, kebab-case where multi-word (`/find-resources`)
- Database tables: plural snake_case (`vehicles`, `audit_logs`)
- React components: `PascalCase.jsx`
- Branch naming: `feature/<module-name>`, e.g. `feature/vehicle-crud`
