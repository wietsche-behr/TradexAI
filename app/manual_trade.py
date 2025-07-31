import asyncio
from fastapi import APIRouter, Depends, HTTPException, Body
from binance.client import Client

from . import auth, crud, schemas
from .supabase_db import db
from .strategies import _extract_order_details

router = APIRouter()

MANUAL_POSITION: dict[int, dict | None] = {}
MANUAL_TASKS: dict[int, asyncio.Task] = {}


def _get_client(user_id: int) -> Client:
    settings = db.get_user_settings(user_id)
    if not settings:
        raise HTTPException(status_code=400, detail="Binance API keys not configured")
    return Client(settings["binance_api_key"], settings["binance_api_secret"])


async def _monitor_position(user_id: int):
    pos = MANUAL_POSITION.get(user_id)
    if not pos:
        return
    client = _get_client(user_id)
    symbol = pos["symbol"]
    qty = pos["quantity"]
    tp = pos.get("take_profit")
    sl = pos.get("stop_loss")
    trade_id = pos.get("trade_id")
    while MANUAL_POSITION.get(user_id):
        await asyncio.sleep(5)
        try:
            ticker = client.get_symbol_ticker(symbol=symbol)
            price = float(ticker["price"])
        except Exception:
            continue
        trigger = False
        if tp and price >= tp:
            trigger = True
        if sl and price <= sl:
            trigger = True
        if not trigger:
            continue
        try:
            order = client.create_order(symbol=symbol, side="SELL", type="MARKET", quantity=qty)
            exit_price, _, exit_commission = _extract_order_details(order)
        except Exception as exc:
            # keep trying until successful
            continue
        sell_trade = crud.create_trade(
            schemas.TradeCreate(
                symbol=symbol,
                side="SELL",
                quantity=qty,
                price=exit_price,
                strategy_id="manual",
                status="closed",
                related_trade_id=trade_id,
            ),
            user_id,
        )
        sell_trade_id = sell_trade.get("id") if sell_trade else None
        if trade_id:
            crud.update_trade(
                trade_id,
                schemas.TradeCreate(
                    symbol=symbol,
                    side="BUY",
                    quantity=qty,
                    price=pos["price"],
                    strategy_id="manual",
                    status="closed",
                    related_trade_id=sell_trade_id,
                ),
            )
        MANUAL_POSITION[user_id] = None
        break
    MANUAL_TASKS.pop(user_id, None)


@router.post("/manual/buy")
async def manual_buy(
    symbol: str = Body(..., embed=True),
    amount: float = Body(..., embed=True),
    take_profit: float | None = Body(None, embed=True),
    stop_loss: float | None = Body(None, embed=True),
    current_user: dict = Depends(auth.get_current_user),
):
    client = _get_client(current_user["id"])
    try:
        order = client.create_order(symbol=symbol.upper(), side="BUY", type="MARKET", quoteOrderQty=amount)
        entry_price, executed_qty, entry_commission = _extract_order_details(order)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    trade = crud.create_trade(
        schemas.TradeCreate(
            symbol=symbol.upper(),
            side="BUY",
            quantity=executed_qty,
            price=entry_price,
            strategy_id="manual",
            status="open",
        ),
        current_user["id"],
    )
    trade_id = trade.get("id") if trade else None
    MANUAL_POSITION[current_user["id"]] = {
        "symbol": symbol.upper(),
        "quantity": executed_qty,
        "price": entry_price,
        "take_profit": take_profit,
        "stop_loss": stop_loss,
        "trade_id": trade_id,
    }
    if take_profit or stop_loss:
        task = asyncio.create_task(_monitor_position(current_user["id"]))
    MANUAL_TASKS[current_user["id"]] = task
    return {"buy": order}


@router.post("/manual/sell")
async def manual_sell(
    symbol: str = Body(..., embed=True),
    amount: float = Body(..., embed=True),
    current_user: dict = Depends(auth.get_current_user),
):
    client = _get_client(current_user["id"])
    try:
        order = client.create_order(symbol=symbol.upper(), side="SELL", type="MARKET", quoteOrderQty=amount)
        exit_price, executed_qty, _ = _extract_order_details(order)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    crud.create_trade(
        schemas.TradeCreate(
            symbol=symbol.upper(),
            side="SELL",
            quantity=executed_qty,
            price=exit_price,
            strategy_id="manual",
            status="closed",
        ),
        current_user["id"],
    )
    return {"sell": order}
