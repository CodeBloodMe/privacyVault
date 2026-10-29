"""
PrivacyVault — Differential Privacy Rigor, Engine Verification & Query Lifecycle Tests
Student Authors: KRISH (24BCE0846) & PARV (24BCE0870)
Course: BCSE302P Database Systems Lab (Slot L25+L26)
Faculty Guide: Dr. V. SIVAKUMAR
"""

import uuid
import os
import pytest
import psycopg2
from decimal import Decimal
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.privacy.engine import DifferentialPrivacyEngine
from backend.app.privacy.risk_engine import QueryHistoryRiskEngine
from backend.app.schemas.query import AggregateQueryRequest, MetricType, FilterCriterion, FilterOperator

client = TestClient(app)

DB_CONFIG = {
    'host': 'localhost',
    'port': 5434,
    'dbname': os.getenv('TEST_DB_NAME', 'privacyvault'),
    'user': 'privacyvault_admin',
    'password': 'AdminSuperSecretPassword2026!'
}


class TestDifferentialPrivacyAndLifecycle:

    @classmethod
    def setup_class(cls):
        """Acquire analyst credentials and refresh grant budget."""
        res = client.post("/api/v1/auth/login-json", json={
            "email": "krish.24bce0846@vitstudent.ac.in",
            "password": "AnalystPass2026!"
        })
        assert res.status_code == 200
        cls.analyst_token = res.json()["access_token"]
        cls.analyst_headers = {"Authorization": f"Bearer {cls.analyst_token}"}

        # Data owner login to refresh grant budget
        res_owner = client.post("/api/v1/auth/login-json", json={
            "email": "dr.sivakumar@vit.ac.in",
            "password": "OwnerPass2026!"
        })
        assert res_owner.status_code == 200
        cls.owner_headers = {"Authorization": f"Bearer {res_owner.json()['access_token']}"}

        datasets_res = client.get("/api/v1/datasets", headers=cls.owner_headers)
        assert datasets_res.status_code == 200
        cls.dataset_id = datasets_res.json()[0]["id"]

        client.post("/api/v1/datasets/grants", json={
            "dataset_id": cls.dataset_id,
            "analyst_email": "krish.24bce0846@vitstudent.ac.in",
            "expires_in_days": 30,
            "allocated_epsilon": 10.0
        }, headers=cls.owner_headers)

        grants_res = client.get("/api/v1/datasets/my-grants", headers=cls.analyst_headers)
        assert grants_res.status_code == 200
        cls.active_grant_id = grants_res.json()[0]["id"]

    def test_dp_sensitivity_calculation_and_bounds(self):
        """
        Verify exact mathematical global sensitivity Delta_f:
        - COUNT: Exactly 1.0 (addition or removal of 1 patient changes count by 1).
        - BOUNDED_SUM: Exactly max(|clamp_low|, |clamp_high|).
        - Unsupported metric: Raises ValueError.
        """
        # COUNT sensitivity
        s_count = DifferentialPrivacyEngine.calculate_sensitivity("COUNT", 0, 50000)
        assert s_count == 1.0

        # BOUNDED_SUM with non-negative bounds [0, 50000]
        s_sum_pos = DifferentialPrivacyEngine.calculate_sensitivity("BOUNDED_SUM", 0, 50000)
        assert s_sum_pos == 50000.0

        # BOUNDED_SUM with mixed negative bounds [-1000, 2500] -> max(|-1000|, |2500|) = 2500
        s_sum_mixed = DifferentialPrivacyEngine.calculate_sensitivity("BOUNDED_SUM", -1000, 2500)
        assert s_sum_mixed == 2500.0

        # BOUNDED_SUM with negative dominant bounds [-8000, 3000] -> max(|-8000|, |3000|) = 8000
        s_sum_neg = DifferentialPrivacyEngine.calculate_sensitivity("BOUNDED_SUM", -8000, 3000)
        assert s_sum_neg == 8000.0

        # Unsupported metric
        with pytest.raises(ValueError) as excinfo:
            DifferentialPrivacyEngine.calculate_sensitivity("MEDIAN", 0, 100)
        assert "Unsupported metric" in str(excinfo.value)

    def test_dp_gaussian_parameter_validation(self):
        """
        Verify that Gaussian mechanism strictly enforces delta in (0, 1.0) and epsilon > 0.
        Delta >= 1.0 or <= 0 must be rejected.
        """
        # Negative epsilon
        with pytest.raises(ValueError):
            DifferentialPrivacyEngine.apply_gaussian_mechanism(100.0, 1.0, epsilon=-0.5, delta=0.0001)

        # Delta <= 0
        with pytest.raises(ValueError):
            DifferentialPrivacyEngine.apply_gaussian_mechanism(100.0, 1.0, epsilon=1.0, delta=0.0)

        # Delta >= 1.0
        with pytest.raises(ValueError):
            DifferentialPrivacyEngine.apply_gaussian_mechanism(100.0, 1.0, epsilon=1.0, delta=1.5)

        # Valid Gaussian call produces release with OPENDP_GAUSSIAN
        meta = DifferentialPrivacyEngine.apply_gaussian_mechanism(100.0, 1.0, epsilon=1.0, delta=0.00001)
        assert meta.mechanism_used == "OPENDP_GAUSSIAN"
        assert meta.delta_spent == 0.00001
        assert meta.true_result_hidden is True

    def test_composite_bounded_average_execution(self):
        """
        Verify that BOUNDED_AVG executes via mathematically sound Compositional DP Mean:
        - Splits epsilon into eps/2 for sum and eps/2 for count.
        - Neither noise scale nor sensitivity reveals the raw patient count N.
        - Result is clamped to valid domain bounds [0, 50000].
        """
        payload = {
            "grant_id": self.active_grant_id,
            "metric": "BOUNDED_AVG",
            "target_column": "treatment_cost",
            "filters": [
                {"column": "admission_type", "operator": "EQ", "value": "EMERGENCY"}
            ],
            "requested_epsilon": 0.5000,
            "requested_delta": 0.0
        }
        res = client.post("/api/v1/queries/submit", json=payload, headers=self.analyst_headers)
        assert res.status_code == 201, f"Expected 201, got {res.status_code}: {res.text}"
        data = res.json()
        assert data["metric"] == "BOUNDED_AVG"
        assert data["mechanism_used"] == "OPENDP_COMPOSITE_MEAN"
        assert 0.0 <= data["noisy_result"] <= 50000.0
        assert data["epsilon_spent"] == 0.5000
        # Sensitivity applied is the global sum clamp bound, not private N
        assert data["sensitivity_applied"] == 50000.0

    def test_gaussian_dp_query_submission(self):
        """
        Verify approximate (epsilon, delta)-DP query submission via API.
        """
        payload = {
            "grant_id": self.active_grant_id,
            "metric": "COUNT",
            "filters": [
                {"column": "diagnosis_code", "operator": "EQ", "value": "I10"}
            ],
            "requested_epsilon": 0.2000,
            "requested_delta": 0.00005
        }
        res = client.post("/api/v1/queries/submit", json=payload, headers=self.analyst_headers)
        assert res.status_code == 201
        data = res.json()
        assert data["mechanism_used"] == "OPENDP_GAUSSIAN"
        assert data["delta_spent"] == 0.00005

    def test_duplicate_and_retried_request_idempotency(self):
        """
        Verify Client Idempotency Invariant:
        When a client retries a query with the same request_id after a release,
        the server returns the identical release without re-executing or double-charging budget.
        """
        req_id = str(uuid.uuid4())
        payload = {
            "request_id": req_id,
            "grant_id": self.active_grant_id,
            "metric": "COUNT",
            "filters": [
                {"column": "gender", "operator": "EQ", "value": "FEMALE"}
            ],
            "requested_epsilon": 0.1000
        }

        # Submission 1: fresh execution
        res1 = client.post("/api/v1/queries/submit", json=payload, headers=self.analyst_headers)
        assert res1.status_code == 201
        rel1 = res1.json()

        # Check remaining budget after Submission 1
        res_b1 = client.get("/api/v1/budgets/my-summary", headers=self.analyst_headers)
        remaining_after_sub1 = float(res_b1.json()[0]["remaining_epsilon"])

        # Submission 2: retry with identical request_id (simulated network timeout retry)
        res2 = client.post("/api/v1/queries/submit", json=payload, headers=self.analyst_headers)
        assert res2.status_code == 201
        rel2 = res2.json()

        # Release IDs and noisy results must be identical (no re-noising)
        assert rel1["id"] == rel2["id"]
        assert rel1["noisy_result"] == rel2["noisy_result"]

        # Budget must NOT have been debited again
        res_b2 = client.get("/api/v1/budgets/my-summary", headers=self.analyst_headers)
        remaining_after_sub2 = float(res_b2.json()[0]["remaining_epsilon"])
        assert remaining_after_sub1 == remaining_after_sub2

    def test_post_release_refund_prevention_in_stored_procedure(self):
        """
        Verify Database Security Invariant:
        fn_refund_privacy_budget MUST REJECT any refund attempt for a query that has already been RELEASED.
        """
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()

        # Find any released query request
        cur.execute("SELECT id, grant_id FROM query_requests WHERE status = 'RELEASED' LIMIT 1;")
        row = cur.fetchone()
        assert row is not None
        released_req_id, grant_id = row

        cur.execute("SELECT id FROM privacy_budgets WHERE grant_id = %s;", (grant_id,))
        budget_id = cur.fetchone()[0]

        # Attempt to refund a released query
        cur.execute(
            "SELECT success, new_balance, error_message FROM fn_refund_privacy_budget(%s, %s, %s);",
            (budget_id, 0.5000, released_req_id)
        )
        res = cur.fetchone()
        conn.commit()
        conn.close()

        assert res[0] is False, "Security Violation: Stored procedure allowed refunding a released query!"
        assert "Cannot refund privacy budget after query result has already been released" in str(res[2])

    def test_duplicate_refund_prevention_in_stored_procedure(self):
        """
        Verify Stored Procedure Invariant:
        A failed query can only be refunded ONCE. Duplicate refund attempts are rejected.
        """
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()

        # Create isolated test grant and budget
        test_analyst_id = str(uuid.uuid4())
        cur.execute("""
            INSERT INTO users (id, email, password_hash, full_name, is_active)
            VALUES (%s, %s, 'hash', 'Refund Duplicate Tester', TRUE);
        """, (test_analyst_id, f"refund.{uuid.uuid4().hex[:8]}@vitstudent.ac.in"))

        cur.execute("SELECT id FROM datasets LIMIT 1;")
        dataset_id = cur.fetchone()[0]

        grant_id = str(uuid.uuid4())
        cur.execute("""
            INSERT INTO dataset_grants (id, dataset_id, analyst_id, granted_by, expires_at, is_active)
            VALUES (%s, %s, %s, %s, NOW() + INTERVAL '30 days', TRUE);
        """, (grant_id, dataset_id, test_analyst_id, test_analyst_id))

        budget_id = str(uuid.uuid4())
        cur.execute("""
            INSERT INTO privacy_budgets (id, grant_id, total_epsilon, remaining_epsilon)
            VALUES (%s, %s, 2.0000, 2.0000);
        """, (budget_id, grant_id))

        failed_req_id = str(uuid.uuid4())
        cur.execute("""
            INSERT INTO query_requests (id, grant_id, analyst_id, metric, filter_criteria, requested_epsilon, status)
            VALUES (%s, %s, %s, 'COUNT', '[]'::jsonb, 0.5000, 'FAILED');
        """, (failed_req_id, grant_id, test_analyst_id))
        conn.commit()

        # Step 1: Reserve 0.5
        cur.execute("SELECT success, remaining, error_message FROM fn_reserve_privacy_budget(%s, %s, %s);",
                    (budget_id, 0.5000, failed_req_id))
        res_res = cur.fetchone()
        conn.commit()
        assert res_res[0] is True

        # Step 2: Refund 1st time -> must succeed
        cur.execute("SELECT success, new_balance, error_message FROM fn_refund_privacy_budget(%s, %s, %s);",
                    (budget_id, 0.5000, failed_req_id))
        ref1 = cur.fetchone()
        conn.commit()
        assert ref1[0] is True
        assert float(ref1[1]) == 2.0000

        # Step 3: Refund 2nd time -> MUST BE REJECTED
        cur.execute("SELECT success, new_balance, error_message FROM fn_refund_privacy_budget(%s, %s, %s);",
                    (budget_id, 0.5000, failed_req_id))
        ref2 = cur.fetchone()
        conn.commit()
        conn.close()

        assert ref2[0] is False, "Security Violation: Stored procedure allowed duplicate refund!"
        assert "already been refunded" in str(ref2[2])

    def test_negative_or_zero_budget_reservation_rejected(self):
        """
        Verify that fn_reserve_privacy_budget rejects negative or zero epsilon requests.
        """
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()

        cur.execute("SELECT id FROM privacy_budgets LIMIT 1;")
        budget_id = cur.fetchone()[0]

        # Negative epsilon
        cur.execute("SELECT success, remaining, error_message FROM fn_reserve_privacy_budget(%s, -1.0, %s);",
                    (budget_id, str(uuid.uuid4())))
        res_neg = cur.fetchone()
        assert res_neg[0] is False
        assert "must be strictly positive" in str(res_neg[2])

        # Zero epsilon
        cur.execute("SELECT success, remaining, error_message FROM fn_reserve_privacy_budget(%s, 0.0, %s);",
                    (budget_id, str(uuid.uuid4())))
        res_zero = cur.fetchone()
        assert res_zero[0] is False
        assert "must be strictly positive" in str(res_zero[2])

        conn.close()

    def test_query_history_risk_engine_detected_and_non_detected_cases(self):
        """
        Verify QueryHistoryRiskEngine across multiple scenarios:
        1. Exact repeat >= 2 times -> HIGH risk (repetition averaging detection).
        2. Differencing attack via narrow attribute restriction -> CRITICAL risk (blocked).
        3. Independent disjoint filters -> LOW risk (compliant).
        4. Narrow predicate numeric shift -> HIGH risk (boundary record risk).
        """
        # Case 1: Exact repeat query
        q_base = AggregateQueryRequest(
            grant_id=uuid.uuid4(),
            metric=MetricType.COUNT,
            filters=[FilterCriterion(column="diagnosis_code", operator=FilterOperator.EQ, value="E11")],
            requested_epsilon=Decimal("0.5")
        )
        prior_releases = [
            {"id": "q1", "metric": "COUNT", "target_column": None, "filter_criteria": [{"column": "diagnosis_code", "operator": "EQ", "value": "E11"}]},
            {"id": "q2", "metric": "COUNT", "target_column": None, "filter_criteria": [{"column": "diagnosis_code", "operator": "EQ", "value": "E11"}]}
        ]
        res1 = QueryHistoryRiskEngine.evaluate_risk(q_base, prior_releases)
        assert res1.risk_level == "HIGH"
        assert "Repetition Risk" in res1.risk_summary

        # Case 2: Differencing attack: candidate adds narrow identifier attribute
        q_diff = AggregateQueryRequest(
            grant_id=uuid.uuid4(),
            metric=MetricType.COUNT,
            filters=[
                {"column": "diagnosis_code", "operator": "EQ", "value": "Z99"},
                {"column": "mrn", "operator": "EQ", "value": "MRN-TARGET-9999"}
            ],
            requested_epsilon=Decimal("0.5")
        )
        prior_diff = [
            {"id": "q_prior", "metric": "COUNT", "target_column": None, "filter_criteria": [{"column": "diagnosis_code", "operator": "EQ", "value": "Z99"}]}
        ]
        res2 = QueryHistoryRiskEngine.evaluate_risk(q_diff, prior_diff)
        assert res2.risk_level == "CRITICAL"
        assert res2.is_blocked is True
        assert res2.differencing_detected is True

        # Case 3: Completely independent query cohort -> LOW risk
        q_independent = AggregateQueryRequest(
            grant_id=uuid.uuid4(),
            metric=MetricType.COUNT,
            filters=[{"column": "diagnosis_code", "operator": "EQ", "value": "I10"}],
            requested_epsilon=Decimal("0.5")
        )
        prior_ind = [
            {"id": "q_prior", "metric": "COUNT", "target_column": None, "filter_criteria": [{"column": "gender", "operator": "EQ", "value": "FEMALE"}]}
        ]
        res3 = QueryHistoryRiskEngine.evaluate_risk(q_independent, prior_ind)
        assert res3.risk_level == "LOW"
        assert res3.is_blocked is False

        # Case 4: Narrow numeric boundary shift (age > 80 vs age > 79)
        q_shift = AggregateQueryRequest(
            grant_id=uuid.uuid4(),
            metric=MetricType.COUNT,
            filters=[{"column": "age", "operator": "GT", "value": 80}],
            requested_epsilon=Decimal("0.5")
        )
        prior_shift = [
            {"id": "q_prior", "metric": "COUNT", "target_column": None, "filter_criteria": [{"column": "age", "operator": "GT", "value": 79}]}
        ]
        res4 = QueryHistoryRiskEngine.evaluate_risk(q_shift, prior_shift)
        assert res4.risk_level == "HIGH"
        assert "Narrow Predicate Shift" in res4.risk_summary
