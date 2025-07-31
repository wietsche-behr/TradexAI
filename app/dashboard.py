from fastapi import APIRouter, Depends
import pandas as pd
from . import auth
from .supabase_db import db

# Binance trading fee rate (0.1% per trade)
FEE_RATE = 0.001

router = APIRouter()


def _compute_metrics(user_id: int, trades=None):
    """Compute dashboard metrics using ``trade_summary_view``."""
    summary = db.get_trade_summary(user_id, skip=0, limit=1000) or []
    if trades is None:
        trades = db.get_trades(user_id, skip=0, limit=1000) or []

    buy_trades = [t for t in trades if (t.get("side") or "").lower() == "buy"]
    paired_ids = {s.get("entry_trade_id") for s in summary if s.get("entry_trade_id")}
    open_trades = [t for t in buy_trades if t.get("id") not in paired_ids]

    trade_history: list[dict] = []
    chart_data: list[dict] = []
    durations: list[float] = []

    total_profit = 0.0
    closed_count = 0
    win_count = 0

    for row in summary:
        profit = float(row.get("profit_amount", 0))
        total_profit += profit
        closed_count += 1
        if profit > 0:
            win_count += 1

        trade_history.append(
            {
                "id": row.get("trade_pair_id"),
                "pair": row.get("symbol"),
                "strategy": row.get("strategy_id"),
                "status": "Closed",
                "profit_percentage": float(row.get("profit_percentage", 0)),
                "profit": profit,
            }
        )

        chart_data.append(
            {
                "name": str(row.get("trade_pair_id")),
                "profit": max(profit, 0.0),
                "loss": max(-profit, 0.0),
            }
        )

        entry_ts = row.get("entry_timestamp")
        exit_ts = row.get("exit_timestamp")
        if entry_ts and exit_ts:
            try:
                dur = (
                    pd.to_datetime(exit_ts) - pd.to_datetime(entry_ts)
                ).total_seconds() / 60
                durations.append(dur)
            except Exception:
                pass

    for trade in open_trades:
        trade_history.append(
            {
                "id": trade.get("id"),
                "pair": trade.get("symbol"),
                "strategy": trade.get("strategy_id"),
                "status": "Open",
                "profit_percentage": 0.0,
                "profit": 0.0,
            }
        )

    active_trades = len(open_trades)
    win_rate = (win_count / closed_count * 100) if closed_count else 0.0
    avg_duration = sum(durations) / len(durations) if durations else 0.0

    metrics = {
        "stats": {
            "total_profit": total_profit,
            "win_rate": win_rate,
            "active_trades": active_trades,
            "avg_trade_duration": avg_duration,
        },
        "trade_history": trade_history,
        "chart_data": chart_data,
    }

    # Persist total profit on the user record
    try:
        db.update_user_total_profit(user_id, total_profit)
    except Exception:
        pass

    return metrics


@router.get("/dashboard")
def get_dashboard_data(current_user: dict = Depends(auth.get_current_user)):
    return _compute_metrics(current_user["id"])
