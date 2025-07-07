from sqlalchemy.orm import Session
from fastapi import HTTPException

from . import models, schemas


def create_trade(db: Session, trade: schemas.TradeCreate, user_id: int) -> models.Trade:
    db_trade = models.Trade(**trade.dict(), owner_id=user_id)
    db.add(db_trade)
    db.commit()
    db.refresh(db_trade)
    return db_trade


def get_trade(db: Session, trade_id: int) -> models.Trade:
    trade = db.query(models.Trade).filter(models.Trade.id == trade_id).first()
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")
    return trade


def get_trades(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Trade).offset(skip).limit(limit).all()


def update_trade(db: Session, trade_id: int, trade: schemas.TradeCreate):
    db_trade = get_trade(db, trade_id)
    for key, value in trade.dict().items():
        setattr(db_trade, key, value)
    db.commit()
    db.refresh(db_trade)
    return db_trade


def delete_trade(db: Session, trade_id: int):
    db_trade = get_trade(db, trade_id)
    db.delete(db_trade)
    db.commit()
    return db_trade
