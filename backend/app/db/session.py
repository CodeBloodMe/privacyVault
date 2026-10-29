"""
PrivacyVault — SQLAlchemy Database Session Management
Student Authors: KRISH (24BCE0846) & PARV (24BCE0870)
"""

from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base, Session
from backend.app.core.config import settings

# Engine connecting as restricted runtime role 'privacyvault_app'
engine = create_engine(
    settings.DATABASE_URL,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
    pool_recycle=300
)

# Admin engine connecting as 'privacyvault_admin'
admin_engine = create_engine(
    settings.ADMIN_DATABASE_URL,
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
AdminSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=admin_engine)

Base = declarative_base()

def get_db() -> Generator[Session, None, None]:
    """Dependency that yields a database session for a single HTTP request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_admin_db() -> Generator[Session, None, None]:
    """Dependency for administrative / migration operations."""
    db = AdminSessionLocal()
    try:
        yield db
    finally:
        db.close()
