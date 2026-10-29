"""
PrivacyVault — Audit Event Pydantic Schemas
Student Authors: KRISH (24BCE0846) & PARV (24BCE0870)
"""

from uuid import UUID
from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel, ConfigDict

class AuditEventOut(BaseModel):
    id: UUID
    event_timestamp: datetime
    actor_user_id: Optional[UUID] = None
    actor_email: Optional[str] = None
    actor_name: Optional[str] = None
    event_type: str
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    outcome: str
    client_ip: Optional[str] = None
    details: dict[str, Any] = {}

    model_config = ConfigDict(from_attributes=True)
