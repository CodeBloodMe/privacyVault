"""
PrivacyVault — FastAPI Main Application Entrypoint
Student Authors: KRISH (24BCE0846) & PARV (24BCE0870)
Course: BCSE302P Database Systems Lab (Slot L25+L26)
Faculty: Dr. V. SIVAKUMAR
"""

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.app.core.config import settings
from backend.app.api.v1.api import api_router

app = FastAPI(
    title=f"{settings.PROJECT_NAME} API Gateway",
    description=(
        "**PrivacyVault**: An Explainable, Privacy-Preserving Database Analytics Gateway backed by PostgreSQL 17.\n\n"
        "**Academic Authors:** KRISH (`24BCE0846`) & PARV (`24BCE0870`)\n\n"
        "**Course:** BCSE302P Database Systems Lab | Slot L25+L26 | Faculty: Dr. V. SIVAKUMAR"
    ),
    version=settings.VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/api/v1/openapi.json"
)

# CORS Middleware for modern frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Permissive for local dev / demonstration
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API v1 router
app.include_router(api_router, prefix=settings.API_V1_PREFIX)

@app.get("/")
def root():
    return {
        "message": "PrivacyVault Analytics Gateway is running",
        "docs_url": "/docs",
        "health_url": f"{settings.API_V1_PREFIX}/health",
        "authors": settings.AUTHORS,
        "reg_numbers": settings.STUDENT_REG_NUMBERS,
        "academic_course": settings.COURSE_CODE,
        "slot": settings.SLOT
    }

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    # Log internal error safely without disclosing secrets to client
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "Internal Gateway Exception",
            "message": str(exc) if "LEDGER" in str(exc) or "Privacy" in str(exc) else "An unexpected error occurred in the gateway."
        }
    )
