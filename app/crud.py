from fastapi import HTTPException
from . import schemas
from .supabase_db import db


def create_trade(trade: schemas.TradeCreate, user_id: int):
    data = trade.dict()
    data["owner_id"] = user_id
    return db.create_trade(data)


def get_trade(trade_id: int):
    trade = db.get_trade(trade_id)
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")
    return trade


def get_trades(owner_id: int, skip: int = 0, limit: int = 100):
    return db.get_trades(owner_id, skip=skip, limit=limit)


def update_trade(trade_id: int, trade: schemas.TradeCreate):
    existing = get_trade(trade_id)
    data = trade.dict()
    return db.update_trade(trade_id, data)


def delete_trade(trade_id: int):
    existing = get_trade(trade_id)
    db.delete_trade(trade_id)
    return existing
