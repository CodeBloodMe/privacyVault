"""
PrivacyVault — Protected Patient Clinical Microdata ORM Model
Student Authors: KRISH (24BCE0846) & PARV (24BCE0870)
"""

import uuid
from sqlalchemy import Column, String, Integer, Boolean, DateTime, Numeric, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
from backend.app.db.session import Base

class ProtectedPatient(Base):
    __tablename__ = "protected_patients"

    patient_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    mrn = Column(String(50), unique=True, nullable=False)
    age = Column(Integer, nullable=False)
    gender = Column(String(20), nullable=False)
    blood_group = Column(String(5), nullable=False)
    diagnosis_code = Column(String(20), nullable=False, index=True)
    admission_type = Column(String(50), nullable=False, index=True)
    treatment_cost = Column(Numeric(12, 2), nullable=False, index=True)
    length_of_stay_days = Column(Integer, nullable=False)
    readmitted = Column(Boolean, default=False, nullable=False)
    admission_date = Column(DateTime(timezone=True), nullable=False)

    __table_args__ = (
        CheckConstraint("age >= 0 AND age <= 125", name="chk_patient_age"),
        CheckConstraint("treatment_cost >= 0", name="chk_treatment_cost"),
        CheckConstraint("length_of_stay_days >= 0", name="chk_stay_days"),
    )
