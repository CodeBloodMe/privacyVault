"""
PrivacyVault — Authentication API Endpoints
Student Authors: KRISH (24BCE0846) & PARV (24BCE0870)
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from backend.app.db.session import get_db
from backend.app.schemas.auth import Token, UserOut, LoginRequest
from backend.app.services.auth_service import AuthService
from backend.app.services.audit_service import AuditService
from backend.app.api.v1.deps import get_current_user
from backend.app.models.users import User

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/login", response_model=Token)
def login_for_access_token(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """
    Standard OAuth2 compatible token login. Authenticates with Bcrypt.
    """
    client_ip = request.client.host if request.client else None
    user = AuthService.authenticate_user(db, form_data.username, form_data.password)
    if not user:
        AuditService.log_event(
            db, event_type="AUTH_LOGIN_FAILED", outcome="DENIED",
            client_ip=client_ip, details={"username_attempted": form_data.username}
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    AuditService.log_event(
        db, event_type="AUTH_LOGIN_SUCCESS", outcome="SUCCESS",
        actor_user_id=user.id, client_ip=client_ip, details={"email": user.email}
    )

    return AuthService.create_user_token(user)

@router.post("/login-json", response_model=Token)
def login_json(
    request: Request,
    login_data: LoginRequest,
    db: Session = Depends(get_db)
):
    """
    JSON-based login endpoint for frontend client applications.
    """
    client_ip = request.client.host if request.client else None
    user = AuthService.authenticate_user(db, login_data.email, login_data.password)
    if not user:
        AuditService.log_event(
            db, event_type="AUTH_LOGIN_FAILED", outcome="DENIED",
            client_ip=client_ip, details={"email": login_data.email}
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )

    AuditService.log_event(
        db, event_type="AUTH_LOGIN_SUCCESS", outcome="SUCCESS",
        actor_user_id=user.id, client_ip=client_ip, details={"email": user.email}
    )

    return AuthService.create_user_token(user)

@router.get("/me", response_model=UserOut)
def read_current_user(current_user: User = Depends(get_current_user)):
    """Returns the authenticated profile of the current user."""
    return UserOut(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        is_active=current_user.is_active,
        roles=[r.name for r in current_user.roles],
        created_at=current_user.created_at
    )
