from fastapi import APIRouter, Depends, HTTPException, Body
from binance.client import Client
import pandas as pd

from . import auth
from .supabase_db import db

router = APIRouter()

# simple in-memory logs for demo purposes
STRATEGY_LOGS = {
    "squeeze_breakout": {"detail": [], "trade": []},
    "squeeze_breakout_doge_1h": {"detail": [], "trade": []},
    "squeeze_breakout_sol_4h": {"detail": [], "trade": []},
}


def _log(strategy_id: str, message: str, log_type: str = "detail") -> None:
    """Append a log message for a strategy."""
    logs = STRATEGY_LOGS.setdefault(strategy_id, {"detail": [], "trade": []})
    logs.setdefault(log_type, []).append(message)


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
    tr = df["high"] - df["low"]
    tr_ema = tr.ewm(span=length, adjust=False).mean()
    upper = tp_ema + mult * tr_ema
    lower = tp_ema - mult * tr_ema
    return lower, upper


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


@router.post("/strategy/{strategy_id}/run")
def run_strategy(
    strategy_id: str,
    amount: float = Body(0.0, embed=True),
    symbol: str | None = Body(None, embed=True),
    current_user: dict = Depends(auth.get_current_user),
):
    """Execute a single evaluation of the strategy and log the steps."""
    client = _get_client(current_user["id"])
    _log(strategy_id, f"Strategy started with amount {amount}")
    if strategy_id == "squeeze_breakout":
        if not symbol:
            raise HTTPException(status_code=400, detail="symbol required")
        strategy = SqueezeBreakoutStrategy(trade_amount=amount)
        interval = Client.KLINE_INTERVAL_1HOUR
    elif strategy_id == "squeeze_breakout_doge_1h":
        strategy = SqueezeBreakoutStrategy_DOGE_1H(trade_amount=amount)
        symbol = strategy.symbol
        interval = strategy.interval
    elif strategy_id == "squeeze_breakout_sol_4h":
        strategy = SqueezeBreakoutStrategy_SOL_4H(trade_amount=amount)
        symbol = strategy.symbol
        interval = strategy.interval
    else:
        raise HTTPException(status_code=404, detail="Unknown strategy")

    try:
        klines = client.get_klines(symbol=symbol, interval=interval, limit=strategy.ema_length + 50)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    df = pd.DataFrame(klines, columns=[
        "open_time",
        "open",
        "high",
        "low",
        "close",
        "volume",
        "close_time",
        "quote_asset_volume",
        "number_of_trades",
        "taker_buy_base_volume",
        "taker_buy_quote_volume",
        "ignore",
    ])
    df = df.astype({"open": float, "high": float, "low": float, "close": float, "volume": float})

    signal = strategy.check_signal(df)
    _log(strategy.strategy_id, f"Final signal: {signal}")
    return {"signal": signal}


class SqueezeBreakoutStrategy:
    """Implements a Bollinger/Keltner squeeze breakout strategy."""

    def __init__(self, trade_amount: float = 0.0):
        """Initialize indicator parameters."""
        self.strategy_id = "squeeze_breakout"
        self.ema_length = 200
        self.squeeze_length = 20
        self.bb_mult = 2.0
        self.kc_mult = 1.5
        self.trade_amount = trade_amount
        _log(self.strategy_id, "Strategy initialized")

    def check_signal(self, df: pd.DataFrame) -> str:
        """Return BUY, SELL or HOLD for the latest candle."""
        # --- Calculate Indicators ---
        # 1. Trend filter EMA
        df[f"EMA_{self.ema_length}"] = ema(df["close"], self.ema_length)
        _log(self.strategy_id, f"Calculated EMA{self.ema_length}")

        # 2. Squeeze indicators (Bollinger Bands & Keltner Channels)
        bbl, bbu = bollinger_bands(df["close"], self.squeeze_length, self.bb_mult)
        df[f"BBL_{self.squeeze_length}_{self.bb_mult}"] = bbl
        df[f"BBU_{self.squeeze_length}_{self.bb_mult}"] = bbu
        kcl, kcu = keltner_channels(df, self.squeeze_length, self.kc_mult)
        df[f"KCL_{self.squeeze_length}_{self.kc_mult}"] = kcl
        df[f"KCU_{self.squeeze_length}_{self.kc_mult}"] = kcu
        _log(self.strategy_id, "Computed Bollinger Bands and Keltner Channels")

        # 3. Donchian Channels for entry/exit
        df["don_h"] = df["high"].rolling(self.squeeze_length).max()
        df["don_l"] = df["low"].rolling(self.squeeze_length).min()
        _log(self.strategy_id, "Calculated Donchian Channels")

        # --- Get Latest Data ---
        latest = df.iloc[-1]
        previous = df.iloc[-2]

        # --- Strategy Conditions ---
        is_bull_market = latest["close"] > latest[f"EMA_{self.ema_length}"]
        _log(
            self.strategy_id,
            "Price above EMA - bullish trend" if is_bull_market else "Price below EMA - bearish trend",
        )

        squeeze_on_latest = (
            latest[f"BBL_{self.squeeze_length}_{self.bb_mult}"] > latest[f"KCL_{self.squeeze_length}_{self.kc_mult}"]
            and latest[f"BBU_{self.squeeze_length}_{self.bb_mult}"] < latest[f"KCU_{self.squeeze_length}_{self.kc_mult}"]
        )
        squeeze_on_previous = (
            previous[f"BBL_{self.squeeze_length}_{self.bb_mult}"] > previous[f"KCL_{self.squeeze_length}_{self.kc_mult}"]
            and previous[f"BBU_{self.squeeze_length}_{self.bb_mult}"] < previous[f"KCU_{self.squeeze_length}_{self.kc_mult}"]
        )
        squeeze_was_active = squeeze_on_latest or squeeze_on_previous
        _log(self.strategy_id, "Squeeze condition active" if squeeze_was_active else "No squeeze detected")

        entry_signal = latest["close"] > previous["don_h"]
        exit_signal = latest["close"] < previous["don_l"]
        if entry_signal:
            _log(self.strategy_id, "Breakout above Donchian high - potential BUY")
        if exit_signal:
            _log(self.strategy_id, "Breakdown below Donchian low - potential SELL")

        if is_bull_market and squeeze_was_active and entry_signal:
            _log(self.strategy_id, "Signal -> BUY")
            return "BUY"
        if exit_signal:
            _log(self.strategy_id, "Signal -> SELL")
            return "SELL"
        _log(self.strategy_id, "Signal -> HOLD")
        return "HOLD"


