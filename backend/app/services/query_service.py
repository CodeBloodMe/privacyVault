"""
PrivacyVault — Query Orchestration & State Machine Service
Student Authors: KRISH (24BCE0846) & PARV (24BCE0870)
Course: BCSE302P Database Systems Lab (Slot L25+L26)

State Machine:
RECEIVED -> VALIDATED -> RESERVED -> EXECUTING -> RELEASED
Failure paths: RESERVED -> FAILED (with atomic compensating refund)
"""

import json
import uuid
from decimal import Decimal
from datetime import datetime, timezone
from typing import Optional, Any, Tuple
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select, func, and_, text
from sqlalchemy.exc import IntegrityError


from backend.app.models.datasets import Dataset, DatasetColumn, PrivacyPolicy, DatasetGrant
from backend.app.models.budgets import PrivacyBudget
from backend.app.models.queries import QueryRequest, QueryRelease
from backend.app.models.patients import ProtectedPatient
from backend.app.schemas.query import AggregateQueryRequest, MetricType, FilterOperator, QueryValidationResponse
from backend.app.privacy.engine import DifferentialPrivacyEngine
from backend.app.privacy.risk_engine import QueryHistoryRiskEngine, RiskEvaluationResult
from backend.app.services.budget_service import BudgetService
from backend.app.services.audit_service import AuditService

