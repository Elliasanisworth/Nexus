from datetime import datetime
from typing import Optional, Any

from pydantic import BaseModel

# IDs are plain strings (UUID text) so the same models work on SQLite (default,
# zero setup) and Postgres (later) without any code change.


# ---------- Ambulance ----------

class AmbulanceCreate(BaseModel):
    code: str
    lat: float
    lon: float
    status: Optional[str] = "available"


class AmbulanceUpdate(BaseModel):
    lat: Optional[float] = None
    lon: Optional[float] = None
    status: Optional[str] = None


class AmbulanceOut(BaseModel):
    id: str
    code: str
    lat: float
    lon: float
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


# ---------- Incident ----------

class IncidentCreate(BaseModel):
    type: str
    lat: float
    lon: float
    description: Optional[str] = None


class IncidentOut(BaseModel):
    id: str
    type: str
    lat: float
    lon: float
    description: Optional[str]
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


# ---------- Recommendation ----------

class RecommendationOut(BaseModel):
    id: str
    incident_id: str
    ambulance_id: str
    distance_m: float
    eta_seconds: float
    route_geometry: Optional[Any] = None
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class ModifyRequest(BaseModel):
    ambulance_id: str
