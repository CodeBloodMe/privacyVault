"""
PrivacyVault — Concurrency, Race Condition & Security Threat Integration Tests
Student Authors: KRISH (24BCE0846) & PARV (24BCE0870)
Course: BCSE302P Database Systems Lab (Slot L25+L26)
Faculty: Dr. V. SIVAKUMAR
"""

import uuid
import concurrent.futures
from decimal import Decimal
import psycopg2
from fastapi.testclient import TestClient

from backend.app.main import app
import os
from backend.app.core.config import settings

client = TestClient(app)

DB_CONFIG = {
    'host': 'localhost',
    'port': 5434,
    'dbname': os.getenv('TEST_DB_NAME', 'privacyvault'),
    'user': 'privacyvault_admin',
    'password': 'AdminSuperSecretPassword2026!'
}


class TestConcurrencyAndSecurity:

    def test_concurrent_budget_overspending_prevention(self):
        """
        Critical Concurrency Invariant:
        Simultaneously launch 10 concurrent database transactions attempting to reserve 0.5 epsilon
        when only 1.0 epsilon remains.
        The PostgreSQL Stored Procedure with 'FOR UPDATE' row-level lock must guarantee:
        - Exactly 2 requests succeed (0.5 * 2 = 1.0).
        - Exactly 8 requests are rejected with 'Insufficient privacy budget remaining'.
        - Final budget remaining_epsilon is exactly 0.0000.
        - Sum of RESERVATION ledger entries is exactly 1.0000.
        """
        print("\n" + "=" * 70)
        print("CONCURRENCY TEST: 10 Simultaneous Requests against 1.0 Budget Balance")
        print("Authors: KRISH (24BCE0846) & PARV (24BCE0870)")
        print("=" * 70)

        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()

        # Create dedicated test analyst and grant
        analyst_id = str(uuid.uuid4())
        analyst_email = f"concurrent.{uuid.uuid4().hex[:8]}@vitstudent.ac.in"
        cur.execute("""
            INSERT INTO users (id, email, password_hash, full_name, is_active)
            VALUES (%s, %s, 'hash', 'Concurrent Tester', TRUE);
        """, (analyst_id, analyst_email))

        cur.execute("SELECT id FROM datasets LIMIT 1;")
        dataset_id = cur.fetchone()[0]

        grant_id = str(uuid.uuid4())
        cur.execute("""
            INSERT INTO dataset_grants (id, dataset_id, analyst_id, granted_by, expires_at, is_active)
            VALUES (%s, %s, %s, %s, NOW() + INTERVAL '30 days', TRUE);
        """, (grant_id, dataset_id, analyst_id, analyst_id))

        budget_id = str(uuid.uuid4())
        cur.execute("""
            INSERT INTO privacy_budgets (id, grant_id, total_epsilon, remaining_epsilon)
            VALUES (%s, %s, 1.0000, 1.0000);
        """, (budget_id, grant_id))

        # Create 10 valid query requests
        req_ids = []
        for i in range(10):
            rid = str(uuid.uuid4())
            cur.execute("""
                INSERT INTO query_requests (id, grant_id, analyst_id, metric, filter_criteria, requested_epsilon, status)
                VALUES (%s, %s, %s, 'COUNT', '[]'::jsonb, 0.5000, 'VALIDATED');
            """, (rid, grant_id, analyst_id))
            req_ids.append(rid)

        conn.commit()
        conn.close()

        # Concurrent execution worker using independent database connections
        def attempt_reservation(r_id):
            c = psycopg2.connect(**DB_CONFIG)
            c.autocommit = True
            cursor = c.cursor()
            try:
                cursor.execute(
                    "SELECT success, remaining, error_message FROM fn_reserve_privacy_budget(%s, %s, %s);",
                    (budget_id, 0.5000, r_id)
                )
                res = cursor.fetchone()
                return {"success": res[0], "remaining": float(res[1]), "error": res[2]}
            finally:
                c.close()

        # Fire all 10 simultaneously across thread pool
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(attempt_reservation, rid) for rid in req_ids]
            results = [f.result() for f in concurrent.futures.as_completed(futures)]

        success_count = sum(1 for r in results if r["success"] is True)
        failure_count = sum(1 for r in results if r["success"] is False)

        print(f"Concurrent Reservation Results: {success_count} Succeeded, {failure_count} Rejected")
        for idx, r in enumerate(results):
            print(f"  Worker {idx+1}: Success={r['success']}, Remaining={r['remaining']}, Error={r['error']}")

        assert success_count == 2, f"Expected exactly 2 successes, got {success_count}!"
        assert failure_count == 8, f"Expected exactly 8 failures, got {failure_count}!"

        # Check final balance in database
        check_conn = psycopg2.connect(**DB_CONFIG)
        check_cur = check_conn.cursor()
        check_cur.execute("SELECT remaining_epsilon FROM privacy_budgets WHERE id = %s;", (budget_id,))
        final_balance = float(check_cur.fetchone()[0])
        print(f"Final Verified Budget Balance in PostgreSQL: {final_balance}")
        assert final_balance == 0.0, f"Expected balance 0.0, got {final_balance}!"

        # Check sum of reservations in append-only ledger
        check_cur.execute("""
            SELECT count(*), sum(amount) 
            FROM privacy_budget_ledger 
            WHERE budget_id = %s AND transaction_type = 'RESERVATION';
        """, (budget_id,))
        count_ledger, sum_ledger = check_cur.fetchone()
        print(f"Verified Ledger Entries: count={count_ledger}, sum={sum_ledger}")
        assert count_ledger == 2
        assert float(sum_ledger) == 1.0

        check_conn.close()
        print("CONCURRENCY OVERSPENDING TEST: PASSED WITH ZERO OVERSPEND")

    def test_sql_injection_immunity(self):
        """
        Verify gateway immunity against malicious SQL injection strings in query parameters.
        Attempts classic tautologies and destructive statements.
        """
        # Login Analyst
        res = client.post("/api/v1/auth/login-json", json={
            "email": "krish.24bce0846@vitstudent.ac.in",
            "password": "AnalystPass2026!"
        })
        token = res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Get active grant
        grants = client.get("/api/v1/datasets/my-grants", headers=headers).json()
        grant_id = grants[0]["id"]

        # Attack Payload 1: SQL Injection in column name
        sqli_payload_1 = {
            "grant_id": grant_id,
            "metric": "COUNT",
            "filters": [
                {"column": "diagnosis_code'; DROP TABLE users; --", "operator": "EQ", "value": "I10"}
            ],
            "requested_epsilon": 0.1
        }
        res1 = client.post("/api/v1/queries/validate", json=sqli_payload_1, headers=headers)
        assert res1.status_code == 200
        assert res1.json()["valid"] is False
        assert "does not exist in dataset schema" in res1.json()["error"]

        # Attack Payload 2: SQL Injection in comparison value
        sqli_payload_2 = {
            "grant_id": grant_id,
            "metric": "COUNT",
            "filters": [
                {"column": "diagnosis_code", "operator": "EQ", "value": "' OR '1'='1"}
            ],
            "requested_epsilon": 0.1
        }
        res2 = client.post("/api/v1/queries/submit", json=sqli_payload_2, headers=headers)
        # It must safely execute as a literal search string for "' OR '1'='1" and return 0 (or noise around 0), without error or full-table dump
        assert res2.status_code in [201, 403]
        if res2.status_code == 201:
            # Result should be noisy near 0 (since no diagnosis is literally "' OR '1'='1")
            assert abs(res2.json()["noisy_result"]) < 50

    def test_grant_revocation_enforcement(self):
        """
        Verify that revoking a grant immediately denies subsequent query submissions.
        """
        # Owner login
        res_owner = client.post("/api/v1/auth/login-json", json={
            "email": "dr.sivakumar@vit.ac.in",
            "password": "OwnerPass2026!"
        })
        owner_headers = {"Authorization": f"Bearer {res_owner.json()['access_token']}"}

        # Issue temporary grant to Parv (24BCE0870)
        res_grant = client.post("/api/v1/datasets/grants", json={
            "dataset_id": client.get("/api/v1/datasets", headers=owner_headers).json()[0]["id"],
            "analyst_email": "parv.24bce0870@vitstudent.ac.in",
            "expires_in_days": 10,
            "allocated_epsilon": 2.0
        }, headers=owner_headers)
        grant_id = res_grant.json()["id"]

        # Parv login
        res_parv = client.post("/api/v1/auth/login-json", json={
            "email": "parv.24bce0870@vitstudent.ac.in",
            "password": "AnalystPass2026!"
        })
        parv_headers = {"Authorization": f"Bearer {res_parv.json()['access_token']}"}

        # Parv executes query before revocation -> succeeds
        res_q1 = client.post("/api/v1/queries/submit", json={
            "grant_id": grant_id,
            "metric": "COUNT",
            "filters": [],
            "requested_epsilon": 0.5
        }, headers=parv_headers)
        assert res_q1.status_code == 201

        # Owner revokes grant
        res_rev = client.post(f"/api/v1/datasets/grants/{grant_id}/revoke", headers=owner_headers)
        assert res_rev.status_code == 200

        # Parv attempts query after revocation -> must be denied with 403
        res_q2 = client.post("/api/v1/queries/submit", json={
            "grant_id": grant_id,
            "metric": "COUNT",
            "filters": [],
            "requested_epsilon": 0.5
        }, headers=parv_headers)
        assert res_q2.status_code == 403
        assert "revoked" in res_q2.text or "No active grant" in res_q2.text

        # Re-issue active grant for Parv so student analyst account remains ready for live demo
        client.post("/api/v1/datasets/grants", json={
            "dataset_id": client.get("/api/v1/datasets", headers=owner_headers).json()[0]["id"],
            "analyst_email": "parv.24bce0870@vitstudent.ac.in",
            "expires_in_days": 30,
            "allocated_epsilon": 5.0
        }, headers=owner_headers)

    def test_restricted_runtime_role_cannot_access_raw_records(self):
        """
        Verify Database Least-Privilege Isolation:
        The restricted application runtime role (privacyvault_app) MUST NOT have SELECT
        privileges on raw microdata tables (protected_patients).
        Direct queries by privacyvault_app fail with SQLSTATE 42501 (insufficient_privilege).
        """
        app_db_config = {
            'host': 'localhost',
            'port': 5434,
            'dbname': os.getenv('TEST_DB_NAME', 'privacyvault'),
            'user': 'privacyvault_app',
            'password': 'AppRuntimeSecurePass2026!'
        }

        conn = psycopg2.connect(**app_db_config)
        cur = conn.cursor()

        # Attempt direct SELECT on protected_patients microdata
        try:
            cur.execute("SELECT * FROM protected_patients LIMIT 5;")
            assert False, "Security Violation: privacyvault_app was able to SELECT directly from protected_patients!"
        except psycopg2.errors.InsufficientPrivilege as e:
            conn.rollback()
            assert "permission denied for table protected_patients" in str(e).lower()
            print("\nDatabase Isolation Verified: privacyvault_app direct SELECT denied on protected_patients.")

        conn.close()

    def test_append_only_ledger_trigger_blocks_update_and_delete(self):
        """
        Verify Database Integrity Trigger:
        Trigger tr_enforce_append_only_ledger must block any UPDATE or DELETE statement
        on privacy_budget_ledger, even from administrative connections, enforcing audit immutability.
        """
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()

        # Find any ledger entry
        cur.execute("SELECT id FROM privacy_budget_ledger LIMIT 1;")
        row = cur.fetchone()
        assert row is not None, "At least one ledger row must exist for testing trigger."
        ledger_id = row[0]

        # Attempt UPDATE
        try:
            cur.execute("UPDATE privacy_budget_ledger SET amount = 0.0001 WHERE id = %s;", (ledger_id,))
            conn.commit()
            assert False, "Integrity Violation: UPDATE on privacy_budget_ledger was permitted!"
        except psycopg2.DatabaseError as e:
            conn.rollback()
            assert "LEDGER_IMMUTABILITY_ERROR" in str(e) or "append-only audit table" in str(e).lower()
            print("\nTrigger Verified: UPDATE on privacy_budget_ledger blocked by tr_enforce_append_only_ledger.")

        # Attempt DELETE
        try:
            cur.execute("DELETE FROM privacy_budget_ledger WHERE id = %s;", (ledger_id,))
            conn.commit()
            assert False, "Integrity Violation: DELETE on privacy_budget_ledger was permitted!"
        except psycopg2.DatabaseError as e:
            conn.rollback()
            assert "LEDGER_IMMUTABILITY_ERROR" in str(e) or "append-only audit table" in str(e).lower()
            print("Trigger Verified: DELETE on privacy_budget_ledger blocked by tr_enforce_append_only_ledger.")

        conn.close()

    def test_failure_recovery_and_budget_refund_stored_procedure(self):
        """
        Verify Failure Recovery State Invariant:
        When a query reservation succeeds but subsequent execution encounters a failure,
        fn_refund_privacy_budget restores remaining_epsilon and logs a REFUND ledger transaction.
        """
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()

        # Create isolated test grant and budget
        test_analyst_id = str(uuid.uuid4())
        test_email = f"failure.{uuid.uuid4().hex[:8]}@vitstudent.ac.in"
        cur.execute("""
            INSERT INTO users (id, email, password_hash, full_name, is_active)
            VALUES (%s, %s, 'hash', 'Failure Recovery Tester', TRUE);
        """, (test_analyst_id, test_email))

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

        req_id = str(uuid.uuid4())
        cur.execute("""
            INSERT INTO query_requests (id, grant_id, analyst_id, metric, filter_criteria, requested_epsilon, status)
            VALUES (%s, %s, %s, 'COUNT', '[]'::jsonb, 0.5000, 'VALIDATED');
        """, (req_id, grant_id, test_analyst_id))
        conn.commit()

        # 1. Atomic Reservation of 0.5
        cur.execute("SELECT success, remaining, error_message FROM fn_reserve_privacy_budget(%s, %s, %s);",
                    (budget_id, 0.5000, req_id))
        res = cur.fetchone()
        conn.commit()
        assert res[0] is True
        assert float(res[1]) == 1.5000

        # Verify state in DB
        cur.execute("SELECT remaining_epsilon FROM privacy_budgets WHERE id = %s;", (budget_id,))
        assert float(cur.fetchone()[0]) == 1.5000

        # 2. Simulate execution failure and trigger refund
        cur.execute("SELECT success, new_balance, error_message FROM fn_refund_privacy_budget(%s, %s, %s);",
                    (budget_id, 0.5000, req_id))
        ref_res = cur.fetchone()
        conn.commit()
        assert ref_res[0] is True
        assert float(ref_res[1]) == 2.0000

        # Verify balance restored
        cur.execute("SELECT remaining_epsilon FROM privacy_budgets WHERE id = %s;", (budget_id,))
        assert float(cur.fetchone()[0]) == 2.0000

        # Verify REFUND ledger transaction recorded
        cur.execute("""
            SELECT transaction_type, amount, balance_after 
            FROM privacy_budget_ledger 
            WHERE budget_id = %s 
            ORDER BY created_at DESC LIMIT 1;
        """, (budget_id,))
        tx_type, amount, balance_after = cur.fetchone()
        assert tx_type == 'REFUND'
        assert float(amount) == 0.5000
        assert float(balance_after) == 2.0000
        print("\nFailure Recovery Verified: Reservation 0.5 refunded to 2.0 with REFUND ledger entry.")

        conn.close()


