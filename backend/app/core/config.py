"""
PrivacyVault — System Configuration
Authors: KRISH (24BCE0846) & PARV (24BCE0870)
Course: BCSE302P Database Systems Lab (Slot L25+L26)
"""

import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "PrivacyVault"
    VERSION: str = "1.0.0"
    API_V1_PREFIX: str = "/api/v1"
    
    # Authorship & Rubric Compliance Identifiers
    AUTHORS: str = "KRISH (24BCE0846) & PARV (24BCE0870)"
    COURSE_CODE: str = "BCSE302P"
    SLOT: str = "L25+L26"
    STUDENT_REG_NUMBERS: list[str] = ["24BCE0846", "24BCE0870"]

    # Security & JWT Secrets
    SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "PrivacyVaultSuperSecretSigningKey2026!HS256SecureTokenKey")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 12 # 12 hours

    # Database Configuration (PostgreSQL 17 on Port 5434)
    # Default runtime connects using restricted application role 'privacyvault_app'
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "postgresql+psycopg2://privacyvault_app:AppRuntimeSecurePass2026!@localhost:5434/privacyvault"
    )
    
    # Admin database URL used strictly for migrations and testing admin procedures
    ADMIN_DATABASE_URL: str = os.getenv(
        "ADMIN_DATABASE_URL",
        "postgresql+psycopg2://privacyvault_admin:AdminSuperSecretPassword2026!@localhost:5434/privacyvault"
    )

    # Differential Privacy Engine Settings
    DEFAULT_EPSILON: float = 1.0
    DEFAULT_DELTA: float = 1e-5
    MAX_ALLOWABLE_EPSILON: float = 5.0

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="allow"
    )

settings = Settings()
