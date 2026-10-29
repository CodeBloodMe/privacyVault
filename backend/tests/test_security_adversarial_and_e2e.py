"""
================================================================================
PrivacyVault — Full-System Adversarial Security & E2E Regression Test Suite
Student Authors: KRISH (24BCE0846) & PARV (24BCE0870)
Course: BCSE302P Database Systems Lab (Slot L25+L26)
Faculty Guide: Dr. V. SIVAKUMAR

Scope:
- Authentication & Session Hardening
- RBAC & Vertical Privilege Escalation Defense
- Horizontal Privilege Escalation (IDOR) Regression Tests (Grants, Budgets, Queries)
- SQL Injection & Parameterized Immunity
- Direct Identifier Cohort Slicing Immunity (App & Stored Procedure)
- Differential Privacy Budget Invariants (Idempotency, Post-Release Refunds, Collision)
- Complete End-to-End Multi-Role Workflow
================================================================================
"""

import uuid
from decimal import Decimal
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from backend.app.main import app
from backend.app.db.session import SessionLocal
from backend.app.models.users import User, Role
from backend.app.models.datasets import Dataset, DatasetGrant
from backend.app.models.budgets import PrivacyBudget
from backend.app.models.queries import QueryRequest
from backend.app.core.security import hash_password, create_access_token

client = TestClient(app)

AUTHORS_SIGNATURE = "REG_24BCE0846_24BCE0870_KRISH_PARV"


@pytest.fixture(scope="function")
def db_session():
    db = SessionLocal()
    yield db
    db.rollback()
    db.close()


@pytest.fixture(scope="module")
def analyst_token():
    response = client.post("/api/v1/auth/login", data={"username": "krish.24bce0846@vitstudent.ac.in", "password": "AnalystPass2026!"})
    assert response.status_code == 200
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def owner_token():
    response = client.post("/api/v1/auth/login", data={"username": "dr.sivakumar@vit.ac.in", "password": "OwnerPass2026!"})
    assert response.status_code == 200
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def auditor_token():
    response = client.post("/api/v1/auth/login", data={"username": "compliance.auditor@vit.ac.in", "password": "AuditorPass2026!"})
    assert response.status_code == 200
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def admin_token():
    response = client.post("/api/v1/auth/login", data={"username": "admin@privacyvault.local", "password": "AdminPass2026!"})
    assert response.status_code == 200
    return response.json()["access_token"]


@pytest.fixture(scope="function")
def active_analyst_grant(db_session):
    """Guarantees an active dataset grant for test analyst Krish."""
    analyst = db_session.query(User).filter(User.email == "krish.24bce0846@vitstudent.ac.in").first()
    grant = db_session.query(DatasetGrant).filter(DatasetGrant.analyst_id == analyst.id).first()
    if grant:
        grant.is_active = True
        db_session.commit()
        db_session.refresh(grant)
    return grant


@pytest.fixture(scope="module")
def secondary_owner_and_analyst():
    """Creates a secondary Data Owner and secondary Analyst for cross-tenant IDOR tests."""
    db = SessionLocal()
    try:
        owner_role = db.query(Role).filter(Role.name == "DATA_OWNER").first()
        analyst_role = db.query(Role).filter(Role.name == "ANALYST").first()

        # 1. Create Secondary Owner
        owner_b = db.query(User).filter(User.email == "owner_b@privacyvault.local").first()
        if not owner_b:
            owner_b = User(
                id=uuid.uuid4(),
                email="owner_b@privacyvault.local",
                password_hash=hash_password("SecondaryOwner2026!"),
                full_name="Dr. Secondary Owner",
                is_active=True
            )
            owner_b.roles.append(owner_role)
            db.add(owner_b)
            db.commit()
            db.refresh(owner_b)

        # 2. Create Secondary Analyst
        analyst_b = db.query(User).filter(User.email == "analyst_b@privacyvault.local").first()
        if not analyst_b:
            analyst_b = User(
                id=uuid.uuid4(),
                email="analyst_b@privacyvault.local",
                password_hash=hash_password("SecondaryAnalyst2026!"),
                full_name="Secondary Analyst B",
                is_active=True
            )
            analyst_b.roles.append(analyst_role)
            db.add(analyst_b)
            db.commit()
            db.refresh(analyst_b)

        token_b = create_access_token(subject=str(owner_b.id), roles=["DATA_OWNER"])
        analyst_token_b = create_access_token(subject=str(analyst_b.id), roles=["ANALYST"])

        return {
            "owner_b_id": owner_b.id,
            "token_owner_b": token_b,
            "analyst_b_id": analyst_b.id,
            "token_analyst_b": analyst_token_b
        }
    finally:
        db.close()


