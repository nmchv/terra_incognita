"""Сборка data/tasks.json из tasks_a/b/c.py. Запуск: python3 tools/gen_tasks.py"""
import json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from tasks_a import TASKS as A
from tasks_b import TASKS as B
from tasks_c import TASKS as C

tasks = A + B + C
out = os.path.join(os.path.dirname(__file__), "..", "data", "tasks.json")
with open(out, "w", encoding="utf-8") as f:
    json.dump(tasks, f, ensure_ascii=False, indent=1)
print(len(tasks), "tasks written")
