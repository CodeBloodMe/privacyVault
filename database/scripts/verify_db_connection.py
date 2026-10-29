import psycopg2

def verify():
    conn = psycopg2.connect(
        host='localhost',
        port=5434,
        dbname='privacyvault',
        user='privacyvault_admin',
        password='AdminSuperSecretPassword2026!'
    )
    cur = conn.cursor()
    cur.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name;
    """)
    tables = [r[0] for r in cur.fetchall()]
    print('Connected successfully! Tables and views in privacyvault database:')
    for t in tables:
        print(f'  - {t}')

    cur.execute("""
        SELECT routine_name 
        FROM information_schema.routines 
        WHERE routine_schema = 'public' AND routine_type = 'FUNCTION'
        ORDER BY routine_name;
    """)
    funcs = [r[0] for r in cur.fetchall()]
    print('\nFunctions / Stored Procedures:')
    for f in funcs:
        print(f'  * {f}')

    conn.close()

if __name__ == '__main__':
    verify()
