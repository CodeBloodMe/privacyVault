"""
PrivacyVault — Dataset & Grant API Endpoints
Student Authors: KRISH (24BCE0846) & PARV (24BCE0870)
Course: BCSE302P Database Systems Lab (Slot L25+L26)
"""

from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from backend.app.db.session import get_db
from backend.app.schemas.dataset import DatasetOut, GrantOut, GrantCreate
from backend.app.services.dataset_service import DatasetService
from backend.app.services.audit_service import AuditService
from backend.app.api.v1.deps import get_current_user, require_roles
from backend.app.models.users import User
from backend.app.models.datasets import DatasetGrant

router = APIRouter(prefix="/datasets", tags=["Datasets & Governance"])

@router.get("", response_model=list[DatasetOut])
def list_datasets(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lists all active datasets and their catalog schema metadata."""
    roles = [r.name for r in current_user.roles]
    return DatasetService.list_datasets(db, current_user.id, roles)

@router.get("/my-grants", response_model=list[GrantOut])
def list_my_grants(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ANALYST", "ADMIN", "DATA_OWNER"]))
):
    """Retrieves all active dataset access grants for the authenticated analyst."""
    return DatasetService.list_grants_for_analyst(db, current_user.id)

@router.get("/{dataset_id}", response_model=DatasetOut)
def get_dataset_details(
    dataset_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieves schema definitions, column sensitivity flags, and active privacy policy for a dataset."""
    return DatasetService.get_dataset(db, dataset_id)

@router.post("/grants", response_model=GrantOut, status_code=status.HTTP_201_CREATED)
def issue_grant(
    grant_in: GrantCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["DATA_OWNER", "ADMIN"]))
):
    """Allows a Data Owner to grant an analyst time-bounded access to a dataset with a privacy budget."""
    return DatasetService.issue_grant(db, current_user.id, grant_in)

@router.post("/grants/{grant_id}/revoke", status_code=status.HTTP_200_OK)
def revoke_grant(
    grant_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["DATA_OWNER", "ADMIN"]))
):
    """Revokes an analyst dataset access grant immediately."""
    grant = db.query(DatasetGrant).filter(DatasetGrant.id == grant_id).first()
    if not grant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grant not found")

    user_roles = [r.name for r in current_user.roles]
    if "ADMIN" not in user_roles and grant.dataset.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You do not own the dataset associated with this grant"
        )

    grant.is_active = False
    db.commit()

    AuditService.log_event(
        db, event_type="GRANT_REVOKED", outcome="SUCCESS",
        actor_user_id=current_user.id, resource_type="DATASET_GRANT", resource_id=str(grant_id),
        client_ip=request.client.host if request.client else None,
        details={"revoked_by": current_user.email, "analyst_id": str(grant.analyst_id)}
    )

    return {"message": "Grant revoked successfully", "grant_id": grant_id}