# ============================================================================
# 1. AUTHENTICATION & SESSION SECURITY AUDIT
# ============================================================================

class TestAuthenticationSecurity:
    """Verifies authentication boundaries, token integrity, and session handling."""

    def test_unauthenticated_requests_strictly_denied(self):
        """Endpoints requiring authentication must return 401 Unauthorized without a valid token."""
        endpoints = [
            ("GET", "/api/v1/auth/me"),
            ("GET", "/api/v1/datasets"),
            ("GET", "/api/v1/datasets/my-grants"),
            ("GET", "/api/v1/budgets/my-summary"),
            ("GET", "/api/v1/budgets/all-summaries"),
            ("GET", "/api/v1/audit/events"),
            ("POST", "/api/v1/queries/validate"),
            ("POST", "/api/v1/queries/submit"),
        ]
        for method, endpoint in endpoints:
            if method == "GET":
                resp = client.get(endpoint)
            else:
                resp = client.post(endpoint, json={})
            assert resp.status_code == 401, f"Unauthenticated request to {endpoint} returned {resp.status_code}, expected 401"

    def test_malformed_and_tampered_tokens_rejected(self):
        """Invalid, random, or tampered JWTs must be rejected with 401."""
        tampered_tokens = [
            "Bearer invalid.jwt.token",
            "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.bogus",
            "Bearer ''",
            "InvalidPrefix eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
        ]
        for bad_tok in tampered_tokens:
            resp = client.get("/api/v1/auth/me", headers={"Authorization": bad_tok})
            assert resp.status_code in (401, 403), f"Malformed token accepted: {bad_tok}"


# ============================================================================
# 2. ROLE-BASED ACCESS CONTROL (RBAC) & VERTICAL PRIVILEGE ESCALATION
# ============================================================================

class TestRoleBasedAccessControl:
    """Verifies that each role is strictly restricted to its authorized operations."""

    def test_analyst_cannot_issue_grants(self, analyst_token):
        """Analyst attempting to issue grants must receive 403 Forbidden."""
        resp = client.post(
            "/api/v1/datasets/grants",
            headers={"Authorization": f"Bearer {analyst_token}"},
            json={
                "dataset_id": str(uuid.uuid4()),
                "analyst_email": "krish.24bce0846@vitstudent.ac.in",
                "allocated_epsilon": 5.0,
                "expires_in_days": 30
            }
        )
        assert resp.status_code == 403
        assert "Operation requires one of the following roles" in resp.json()["detail"]

    def test_analyst_cannot_revoke_grants(self, analyst_token):
        """Analyst attempting to revoke grants must receive 403 Forbidden."""
        resp = client.post(
            f"/api/v1/datasets/grants/{uuid.uuid4()}/revoke",
            headers={"Authorization": f"Bearer {analyst_token}"}
        )
        assert resp.status_code == 403

    def test_analyst_cannot_view_all_budget_summaries(self, analyst_token):
        """Analyst attempting to view global budget governance summary must receive 403 Forbidden."""
        resp = client.get(
            "/api/v1/budgets/all-summaries",
            headers={"Authorization": f"Bearer {analyst_token}"}
        )
        assert resp.status_code == 403

    def test_analyst_cannot_view_audit_events(self, analyst_token):
        """Analyst attempting to view compliance audit log must receive 403 Forbidden."""
        resp = client.get(
            "/api/v1/audit/events",
            headers={"Authorization": f"Bearer {analyst_token}"}
        )
        assert resp.status_code == 403

    def test_auditor_cannot_submit_queries(self, auditor_token):
        """Auditor attempting to submit DP queries must receive 403 Forbidden."""
        resp = client.post(
            "/api/v1/queries/submit",
            headers={"Authorization": f"Bearer {auditor_token}"},
            json={
                "grant_id": str(uuid.uuid4()),
                "metric": "COUNT",
                "requested_epsilon": 0.5,
                "requested_delta": 0.0
            }
        )
        assert resp.status_code == 403


