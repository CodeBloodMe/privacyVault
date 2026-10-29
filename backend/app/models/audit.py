"""
PrivacyVault — Audit Event ORM Model
Student Authors: KRISH (24BCE0846) & PARV (24BCE0870)
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from backend.app.db.session import Base

class AuditEvent(Base):
    __tablename__ = "audit_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_timestamp = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False, index=True)
    actor_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    event_type = Column(String(100), nullable=False)
    resource_type = Column(String(50), nullable=True)
    resource_id = Column(String(100), nullable=True)
    outcome = Column(String(20), nullable=False)
    client_ip = Column(String(45), nullable=True)
    details = Column(JSONB, default=dict, nullable=False)

    __table_args__ = (
        CheckConstraint("outcome IN ('SUCCESS', 'DENIED', 'ERROR')", name="chk_outcome"),
    )

    actor = relationship("User", back_populates="audit_events")
