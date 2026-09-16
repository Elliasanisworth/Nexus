from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.service import recommendation_service

router = APIRouter(prefix="/recommendation", tags=["recommendation"])


@router.get("/{incident_id}", response_model=schemas.RecommendationOut)
def generate_recommendation(incident_id: str, db: Session = Depends(get_db)):
    incident = db.query(models.Incident).get(incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    recommendation = recommendation_service.get_recommendation(db, incident)
    if recommendation is None:
        raise HTTPException(status_code=404, detail="No available ambulance found")

    return recommendation


@router.post("/{recommendation_id}/accept", response_model=schemas.RecommendationOut)
def accept(recommendation_id: str, db: Session = Depends(get_db)):
    recommendation = _get_recommendation_or_404(db, recommendation_id)
    recommendation_service.accept_recommendation(db, recommendation)
    return recommendation


@router.post("/{recommendation_id}/modify", response_model=schemas.RecommendationOut)
def modify(recommendation_id: str, payload: schemas.ModifyRequest, db: Session = Depends(get_db)):
    recommendation = _get_recommendation_or_404(db, recommendation_id)
    recommendation_service.modify_recommendation(db, recommendation, payload.ambulance_id)
    return recommendation


@router.post("/{recommendation_id}/reject", response_model=schemas.RecommendationOut)
def reject(recommendation_id: str, db: Session = Depends(get_db)):
    recommendation = _get_recommendation_or_404(db, recommendation_id)
    recommendation_service.reject_recommendation(db, recommendation)
    return recommendation


def _get_recommendation_or_404(db: Session, recommendation_id: str) -> models.Recommendation:
    recommendation = db.query(models.Recommendation).get(recommendation_id)
    if not recommendation:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    return recommendation
