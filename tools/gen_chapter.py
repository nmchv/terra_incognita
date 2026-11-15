"""Сборка одной главы: python3 tools/gen_chapter.py N   (N — номер главы, 2, 3, ...)

Исходники главы лежат в tools/chN/:
  meta.py      CHAPTER, SECTORS, DISCOVERIES, ACHIEVEMENTS, PROGRAM (раздел программы по секторам)
  tasks_*.py   списки TASKS (используют вспомогательные функции из tools/th.py)
  fgos.py      FGOS — формулировки кодов проверяемых результатов
Результат: data/chapterN.json и docs/chapterN-fgos.md. Затем: python3 tools/build_bundle.py.
Новая глава должна быть вписана в data/chapters.json."""
import glob, importlib.util, json, os, sys

N = int(sys.argv[1])
TOOLS = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(TOOLS, "..")
CH = os.path.join(TOOLS, "ch%d" % N)
sys.path.insert(0, TOOLS)

def load(path, name):
    spec = importlib.util.spec_from_file_location("ch%d_%s" % (N, name), path)
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m

meta = load(os.path.join(CH, "meta.py"), "meta")
fg = load(os.path.join(CH, "fgos.py"), "fgos").FGOS
tasks = []
for f in sorted(glob.glob(os.path.join(CH, "tasks_*.py"))):
    tasks += load(f, os.path.basename(f)[:-3]).TASKS

# --- проверки целостности главы ---
ids = [t["id"] for t in tasks]
assert len(ids) == len(set(ids)), "повторяются id заданий"
sec = {s["id"]: s for s in meta.SECTORS}
for s in meta.SECTORS:
    for t in s["taskIds"]:
        tk = [x for x in tasks if x["id"] == t]
        assert tk and tk[0]["sectorId"] == s["id"], "задание %s не относится к %s" % (t, s["id"])
for t in tasks:
    assert t["sectorId"] in sec, t["id"]
    assert t.get("fgos") in fg, "неизвестный код ФГОС у %s: %s" % (t["id"], t.get("fgos"))
    assert t["topic"] in meta.CHAPTER["topics"], "нет подписи темы %s" % t["topic"]

out = {"chapter": meta.CHAPTER, "sectors": meta.SECTORS, "tasks": tasks, "discoveries": meta.DISCOVERIES, "achievements": meta.ACHIEVEMENTS}
path = os.path.join(ROOT, "data", "chapter%d.json" % N)
with open(path, "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
print("chapter%d.json:" % N, len(meta.SECTORS), "sectors,", len(tasks), "tasks,", len(meta.DISCOVERIES), "discoveries,", len(meta.ACHIEVEMENTS), "achievements")

# --- карта соответствия ФГОС ---
TYPE = {"multiple_choice": "Вопрос", "map_click": "На карте", "analysis": "Анализ", "identify": "Определение"}
md = ["# Глава %d (%s): соответствие ФГОС ООО" % (N, meta.CHAPTER["grade"]), "",
      "Источник кодов и формулировок: «Федеральная рабочая программа. География. 5–9 классы», кодификатор проверяемых предметных результатов, %s." % meta.CHAPTER["grade"],
      "Файл создаётся автоматически скриптом `tools/gen_chapter.py %d`; код результата также указан в каждом задании (поле `fgos`) и показан в окне задания." % N, "",
      "## Задания по секторам", ""]
for s in meta.SECTORS:
    md += ["### %s. %s (раздел программы: %s)" % (s["id"].split("-")[1], s["name"], meta.PROGRAM[s["id"]]), "",
           "| Задание | Тип | Код | Проверяемый результат |", "|---|---|---|---|"]
    for t in tasks:
        if t["sectorId"] == s["id"]:
            tag = TYPE[t["type"]] + (", доп." if t["extra"] else "") + (", комплексное" if t["complex"] and not t["extra"] else "")
            md.append("| %s. %s | %s | %s | %s |" % (t["id"], t["title"], tag, t["fgos"], fg[t["fgos"]]))
    md.append("")
used = {t["fgos"] for t in tasks}
md += ["## Покрытие кодификатора", "", "Использовано кодов: %d из %d." % (len(used), len(fg)), "",
       "Не покрыты заданиями игры (требуют работы с атласом, текстом, практических работ или проектов в классе):", ""]
for k in sorted(fg, key=lambda x: tuple(map(int, x.split(".")))):
    if k not in used:
        md.append("- **%s** %s" % (k, fg[k]))
os.makedirs(os.path.join(ROOT, "docs"), exist_ok=True)
with open(os.path.join(ROOT, "docs", "chapter%d-fgos.md" % N), "w", encoding="utf-8") as f:
    f.write("\n".join(md) + "\n")
print("docs/chapter%d-fgos.md:" % N, len(used), "of", len(fg), "codes used")
