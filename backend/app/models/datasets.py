"""
PrivacyVault — Dataset, Column, Policy, and Grant ORM Models
Student Authors: KRISH (24BCE0846) & PARV (24BCE0870)
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text, Numeric, UniqueConstraint, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from backend.app.db.session import Base

class Dataset(Base):
    __tablename__ = "datasets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    target_table = Column(String(100), nullable=False)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    owner = relationship("User", back_populates="owned_datasets")
    columns = relationship("DatasetColumn", back_populates="dataset", cascade="all, delete-orphan")
    policies = relationship("PrivacyPolicy", back_populates="dataset", cascade="all, delete-orphan")
    grants = relationship("DatasetGrant", back_populates="dataset")


class DatasetColumn(Base):
    __tablename__ = "dataset_columns"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dataset_id = Column(UUID(as_uuid=True), ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False)
    column_name = Column(String(100), nullable=False)
    data_type = Column(String(50), nullable=False)
    is_sensitive = Column(Boolean, default=True, nullable=False)
    is_identifier = Column(Boolean, default=False, nullable=False)
    is_aggregatable = Column(Boolean, default=True, nullable=False)
    min_bound = Column(Numeric(14, 4), nullable=True)
    max_bound = Column(Numeric(14, 4), nullable=True)

    __table_args__ = (
        UniqueConstraint("dataset_id", "column_name", name="uq_dataset_column"),
    )

    dataset = relationship("Dataset", back_populates="columns")


class PrivacyPolicy(Base):
    __tablename__ = "privacy_policies"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dataset_id = Column(UUID(as_uuid=True), ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    max_epsilon_per_query = Column(Numeric(6, 4), nullable=False)
    default_delta = Column(Numeric(10, 8), default=0.0, nullable=False)
    global_epsilon_cap = Column(Numeric(6, 4), nullable=False)
    sensitivity_clamp_low = Column(Numeric(14, 4), nullable=False)
    sensitivity_clamp_high = Column(Numeric(14, 4), nullable=False)
    approved_mechanisms = Column(String(100), default="OPENDP_LAPLACE", nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    __table_args__ = (
        CheckConstraint("max_epsilon_per_query > 0 AND max_epsilon_per_query <= 5.0", name="chk_max_eps"),
        CheckConstraint("default_delta >= 0", name="chk_delta"),
        CheckConstraint("global_epsilon_cap >= max_epsilon_per_query", name="chk_global_cap"),
    )

    dataset = relationship("Dataset", back_populates="policies")


class DatasetGrant(Base):
    __tablename__ = "dataset_grants"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dataset_id = Column(UUID(as_uuid=True), ForeignKey("datasets.id", ondelete="RESTRICT"), nullable=False)
    analyst_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    granted_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    granted_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    __table_args__ = (
        UniqueConstraint("dataset_id", "analyst_id", name="uq_dataset_analyst_grant"),
    )

    dataset = relationship("Dataset", back_populates="grants")
    analyst = relationship("User", foreign_keys=[analyst_id], back_populates="grants")
    granter = relationship("User", foreign_keys=[granted_by])
    budget = relationship("PrivacyBudget", uselist=False, back_populates="grant", cascade="all, delete-orphan")
    queries = relationship("QueryRequest", back_populates="grant")
