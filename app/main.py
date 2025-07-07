from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session

from . import models, schemas, crud, auth, cache
from .database import engine, Base, SessionLocal

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Tradex API")

app.include_router(auth.router)

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.post("/trades/", response_model=schemas.Trade)
def create_trade(trade: schemas.TradeCreate,
                 current_user: models.User = Depends(auth.get_current_user),
                 db: Session = Depends(get_db)):
    return crud.create_trade(db, trade, current_user.id)

@app.get("/trades/", response_model=list[schemas.Trade])
def read_trades(skip: int = 0, limit: int = 100,
                current_user: models.User = Depends(auth.get_current_user),
                db: Session = Depends(get_db)):
    return db.query(models.Trade).filter(models.Trade.owner_id == current_user.id).offset(skip).limit(limit).all()

@app.get("/trades/{trade_id}", response_model=schemas.Trade)
def read_trade(trade_id: int,
               current_user: models.User = Depends(auth.get_current_user),
               db: Session = Depends(get_db)):
    trade = crud.get_trade(db, trade_id)
    if trade.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view this trade")
    return trade

@app.put("/trades/{trade_id}", response_model=schemas.Trade)
def update_trade(trade_id: int, trade: schemas.TradeCreate,
                 current_user: models.User = Depends(auth.get_current_user),
                 db: Session = Depends(get_db)):
    existing = crud.get_trade(db, trade_id)
    if existing.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to update this trade")
    return crud.update_trade(db, trade_id, trade)

@app.delete("/trades/{trade_id}", response_model=schemas.Trade)
def delete_trade(trade_id: int,
                 current_user: models.User = Depends(auth.get_current_user),
                 db: Session = Depends(get_db)):
    existing = crud.get_trade(db, trade_id)
    if existing.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this trade")
    return crud.delete_trade(db, trade_id)

@app.get("/market/{symbol}")
def get_market(symbol: str):
    cached = cache.get_cached_market_data(symbol)
    if cached:
        return {"symbol": symbol, "data": cached.decode()}
    # placeholder for real market data fetch
    data = "sample data"
    cache.cache_market_data(symbol, data)
    return {"symbol": symbol, "data": data}
