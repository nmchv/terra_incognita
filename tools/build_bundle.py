"""Собирает scripts/data-bundle.js из data/*.json (запасной вариант для запуска index.html с диска).
Запуск: python3 tools/build_bundle.py   (после правок в data/*.json)"""
import json, os
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
names = ["world", "sectors", "tasks", "discoveries", "events"]
bundle = {n: json.load(open(os.path.join(root, "data", n + ".json"), encoding="utf-8")) for n in names}
with open(os.path.join(root, "scripts", "data-bundle.js"), "w", encoding="utf-8") as f:
    f.write("/* Автоматически создано tools/build_bundle.py. Копия data/*.json для запуска без сервера. */\n")
    f.write("window.TI_BUNDLE = " + json.dumps(bundle, ensure_ascii=False) + ";\n")
print("bundle written")
