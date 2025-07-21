from fastapi import APIRouter, Depends, HTTPException, Body
from binance.client import Client
import pandas as pd
import pandas_ta as ta

from . import auth
from .supabase_db import db

router = APIRouter()


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
        df.ta.ema(length=self.ema_length, append=True, col_names=(f"EMA_{self.ema_length}",))

        # 2. Squeeze indicators (Bollinger Bands & Keltner Channels)
        df.ta.bbands(length=self.squeeze_length, std=self.bb_mult, append=True)
        df.ta.kc(length=self.squeeze_length, scalar=self.kc_mult, append=True)

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

