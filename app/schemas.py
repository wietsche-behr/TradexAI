from pydantic import BaseModel, ConfigDict
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

    model_config = ConfigDict(from_attributes=True)

class UserBase(BaseModel):
    username: str

class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: int
    status: str
    total_profit: float = 0.0
    trades: List[Trade] = []

    model_config = ConfigDict(from_attributes=True)


class UserSettingsBase(BaseModel):
    binance_api_key: str
    binance_api_secret: str


class UserSettingsCreate(UserSettingsBase):
    pass


class UserSettings(UserSettingsBase):
    id: int
    user_id: int

    model_config = ConfigDict(from_attributes=True)


class BotConfigBase(BaseModel):
    strategy: str
    risk_level: str
    market: str
    is_active: bool
    amount: float | None = None


class BotConfigCreate(BotConfigBase):
    pass


class BotConfig(BotConfigBase):
    id: int
    user_id: int

    model_config = ConfigDict(from_attributes=True)


class CompletedTradeCreate(BaseModel):
    strategy_id: str
    symbol: str
    entry_price: float
    exit_price: float
    quantity: float
    commission_entry: Optional[float] = None
    commission_exit: Optional[float] = None
