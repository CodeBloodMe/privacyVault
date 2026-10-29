"""
PrivacyVault — Authentication & User Pydantic Schemas
Student Authors: KRISH (24BCE0846) & PARV (24BCE0870)
"""

from uuid import UUID
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, ConfigDict

class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)

class UserOut(BaseModel):
    id: UUID
    email: EmailStr
    full_name: str
    is_active: bool
    roles: list[str]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserOut
