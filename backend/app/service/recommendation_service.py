"""
Core recommendation logic. No ML model, no solver — this is a direct pick by
lowest ETA among available ambulances. See BUILD_SPEC.md Section 6.
"""

from dataclasses import dataclass
from typing import Optional, Any

from sqlalchemy.orm import Session

from app import models
from app.service.osrm_client import osrm_route, haversine_distance_m, OSRMError

FALLBACK_AVG_SPEED_MPS = 40 * 1000 / 3600  # 40 km/h, used only when OSRM is unreachable


@dataclass
class Candidate:
    ambulance: models.Ambulance
    distance_m: float
    eta_seconds: float
    geometry: Optional[Any]


def get_recommendation(db: Session, incident: models.Incident) -> Optional[models.Recommendation]:
    available = (
        db.query(models.Ambulance)
        .filter(models.Ambulance.status == "available")
        .all()
    )
    if not available:
        return None  # caller returns "no ambulance available" to the frontend

    best: Optional[Candidate] = None

    for amb in available:
        try:
            result = osrm_route(amb.lat, amb.lon, incident.lat, incident.lon)
            distance = result.distance_m
            eta = result.duration_seconds
            geometry = result.geometry
        except OSRMError:
            # fallback: straight-line distance, rough ETA at 40km/h average
            distance = haversine_distance_m(amb.lat, amb.lon, incident.lat, incident.lon)
            eta = distance / FALLBACK_AVG_SPEED_MPS
            geometry = None

        if best is None or eta < best.eta_seconds:
            best = Candidate(ambulance=amb, distance_m=distance, eta_seconds=eta, geometry=geometry)

    recommendation = models.Recommendation(
        incident_id=incident.id,
        ambulance_id=best.ambulance.id,
        distance_m=best.distance_m,
        eta_seconds=best.eta_seconds,
        route_geometry=best.geometry,
        status="pending",
    )
    db.add(recommendation)
    db.commit()
    db.refresh(recommendation)
    return recommendation


def accept_recommendation(db: Session, recommendation: models.Recommendation) -> models.Assignment:
    recommendation.status = "accepted"
    ambulance = db.query(models.Ambulance).get(recommendation.ambulance_id)
    ambulance.status = "busy"

    assignment = models.Assignment(
        incident_id=recommendation.incident_id,
        ambulance_id=recommendation.ambulance_id,
        recommendation_id=recommendation.id,
    )
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return assignment


def modify_recommendation(db: Session, recommendation: models.Recommendation, new_ambulance_id: str) -> models.Assignment:
    recommendation.status = "modified"
    ambulance = db.query(models.Ambulance).get(new_ambulance_id)
    ambulance.status = "busy"

    assignment = models.Assignment(
        incident_id=recommendation.incident_id,
        ambulance_id=new_ambulance_id,
        recommendation_id=recommendation.id,
    )
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return assignment


def reject_recommendation(db: Session, recommendation: models.Recommendation) -> models.Recommendation:
    recommendation.status = "rejected"
    db.commit()
    db.refresh(recommendation)
    return recommendation
