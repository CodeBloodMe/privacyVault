"""
PrivacyVault — User and Role ORM Models
Student Authors: KRISH (24BCE0846) & PARV (24BCE0870)
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Table
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from backend.app.db.session import Base

class UserRole(Base):
    __tablename__ = "user_roles"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    role_name = Column(String(50), ForeignKey("roles.name", ondelete="RESTRICT"), primary_key=True)
    assigned_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)


class Role(Base):
    __tablename__ = "roles"

    name = Column(String(50), primary_key=True)
    description = Column(String(255), nullable=True)

    users = relationship("User", secondary="user_roles", back_populates="roles")


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(150), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    roles = relationship("Role", secondary="user_roles", back_populates="users", lazy="joined")
    owned_datasets = relationship("Dataset", back_populates="owner")
    grants = relationship("DatasetGrant", foreign_keys="DatasetGrant.analyst_id", back_populates="analyst")
    audit_events = relationship("AuditEvent", back_populates="actor")
