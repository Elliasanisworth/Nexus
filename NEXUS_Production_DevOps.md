# NEXUS: Production-Level Deployment & Operations
## Turning a Hackathon Project into a Real System

---

## Part 1: The Deployment Pipeline

### Local Development
```
Developer writes code
        ↓
    git push
        ↓
GitHub Actions triggers automatically
├─ Run all tests (unit + integration)
├─ Lint code (pylint, flake8)
├─ Build Docker images
├─ Tag with git commit hash
└─ Push to container registry

Developer sees results in PR
        ↓
If all pass: approve & merge to main
```

### Staging Environment
```
After merge to main:
        ├─ Auto-deploy to staging server
        ├─ Run smoke tests
        ├─ Run integration tests against real DB
        └─ Load test (simulate 1000 requests/min)

Team QA tests the feature manually
        └─ If OK: approve for production
```

### Production Deployment
```
Approval given
        ↓
Canary deployment (10% of traffic)
        ├─ Monitor error rate, latency, CPU
        ├─ Wait 10 minutes
        └─ If healthy: roll out to 100%

If errors detected:
        └─ Automatic rollback to previous version
```

---

## Part 2: Infrastructure (Docker + Compose vs Kubernetes)

### What We Use: Docker Compose (for hackathon)
```yaml
version: '3.9'
services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - api

  api:
    build: ./backend
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/nexus
      - REDIS_URL=redis://redis:6379
      - CELERY_BROKER_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
    ports:
      - "8000:8000"

  prediction_worker:
    build: ./backend
    command: celery -A app.workers.prediction_jobs worker -l info
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/nexus
      - REDIS_URL=redis://redis:6379

  optimization_worker:
    build: ./backend
    command: celery -A app.workers.optimization_jobs worker -l info
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/nexus
      - REDIS_URL=redis://redis:6379

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=nexus
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  prometheus:
    image: prom/prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    ports:
      - "3001:3000"
    depends_on:
      - prometheus

volumes:
  postgres_data:
```

**Why Docker Compose for MVP?**
- Simple to understand
- Works locally and on small servers
- No need for Kubernetes complexity
- Can demo quickly at hackathon

**Why NOT Kubernetes yet?**
- Adds 2-3 weeks of setup/configuration
- Overkill for project this size
- Team learns Docker first, K8s later
- Better to get the app working first

### Production Path (Year 1+)

If traffic grows and we need to scale:

```yaml
# Instead of docker-compose.yml, migrate to Helm chart:

apiVersion: apps/v1
kind: Deployment
metadata:
  name: nexus-api
spec:
  replicas: 3  # Auto-scale based on load
  template:
    spec:
      containers:
      - name: api
        image: nexus/api:v1.2.3
        resources:
          requests:
            cpu: "500m"
            memory: "512Mi"
          limits:
            cpu: "1000m"
            memory: "1Gi"
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 10
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /readiness
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 5
```

---

## Part 3: Monitoring & Observability

### What We Monitor

**Infrastructure metrics:**
```
CPU usage per service
Memory usage per service
Disk space
Network I/O
Database connections
Redis memory
```

**Application metrics:**
```
HTTP request latency (by endpoint)
Error rate (4xx, 5xx)
Active WebSocket connections
Message queue depth (jobs waiting)
Database query time
Model inference time
Optimization solver time
```

**Business metrics:**
```
Incidents created per minute
Average dispatch time
Fleet utilization %
Prediction accuracy (MAE)
Officer approval rate
System availability %
```

### Prometheus Config
```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'nexus-api'
    static_configs:
      - targets: ['localhost:8000']
    metrics_path: '/metrics'

  - job_name: 'postgres'
    static_configs:
      - targets: ['localhost:9187']

  - job_name: 'redis'
    static_configs:
      - targets: ['localhost:9121']

  - job_name: 'node'  # System metrics
    static_configs:
      - targets: ['localhost:9100']

alerting:
  alertmanagers:
    - static_configs:
        - targets: ['localhost:9093']

rule_files:
  - 'alerts.yml'
```

### Grafana Dashboards

**Dashboard 1: System Health**
- Request latency (p50, p95, p99)
- Error rate
- CPU & memory
- Active connections

