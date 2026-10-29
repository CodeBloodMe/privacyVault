"""
PrivacyVault — Budget Management & Atomic Stored Procedure Service
Student Authors: KRISH (24BCE0846) & PARV (24BCE0870)
Course: BCSE302P Database Systems Lab (Slot L25+L26)
"""

import uuid
from decimal import Decimal
from typing import Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import text
from backend.app.models.budgets import PrivacyBudget, PrivacyBudgetLedger

class BudgetService:
    @staticmethod
    def reserve_budget_atomic(
        db: Session,
        budget_id: uuid.UUID,
        requested_epsilon: Decimal,
        request_id: uuid.UUID
    ) -> Tuple[bool, Decimal, Optional[str], Optional[str]]:
        """
        Executes PostgreSQL stored procedure fn_reserve_privacy_budget.
        Acquires row-level lock (FOR UPDATE), validates remaining balance,
        debits epsilon atomically, and writes to append-only ledger.
        """
        stmt = text("""
            SELECT success, remaining, error_message, author_signature 
            FROM fn_reserve_privacy_budget(:b_id, :req_eps, :r_id);
        """)
        result = db.execute(stmt, {
            "b_id": str(budget_id),
            "req_eps": float(requested_epsilon),
            "r_id": str(request_id)
        }).fetchone()

        if not result:
            return False, Decimal("0.0"), "Internal database procedure error", None

        success = bool(result[0])
        remaining = Decimal(str(result[1]))
        error_msg = result[2]
        sig = result[3]

        return success, remaining, error_msg, sig

    @staticmethod
    def refund_budget_atomic(
        db: Session,
        budget_id: uuid.UUID,
        refund_epsilon: Decimal,
        request_id: uuid.UUID
    ) -> Tuple[bool, Decimal, Optional[str], Optional[str]]:
        """
        Executes PostgreSQL stored procedure fn_refund_privacy_budget.
        Provides a compensating refund transaction if downstream execution fails.
        """
        stmt = text("""
            SELECT success, new_balance, error_message, author_signature 
            FROM fn_refund_privacy_budget(:b_id, :ref_eps, :r_id);
        """)
        result = db.execute(stmt, {
            "b_id": str(budget_id),
            "ref_eps": float(refund_epsilon),
            "r_id": str(request_id)
        }).fetchone()

        if not result:
            return False, Decimal("0.0"), "Refund procedure error", None

        success = bool(result[0])
        new_balance = Decimal(str(result[1]))
        error_msg = result[2]
        sig = result[3]

        return success, new_balance, error_msg, sig

    @staticmethod
    def get_budget_by_grant(db: Session, grant_id: uuid.UUID) -> Optional[PrivacyBudget]:
        return db.query(PrivacyBudget).filter(PrivacyBudget.grant_id == grant_id).first()

    @staticmethod
    def get_ledger_for_budget(db: Session, budget_id: uuid.UUID) -> list[PrivacyBudgetLedger]:
        return db.query(PrivacyBudgetLedger).filter(
            PrivacyBudgetLedger.budget_id == budget_id
        ).order_by(PrivacyBudgetLedger.created_at.desc()).all()
