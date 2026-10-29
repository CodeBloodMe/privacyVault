# PrivacyVault — Entity-Relationship (ER) Diagram & Relational Schema

**Document Version:** 1.0.0  
**Authors:** Student `24BCE0846` & `24BCE0870` (BCSE302P L25+L26)  
**Normalization Target:** Third Normal Form (3NF)  

---

## 1. Entity-Relationship (ER) Diagram (Crow's Foot Notation)

```mermaid
erDiagram
    USERS ||--o{ USER_ROLES : "assigned"
    ROLES ||--o{ USER_ROLES : "comprises"
    
    USERS ||--o{ DATASETS : "owns"
    DATASETS ||--|{ DATASET_COLUMNS : "defines"
    DATASETS ||--o{ PRIVACY_POLICIES : "governed_by"
    
    USERS ||--o{ DATASET_GRANTS : "granted_to"
    DATASETS ||--o{ DATASET_GRANTS : "authorizes"
    
    DATASET_GRANTS ||--|| PRIVACY_BUDGETS : "allocates"
    PRIVACY_BUDGETS ||--o{ PRIVACY_BUDGET_LEDGER : "audited_by"
    
    DATASET_GRANTS ||--o{ QUERY_REQUESTS : "initiates"
    QUERY_REQUESTS ||--o| QUERY_RELEASES : "produces"
    QUERY_REQUESTS ||--o{ PRIVACY_BUDGET_LEDGER : "debits"
    
    USERS ||--o{ AUDIT_EVENTS : "triggers"
    
    DATASETS ||--o{ PROTECTED_PATIENTS : "protects"

    USERS {
        UUID id PK
        VARCHAR email UK
        VARCHAR password_hash
        VARCHAR full_name
        BOOLEAN is_active
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    ROLES {
        VARCHAR name PK
        VARCHAR description
    }

    USER_ROLES {
        UUID user_id PK, FK
        VARCHAR role_name PK, FK
        TIMESTAMPTZ assigned_at
    }

    DATASETS {
        UUID id PK
        VARCHAR name UK
        TEXT description
        VARCHAR target_table
        UUID owner_id FK
        BOOLEAN is_active
        TIMESTAMPTZ created_at
    }

    DATASET_COLUMNS {
        UUID id PK
        UUID dataset_id FK
        VARCHAR column_name
        VARCHAR data_type
        BOOLEAN is_sensitive
        BOOLEAN is_identifier
        BOOLEAN is_aggregatable
        NUMERIC min_bound
        NUMERIC max_bound
    }

    PRIVACY_POLICIES {
        UUID id PK
        UUID dataset_id FK
        VARCHAR name
        NUMERIC max_epsilon_per_query
        NUMERIC default_delta
        NUMERIC global_epsilon_cap
        NUMERIC sensitivity_clamp_low
        NUMERIC sensitivity_clamp_high
        VARCHAR approved_mechanisms
        BOOLEAN is_active
        TIMESTAMPTZ created_at
    }

    DATASET_GRANTS {
        UUID id PK
        UUID dataset_id FK
        UUID analyst_id FK
        UUID granted_by FK
        TIMESTAMPTZ granted_at
        TIMESTAMPTZ expires_at
        BOOLEAN is_active
    }

    PRIVACY_BUDGETS {
        UUID id PK
        UUID grant_id UK, FK
        NUMERIC total_epsilon
        NUMERIC remaining_epsilon
        NUMERIC total_delta
        NUMERIC remaining_delta
        TIMESTAMPTZ last_reset_at
        TIMESTAMPTZ updated_at
    }

    PRIVACY_BUDGET_LEDGER {
        UUID id PK
        UUID budget_id FK
        UUID request_id FK
        NUMERIC amount
        VARCHAR transaction_type
        NUMERIC balance_after
        TIMESTAMPTZ created_at
    }

    QUERY_REQUESTS {
        UUID id PK
        UUID grant_id FK
        UUID analyst_id FK
        VARCHAR metric
        VARCHAR target_column
        JSONB filter_criteria
        NUMERIC requested_epsilon
        NUMERIC requested_delta
        VARCHAR status
        VARCHAR risk_level
        TEXT risk_summary
        TIMESTAMPTZ created_at
    }

    QUERY_RELEASES {
        UUID id PK
        UUID request_id UK, FK
        NUMERIC noisy_result
        VARCHAR mechanism_used
        NUMERIC noise_scale
        NUMERIC sensitivity_applied
        NUMERIC epsilon_spent
        NUMERIC delta_spent
        TIMESTAMPTZ released_at
    }

    AUDIT_EVENTS {
        UUID id PK
        TIMESTAMPTZ event_timestamp
        UUID actor_user_id FK
        VARCHAR event_type
        VARCHAR resource_type
        VARCHAR resource_id
        VARCHAR outcome
        VARCHAR client_ip
        JSONB details
    }

    PROTECTED_PATIENTS {
        UUID patient_id PK
        VARCHAR mrn UK
        INTEGER age
        VARCHAR gender
        VARCHAR blood_group
        VARCHAR diagnosis_code
        VARCHAR admission_type
        NUMERIC treatment_cost
        INTEGER length_of_stay_days
        BOOLEAN readmitted
        TIMESTAMPTZ admission_date
    }
```