**Dashboard 2: Incident Processing**
- Incidents received per minute
- Average time from incident → dispatch
- Queue depth (how many jobs waiting)
- Worker availability

**Dashboard 3: ML Model Performance**
- ETA prediction accuracy (MAE)
- Prediction latency
- Model version active
- Last retraining time

**Dashboard 4: Business Metrics**
- Fleet utilization trend
- Officer approval rate
- Incident resolution time
- System uptime

---

## Part 4: Backup & Disaster Recovery

### Database Backups

```bash
# Daily full backup (cronjob)
0 2 * * * /opt/nexus/backup_db.sh

# backup_db.sh:
#!/bin/bash
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="nexus_backup_${BACKUP_DATE}.sql.gz"

pg_dump -h localhost -U nexus_user nexus_db | \
  gzip > /backups/local/${BACKUP_FILE}

# Upload to S3 (encrypted)
aws s3 cp /backups/local/${BACKUP_FILE} \
  s3://nexus-backups/daily/${BACKUP_FILE} \
  --sse AES256

# Keep only last 30 days locally
find /backups/local -name "*.sql.gz" -mtime +30 -delete
```

### Point-in-Time Recovery

```
If database corrupts at 3 PM:

1. Restore backup from 2 AM
   pg_restore /backups/nexus_backup_20240115_020000.sql.gz

2. Use WAL logs to replay changes up to 2:59 PM
   (PostgreSQL keeps transaction logs)

3. Data loss: minimum (< 1 hour)
```

### Read Replica

```
For high availability:

Primary DB (production writes)
        ↓ (replicates changes)
Read Replica (standby)

If primary fails:
- DNS automatically switches to replica
- Replica promoted to primary
- Failover time: < 1 minute
```

---

## Part 5: Security in Production

### Network Security

```
Internet
   ↓
API Gateway (Nginx) — only exposed service
   ├─ Enforces HTTPS/TLS 1.3
   ├─ Rate limiting (100 req/min per IP)
   ├─ DDoS protection
   └─ Request validation

   ↓
Internal Network (isolated)
   ├─ API service
   ├─ Workers
   ├─ Database
   └─ Redis
   
   (Nothing here talks directly to internet)
```

### Authentication (JWT)

```
Login:
POST /auth/login
Body: { email, password }
Response: { access_token, refresh_token, expires_in }

access_token = JWT signed with server secret
Expires in 8 hours

Use token in all requests:
Authorization: Bearer <token>

If token expires:
POST /auth/refresh
Body: { refresh_token }
Returns: { new_access_token }
```

### Authorization (RBAC)

```
Roles:
  ADMIN
    └─ Create/delete users, view audit logs, system config
  
  TRANSPORT_OFFICER
    └─ Create incidents, approve recommendations, view routes
  
  INCIDENT_OPERATOR
    └─ Report incidents, view live status
  
  ANALYST
    └─ View analytics, cannot approve/modify
```

### Data Encryption

```
In Transit:
  ├─ TLS 1.3 (all network traffic)
  └─ Encrypted for each endpoint

At Rest:
  ├─ Database: Transparent encryption (enabled in Postgres)
  ├─ S3 backups: AES-256 encryption
  └─ Secrets: Encrypted in GitHub Actions vault
```

### Secrets Management

```
Sensitive values (API keys, passwords):
  ├─ NEVER stored in code
  ├─ NEVER committed to git
  ├─ Stored in GitHub Secrets vault (encrypted)
  ├─ Injected at runtime via environment variables
  └─ Rotated every 90 days
```

---

## Part 6: Logging & Audit Trail

### Structured Logging

```python
import json
import logging

# Every log entry is JSON (machine-readable)
logger = logging.getLogger(__name__)

logger.info(
    json.dumps({
        "event": "incident_created",
        "incident_id": "INC-1024",
        "created_by": "officer_123",
        "location": [12.34, 56.78],
        "severity": "critical",
        "timestamp": "2024-01-15T14:30:00Z",
        "request_id": "req-abc123"  # For tracing
    })
)
```

### Log Aggregation