class SqueezeBreakoutStrategy_DOGE_1H:
    """Squeeze Breakout strategy for DOGEUSDT on the 1H timeframe."""

    def __init__(self, trade_amount: float = 0.0):
        """Initialize indicator parameters for DOGE/USDT."""
        self.strategy_id = "squeeze_breakout_doge_1h"
        self.symbol = "DOGEUSDT"
        self.interval = "1h"
        self.ema_length = 200
        self.squeeze_length = 20
        self.bb_mult = 2.0
        self.kc_mult = 1.5
        self.trade_amount = trade_amount
        _log(self.strategy_id, "Strategy initialized")

    def check_signal(self, df: pd.DataFrame) -> str:
        """Return BUY, SELL or HOLD for the latest candle."""
        # --- Calculate Indicators ---
        # 1. Trend filter EMA
        df[f"EMA_{self.ema_length}"] = ema(df["close"], self.ema_length)
        _log(self.strategy_id, f"Calculated EMA{self.ema_length}")

        # 2. Squeeze indicators (Bollinger Bands & Keltner Channels)
        bbl, bbu = bollinger_bands(df["close"], self.squeeze_length, self.bb_mult)
        df[f"BBL_{self.squeeze_length}_{self.bb_mult}"] = bbl
        df[f"BBU_{self.squeeze_length}_{self.bb_mult}"] = bbu
        kcl, kcu = keltner_channels(df, self.squeeze_length, self.kc_mult)
        df[f"KCL_{self.squeeze_length}_{self.kc_mult}"] = kcl
        df[f"KCU_{self.squeeze_length}_{self.kc_mult}"] = kcu
        _log(self.strategy_id, "Computed Bollinger Bands and Keltner Channels")

        # 3. Donchian Channels for entry/exit
        df["don_h"] = df["high"].rolling(self.squeeze_length).max()
        df["don_l"] = df["low"].rolling(self.squeeze_length).min()
        _log(self.strategy_id, "Calculated Donchian Channels")

        # --- Get Latest Data ---
        latest = df.iloc[-1]
        previous = df.iloc[-2]

        # --- Strategy Conditions ---
        is_bull_market = latest["close"] > latest[f"EMA_{self.ema_length}"]
        _log(
            self.strategy_id,
            "Price above EMA - bullish trend" if is_bull_market else "Price below EMA - bearish trend",
        )

        squeeze_on_latest = (
            latest[f"BBL_{self.squeeze_length}_{self.bb_mult}"]
            > latest[f"KCL_{self.squeeze_length}_{self.kc_mult}"]
            and latest[f"BBU_{self.squeeze_length}_{self.bb_mult}"]
            < latest[f"KCU_{self.squeeze_length}_{self.kc_mult}"]
        )
        squeeze_on_previous = (
            previous[f"BBL_{self.squeeze_length}_{self.bb_mult}"]
            > previous[f"KCL_{self.squeeze_length}_{self.kc_mult}"]
            and previous[f"BBU_{self.squeeze_length}_{self.bb_mult}"]
            < previous[f"KCU_{self.squeeze_length}_{self.kc_mult}"]
        )
        squeeze_was_active = squeeze_on_latest or squeeze_on_previous
        _log(self.strategy_id, "Squeeze condition active" if squeeze_was_active else "No squeeze detected")

        entry_signal = latest["close"] > previous["don_h"]
        exit_signal = latest["close"] < previous["don_l"]
        if entry_signal:
            _log(self.strategy_id, "Breakout above Donchian high - potential BUY")
        if exit_signal:
            _log(self.strategy_id, "Breakdown below Donchian low - potential SELL")

        if is_bull_market and squeeze_was_active and entry_signal:
            _log(self.strategy_id, "Signal -> BUY")
            return "BUY"
        if exit_signal:
            _log(self.strategy_id, "Signal -> SELL")
            return "SELL"
        _log(self.strategy_id, "Signal -> HOLD")
        return "HOLD"


