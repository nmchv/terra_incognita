/* TERRA INCOGNITA — сохранение прогресса (localStorage, экспорт, импорт, проверка) */
(function (TI) {
  'use strict';

  var KEY = 'terraIncognitaSave';
  var BACKUP_KEY = 'terraIncognitaSave.corrupt';
  var VERSION = 1;
  var memory = {}; // запасное хранилище, если localStorage недоступен

  function lsGet(k) {
    try { return window.localStorage.getItem(k); } catch (e) { return Object.prototype.hasOwnProperty.call(memory, k) ? memory[k] : null; }
  }
  function lsSet(k, v) {
    try { window.localStorage.setItem(k, v); return true; } catch (e) { memory[k] = v; return false; }
  }
  function lsRemove(k) {
    try { window.localStorage.removeItem(k); } catch (e) { /* ignore */ }
    delete memory[k];
  }

  function prefersReducedMotion() {
    try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
  }

  function newState() {
    var now = new Date().toISOString();
    return {
      version: VERSION,
      createdAt: now,
      updatedAt: now,
      progress: {
        discoveredSectors: [],
        completedTasks: [],
        fullyExploredSectors: [],
        discoveryIds: [],
        achievementIds: [],
        researchPoints: 0,
        introSeen: false,
        finaleShown: false
      },
      journal: [],
      settings: { soundEnabled: false, animationsEnabled: !prefersReducedMotion() }
    };
  }

  function isArr(a) { return Array.isArray(a); }
  function allStrings(a) { return isArr(a) && a.every(function (x) { return typeof x === 'string'; }); }

  /**
   * Проверка структуры сохранения. ids: {sectors:[], tasks:[], discoveries:[], achievements:[]}
   * Возвращает {ok:true} или {ok:false, error:'сообщение'}.
   */
  function validate(obj, ids) {
    if (!obj || typeof obj !== 'object' || isArr(obj)) return { ok: false, error: 'Файл не похож на сохранение игры.' };
    if (typeof obj.version !== 'number') return { ok: false, error: 'В файле нет номера версии.' };
    if (obj.version > VERSION) return { ok: false, error: 'Сохранение создано в более новой версии игры (версия ' + obj.version + ').' };
    if (obj.version < 1) return { ok: false, error: 'Неизвестная версия сохранения.' };
    var p = obj.progress;
    if (!p || typeof p !== 'object') return { ok: false, error: 'В сохранении нет раздела «progress».' };
    var lists = ['discoveredSectors', 'completedTasks', 'fullyExploredSectors', 'discoveryIds', 'achievementIds'];
    for (var i = 0; i < lists.length; i++) {
      if (!allStrings(p[lists[i]])) return { ok: false, error: 'Поле «' + lists[i] + '» повреждено.' };
    }
    if (typeof p.researchPoints !== 'number' || !isFinite(p.researchPoints) || p.researchPoints < 0) return { ok: false, error: 'Поле «researchPoints» повреждено.' };
    if (!isArr(obj.journal)) return { ok: false, error: 'Журнал повреждён.' };
    for (var j = 0; j < obj.journal.length; j++) {
      var e = obj.journal[j];
      if (!e || typeof e.text !== 'string') return { ok: false, error: 'Запись журнала №' + (j + 1) + ' повреждена.' };
    }
    if (!obj.settings || typeof obj.settings !== 'object') return { ok: false, error: 'Настройки повреждены.' };
    if (ids) {
      var checks = [
        ['discoveredSectors', 'sectors', 'сектор'], ['fullyExploredSectors', 'sectors', 'сектор'],
        ['completedTasks', 'tasks', 'задание'], ['discoveryIds', 'discoveries', 'открытие'],
        ['achievementIds', 'achievements', 'достижение']
      ];
      for (var c = 0; c < checks.length; c++) {
        var arr = p[checks[c][0]], known = ids[checks[c][1]] || [];
        for (var k = 0; k < arr.length; k++) {
          if (known.indexOf(arr[k]) === -1) return { ok: false, error: 'Неизвестный идентификатор (' + checks[c][2] + '): ' + arr[k] + '.' };
        }
      }
    }
    return { ok: true };
  }

  /** Приводит валидное сохранение к полному виду (добавляет недостающие необязательные поля). */
  function normalize(obj) {
    var base = newState();
    var s = {
      version: VERSION,
      createdAt: typeof obj.createdAt === 'string' ? obj.createdAt : base.createdAt,
      updatedAt: typeof obj.updatedAt === 'string' ? obj.updatedAt : base.updatedAt,
      progress: {
        discoveredSectors: uniq(obj.progress.discoveredSectors),
        completedTasks: uniq(obj.progress.completedTasks),
        fullyExploredSectors: uniq(obj.progress.fullyExploredSectors),
        discoveryIds: uniq(obj.progress.discoveryIds),
        achievementIds: uniq(obj.progress.achievementIds),
        researchPoints: Math.round(obj.progress.researchPoints),
        introSeen: !!obj.progress.introSeen,
        finaleShown: !!obj.progress.finaleShown
      },
      journal: obj.journal.slice(-30).map(function (e) {
        return { t: typeof e.t === 'string' ? e.t : base.createdAt, text: e.text, kind: typeof e.kind === 'string' ? e.kind : 'info' };
      }),
      settings: {
        soundEnabled: !!obj.settings.soundEnabled,
        animationsEnabled: typeof obj.settings.animationsEnabled === 'boolean' ? obj.settings.animationsEnabled : base.settings.animationsEnabled
      }
    };
    return s;
  }
  function uniq(a) { return a.filter(function (x, i) { return a.indexOf(x) === i; }); }

  /** Загрузка при запуске. status: 'none' | 'ok' | 'corrupt'. */
  function load(ids) {
    var raw = lsGet(KEY);
    if (raw === null || raw === undefined || raw === '') return { status: 'none', state: null, raw: null };
    var obj;
    try { obj = JSON.parse(raw); } catch (e) { return { status: 'corrupt', state: null, raw: raw, error: 'Сохранение не читается (повреждён JSON).' }; }
    var v = validate(obj, ids);
    if (!v.ok) return { status: 'corrupt', state: null, raw: raw, error: v.error };
    return { status: 'ok', state: normalize(obj), raw: raw };
  }

  function save(state) {
    state.updatedAt = new Date().toISOString();
    return lsSet(KEY, JSON.stringify(state));
  }

  function backupCorrupt(raw) { if (raw) lsSet(BACKUP_KEY, raw); }
  function clear() { lsRemove(KEY); }
  function hasSave() { var r = lsGet(KEY); return !!r; }

  function exportFileName() {
    var d = new Date();
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return 'terra-incognita-save-' + d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + '.json';
  }

  function exportState(state) {
    var text = JSON.stringify(state, null, 2);
    var blob = new Blob([text], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = exportFileName();
    document.body.appendChild(a); a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
  }

  /** Разбор текста импорта. Возвращает {ok, state} либо {ok:false, error}. */
  function parseImport(text, ids) {
    var obj;
    try { obj = JSON.parse(text); } catch (e) { return { ok: false, error: 'Файл не является корректным JSON.' }; }
    var v = validate(obj, ids);
    if (!v.ok) return v;
    return { ok: true, state: normalize(obj) };
  }

  TI.Storage = {
    KEY: KEY, VERSION: VERSION,
    newState: newState, validate: validate, normalize: normalize,
    load: load, save: save, clear: clear, hasSave: hasSave, backupCorrupt: backupCorrupt,
    exportState: exportState, exportFileName: exportFileName, parseImport: parseImport
  };
})(window.TI = window.TI || {});
