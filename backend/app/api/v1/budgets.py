"""
PrivacyVault — Budget & Ledger API Endpoints
Student Authors: KRISH (24BCE0846) & PARV (24BCE0870)
Course: BCSE302P Database Systems Lab (Slot L25+L26)
"""

from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text

from backend.app.db.session import get_db
from backend.app.schemas.budget import BudgetSummaryOut, LedgerEntryOut
from backend.app.services.budget_service import BudgetService
from backend.app.api.v1.deps import get_current_user, require_roles
from backend.app.models.users import User
from backend.app.models.budgets import PrivacyBudget

router = APIRouter(prefix="/budgets", tags=["Privacy Budgets & Accounting"])

@router.get("/my-summary", response_model=list[BudgetSummaryOut])
def get_my_budget_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ANALYST", "ADMIN", "DATA_OWNER"]))
):
    """Retrieves real-time privacy budget balances and utilization for the current analyst."""
    stmt = text("""
        SELECT 
            grant_id, analyst_id, analyst_name, analyst_email,
            dataset_id, dataset_name, budget_id, total_epsilon,
            remaining_epsilon, spent_epsilon, budget_utilization_pct,
            expires_at, grant_active, last_budget_activity
        FROM v_analyst_budget_summary
        WHERE analyst_id = :aid;
    """)
    rows = db.execute(stmt, {"aid": str(current_user.id)}).fetchall()
    results = []
    for r in rows:
        results.append(BudgetSummaryOut(
            grant_id=r[0],
            analyst_id=r[1],
            analyst_name=r[2],
            analyst_email=r[3],
            dataset_id=r[4],
            dataset_name=r[5],
            budget_id=r[6],
            total_epsilon=r[7],
            remaining_epsilon=r[8],
            spent_epsilon=r[9],
            budget_utilization_pct=r[10] or 0.0,
            expires_at=r[11],
            grant_active=r[12],
            last_budget_activity=r[13]
        ))
    return results

@router.get("/all-summaries", response_model=list[BudgetSummaryOut])
def get_all_budget_summaries(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["DATA_OWNER", "AUDITOR", "ADMIN"]))
):
    """Analytical View: Retrieves all analyst budget utilization records for governance."""
    stmt = text("""
        SELECT 
            grant_id, analyst_id, analyst_name, analyst_email,
            dataset_id, dataset_name, budget_id, total_epsilon,
            remaining_epsilon, spent_epsilon, budget_utilization_pct,
            expires_at, grant_active, last_budget_activity
        FROM v_analyst_budget_summary;
    """)
    rows = db.execute(stmt).fetchall()
    results = []
    for r in rows:
        results.append(BudgetSummaryOut(
            grant_id=r[0],
            analyst_id=r[1],
            analyst_name=r[2],
            analyst_email=r[3],
            dataset_id=r[4],
            dataset_name=r[5],
            budget_id=r[6],
            total_epsilon=r[7],
            remaining_epsilon=r[8],
            spent_epsilon=r[9],
            budget_utilization_pct=r[10] or 0.0,
            expires_at=r[11],
            grant_active=r[12],
            last_budget_activity=r[13]
        ))
    return results

@router.get("/{budget_id}/ledger", response_model=list[LedgerEntryOut])
def get_budget_ledger(
    budget_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieves immutable append-only ledger entries for a budget record."""
    budget = db.query(PrivacyBudget).filter(PrivacyBudget.id == budget_id).first()
    if not budget:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Budget not found")

    user_roles = [r.name for r in current_user.roles]
    if "ADMIN" in user_roles or "AUDITOR" in user_roles:
        pass  # Global audit/admin access permitted
    elif "DATA_OWNER" in user_roles:
        if budget.grant.dataset.owner_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You do not own the dataset associated with this budget"
            )
    elif "ANALYST" in user_roles:
        if budget.grant.analyst_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this budget ledger"
            )
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Insufficient privileges"
        )

    entries = BudgetService.get_ledger_for_budget(db, budget_id)
    return [LedgerEntryOut.model_validate(e) for e in entries]