class SqueezeBreakoutStrategy_SOL_4H:
    """Squeeze Breakout strategy for SOLUSDT on the 4H timeframe."""

    def __init__(self, trade_amount: float = 0.0):
        """Initialize indicator parameters for SOL/USDT."""
        self.strategy_id = "squeeze_breakout_sol_4h"
        self.symbol = "SOLUSDT"
        self.interval = "4h"
        self.ema_length = 200
        self.squeeze_length = 20
        self.bb_mult = 2.0
        self.kc_mult = 1.5
        self.trade_amount = trade_amount
        _log(self.strategy_id, "Strategy initialized")

    def check_signal(self, df: pd.DataFrame) -> str:
        """Return BUY, SELL or HOLD for the latest candle."""
        # --- Calculate Indicators ---
        # 1. Trend filter EMA
        df[f"EMA_{self.ema_length}"] = ema(df["close"], self.ema_length)
        _log(self.strategy_id, f"Calculated EMA{self.ema_length}")

        # 2. Squeeze indicators (Bollinger Bands & Keltner Channels)
        bbl, bbu = bollinger_bands(df["close"], self.squeeze_length, self.bb_mult)
        df[f"BBL_{self.squeeze_length}_{self.bb_mult}"] = bbl
        df[f"BBU_{self.squeeze_length}_{self.bb_mult}"] = bbu
        kcl, kcu = keltner_channels(df, self.squeeze_length, self.kc_mult)
        df[f"KCL_{self.squeeze_length}_{self.kc_mult}"] = kcl
        df[f"KCU_{self.squeeze_length}_{self.kc_mult}"] = kcu
        _log(self.strategy_id, "Computed Bollinger Bands and Keltner Channels")

        # 3. Donchian Channels for entry/exit
        df["don_h"] = df["high"].rolling(self.squeeze_length).max()
        df["don_l"] = df["low"].rolling(self.squeeze_length).min()
        _log(self.strategy_id, "Calculated Donchian Channels")

        # --- Get Latest Data ---
        latest = df.iloc[-1]
        previous = df.iloc[-2]

        # --- Strategy Conditions ---
        is_bull_market = latest["close"] > latest[f"EMA_{self.ema_length}"]
        _log(
            self.strategy_id,
            "Price above EMA - bullish trend" if is_bull_market else "Price below EMA - bearish trend",
        )

        squeeze_on_latest = (
            latest[f"BBL_{self.squeeze_length}_{self.bb_mult}"]
            > latest[f"KCL_{self.squeeze_length}_{self.kc_mult}"]
            and latest[f"BBU_{self.squeeze_length}_{self.bb_mult}"]
            < latest[f"KCU_{self.squeeze_length}_{self.kc_mult}"]
        )
        squeeze_on_previous = (
            previous[f"BBL_{self.squeeze_length}_{self.bb_mult}"]
            > previous[f"KCL_{self.squeeze_length}_{self.kc_mult}"]
            and previous[f"BBU_{self.squeeze_length}_{self.bb_mult}"]
            < previous[f"KCU_{self.squeeze_length}_{self.kc_mult}"]
        )
        squeeze_was_active = squeeze_on_latest or squeeze_on_previous
        _log(self.strategy_id, "Squeeze condition active" if squeeze_was_active else "No squeeze detected")

        entry_signal = latest["close"] > previous["don_h"]
        exit_signal = latest["close"] < previous["don_l"]
        if entry_signal:
            _log(self.strategy_id, "Breakout above Donchian high - potential BUY")
        if exit_signal:
            _log(self.strategy_id, "Breakdown below Donchian low - potential SELL")

        if is_bull_market and squeeze_was_active and entry_signal:
            _log(self.strategy_id, "Signal -> BUY")
            return "BUY"
        if exit_signal:
            _log(self.strategy_id, "Signal -> SELL")
            return "SELL"
        _log(self.strategy_id, "Signal -> HOLD")
        return "HOLD"


if __name__ == "__main__":
    dummy_data = {
        "open": [100] * 210,
        "high": [100] * 210,
        "low": [100] * 210,
        "close": [100] * 210,
        "volume": [100] * 210,
    }
    df = pd.DataFrame(dummy_data)
    strategy = SqueezeBreakoutStrategy(trade_amount=10.0)
    signal = strategy.check_signal(df.copy())
    print(f"The final signal for the latest candle is: {signal}")

