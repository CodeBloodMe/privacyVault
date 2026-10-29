"""
PrivacyVault — Query Validation & Differential Privacy Release API Endpoints
Student Authors: KRISH (24BCE0846) & PARV (24BCE0870)
Course: BCSE302P Database Systems Lab (Slot L25+L26)
"""

from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from backend.app.db.session import get_db
from backend.app.schemas.query import (
    AggregateQueryRequest,
    QueryValidationResponse,
    QueryReleaseOut,
    QueryRequestOut
)
from backend.app.services.query_service import QueryService
from backend.app.api.v1.deps import get_current_user, require_roles
from backend.app.models.users import User
from backend.app.models.queries import QueryRequest

router = APIRouter(prefix="/queries", tags=["Privacy Gateway Analytics"])

@router.post("/validate", response_model=QueryValidationResponse)
def validate_proposed_query(
    query_in: AggregateQueryRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ANALYST", "ADMIN"]))
):
    """
    Dry-run query inspection and Query-History-Aware Risk Analysis.
    Verifies column constraints, policy bounds, and detects differencing/overlap risks
    WITHOUT spending privacy budget.
    """
    is_valid, err_msg, grant, policy, risk = QueryService.validate_query(db, current_user.id, query_in)

    return QueryValidationResponse(
        valid=is_valid,
        error=err_msg,
        risk_level=risk.risk_level,
        risk_summary=risk.risk_summary,
        differencing_detected=risk.differencing_detected,
        estimated_epsilon=query_in.requested_epsilon
    )

@router.post("/submit", response_model=QueryReleaseOut, status_code=status.HTTP_201_CREATED)
def submit_query_and_release(
    query_in: AggregateQueryRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ANALYST", "ADMIN"]))
):
    """
    Executes the 5-State Analytics Gateway lifecycle:
    RECEIVED -> VALIDATED -> RESERVED -> EXECUTING -> RELEASED
    Applies OpenDP 0.16.0 calibrated noise and atomically charges privacy budget.
    """
    client_ip = request.client.host if request.client else None
    release = QueryService.execute_query_lifecycle(
        db=db,
        analyst_id=current_user.id,
        request=query_in,
        client_ip=client_ip
    )

    q_req = release.request
    return QueryReleaseOut(
        id=release.id,
        request_id=release.request_id,
        metric=q_req.metric,
        target_column=q_req.target_column,
        noisy_result=float(release.noisy_result),
        mechanism_used=release.mechanism_used,
        noise_scale=float(release.noise_scale),
        sensitivity_applied=float(release.sensitivity_applied),
        epsilon_spent=float(release.epsilon_spent),
        delta_spent=float(release.delta_spent),
        released_at=release.released_at,
        risk_level=q_req.risk_level,
        risk_summary=q_req.risk_summary,
        author_signature="REG_24BCE0846_24BCE0870_KRISH_PARV"
    )

@router.get("/history/my", response_model=list[QueryRequestOut])
def get_my_query_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ANALYST", "ADMIN"]))
):
    """Retrieves execution and release history for the authenticated analyst."""
    requests = db.query(QueryRequest).filter(
        QueryRequest.analyst_id == current_user.id
    ).order_by(QueryRequest.created_at.desc()).limit(100).all()

    results = []
    for r in requests:
        rel_out = None
        if r.release:
            rel_out = QueryReleaseOut(
                id=r.release.id,
                request_id=r.release.request_id,
                metric=r.metric,
                target_column=r.target_column,
                noisy_result=float(r.release.noisy_result),
                mechanism_used=r.release.mechanism_used,
                noise_scale=float(r.release.noise_scale),
                sensitivity_applied=float(r.release.sensitivity_applied),
                epsilon_spent=float(r.release.epsilon_spent),
                delta_spent=float(r.release.delta_spent),
                released_at=r.release.released_at,
                risk_level=r.risk_level,
                risk_summary=r.risk_summary,
                author_signature="REG_24BCE0846_24BCE0870_KRISH_PARV"
            )

        results.append(QueryRequestOut(
            id=r.id,
            grant_id=r.grant_id,
            analyst_id=r.analyst_id,
            metric=r.metric,
            target_column=r.target_column,
            filter_criteria=r.filter_criteria,
            requested_epsilon=r.requested_epsilon,
            requested_delta=r.requested_delta,
            status=r.status,
            risk_level=r.risk_level,
            risk_summary=r.risk_summary,
            created_at=r.created_at,
            release=rel_out
        ))
    return results

@router.get("/{request_id}", response_model=QueryRequestOut)
def get_query_request_details(
    request_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieves full details and release payload of a specific query request."""
    r = db.query(QueryRequest).filter(QueryRequest.id == request_id).first()
    if not r:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Query request not found")

    # Authorize: analyst or admin or data owner
    user_roles = [role.name for role in current_user.roles]
    if "ADMIN" not in user_roles and "AUDITOR" not in user_roles and r.analyst_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this query record")

    rel_out = None
    if r.release:
        rel_out = QueryReleaseOut(
            id=r.release.id,
            request_id=r.release.request_id,
            metric=r.metric,
            target_column=r.target_column,
            noisy_result=float(r.release.noisy_result),
            mechanism_used=r.release.mechanism_used,
            noise_scale=float(r.release.noise_scale),
            sensitivity_applied=float(r.release.sensitivity_applied),
            epsilon_spent=float(r.release.epsilon_spent),
            delta_spent=float(r.release.delta_spent),
            released_at=r.release.released_at,
            risk_level=r.risk_level,
            risk_summary=r.risk_summary,
            author_signature="REG_24BCE0846_24BCE0870_KRISH_PARV"
        )

    return QueryRequestOut(
        id=r.id,
        grant_id=r.grant_id,
        analyst_id=r.analyst_id,
        metric=r.metric,
        target_column=r.target_column,
        filter_criteria=r.filter_criteria,
        requested_epsilon=r.requested_epsilon,
        requested_delta=r.requested_delta,
        status=r.status,
        risk_level=r.risk_level,
        risk_summary=r.risk_summary,
        created_at=r.created_at,
        release=rel_out
    )
