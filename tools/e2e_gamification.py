"""Проверка игровых элементов (Playwright): звёзды, серии, уровни, значки, совместимость со старыми сохранениями.
Запуск: python3 tools/e2e_gamification.py. Скриншоты — в каталог из переменной SHOTS (по умолчанию /tmp)."""
import json, os, sys, threading, functools, http.server, socketserver
from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SHOTS = os.environ.get("SHOTS", "/tmp")
PORT = 8766

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
socketserver.TCPServer.allow_reuse_address = True
srv = socketserver.TCPServer(("127.0.0.1", PORT), functools.partial(Quiet, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f"http://127.0.0.1:{PORT}/index.html"

tasks = {t["id"]: t for t in json.load(open(os.path.join(ROOT, "data/tasks.json"), encoding="utf-8"))}
failures = []
def check(cond, msg):
    print(("  ok   " if cond else "  FAIL ") + msg)
    if not cond: failures.append(msg)

def answer(page, tid, correct=True):
    t = tasks[tid]
    page.wait_for_selector(".modal-task .task-title")
    if t["type"] == "map_click":
        zone = t["correctZone"]
        if not correct:
            zone = [i["id"] for i in t["diagram"]["items"] if i["t"] == "zone" and i["id"] != t["correctZone"]][0]
        page.click(f'.dz[data-zone="{zone}"]')
    else:
        idx = t["correctAnswer"] if correct else (t["correctAnswer"] + 1) % len(t["options"])
        page.click(f'label.option:has-text("{t["options"][idx]}")')
    page.click('button:has-text("Ответить")')

def next_id(page):
    return page.evaluate("TI.Game.nextTask('sector-01').id")

def open_next(page):
    page.click('.sector[data-id="sector-01"]')
    page.click("#sector-body >> text=/Начать исследование|Продолжить исследование/")

def prog(page, expr):
    return page.evaluate("TI.Game.getState().progress." + expr)

with sync_playwright() as p:
    b = p.chromium.launch(args=["--no-sandbox"])
    ctx = b.new_context(viewport={"width": 1366, "height": 820})
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))
    page.on("console", lambda m: errors.append("console: " + m.text) if m.type == "error" else None)

    page.goto(URL); page.wait_for_selector(".modal-wide")
    page.click("text=Начать экспедицию"); page.wait_for_selector("#screen-game:not([hidden])")
    check(page.inner_text("#hud-lvl") == "1" and page.inner_text("#top-streak") == "0", "в начале: уровень 1, серия 0")

    # 1. ошибка, затем верно: две звезды, серия сбрасывается и начинается заново
    open_next(page); t1 = next_id(page)
    answer(page, t1, False); page.wait_for_selector(".result-bad")
    check(prog(page, "streak") == 0 and prog(page, "mistakes") == 1, "неверный ответ: серия 0, ошибок 1")
    page.click("text=Повторить задание"); answer(page, t1, True); page.wait_for_selector(".result-ok")
    check(page.evaluate(f"TI.Game.starsOf('{t1}')") == 2, "одна ошибка = две звезды")
    check(prog(page, "streak") == 1, "верный ответ после ошибки: серия 1")
    check(page.is_visible(".result-ok .stars") and page.is_visible(".chip-pts"), "в результате видны звёзды и очки")
    check("значок" in page.inner_text(".rewards").lower() and "Первый шаг" in page.inner_text(".rewards"), "значок «Первый шаг» выдан за первое задание")
    page.click(".modal-task >> text=Продолжить исследование")

    # 2. подсказка стоит звезды
    open_next(page); t2 = next_id(page)
    page.wait_for_selector(".modal-task .task-title"); page.click("text=Подсказка")
    answer(page, t2, True); page.wait_for_selector(".result-ok")
    check(page.evaluate(f"TI.Game.starsOf('{t2}')") == 2, "подсказка = две звезды")
    page.click(".modal-task >> text=Продолжить исследование")

    # 3. три звезды, серия 3, повышение уровня (баннер не блокирует интерфейс)
    page.evaluate("TI.Game.getState().progress.researchPoints = 190")
    open_next(page); t3 = next_id(page)
    answer(page, t3, True); page.wait_for_selector(".result-ok")
    check(page.evaluate(f"TI.Game.starsOf('{t3}')") == 3, "без подсказок и ошибок = три звезды")
    check(prog(page, "streak") == 3 and prog(page, "bestStreak") == 3, "серия из трёх ответов")
    check("m-streak3" in prog(page, "medalIds"), "значок за серию из трёх")
    page.wait_for_selector(".banner", timeout=2000)
    check("Уровень 2" in page.inner_text(".banner"), "баннер нового уровня показан")
    page.screenshot(path=f"{SHOTS}/g1-levelup.png")
    page.click(".modal-task >> text=Продолжить исследование", timeout=5000)  # баннер не перехватывает клики
    page.wait_for_timeout(1100)
    check(page.inner_text("#hud-lvl") == "2" and page.inner_text("#rank-n") == "2", "после закрытия окна уровень 2 в шапке и в карточке ранга")
    check(page.inner_text("#top-stars") == "7", "в шапке 7 звёзд (2+2+3)")
    page.screenshot(path=f"{SHOTS}/g2-hud.png")

    # 4. повтор задания: очки не растут, но звёзды можно улучшить
    pts = prog(page, "researchPoints")
    page.click('.sector[data-id="sector-01"]')
    page.click(f"#sector-body .task-btn >> nth=0")
    page.wait_for_selector(".modal-task .note-repeat")
    answer(page, t1, True); page.wait_for_selector(".result-ok")
    check(page.evaluate(f"TI.Game.starsOf('{t1}')") == 3, "повтор без ошибок поднимает оценку до трёх звёзд")
    check(prog(page, "researchPoints") == pts, "очки за повтор не начисляются")
    page.click(".modal-task >> text=Продолжить исследование")

    # 5. сохранение и перезагрузка
    page.reload(); page.wait_for_selector("#screen-start:not([hidden])")
    page.click("#btn-continue")
    check(page.evaluate(f"TI.Game.starsOf('{t1}')") == 3 and prog(page, "bestStreak") >= 3, "звёзды и рекорд серии сохранены")
    saved = json.loads(page.evaluate("localStorage.getItem('terraIncognitaSave')"))
    check(all(k in saved["progress"] for k in ("taskStars", "streak", "bestStreak", "mistakes", "medalIds")), "новые поля есть в сохранении")
    check(saved["version"] == 1, "версия формата сохранения не менялась")

    # 6. отключённые анимации: конфетти не создаётся
    page.evaluate("TI.UI.setAnimations(false)")
    open_next(page); t4 = next_id(page)
    answer(page, t4, True); page.wait_for_selector(".result-ok")
    check(page.locator(".confetti").count() == 0, "при выключенных анимациях конфетти нет")
    page.click(".modal-task >> text=Продолжить исследование")
    page.evaluate("TI.UI.setAnimations(true)")

    # 7. значки: касание показывает, как получить
    page.screenshot(path=f"{SHOTS}/g3-panel.png")
    first_locked = page.locator(".medal-locked").first
    first_locked.scroll_into_view_if_needed(); first_locked.click()
    check(page.is_visible(".toast-medal"), "нажатие на значок показывает подсказку")

    # 8. старое сохранение (без новых полей) читается, звёзды по умолчанию 1, значки выдаются молча
    sec1 = [t for t in tasks.values() if t["sectorId"] == "sector-01" and not t.get("extra")]
    old = {"version": 1, "createdAt": "2026-01-01T00:00:00.000Z", "updatedAt": "2026-01-01T00:00:00.000Z",
           "progress": {"discoveredSectors": ["sector-01"], "completedTasks": [t["id"] for t in sec1], "fullyExploredSectors": [],
                        "discoveryIds": [], "achievementIds": [], "researchPoints": 350, "introSeen": True, "finaleShown": False,
                        "chapter": 1, "introChapters": [], "finaleChapters": []},
           "journal": [{"t": "2026-01-01T00:00:00.000Z", "text": "Экспедиция началась.", "kind": "info"}],
           "settings": {"soundEnabled": False, "animationsEnabled": True}}
    page.evaluate("s => localStorage.setItem('terraIncognitaSave', s)", json.dumps(old))
    page.reload(); page.wait_for_selector("#screen-start:not([hidden])")
    check(not page.is_visible(".modal"), "старое сохранение не считается повреждённым")
    page.click("#btn-continue"); page.wait_for_selector("#screen-game:not([hidden])")
    check(page.evaluate("TI.Game.stats().stars") == 3, "старые выполненные задания получают по одной звезде")
    check("m-first" in prog(page, "medalIds") and not page.is_visible(".toast"), "значок за прошлые успехи выдан без шума")
    check(page.inner_text("#hud-lvl") == "2", "уровень считается по старым очкам (350 → уровень 2)")

    # 9. мусор в новых полях при импорте отбрасывается
    cleaned = page.evaluate("""(o) => { o.progress.taskStars = {a: 9, b: 'x', c: 2}; o.progress.streak = -5; o.progress.medalIds = ['m-first', 7];
        var r = TI.Storage.parseImport(JSON.stringify(o), TI.Game.ids()); return r.ok ? r.state.progress : null; }""", old)
    check(cleaned and cleaned["taskStars"] == {"c": 2} and cleaned["streak"] == 0 and cleaned["medalIds"] == ["m-first"], "импорт очищает некорректные звёзды, серию и значки")

    check(not errors, "нет ошибок JS/консоли: %s" % errors)
    b.close()

srv.shutdown()
print("\nИТОГ:", "ВСЁ ПРОШЛО" if not failures else "ПРОВАЛЕНО: %d" % len(failures))
sys.exit(1 if failures else 0)
