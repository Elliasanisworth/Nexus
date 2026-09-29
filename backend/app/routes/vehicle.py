from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, cast
from geoalchemy2 import Geography
from geoalchemy2.shape import to_shape

from app.db.database import get_db
from app import models
from app.schemas import vehicle as schemas
from app.utils.auth import get_current_user, require_role
from app.utils.geo import point_wkt

router = APIRouter(prefix="/vehicles", tags=["vehicles"])


def _to_out(v: models.Vehicle) -> schemas.VehicleOut:
    point = to_shape(v.current_location)
    return schemas.VehicleOut(
        id=v.id, vehicle_code=v.vehicle_code, vehicle_type_id=v.vehicle_type_id,
        lat=point.y, lon=point.x, status=v.status,
        assigned_to_incident_id=v.assigned_to_incident_id, last_gps_update=v.last_gps_update,
        capacity_used=v.capacity_used, constraint_tags=v.constraint_tags or [], created_at=v.created_at,
    )


@router.post("", response_model=schemas.VehicleOut)
def create_vehicle(payload: schemas.VehicleCreate, db: Session = Depends(get_db),
                    user=Depends(require_role("ADMIN", "TRANSPORT_OFFICER"))):
    vehicle = models.Vehicle(
        vehicle_code=payload.vehicle_code,
        vehicle_type_id=payload.vehicle_type_id,
        current_location=point_wkt(payload.lat, payload.lon),
        status="AVAILABLE",
    )
    db.add(vehicle)
    db.commit()
    db.refresh(vehicle)
    return _to_out(vehicle)


@router.get("", response_model=list[schemas.VehicleOut])
def list_vehicles(status: str | None = None, db: Session = Depends(get_db), user=Depends(get_current_user)):
    q = db.query(models.Vehicle)
    if status:
        q = q.filter(models.Vehicle.status == status.upper())
    return [_to_out(v) for v in q.all()]


@router.get("/nearby", response_model=list[schemas.VehicleOut])
def nearby_vehicles(lat: float, lon: float, radius_km: float = 5,
                     db: Session = Depends(get_db), user=Depends(get_current_user)):
    origin = point_wkt(lat, lon)
    q = db.query(models.Vehicle).filter(
        func.ST_DWithin(cast(models.Vehicle.current_location, Geography), cast(origin, Geography), radius_km * 1000)
    )
    return [_to_out(v) for v in q.all()]


@router.get("/{vehicle_id}", response_model=schemas.VehicleOut)
def get_vehicle(vehicle_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    vehicle = db.get(models.Vehicle, vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return _to_out(vehicle)


@router.patch("/{vehicle_id}", response_model=schemas.VehicleOut)
def update_vehicle(vehicle_id: str, payload: schemas.VehicleUpdate, db: Session = Depends(get_db),
                    user=Depends(require_role("ADMIN", "TRANSPORT_OFFICER"))):
    vehicle = db.get(models.Vehicle, vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    data = payload.model_dump(exclude_unset=True)
    if "vehicle_code" in data:
        vehicle.vehicle_code = data["vehicle_code"]
    if "constraint_tags" in data:
        vehicle.constraint_tags = data["constraint_tags"]
    db.commit()
    db.refresh(vehicle)
    return _to_out(vehicle)


@router.put("/{vehicle_id}/location", response_model=schemas.VehicleOut)
def update_location(vehicle_id: str, payload: schemas.LocationUpdate, db: Session = Depends(get_db),
                     user=Depends(get_current_user)):
    # Called by the vehicle simulator (future) every few seconds.
    # SIMULATED GPS — see AGENT.md Section 1 Rule 5. Not real hardware.
    vehicle = db.get(models.Vehicle, vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    vehicle.current_location = point_wkt(payload.lat, payload.lon)
    vehicle.last_gps_update = datetime.utcnow()
    db.commit()
    db.refresh(vehicle)
    return _to_out(vehicle)


@router.put("/{vehicle_id}/status", response_model=schemas.VehicleOut)
def update_status(vehicle_id: str, payload: schemas.StatusUpdate, db: Session = Depends(get_db),
                   user=Depends(get_current_user)):
    vehicle = db.get(models.Vehicle, vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    vehicle.status = payload.status.upper()
    db.commit()
    db.refresh(vehicle)
    return _to_out(vehicle)