# ============================================================================
# 3. HORIZONTAL PRIVILEGE ESCALATION (IDOR) REGRESSION TESTS
# ============================================================================

class TestHorizontalPrivilegeEscalation:
    """Verifies cross-tenant isolation and ownership enforcement on sensitive operations."""

    def test_idor_grant_revocation_denied(self, secondary_owner_and_analyst, db_session):
        """
        SEC-01 Regression Test:
        Data Owner B MUST NOT be able to revoke a grant belonging to Data Owner A's dataset.
        """
        token_owner_b = secondary_owner_and_analyst["token_owner_b"]

        grant = db_session.query(DatasetGrant).filter(DatasetGrant.is_active == True).first()
        assert grant is not None

        resp = client.post(
            f"/api/v1/datasets/grants/{grant.id}/revoke",
            headers={"Authorization": f"Bearer {token_owner_b}"}
        )
        assert resp.status_code == 403
        assert "You do not own the dataset associated with this grant" in resp.json()["detail"]

    def test_idor_grant_issuance_denied(self, secondary_owner_and_analyst, db_session):
        """
        SEC-02 Regression Test:
        Data Owner B MUST NOT be able to issue grants on Data Owner A's dataset.
        """
        token_owner_b = secondary_owner_and_analyst["token_owner_b"]

        dataset_a = db_session.query(Dataset).first()
        assert dataset_a is not None

        resp = client.post(
            "/api/v1/datasets/grants",
            headers={"Authorization": f"Bearer {token_owner_b}"},
            json={
                "dataset_id": str(dataset_a.id),
                "analyst_email": "krish.24bce0846@vitstudent.ac.in",
                "allocated_epsilon": 2.0,
                "expires_in_days": 14
            }
        )
        assert resp.status_code == 403
        assert "You do not own this dataset" in resp.json()["detail"]

    def test_idor_budget_ledger_access_denied(self, secondary_owner_and_analyst, db_session):
        """
        SEC-01/02 Related Regression Test:
        Data Owner B MUST NOT be able to view the budget ledger of a grant on Data Owner A's dataset.
        """
        token_owner_b = secondary_owner_and_analyst["token_owner_b"]

        budget = db_session.query(PrivacyBudget).first()
        assert budget is not None

        resp = client.get(
            f"/api/v1/budgets/{budget.id}/ledger",
            headers={"Authorization": f"Bearer {token_owner_b}"}
        )
        assert resp.status_code == 403
        assert "You do not own the dataset associated with this budget" in resp.json()["detail"]

    def test_cross_analyst_query_record_access_denied(self, secondary_owner_and_analyst, analyst_token, db_session):
        """Analyst B MUST NOT be able to inspect Analyst A's query request or release."""
        token_analyst_b = secondary_owner_and_analyst["token_analyst_b"]

        # Ensure a query request exists
        q_req = db_session.query(QueryRequest).first()
        if not q_req:
            grant = db_session.query(DatasetGrant).filter(DatasetGrant.is_active == True).first()
            sub_res = client.post("/api/v1/queries/submit", headers={"Authorization": f"Bearer {analyst_token}"}, json={
                "grant_id": str(grant.id),
                "metric": "COUNT",
                "requested_epsilon": 0.1,
                "requested_delta": 0.0
            })
            assert sub_res.status_code == 201
            q_req = db_session.query(QueryRequest).filter(QueryRequest.id == sub_res.json()["request_id"]).first()

        assert q_req is not None

        resp = client.get(
            f"/api/v1/queries/{q_req.id}",
            headers={"Authorization": f"Bearer {token_analyst_b}"}
        )
        assert resp.status_code == 403
        assert "Access denied to this query record" in resp.json()["detail"]


# ============================================================================
# 4. ADVERSARIAL QUERY & DATA LEAKAGE RESISTANCE
# ============================================================================

