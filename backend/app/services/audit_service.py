"""
PrivacyVault — Audit Logging Service
Student Authors: KRISH (24BCE0846) & PARV (24BCE0870)
"""

import uuid
from typing import Optional, Any
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from backend.app.models.audit import AuditEvent

class AuditService:
    @staticmethod
    def log_event(
        db: Session,
        event_type: str,
        outcome: str,
        actor_user_id: Optional[uuid.UUID] = None,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        client_ip: Optional[str] = None,
        details: Optional[dict[str, Any]] = None
    ) -> AuditEvent:
        """
        Appends an immutable audit event to the audit_events table.
        """
        event = AuditEvent(
            id=uuid.uuid4(),
            event_timestamp=datetime.now(timezone.utc),
            actor_user_id=actor_user_id,
            event_type=event_type,
            resource_type=resource_type,
            resource_id=str(resource_id) if resource_id else None,
            outcome=outcome,
            client_ip=client_ip,
            details=details or {}
        )
        db.add(event)
        db.commit()
        db.refresh(event)
        return event
