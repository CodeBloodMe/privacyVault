"""
PrivacyVault — Dataset & Governance Pydantic Schemas
Student Authors: KRISH (24BCE0846) & PARV (24BCE0870)
"""

from uuid import UUID
from datetime import datetime
from typing import Optional
from decimal import Decimal
from pydantic import BaseModel, Field, ConfigDict

class ColumnMetadataOut(BaseModel):
    id: UUID
    column_name: str
    data_type: str
    is_sensitive: bool
    is_identifier: bool
    is_aggregatable: bool
    min_bound: Optional[Decimal] = None
    max_bound: Optional[Decimal] = None

    model_config = ConfigDict(from_attributes=True)

class PolicyOut(BaseModel):
    id: UUID
    name: str
    max_epsilon_per_query: Decimal
    default_delta: Decimal
    global_epsilon_cap: Decimal
    sensitivity_clamp_low: Decimal
    sensitivity_clamp_high: Decimal
    approved_mechanisms: str
    is_active: bool

    model_config = ConfigDict(from_attributes=True)

class DatasetOut(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None
    target_table: str
    owner_id: UUID
    owner_name: Optional[str] = None
    is_active: bool
    columns: list[ColumnMetadataOut] = []
    active_policy: Optional[PolicyOut] = None

    model_config = ConfigDict(from_attributes=True)

class GrantCreate(BaseModel):
    dataset_id: UUID
    analyst_email: str
    expires_in_days: int = Field(default=30, ge=1, le=365)
    allocated_epsilon: Decimal = Field(default=Decimal("5.0000"), gt=0, le=20)

class GrantOut(BaseModel):
    id: UUID
    dataset_id: UUID
    dataset_name: str
    analyst_id: UUID
    analyst_name: str
    analyst_email: str
    granted_at: datetime
    expires_at: datetime
    is_active: bool
    total_epsilon: Decimal
    remaining_epsilon: Decimal

    model_config = ConfigDict(from_attributes=True)