class TestAdversarialQueryResistance:
    """Tests malicious queries, injection attacks, and identifier-slicing resistance."""

    def test_direct_identifier_filter_blocked_at_api(self, analyst_token, active_analyst_grant):
        """
        SEC-03 Regression Test:
        Filtering on direct identifiers (e.g. mrn) MUST be blocked with HTTP 403 Critical Security Violation.
        """
        grant = active_analyst_grant
        assert grant is not None

        payload = {
            "grant_id": str(grant.id),
            "metric": "COUNT",
            "filters": [
                {"column": "mrn", "operator": "EQ", "value": "MRN-10001"}
            ],
            "requested_epsilon": 0.5,
            "requested_delta": 0.0
        }

        # Dry-run validation check
        val_resp = client.post(
            "/api/v1/queries/validate",
            headers={"Authorization": f"Bearer {analyst_token}"},
            json=payload
        )
        assert val_resp.status_code == 200
        val_data = val_resp.json()
        assert val_data["valid"] is False
        assert val_data["risk_level"] == "CRITICAL"
        assert "Direct identifier 'mrn' cannot be used in filter predicates" in val_data["error"]

        # Submit attempt check
        sub_resp = client.post(
            "/api/v1/queries/submit",
            headers={"Authorization": f"Bearer {analyst_token}"},
            json=payload
        )
        assert sub_resp.status_code == 403
        assert "Direct identifier 'mrn' cannot be used in filter predicates" in sub_resp.json()["detail"]["error"]

    def test_db_stored_procedure_rejects_identifier_filter(self, db_session):
        """
        SEC-03 Database Defense-in-Depth:
        Direct call to fn_execute_bounded_aggregation with an identifier filter MUST raise an exception.
        """
        try:
            with pytest.raises(Exception) as exc_info:
                db_session.execute(text("""
                    SELECT fn_execute_bounded_aggregation(
                        'COUNT', NULL, '[{"column": "mrn", "operator": "EQ", "value": "MRN-10001"}]'::jsonb
                    );
                """))
            assert "Security Violation: Direct identifier mrn cannot be used in filter predicates" in str(exc_info.value)
        finally:
            db_session.rollback()

    def test_sql_injection_payloads_in_filters_safely_rejected_or_parameterized(self, analyst_token, active_analyst_grant, db_session):
        """Injected SQL syntax in filter column or value must either fail schema check or be strictly literal."""
        grant = active_analyst_grant
        assert grant is not None

        # 1. Injection in column name
        sqli_column_payload = {
            "grant_id": str(grant.id),
            "metric": "COUNT",
            "filters": [{"column": "gender; DROP TABLE users; --", "operator": "EQ", "value": "Female"}],
            "requested_epsilon": 0.5,
            "requested_delta": 0.0
        }
        resp = client.post(
            "/api/v1/queries/validate",
            headers={"Authorization": f"Bearer {analyst_token}"},
            json=sqli_column_payload
        )
        assert resp.status_code == 200
        assert resp.json()["valid"] is False
        assert "does not exist in dataset schema" in resp.json()["error"]

        # 2. Injection in filter value: strictly treated as literal string, no DB error or table destruction
        sqli_value_payload = {
            "grant_id": str(grant.id),
            "metric": "COUNT",
            "filters": [{"column": "gender", "operator": "EQ", "value": "' OR '1'='1"}],
            "requested_epsilon": 0.5,
            "requested_delta": 0.0
        }
        resp = client.post(
            "/api/v1/queries/validate",
            headers={"Authorization": f"Bearer {analyst_token}"},
            json=sqli_value_payload
        )
        assert resp.status_code == 200
        # Check that users table still exists
        user_count = db_session.execute(text("SELECT COUNT(*) FROM users;")).scalar()
        assert user_count >= 4


# ============================================================================
# 5. DIFFERENTIAL PRIVACY BUDGET INVARIANTS & LIFECYCLE
# ============================================================================

