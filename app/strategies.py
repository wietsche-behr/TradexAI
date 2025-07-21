from fastapi import APIRouter, Depends, HTTPException, Body
from binance.client import Client
import pandas as pd

from . import auth
from .supabase_db import db

router = APIRouter()


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
    return {"sell": order}


class SqueezeBreakoutStrategy:
    """Implements a Bollinger/Keltner squeeze breakout strategy."""

    def __init__(self):
        """Initialize indicator parameters."""
        self.ema_length = 200
        self.squeeze_length = 20
        self.bb_mult = 2.0
        self.kc_mult = 1.5
        print("Squeeze Breakout Strategy Initialized")

    def check_signal(self, df: pd.DataFrame) -> str:
        """Return BUY, SELL or HOLD for the latest candle."""
        # --- Calculate Indicators ---
        # 1. Trend filter EMA
        df[f"EMA_{self.ema_length}"] = ema(df["close"], self.ema_length)

        # 2. Squeeze indicators (Bollinger Bands & Keltner Channels)
        bbl, bbu = bollinger_bands(df["close"], self.squeeze_length, self.bb_mult)
        df[f"BBL_{self.squeeze_length}_{self.bb_mult}"] = bbl
        df[f"BBU_{self.squeeze_length}_{self.bb_mult}"] = bbu
        kcl, kcu = keltner_channels(df, self.squeeze_length, self.kc_mult)
        df[f"KCL_{self.squeeze_length}_{self.kc_mult}"] = kcl
        df[f"KCU_{self.squeeze_length}_{self.kc_mult}"] = kcu

        # 3. Donchian Channels for entry/exit
        df["don_h"] = df["high"].rolling(self.squeeze_length).max()
        df["don_l"] = df["low"].rolling(self.squeeze_length).min()

        # --- Get Latest Data ---
        latest = df.iloc[-1]
        previous = df.iloc[-2]

        # --- Strategy Conditions ---
        is_bull_market = latest["close"] > latest[f"EMA_{self.ema_length}"]

        squeeze_on_latest = (
            latest[f"BBL_{self.squeeze_length}_{self.bb_mult}"] > latest[f"KCL_{self.squeeze_length}_{self.kc_mult}"]
            and latest[f"BBU_{self.squeeze_length}_{self.bb_mult}"] < latest[f"KCU_{self.squeeze_length}_{self.kc_mult}"]
        )
        squeeze_on_previous = (
            previous[f"BBL_{self.squeeze_length}_{self.bb_mult}"] > previous[f"KCL_{self.squeeze_length}_{self.kc_mult}"]
            and previous[f"BBU_{self.squeeze_length}_{self.bb_mult}"] < previous[f"KCU_{self.squeeze_length}_{self.kc_mult}"]
        )
        squeeze_was_active = squeeze_on_latest or squeeze_on_previous

        entry_signal = latest["close"] > previous["don_h"]
        exit_signal = latest["close"] < previous["don_l"]

        if is_bull_market and squeeze_was_active and entry_signal:
            return "BUY"
        if exit_signal:
            return "SELL"
        return "HOLD"


class SqueezeBreakoutStrategy_DOGE_1H:
    """Squeeze Breakout strategy for DOGEUSDT on the 1H timeframe."""

    def __init__(self):
        """Initialize indicator parameters for DOGE/USDT."""
        self.symbol = "DOGEUSDT"
        self.interval = "1h"
        self.ema_length = 200
        self.squeeze_length = 20
        self.bb_mult = 2.0
        self.kc_mult = 1.5
        print("Squeeze Breakout Strategy for DOGE/USDT (1H) Initialized")

    def check_signal(self, df: pd.DataFrame) -> str:
        """Return BUY, SELL or HOLD for the latest candle."""
        # --- Calculate Indicators ---
        # 1. Trend filter EMA
        df[f"EMA_{self.ema_length}"] = ema(df["close"], self.ema_length)

        # 2. Squeeze indicators (Bollinger Bands & Keltner Channels)
        bbl, bbu = bollinger_bands(df["close"], self.squeeze_length, self.bb_mult)
        df[f"BBL_{self.squeeze_length}_{self.bb_mult}"] = bbl
        df[f"BBU_{self.squeeze_length}_{self.bb_mult}"] = bbu
        kcl, kcu = keltner_channels(df, self.squeeze_length, self.kc_mult)
        df[f"KCL_{self.squeeze_length}_{self.kc_mult}"] = kcl
        df[f"KCU_{self.squeeze_length}_{self.kc_mult}"] = kcu

        # 3. Donchian Channels for entry/exit
        df["don_h"] = df["high"].rolling(self.squeeze_length).max()
        df["don_l"] = df["low"].rolling(self.squeeze_length).min()

        # --- Get Latest Data ---
        latest = df.iloc[-1]
        previous = df.iloc[-2]

        # --- Strategy Conditions ---
        is_bull_market = latest["close"] > latest[f"EMA_{self.ema_length}"]

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

        entry_signal = latest["close"] > previous["don_h"]
        exit_signal = latest["close"] < previous["don_l"]

        if is_bull_market and squeeze_was_active and entry_signal:
            return "BUY"
        if exit_signal:
            return "SELL"
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
    strategy = SqueezeBreakoutStrategy()
    signal = strategy.check_signal(df.copy())
    print(f"The final signal for the latest candle is: {signal}")

