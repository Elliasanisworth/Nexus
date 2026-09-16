from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db

router = APIRouter(prefix="/incidents", tags=["incidents"])


@router.post("", response_model=schemas.IncidentOut)
def create_incident(payload: schemas.IncidentCreate, db: Session = Depends(get_db)):
    incident = models.Incident(**payload.model_dump())
    db.add(incident)
    db.commit()
    db.refresh(incident)
    return incident


@router.get("", response_model=list[schemas.IncidentOut])
def list_incidents(db: Session = Depends(get_db)):
    return db.query(models.Incident).all()
