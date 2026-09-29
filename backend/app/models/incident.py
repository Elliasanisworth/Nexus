import uuid
from datetime import datetime

from sqlalchemy import Column, String, DateTime, ForeignKey, JSON
from geoalchemy2 import Geometry
from app.db.database import Base


def gen_uuid() -> str:
    return str(uuid.uuid4())


class Incident(Base):
    __tablename__ = "incidents"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    external_id = Column(String, nullable=True)             # future CAD system integration
    location = Column(Geometry(geometry_type="POINT", srid=4326), nullable=False)
    incident_type = Column(String, nullable=False)          # ACCIDENT | FIRE | FLOOD | MEDICAL | OTHER
    severity = Column(String, nullable=False, default="MEDIUM")  # LOW | MEDIUM | HIGH | CRITICAL
    status = Column(String, nullable=False, default="NEW")  # NEW | ASSIGNED | IN_PROGRESS | RESOLVED | CANCELLED
    required_resources = Column(JSON, nullable=True)        # e.g. [{"type": "Ambulance", "count": 1}]
    description = Column(String, nullable=True)
    reported_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)