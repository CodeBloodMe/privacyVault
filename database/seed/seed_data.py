"""
PrivacyVault — Synthetic Demonstration Data Seeder
Student Authors: KRISH (24BCE0846) & PARV (24BCE0870)
Course: BCSE302P Database Systems Lab (Slot L25+L26)
Faculty: Dr. V. SIVAKUMAR
"""

import uuid
import random
from datetime import datetime, timedelta, timezone
import bcrypt
import psycopg2
from psycopg2.extras import execute_values

DB_CONFIG = {
    'host': 'localhost',
    'port': 5434,
    'dbname': 'privacyvault',
    'user': 'privacyvault_admin',
    'password': 'AdminSuperSecretPassword2026!'
}

def hash_pw(plaintext: str) -> str:
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(plaintext.encode('utf-8'), salt).decode('utf-8')

def seed_database(target_dbname: str = "privacyvault"):
    random.seed(20261024) # Deterministic seed for reproducible evaluation
    print("=" * 70)
    print(f"PRIVACYVAULT: Seeding Authoritative Synthetic Database ({target_dbname})")
    print("Student Authors: KRISH (24BCE0846) & PARV (24BCE0870)")
    print("=" * 70)

    cfg = dict(DB_CONFIG)
    cfg['dbname'] = target_dbname
    conn = psycopg2.connect(**cfg)
    cur = conn.cursor()


    # 1. Clean existing tables in topological order
    print("[1/7] Cleaning existing demonstration data...")
    cur.execute("""
        TRUNCATE TABLE 
            query_releases,
            privacy_budget_ledger,
            query_requests,
            privacy_budgets,
            dataset_grants,
            privacy_policies,
            dataset_columns,
            protected_patients,
            datasets,
            audit_events,
            user_roles,
            users,
            roles
        CASCADE;
    """)

    # 2. Seed Roles
    print("[2/7] Seeding RBAC roles...")
    roles = [
        ('ADMIN', 'Global administrator with user management and health oversight'),
        ('DATA_OWNER', 'Dataset custodian configuring privacy policies and access grants'),
        ('ANALYST', 'Authorized researcher executing aggregate queries through privacy gateway'),
        ('AUDITOR', 'Compliance officer reviewing immutable audit logs and budget ledgers')
    ]
    cur.executemany("INSERT INTO roles (name, description) VALUES (%s, %s);", roles)

    # 3. Seed Users (Single Users Table Architecture)
    print("[3/7] Seeding system user accounts with Bcrypt hashing...")
    now = datetime.now(timezone.utc)
    users_data = [
        (str(uuid.uuid4()), 'admin@privacyvault.local', hash_pw('AdminPass2026!'), 'System Administrator', True, now, now, ['ADMIN']),
        (str(uuid.uuid4()), 'dr.sivakumar@vit.ac.in', hash_pw('OwnerPass2026!'), 'Dr. V. Sivakumar (Data Owner)', True, now, now, ['DATA_OWNER']),
        (str(uuid.uuid4()), 'krish.24bce0846@vitstudent.ac.in', hash_pw('AnalystPass2026!'), 'Krish (Analyst 24BCE0846)', True, now, now, ['ANALYST']),
        (str(uuid.uuid4()), 'parv.24bce0870@vitstudent.ac.in', hash_pw('AnalystPass2026!'), 'Parv (Analyst 24BCE0870)', True, now, now, ['ANALYST']),
        (str(uuid.uuid4()), 'compliance.auditor@vit.ac.in', hash_pw('AuditorPass2026!'), 'Lead Compliance Auditor', True, now, now, ['AUDITOR'])
    ]

    user_map = {}
    for uid, email, pwhash, fname, active, cat, uat, uroles in users_data:
        cur.execute("""
            INSERT INTO users (id, email, password_hash, full_name, is_active, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s);
        """, (uid, email, pwhash, fname, active, cat, uat))
        user_map[email] = uid
        for rname in uroles:
            cur.execute("INSERT INTO user_roles (user_id, role_name) VALUES (%s, %s);", (uid, rname))

    # 4. Seed Dataset & Column Metadata
    print("[4/7] Registering protected dataset & metadata catalog...")
    dataset_id = str(uuid.uuid4())
    owner_id = user_map['dr.sivakumar@vit.ac.in']
    cur.execute("""
        INSERT INTO datasets (id, name, description, target_table, owner_id, is_active, created_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s);
    """, (
        dataset_id,
        'clinical_patient_records',
        'Synthetic multi-specialty clinical research cohort with 10,000 inpatient admissions, treatment costs, and outcomes.',
        'protected_patients',
        owner_id,
        True,
        now
    ))

    columns_meta = [
        (str(uuid.uuid4()), dataset_id, 'patient_id', 'UUID', True, True, False, None, None),
        (str(uuid.uuid4()), dataset_id, 'mrn', 'VARCHAR', True, True, False, None, None),
        (str(uuid.uuid4()), dataset_id, 'age', 'INTEGER', True, False, True, 0, 120),
        (str(uuid.uuid4()), dataset_id, 'gender', 'VARCHAR', False, False, False, None, None),
        (str(uuid.uuid4()), dataset_id, 'blood_group', 'VARCHAR', False, False, False, None, None),
        (str(uuid.uuid4()), dataset_id, 'diagnosis_code', 'VARCHAR', True, False, False, None, None),
        (str(uuid.uuid4()), dataset_id, 'admission_type', 'VARCHAR', False, False, False, None, None),
        (str(uuid.uuid4()), dataset_id, 'treatment_cost', 'NUMERIC', True, False, True, 500, 100000),
        (str(uuid.uuid4()), dataset_id, 'length_of_stay_days', 'INTEGER', True, False, True, 1, 90),
        (str(uuid.uuid4()), dataset_id, 'readmitted', 'BOOLEAN', True, False, True, 0, 1),
        (str(uuid.uuid4()), dataset_id, 'admission_date', 'TIMESTAMPTZ', False, False, False, None, None)
    ]
    cur.executemany("""
        INSERT INTO dataset_columns (id, dataset_id, column_name, data_type, is_sensitive, is_identifier, is_aggregatable, min_bound, max_bound)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s);
    """, columns_meta)

    # 5. Seed Privacy Policy
    print("[5/7] Establishing differential privacy policy constraints...")
    policy_id = str(uuid.uuid4())
    cur.execute("""
        INSERT INTO privacy_policies (
            id, dataset_id, name, max_epsilon_per_query, default_delta, 
            global_epsilon_cap, sensitivity_clamp_low, sensitivity_clamp_high, approved_mechanisms, is_active
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
    """, (
        policy_id, dataset_id, 'HIPAA-Compliant Differential Privacy Policy',
        1.0000, 0.00001000, 5.0000, 500.0000, 50000.0000, 'OPENDP_LAPLACE', True
    ))

    # 6. Seed Dataset Grants & Privacy Budgets
    print("[6/7] Issuing active dataset grants and initializing privacy budgets...")
    analyst_emails = ['krish.24bce0846@vitstudent.ac.in', 'parv.24bce0870@vitstudent.ac.in']
    for a_email in analyst_emails:
        a_id = user_map[a_email]
        grant_id = str(uuid.uuid4())
        expires = now + timedelta(days=60)
        cur.execute("""
            INSERT INTO dataset_grants (id, dataset_id, analyst_id, granted_by, granted_at, expires_at, is_active)
            VALUES (%s, %s, %s, %s, %s, %s, %s);
        """, (grant_id, dataset_id, a_id, owner_id, now, expires, True))

        budget_id = str(uuid.uuid4())
        cur.execute("""
            INSERT INTO privacy_budgets (id, grant_id, total_epsilon, remaining_epsilon, total_delta, remaining_delta, last_reset_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s);
        """, (budget_id, grant_id, 5.0000, 5.0000, 0.00001000, 0.00001000, now, now))

        # Initial ledger credit
        cur.execute("""
            INSERT INTO privacy_budget_ledger (id, budget_id, request_id, amount, transaction_type, balance_after, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s);
        """, (str(uuid.uuid4()), budget_id, None, 5.0000, 'ALLOCATION', 5.0000, now))

    # 7. Seed 10,000 Synthetic Protected Clinical Records
    print("[7/7] Synthesizing 10,000 realistic clinical records in protected_patients...")
    diagnoses = [
        'I10',   # Essential hypertension
        'E11',   # Type 2 diabetes mellitus
        'J44',   # Chronic obstructive pulmonary disease
        'I25',   # Chronic ischemic heart disease
        'K21',   # Gastro-esophageal reflux disease
        'M54',   # Dorsalgia (Back pain)
        'C34',   # Malignant neoplasm of bronchus/lung
        'N18',   # Chronic kidney disease
        'Z99'    # Rare Target Condition (Used for Differencing Demonstration)
    ]
    diag_weights = [0.25, 0.20, 0.15, 0.12, 0.10, 0.08, 0.05, 0.04, 0.01]
    genders = ['MALE', 'FEMALE', 'OTHER']
    gender_weights = [0.49, 0.49, 0.02]
    blood_groups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
    admission_types = ['EMERGENCY', 'ELECTIVE', 'URGENT']
    adm_weights = [0.60, 0.25, 0.15]

    patients = []
    base_date = datetime(2025, 1, 1, tzinfo=timezone.utc)

    # Specific Target Record for Differencing Attack Scenario Demonstration:
    # Patient Bob Martinez, age 99, rare diagnosis Z99, treatment_cost 88888.00
    patients.append((
        str(uuid.uuid4()),
        'MRN-TARGET-9999',
        99,
        'MALE',
        'AB-',
        'Z99',
        'EMERGENCY',
        88888.00,
        42,
        True,
        base_date + timedelta(days=100)
    ))

    # 9,999 normal synthetic population records
    for i in range(1, 10000):
        mrn = f"MRN-{100000 + i}"
        age = int(random.gauss(54, 18))
        age = max(18, min(95, age))
        gender = random.choices(genders, weights=gender_weights)[0]
        blood = random.choice(blood_groups)
        diag = random.choices(diagnoses, weights=diag_weights)[0]
        adm_type = random.choices(admission_types, weights=adm_weights)[0]
        
        # Log-normal treatment cost distribution
        base_cost = random.lognormvariate(8.2, 0.6)
        if adm_type == 'EMERGENCY':
            base_cost *= 1.4
        if diag == 'C34':
            base_cost *= 2.5
        cost = round(max(500.0, min(95000.0, base_cost)), 2)

        stay_days = max(1, int(cost / 1500 + random.randint(0, 5)))
        readmitted = random.random() < (0.22 if age > 65 else 0.08)
        adm_date = base_date + timedelta(days=random.randint(0, 600))

        patients.append((
            str(uuid.uuid4()),
            mrn,
            age,
            gender,
            blood,
            diag,
            adm_type,
            cost,
            stay_days,
            readmitted,
            adm_date
        ))

    insert_query = """
        INSERT INTO protected_patients (
            patient_id, mrn, age, gender, blood_group, diagnosis_code,
            admission_type, treatment_cost, length_of_stay_days, readmitted, admission_date
        ) VALUES %s;
    """
    execute_values(cur, insert_query, patients, page_size=1000)

    # Initial system audit log
    cur.execute("""
        INSERT INTO audit_events (
            id, event_timestamp, actor_user_id, event_type, resource_type, resource_id, outcome, details
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s, %s
        );
    """, (
        str(uuid.uuid4()), now, owner_id, 'SYSTEM_DATABASE_SEEDED', 'DATABASE', dataset_id, 'SUCCESS',
        '{"records_seeded": 10000, "authors": "KRISH (24BCE0846) & PARV (24BCE0870)", "slot": "L25+L26"}'
    ))

    conn.commit()
    cur.close()
    conn.close()

    print("=" * 70)
    print("SUCCESS: Seeded 10,000 synthetic records, 5 users, 4 roles, and grants.")
    print("=" * 70)

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description="PrivacyVault Data Seeder")
    parser.add_argument("--db", default="privacyvault", help="Target database name")
    args = parser.parse_args()
    seed_database(args.db)

