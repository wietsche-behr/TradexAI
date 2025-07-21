from fastapi import APIRouter, Depends, HTTPException, Body
from binance.client import Client

from . import auth
from .supabase_db import db

router = APIRouter()

# simple in-memory logs for demo purposes
STRATEGY_LOGS = {
    "manual": {"detail": [], "trade": []},
}


def _log(strategy_id: str, message: str, log_type: str = "detail") -> None:
    """Append a log message for a strategy."""
    logs = STRATEGY_LOGS.setdefault(strategy_id, {"detail": [], "trade": []})
    logs.setdefault(log_type, []).append(message)


def _get_client(user_id: int) -> Client:
    settings = db.get_user_settings(user_id)
    if not settings:
        raise HTTPException(status_code=400, detail="Binance API keys not configured")
    return Client(settings["binance_api_key"], settings["binance_api_secret"])


@router.post("/strategy/test/buy")
def test_buy(
    symbol: str = Body(..., embed=True),
    amount: float = Body(..., embed=True),
    current_user: dict = Depends(auth.get_current_user),
):
    client = _get_client(current_user["id"])
    try:
        order = client.create_order(
            symbol=symbol.upper(),
            side="BUY",
            type="MARKET",
            quoteOrderQty=amount,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    _log("manual", f"BUY {symbol.upper()} qty {order.get('executedQty', amount)}", "trade")
    _log("manual", f"Placed market BUY order for {symbol.upper()} amount {amount}")
    return {"buy": order}


@router.post("/strategy/test/sell")
def test_sell(
    symbol: str = Body(..., embed=True),
    quantity: float = Body(..., embed=True),
    current_user: dict = Depends(auth.get_current_user),
):
    client = _get_client(current_user["id"])
    try:
        order = client.create_order(
            symbol=symbol.upper(),
            side="SELL",
            type="MARKET",
            quantity=quantity,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    _log("manual", f"SELL {symbol.upper()} qty {order.get('executedQty', quantity)}", "trade")
    _log("manual", f"Placed market SELL order for {symbol.upper()} qty {quantity}")
    return {"sell": order}


@router.get("/strategy/{strategy_id}/logs")
def get_strategy_logs(
    strategy_id: str,
    log_type: str = "detail",
    current_user: dict = Depends(auth.get_current_user),
):
    logs = STRATEGY_LOGS.get(strategy_id, {"detail": [], "trade": []})
    return {"logs": logs.get(log_type, [])}