---

## 2. Relational Schema & Mathematical Relational Notation

1. $\text{USERS}(\underline{\text{id}}, \text{email}, \text{password\_hash}, \text{full\_name}, \text{is\_active}, \text{created\_at}, \text{updated\_at})$
2. $\text{ROLES}(\underline{\text{name}}, \text{description})$
3. $\text{USER\_ROLES}(\underline{\text{user\_id}}, \underline{\text{role\_name}}, \text{assigned\_at})$  
   *FK: $\text{user\_id} \to \text{USERS}(\text{id})$, $\text{role\_name} \to \text{ROLES}(\text{name})$*
4. $\text{DATASETS}(\underline{\text{id}}, \text{name}, \text{description}, \text{target\_table}, \text{owner\_id}, \text{is\_active}, \text{created\_at})$  
   *FK: $\text{owner\_id} \to \text{USERS}(\text{id})$*
5. $\text{DATASET\_COLUMNS}(\underline{\text{id}}, \text{dataset\_id}, \text{column\_name}, \text{data\_type}, \text{is\_sensitive}, \text{is\_identifier}, \text{is\_aggregatable}, \text{min\_bound}, \text{max\_bound})$  
   *FK: $\text{dataset\_id} \to \text{DATASETS}(\text{id})$*
6. $\text{PRIVACY\_POLICIES}(\underline{\text{id}}, \text{dataset\_id}, \text{name}, \text{max\_epsilon\_per\_query}, \text{default\_delta}, \text{global\_epsilon\_cap}, \text{sensitivity\_clamp\_low}, \text{sensitivity\_clamp\_high}, \text{approved\_mechanisms}, \text{is\_active}, \text{created\_at})$  
   *FK: $\text{dataset\_id} \to \text{DATASETS}(\text{id})$*
7. $\text{DATASET\_GRANTS}(\underline{\text{id}}, \text{dataset\_id}, \text{analyst\_id}, \text{granted\_by}, \text{granted\_at}, \text{expires\_at}, \text{is\_active})$  
   *FK: $\text{dataset\_id} \to \text{DATASETS}(\text{id})$, $\text{analyst\_id} \to \text{USERS}(\text{id})$, $\text{granted\_by} \to \text{USERS}(\text{id})$*
8. $\text{PRIVACY\_BUDGETS}(\underline{\text{id}}, \text{grant\_id}, \text{total\_epsilon}, \text{remaining\_epsilon}, \text{total\_delta}, \text{remaining\_delta}, \text{last\_reset\_at}, \text{updated\_at})$  
   *FK: $\text{grant\_id} \to \text{DATASET\_GRANTS}(\text{id})$*
