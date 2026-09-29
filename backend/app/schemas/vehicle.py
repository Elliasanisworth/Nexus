from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class VehicleCreate(BaseModel):
    vehicle_code: str
    vehicle_type_id: str
    lat: float
    lon: float


class VehicleUpdate(BaseModel):
    vehicle_code: Optional[str] = None
    constraint_tags: Optional[list[str]] = None


class LocationUpdate(BaseModel):
    lat: float
    lon: float


class StatusUpdate(BaseModel):
    status: str  # AVAILABLE | BUSY | OFFLINE


class VehicleOut(BaseModel):
    id: str
    vehicle_code: str
    vehicle_type_id: str
    lat: float
    lon: float
    status: str
    assigned_to_incident_id: Optional[str] = None
    last_gps_update: Optional[datetime] = None
    capacity_used: int
    constraint_tags: list[str] = []
    created_at: datetime