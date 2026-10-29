"""
PrivacyVault — Cryptographic Security & JWT Token Utilities
Student Authors: KRISH (24BCE0846) & PARV (24BCE0870)
"""

from datetime import datetime, timedelta, timezone
from typing import Optional, Any
import bcrypt
import jwt
from backend.app.core.config import settings

def hash_password(password: str) -> str:
    """Hashes a plaintext password using bcrypt with work factor 12."""
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plaintext password against a stored bcrypt hash."""
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))

def create_access_token(subject: str, roles: list[str], extra_claims: Optional[dict[str, Any]] = None, expires_delta: Optional[timedelta] = None) -> str:
    """Creates a signed HS256 JWT access token with role claims."""
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode = {
        "sub": str(subject),
        "roles": roles,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "iss": "privacyvault-gateway",
        "aud": "privacyvault-api",
        "author_reg": "24BCE0846_24BCE0870"
    }
    if extra_claims:
        to_encode.update(extra_claims)
        
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def decode_access_token(token: str) -> dict[str, Any]:
    """Decodes and validates a signed JWT token."""
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
            audience="privacyvault-api",
            issuer="privacyvault-gateway"
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise ValueError("Token has expired")
    except jwt.InvalidTokenError as e:
        raise ValueError(f"Invalid token: {str(e)}")
