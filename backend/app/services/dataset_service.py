"""
PrivacyVault — Dataset & Grant Governance Service
Student Authors: KRISH (24BCE0846) & PARV (24BCE0870)
Course: BCSE302P Database Systems Lab (Slot L25+L26)
"""

import uuid
from decimal import Decimal
from datetime import datetime, timedelta, timezone
from typing import Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from backend.app.models.datasets import Dataset, DatasetColumn, PrivacyPolicy, DatasetGrant
from backend.app.models.budgets import PrivacyBudget, PrivacyBudgetLedger
from backend.app.models.users import User
from backend.app.schemas.dataset import DatasetOut, ColumnMetadataOut, PolicyOut, GrantOut, GrantCreate
from backend.app.services.audit_service import AuditService

class DatasetService:
    @staticmethod
    def list_datasets(db: Session, user_id: uuid.UUID, user_roles: list[str]) -> list[DatasetOut]:
        """Lists active datasets authorized for the given user's role."""
        datasets = db.query(Dataset).filter(Dataset.is_active == True).all()
        results = []
        for d in datasets:
            active_pol = next((p for p in d.policies if p.is_active), None)
            results.append(DatasetOut(
                id=d.id,
                name=d.name,
                description=d.description,
                target_table=d.target_table,
                owner_id=d.owner_id,
                owner_name=d.owner.full_name if d.owner else None,
                is_active=d.is_active,
                columns=[ColumnMetadataOut.model_validate(c) for c in d.columns],
                active_policy=PolicyOut.model_validate(active_pol) if active_pol else None
            ))
        return results

    @staticmethod
    def get_dataset(db: Session, dataset_id: uuid.UUID) -> DatasetOut:
        d = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.is_active == True).first()
        if not d:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")
        active_pol = next((p for p in d.policies if p.is_active), None)
        return DatasetOut(
            id=d.id,
            name=d.name,
            description=d.description,
            target_table=d.target_table,
            owner_id=d.owner_id,
            owner_name=d.owner.full_name if d.owner else None,
            is_active=d.is_active,
            columns=[ColumnMetadataOut.model_validate(c) for c in d.columns],
            active_policy=PolicyOut.model_validate(active_pol) if active_pol else None
        )

    @staticmethod
    def issue_grant(db: Session, granter_id: uuid.UUID, grant_in: GrantCreate) -> GrantOut:
        # Verify granter is DATA_OWNER or ADMIN and owns the dataset
        granter = db.query(User).filter(User.id == granter_id).first()
        dataset = db.query(Dataset).filter(Dataset.id == grant_in.dataset_id).first()
        if not dataset:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")

        granter_roles = [r.name for r in granter.roles] if granter else []
        if "ADMIN" not in granter_roles and dataset.owner_id != granter_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You do not own this dataset"
            )

        analyst = db.query(User).filter(User.email == grant_in.analyst_email.lower().strip()).first()
        if not analyst:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analyst email not found")

        # Check existing grant (active or revoked)
        existing = db.query(DatasetGrant).filter(
            DatasetGrant.dataset_id == dataset.id,
            DatasetGrant.analyst_id == analyst.id
        ).first()

        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(days=grant_in.expires_in_days)

        if existing:
            # Re-activate and refresh expiry and budget
            existing.is_active = True
            existing.expires_at = expires_at
            if existing.budget:
                existing.budget.remaining_epsilon = grant_in.allocated_epsilon
                existing.budget.total_epsilon = grant_in.allocated_epsilon
            else:
                budget = PrivacyBudget(
                    id=uuid.uuid4(),
                    grant_id=existing.id,
                    total_epsilon=grant_in.allocated_epsilon,
                    remaining_epsilon=grant_in.allocated_epsilon,
                    total_delta=Decimal("0.00001000"),
                    remaining_delta=Decimal("0.00001000")
                )
                db.add(budget)
            db.commit()
            db.refresh(existing)
            grant = existing
        else:
            grant = DatasetGrant(
                id=uuid.uuid4(),
                dataset_id=dataset.id,
                analyst_id=analyst.id,
                granted_by=granter_id,
                granted_at=now,
                expires_at=expires_at,
                is_active=True
            )
            db.add(grant)
            db.flush()

            budget = PrivacyBudget(
                id=uuid.uuid4(),
                grant_id=grant.id,
                total_epsilon=grant_in.allocated_epsilon,
                remaining_epsilon=grant_in.allocated_epsilon,
                total_delta=Decimal("0.00001000"),
                remaining_delta=Decimal("0.00001000")
            )
            db.add(budget)
            db.flush()

            # Record initial ledger entry
            ledger = PrivacyBudgetLedger(
                id=uuid.uuid4(),
                budget_id=budget.id,
                amount=grant_in.allocated_epsilon,
                transaction_type="ALLOCATION",
                balance_after=grant_in.allocated_epsilon
            )
            db.add(ledger)
            db.commit()
            db.refresh(grant)

        AuditService.log_event(
            db, event_type="GRANT_ISSUED", outcome="SUCCESS",
            actor_user_id=granter_id, resource_type="DATASET_GRANT", resource_id=str(grant.id),
            details={"analyst": analyst.email, "dataset": dataset.name, "epsilon": float(grant_in.allocated_epsilon)}
        )

        return GrantOut(
            id=grant.id,
            dataset_id=dataset.id,
            dataset_name=dataset.name,
            analyst_id=analyst.id,
            analyst_name=analyst.full_name,
            analyst_email=analyst.email,
            granted_at=grant.granted_at,
            expires_at=grant.expires_at,
            is_active=grant.is_active,
            total_epsilon=grant.budget.total_epsilon,
            remaining_epsilon=grant.budget.remaining_epsilon
        )

    @staticmethod
    def list_grants_for_analyst(db: Session, analyst_id: uuid.UUID) -> list[GrantOut]:
        grants = db.query(DatasetGrant).filter(
            DatasetGrant.analyst_id == analyst_id,
            DatasetGrant.is_active == True
        ).all()
        results = []
        for g in grants:
            results.append(GrantOut(
                id=g.id,
                dataset_id=g.dataset.id,
                dataset_name=g.dataset.name,
                analyst_id=g.analyst.id,
                analyst_name=g.analyst.full_name,
                analyst_email=g.analyst.email,
                granted_at=g.granted_at,
                expires_at=g.expires_at,
                is_active=g.is_active,
                total_epsilon=g.budget.total_epsilon if g.budget else Decimal("0.0"),
                remaining_epsilon=g.budget.remaining_epsilon if g.budget else Decimal("0.0")
            ))
        return results
