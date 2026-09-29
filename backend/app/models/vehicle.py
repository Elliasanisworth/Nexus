import uuid
from datetime import datetime

from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, ARRAY
from geoalchemy2 import Geometry
from app.db.database import Base


def gen_uuid() -> str:
    return str(uuid.uuid4())


class VehicleType(Base):
    __tablename__ = "vehicle_types"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    name = Column(String, nullable=False)             # "Ambulance", "Fire Truck", "Rescue Van"
    capacity = Column(Integer, nullable=False)
    crew_needed = Column(Integer, nullable=False)
    specialization = Column(String, nullable=False)   # "medical", "fire", "flood_rescue"


class Vehicle(Base):
    __tablename__ = "vehicles"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    vehicle_code = Column(String, unique=True, nullable=False)   # e.g. "AMB-017"
    vehicle_type_id = Column(String(36), ForeignKey("vehicle_types.id"), nullable=False)
    current_location = Column(Geometry(geometry_type="POINT", srid=4326), nullable=False)
    status = Column(String, nullable=False, default="AVAILABLE")  # AVAILABLE | BUSY | OFFLINE
    assigned_to_incident_id = Column(String(36), ForeignKey("incidents.id"), nullable=True)
    last_gps_update = Column(DateTime, default=datetime.utcnow)
    capacity_used = Column(Integer, default=0)
    constraint_tags = Column(ARRAY(String), default=list)   # e.g. ["needs_2_crew", "no_highway"]
    created_at = Column(DateTime, default=datetime.utcnow)