```
All services → Fluent-Bit → ELK Stack (Elasticsearch, Logstash, Kibana)

Query example:
  "Find all incidents where ETA prediction was wrong by > 5 minutes"
  
  POST /elasticsearch/incidents/_search
  {
    "query": {
      "range": {
        "prediction_error": { "gte": 300 }  # 5 minutes in seconds
      }
    }
  }
```

### Audit Trail (AuditLog table)

```
Every "decision" action is logged:
  ├─ Incident created
  ├─ Officer approved recommendation
  ├─ Officer modified recommendation
  ├─ Vehicle status changed
  ├─ User role changed
  └─ System parameter updated

Query: "Show me all decisions made by Officer Bob in January"
Result: timestamped list with who/what/when
```

---

## Part 7: Health Checks & Alerting

### Readiness Probe (for load balancer)

```python
# GET /readiness
@app.get("/readiness")
def readiness():
    checks = {
        "database": check_db(),
        "redis": check_redis(),
        "prediction_worker": check_worker_alive("prediction"),
        "optimization_worker": check_worker_alive("optimization"),
    }
    
    if all(checks.values()):
        return {"status": "ready"}, 200
    else:
        return {"status": "not_ready", "details": checks}, 503
```

### Liveness Probe (for Kubernetes, if we use it)

```python
# GET /health
@app.get("/health")
def health():
    # Simple check: is the process alive?
    return {"status": "alive"}, 200
```

### Alerting Rules

```yaml
# alerts.yml
groups:
  - name: nexus_alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_errors_total[5m]) > 0.05
        for: 5m
        annotations:
          summary: "Error rate above 5% for 5 minutes"
          action: "Check logs, investigate recent deployment"

      - alert: QueueTooLarge
        expr: celery_queue_depth > 1000
        for: 10m
        annotations:
          summary: "Optimization jobs piling up"
          action: "Scale optimization workers"

      - alert: PredictionModelStale
        expr: time() - model_last_retrain_time > 86400 * 7
        for: 1h
        annotations:
          summary: "Model hasn't been retrained in 7 days"
          action: "Check retraining job"

      - alert: DatabaseDown
        expr: pg_up == 0
        for: 1m
        annotations:
          summary: "Database is unreachable"
          action: "URGENT: Failover to read replica"
```

---

## Part 8: Load Testing (Before Production)

### Test Scenario
```
Simulate peak load:
  - 100 incidents/minute
  - Each generates 3 jobs (predict, optimize)
  - 300+ concurrent WebSocket connections
  
Use Apache JMeter or Locust:

from locust import HttpUser, task, between

class DispatchUser(HttpUser):
    wait_time = between(1, 5)
    
    @task
    def create_incident(self):
        self.client.post("/incidents", json={
            "location": [12.34, 56.78],
            "type": "accident",
            "severity": 3
        })
    
    @task(2)
    def get_recommendations(self):
        self.client.get(f"/incidents/{self.incident_id}/recommendations")
```

### Results to Track
```
✓ Latency (p95 < 500ms, p99 < 1s)
✓ Throughput (at least 100 req/sec)
✓ Error rate (< 0.1%)
✓ Queue depth (< 5000 jobs)
✓ Database connection pool (< 90% used)
✓ Memory (< 80% of limit)
```

---

## Part 9: Release Process

### Version Numbering
```
v1.2.3

1 = Major version (major features or breaking changes)
2 = Minor version (new features, backwards compatible)
3 = Patch version (bug fixes only)
```

### Release Checklist
```
□ All tests pass
□ Load test passes
□ Security scan passes (no high-severity vulns)
□ Documentation updated
□ Changelog written
□ Staging environment tested manually
□ Database migrations reviewed
□ Backup created before deployment
□ Team notified of deployment time
□ Rollback plan documented
```

### Rollback Procedure
```
If production breaks:

1. Alert team immediately
2. Identify issue (logs, metrics)
3. Decision: rollback or fix forward?
4. If rollback:
   git log --oneline (find last known good)
   git checkout <commit>
   docker build + push
   kubectl rollout undo deployment/nexus-api
5. Verify system healthy
6. Post-incident review (what went wrong?)
```

---

## Part 10: Operations Runbooks

### Incident: High Error Rate