class TestDifferentialPrivacyInvariants:
    """Verifies idempotency collision handling, post-release refund prevention, and accounting invariants."""

    def test_cross_analyst_request_id_collision_blocked(self, analyst_token, active_analyst_grant, secondary_owner_and_analyst, db_session):
        """
        SEC-04 Regression Test:
        Analyst B attempting to submit a query with an existing request_id belonging to Analyst A
        MUST receive HTTP 403 Forbidden.
        """
        token_analyst_b = secondary_owner_and_analyst["token_analyst_b"]

        # Ensure a released request belonging to Analyst A exists
        grant = active_analyst_grant
        q_req = db_session.query(QueryRequest).filter(QueryRequest.status == "RELEASED", QueryRequest.analyst_id == grant.analyst_id).first()
        if not q_req:
            sub_res = client.post("/api/v1/queries/submit", headers={"Authorization": f"Bearer {analyst_token}"}, json={
                "grant_id": str(grant.id),
                "metric": "COUNT",
                "filters": [
                    {"column": "gender", "operator": "EQ", "value": "Female"},
                    {"column": "admission_type", "operator": "EQ", "value": "Elective"}
                ],
                "requested_epsilon": 0.1,
                "requested_delta": 0.0
            })
            assert sub_res.status_code == 201
            q_req = db_session.query(QueryRequest).filter(QueryRequest.id == sub_res.json()["request_id"]).first()

        assert q_req is not None

        # Analyst B attempts to submit with Analyst A's request_id
        resp = client.post(
            "/api/v1/queries/submit",
            headers={"Authorization": f"Bearer {token_analyst_b}"},
            json={
                "request_id": str(q_req.id),
                "grant_id": str(q_req.grant_id),
                "metric": "COUNT",
                "requested_epsilon": 0.5,
                "requested_delta": 0.0
            }
        )
        assert resp.status_code == 403
        assert "request_id belongs to another analyst session" in resp.json()["detail"]

    def test_in_flight_or_failed_request_id_returns_409_conflict(self, analyst_token, active_analyst_grant, db_session):
        """
        SEC-04 Regression Test:
        Submitting a query with an already terminated (FAILED/REJECTED) request_id returns HTTP 409 Conflict.
        """
        failed_id = uuid.uuid4()
        grant = active_analyst_grant
        analyst = db_session.query(User).filter(User.email == "krish.24bce0846@vitstudent.ac.in").first()

        req = QueryRequest(
            id=failed_id,
            grant_id=grant.id,
            analyst_id=analyst.id,
            metric="COUNT",
            requested_epsilon=Decimal("0.5"),
            requested_delta=Decimal("0.0"),
            status="FAILED",
            risk_level="LOW"
        )
        db_session.add(req)
        db_session.commit()

        resp = client.post(
            "/api/v1/queries/submit",
            headers={"Authorization": f"Bearer {analyst_token}"},
            json={
                "request_id": str(failed_id),
                "grant_id": str(grant.id),
                "metric": "COUNT",
                "requested_epsilon": 0.5,
                "requested_delta": 0.0
            }
        )
        assert resp.status_code == 409
        assert "previously terminated with status FAILED" in resp.json()["detail"]

    def test_concurrent_request_id_race_integrity_error_handled(self, analyst_token, active_analyst_grant):
        """
        SEC-04 / Concurrency Hardening:
        Two simultaneous queries submitted with the exact same request_id must not crash with HTTP 500;
        one must succeed and the duplicate must receive 409 Conflict (or 200/201 if release was already cached).
        """
        import concurrent.futures
        shared_id = str(uuid.uuid4())
        grant = active_analyst_grant

        def submit():
            return client.post(
                "/api/v1/queries/submit",
                headers={"Authorization": f"Bearer {analyst_token}"},
                json={
                    "request_id": shared_id,
                    "grant_id": str(grant.id),
                    "metric": "COUNT",
                    "filters": [
                        {"column": "diagnosis_code", "operator": "EQ", "value": "I10"}
                    ],
                    "requested_epsilon": 0.1,
                    "requested_delta": 0.0
                }
            )

        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
            f1 = executor.submit(submit)
            f2 = executor.submit(submit)
            r1 = f1.result()
            r2 = f2.result()

        # Both responses must be clean client-level responses (200, 201, or 409), NEVER HTTP 500
        assert r1.status_code in (200, 201, 409), f"r1 failed with {r1.status_code}: {r1.text}"
        assert r2.status_code in (200, 201, 409), f"r2 failed with {r2.status_code}: {r2.text}"
        assert (r1.status_code in (200, 201)) or (r2.status_code in (200, 201))


# ============================================================================
# 6. END-TO-END ANALYTICS WORKFLOW VERIFICATION
# ============================================================================

