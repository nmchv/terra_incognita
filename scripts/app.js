/* TERRA INCOGNITA — запуск приложения, экраны, панели */
(function (TI) {
  'use strict';
  var h = TI.UI.h, G = TI.Game, S = TI.Storage;
  var FILES = ['world', 'sectors', 'tasks', 'discoveries', 'events'];
  var started = false;      // начата ли игра (есть что сохранять)
  var selectedId = null;
  var pendingCorrupt = null; // {raw, error}

  function $(id) { return document.getElementById(id); }
  function show(screen) {
    $('screen-start').hidden = screen !== 'start';
    $('screen-game').hidden = screen !== 'game';
    document.body.setAttribute('data-screen', screen);
    window.scrollTo(0, 0);
  }

  /* ---------- Загрузка данных ---------- */
  function loadData() {
    return Promise.all(FILES.map(function (f) {
      return fetch('data/' + f + '.json', { cache: 'no-cache' }).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status + ' для data/' + f + '.json');
        return r.json();
      });
    })).then(function (arr) {
      var d = {}; FILES.forEach(function (f, i) { d[f] = arr[i]; }); return d;
    }).catch(function (e) {
      // запуск с диска (file://): fetch недоступен, используем встроенную копию тех же данных
      if (window.TI_BUNDLE) { console.info('[TERRA INCOGNITA] fetch недоступен, используется data-bundle.js:', e && e.message); return window.TI_BUNDLE; }
      throw e;
    });
  }

  function fatal(msg, details) {
    var box = $('boot-error');
    box.hidden = false;
    box.innerHTML = '';
    box.appendChild(h('h2', { text: 'Не удалось запустить игру' }));
    box.appendChild(h('p', { text: msg }));
    if (details) box.appendChild(h('pre', { text: details }));
    $('screen-start').hidden = true;
  }

  /* ---------- Сохранение ---------- */
  function persist() { if (started) S.save(G.getState()); }

  /* ---------- Старт ---------- */
  function boot() {
    loadData().then(function (data) {
      var errs = G.validateData(data);
      if (errs.length) {
        console.error('[TERRA INCOGNITA] Ошибки в данных игры:\n - ' + errs.join('\n - '));
        fatal('В файлах данных найдены ошибки. Подробности — в консоли браузера.', errs.slice(0, 8).join('\n'));
        return;
      }
      G.init(data);
      var loaded = S.load(G.ids());
      if (loaded.status === 'ok') {
        G.setState(loaded.state); started = true;
      } else {
        G.newGame(); started = false;
        if (loaded.status === 'corrupt') {
          pendingCorrupt = { raw: loaded.raw, error: loaded.error };
          S.backupCorrupt(loaded.raw);
          console.warn('[TERRA INCOGNITA] Сохранение повреждено:', loaded.error);
        }
      }
      applySettings();
      TI.Map.init($('map'), G.data.world, G.data.sectors, selectSector);
      bindStatic();
      renderStart();
      show('start');
      if (pendingCorrupt) corruptDialog();
      else if (!started) openIntro(false);
    }).catch(function (e) {
      console.error(e);
      fatal('Не удалось загрузить файлы игры. Если вы открыли index.html прямо с диска, воспользуйтесь опубликованной версией (GitHub Pages) или локальным сервером. Подробности ниже.', String(e && e.message || e));
    });
  }

  function applySettings() {
    var st = G.getState().settings;
    TI.UI.setAnimations(st.animationsEnabled);
    TI.UI.setSound(st.soundEnabled);
  }

  /* ---------- Стартовый экран ---------- */
  function renderStart() {
    $('btn-continue').hidden = !(started && S.hasSave());
    $('btn-start').textContent = started ? 'Начать заново' : 'Начать исследование';
    var st = G.stats();
    var info = $('continue-info');
    if (started) {
      info.hidden = false;
      info.textContent = 'Сохранено: исследовано территорий — ' + st.explored + ' из ' + st.total + ', очков — ' + st.points + '.';
    } else info.hidden = true;
  }

  function corruptDialog() {
    var content = h('div', null, [
      h('p', { 'class': 'modal-text', text: 'Сохранённый прогресс не удалось прочитать: ' + pendingCorrupt.error }),
      h('p', { 'class': 'modal-text note', text: 'Копия повреждённых данных оставлена в браузере и пока не удалена. Вы можете начать новую игру или загрузить резервную копию из файла.' })
    ]);
    var fresh = h('button', { type: 'button', 'class': 'btn btn-primary', text: 'Начать заново' });
    var imp = h('button', { type: 'button', 'class': 'btn btn-ghost', 'data-autofocus': '1', text: 'Импортировать сохранение' });
    content.appendChild(h('div', { 'class': 'task-actions' }, [imp, fresh]));
    var m = TI.UI.modal({ title: 'Сохранение повреждено', content: content, className: 'modal-small', dismissible: false });
    fresh.addEventListener('click', function () { S.clear(); pendingCorrupt = null; m.close(); openIntro(false); });
    imp.addEventListener('click', function () { m.close(); pickImportFile(function (ok) { if (ok) pendingCorrupt = null; else corruptDialog(); }); });
  }

  function openIntro(autoStartOnly) {
    var w = G.data.world.intro;
    var content = h('div', { 'class': 'intro' });
    w.paragraphs.forEach(function (p) { content.appendChild(h('p', { text: p })); });
    var go = h('button', { type: 'button', 'class': 'btn btn-primary', 'data-autofocus': '1', text: 'Начать экспедицию' });
    var later = h('button', { type: 'button', 'class': 'btn btn-ghost', text: 'Закрыть' });
    content.appendChild(h('div', { 'class': 'task-actions' }, [later, go]));
    var m = TI.UI.modal({ title: w.title, content: content, className: 'modal-wide', dismissible: true });
    go.addEventListener('click', function () { m.close(); beginGame(); });
    later.addEventListener('click', m.close);
  }

  function beginGame() {
    G.newGame();
    G.markIntroSeen();
    started = true;
    persist();
    enterGame(G.data.world.planet.startSector);
  }

  function startClicked() {
    if (started) {
      TI.UI.confirm({
        title: 'Начать заново?', message: 'Текущий прогресс будет удалён и заменён новой экспедицией.',
        extra: ['Перед этим можно экспортировать сохранение в настройках.'], confirmLabel: 'Удалить и начать заново', danger: true
      }).then(function (ok) { if (ok) { S.clear(); started = false; G.newGame(); renderStart(); openIntro(false); } });
    } else if (!G.getState().progress.introSeen) openIntro(false);
    else beginGame();
  }

  function enterGame(selectId) {
    show('game');
    selectedId = null;
    refresh();
    selectSector(selectId || G.data.world.planet.startSector, true);
    var m = $('main'); if (m && m.focus) m.focus({ preventScroll: true });
  }

  /* ---------- Основной экран ---------- */
  function refresh(newIds) {
    TI.Map.render(G.sectorStatus, newIds || []);
    TI.Map.setActive(selectedId);
    renderTop(); renderLeft(); renderSector();
  }

  function renderTop() {
    var st = G.stats();
    $('top-points').textContent = String(st.points);
    $('top-explored').textContent = st.explored + ' / ' + st.total;
    var pct = Math.round(st.explored / st.total * 100);
    var bar = $('top-bar');
    bar.setAttribute('aria-valuenow', String(st.explored)); bar.setAttribute('aria-valuemax', String(st.total));
    bar.setAttribute('aria-valuetext', 'Исследовано территорий: ' + st.explored + ' из ' + st.total);
    $('top-bar-fill').style.width = pct + '%';
  }

  function listItem(text, cls) { return h('li', { 'class': cls || '', text: text }); }

  function renderLeft() {
    var st = G.stats(), state = G.getState();
    $('mission-text').textContent = G.data.world.mission;
    var grid = $('stats');
    grid.innerHTML = '';
    [['Исследовано территорий', st.explored + ' / ' + st.total], ['Заданий выполнено', st.tasks + ' / ' + st.totalTasks],
     ['Исследовательские очки', st.points], ['Открытий', st.discoveries + ' / ' + st.totalDiscoveries],
     ['Полностью изучено', st.full + ' / ' + st.total]].forEach(function (r) {
      grid.appendChild(h('div', { 'class': 'stat' }, [h('dt', { text: r[0] }), h('dd', { text: String(r[1]) })]));
    });
    var j = $('journal-recent'); j.innerHTML = '';
    state.journal.slice(-4).reverse().forEach(function (e) { j.appendChild(listItem(e.text, 'j-' + e.kind)); });
    var a = $('achievements'); a.innerHTML = '';
    G.data.world.achievements.forEach(function (ach) {
      var got = state.progress.achievementIds.indexOf(ach.id) !== -1;
      var li = h('li', { 'class': got ? 'ach ach-got' : 'ach' }, [
        h('span', { 'class': 'ach-mark', 'aria-hidden': 'true', text: got ? '★' : '○' }),
        h('span', null, [h('strong', { text: ach.name }), h('span', { 'class': 'ach-desc', text: ' — ' + ach.description }),
          h('span', { 'class': 'sr-only', text: got ? ' (получено)' : ' (не получено)' })])
      ]);
      a.appendChild(li);
    });
  }

  function selectSector(id, silent) {
    if (!G.isDiscovered(id)) return;
    selectedId = id;
    TI.Map.setActive(id);
    renderSector();
    if (!silent && window.matchMedia && window.matchMedia('(max-width: 900px)').matches) {
      var p = $('panel-right'); if (p && p.scrollIntoView) p.scrollIntoView({ behavior: 'auto', block: 'start' });
    }
  }

  var TYPE_SHORT = { multiple_choice: 'Вопрос', identify: 'Определение', analysis: 'Анализ', map_click: 'На карте' };

  function renderSector() {
    var box = $('sector-body'); box.innerHTML = '';
    if (!selectedId) {
      box.appendChild(h('p', { 'class': 'placeholder', text: 'Выберите территорию на карте, чтобы увидеть описание и доступные исследования.' }));
      return;
    }
    var s = G.sector(selectedId), st = G.sectorStatus(selectedId);
    box.appendChild(h('h2', { id: 'sector-title', text: s.name }));
    box.appendChild(h('p', { 'class': 'status status-' + st }, [
      h('span', { 'class': 'status-glyph', 'aria-hidden': 'true', text: TI.Map.GLYPH[st] }), document.createTextNode(' ' + TI.Map.STATUS_LABEL[st])
    ]));
    box.appendChild(h('p', { 'class': 'sector-desc', text: s.description }));
    var req = G.tasksOf(s.id, false), reqDone = G.requiredDone(s.id);
    box.appendChild(h('p', { 'class': 'sector-progress', text: 'Обязательные задания: ' + reqDone + ' из ' + req.length +
      (G.tasksOf(s.id, true).length ? '. Дополнительные: ' + G.tasksOf(s.id, true).filter(function (t) { return G.isDone(t.id); }).length + ' из ' + G.tasksOf(s.id, true).length : '') }));

    var next = G.nextTask(s.id);
    var main = h('button', { type: 'button', 'class': 'btn btn-primary btn-wide', text: !next ? 'Территория изучена полностью' : (G.doneCount(s.id) ? 'Продолжить исследование' : 'Начать исследование') });
    if (!next) { main.disabled = true; } else main.addEventListener('click', function () { openTask(next.id); });
    box.appendChild(main);

    var list = h('ol', { 'class': 'task-list', 'aria-label': 'Задания сектора' });
    G.tasksOf(s.id, false).concat(G.tasksOf(s.id, true)).forEach(function (t, i) {
      var done = G.isDone(t.id), can = G.canStartTask(t);
      var label = (t.extra ? 'Дополнительно: ' : 'Задание ' + (i + 1) + ': ') + t.title;
      var btn = h('button', { type: 'button', 'class': 'task-btn' + (done ? ' done' : '') + (can ? '' : ' locked'), 'aria-label': label + '. ' + (done ? 'Выполнено. Можно повторить.' : can ? 'Доступно.' : 'Откроется после исследования территории.') }, [
        h('span', { 'class': 'task-state', 'aria-hidden': 'true', text: done ? '✓' : can ? '▶' : '🔒' }),
        h('span', { 'class': 'task-name' }, [h('span', { text: label }), h('span', { 'class': 'task-sub', text: TYPE_SHORT[t.type] + ' · +' + G.taskReward(t) + (done ? ' · выполнено' : can ? '' : ' · после исследования') })])
      ]);
      if (!can) btn.disabled = true; else btn.addEventListener('click', function () { openTask(t.id); });
      list.appendChild(h('li', null, [btn]));
    });
    box.appendChild(list);

    if (G.isExplored(s.id)) {
      box.appendChild(h('h3', { text: 'Что удалось узнать' }));
      box.appendChild(h('p', { 'class': 'sector-geo', text: s.geo }));
      (s.discoveries || []).forEach(function (d) {
        var dd = G.discovery(d);
        box.appendChild(h('div', { 'class': 'discovery' }, [h('strong', { text: dd.name }), h('p', { text: dd.long })]));
      });
    }
    var unlocks = G.data.sectors.filter(function (o) { return (o.requires || []).indexOf(s.id) !== -1 && !G.isDiscovered(o.id); });
    if (unlocks.length && !G.isExplored(s.id)) box.appendChild(h('p', { 'class': 'note', text: 'Исследование этого сектора поможет обнаружить новые территории.' }));
  }

  /* ---------- Задание ---------- */
  function openTask(taskId) {
    var t = G.task(taskId), sec = G.sector(t.sectorId);
    if (!G.canStartTask(t)) return;
    var container = h('div');
    var lastRes = null, handled = false;
    function after() { if (handled) return; handled = true; afterTask(lastRes); }
    var m = TI.UI.modal({ title: 'Исследование: ' + sec.name, content: container, className: 'modal-task', onClose: after });
    TI.Tasks.render(container, t, sec, {
      sound: TI.UI.sound,
      complete: function (task) {
        var res = G.completeTask(task.id);
        persist();
        lastRes = res;
        return res;
      },
      onFinish: function () { m.close(); }
    });
  }

  function afterTask(res) {
    var newIds = res ? res.newSectors : [];
    if (res && !res.repeat) {
      if (res.newSectors.length) TI.UI.sound('new');
      res.newSectors.forEach(function (sid) { TI.UI.toast('Обнаружена новая территория: «' + G.sector(sid).name + '».', 'new'); });
      res.newAchievements.forEach(function (a) { TI.UI.toast('Достижение: «' + G.achievement(a).name + '» — ' + G.achievement(a).description, 'ach'); });
      if (res.explored) TI.UI.toast('Сектор исследован. Новые сведения добавлены в журнал.', 'info');
    }
    if (res && res.newSectors.length) selectedId = res.newSectors[0];
    refresh(newIds);
    if (res && res.newSectors.length) setTimeout(function () { TI.Map.focusSector(selectedId); }, 50);
    if (G.allExplored() && !G.getState().progress.finaleShown) {
      // показываем итог, только если не открыто другое окно; иначе — при следующем возврате на карту
      setTimeout(function () {
        if (document.querySelector('.overlay') || G.getState().progress.finaleShown) return;
        G.getState().progress.finaleShown = true; persist();
        finale();
      }, 300);
    }
  }

  function finale() {
    var st = G.stats();
    var c = h('div', { 'class': 'intro' }, [
      h('p', { text: 'Все 12 территорий планеты X-01 исследованы. Теперь видно, как устроен этот мир: горы собирают влагу с океана, реки текут вниз к котловинам и океану, за хребтом лежат сухие земли, а океанические течения смягчают климат побережий.' }),
      h('p', { text: 'Исследовательских очков: ' + st.points + '. Открытий: ' + st.discoveries + ' из ' + st.totalDiscoveries + '. Полностью изучено территорий: ' + st.full + ' из ' + st.total + '.' }),
      h('p', { 'class': 'note', text: 'Если какие-то дополнительные задания остались, вернитесь в сектора и завершите их — это даст звание «полностью изучено».' })
    ]);
    var ok = h('button', { type: 'button', 'class': 'btn btn-primary', 'data-autofocus': '1', text: 'Вернуться к карте' });
    c.appendChild(h('div', { 'class': 'task-actions' }, [ok]));
    var m = TI.UI.modal({ title: 'Планета X-01 исследована', content: c, className: 'modal-wide' });
    ok.addEventListener('click', m.close);
  }

  /* ---------- Журнал ---------- */
  function openJournal() {
    var state = G.getState(), c = h('div', { 'class': 'journal' });
    c.appendChild(h('h3', { text: 'Текущая миссия' }));
    c.appendChild(h('p', { text: G.data.world.mission }));
    c.appendChild(h('h3', { text: 'Известные сведения' }));
    var kf = h('ul'); G.data.world.knownFacts.forEach(function (f) { kf.appendChild(listItem(f)); }); c.appendChild(kf);

    c.appendChild(h('h3', { text: 'Последние события' }));
    var ev = h('ul', { 'class': 'events' });
    if (!state.journal.length) ev.appendChild(listItem('Записей пока нет.'));
    state.journal.slice().reverse().forEach(function (e) { ev.appendChild(listItem(e.text, 'j-' + e.kind)); });
    c.appendChild(ev);

    c.appendChild(h('h3', { text: 'Завершённые исследования' }));
    var ex = G.data.sectors.filter(function (s) { return G.isExplored(s.id); });
    if (!ex.length) c.appendChild(h('p', { 'class': 'note', text: 'Пока ни одна территория не исследована.' }));
    ex.forEach(function (s) { c.appendChild(h('div', { 'class': 'discovery' }, [h('strong', { text: s.name }), h('p', { text: s.journal })])); });

    c.appendChild(h('h3', { text: 'Географические открытия и закономерности' }));
    var ids = state.progress.discoveryIds;
    if (!ids.length) c.appendChild(h('p', { 'class': 'note', text: 'Открытий пока нет.' }));
    ids.forEach(function (d) {
      var dd = G.discovery(d);
      c.appendChild(h('div', { 'class': 'discovery' }, [h('strong', { text: dd.name + ' · ' + dd.category }), h('p', { text: dd.long })]));
    });
    TI.UI.modal({ title: 'Журнал экспедиции', content: c, className: 'modal-wide' });
  }

  /* ---------- Об игре ---------- */
  function openAbout() {
    var a = G.data.world.about, c = h('div', { 'class': 'intro' });
    a.paragraphs.forEach(function (p) { c.appendChild(h('p', { text: p })); });
    TI.UI.modal({ title: a.title, content: c, className: 'modal-wide' });
  }

  /* ---------- Настройки, экспорт, импорт, сброс ---------- */
  function openSettings() {
    var st = G.getState().settings;
    var c = h('div', { 'class': 'settings' });
    function toggle(id, label, checked, onChange) {
      var inp = h('input', { type: 'checkbox', id: id }); inp.checked = checked;
      inp.addEventListener('change', function () { onChange(inp.checked); });
      return h('label', { 'class': 'switch', 'for': id }, [inp, h('span', { text: label })]);
    }
    c.appendChild(toggle('set-anim', 'Анимации', st.animationsEnabled, function (v) { st.animationsEnabled = v; TI.UI.setAnimations(v); persist(); }));
    c.appendChild(toggle('set-sound', 'Звуковые сигналы', st.soundEnabled, function (v) { st.soundEnabled = v; TI.UI.setSound(v); if (v) TI.UI.sound('ok'); persist(); }));
    c.appendChild(h('h3', { text: 'Сохранение' }));
    c.appendChild(h('p', { 'class': 'note', text: 'Прогресс хранится в этом браузере. Чтобы перенести его на другое устройство, экспортируйте файл и импортируйте его там.' }));
    var exp = h('button', { type: 'button', 'class': 'btn btn-ghost', text: 'Экспортировать сохранение' });
    var imp = h('button', { type: 'button', 'class': 'btn btn-ghost', text: 'Импортировать сохранение' });
    var rst = h('button', { type: 'button', 'class': 'btn btn-danger', text: 'Сбросить прогресс' });
    c.appendChild(h('div', { 'class': 'settings-actions' }, [exp, imp, rst]));
    var m = TI.UI.modal({ title: 'Настройки', content: c, className: 'modal-small' });
    exp.addEventListener('click', function () {
      if (!started) { TI.UI.toast('Пока нечего экспортировать: экспедиция не начата.', 'info'); return; }
      S.exportState(G.getState()); TI.UI.toast('Файл сохранения скачан: ' + S.exportFileName(), 'info');
    });
    imp.addEventListener('click', function () { m.close(); pickImportFile(); });
    rst.addEventListener('click', function () {
      TI.UI.confirm({
        title: 'Сбросить прогресс?', message: 'Локальное сохранение будет удалено без возможности восстановления.',
        extra: ['Если нужна резервная копия, сначала нажмите «Экспортировать сохранение».'], confirmLabel: 'Да, сбросить', danger: true
      }).then(function (ok) {
        if (!ok) return;
        m.close();
        S.clear(); S.backupCorrupt(''); started = false; selectedId = null;
        G.newGame(); applySettings(); refresh(); renderStart(); show('start');
        TI.UI.toast('Прогресс сброшен. Можно начать новую экспедицию.', 'info');
      });
    });
  }

  function pickImportFile(done) {
    var inp = $('import-file');
    inp.value = '';
    inp.onchange = function () {
      var f = inp.files && inp.files[0];
      if (!f) { if (done) done(false); return; }
      if (f.size > 2 * 1024 * 1024) { TI.UI.alert('Файл не подходит', 'Файл слишком большой для сохранения игры.'); if (done) done(false); return; }
      var r = new FileReader();
      r.onload = function () {
        var res = S.parseImport(String(r.result), G.ids());
        if (!res.ok) { TI.UI.alert('Не удалось загрузить сохранение', res.error, ['Текущий прогресс не изменён.']); if (done) done(false); return; }
        var cur = G.stats();
        var next = res.state;
        TI.UI.confirm({
          title: 'Загрузить сохранение?',
          message: 'В файле: очков — ' + next.progress.researchPoints + ', выполнено заданий — ' + next.progress.completedTasks.length + '.',
          extra: started ? ['Текущий прогресс (очков: ' + cur.points + ', заданий: ' + cur.tasks + ') будет заменён.'] : [],
          confirmLabel: 'Загрузить'
        }).then(function (ok) {
          if (!ok) { if (done) done(false); return; }
          G.setState(next); started = true; persist(); applySettings();
          renderStart(); enterGame(G.data.world.planet.startSector);
          TI.UI.toast('Сохранение загружено.', 'info');
          if (done) done(true);
        });
      };
      r.onerror = function () { TI.UI.alert('Ошибка чтения', 'Не удалось прочитать выбранный файл.'); if (done) done(false); };
      r.readAsText(f);
    };
    inp.click();
  }

  /* ---------- Привязка кнопок ---------- */
  function bindStatic() {
    $('btn-start').addEventListener('click', startClicked);
    $('btn-continue').addEventListener('click', function () { enterGame(G.data.world.planet.startSector); });
    $('btn-settings').addEventListener('click', openSettings);
    $('btn-about').addEventListener('click', openAbout);
    $('btn-journal').addEventListener('click', openJournal);
    $('btn-journal-2').addEventListener('click', openJournal);
    $('btn-settings-g').addEventListener('click', openSettings);
    $('btn-menu').addEventListener('click', function () { renderStart(); show('start'); $('btn-continue').focus(); });
  }

  TI.App = { boot: boot };
  document.addEventListener('DOMContentLoaded', boot);
})(window.TI = window.TI || {});
