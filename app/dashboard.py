from fastapi import APIRouter, Depends
from . import auth
from .supabase_db import db

router = APIRouter()


def _compute_metrics(trades):
    open_positions = {}
    total_profit = 0.0
    closed_count = 0
    win_count = 0
    trade_history = []
    chart_data = []

    for trade in trades or []:
        symbol = trade.get("symbol")
        side = (trade.get("side") or "").upper()
        quantity = float(trade.get("quantity", 0))
        price = float(trade.get("price", 0))
        trade_id = trade.get("id")
        if side == "BUY":
            open_positions.setdefault(symbol, []).append({"quantity": quantity, "price": price})
            trade_history.append({
                "id": trade_id,
                "pair": symbol,
                "type": "BUY",
                "status": "Open",
                "profit": 0.0,
            })
        elif side == "SELL":
            qty_left = quantity
            profit_total = 0.0
            lst = open_positions.get(symbol, [])
            while qty_left > 0 and lst:
                pos = lst[0]
                trade_qty = min(pos["quantity"], qty_left)
                profit_total += (price - pos["price"]) * trade_qty
                qty_left -= trade_qty
                pos["quantity"] -= trade_qty
                if pos["quantity"] <= 0:
                    lst.pop(0)
            total_profit += profit_total
            closed_count += 1
            if profit_total > 0:
                win_count += 1
            trade_history.append({
                "id": trade_id,
                "pair": symbol,
                "type": "SELL",
                "status": "Closed",
                "profit": profit_total,
            })
            chart_data.append({
                "name": str(trade_id),
                "profit": max(profit_total, 0.0),
                "loss": max(-profit_total, 0.0),
            })
        else:
            trade_history.append({
                "id": trade_id,
                "pair": symbol,
                "type": side,
                "status": "Unknown",
                "profit": 0.0,
            })
    active_trades = sum(sum(p["quantity"] for p in v) for v in open_positions.values())
    win_rate = (win_count / closed_count * 100) if closed_count else 0.0
    return {
        "stats": {
            "total_profit": total_profit,
            "win_rate": win_rate,
            "active_trades": active_trades,
            "avg_trade_duration": 0,
        },
        "trade_history": trade_history,
        "chart_data": chart_data,
    }


@router.get("/dashboard")
def get_dashboard_data(current_user: dict = Depends(auth.get_current_user)):
    trades = db.get_trades(current_user["id"], skip=0, limit=1000) or []
    return _compute_metrics(trades)
