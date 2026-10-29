import os
import sys

# Forwarding wrapper to database/scripts/run_demo_scenarios.py
script_path = os.path.join(os.path.dirname(__file__), "..", "database", "scripts", "run_demo_scenarios.py")
if __name__ == "__main__":
    with open(script_path, "r", encoding="utf-8") as f:
        code = f.read()
    exec(compile(code, script_path, "exec"), globals(), locals())
