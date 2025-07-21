from fastapi import APIRouter, Depends, HTTPException
from binance.client import Client

from . import auth
from .supabase_db import db

router = APIRouter()


def _get_client(user_id: int) -> Client:
    settings = db.get_user_settings(user_id)
    if not settings:
        raise HTTPException(status_code=400, detail="Binance API keys not configured")
    return Client(settings["binance_api_key"], settings["binance_api_secret"])


@router.get("/assets")
def get_assets(current_user: dict = Depends(auth.get_current_user)):
    client = _get_client(current_user["id"])
    try:
        account = client.get_account()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    balances = account.get("balances", [])
    non_zero = [b for b in balances if float(b.get("free", 0)) > 0 or float(b.get("locked", 0)) > 0]
    return {"balances": non_zero}


@router.get("/portfolio_value")
def get_portfolio_value(current_user: dict = Depends(auth.get_current_user)):
    """Return total portfolio value in USDT."""
    client = _get_client(current_user["id"])
    try:
        account = client.get_account()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    balances = account.get("balances", [])
    total = 0.0
    for b in balances:
        qty = float(b.get("free", 0)) + float(b.get("locked", 0))
        if qty <= 0:
            continue
        asset = b.get("asset")
        if asset == "USDT":
            total += qty
            continue
        symbol = f"{asset}USDT"
        try:
            ticker = client.get_symbol_ticker(symbol=symbol)
            price = float(ticker["price"])
            total += qty * price
        except Exception:
            # Skip assets without a direct USDT pair
            continue
    return {"total_usdt": total}
