from fastapi import HTTPException
from . import schemas
from .supabase_db import db
from .dashboard import _compute_metrics


def create_trade(trade: schemas.TradeCreate, user_id: int):
    data = trade.dict()
    if "side" in data:
        data["side"] = data["side"].lower()
    data["owner_id"] = user_id
    new_trade = db.create_trade(data)
    try:
        # recompute user's total profit whenever a new trade is recorded
        trades = db.get_trades(user_id, skip=0, limit=1000) or []
        _compute_metrics(user_id, trades)
    except Exception:
        pass
    return new_trade


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
    if "side" in data:
        data["side"] = data["side"].lower()
    updated = db.update_trade(trade_id, data)
    try:
        # update cached metrics after trade modifications
        trades = db.get_trades(existing["owner_id"], skip=0, limit=1000) or []
        _compute_metrics(existing["owner_id"], trades)
    except Exception:
        pass
    return updated


def delete_trade(trade_id: int):
    existing = get_trade(trade_id)
    db.delete_trade(trade_id)
    try:
        trades = db.get_trades(existing["owner_id"], skip=0, limit=1000) or []
        _compute_metrics(existing["owner_id"], trades)
    except Exception:
        pass
    return existing


def create_completed_trade(trade_data: schemas.CompletedTradeCreate, user_id: int):
    """
    Inserts a new record into the completed_trades table and calculates profit.
    """
    try:
        # Calculate profit before insertion, including commissions
        profit = (trade_data.exit_price - trade_data.entry_price) * trade_data.quantity
        if trade_data.commission_entry is not None:
            profit -= trade_data.commission_entry
        if trade_data.commission_exit is not None:
            profit -= trade_data.commission_exit

        response = db.table("completed_trades").insert({
            "user_id": user_id,
            "strategy_id": trade_data.strategy_id,
            "symbol": trade_data.symbol,
            "entry_price": trade_data.entry_price,
            "exit_price": trade_data.exit_price,
            "quantity": trade_data.quantity,
            "commission_entry": trade_data.commission_entry,
            "commission_exit": trade_data.commission_exit,
            "profit": profit
        }).execute()

        if response.data:
            return response.data[0]
        return None
    except Exception as e:
        print(f"ERROR: Failed to create completed trade in Supabase: {e}")
        return None
