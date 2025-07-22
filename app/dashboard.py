from fastapi import APIRouter, Depends
import pandas as pd
from . import auth
from .supabase_db import db

# Binance trading fee rate (0.1% per trade)
FEE_RATE = 0.001

router = APIRouter()


def _compute_metrics(trades):
    # sort trades to ensure calculations happen chronologically
    trades_sorted = sorted(trades or [], key=lambda t: t.get("id", 0))

    open_positions: dict[str, list[dict]] = {}
    total_profit = 0.0
    closed_count = 0
    win_count = 0
    trade_history: list[dict] = []
    chart_data: list[dict] = []

    durations = []

    for trade in trades_sorted:
        # handle potential whitespace or mixed case values from the database
        symbol = (trade.get("symbol") or "").strip()
        side = (trade.get("side") or "").strip().upper()
        quantity = float(trade.get("quantity", 0))
        price = float(trade.get("price", 0))
        trade_id = trade.get("id")
        ts = trade.get("created_at") or trade.get("timestamp")
        if side == "BUY":
            open_positions.setdefault(symbol, []).append(
                {
                    "quantity": quantity,
                    "price": price,
                    "timestamp": ts,
                }
            )
            trade_history.append(
                {
                    "id": trade_id,
                    "pair": symbol,
                    "type": "BUY",
                    "status": "Open",
                    "profit": 0.0,
                }
            )
        elif side == "SELL":
            qty_left = quantity
            profit_total = 0.0
            lst = open_positions.get(symbol, [])
            while qty_left > 0 and lst:
                pos = lst[0]
                trade_qty = min(pos["quantity"], qty_left)
                gross = (price - pos["price"]) * trade_qty
                fees = (price + pos["price"]) * trade_qty * FEE_RATE
                profit_total += gross - fees
                qty_left -= trade_qty
                pos["quantity"] -= trade_qty
                if pos["quantity"] <= 0:
                    # compute duration when position fully closed
                    if ts and pos.get("timestamp"):
                        try:
                            dur = (
                                pd.to_datetime(ts)
                                - pd.to_datetime(pos["timestamp"])
                            ).total_seconds() / 60
                            durations.append(dur)
                        except Exception:
                            pass
                    lst.pop(0)
            total_profit += profit_total
            closed_count += 1
            if profit_total > 0:
                win_count += 1
            trade_history.append(
                {
                    "id": trade_id,
                    "pair": symbol,
                    "type": "SELL",
                    "status": "Closed",
                    "profit": profit_total,
                }
            )
            chart_data.append(
                {
                    "name": str(trade_id),
                    "profit": max(profit_total, 0.0),
                    "loss": max(-profit_total, 0.0),
                }
            )
        else:
            trade_history.append(
                {
                    "id": trade_id,
                    "pair": symbol,
                    "type": side,
                    "status": "Unknown",
                    "profit": 0.0,
                }
            )
    active_trades = sum(len(v) for v in open_positions.values())
    win_rate = (win_count / closed_count * 100) if closed_count else 0.0
    avg_duration = sum(durations) / len(durations) if durations else 0.0
    return {
        "stats": {
            "total_profit": total_profit,
            "win_rate": win_rate,
            "active_trades": active_trades,
            "avg_trade_duration": avg_duration,
        },
        "trade_history": trade_history,
        "chart_data": chart_data,
    }


@router.get("/dashboard")
def get_dashboard_data(current_user: dict = Depends(auth.get_current_user)):
    trades = db.get_trades(current_user["id"], skip=0, limit=1000) or []
    return _compute_metrics(trades)
