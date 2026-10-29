"""
PrivacyVault — Query Specification & Release Pydantic Schemas
Student Authors: KRISH (24BCE0846) & PARV (24BCE0870)
"""

from uuid import UUID
from datetime import datetime
from typing import Optional, Any
from enum import Enum
from decimal import Decimal
from pydantic import BaseModel, Field, ConfigDict

class MetricType(str, Enum):
    COUNT = "COUNT"
    BOUNDED_SUM = "BOUNDED_SUM"
    BOUNDED_AVG = "BOUNDED_AVG"

class FilterOperator(str, Enum):
    EQ = "EQ"
    NEQ = "NEQ"
    GT = "GT"
    GTE = "GTE"
    LT = "LT"
    LTE = "LTE"
    IN = "IN"

class FilterCriterion(BaseModel):
    column: str = Field(..., description="Target column name")
    operator: FilterOperator = Field(default=FilterOperator.EQ)
    value: Any = Field(..., description="Literal filter comparison value")

class AggregateQueryRequest(BaseModel):
    grant_id: UUID
    metric: MetricType
    target_column: Optional[str] = Field(default=None, description="Required for BOUNDED_SUM and BOUNDED_AVG")
    filters: list[FilterCriterion] = Field(default_factory=list, description="Approved filter conditions")
    requested_epsilon: Decimal = Field(default=Decimal("1.0000"), gt=0, le=5.0)
    requested_delta: Decimal = Field(default=Decimal("0.0"), ge=0, lt=1.0, description="Delta parameter for approximate DP, must satisfy 0 <= delta < 1.0")
    request_id: Optional[UUID] = Field(default=None, description="Optional client idempotency ID to guarantee idempotent execution on network retries")

class QueryValidationResponse(BaseModel):
    valid: bool
    error: Optional[str] = None
    risk_level: str = "LOW"
    risk_summary: Optional[str] = None
    differencing_detected: bool = False
    estimated_epsilon: Decimal

class QueryReleaseOut(BaseModel):
    id: UUID
    request_id: UUID
    metric: str
    target_column: Optional[str] = None
    noisy_result: float
    mechanism_used: str
    noise_scale: float
    sensitivity_applied: float
    epsilon_spent: float
    delta_spent: float
    released_at: datetime
    risk_level: str
    risk_summary: Optional[str] = None
    author_signature: str = "REG_24BCE0846_24BCE0870_KRISH_PARV"

    model_config = ConfigDict(from_attributes=True)

class QueryRequestOut(BaseModel):
    id: UUID
    grant_id: UUID
    analyst_id: UUID
    metric: str
    target_column: Optional[str]
    filter_criteria: list[dict[str, Any]]
    requested_epsilon: Decimal
    requested_delta: Decimal
    status: str
    risk_level: str
    risk_summary: Optional[str]
    created_at: datetime
    release: Optional[QueryReleaseOut] = None

    model_config = ConfigDict(from_attributes=True)
