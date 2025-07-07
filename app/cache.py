import os
import redis

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

redis_client = redis.from_url(REDIS_URL)

def cache_market_data(symbol: str, data: str, expire: int = 60):
    key = f"market:{symbol}"
    redis_client.set(key, data, ex=expire)


def get_cached_market_data(symbol: str):
    key = f"market:{symbol}"
    return redis_client.get(key)
