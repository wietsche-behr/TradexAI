from fastapi import APIRouter, Depends, HTTPException

from . import auth, schemas
from .supabase_db import db

router = APIRouter()


@router.get("/bot", response_model=schemas.BotConfig)
def get_bot_config(current_user: dict = Depends(auth.get_current_user)):
    config = db.get_bot_config(current_user["id"])
    if not config:
        raise HTTPException(status_code=404, detail="Bot config not found")
    return config


@router.post("/bot", response_model=schemas.BotConfig)
def update_bot_config(
    config: schemas.BotConfigCreate,
    current_user: dict = Depends(auth.get_current_user),
):
    updated = db.upsert_bot_config(
        current_user["id"],
        config.strategy,
        config.risk_level,
        config.market,
        config.is_active,
        config.amount,
    )
    return updated