```
Symptoms: Grafana shows error_rate > 5% for 5+ minutes

Diagnosis:
1. ssh into production
2. tail -f /var/log/nexus/app.log | grep ERROR
3. Check if it's:
   - Database errors → check DB status
   - Model errors → check prediction service logs
   - Authorization errors → check JWT secret
   
Action:
  If database is down → trigger failover
  If model errors → kill prediction workers (API will degrade gracefully)
  If JWT issue → restart API service
```

### Incident: Slow Optimization Service

```
Symptoms: Optimization taking > 10 seconds (should be < 2s)

Diagnosis:
1. Check queue depth: redis-cli LLEN celery
2. Check optimization worker CPU: top -p $(pgrep -f optimization)
3. Check active jobs: celery -A app.workers.optimization_jobs inspect active

Action:
  If queue depth high:
    → Spin up 2 more optimization workers
    → Monitor queue depth drop
    → Check if error rate increases (might be bad jobs causing hang)
  
  If single job is slow:
    → Check job parameters (very large incident count?)
    → May need to add constraint (max solve time 5 sec, return best found so far)
```

### Incident: Database Disk Full

```
Symptoms: Insert queries start failing

Diagnosis:
1. df -h (check disk usage)
2. SELECT pg_database.datname, pg_size_pretty(pg_database_size(pg_database.datname))
   FROM pg_database ORDER BY pg_database_size DESC;
3. Find what table is huge: SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
   FROM pg_tables ORDER BY pg_total_relation_size DESC;

Action:
  If old logs: TRUNCATE incident_logs WHERE created_at < '2024-01-01';
  If audit logs: VACUUM ANALYZE;
  Increase volume size on cloud provider
  Set up age-based retention: DELETE WHERE created_at < NOW() - INTERVAL '1 year';
```

---

## Part 11: Performance Tuning

### Database Indexes

```sql
-- Most critical queries
CREATE INDEX idx_incidents_status ON incidents(status);
CREATE INDEX idx_vehicles_status ON vehicles(status);
CREATE INDEX idx_assignments_incident ON assignments(incident_id);
CREATE INDEX idx_geo_location ON vehicles USING GIST(current_location);

-- Time-series queries
CREATE INDEX idx_predictions_created ON predictions(created_at DESC);
CREATE INDEX idx_audit_log_timestamp ON audit_log(timestamp DESC);

-- Analyze query plans
EXPLAIN ANALYZE SELECT * FROM vehicles WHERE current_location <-> point '(12.34, 56.78)' ORDER BY current_location <-> point '(12.34, 56.78)' LIMIT 5;
```

### Redis Optimization

```
# Monitor memory usage
INFO memory

# If too high, reduce cache TTL:
EXPIRE incident_cache_key 600  # 10 minutes instead of 1 hour

# Monitor pub/sub subscribers:
PUBSUB CHANNELS  # How many channels active?
PUBSUB NUMSUB nexus_incidents  # How many listening?
```

### Model Optimization

```python
# XGBoost prediction is slow?
# Profile it:

import cProfile
import pstats

profiler = cProfile.Profile()
profiler.enable()

predictions = model.predict(X_test)

profiler.disable()
stats = pstats.Stats(profiler)
stats.sort_stats('cumulative')
stats.print_stats(10)  # Top 10 slow functions
```

---

## Summary: From MVP to Production

| Aspect | MVP (Hackathon) | Production (Year 1) |
|---|---|---|
| Deployment | docker-compose | Kubernetes + Helm |
| Database | Single Postgres | Postgres + read replicas |
| Monitoring | Basic Prometheus | Full ELK + alerting |
| Backups | Manual (before demo) | Automated daily + S3 |
| Security | Basic HTTPS | TLS 1.3 + encryption + RBAC |
| Logging | Console logs | Structured JSON + aggregation |
| Health checks | Manual testing | Automated probes |
| Scaling | Manual (add services) | Auto-scaling based on load |
| Incident response | Slack notifications | PagerDuty on-call |

**The key principle:** Production doesn't mean perfect; it means **observable, recoverable, and resilient**.

If something breaks, you know immediately (monitoring), you can understand why (logging), and you can recover quickly (backups, rollback).

That's what separates a hackathon project from a real system.
