import psycopg2

def test_runtime_role():
    print("Testing connection as restricted runtime role 'privacyvault_app'...")
    conn = psycopg2.connect(
        host='localhost',
        port=5434,
        dbname='privacyvault',
        user='privacyvault_app',
        password='AppRuntimeSecurePass2026!'
    )
    cur = conn.cursor()
    cur.execute("SELECT current_user, session_user;")
    res = cur.fetchone()
    print(f"Connected as: current_user={res[0]}, session_user={res[1]}")
    assert res[0] == 'privacyvault_app'
    
    # Verify access to metadata catalog view
    cur.execute("SELECT count(*) FROM v_dataset_metadata_catalog;")
    count = cur.fetchone()[0]
    print(f"Accessible rows in v_dataset_metadata_catalog: {count}")
    
    conn.close()
    print("Runtime role connection test: PASSED")

if __name__ == '__main__':
    test_runtime_role()
