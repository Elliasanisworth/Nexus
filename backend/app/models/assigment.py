import uuid
from datetime import datetime

from sqlalchemy import Column, String, DateTime, Float, Integer, ForeignKey
from app.db.database import Base


def gen_uuid() -> str:
    return str(uuid.uuid4())


class Assignment(Base):
    __tablename__ = "assignments"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    incident_id = Column(String(36), ForeignKey("incidents.id"), nullable=False)
    vehicle_id = Column(String(36), ForeignKey("vehicles.id"), nullable=False)
    assigned_by = Column(String(36), ForeignKey("users.id"), nullable=True)  # null if auto-fallback
    assignment_timestamp = Column(DateTime, default=datetime.utcnow)
    estimated_arrival = Column(DateTime, nullable=True)
    actual_arrival = Column(DateTime, nullable=True)
    actual_distance_driven_m = Column(Float, nullable=True)
    actual_time_taken_s = Column(Integer, nullable=True)
    status = Column(String, nullable=False, default="ASSIGNED")  # ASSIGNED | EN_ROUTE | ARRIVED | COMPLETED | CANCELLED