9. $\text{PRIVACY\_BUDGET\_LEDGER}(\underline{\text{id}}, \text{budget\_id}, \text{request\_id}, \text{amount}, \text{transaction\_type}, \text{balance\_after}, \text{created\_at})$  
   *FK: $\text{budget\_id} \to \text{PRIVACY\_BUDGETS}(\text{id})$, $\text{request\_id} \to \text{QUERY\_REQUESTS}(\text{id})$*
10. $\text{QUERY\_REQUESTS}(\underline{\text{id}}, \text{grant\_id}, \text{analyst\_id}, \text{metric}, \text{target\_column}, \text{filter\_criteria}, \text{requested\_epsilon}, \text{requested\_delta}, \text{status}, \text{risk\_level}, \text{risk\_summary}, \text{created\_at})$  
    *FK: $\text{grant\_id} \to \text{DATASET\_GRANTS}(\text{id})$, $\text{analyst\_id} \to \text{USERS}(\text{id})$*
11. $\text{QUERY\_RELEASES}(\underline{\text{id}}, \text{request\_id}, \text{noisy\_result}, \text{mechanism\_used}, \text{noise\_scale}, \text{sensitivity\_applied}, \text{epsilon\_spent}, \text{delta\_spent}, \text{released\_at})$  
    *FK: $\text{request\_id} \to \text{QUERY\_REQUESTS}(\text{id})$*
12. $\text{AUDIT\_EVENTS}(\underline{\text{id}}, \text{event\_timestamp}, \text{actor\_user\_id}, \text{event\_type}, \text{resource\_type}, \text{resource\_id}, \text{outcome}, \text{client\_ip}, \text{details})$  
    *FK: $\text{actor\_user\_id} \to \text{USERS}(\text{id})$*
13. $\text{PROTECTED\_PATIENTS}(\underline{\text{patient\_id}}, \text{mrn}, \text{age}, \text{gender}, \text{blood\_group}, \text{diagnosis\_code}, \text{admission\_type}, \text{treatment\_cost}, \text{length\_of\_stay\_days}, \text{readmitted}, \text{admission\_date})$  

---

## 3. Third Normal Form (3NF) Justification & Functional Dependencies

A relation $R$ is in 3NF if and only if for every functional dependency $X \to Y$, either:
1. $Y \subseteq X$ (trivial functional dependency), or
2. $X$ is a superkey of $R$, or
3. Every attribute in $Y \setminus X$ is a prime attribute (part of some candidate key).

### Normalization Proof for Core Relations:
- **`USERS`:**
  - Candidate Keys: $\{\text{id}\}$, $\{\text{email}\}$.
  - Functional Dependencies: $\text{id} \to \{\text{email}, \text{password\_hash}, \text{full\_name}, \text{is\_active}, \text{created\_at}, \text{updated\_at}\}$.
  - Since $\{\text{id}\}$ is a superkey, no transitive dependencies exist ($X \to Y \to Z$). Hence in **3NF**.
- **`DATASET_GRANTS`:**
  - Candidate Key: $\{\text{id}\}$, and unique pair $\{\text{dataset\_id}, \text{analyst\_id}\}$.
  - All non-key attributes ($\text{granted\_by}, \text{granted\_at}, \text{expires\_at}, \text{is\_active}$) depend directly on $\{\text{id}\}$. No transitive dependencies exist. Hence in **3NF**.
- **`PRIVACY_BUDGETS` & `PRIVACY_BUDGET_LEDGER`:**
  - Budget balances are stored in `PRIVACY_BUDGETS` ($\text{grant\_id}$ is unique foreign key).
  - Individual transaction records are in `PRIVACY_BUDGET_LEDGER`. Rather than embedding historical transaction arrays or running totals into the parent table (which would violate 1NF/2NF), each ledger transaction has a surrogate PK $\{\text{id}\}$ and references $\{\text{budget\_id}\}$ and $\{\text{request\_id}\}$. Hence in **3NF**.
- **De-duplication of Roles:**
  - Roles are extracted into a separate lookup table `ROLES` rather than duplicating role strings or descriptions in `USERS`. The junction table `USER_ROLES` enforces a clean many-to-many relationship in **3NF**.
