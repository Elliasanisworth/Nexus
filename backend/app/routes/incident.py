from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from geoalchemy2.shape import to_shape

from app.db.database import get_db
from app import models
from app.schemas import incident as schemas
from app.utils.auth import get_current_user
from app.utils.geo import point_wkt

router = APIRouter(prefix="/incidents", tags=["incidents"])


def _to_out(i: models.Incident) -> schemas.IncidentOut:
    point = to_shape(i.location)
    return schemas.IncidentOut(
        id=i.id, external_id=i.external_id, lat=point.y, lon=point.x,
        incident_type=i.incident_type, severity=i.severity, status=i.status,
        required_resources=i.required_resources, description=i.description,
        reported_by=i.reported_by, created_at=i.created_at, resolved_at=i.resolved_at,
    )


@router.post("", response_model=schemas.IncidentOut)
def create_incident(payload: schemas.IncidentCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    incident = models.Incident(
        incident_type=payload.incident_type.upper(),
        severity=(payload.severity or "MEDIUM").upper(),
        location=point_wkt(payload.lat, payload.lon),
        required_resources=payload.required_resources,
        description=payload.description,
        reported_by=user.id,
        status="NEW",
    )
    db.add(incident)
    db.commit()
    db.refresh(incident)
    return _to_out(incident)


@router.get("", response_model=list[schemas.IncidentOut])
def list_incidents(status: str | None = None, severity: str | None = None,
                    db: Session = Depends(get_db), user=Depends(get_current_user)):
    q = db.query(models.Incident)
    if status:
        q = q.filter(models.Incident.status == status.upper())
    if severity:
        q = q.filter(models.Incident.severity == severity.upper())
    return [_to_out(i) for i in q.all()]


# Must be declared BEFORE /{incident_id} — otherwise FastAPI matches "active"
# as a path param value instead of this route.
@router.get("/active", response_model=list[schemas.IncidentOut])
def list_active_incidents(db: Session = Depends(get_db), user=Depends(get_current_user)):
    q = db.query(models.Incident).filter(models.Incident.status.in_(["NEW", "ASSIGNED", "IN_PROGRESS"]))
    return [_to_out(i) for i in q.all()]


@router.get("/{incident_id}", response_model=schemas.IncidentOut)
def get_incident(incident_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    incident = db.get(models.Incident, incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return _to_out(incident)


@router.patch("/{incident_id}", response_model=schemas.IncidentOut)
def update_incident(incident_id: str, payload: schemas.IncidentUpdate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    incident = db.get(models.Incident, incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    data = payload.model_dump(exclude_unset=True)
    if "description" in data:
        incident.description = data["description"]
    if "severity" in data:
        incident.severity = data["severity"].upper()
    if "required_resources" in data:
        incident.required_resources = data["required_resources"]
    db.commit()
    db.refresh(incident)
    return _to_out(incident)


@router.put("/{incident_id}/status", response_model=schemas.IncidentOut)
def update_incident_status(incident_id: str, payload: schemas.StatusUpdate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    incident = db.get(models.Incident, incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    incident.status = payload.status.upper()
    if incident.status == "RESOLVED":
        incident.resolved_at = datetime.utcnow()
    db.commit()
    db.refresh(incident)
    return _to_out(incident)