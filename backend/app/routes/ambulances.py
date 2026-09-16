from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db

router = APIRouter(prefix="/ambulances", tags=["ambulances"])


@router.post("", response_model=schemas.AmbulanceOut)
def create_ambulance(payload: schemas.AmbulanceCreate, db: Session = Depends(get_db)):
    ambulance = models.Ambulance(**payload.model_dump())
    db.add(ambulance)
    db.commit()
    db.refresh(ambulance)
    return ambulance


@router.get("", response_model=list[schemas.AmbulanceOut])
def list_ambulances(db: Session = Depends(get_db)):
    return db.query(models.Ambulance).all()


@router.patch("/{ambulance_id}", response_model=schemas.AmbulanceOut)
def update_ambulance(ambulance_id: str, payload: schemas.AmbulanceUpdate, db: Session = Depends(get_db)):
    ambulance = db.query(models.Ambulance).get(ambulance_id)
    if not ambulance:
        raise HTTPException(status_code=404, detail="Ambulance not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(ambulance, field, value)

    db.commit()
    db.refresh(ambulance)
    return ambulance
