from datetime import datetime
from typing import Optional, Any

from pydantic import BaseModel


class IncidentCreate(BaseModel):
    lat: float
    lon: float
    incident_type: str  # ACCIDENT | FIRE | FLOOD | MEDICAL | OTHER
    severity: Optional[str] = "MEDIUM"  # LOW | MEDIUM | HIGH | CRITICAL
    required_resources: Optional[Any] = None
    description: Optional[str] = None


class IncidentUpdate(BaseModel):
    severity: Optional[str] = None
    description: Optional[str] = None
    required_resources: Optional[Any] = None


class StatusUpdate(BaseModel):
    status: str  # NEW | ASSIGNED | IN_PROGRESS | RESOLVED | CANCELLED


class IncidentOut(BaseModel):
    id: str
    external_id: Optional[str] = None
    lat: float
    lon: float
    incident_type: str
    severity: str
    status: str
    required_resources: Optional[Any] = None
    description: Optional[str] = None
    reported_by: Optional[str] = None
    created_at: datetime
    resolved_at: Optional[datetime] = None