class QueryService:

    @classmethod
    def get_analyst_prior_releases(cls, db: Session, grant_id: uuid.UUID) -> list[dict[str, Any]]:
        """Retrieves prior released queries under the same grant for overlap risk analysis."""
        requests = db.query(QueryRequest).filter(
            QueryRequest.grant_id == grant_id,
            QueryRequest.status == "RELEASED"
        ).order_by(QueryRequest.created_at.desc()).limit(50).all()

        prior_list = []
        for r in requests:
            prior_list.append({
                "id": str(r.id),
                "metric": r.metric,
                "target_column": r.target_column,
                "filter_criteria": r.filter_criteria,
                "created_at": r.created_at
            })
        return prior_list

    @classmethod
    def validate_query(
        cls,
        db: Session,
        analyst_id: uuid.UUID,
        request: AggregateQueryRequest
    ) -> Tuple[bool, Optional[str], Optional[DatasetGrant], Optional[PrivacyPolicy], RiskEvaluationResult]:
        """Validates grant authorization, dataset columns, policy limits, and evaluates query-history risk."""
        now = datetime.now(timezone.utc)

        # 1. Verify Active Grant
        grant = db.query(DatasetGrant).filter(
            DatasetGrant.id == request.grant_id,
            DatasetGrant.analyst_id == analyst_id,
            DatasetGrant.is_active == True
        ).first()

        if not grant:
            return False, "Access denied: No active grant found for this dataset", None, None, RiskEvaluationResult("HIGH", True, "Grant not found or revoked", False)

        if grant.expires_at < now:
            return False, f"Access denied: Dataset grant expired on {grant.expires_at.isoformat()}", None, None, RiskEvaluationResult("HIGH", True, "Grant expired", False)

        # 2. Verify Dataset
        dataset = db.query(Dataset).filter(Dataset.id == grant.dataset_id, Dataset.is_active == True).first()
        if not dataset:
            return False, "Dataset is inactive or unavailable", None, None, RiskEvaluationResult("HIGH", True, "Dataset unavailable", False)

        # 3. Verify Active Privacy Policy
        policy = db.query(PrivacyPolicy).filter(
            PrivacyPolicy.dataset_id == dataset.id,
            PrivacyPolicy.is_active == True
        ).first()

        if not policy:
            return False, "No active privacy policy configured for this dataset", None, None, RiskEvaluationResult("HIGH", True, "Policy missing", False)

        # 4. Verify Epsilon Limits
        if request.requested_epsilon > policy.max_epsilon_per_query:
            return False, f"Requested epsilon ({request.requested_epsilon}) exceeds policy ceiling ({policy.max_epsilon_per_query})", None, None, RiskEvaluationResult("MEDIUM", False, "Epsilon ceiling exceeded", False)

        # 5. Verify Target Column & Metric Compatibility
        cols = {c.column_name: c for c in dataset.columns}

        if request.metric in (MetricType.BOUNDED_SUM, MetricType.BOUNDED_AVG):
            if not request.target_column:
                return False, f"Metric {request.metric.value} requires target_column", None, None, RiskEvaluationResult("LOW", True, "Missing target column", False)
            if request.target_column not in cols:
                return False, f"Column '{request.target_column}' does not exist in dataset", None, None, RiskEvaluationResult("LOW", True, "Unknown column", False)
            col_def = cols[request.target_column]
            if col_def.is_identifier:
                return False, f"Security Violation: Column '{request.target_column}' is an identifier and cannot be aggregated", None, None, RiskEvaluationResult("CRITICAL", True, "Identifier aggregation prohibited", False)
            if not col_def.is_aggregatable:
                return False, f"Column '{request.target_column}' is marked non-aggregatable", None, None, RiskEvaluationResult("LOW", True, "Non-aggregatable column", False)

        # 6. Verify Filter Columns
        for f in request.filters:
            if f.column not in cols:
                return False, f"Filter column '{f.column}' does not exist in dataset schema", None, None, RiskEvaluationResult("LOW", True, "Unknown filter column", False)
            if cols[f.column].is_identifier:
                return False, f"Security Violation: Direct identifier '{f.column}' cannot be used in filter predicates", None, None, RiskEvaluationResult("CRITICAL", True, "Identifier filtering prohibited", False)

        # 7. Evaluate Query-History Risk
        prior_releases = cls.get_analyst_prior_releases(db, grant.id)
        risk_result = QueryHistoryRiskEngine.evaluate_risk(request, prior_releases)

        if risk_result.is_blocked:
            return False, risk_result.risk_summary, grant, policy, risk_result

        return True, None, grant, policy, risk_result

    @classmethod
    def execute_query_lifecycle(
        cls,
        db: Session,
        analyst_id: uuid.UUID,
        request: AggregateQueryRequest,
        client_ip: Optional[str] = None
    ) -> QueryRelease:
        """
        Executes the atomic 5-state lifecycle:
        RECEIVED -> VALIDATED -> RESERVED -> EXECUTING -> RELEASED
        """
        # Idempotency and Collision Checks:
        if request.request_id:
            existing_global = db.query(QueryRequest).filter(QueryRequest.id == request.request_id).first()
            if existing_global:
                # Cross-analyst collision check (IDOR / key hijacking)
                if existing_global.analyst_id != analyst_id:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Access denied: request_id belongs to another analyst session"
                    )
                # Released query idempotency
                if existing_global.status == "RELEASED" and existing_global.release:
                    return existing_global.release
                elif existing_global.status in ("RECEIVED", "VALIDATED", "RESERVED", "EXECUTING"):
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"Concurrent query execution in progress for request_id {request.request_id}"
                    )
                else:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"Query request {request.request_id} previously terminated with status {existing_global.status}"
                    )
            req_id = request.request_id
        else:
            req_id = uuid.uuid4()

        now = datetime.now(timezone.utc)

        # STATE 1: RECEIVED
        filter_dicts = [f.model_dump() for f in request.filters]
        query_req = QueryRequest(
            id=req_id,
            grant_id=request.grant_id,
            analyst_id=analyst_id,
            metric=request.metric.value,
            target_column=request.target_column,
            filter_criteria=filter_dicts,
            requested_epsilon=request.requested_epsilon,
            requested_delta=request.requested_delta,
            status="RECEIVED",
            risk_level="LOW",
            created_at=now
        )
        try:
            db.add(query_req)
            db.commit()
        except IntegrityError:
            db.rollback()
            existing_global = db.query(QueryRequest).filter(QueryRequest.id == req_id).first()
            if existing_global:
                if existing_global.analyst_id != analyst_id:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Access denied: request_id belongs to another analyst session"
                    )
                if existing_global.status == "RELEASED" and existing_global.release:
                    return existing_global.release
                else:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"Concurrent query execution in progress for request_id {req_id}"
                    )
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Duplicate request_id collision detected: {req_id}"
            )

        # STATE 2: VALIDATED
        is_valid, val_err, grant, policy, risk_result = cls.validate_query(db, analyst_id, request)

        query_req.risk_level = risk_result.risk_level
        query_req.risk_summary = risk_result.risk_summary

        if not is_valid:
            query_req.status = "REJECTED"
            db.commit()
            AuditService.log_event(
                db, event_type="QUERY_REJECTED", outcome="DENIED",
                actor_user_id=analyst_id, resource_type="QUERY_REQUEST", resource_id=str(req_id),
                client_ip=client_ip, details={"reason": val_err, "risk_level": risk_result.risk_level}
            )
            is_auth_or_differencing = (
                risk_result.differencing_detected 
                or (val_err and "Access denied" in val_err)
                or (val_err and "Security Violation" in val_err)
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN if is_auth_or_differencing else status.HTTP_400_BAD_REQUEST,
                detail={
                    "error": val_err,
                    "risk_level": risk_result.risk_level,
                    "differencing_detected": risk_result.differencing_detected,
                    "recommended_action": risk_result.recommended_action
                }
            )

        query_req.status = "VALIDATED"
        db.commit()

        # STATE 3: RESERVED (Atomic Stored Procedure with FOR UPDATE row-level lock)
        budget = BudgetService.get_budget_by_grant(db, grant.id)
        if not budget:
            query_req.status = "FAILED"
            query_req.risk_summary = "Privacy budget not allocated for this grant"
            db.commit()
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No privacy budget allocated")

        reserve_ok, remaining_bal, reserve_err, sig = BudgetService.reserve_budget_atomic(
            db, budget.id, request.requested_epsilon, req_id
        )

        if not reserve_ok:
            query_req.status = "FAILED"
            query_req.risk_summary = f"Budget reservation failed: {reserve_err}"
            db.commit()
            AuditService.log_event(
                db, event_type="BUDGET_EXHAUSTION_DENIED", outcome="DENIED",
                actor_user_id=analyst_id, resource_type="PRIVACY_BUDGET", resource_id=str(budget.id),
                client_ip=client_ip, details={"requested": float(request.requested_epsilon), "remaining": float(remaining_bal)}
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Budget Exhaustion: {reserve_err}. Remaining: {remaining_bal} epsilon."
            )

        query_req.status = "RESERVED"
        db.commit()

        # STATE 4: EXECUTING (Protected Clamped Aggregation)
        query_req.status = "EXECUTING"
        db.commit()

        try:
            # Execute bounded aggregation via PostgreSQL SECURITY DEFINER stored procedure
            # This allows restricted runtime role (privacyvault_app) to execute aggregates
            # while direct SELECT on protected_patients microdata remains strictly forbidden
            filter_json = json.dumps(filter_dicts)
            clamp_low = float(policy.sensitivity_clamp_low)
            clamp_high = float(policy.sensitivity_clamp_high)

            if request.metric == MetricType.BOUNDED_AVG:
                # Compositional DP Mean: requires true bounded sum and true bounded count
                agg_query = text("""
                    SELECT fn_execute_bounded_aggregation(
                        'BOUNDED_SUM', :column, CAST(:filters AS jsonb), :clamp_low, :clamp_high
                    );
                """)
                raw_sum = float(db.execute(agg_query, {
                    "column": request.target_column,
                    "filters": filter_json,
                    "clamp_low": clamp_low,
                    "clamp_high": clamp_high
                }).scalar() or 0.0)

                count_query = text("""
                    SELECT fn_execute_bounded_aggregation('COUNT', NULL, CAST(:filters AS jsonb), 0, 1);
                """)
                raw_cnt = int(db.execute(count_query, {"filters": filter_json}).scalar() or 0)

                # STATE 5: NOISE APPLICATION VIA OPENDP 0.16.0 (COMPOSITIONAL MEAN)
                dp_result = DifferentialPrivacyEngine.execute_release(
                    metric="BOUNDED_AVG",
                    true_aggregate=raw_sum,
                    epsilon=float(request.requested_epsilon),
                    delta=float(request.requested_delta),
                    clamp_low=clamp_low,
                    clamp_high=clamp_high,
                    record_count=raw_cnt
                )
            else:
                agg_query = text("""
                    SELECT fn_execute_bounded_aggregation(
                        :metric, :column, CAST(:filters AS jsonb), :clamp_low, :clamp_high
                    );
                """)
                raw_result = db.execute(agg_query, {
                    "metric": request.metric.value,
                    "column": request.target_column,
                    "filters": filter_json,
                    "clamp_low": clamp_low,
                    "clamp_high": clamp_high
                }).scalar()
                true_aggregate = float(raw_result or 0.0)

                # STATE 5: NOISE APPLICATION VIA OPENDP 0.16.0 (COUNT OR BOUNDED SUM)
                dp_result = DifferentialPrivacyEngine.execute_release(
                    metric=request.metric.value,
                    true_aggregate=true_aggregate,
                    epsilon=float(request.requested_epsilon),
                    delta=float(request.requested_delta),
                    clamp_low=clamp_low,
                    clamp_high=clamp_high
                )

            # Persist Release
            release = QueryRelease(
                id=uuid.uuid4(),
                request_id=req_id,
                noisy_result=dp_result.noisy_result,
                mechanism_used=dp_result.mechanism_used,
                noise_scale=dp_result.noise_scale,
                sensitivity_applied=dp_result.sensitivity_applied,
                epsilon_spent=dp_result.epsilon_spent,
                delta_spent=dp_result.delta_spent,
                released_at=datetime.now(timezone.utc)
            )
            db.add(release)

            query_req.status = "RELEASED"
            db.commit()

            # Record audit event
            AuditService.log_event(
                db, event_type="QUERY_RELEASED", outcome="SUCCESS",
                actor_user_id=analyst_id, resource_type="QUERY_RELEASE", resource_id=str(release.id),
                client_ip=client_ip, details={
                    "metric": request.metric.value,
                    "target_column": request.target_column,
                    "epsilon_spent": dp_result.epsilon_spent,
                    "noise_scale": dp_result.noise_scale,
                    "mechanism": dp_result.mechanism_used
                }
            )

            return release

        except Exception as e:
            db.rollback()
            # COMPENSATING REFUND: Replenish reserved budget since execution failed
            BudgetService.refund_budget_atomic(db, budget.id, request.requested_epsilon, req_id)
            query_req.status = "FAILED"
            query_req.risk_summary = f"Execution failed: {str(e)}"
            db.commit()
            AuditService.log_event(
                db, event_type="QUERY_EXECUTION_FAILED", outcome="ERROR",
                actor_user_id=analyst_id, resource_type="QUERY_REQUEST", resource_id=str(req_id),
                client_ip=client_ip, details={"error": str(e), "compensated_refund": float(request.requested_epsilon)}
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Query execution failure. Privacy budget reservation has been refunded."
            )
