"""Собирает данные для запуска index.html с диска (без сервера).
Ядро (глава 1) → scripts/data-bundle.js; каждая глава из data/chapters.json → scripts/bundles/<глава>.js.
Главы лежат в отдельных файлах, поэтому новая глава не увеличивает уже существующие.
Запуск: python3 tools/build_bundle.py   (после правок в data/*.json)"""
import json, os
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
load = lambda n: json.load(open(os.path.join(root, "data", n + ".json"), encoding="utf-8"))
chapters = load("chapters")
core = {n: load(n) for n in ["world", "sectors", "tasks", "discoveries", "events"]}
core["chapters"] = chapters
with open(os.path.join(root, "scripts", "data-bundle.js"), "w", encoding="utf-8") as f:
    f.write("/* Автоматически создано tools/build_bundle.py. Копия данных главы 1 для запуска без сервера; остальные главы — в scripts/bundles/. */\n")
    f.write("window.TI_BUNDLE = " + json.dumps(core, ensure_ascii=False, separators=(",", ":")) + ";\n")
out = os.path.join(root, "scripts", "bundles")
os.makedirs(out, exist_ok=True)
for fn in os.listdir(out):
    if fn.endswith(".js") and fn[:-3] not in chapters: os.remove(os.path.join(out, fn))   # убрать файлы удалённых глав
for n in chapters:
    with open(os.path.join(out, n + ".js"), "w", encoding="utf-8") as f:
        f.write("/* Автоматически создано tools/build_bundle.py: данные главы для запуска без сервера. */\n")
        f.write("window.TI_CHAPTER_DATA = window.TI_CHAPTER_DATA || {};\nwindow.TI_CHAPTER_DATA[" + json.dumps(n) + "] = " + json.dumps(load(n), ensure_ascii=False, separators=(",", ":")) + ";\n")
print("bundle written:", ["data-bundle.js"] + ["bundles/%s.js" % n for n in chapters])
