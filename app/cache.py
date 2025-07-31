import os
import redis
from redis.exceptions import RedisError

REDIS_URL = os.getenv("REDIS_URL", "")

try:
    redis_client = redis.from_url(REDIS_URL) if REDIS_URL else None
    if redis_client:
        redis_client.ping()
except RedisError:
    redis_client = None


def cache_market_data(symbol: str, data: str, expire: int = 60) -> None:
    """Store market data in Redis if available."""
    if not redis_client:
        return
    key = f"market:{symbol}"
    try:
        redis_client.set(key, data, ex=expire)
    except RedisError:
        pass


def get_cached_market_data(symbol: str):
    """Retrieve cached market data if Redis is available."""
    if not redis_client:
        return None
    key = f"market:{symbol}"
    try:
        return redis_client.get(key)
    except RedisError:
        return None
