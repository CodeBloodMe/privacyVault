"""
PrivacyVault — Database Integrity, Trigger & Stored Procedure Verification
Student Authors: KRISH (24BCE0846) & PARV (24BCE0870)
"""

import uuid
import psycopg2

DB_CONFIG = {
    'host': 'localhost',
    'port': 5434,
    'dbname': 'privacyvault',
    'user': 'privacyvault_admin',
    'password': 'AdminSuperSecretPassword2026!'
}

def test_sp_and_triggers():
    print("=" * 70)
    print("VERIFYING POSTGRESQL STORED PROCEDURES & TRIGGERS")
    print("Authors: KRISH (24BCE0846) & PARV (24BCE0870)")
    print("=" * 70)

    conn = psycopg2.connect(**DB_CONFIG)
    conn.autocommit = False
    cur = conn.cursor()

    # Find an active grant and budget
    cur.execute("""
        SELECT b.id, b.remaining_epsilon, g.id, g.analyst_id
        FROM privacy_budgets b
        JOIN dataset_grants g ON b.grant_id = g.id
        WHERE g.is_active = TRUE
        LIMIT 1;
    """)
    budget_row = cur.fetchone()
    assert budget_row is not None, "No active budget found!"
    b_id, initial_rem, grant_id, analyst_id = budget_row
    print(f"Target Budget ID: {b_id}, Initial Remaining Epsilon: {initial_rem}")

    # Create a real query_requests record first to satisfy FK integrity
    req_id = str(uuid.uuid4())
    req_eps = 0.5000
    cur.execute("""
        INSERT INTO query_requests (
            id, grant_id, analyst_id, metric, target_column, filter_criteria, requested_epsilon, status
        ) VALUES (
            %s, %s, %s, 'COUNT', 'patient_id', '[]'::jsonb, %s, 'VALIDATED'
        );
    """, (req_id, grant_id, analyst_id, req_eps))

    # 1. Test fn_reserve_privacy_budget
    print("\n[Test 1] Testing fn_reserve_privacy_budget(0.5 epsilon)...")
    cur.execute("SELECT success, remaining, error_message, author_signature FROM fn_reserve_privacy_budget(%s, %s, %s);", (b_id, req_eps, req_id))
    success, remaining, err, sig = cur.fetchone()
    print(f"  Result: success={success}, remaining={remaining}, err={err}, sig={sig}")
    assert success is True
    assert float(remaining) == float(initial_rem) - float(req_eps)
    assert "24BCE0846" in sig
    print("  -> PASS: Stored procedure successfully reserved budget atomically with FK referential integrity.")

    # 2. Test Ledger Immutability Trigger (tr_enforce_append_only_ledger)
    print("\n[Test 2] Testing Trigger tr_enforce_append_only_ledger (Attempting UPDATE on ledger)...")
    cur.execute("SELECT id FROM privacy_budget_ledger WHERE budget_id = %s LIMIT 1;", (b_id,))
    ledger_id = cur.fetchone()[0]

    update_caught = False
    try:
        cur.execute("UPDATE privacy_budget_ledger SET amount = 999 WHERE id = %s;", (ledger_id,))
    except Exception as e:
        update_caught = True
        print(f"  Expected Trigger Exception caught successfully: {e.pgerror.strip() if hasattr(e, 'pgerror') else e}")
        conn.rollback() # reset aborted transaction state
    assert update_caught is True, "CRITICAL ERROR: Ledger update was not blocked by trigger!"
    print("  -> PASS: Trigger prevented UPDATE on append-only ledger.")

    # Re-fetch after rollback
    cur.execute("""
        SELECT b.id, b.remaining_epsilon, g.id, g.analyst_id
        FROM privacy_budgets b
        JOIN dataset_grants g ON b.grant_id = g.id
        WHERE g.is_active = TRUE
        LIMIT 1;
    """)
    b_id, initial_rem, grant_id, analyst_id = cur.fetchone()
    req_id2 = str(uuid.uuid4())
    cur.execute("""
        INSERT INTO query_requests (
            id, grant_id, analyst_id, metric, target_column, filter_criteria, requested_epsilon, status
        ) VALUES (
            %s, %s, %s, 'COUNT', 'patient_id', '[]'::jsonb, %s, 'VALIDATED'
        );
    """, (req_id2, grant_id, analyst_id, req_eps))

    # Test DELETE on ledger
    print("\n[Test 3] Testing Trigger tr_enforce_append_only_ledger (Attempting DELETE on ledger)...")
    cur.execute("SELECT id FROM privacy_budget_ledger WHERE budget_id = %s LIMIT 1;", (b_id,))
    ledger_id = cur.fetchone()[0]
    delete_caught = False
    try:
        cur.execute("DELETE FROM privacy_budget_ledger WHERE id = %s;", (ledger_id,))
    except Exception as e:
        delete_caught = True
        print(f"  Expected Trigger Exception caught successfully: {e.pgerror.strip() if hasattr(e, 'pgerror') else e}")
        conn.rollback()
    assert delete_caught is True, "CRITICAL ERROR: Ledger delete was not blocked by trigger!"
    print("  -> PASS: Trigger prevented DELETE on append-only ledger.")

    # 3. Test fn_refund_privacy_budget
    cur.execute("""
        SELECT b.id, b.remaining_epsilon, g.id, g.analyst_id
        FROM privacy_budgets b
        JOIN dataset_grants g ON b.grant_id = g.id
        WHERE g.is_active = TRUE
        LIMIT 1;
    """)
    b_id, initial_rem, grant_id, analyst_id = cur.fetchone()
    req_id3 = str(uuid.uuid4())
    cur.execute("""
        INSERT INTO query_requests (
            id, grant_id, analyst_id, metric, target_column, filter_criteria, requested_epsilon, status
        ) VALUES (
            %s, %s, %s, 'COUNT', 'patient_id', '[]'::jsonb, %s, 'VALIDATED'
        );
    """, (req_id3, grant_id, analyst_id, req_eps))
    # Reserve first
    cur.execute("SELECT success, remaining FROM fn_reserve_privacy_budget(%s, %s, %s);", (b_id, req_eps, req_id3))
    assert cur.fetchone()[0] is True

    print("\n[Test 4] Testing fn_refund_privacy_budget(0.5 epsilon)...")
    cur.execute("SELECT success, new_balance, error_message, author_signature FROM fn_refund_privacy_budget(%s, %s, %s);", (b_id, req_eps, req_id3))
    r_success, r_balance, r_err, r_sig = cur.fetchone()
    print(f"  Result: success={r_success}, new_balance={r_balance}, err={r_err}, sig={r_sig}")
    assert r_success is True
    assert float(r_balance) == float(initial_rem)
    print("  -> PASS: Compensating refund stored procedure executed and replenished balance.")

    # 4. Test Overspending Denial
    print("\n[Test 5] Testing Overspending Denial (Requesting 9999.0 epsilon)...")
    cur.execute("SELECT success, remaining, error_message FROM fn_reserve_privacy_budget(%s, %s, %s);", (b_id, 9999.0, req_id3))
    o_success, o_remaining, o_err = cur.fetchone()
    print(f"  Result: success={o_success}, remaining={o_remaining}, error={o_err}")
    assert o_success is False
    assert "Insufficient" in o_err
    print("  -> PASS: Overspending attempt strictly rejected by stored procedure.")

    # 5. Verify Analytical Views
    print("\n[Test 6] Testing Analytical Views...")
    cur.execute("SELECT count(*) FROM v_dataset_metadata_catalog;")
    meta_count = cur.fetchone()[0]
    print(f"  v_dataset_metadata_catalog rows: {meta_count}")
    assert meta_count > 0

    cur.execute("SELECT count(*) FROM v_analyst_budget_summary;")
    budget_count = cur.fetchone()[0]
    print(f"  v_analyst_budget_summary rows: {budget_count}")
    assert budget_count > 0

    cur.execute("SELECT count(*) FROM v_audit_summary_log;")
    audit_count = cur.fetchone()[0]
    print(f"  v_audit_summary_log rows: {audit_count}")
    assert audit_count > 0
    print("  -> PASS: All 3 analytical views return verified joined rows.")

    conn.commit()
    cur.close()
    conn.close()

    print("\n" + "=" * 70)
    print("ALL STORED PROCEDURES, TRIGGERS & VIEWS VERIFIED SUCCESSFULLY!")
    print("=" * 70)

if __name__ == '__main__':
    test_sp_and_triggers()
