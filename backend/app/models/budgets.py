"""
PrivacyVault — Budget and Accounting Ledger ORM Models
Student Authors: KRISH (24BCE0846) & PARV (24BCE0870)
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Numeric, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from backend.app.db.session import Base

class PrivacyBudget(Base):
    __tablename__ = "privacy_budgets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    grant_id = Column(UUID(as_uuid=True), ForeignKey("dataset_grants.id", ondelete="CASCADE"), unique=True, nullable=False)
    total_epsilon = Column(Numeric(8, 4), nullable=False)
    remaining_epsilon = Column(Numeric(8, 4), nullable=False)
    total_delta = Column(Numeric(10, 8), default=0.0, nullable=False)
    remaining_delta = Column(Numeric(10, 8), default=0.0, nullable=False)
    last_reset_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        CheckConstraint("total_epsilon > 0", name="chk_total_eps"),
        CheckConstraint("remaining_epsilon >= 0", name="chk_rem_eps"),
        CheckConstraint("total_delta >= 0", name="chk_total_delta"),
        CheckConstraint("remaining_delta >= 0", name="chk_rem_delta"),
    )

    grant = relationship("DatasetGrant", back_populates="budget")
    ledger_entries = relationship("PrivacyBudgetLedger", back_populates="budget", cascade="all, delete-orphan")


class PrivacyBudgetLedger(Base):
    __tablename__ = "privacy_budget_ledger"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    budget_id = Column(UUID(as_uuid=True), ForeignKey("privacy_budgets.id", ondelete="RESTRICT"), nullable=False, index=True)
    request_id = Column(UUID(as_uuid=True), ForeignKey("query_requests.id", ondelete="SET NULL"), nullable=True)
    amount = Column(Numeric(8, 4), nullable=False)
    transaction_type = Column(String(30), nullable=False)
    balance_after = Column(Numeric(8, 4), nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    __table_args__ = (
        CheckConstraint("transaction_type IN ('ALLOCATION', 'RESERVATION', 'COMMIT', 'REFUND')", name="chk_tx_type"),
        CheckConstraint("balance_after >= 0", name="chk_bal_after"),
    )

    budget = relationship("PrivacyBudget", back_populates="ledger_entries")
    request = relationship("QueryRequest", back_populates="ledger_entry")
