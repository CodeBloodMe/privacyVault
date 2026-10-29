"""
PrivacyVault — Budget & Ledger Pydantic Schemas
Student Authors: KRISH (24BCE0846) & PARV (24BCE0870)
"""

from uuid import UUID
from datetime import datetime
from typing import Optional
from decimal import Decimal
from pydantic import BaseModel, ConfigDict

class LedgerEntryOut(BaseModel):
    id: UUID
    budget_id: UUID
    request_id: Optional[UUID] = None
    amount: Decimal
    transaction_type: str
    balance_after: Decimal
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class BudgetSummaryOut(BaseModel):
    grant_id: UUID
    analyst_id: UUID
    analyst_name: str
    analyst_email: str
    dataset_id: UUID
    dataset_name: str
    budget_id: UUID
    total_epsilon: Decimal
    remaining_epsilon: Decimal
    spent_epsilon: Decimal
    budget_utilization_pct: Decimal
    expires_at: datetime
    grant_active: bool
    last_budget_activity: datetime

    model_config = ConfigDict(from_attributes=True)
