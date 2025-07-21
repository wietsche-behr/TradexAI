from fastapi import APIRouter, Depends, HTTPException, Body
from binance.client import Client
import pandas as pd
import asyncio
from datetime import datetime

from . import auth
from .supabase_db import db

router = APIRouter()

# Mapping of available strategies to human-friendly names
AVAILABLE_STRATEGIES = {
    "squeeze_breakout_btc_4h": "Squeeze Breakout BTC 4H",
    "squeeze_breakout_xrp_1h": "Squeeze Breakout XRP 1H",
    "squeeze_breakout_doge_1h": "Squeeze Breakout DOGE 1H",
    "squeeze_breakout_sol_4h": "Squeeze Breakout SOL 4H",
}

# --- LOGGING SETUP ---
# Expanded to include all four strategies
STRATEGY_LOGS = {
    "squeeze_breakout_btc_4h": {"detail": [], "trade": []},
    "squeeze_breakout_xrp_1h": {"detail": [], "trade": []},
    "squeeze_breakout_doge_1h": {"detail": [], "trade": []},
    "squeeze_breakout_sol_4h": {"detail": [], "trade": []},
    "manual": {"detail": [], "trade": []},
}


def log_detail(strategy_id: str, message: str):
    """Appends a detailed, timestamped log message for a given strategy."""
    log_key = strategy_id.lower()
    if log_key in STRATEGY_LOGS:
        # Keep the log to a reasonable size to avoid memory issues
        if len(STRATEGY_LOGS[log_key]["detail"]) > 200:
            STRATEGY_LOGS[log_key]["detail"].pop(0)

        timestamp = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')
        STRATEGY_LOGS[log_key]["detail"].append(f"[{timestamp}] {message}")


def _log(strategy_id: str, message: str, log_type: str = "detail") -> None:
    logs = STRATEGY_LOGS.setdefault(strategy_id, {"detail": [], "trade": []})
    logs.setdefault(log_type, []).append(message)


# --- INDICATOR HELPER FUNCTIONS ---

def ema(series: pd.Series, length: int) -> pd.Series:
    """Simple exponential moving average."""
    return series.ewm(span=length, adjust=False).mean()


def bollinger_bands(series: pd.Series, length: int, mult: float):
    """Return lower and upper Bollinger Bands."""
    ma = series.rolling(length).mean()
    std = series.rolling(length).std()
    upper = ma + mult * std
    lower = ma - mult * std
    return lower, upper


def keltner_channels(df: pd.DataFrame, length: int, mult: float):
    """Return lower and upper Keltner Channels."""
    tp = (df["high"] + df["low"] + df["close"]) / 3
    tp_ema = tp.ewm(span=length, adjust=False).mean()
    tr = abs(df["high"] - df["low"])
    tr_ema = tr.ewm(span=length, adjust=False).mean()
    upper = tp_ema + mult * tr_ema
    lower = tp_ema - mult * tr_ema
    return lower, upper


# --- RUNNING STRATEGIES ---
# keep track of running background tasks and trade history
RUNNING_TASKS: dict[str, asyncio.Task] = {}
OPEN_POSITION: dict[str, float | None] = {
    "squeeze_breakout_btc_4h": None,
    "squeeze_breakout_xrp_1h": None,
    "squeeze_breakout_doge_1h": None,
    "squeeze_breakout_sol_4h": None,
}
TRADE_HISTORY: dict[str, list[dict[str, float]]] = {
    "squeeze_breakout_btc_4h": [],
    "squeeze_breakout_xrp_1h": [],
    "squeeze_breakout_doge_1h": [],
    "squeeze_breakout_sol_4h": [],
}


# --- STRATEGY CLASSES with DETAILED LOGGING ---

