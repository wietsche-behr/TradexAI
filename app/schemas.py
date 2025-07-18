from pydantic import BaseModel
from typing import List, Optional

class TradeBase(BaseModel):
    symbol: str
    side: str
    quantity: float
    price: float

class TradeCreate(TradeBase):
    pass

class Trade(TradeBase):
    id: int
    owner_id: int

    class Config:
        orm_mode = True

class UserBase(BaseModel):
    username: str

class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: int
    status: str
    trades: List[Trade] = []

    class Config:
        orm_mode = True
