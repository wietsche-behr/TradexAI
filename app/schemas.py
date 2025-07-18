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


class UserSettingsBase(BaseModel):
    binance_api_key: str
    binance_api_secret: str


class UserSettingsCreate(UserSettingsBase):
    pass


class UserSettings(UserSettingsBase):
    id: int
    user_id: int

    class Config:
        orm_mode = True
