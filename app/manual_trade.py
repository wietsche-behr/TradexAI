from fastapi import APIRouter, Body, Depends, HTTPException
from binance.client import Client
import asyncio
from dataclasses import dataclass
from . import auth, crud, schemas
from .supabase_db import db
from .strategies import _extract_order_details

router = APIRouter()


def _get_client(user_id: int) -> Client:
    settings = db.get_user_settings(user_id)
    if not settings:
        raise HTTPException(status_code=400, detail="Binance API keys not configured")
    return Client(settings["binance_api_key"], settings["binance_api_secret"])


@dataclass
class ManualTrade:
    symbol: str
    side: str
    quantity: float
    take_profit: float | None
    stop_loss: float | None
    trade_id: int | None
    commission: float


MANUAL_TASKS: dict[tuple[int, int | None], asyncio.Task] = {}


async def _monitor_trade(user_id: int, trade: ManualTrade):
    client = _get_client(user_id)
    symbol = trade.symbol
    try:
        while True:
            ticker = client.get_symbol_ticker(symbol=symbol)
            price = float(ticker["price"])
            exit_side = None
            if trade.side == "BUY":
                if trade.take_profit and price >= trade.take_profit:
                    exit_side = "SELL"
                if trade.stop_loss and price <= trade.stop_loss:
                    exit_side = "SELL"
            else:
                if trade.take_profit and price <= trade.take_profit:
                    exit_side = "BUY"
                if trade.stop_loss and price >= trade.stop_loss:
                    exit_side = "BUY"
            if exit_side:
                order = client.create_order(
                    symbol=symbol,
                    side=exit_side,
                    type="MARKET",
                    quantity=trade.quantity,
                )
                exit_price, _, exit_commission = _extract_order_details(order)
                crud.create_trade(
                    schemas.TradeCreate(
                        symbol=symbol,
                        side=exit_side,
                        quantity=trade.quantity,
                        price=exit_price,
                        strategy_id="manual",
                        status="closed",
                        related_trade_id=trade.trade_id,
                    ),
                    user_id,
                )
                if trade.trade_id:
                    crud.update_trade(
                        trade.trade_id,
                        schemas.TradeCreate(
                            symbol=symbol,
                            side=trade.side,
                            quantity=trade.quantity,
                            price=trade.take_profit if exit_side == "SELL" else trade.stop_loss,
                            strategy_id="manual",
                            status="closed",
                            related_trade_id=None,
                        ),
                    )
                break
            await asyncio.sleep(5)
    finally:
        MANUAL_TASKS.pop((user_id, trade.trade_id), None)


@router.post("/manual_trade")
async def manual_trade(
    symbol: str = Body(...),
    side: str = Body("BUY"),
    amount: float = Body(...),
    take_profit: float | None = Body(None),
    stop_loss: float | None = Body(None),
    current_user: dict = Depends(auth.get_current_user),
):
    symbol = symbol.upper()
    side = side.upper()
    client = _get_client(current_user["id"])
    try:
        order = client.create_order(
            symbol=symbol,
            side=side,
            type="MARKET",
            quoteOrderQty=amount,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    price, qty, commission = _extract_order_details(order)
    trade = crud.create_trade(
        schemas.TradeCreate(
            symbol=symbol,
            side=side,
            quantity=qty,
            price=price,
            strategy_id="manual",
            status="open",
        ),
        current_user["id"],
    )
    trade_id = trade.get("id") if trade else None
    mtrade = ManualTrade(
        symbol=symbol,
        side=side,
        quantity=qty,
        take_profit=take_profit,
        stop_loss=stop_loss,
        trade_id=trade_id,
        commission=commission,
    )
    task = asyncio.create_task(_monitor_trade(current_user["id"], mtrade))
    MANUAL_TASKS[(current_user["id"], trade_id)] = task
    return {"trade_id": trade_id, "price": price, "quantity": qty}

