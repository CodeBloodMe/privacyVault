"""
PrivacyVault — Audit Compliance API Endpoints
Student Authors: KRISH (24BCE0846) & PARV (24BCE0870)
Course: BCSE302P Database Systems Lab (Slot L25+L26)
"""

from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import text

from backend.app.db.session import get_db
from backend.app.schemas.audit import AuditEventOut
from backend.app.api.v1.deps import require_roles
from backend.app.models.users import User

router = APIRouter(prefix="/audit", tags=["Audit & Compliance"])

@router.get("/events", response_model=list[AuditEventOut])
def get_audit_events(
    event_type: Optional[str] = Query(None, description="Filter by event type"),
    outcome: Optional[str] = Query(None, description="Filter by outcome (SUCCESS, DENIED, ERROR)"),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["AUDITOR", "ADMIN", "DATA_OWNER"]))
):
    """
    Retrieves filterable immutable audit records from analytical view v_audit_summary_log.
    Restricted to AUDITOR, DATA_OWNER, and ADMIN roles.
    """
    sql = """
        SELECT 
            event_id, event_timestamp, event_type, outcome,
            actor_email, actor_name, resource_type, resource_id, client_ip, details
        FROM v_audit_summary_log
        WHERE 1=1
    """
    params = {}
    if event_type:
        sql += " AND event_type = :event_type"
        params["event_type"] = event_type
    if outcome:
        sql += " AND outcome = :outcome"
        params["outcome"] = outcome

    sql += " ORDER BY event_timestamp DESC LIMIT :limit;"
    params["limit"] = limit

    rows = db.execute(text(sql), params).fetchall()
    results = []
    for r in rows:
        results.append(AuditEventOut(
            id=r[0],
            event_timestamp=r[1],
            event_type=r[2],
            outcome=r[3],
            actor_email=r[4],
            actor_name=r[5],
            resource_type=r[6],
            resource_id=r[7],
            client_ip=r[8],
            details=r[9] or {}
        ))
    return results
