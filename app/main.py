from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os

from . import schemas, crud, auth, cache, settings

app = FastAPI(title="Tradex API")

# Configure CORS so that browser-based frontends can interact with the API
origins_env = os.getenv("CORS_ORIGINS")
origins = origins_env.split(",") if origins_env else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(settings.router)


@app.post("/trades/", response_model=schemas.Trade)
def create_trade(
    trade: schemas.TradeCreate, current_user: dict = Depends(auth.get_current_user)
):
    return crud.create_trade(trade, current_user["id"])


@app.get("/trades/", response_model=list[schemas.Trade])
def read_trades(
    skip: int = 0, limit: int = 100, current_user: dict = Depends(auth.get_current_user)
):
    return crud.get_trades(current_user["id"], skip=skip, limit=limit)


@app.get("/trades/{trade_id}", response_model=schemas.Trade)
def read_trade(trade_id: int, current_user: dict = Depends(auth.get_current_user)):
    trade = crud.get_trade(trade_id)
    if trade["owner_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized to view this trade")
    return trade


@app.put("/trades/{trade_id}", response_model=schemas.Trade)
def update_trade(
    trade_id: int,
    trade: schemas.TradeCreate,
    current_user: dict = Depends(auth.get_current_user),
):
    existing = crud.get_trade(trade_id)
    if existing["owner_id"] != current_user["id"]:
        raise HTTPException(
            status_code=403, detail="Not authorized to update this trade"
        )
    return crud.update_trade(trade_id, trade)


@app.delete("/trades/{trade_id}", response_model=schemas.Trade)
def delete_trade(trade_id: int, current_user: dict = Depends(auth.get_current_user)):
    existing = crud.get_trade(trade_id)
    if existing["owner_id"] != current_user["id"]:
        raise HTTPException(
            status_code=403, detail="Not authorized to delete this trade"
        )
    return crud.delete_trade(trade_id)


@app.get("/market/{symbol}")
def get_market(symbol: str):
    cached = cache.get_cached_market_data(symbol)
    if cached:
        return {"symbol": symbol, "data": cached.decode()}
    # placeholder for real market data fetch
    data = "sample data"
    cache.cache_market_data(symbol, data)
    return {"symbol": symbol, "data": data}
