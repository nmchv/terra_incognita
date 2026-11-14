"""Сборка data/chapter2.json (глава 2, 7 класс) из tools/ch2_meta.py и tools/tasks_d/e/f.py.
Запуск: python3 tools/gen_chapter2.py  (затем python3 tools/build_bundle.py)"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tasks_d import TASKS as D
from tasks_e import TASKS as E
from tasks_f import TASKS as F
from ch2_meta import CHAPTER, SECTORS, DISCOVERIES, ACHIEVEMENTS

tasks = D + E + F
out = {"chapter": CHAPTER, "sectors": SECTORS, "tasks": tasks, "discoveries": DISCOVERIES, "achievements": ACHIEVEMENTS}
path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "chapter2.json")
with open(path, "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, indent=1)
print(len(SECTORS), "sectors,", len(tasks), "tasks,", len(DISCOVERIES), "discoveries,", len(ACHIEVEMENTS), "achievements written")

# ---------- карта соответствия ФГОС (docs/chapter2-fgos.md) ----------
from fgos7 import FGOS7
TYPE = {"multiple_choice": "Вопрос", "map_click": "На карте", "analysis": "Анализ", "identify": "Определение"}
TOPIC_SECTION = {"sector-13": "1.1 Географическая оболочка", "sector-14": "1.2 Литосфера и рельеф Земли", "sector-15": "1.3 Атмосфера и климаты Земли",
                 "sector-16": "1.3 Атмосфера и климаты Земли", "sector-17": "1.4 Мировой океан", "sector-18": "2.1 Численность населения",
                 "sector-19": "2.2 Страны и народы мира", "sector-20": "3.1 Южные материки", "sector-21": "3.1 Южные материки",
                 "sector-22": "3.1 Южные материки", "sector-23": "3.1 Южные материки", "sector-24": "3.2 Северные материки",
                 "sector-25": "3.2 Северные материки", "sector-26": "3.3 Взаимодействие природы и общества"}
secname = {s["id"]: s["name"] for s in SECTORS}
md = ["# Глава 2 (7 класс): соответствие ФГОС ООО", "",
      "Источник кодов и формулировок: «Федеральная рабочая программа. География. 5–9 классы», кодификатор проверяемых предметных результатов, 7 класс.",
      "Файл создаётся автоматически скриптом `tools/gen_chapter2.py`; код результата также указан в каждом задании (поле `fgos`) и показан в окне задания.", ""]
md += ["## Задания по секторам", ""]
for s in SECTORS:
    md += ["### %s. %s (раздел программы: %s)" % (s["id"].split("-")[1], s["name"], TOPIC_SECTION[s["id"]]), "",
           "| Задание | Тип | Код | Проверяемый результат |", "|---|---|---|---|"]
    for t in tasks:
        if t["sectorId"] == s["id"]:
            tag = TYPE[t["type"]] + (", доп." if t["extra"] else "") + (", комплексное" if t["complex"] and not t["extra"] else "")
            md.append("| %s. %s | %s | %s | %s |" % (t["id"], t["title"], tag, t["fgos"], FGOS7[t["fgos"]]))
    md.append("")
used = {t["fgos"] for t in tasks}
md += ["## Покрытие кодификатора", "", "Использовано кодов: %d из %d." % (len(used), len(FGOS7)), "",
       "Не покрыты заданиями игры (требуют работы с атласом, текстом, практических работ или проектов в классе):", ""]
for k in sorted(FGOS7, key=lambda x: tuple(map(int, x.split(".")))):
    if k not in used:
        md.append("- **%s** %s" % (k, FGOS7[k]))
md.append("")
os.makedirs(os.path.join(os.path.dirname(path), "..", "docs"), exist_ok=True)
with open(os.path.join(os.path.dirname(path), "..", "docs", "chapter2-fgos.md"), "w", encoding="utf-8") as f:
    f.write("\n".join(md))
print("docs/chapter2-fgos.md written;", len(used), "of", len(FGOS7), "codes used")
