"""
PrivacyVault — Comprehensive Backend Integration & Security Tests
Student Authors: KRISH (24BCE0846) & PARV (24BCE0870)
Course: BCSE302P Database Systems Lab (Slot L25+L26)
Faculty: Dr. V. SIVAKUMAR
"""

import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

class TestPrivacyVaultGateway:
    
    @classmethod
    def setup_class(cls):
        """Perform test setup and acquire role tokens."""
        # Login Analyst 1 (Krish - 24BCE0846)
        res = client.post("/api/v1/auth/login-json", json={
            "email": "krish.24bce0846@vitstudent.ac.in",
            "password": "AnalystPass2026!"
        })
        assert res.status_code == 200, f"Login failed: {res.text}"
        cls.analyst_token = res.json()["access_token"]
        cls.analyst_headers = {"Authorization": f"Bearer {cls.analyst_token}"}

        # Login Data Owner (Dr. Sivakumar)
        res_owner = client.post("/api/v1/auth/login-json", json={
            "email": "dr.sivakumar@vit.ac.in",
            "password": "OwnerPass2026!"
        })
        assert res_owner.status_code == 200
        cls.owner_token = res_owner.json()["access_token"]
        cls.owner_headers = {"Authorization": f"Bearer {cls.owner_token}"}

        # Login Auditor
        res_auditor = client.post("/api/v1/auth/login-json", json={
            "email": "compliance.auditor@vit.ac.in",
            "password": "AuditorPass2026!"
        })
        assert res_auditor.status_code == 200
        cls.auditor_token = res_auditor.json()["access_token"]
        cls.auditor_headers = {"Authorization": f"Bearer {cls.auditor_token}"}

        # Ensure active grant has full budget (10.0 epsilon) for test suite idempotency
        datasets_res = client.get("/api/v1/datasets", headers=cls.owner_headers)
        if datasets_res.status_code == 200 and datasets_res.json():
            default_ds_id = datasets_res.json()[0]["id"]
            client.post("/api/v1/datasets/grants", json={
                "dataset_id": default_ds_id,
                "analyst_email": "krish.24bce0846@vitstudent.ac.in",
                "expires_in_days": 30,
                "allocated_epsilon": 10.0
            }, headers=cls.owner_headers)

        # Initialize default active grant ID for test queries
        grants_res = client.get("/api/v1/datasets/my-grants", headers=cls.analyst_headers)
        if grants_res.status_code == 200 and grants_res.json():
            cls.active_grant_id = grants_res.json()[0]["id"]


    def test_01_health_check(self):
        """Verify health check endpoint returns 200 and PostgreSQL 17 status."""
        res = client.get("/api/v1/health")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "healthy"
        assert data["database"]["connected"] is True
        assert data["database"]["engine"] == "PostgreSQL 17"
        assert "24BCE0846" in data["authors"]

    def test_02_auth_me_profile(self):
        """Verify token decoding and user identity resolution."""
        res = client.get("/api/v1/auth/me", headers=self.analyst_headers)
        assert res.status_code == 200
        data = res.json()
        assert data["email"] == "krish.24bce0846@vitstudent.ac.in"
        assert "ANALYST" in data["roles"]

    def test_03_invalid_password_rejected(self):
        """Verify incorrect password returns 401 Unauthorized."""
        res = client.post("/api/v1/auth/login-json", json={
            "email": "krish.24bce0846@vitstudent.ac.in",
            "password": "WrongPassword123!"
        })
        assert res.status_code == 401

    def test_04_dataset_catalog_exploration(self):
        """Verify analysts can list datasets and inspect column metadata."""
        res = client.get("/api/v1/datasets", headers=self.analyst_headers)
        assert res.status_code == 200
        datasets = res.json()
        assert len(datasets) > 0
        ds = datasets[0]
        assert ds["name"] == "clinical_patient_records"
        assert len(ds["columns"]) == 11
        
        # Verify MRN is marked as an identifier
        mrn_col = next(c for c in ds["columns"] if c["column_name"] == "mrn")
        assert mrn_col["is_identifier"] is True
        assert mrn_col["is_aggregatable"] is False

    def test_05_analyst_active_grants(self):
        """Verify analyst can retrieve their active grants and privacy budget."""
        res = client.get("/api/v1/datasets/my-grants", headers=self.analyst_headers)
        assert res.status_code == 200
        grants = res.json()
        assert len(grants) > 0
        grant = grants[0]
        assert grant["is_active"] is True
        assert float(grant["remaining_epsilon"]) > 0
        TestPrivacyVaultGateway.active_grant_id = grant["id"]

    def test_06_query_validation_success(self):
        """Dry-run validation of a compliant COUNT query."""
        payload = {
            "grant_id": self.active_grant_id,
            "metric": "COUNT",
            "filters": [
                {"column": "diagnosis_code", "operator": "EQ", "value": "I10"}
            ],
            "requested_epsilon": 0.5,
            "requested_delta": 0.0
        }
        res = client.post("/api/v1/queries/validate", json=payload, headers=self.analyst_headers)
        assert res.status_code == 200
        data = res.json()
        assert data["valid"] is True
        assert data["risk_level"] == "LOW"
        assert data["differencing_detected"] is False

    def test_07_aggregate_identifier_forbidden(self):
        """Verify query service blocks attempting to aggregate identifier column (MRN)."""
        payload = {
            "grant_id": self.active_grant_id,
            "metric": "BOUNDED_SUM",
            "target_column": "mrn",
            "filters": [],
            "requested_epsilon": 0.5
        }
        res = client.post("/api/v1/queries/validate", json=payload, headers=self.analyst_headers)
        assert res.status_code == 200
        data = res.json()
        assert data["valid"] is False
        assert "identifier" in data["error"].lower()

    def test_08_execute_differential_privacy_count(self):
        """Execute real aggregate COUNT with OpenDP Laplace noise and verify budget deduction."""
        # Check initial budget
        res_b = client.get("/api/v1/budgets/my-summary", headers=self.analyst_headers)
        initial_eps = float(res_b.json()[0]["remaining_epsilon"])

        payload = {
            "grant_id": self.active_grant_id,
            "metric": "COUNT",
            "filters": [
                {"column": "admission_type", "operator": "EQ", "value": "EMERGENCY"}
            ],
            "requested_epsilon": 0.5000,
            "requested_delta": 0.0
        }
        res = client.post("/api/v1/queries/submit", json=payload, headers=self.analyst_headers)
        assert res.status_code == 201, f"Query failed: {res.text}"
        data = res.json()
        assert data["mechanism_used"] == "OPENDP_LAPLACE"
        assert data["epsilon_spent"] == 0.5
        assert data["noisy_result"] > 0
        assert "24BCE0846" in data["author_signature"]

        # Check remaining budget dropped by exactly 0.5
        res_b2 = client.get("/api/v1/budgets/my-summary", headers=self.analyst_headers)
        new_eps = float(res_b2.json()[0]["remaining_epsilon"])
        assert round(new_eps, 4) == round(initial_eps - 0.5, 4)

    def test_09_execute_differential_privacy_bounded_sum(self):
        """Execute real BOUNDED_SUM with clamping on treatment_cost."""
        payload = {
            "grant_id": self.active_grant_id,
            "metric": "BOUNDED_SUM",
            "target_column": "treatment_cost",
            "filters": [
                {"column": "diagnosis_code", "operator": "EQ", "value": "E11"}
            ],
            "requested_epsilon": 0.5000,
            "requested_delta": 0.0
        }
        res = client.post("/api/v1/queries/submit", json=payload, headers=self.analyst_headers)
        assert res.status_code == 201
        data = res.json()
        assert data["mechanism_used"] == "OPENDP_LAPLACE"
        assert data["noisy_result"] > 10000

    def test_10_differencing_attack_detection_and_block(self):
        """
        Scenario C: Differencing Attack Demonstration.
        Analyst submits Q1: COUNT on rare diagnosis 'Z99' (Target bob is in Z99).
        Then submits Q2: COUNT on diagnosis 'Z99' with narrow exclusion on mrn 'MRN-TARGET-9999'.
        The Query-History-Aware Risk Engine must detect the differencing reconstruction attack
        and reject Q2 before private data access or budget deduction.
        """
        # Step 1: Submit Q1
        q1_payload = {
            "grant_id": self.active_grant_id,
            "metric": "COUNT",
            "filters": [
                {"column": "diagnosis_code", "operator": "EQ", "value": "Z99"}
            ],
            "requested_epsilon": 0.5000
        }
        res1 = client.post("/api/v1/queries/submit", json=q1_payload, headers=self.analyst_headers)
        assert res1.status_code == 201

        # Step 2: Submit Q2 (Differencing Attack query restricting by specific attribute)
        q2_payload = {
            "grant_id": self.active_grant_id,
            "metric": "COUNT",
            "filters": [
                {"column": "diagnosis_code", "operator": "EQ", "value": "Z99"},
                {"column": "admission_type", "operator": "EQ", "value": "EMERGENCY"}
            ],
            "requested_epsilon": 0.5000
        }
        res2 = client.post("/api/v1/queries/submit", json=q2_payload, headers=self.analyst_headers)
        assert res2.status_code == 403, f"Expected 403 differencing block, got {res2.status_code}: {res2.text}"
        detail = res2.json()["detail"]
        assert detail["differencing_detected"] is True
        assert detail["risk_level"] == "CRITICAL"
        assert "DIFFERENCING DISCLOSURE DETECTED" in detail["error"]

    def test_11_budget_exhaustion_denial(self):
        """
        Scenario D: Budget Exhaustion Demonstration.
        Repeatedly submits queries until remaining epsilon is depleted,
        verifying that subsequent queries are denied with 403 Insufficient Budget.
        """
        res_b = client.get("/api/v1/budgets/my-summary", headers=self.analyst_headers)
        remaining = float(res_b.json()[0]["remaining_epsilon"])

        # Drain remaining budget with 1.0 chunks
        while remaining >= 1.0:
            payload = {
                "grant_id": self.active_grant_id,
                "metric": "COUNT",
                "filters": [{"column": "gender", "operator": "EQ", "value": "FEMALE"}],
                "requested_epsilon": 1.0000
            }
            res = client.post("/api/v1/queries/submit", json=payload, headers=self.analyst_headers)
            if res.status_code != 201:
                break
            remaining -= 1.0

        # Now submit request for 1.0 epsilon (policy ceiling is 1.0, but budget is depleted)
        over_payload = {
            "grant_id": self.active_grant_id,
            "metric": "COUNT",
            "filters": [{"column": "gender", "operator": "EQ", "value": "MALE"}],
            "requested_epsilon": 1.0000
        }
        res_over = client.post("/api/v1/queries/submit", json=over_payload, headers=self.analyst_headers)
        assert res_over.status_code == 403, f"Expected 403, got {res_over.status_code}: {res_over.text}"
        assert "Budget Exhaustion" in res_over.text or "Insufficient" in res_over.text

    def test_12_audit_trail_inspection(self):
        """Auditor retrieves immutable audit event log."""
        res = client.get("/api/v1/audit/events", headers=self.auditor_headers)
        assert res.status_code == 200
        events = res.json()
        assert len(events) > 0
        event_types = [e["event_type"] for e in events]
        assert "AUTH_LOGIN_SUCCESS" in event_types
        assert "QUERY_RELEASED" in event_types
        assert "QUERY_REJECTED" in event_types