class SqueezeBreakoutStrategy_BTC_4H:
    def __init__(self):
        self.strategy_id = "squeeze_breakout_btc_4h"
        self.ema_length = 200
        self.squeeze_length = 20
        self.bb_mult = 2.0
        self.kc_mult = 1.5
        print(f"Initialized: {self.strategy_id}")

    def check_signal(self, df: pd.DataFrame) -> str:
        log_detail(self.strategy_id, "--- Checking new candle ---")
        # Calculate Indicators
        df[f"EMA_{self.ema_length}"] = ema(df["close"], self.ema_length)
        bbl, bbu = bollinger_bands(df["close"], self.squeeze_length, self.bb_mult)
        df["BBL"], df["BBU"] = bbl, bbu
        kcl, kcu = keltner_channels(df, self.squeeze_length, self.kc_mult)
        df["KCL"], df["KCU"] = kcl, kcu
        df["don_h"] = df["high"].rolling(self.squeeze_length).max()
        df["don_l"] = df["low"].rolling(self.squeeze_length).min()

        latest = df.iloc[-1]
        previous = df.iloc[-2]

        is_bull_market = latest["close"] > latest[f"EMA_{self.ema_length}"]
        log_detail(
            self.strategy_id,
            f"Trend: Close({latest['close']:.2f}) > EMA({latest[f'EMA_{self.ema_length}']:.2f})? {is_bull_market}",
        )
        if not is_bull_market:
            log_detail(self.strategy_id, "HOLD: Not a bull market.")
            return "HOLD"

        squeeze_was_active = (previous["BBL"] > previous["KCL"]) and (
            previous["BBU"] < previous["KCU"]
        )
        log_detail(self.strategy_id, f"Squeeze active on previous bar? {squeeze_was_active}")

        entry_signal = latest["close"] > previous["don_h"]
        log_detail(
            self.strategy_id,
            f"Entry: Close({latest['close']:.2f}) > Donchian High({previous['don_h']:.2f})? {entry_signal}",
        )
        if squeeze_was_active and entry_signal:
            log_detail(self.strategy_id, "BUY SIGNAL CONFIRMED")
            return "BUY"

        exit_signal = latest["close"] < previous["don_l"]
        log_detail(
            self.strategy_id,
            f"Exit: Close({latest['close']:.2f}) < Donchian Low({previous['don_l']:.2f})? {exit_signal}",
        )
        if exit_signal:
            log_detail(self.strategy_id, "SELL SIGNAL CONFIRMED")
            return "SELL"

        log_detail(self.strategy_id, "HOLD: No entry or exit conditions met.")
        return "HOLD"


class SqueezeBreakoutStrategy_XRP_1H:
    def __init__(self):
        self.strategy_id = "squeeze_breakout_xrp_1h"
        self.ema_length = 200
        self.squeeze_length = 20
        self.bb_mult = 2.0
        self.kc_mult = 1.5
        print(f"Initialized: {self.strategy_id}")

    def check_signal(self, df: pd.DataFrame) -> str:
        log_detail(self.strategy_id, "--- Checking new candle ---")
        df[f"EMA_{self.ema_length}"] = ema(df["close"], self.ema_length)
        bbl, bbu = bollinger_bands(df["close"], self.squeeze_length, self.bb_mult)
        df["BBL"], df["BBU"] = bbl, bbu
        kcl, kcu = keltner_channels(df, self.squeeze_length, self.kc_mult)
        df["KCL"], df["KCU"] = kcl, kcu
        df["don_h"] = df["high"].rolling(self.squeeze_length).max()
        df["don_l"] = df["low"].rolling(self.squeeze_length).min()

        latest = df.iloc[-1]
        previous = df.iloc[-2]

        is_bull_market = latest["close"] > latest[f"EMA_{self.ema_length}"]
        log_detail(
            self.strategy_id,
            f"Trend: Close({latest['close']:.4f}) > EMA({latest[f'EMA_{self.ema_length}']:.4f})? {is_bull_market}",
        )
        if not is_bull_market:
            log_detail(self.strategy_id, "HOLD: Not a bull market.")
            return "HOLD"

        squeeze_was_active = (previous["BBL"] > previous["KCL"]) and (
            previous["BBU"] < previous["KCU"]
        )
        log_detail(self.strategy_id, f"Squeeze active on previous bar? {squeeze_was_active}")

        entry_signal = latest["close"] > previous["don_h"]
        log_detail(
            self.strategy_id,
            f"Entry: Close({latest['close']:.4f}) > Donchian High({previous['don_h']:.4f})? {entry_signal}",
        )
        if squeeze_was_active and entry_signal:
            log_detail(self.strategy_id, "BUY SIGNAL CONFIRMED")
            return "BUY"

        exit_signal = latest["close"] < previous["don_l"]
        log_detail(
            self.strategy_id,
            f"Exit: Close({latest['close']:.4f}) < Donchian Low({previous['don_l']:.4f})? {exit_signal}",
        )
        if exit_signal:
            log_detail(self.strategy_id, "SELL SIGNAL CONFIRMED")
            return "SELL"

        log_detail(self.strategy_id, "HOLD: No entry or exit conditions met.")
        return "HOLD"


