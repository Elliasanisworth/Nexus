from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.db.database import Base, engine, SessionLocal
from app import models  # noqa: F401 - registers models on Base before create_all
from app.routes import auth, vehicles, incidents

Base.metadata.create_all(bind=engine)

app = FastAPI(title="NEXUS API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten before any real deployment
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(vehicles.router)
app.include_router(incidents.router)


@app.get("/health")
def health():
    return {"status": "alive"}


@app.get("/readiness")
def readiness():
    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
        return {"status": "ready", "details": {"database": "ok"}}
    except Exception as e:
        return {"status": "not_ready", "details": {"database": f"error: {e}"}}