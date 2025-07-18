from fastapi import APIRouter, Depends, HTTPException

from .supabase_db import db
from . import schemas, auth

router = APIRouter()

@router.get("/settings", response_model=schemas.UserSettings)
def get_settings(current_user: dict = Depends(auth.get_current_user)):
    settings = db.get_user_settings(current_user["id"])
    if not settings:
        raise HTTPException(status_code=404, detail="Settings not found")
    return settings

@router.post("/settings", response_model=schemas.UserSettings)
def update_settings(
    settings: schemas.UserSettingsCreate,
    current_user: dict = Depends(auth.get_current_user),
):
    updated = db.upsert_user_settings(
        current_user["id"], settings.binance_api_key, settings.binance_api_secret
    )
    return updated