class SqueezeBreakoutStrategy_DOGE_1H:
    def __init__(self):
        self.strategy_id = "squeeze_breakout_doge_1h"
        self.ema_length = 200
        self.squeeze_length = 20
        self.bb_mult = 2.0
        self.kc_mult = 1.5
        print(f"Initialized: {self.strategy_id}")

    def check_signal(self, df: pd.DataFrame) -> str:
        log_detail(self.strategy_id, "--- Checking new candle ---")
        df[f"EMA_{self.ema_length}"] = ema(df["close"], self.ema_length)
        bbl, bbu = bollinger_bands(df["close"], self.squeeze_length, self.bb_mult)
        df["BBL"], df["BBU"] = bbl, bbu
        kcl, kcu = keltner_channels(df, self.squeeze_length, self.kc_mult)
        df["KCL"], df["KCU"] = kcl, kcu
        df["don_h"] = df["high"].rolling(self.squeeze_length).max()
        df["don_l"] = df["low"].rolling(self.squeeze_length).min()

        latest = df.iloc[-1]
        previous = df.iloc[-2]

        is_bull_market = latest["close"] > latest[f"EMA_{self.ema_length}"]
        log_detail(
            self.strategy_id,
            f"Trend: Close({latest['close']:.4f}) > EMA({latest[f'EMA_{self.ema_length}']:.4f})? {is_bull_market}",
        )
        if not is_bull_market:
            log_detail(self.strategy_id, "HOLD: Not a bull market.")
            return "HOLD"

        squeeze_was_active = (previous["BBL"] > previous["KCL"]) and (
            previous["BBU"] < previous["KCU"]
        )
        log_detail(self.strategy_id, f"Squeeze active on previous bar? {squeeze_was_active}")

        entry_signal = latest["close"] > previous["don_h"]
        log_detail(
            self.strategy_id,
            f"Entry: Close({latest['close']:.4f}) > Donchian High({previous['don_h']:.4f})? {entry_signal}",
        )
        if squeeze_was_active and entry_signal:
            log_detail(self.strategy_id, "BUY SIGNAL CONFIRMED")
            return "BUY"

        exit_signal = latest["close"] < previous["don_l"]
        log_detail(
            self.strategy_id,
            f"Exit: Close({latest['close']:.4f}) < Donchian Low({previous['don_l']:.4f})? {exit_signal}",
        )
        if exit_signal:
            log_detail(self.strategy_id, "SELL SIGNAL CONFIRMED")
            return "SELL"

        log_detail(self.strategy_id, "HOLD: No entry or exit conditions met.")
        return "HOLD"


class SqueezeBreakoutStrategy_SOL_4H:
    def __init__(self):
        self.strategy_id = "squeeze_breakout_sol_4h"
        self.ema_length = 200
        self.squeeze_length = 20
        self.bb_mult = 2.0
        self.kc_mult = 1.5
        print(f"Initialized: {self.strategy_id}")

    def check_signal(self, df: pd.DataFrame) -> str:
        log_detail(self.strategy_id, "--- Checking new candle ---")
        df[f"EMA_{self.ema_length}"] = ema(df["close"], self.ema_length)
        bbl, bbu = bollinger_bands(df["close"], self.squeeze_length, self.bb_mult)
        df["BBL"], df["BBU"] = bbl, bbu
        kcl, kcu = keltner_channels(df, self.squeeze_length, self.kc_mult)
        df["KCL"], df["KCU"] = kcl, kcu
        df["don_h"] = df["high"].rolling(self.squeeze_length).max()
        df["don_l"] = df["low"].rolling(self.squeeze_length).min()

        latest = df.iloc[-1]
        previous = df.iloc[-2]

        is_bull_market = latest["close"] > latest[f"EMA_{self.ema_length}"]
        log_detail(
            self.strategy_id,
            f"Trend: Close({latest['close']:.2f}) > EMA({latest[f'EMA_{self.ema_length}']:.2f})? {is_bull_market}",
        )
        if not is_bull_market:
            log_detail(self.strategy_id, "HOLD: Not a bull market.")
            return "HOLD"

        squeeze_was_active = (previous["BBL"] > previous["KCL"]) and (
            previous["BBU"] < previous["KCU"]
        )
        log_detail(self.strategy_id, f"Squeeze active on previous bar? {squeeze_was_active}")

        entry_signal = latest["close"] > previous["don_h"]
        log_detail(
            self.strategy_id,
            f"Entry: Close({latest['close']:.2f}) > Donchian High({previous['don_h']:.2f})? {entry_signal}",
        )
        if squeeze_was_active and entry_signal:
            log_detail(self.strategy_id, "BUY SIGNAL CONFIRMED")
            return "BUY"

        exit_signal = latest["close"] < previous["don_l"]
        log_detail(
            self.strategy_id,
            f"Exit: Close({latest['close']:.2f}) < Donchian Low({previous['don_l']:.2f})? {exit_signal}",
        )
        if exit_signal:
            log_detail(self.strategy_id, "SELL SIGNAL CONFIRMED")
            return "SELL"

        log_detail(self.strategy_id, "HOLD: No entry or exit conditions met.")
        return "HOLD"


