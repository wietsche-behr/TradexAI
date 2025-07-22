from fastapi import APIRouter, Depends, HTTPException, Body
from binance.client import Client
import pandas as pd
import asyncio
from datetime import datetime
from contextvars import ContextVar

from . import auth
from .supabase_db import db

router = APIRouter()

# Mapping of available strategies to human-friendly names
AVAILABLE_STRATEGIES = {
    "squeeze_breakout_btc_4h": "Squeeze Breakout BTC 4H",
    "squeeze_breakout_xrp_1h": "Squeeze Breakout XRP 1H",
    "squeeze_breakout_doge_1h": "Squeeze Breakout DOGE 1H",
    "squeeze_breakout_sol_4h": "Squeeze Breakout SOL 4H",
    "hyper_frequency_ema_cross_btc_1m": "Hyper-Frequency EMA Cross BTC 1M",
}

# --- LOGGING SETUP ---
current_user_ctx: ContextVar[int | None] = ContextVar("current_user_ctx", default=None)
STRATEGY_LOGS: dict[str, dict[str, list[str]]] = {}


def _log_key(user_id: int | None, strategy_id: str) -> str:
    key = strategy_id.lower()
    return f"{user_id}:{key}" if user_id is not None else key


def log_detail(strategy_id: str, message: str):
    """Appends a detailed, timestamped log message for a given strategy."""
    user_id = current_user_ctx.get()
    key = _log_key(user_id, strategy_id)
    logs = STRATEGY_LOGS.setdefault(key, {"detail": [], "trade": []})
    if len(logs["detail"]) > 200:
        logs["detail"].pop(0)
    timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    logs["detail"].append(f"[{timestamp}] {message}")


def _log(strategy_id: str, message: str, log_type: str = "detail") -> None:
    user_id = current_user_ctx.get()
    key = _log_key(user_id, strategy_id)
    logs = STRATEGY_LOGS.setdefault(key, {"detail": [], "trade": []})
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


def atr(df: pd.DataFrame, length: int) -> pd.Series:
    """Average true range using exponential moving average."""
    high_low = df["high"] - df["low"]
    high_close_prev = (df["high"] - df["close"].shift()).abs()
    low_close_prev = (df["low"] - df["close"].shift()).abs()
    tr = pd.concat([high_low, high_close_prev, low_close_prev], axis=1).max(axis=1)
    return tr.ewm(span=length, adjust=False).mean()


# --- RUNNING STRATEGIES ---
# keep track of running background tasks and trade history
RUNNING_TASKS: dict[tuple[int, str], dict] = {}
OPEN_POSITION: dict[tuple[int, str], float | None] = {}
TRADE_HISTORY: dict[tuple[int, str], list[dict[str, float]]] = {}
# aggregated logs of buy/sell events for display on strategy page
GLOBAL_TRADE_LOGS: dict[int, list[str]] = {}


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


