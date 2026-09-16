from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app import models  # noqa: F401 - needed so tables register on Base before create_all
from app.routes import ambulances, incidents, recommendation

Base.metadata.create_all(bind=engine)

app = FastAPI(title="NEXUS Prototype API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # prototype only - tighten before any real deployment
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ambulances.router)
app.include_router(incidents.router)
app.include_router(recommendation.router)


@app.get("/")
def root():
    return {"status": "ok"}
