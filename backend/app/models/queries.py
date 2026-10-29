"""
PrivacyVault — Query Request and Release ORM Models
Student Authors: KRISH (24BCE0846) & PARV (24BCE0870)
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Numeric, Text, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from backend.app.db.session import Base

class QueryRequest(Base):
    __tablename__ = "query_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    grant_id = Column(UUID(as_uuid=True), ForeignKey("dataset_grants.id", ondelete="RESTRICT"), nullable=False, index=True)
    analyst_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    metric = Column(String(50), nullable=False)
    target_column = Column(String(100), nullable=True)
    filter_criteria = Column(JSONB, default=list, nullable=False)
    requested_epsilon = Column(Numeric(6, 4), nullable=False)
    requested_delta = Column(Numeric(10, 8), default=0.0, nullable=False)
    status = Column(String(30), default="RECEIVED", nullable=False)
    risk_level = Column(String(20), default="LOW", nullable=False)
    risk_summary = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False, index=True)

    __table_args__ = (
        CheckConstraint("metric IN ('COUNT', 'BOUNDED_SUM', 'BOUNDED_AVG')", name="chk_metric"),
        CheckConstraint("requested_epsilon > 0", name="chk_req_eps"),
        CheckConstraint("requested_delta >= 0", name="chk_req_delta"),
        CheckConstraint("status IN ('RECEIVED', 'VALIDATED', 'RESERVED', 'EXECUTING', 'RELEASED', 'REJECTED', 'FAILED')", name="chk_status"),
        CheckConstraint("risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')", name="chk_risk_level"),
    )

    grant = relationship("DatasetGrant", back_populates="queries")
    analyst = relationship("User", foreign_keys=[analyst_id])
    release = relationship("QueryRelease", uselist=False, back_populates="request", cascade="all, delete-orphan")
    ledger_entry = relationship("PrivacyBudgetLedger", uselist=False, back_populates="request")


class QueryRelease(Base):
    __tablename__ = "query_releases"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    request_id = Column(UUID(as_uuid=True), ForeignKey("query_requests.id", ondelete="RESTRICT"), unique=True, nullable=False)
    noisy_result = Column(Numeric(18, 6), nullable=False)
    mechanism_used = Column(String(50), nullable=False)
    noise_scale = Column(Numeric(14, 6), nullable=False)
    sensitivity_applied = Column(Numeric(14, 4), nullable=False)
    epsilon_spent = Column(Numeric(6, 4), nullable=False)
    delta_spent = Column(Numeric(10, 8), nullable=False)
    released_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    request = relationship("QueryRequest", back_populates="release")
