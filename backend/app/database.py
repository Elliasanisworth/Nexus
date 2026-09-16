import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Default = SQLite, a single file, zero setup — good enough for the prototype demo.
# To use real Postgres later, just set DATABASE_URL and nothing else in this file changes.
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./nexus.db")

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
