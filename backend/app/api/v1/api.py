"""
PrivacyVault — API v1 Router Assembly
Student Authors: KRISH (24BCE0846) & PARV (24BCE0870)
Course: BCSE302P Database Systems Lab (Slot L25+L26)
"""

from fastapi import APIRouter
from backend.app.api.v1.auth import router as auth_router
from backend.app.api.v1.datasets import router as datasets_router
from backend.app.api.v1.queries import router as queries_router
from backend.app.api.v1.budgets import router as budgets_router
from backend.app.api.v1.audit import router as audit_router
from backend.app.api.v1.health import router as health_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(auth_router)
api_router.include_router(datasets_router)
api_router.include_router(queries_router)
api_router.include_router(budgets_router)
api_router.include_router(audit_router)
