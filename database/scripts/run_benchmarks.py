"""
PrivacyVault — DBMS Performance & Optimization Benchmarks
Authors: KRISH (24BCE0846) & PARV (24BCE0870)
Course: BCSE302P Database Systems Lab (Slot L25+L26)

Executes EXPLAIN ANALYZE on PostgreSQL 17 to measure:
1. Index scan vs Sequential scan on protected_patients (10,000 rows)
2. Bounded aggregation execution times (COUNT, SUM, AVG)
3. Concurrency transaction latency under row-level locking
4. Audit log query performance across analytical views
"""

import time
import psycopg2
import json

DB_CONFIG = {
    'host': 'localhost',
    'port': 5434,
    'dbname': 'privacyvault',
    'user': 'privacyvault_admin',
    'password': 'AdminSuperSecretPassword2026!'
}

def run_benchmarks():
    print("=" * 75)
    print("PRIVACYVAULT: PostgreSQL 17 Performance & Index Benchmark Suite")
    print("Student Authors: KRISH (24BCE0846) & PARV (24BCE0870)")
    print("Target RDBMS: PostgreSQL 17 (10,000 synthetic clinical records)")
    print("=" * 75)

    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()

    results = {}

    # 1. Benchmark: Indexed Filter on diagnosis_code vs Sequential Scan
    print("\n[Benchmark 1] EXPLAIN ANALYZE on Filtered Aggregate (diagnosis_code = 'I10')...")
    cur.execute("""
        EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
        SELECT count(*) FROM protected_patients WHERE diagnosis_code = 'I10';
    """)
    plan_with_index = cur.fetchone()[0]
    exec_time_with_idx = plan_with_index[0]['Execution Time']
    plan_type_idx = plan_with_index[0]['Plan']['Node Type']
    print(f"  Plan Node: {plan_type_idx}, Execution Time: {exec_time_with_idx:.3f} ms")

    # Drop index temporarily to measure unindexed sequential scan
    cur.execute("DROP INDEX IF EXISTS idx_patients_diagnosis;")
    cur.execute("""
        EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
        SELECT count(*) FROM protected_patients WHERE diagnosis_code = 'I10';
    """)
    plan_seq = cur.fetchone()[0]
    exec_time_seq = plan_seq[0]['Execution Time']
    plan_type_seq = plan_seq[0]['Plan']['Node Type']
    print(f"  Unindexed Plan Node: {plan_type_seq}, Execution Time: {exec_time_seq:.3f} ms")

    # Re-create index
    cur.execute("CREATE INDEX idx_patients_diagnosis ON protected_patients(diagnosis_code);")
    conn.commit()
    speedup = ((exec_time_seq - exec_time_with_idx) / exec_time_seq) * 100 if exec_time_seq > 0 else 0
    print(f"  -> Index Optimization Speedup: {speedup:.1f}% reduction in query time")

    results['index_benchmark'] = {
        'indexed_node': plan_type_idx,
        'indexed_time_ms': exec_time_with_idx,
        'seq_scan_node': plan_type_seq,
        'seq_scan_time_ms': exec_time_seq,
        'speedup_pct': round(speedup, 2)
    }

    # 2. Benchmark: Bounded Aggregation Throughput (100 sequential iterations)
    print("\n[Benchmark 2] Measuring Aggregation Latency across 100 trials...")
    latencies = []
    for _ in range(100):
        t0 = time.perf_counter()
        cur.execute("""
            SELECT 
                count(*),
                sum(least(greatest(treatment_cost, 500.0), 50000.0)),
                avg(least(greatest(treatment_cost, 500.0), 50000.0))
            FROM protected_patients
            WHERE admission_type = 'EMERGENCY';
        """)
        cur.fetchone()
        latencies.append((time.perf_counter() - t0) * 1000)

    avg_lat = sum(latencies) / len(latencies)
    min_lat = min(latencies)
    max_lat = max(latencies)
    p95_lat = sorted(latencies)[int(len(latencies) * 0.95)]
    print(f"  Average Latency: {avg_lat:.2f} ms | Min: {min_lat:.2f} ms | Max: {max_lat:.2f} ms | P95: {p95_lat:.2f} ms")
    print(f"  Aggregate Query Throughput: {1000 / avg_lat:.1f} queries/second")

    results['aggregation_benchmarks'] = {
        'trials': 100,
        'avg_latency_ms': round(avg_lat, 2),
        'min_latency_ms': round(min_lat, 2),
        'max_latency_ms': round(max_lat, 2),
        'p95_latency_ms': round(p95_lat, 2),
        'throughput_qps': round(1000 / avg_lat, 1)
    }

    # 3. Benchmark: Stored Procedure Atomic Reservation Latency
    print("\n[Benchmark 3] Stored Procedure Atomic Reservation Latency (fn_reserve_privacy_budget)...")
    cur.execute("SELECT id FROM privacy_budgets LIMIT 1;")
    b_id = cur.fetchone()[0]

    sp_latencies = []
    # Test 50 atomic reservations with compensating refunds
    for i in range(50):
        t0 = time.perf_counter()
        cur.execute("SELECT success, remaining FROM fn_reserve_privacy_budget(%s, 0.001, NULL);", (b_id,))
        cur.fetchone()
        # Compensating refund to maintain balance
        cur.execute("SELECT success FROM fn_refund_privacy_budget(%s, 0.001, NULL);", (b_id,))
        cur.fetchone()
        sp_latencies.append((time.perf_counter() - t0) * 1000)

    avg_sp_lat = sum(sp_latencies) / len(sp_latencies)
    p95_sp_lat = sorted(sp_latencies)[int(len(sp_latencies) * 0.95)]
    print(f"  Average Atomic Reservation Roundtrip: {avg_sp_lat:.2f} ms | P95: {p95_sp_lat:.2f} ms")
    conn.commit()

    results['stored_procedure_benchmarks'] = {
        'trials': 50,
        'avg_sp_latency_ms': round(avg_sp_lat, 2),
        'p95_sp_latency_ms': round(p95_sp_lat, 2)
    }

    # 4. Benchmark: Analytical Views Performance
    print("\n[Benchmark 4] Analytical View Query Times (EXPLAIN ANALYZE)...")
    cur.execute("EXPLAIN (ANALYZE, FORMAT JSON) SELECT * FROM v_dataset_metadata_catalog;")
    v1_time = cur.fetchone()[0][0]['Execution Time']
    
    cur.execute("EXPLAIN (ANALYZE, FORMAT JSON) SELECT * FROM v_analyst_budget_summary;")
    v2_time = cur.fetchone()[0][0]['Execution Time']

    cur.execute("EXPLAIN (ANALYZE, FORMAT JSON) SELECT * FROM v_audit_summary_log LIMIT 50;")
    v3_time = cur.fetchone()[0][0]['Execution Time']

    print(f"  v_dataset_metadata_catalog: {v1_time:.3f} ms")
    print(f"  v_analyst_budget_summary:   {v2_time:.3f} ms")
    print(f"  v_audit_summary_log (50):   {v3_time:.3f} ms")

    results['views_benchmarks'] = {
        'v_dataset_metadata_catalog_ms': round(v1_time, 3),
        'v_analyst_budget_summary_ms': round(v2_time, 3),
        'v_audit_summary_log_ms': round(v3_time, 3)
    }

    conn.close()

    print("\n" + "=" * 75)
    print("BENCHMARK EXECUTION COMPLETE")
    print("=" * 75)
    return results

if __name__ == '__main__':
    res = run_benchmarks()
    with open('database/scripts/benchmark_results.json', 'w') as f:
        json.dump(res, f, indent=2)
    print("Saved benchmark metrics to database/scripts/benchmark_results.json")