# Mapping from strategy ids to their class implementations
STRATEGY_CLASSES = {
    "squeeze_breakout_btc_4h": SqueezeBreakoutStrategy_BTC_4H,
    "squeeze_breakout_xrp_1h": SqueezeBreakoutStrategy_XRP_1H,
    "squeeze_breakout_doge_1h": SqueezeBreakoutStrategy_DOGE_1H,
    "squeeze_breakout_sol_4h": SqueezeBreakoutStrategy_SOL_4H,
}

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


async def _run_strategy_loop(strategy, client, strategy_id: str):
    """Background loop that continuously checks signals and logs trades."""
    symbol_map = {
        "squeeze_breakout_btc_4h": ("BTCUSDT", Client.KLINE_INTERVAL_4HOUR),
        "squeeze_breakout_xrp_1h": ("XRPUSDT", Client.KLINE_INTERVAL_1HOUR),
        "squeeze_breakout_doge_1h": ("DOGEUSDT", Client.KLINE_INTERVAL_1HOUR),
        "squeeze_breakout_sol_4h": ("SOLUSDT", Client.KLINE_INTERVAL_4HOUR),
    }
    symbol, interval = symbol_map[strategy_id]
    limit = strategy.ema_length + strategy.squeeze_length + 50
    while True:
        try:
            klines = client.get_klines(symbol=symbol, interval=interval, limit=limit)
            if not klines:
                await asyncio.sleep(10)
                continue
            df = pd.DataFrame(
                klines,
                columns=[
                    "open_time",
                    "open",
                    "high",
                    "low",
                    "close",
                    "volume",
                    "close_time",
                    "quote_asset_volume",
                    "number_of_trades",
                    "taker_buy_base",
                    "taker_buy_quote",
                    "ignore",
                ],
            )
            df[["open", "high", "low", "close"]] = df[["open", "high", "low", "close"]].astype(float)

            signal = strategy.check_signal(df)
            price = float(df.iloc[-1]["close"])
            if signal == "BUY" and OPEN_POSITION[strategy_id] is None:
                OPEN_POSITION[strategy_id] = price
                log_detail(strategy_id, f"Entering trade at {price}")
                STRATEGY_LOGS[strategy_id]["trade"].append(f"BUY {symbol} @ {price}")
            elif signal == "SELL" and OPEN_POSITION[strategy_id] is not None:
                entry = OPEN_POSITION[strategy_id]
                OPEN_POSITION[strategy_id] = None
                STRATEGY_LOGS[strategy_id]["trade"].append(f"SELL {symbol} @ {price}")
                TRADE_HISTORY[strategy_id].append({"entry_price": entry, "exit_price": price})
                profit = price - entry
                log_detail(strategy_id, f"Exiting trade at {price} (profit {profit:.2f})")
        except asyncio.CancelledError:
            break
        except Exception as exc:
            log_detail(strategy_id, f"ERROR: {exc}")
        await asyncio.sleep(5)


@router.post("/strategy/{strategy_id}/start")
async def start_strategy(strategy_id: str, current_user: dict = Depends(auth.get_current_user)):
    strategy_id = strategy_id.lower()
    if strategy_id in RUNNING_TASKS:
        raise HTTPException(status_code=400, detail="Strategy already running")
    cls = STRATEGY_CLASSES.get(strategy_id)
    if not cls:
        raise HTTPException(status_code=404, detail="Unknown strategy")
    client = _get_client(current_user["id"])
    strategy = cls()
    task = asyncio.create_task(_run_strategy_loop(strategy, client, strategy_id))
    RUNNING_TASKS[strategy_id] = task
    log_detail(strategy_id, "Strategy started")
    return {"status": "started"}


@router.post("/strategy/{strategy_id}/stop")
async def stop_strategy(strategy_id: str, current_user: dict = Depends(auth.get_current_user)):
    strategy_id = strategy_id.lower()
    task = RUNNING_TASKS.pop(strategy_id, None)
    if not task:
        raise HTTPException(status_code=404, detail="Strategy not running")
    task.cancel()
    log_detail(strategy_id, "Strategy stopped")
    return {"status": "stopped"}


@router.get("/strategies")
def list_strategies(current_user: dict = Depends(auth.get_current_user)):
    """Return available strategies and running status."""
    results = []
    for sid, name in AVAILABLE_STRATEGIES.items():
        results.append({
            "id": sid,
            "name": name,
            "running": sid in RUNNING_TASKS,
        })
    return {"strategies": results}
