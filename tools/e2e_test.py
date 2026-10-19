"""Сквозной тест игры (Playwright). Запуск: python3 tools/e2e_test.py
Поднимает локальный сервер, проходит игру до конца через интерфейс, проверяет сохранение,
экспорт/импорт, сброс и узкий экран. Скриншоты — в каталог из переменной SHOTS (по умолчанию /tmp)."""
import json, os, subprocess, sys, time, threading, http.server, socketserver, functools
from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SHOTS = os.environ.get("SHOTS", "/tmp")
PORT = 8765

handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
handler.log_message = lambda *a, **k: None
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
socketserver.TCPServer.allow_reuse_address = True
srv = socketserver.TCPServer(("127.0.0.1", PORT), functools.partial(Quiet, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f"http://127.0.0.1:{PORT}/index.html"

tasks = {t["id"]: t for t in json.load(open(os.path.join(ROOT, "data/tasks.json"), encoding="utf-8"))}
sectors = json.load(open(os.path.join(ROOT, "data/sectors.json"), encoding="utf-8"))
failures = []
def check(cond, msg):
    print(("  ok   " if cond else "  FAIL ") + msg)
    if not cond: failures.append(msg)

def solve(page, tid, correct=True):
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
    page.click("button:has-text(\"Ответить\")")

with sync_playwright() as p:
    b = p.chromium.launch(args=["--no-sandbox"])
    ctx = b.new_context(viewport={"width": 1366, "height": 800}, accept_downloads=True)
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))
    page.on("console", lambda m: errors.append("console: " + m.text) if m.type == "error" else None)

    page.goto(URL)
    page.wait_for_selector(".modal-wide")
    check(page.is_visible("text=Экспедиция на планету X-01"), "вступление показано при первом запуске")
    page.screenshot(path=f"{SHOTS}/01-intro.png")
    page.click("text=Начать экспедицию")
    page.wait_for_selector("#screen-game:not([hidden])")
    st = page.evaluate("Array.from(document.querySelectorAll('.sector')).map(g=>g.dataset.status)")
    check(st.count("hidden") == 11 and st.count("discovered") == 1, "на старте открыт только стартовый сектор (%s)" % st)
    check(len(st) == 12, "на карте 12 секторов")
    page.screenshot(path=f"{SHOTS}/02-start-map.png")

    # недоступное исследование: скрытый сектор не выбирается
    page.evaluate("document.querySelector('.sector[data-id=sector-02]').dispatchEvent(new MouseEvent('click',{bubbles:true}))")
    check("Берег первого контакта" in page.inner_text("#sector-title"), "скрытый сектор нельзя выбрать")

    # --- первая задача: ошибка, затем повтор ---
    page.click("#sector-body >> text=Начать исследование")
    solve(page, "task-001", correct=False)
    page.wait_for_selector(".result-bad")
    check("Правильный ответ" in page.inner_text(".result"), "при ошибке показан правильный ответ и объяснение")
    check(page.evaluate("TI.Game.stats().points") == 0, "за ошибку очки не начисляются и не списываются")
    page.screenshot(path=f"{SHOTS}/03-wrong.png")
    page.click("text=Повторить задание")
    page.click("text=Подсказка")
    check(page.is_visible(".hint"), "подсказка работает")
    solve(page, "task-001", correct=True)
    page.wait_for_selector(".result-ok")
    page.screenshot(path=f"{SHOTS}/04-correct.png")
    page.click("text=Продолжить исследование")
    check(page.evaluate("TI.Game.stats().points") == 100, "100 очков за обычное задание")

    # --- прохождение всей игры через интерфейс ---
    guard = 0
    order = []
    while guard < 200:
        guard += 1
        s = page.evaluate("""() => { const G=TI.Game; for (const sec of G.data.sectors) { if (G.isDiscovered(sec.id)) { const n=G.nextTask(sec.id); if (n) return {sector: sec.id, task: n.id}; } } return null; }""")
        if not s: break
        page.evaluate(f"document.querySelector('.sector[data-id={s['sector']}]').dispatchEvent(new MouseEvent('click',{{bubbles:true}}))")
        page.click("#sector-body >> text=/Начать исследование|Продолжить исследование/")
        # открыт ровно nextTask этого сектора
        solve(page, s["task"], correct=True)
        try:
            page.wait_for_selector(".result-ok", timeout=5000)
        except Exception:
            page.screenshot(path=f"{SHOTS}/fail.png"); print("FAILED TASK", s["task"], tasks[s["task"]]["type"]); raise
        order.append(s["task"])
        try:
            page.click(".modal-task >> text=Продолжить исследование", timeout=5000)
        except Exception:
            page.screenshot(path=f"{SHOTS}/fail2.png"); print("FAILED CONTINUE", s["task"], len(order), page.evaluate("document.querySelectorAll('.overlay').length")); raise
        # финальное окно (появляется через 300 мс после исследования последнего сектора)
        if page.evaluate("TI.Game.allExplored()"):
            page.wait_for_timeout(450)
        if page.is_visible("text=Планета X-01 исследована"):
            page.screenshot(path=f"{SHOTS}/05-finale.png")
            page.click(".modal-wide >> text=Вернуться к карте")
        if len(order) == 15:
            page.screenshot(path=f"{SHOTS}/06-mid-map.png")
    stt = page.evaluate("TI.Game.stats()")
    check(stt["explored"] == 12, "исследованы все 12 секторов")
    check(stt["tasks"] == 48 and stt["full"] == 12, "выполнено 48 заданий, все секторы изучены полностью")
    expected = sum(150 if (t["complex"] and not t["extra"]) else (50 if t["extra"] else 100) for t in tasks.values())
    check(stt["points"] == expected, f"очки {stt['points']} = ожидаемым {expected}")
    check(stt["discoveries"] == 12, "найдено 12 открытий")
    ach = page.evaluate("TI.Game.getState().progress.achievementIds")
    check(len(ach) == 7, "получены все 7 достижений: %s" % ach)
    page.screenshot(path=f"{SHOTS}/07-complete-map.png")

    # --- сохранение и перезагрузка ---
    page.reload()
    page.wait_for_selector("#screen-start:not([hidden])")
    check(page.is_visible("#btn-continue"), "после перезагрузки есть кнопка «Продолжить»")
    page.click("#btn-continue")
    check(page.evaluate("TI.Game.stats().points") == expected, "прогресс восстановлен после перезагрузки")

    # --- экспорт ---
    page.click("#btn-settings-g")
    with page.expect_download() as dl:
        page.click("text=Экспортировать сохранение")
    d = dl.value
    path = f"{SHOTS}/export.json"; d.save_as(path)
    check(d.suggested_filename.startswith("terra-incognita-save-") and d.suggested_filename.endswith(".json"), "имя файла экспорта: " + d.suggested_filename)
    exported = json.load(open(path, encoding="utf-8"))
    check(exported["version"] == 1 and exported["progress"]["researchPoints"] == expected, "экспорт содержит версию и прогресс")
    page.keyboard.press("Escape")

    # --- сброс ---
    page.click("#btn-settings-g")
    page.click("text=Сбросить прогресс")
    check(page.is_visible("text=без возможности восстановления"), "перед сбросом показано подтверждение")
    page.click(".modal-small >> text=Да, сбросить")
    page.wait_for_selector("#screen-start:not([hidden])")
    check(page.evaluate("localStorage.getItem('terraIncognitaSave')") is None, "сохранение удалено")
    check(not page.is_visible("#btn-continue"), "после сброса «Продолжить» скрыта")
    page.screenshot(path=f"{SHOTS}/08-start.png")

    # --- импорт: плохие файлы ---
    bad = f"{SHOTS}/bad.json"
    for name, content, needle in [("not-json", "{{{", "JSON"), ("bad-struct", json.dumps({"version": 1, "progress": {}}), "повреж"),
                                  ("bad-id", json.dumps({**exported, "progress": {**exported["progress"], "completedTasks": ["task-999"]}}), "Неизвестный идентификатор")]:
        open(bad, "w", encoding="utf-8").write(content)
        page.click("#btn-settings"); page.click("text=Импортировать сохранение")
        page.set_input_files("#import-file", bad)
        page.wait_for_selector("text=Не удалось загрузить сохранение")
        check(needle in page.inner_text(".modal-small"), f"импорт отклоняет файл «{name}» с сообщением")
        page.click(".modal-small >> text=Понятно")
    # --- импорт: хороший файл ---
    page.click("#btn-settings"); page.click("text=Импортировать сохранение")
    page.set_input_files("#import-file", path)
    page.wait_for_selector("text=Загрузить сохранение?")
    page.click(".modal-small >> button:has-text(\"Загрузить\")")
    page.wait_for_selector("#screen-game:not([hidden])")
    check(page.evaluate("TI.Game.stats().points") == expected, "импорт восстановил прогресс")

    # --- повреждённое сохранение ---
    page.evaluate("localStorage.setItem('terraIncognitaSave', '{broken')")
    page.reload()
    page.wait_for_selector("text=Сохранение повреждено")
    page.screenshot(path=f"{SHOTS}/09-corrupt.png")
    page.click("text=Начать заново")
    page.wait_for_selector(".modal-wide")
    page.keyboard.press("Escape")

    # --- узкий экран ---
    m = b.new_context(viewport={"width": 360, "height": 740}, is_mobile=True, has_touch=True)
    mp = m.new_page()
    merr = []
    mp.on("pageerror", lambda e: merr.append(str(e)))
    mp.goto(URL); mp.wait_for_selector(".modal-wide")
    mp.screenshot(path=f"{SHOTS}/10-mobile-intro.png")
    mp.click("text=Начать экспедицию")
    mp.wait_for_selector("#screen-game:not([hidden])")
    w = mp.evaluate("[document.documentElement.scrollWidth, window.innerWidth]")
    check(w[0] <= w[1], f"нет горизонтальной прокрутки страницы на 360 px ({w})")
    mp.screenshot(path=f"{SHOTS}/11-mobile-game.png", full_page=True)
    mp.click("#sector-body >> text=Начать исследование")
    mp.wait_for_selector(".modal-task")
    w = mp.evaluate("[document.documentElement.scrollWidth, window.innerWidth]")
    check(w[0] <= w[1], f"нет горизонтальной прокрутки в окне задания ({w})")
    mp.wait_for_timeout(500)
    mp.screenshot(path=f"{SHOTS}/12-mobile-task.png")
    check(not merr, "нет ошибок JS на мобильном экране: %s" % merr)

    check(not errors, "нет ошибок JS/консоли на десктопе: %s" % errors)
    b.close()

srv.shutdown()
print("\nИТОГ:", "ВСЁ ПРОШЛО" if not failures else "ПРОВАЛЕНО: %d" % len(failures))
sys.exit(1 if failures else 0)