class TestEndToEndAnalyticsWorkflow:
    """Complete multi-step analyst workflow testing against real PostgreSQL database."""

    def test_full_analyst_query_and_accounting_lifecycle(self, analyst_token, owner_token, db_session):
        """
        Verifies:
        1. Login & token acquisition
        2. Catalog exploration
        3. Active grants and budget check
        4. Valid aggregate query submission (OpenDP Laplace)
        5. Response inspection (noisy result, epsilon spent, noise scale, author signature)
        6. Budget reduction verification
        7. Idempotent retry with same request_id (returns same release without re-charging)
        """
        # Step 1: Catalog Exploration
        cat_resp = client.get("/api/v1/datasets", headers={"Authorization": f"Bearer {analyst_token}"})
        assert cat_resp.status_code == 200
        datasets = cat_resp.json()
        assert len(datasets) > 0
        dataset_id = datasets[0]["id"]

        # Ensure active grant has fresh budget (10.0 epsilon)
        client.post("/api/v1/datasets/grants", json={
            "dataset_id": dataset_id,
            "analyst_email": "krish.24bce0846@vitstudent.ac.in",
            "expires_in_days": 30,
            "allocated_epsilon": 10.0
        }, headers={"Authorization": f"Bearer {owner_token}"})

        # Step 2: Active Grants
        grants_resp = client.get("/api/v1/datasets/my-grants", headers={"Authorization": f"Bearer {analyst_token}"})
        assert grants_resp.status_code == 200
        grants = grants_resp.json()
        assert len(grants) > 0
        grant_id = grants[0]["id"]

        # Step 3: Initial Budget Balance
        bud_resp = client.get("/api/v1/budgets/my-summary", headers={"Authorization": f"Bearer {analyst_token}"})
        assert bud_resp.status_code == 200
        initial_remaining = float(next(b["remaining_epsilon"] for b in bud_resp.json() if b["grant_id"] == grant_id))
        assert initial_remaining > 0

        # Step 4: Submit Aggregate Query
        req_id = str(uuid.uuid4())
        query_payload = {
            "request_id": req_id,
            "grant_id": grant_id,
            "metric": "COUNT",
            "filters": [
                {"column": "gender", "operator": "EQ", "value": "Female"},
                {"column": "blood_group", "operator": "EQ", "value": "O+"}
            ],
            "requested_epsilon": 0.25,
            "requested_delta": 0.0
        }
        sub_resp = client.post("/api/v1/queries/submit", headers={"Authorization": f"Bearer {analyst_token}"}, json=query_payload)
        assert sub_resp.status_code == 201
        rel_data = sub_resp.json()

        # Step 5: Verify Release Payload Invariants
        assert rel_data["request_id"] == req_id
        assert "LAPLACE" in rel_data["mechanism_used"]
        assert rel_data["epsilon_spent"] == 0.25
        assert rel_data["noise_scale"] == 4.0  # scale = 1 / 0.25 = 4.0
        assert rel_data["author_signature"] == AUTHORS_SIGNATURE

        # Step 6: Verify Budget Decrement
        bud_resp_after = client.get("/api/v1/budgets/my-summary", headers={"Authorization": f"Bearer {analyst_token}"})
        new_remaining = float(next(b["remaining_epsilon"] for b in bud_resp_after.json() if b["grant_id"] == grant_id))
        expected_remaining = round(initial_remaining - 0.25, 4)
        assert round(new_remaining, 4) == expected_remaining

        # Step 7: Retry with exact same request_id -> Idempotent response
        retry_resp = client.post("/api/v1/queries/submit", headers={"Authorization": f"Bearer {analyst_token}"}, json=query_payload)
        assert retry_resp.status_code in (200, 201)
        retry_data = retry_resp.json()
        assert retry_data["id"] == rel_data["id"]
        assert retry_data["noisy_result"] == rel_data["noisy_result"]

        # Step 8: Verify NO duplicate budget spent
        bud_resp_retry = client.get("/api/v1/budgets/my-summary", headers={"Authorization": f"Bearer {analyst_token}"})
        retry_remaining = float(next(b["remaining_epsilon"] for b in bud_resp_retry.json() if b["grant_id"] == grant_id))
        assert round(retry_remaining, 4) == expected_remaining
