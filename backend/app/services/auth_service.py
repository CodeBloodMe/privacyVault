"""
PrivacyVault — User Authentication & RBAC Service
Student Authors: KRISH (24BCE0846) & PARV (24BCE0870)
Course: BCSE302P Database Systems Lab (Slot L25+L26)
"""

from typing import Optional
from uuid import UUID
from sqlalchemy.orm import Session
from backend.app.models.users import User
from backend.app.schemas.auth import Token, UserOut
from backend.app.core.security import verify_password, create_access_token
from backend.app.core.config import settings

class AuthService:
    @staticmethod
    def authenticate_user(db: Session, email: str, password: str) -> Optional[User]:
        """Authenticates user email and password using Bcrypt verification."""
        user = db.query(User).filter(User.email == email.lower().strip()).first()
        if not user or not user.is_active:
            return None
        if not verify_password(password, user.password_hash):
            return None
        return user

    @staticmethod
    def get_user_by_id(db: Session, user_id: UUID) -> Optional[User]:
        return db.query(User).filter(User.id == user_id).first()

    @staticmethod
    def get_user_by_email(db: Session, email: str) -> Optional[User]:
        return db.query(User).filter(User.email == email.lower().strip()).first()

    @staticmethod
    def create_user_token(user: User) -> Token:
        roles = [r.name for r in user.roles]
        token_str = create_access_token(
            subject=str(user.id),
            roles=roles,
            extra_claims={"email": user.email, "full_name": user.full_name}
        )
        return Token(
            access_token=token_str,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user=UserOut(
                id=user.id,
                email=user.email,
                full_name=user.full_name,
                is_active=user.is_active,
                roles=roles,
                created_at=user.created_at
            )
        )
