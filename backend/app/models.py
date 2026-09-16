import uuid
from datetime import datetime

from sqlalchemy import Column, String, Float, DateTime, ForeignKey, JSON

from app.database import Base


def gen_uuid() -> str:
    return str(uuid.uuid4())


class Ambulance(Base):
    __tablename__ = "ambulances"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    code = Column(String, nullable=False)  # e.g. "A-01"
    lat = Column(Float, nullable=False)
    lon = Column(Float, nullable=False)
    status = Column(String, nullable=False, default="available")  # available | busy | offline
    created_at = Column(DateTime, default=datetime.utcnow)


class Incident(Base):
    __tablename__ = "incidents"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    type = Column(String, nullable=False)  # accident | fire | medical | other
    lat = Column(Float, nullable=False)
    lon = Column(Float, nullable=False)
    description = Column(String, nullable=True)
    status = Column(String, nullable=False, default="active")  # active | resolved
    created_at = Column(DateTime, default=datetime.utcnow)


class Recommendation(Base):
    __tablename__ = "recommendations"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    incident_id = Column(String(36), ForeignKey("incidents.id"), nullable=False)
    ambulance_id = Column(String(36), ForeignKey("ambulances.id"), nullable=False)
    distance_m = Column(Float, nullable=False)
    eta_seconds = Column(Float, nullable=False)
    route_geometry = Column(JSON, nullable=True)  # GeoJSON line from OSRM, or null if fallback
    status = Column(String, nullable=False, default="pending")  # pending | accepted | modified | rejected
    created_at = Column(DateTime, default=datetime.utcnow)


class Assignment(Base):
    __tablename__ = "assignments"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    incident_id = Column(String(36), ForeignKey("incidents.id"), nullable=False)
    ambulance_id = Column(String(36), ForeignKey("ambulances.id"), nullable=False)
    recommendation_id = Column(String(36), ForeignKey("recommendations.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
