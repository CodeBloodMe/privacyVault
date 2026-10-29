"""
PrivacyVault — System Health & Diagnostics API Endpoints
Student Authors: KRISH (24BCE0846) & PARV (24BCE0870)
Course: BCSE302P Database Systems Lab (Slot L25+L26)
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from backend.app.db.session import get_db
from backend.app.core.config import settings

router = APIRouter(tags=["Health & Status"])

@router.get("/health")
def health_check(db: Session = Depends(get_db)):
    """Health check endpoint validating PostgreSQL connectivity and runtime role."""
    try:
        res = db.execute(text("SELECT current_user, current_database(), version();")).fetchone()
        db_user, db_name, db_ver = res[0], res[1], res[2]
        db_healthy = True
    except Exception as e:
        db_healthy = False
        db_user, db_name, db_ver = None, None, str(e)

    return {
        "status": "healthy" if db_healthy else "degraded",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "database": {
            "connected": db_healthy,
            "runtime_user": db_user,
            "database_name": db_name,
            "engine": "PostgreSQL 17"
        },
        "authors": settings.AUTHORS,
        "slot": settings.SLOT,
        "academic_course": settings.COURSE_CODE,
        "differential_privacy_engine": "OpenDP 0.16.0 (Rust Core)"
    }