class HyperFrequencyEMAStrategy:
    """Hyper-Frequency EMA Cross strategy hard coded for BTCUSDT 1m."""

    def __init__(self):
        self.strategy_id = "hyper_frequency_ema_cross_btc_1m"
        self.symbol = "BTCUSDT"
        self.interval = "1m"

        # strategy parameters
        self.ema_long_len = 200
        self.ema_fast_len = 5
        self.ema_slow_len = 10
        self.atr_len_vol = 20
        self.min_vol_percent = 0.05

        # used by _run_strategy_loop for lookback calculation
        self.ema_length = self.ema_long_len
        self.squeeze_length = self.atr_len_vol

        print(
            f"Initialized: {self.strategy_id} for {self.symbol} on {self.interval}"
        )

    def check_signal(self, df: pd.DataFrame) -> str:
        log_detail(self.strategy_id, "--- Checking new candle ---")

        df[f"EMA_{self.ema_long_len}"] = ema(df["close"], self.ema_long_len)
        df[f"EMA_{self.ema_fast_len}"] = ema(df["close"], self.ema_fast_len)
        df[f"EMA_{self.ema_slow_len}"] = ema(df["close"], self.ema_slow_len)
        df[f"ATR_{self.atr_len_vol}"] = atr(df, self.atr_len_vol)

        latest = df.iloc[-1]
        previous = df.iloc[-2]

        vol_pct = (latest[f"ATR_{self.atr_len_vol}"] / latest["close"]) * 100
        has_vol = vol_pct > self.min_vol_percent
        log_detail(
            self.strategy_id,
            f"Volatility({vol_pct:.3f}%) > Min({self.min_vol_percent}%)? {has_vol}",
        )
        if not has_vol:
            log_detail(self.strategy_id, "HOLD: Market too flat")
            return "HOLD"

        is_bull = latest["close"] > latest[f"EMA_{self.ema_long_len}"]
        is_bear = latest["close"] < latest[f"EMA_{self.ema_long_len}"]
        trend_msg = "Bullish" if is_bull else "Bearish" if is_bear else "Neutral"
        log_detail(self.strategy_id, f"Trend: {trend_msg}")

        fast_prev = previous[f"EMA_{self.ema_fast_len}"]
        slow_prev = previous[f"EMA_{self.ema_slow_len}"]
        fast_now = latest[f"EMA_{self.ema_fast_len}"]
        slow_now = latest[f"EMA_{self.ema_slow_len}"]

        long_entry = fast_prev <= slow_prev and fast_now > slow_now
        short_entry = fast_prev >= slow_prev and fast_now < slow_now

        log_detail(
            self.strategy_id,
            f"Crossover: FastEMA({fast_now:.2f}) vs SlowEMA({slow_now:.2f})",
        )

        if is_bull and long_entry:
            log_detail(self.strategy_id, "BUY SIGNAL CONFIRMED")
            return "BUY"

        if is_bear and short_entry:
            log_detail(self.strategy_id, "SELL SIGNAL CONFIRMED")
            return "SELL"

        log_detail(self.strategy_id, "HOLD: No action, conditions not met")
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
    "hyper_frequency_ema_cross_btc_1m": HyperFrequencyEMAStrategy,
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
    token = current_user_ctx.set(current_user["id"])
    try:
        order = client.create_order(
            symbol=symbol.upper(),
            side="BUY",
            type="MARKET",
            quoteOrderQty=amount,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        current_user_ctx.reset(token)
    qty = order.get("executedQty", amount)
    _log("manual", f"BUY {symbol.upper()} qty {qty}", "trade")
    logs = GLOBAL_TRADE_LOGS.setdefault(current_user["id"], [])
    logs.append(f"BUY {symbol.upper()} qty {qty}")
    if len(logs) > 1000:
        logs.pop(0)
    _log("manual", f"Placed market BUY order for {symbol.upper()} amount {amount}")
    return {"buy": order}


@router.post("/strategy/test/sell")
def test_sell(
    symbol: str = Body(..., embed=True),
    quantity: float = Body(..., embed=True),
    current_user: dict = Depends(auth.get_current_user),
):
    client = _get_client(current_user["id"])
    token = current_user_ctx.set(current_user["id"])
    try:
        order = client.create_order(
            symbol=symbol.upper(),
            side="SELL",
            type="MARKET",
            quantity=quantity,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        current_user_ctx.reset(token)
    qty = order.get("executedQty", quantity)
    _log("manual", f"SELL {symbol.upper()} qty {qty}", "trade")
    logs = GLOBAL_TRADE_LOGS.setdefault(current_user["id"], [])
    logs.append(f"SELL {symbol.upper()} qty {qty}")
    if len(logs) > 1000:
        logs.pop(0)
    _log("manual", f"Placed market SELL order for {symbol.upper()} qty {quantity}")
    return {"sell": order}


@router.get("/strategy/{strategy_id}/logs")
def get_strategy_logs(
    strategy_id: str,
    log_type: str = "detail",
    current_user: dict = Depends(auth.get_current_user),
):
    logs = STRATEGY_LOGS.get(_log_key(current_user["id"], strategy_id), {"detail": [], "trade": []})
    return {"logs": logs.get(log_type, [])}


@router.get("/trade_logs")
def get_all_trade_logs(current_user: dict = Depends(auth.get_current_user)):
    """Return aggregated buy/sell events across all strategies."""
    return {"logs": GLOBAL_TRADE_LOGS.get(current_user["id"], [])}


async def _run_strategy_loop(
    strategy,
    client,
    user_id: int,
    strategy_id: str,
    amount: float | None = None,
):
    """Background loop that continuously checks signals and logs trades."""
    symbol_map = {
        "squeeze_breakout_btc_4h": ("BTCUSDT", Client.KLINE_INTERVAL_4HOUR),
        "squeeze_breakout_xrp_1h": ("XRPUSDT", Client.KLINE_INTERVAL_1HOUR),
        "squeeze_breakout_doge_1h": ("DOGEUSDT", Client.KLINE_INTERVAL_1HOUR),
        "squeeze_breakout_sol_4h": ("SOLUSDT", Client.KLINE_INTERVAL_4HOUR),
        "hyper_frequency_ema_cross_btc_1m": ("BTCUSDT", Client.KLINE_INTERVAL_1MINUTE),
    }
    symbol, interval = symbol_map[strategy_id]
    limit = strategy.ema_length + strategy.squeeze_length + 50
    key = (user_id, strategy_id)
    token = current_user_ctx.set(user_id)
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
            if signal == "BUY" and OPEN_POSITION.get(key) is None:
                OPEN_POSITION[key] = price
                log_detail(strategy_id, f"Entering trade at {price}")
                STRATEGY_LOGS[_log_key(user_id, strategy_id)]["trade"].append(
                    f"BUY {symbol} @ {price}"
                )
                logs = GLOBAL_TRADE_LOGS.setdefault(user_id, [])
                logs.append(f"BUY {symbol} @ {price}")
                if len(logs) > 1000:
                    logs.pop(0)
            elif signal == "SELL" and OPEN_POSITION.get(key) is not None:
                entry = OPEN_POSITION[key]
                OPEN_POSITION[key] = None
                STRATEGY_LOGS[_log_key(user_id, strategy_id)]["trade"].append(
                    f"SELL {symbol} @ {price}"
                )
                TRADE_HISTORY.setdefault(key, []).append(
                    {"entry_price": entry, "exit_price": price}
                )
                profit = price - entry
                pct = (profit / entry) * 100 if entry else 0.0
                logs = GLOBAL_TRADE_LOGS.setdefault(user_id, [])
                logs.append(f"SELL {symbol} @ {price} ({pct:.2f}% profit)")
                if len(logs) > 1000:
                    logs.pop(0)
                log_detail(
                    strategy_id,
                    f"Exiting trade at {price} (profit {profit:.2f})",
                )
        except asyncio.CancelledError:
            break
        except Exception as exc:
            log_detail(strategy_id, f"ERROR: {exc}")
        await asyncio.sleep(5)
    current_user_ctx.reset(token)


@router.post("/strategy/{strategy_id}/start")
async def start_strategy(
    strategy_id: str,
    amount: float | None = Body(None, embed=True),
    current_user: dict = Depends(auth.get_current_user),
):
    strategy_id = strategy_id.lower()
    key = (current_user["id"], strategy_id)
    if key in RUNNING_TASKS:
        raise HTTPException(status_code=400, detail="Strategy already running")
    existing = db.get_active_user_strategy(current_user["id"], strategy_id)
    if existing:
        raise HTTPException(status_code=400, detail="Strategy already running")
    cls = STRATEGY_CLASSES.get(strategy_id)
    if not cls:
        raise HTTPException(status_code=404, detail="Unknown strategy")
    client = _get_client(current_user["id"])
    strategy = cls()
    run = db.create_user_strategy_run(current_user["id"], strategy_id)
    task = asyncio.create_task(
        _run_strategy_loop(strategy, client, current_user["id"], strategy_id, amount)
    )
    RUNNING_TASKS[key] = {"task": task, "run_id": run["id"], "amount": amount}
    OPEN_POSITION.setdefault(key, None)
    TRADE_HISTORY.setdefault(key, [])
    token = current_user_ctx.set(current_user["id"])
    log_detail(strategy_id, "Strategy started")
    current_user_ctx.reset(token)
    return {"status": "started"}


@router.post("/strategy/{strategy_id}/stop")
async def stop_strategy(strategy_id: str, current_user: dict = Depends(auth.get_current_user)):
    strategy_id = strategy_id.lower()
    key = (current_user["id"], strategy_id)
    item = RUNNING_TASKS.pop(key, None)
    run_id = None
    if item:
        item["task"].cancel()
        run_id = item.get("run_id")
    else:
        existing = db.get_active_user_strategy(current_user["id"], strategy_id)
        if existing:
            run_id = existing["id"]
        else:
            raise HTTPException(status_code=404, detail="Strategy not running")
    if run_id:
        db.stop_user_strategy_run(run_id)
    OPEN_POSITION.pop(key, None)
    token = current_user_ctx.set(current_user["id"])
    log_detail(strategy_id, "Strategy stopped")
    current_user_ctx.reset(token)
    return {"status": "stopped"}


@router.get("/strategies")
def list_strategies(current_user: dict = Depends(auth.get_current_user)):
    """Return available strategies and running status."""
    active_runs = {
        run["strategy_id"]
        for run in db.get_active_user_strategies(current_user["id"])
    }
    results = []
    for sid, name in AVAILABLE_STRATEGIES.items():
        results.append({
            "id": sid,
            "name": name,
            "running": (current_user["id"], sid) in RUNNING_TASKS or sid in active_runs,
        })
    return {"strategies": results}
