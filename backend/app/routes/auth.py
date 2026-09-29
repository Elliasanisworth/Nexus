from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db
from app import models
from app.schemas import user as schemas
from app.utils.auth import verify_password, create_access_token, create_refresh_token, decode_token, JWT_EXPIRY_HOURS

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=schemas.TokenResponse)
def login(payload: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user.last_login = datetime.utcnow()
    db.commit()

    return schemas.TokenResponse(
        access_token=create_access_token(user.id, user.role),
        refresh_token=create_refresh_token(user.id),
        expires_in=JWT_EXPIRY_HOURS * 3600,
    )


@router.post("/refresh", response_model=schemas.RefreshResponse)
def refresh(payload: schemas.RefreshRequest, db: Session = Depends(get_db)):
    data = decode_token(payload.refresh_token)
    if data.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Not a refresh token")

    user = db.get(models.User, data.get("sub"))
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return schemas.RefreshResponse(access_token=create_access_token(user.id, user.role))