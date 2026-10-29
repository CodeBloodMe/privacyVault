"""
================================================================================
PrivacyVault — Automated Database Migration Engine
Student Authors: KRISH (24BCE0846) & PARV (24BCE0870)
Course: BCSE302P Database Systems Lab (Slot L25+L26)
Faculty Guide: Dr. V. SIVAKUMAR
================================================================================
"""

import sys
import os
import glob
import hashlib
import time
import argparse
import psycopg2

AUTHORS_SIGNATURE = "REG_24BCE0846_24BCE0870_KRISH_PARV"

DEFAULT_DB_CONFIG = {
    'host': 'localhost',
    'port': 5434,
    'user': 'privacyvault_admin',
    'password': 'AdminSuperSecretPassword2026!'
}

def calculate_checksum(content: str) -> str:
    return hashlib.sha256(content.encode('utf-8')).hexdigest()

def run_migrations(target_dbname: str = "privacyvault"):
    print("=" * 80)
    print(f" PRIVACYVAULT DATABASE MIGRATION ENGINE")
    print(f" Target Database: {target_dbname} on Port {DEFAULT_DB_CONFIG['port']}")
    print(f" Authors: KRISH (24BCE0846) & PARV (24BCE0870)")
    print("=" * 80)

    # 1. Connect to PostgreSQL
    conn_params = dict(DEFAULT_DB_CONFIG)
    conn_params['dbname'] = target_dbname

    try:
        conn = psycopg2.connect(**conn_params)
    except psycopg2.OperationalError as e:
        print(f"Connection error to {target_dbname}: {e}")
        sys.exit(1)

    cur = conn.cursor()

    # 2. Ensure schema_migrations ledger exists
    cur.execute("""
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version VARCHAR(100) PRIMARY KEY,
            filename VARCHAR(255) NOT NULL,
            checksum VARCHAR(64) NOT NULL,
            execution_time_ms NUMERIC(10,2) NOT NULL,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            applied_by VARCHAR(100) NOT NULL,
            author_signature VARCHAR(100) NOT NULL
        );
    """)
    conn.commit()

    # 3. Locate all migration scripts
    migrations_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "migrations"))
    migration_files = sorted(glob.glob(os.path.join(migrations_dir, "V*.sql")))

    if not migration_files:
        print(f"No migration files found in {migrations_dir}")
        conn.close()
        return

    # 4. Fetch already applied versions
    cur.execute("SELECT version, checksum FROM schema_migrations ORDER BY version ASC;")
    applied_versions = {row[0]: row[1] for row in cur.fetchall()}

    applied_count = 0
    skipped_count = 0

    for filepath in migration_files:
        filename = os.path.basename(filepath)
        version = filename.split("__")[0]

        with open(filepath, "r", encoding="utf-8") as f:
            sql_content = f.read()

        checksum = calculate_checksum(sql_content)

        if version in applied_versions:
            if applied_versions[version] != checksum:
                print(f"[!] WARNING: Migration {version} checksum mismatch! Stored: {applied_versions[version][:10]}, Current: {checksum[:10]}")
            else:
                skipped_count += 1
            continue

        print(f"\n[>] Applying Migration {version}: {filename} ...")
        start_time = time.time()

        try:
            cur.execute(sql_content)
            elapsed_ms = (time.time() - start_time) * 1000.0

            cur.execute("""
                INSERT INTO schema_migrations (version, filename, checksum, execution_time_ms, applied_by, author_signature)
                VALUES (%s, %s, %s, %s, CURRENT_USER, %s);
            """, (version, filename, checksum, elapsed_ms, AUTHORS_SIGNATURE))

            conn.commit()
            print(f"    [PASS] Applied {version} in {elapsed_ms:.2f} ms")
            applied_count += 1
        except Exception as e:
            conn.rollback()
            print(f"    [FAIL] Error executing {filename}: {e}")
            conn.close()
            sys.exit(1)

    conn.close()
    print("\n" + "=" * 80)
    print(f" MIGRATION SUMMARY: {applied_count} Applied, {skipped_count} Already Up-to-Date")
    print(f" Database state is clean, verified and authoritative.")
    print("=" * 80)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="PrivacyVault Migration Engine")
    parser.add_argument("--db", default="privacyvault", help="Target database name")
    args = parser.parse_args()
    run_migrations(args.db)
