from fastapi import APIRouter
from binance.client import Client
import json
from . import cache

router = APIRouter()

@router.get("/klines")
def get_klines(pair: str, interval: str = "1h", limit: int = 100):
    """Return recent kline and ticker data for a trading pair."""
    symbol = pair.replace("/", "")
    cache_key = f"{symbol}:{interval}"
    cached = cache.get_cached_market_data(cache_key)
    if cached:
        return json.loads(cached.decode())

    client = Client()
    try:
        klines = client.get_klines(symbol=symbol, interval=interval, limit=limit)
        ticker = client.get_ticker(symbol=symbol)
    except Exception as e:
        return {"error": str(e)}

    data = {
        "price": float(ticker.get("lastPrice", 0)),
        "change": float(ticker.get("priceChangePercent", 0)),
        "high": float(ticker.get("highPrice", 0)),
        "low": float(ticker.get("lowPrice", 0)),
        "volume": float(ticker.get("volume", 0)),
        "klines": [
            {
                "time": k[0],
                "open": float(k[1]),
                "high": float(k[2]),
                "low": float(k[3]),
                "close": float(k[4]),
                "volume": float(k[5]),
            }
            for k in klines
        ],
    }
    cache.cache_market_data(cache_key, json.dumps(data))
    return data
