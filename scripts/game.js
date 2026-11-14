/* TERRA INCOGNITA — игровая логика: данные, прогресс, открытия, достижения */
(function (TI) {
  'use strict';

  var data = null;
  var state = null;
  var idx = { sectors: {}, tasks: {}, discoveries: {}, achievements: {} };

  /* ---------- Проверка данных ---------- */
  function validateData(d) {
    var errors = [];
    function err(m) { errors.push(m); }
    function dup(list, name) {
      var seen = {};
      list.forEach(function (x) { if (seen[x.id]) err('Повторяющийся идентификатор (' + name + '): ' + x.id); seen[x.id] = true; });
    }
    if (!d || !d.world || !d.sectors || !d.tasks || !d.discoveries || !d.events) { err('Не загружен один из файлов данных.'); return errors; }
    dup(d.sectors, 'сектор'); dup(d.tasks, 'задание'); dup(d.discoveries, 'открытие'); dup(d.world.achievements, 'достижение');
    var sIds = d.sectors.map(function (s) { return s.id; });
    var tIds = d.tasks.map(function (t) { return t.id; });
    var dIds = d.discoveries.map(function (x) { return x.id; });
    var sectorTasks = {};
    d.sectors.forEach(function (s) {
      if (!s.name || !s.description || !s.poly || !s.center) err('Сектор ' + s.id + ': не хватает названия, описания или координат.');
      (s.requires || []).forEach(function (r) { if (sIds.indexOf(r) === -1) err('Сектор ' + s.id + ': требует несуществующий сектор ' + r); });
      (s.taskIds || []).forEach(function (t) {
        if (tIds.indexOf(t) === -1) err('Сектор ' + s.id + ': несуществующее задание ' + t);
        else if (idxTask(d, t).sectorId !== s.id) err('Задание ' + t + ' относится к другому сектору.');
      });
      (s.discoveries || []).forEach(function (x) { if (dIds.indexOf(x) === -1) err('Сектор ' + s.id + ': несуществующее открытие ' + x); });
      var req = (s.taskIds || []).filter(function (t) { var tk = idxTask(d, t); return tk && !tk.extra; });
      if (req.length < 1) err('Сектор ' + s.id + ': нет обязательных заданий.');
      sectorTasks[s.id] = true;
    });
    d.tasks.forEach(function (t) {
      if (sIds.indexOf(t.sectorId) === -1) err('Задание ' + t.id + ': несуществующий сектор ' + t.sectorId);
      else if ((idxSector(d, t.sectorId).taskIds || []).indexOf(t.id) === -1) err('Задание ' + t.id + ' не включено в список заданий сектора.');
      if (!t.hint) err('Задание ' + t.id + ': нет подсказки.');
      if (!t.explanation) err('Задание ' + t.id + ': нет объяснения.');
      if (!t.question) err('Задание ' + t.id + ': нет вопроса.');
      if (t.type === 'map_click') {
        var zones = ((t.diagram && t.diagram.items) || []).filter(function (i) { return i.t === 'zone'; }).map(function (i) { return i.id; });
        if (zones.length < 2) err('Задание ' + t.id + ': на карте-схеме меньше двух областей.');
        if (zones.indexOf(t.correctZone) === -1) err('Задание ' + t.id + ': правильная область не найдена на схеме.');
      } else if (['multiple_choice', 'identify', 'analysis'].indexOf(t.type) !== -1) {
        if (!Array.isArray(t.options) || t.options.length < 2) err('Задание ' + t.id + ': меньше двух вариантов ответа.');
        else if (typeof t.correctAnswer !== 'number' || t.correctAnswer < 0 || t.correctAnswer >= t.options.length) err('Задание ' + t.id + ': неверный индекс правильного ответа.');
      } else err('Задание ' + t.id + ': неизвестный тип «' + t.type + '».');
    });
    d.discoveries.forEach(function (x) {
      (x.sectors || []).forEach(function (s) { if (sIds.indexOf(s) === -1) err('Открытие ' + x.id + ': несуществующий сектор ' + s); });
      if (!x.name || !x.short || !x.long) err('Открытие ' + x.id + ': не хватает текста.');
    });
    // достижимость: сектор достижим, если достижимы все его условия
    var chapters = d.world.chapters || [];
    var starts = [d.world.planet.startSector];
    chapters.forEach(function (c) {
      if (starts.indexOf(c.startSector) === -1) starts.push(c.startSector);
      if (sIds.indexOf(c.startSector) === -1) err('Глава ' + c.id + ': стартовый сектор ' + c.startSector + ' не найден.');
    });
    var chIds = chapters.map(function (c) { return c.id; });
    d.sectors.forEach(function (s) {
      if (chIds.length && chIds.indexOf(s.chapter || 1) === -1) err('Сектор ' + s.id + ': неизвестная глава ' + s.chapter + '.');
    });
    d.world.achievements.forEach(function (a) {
      if (chIds.length && chIds.indexOf(a.chapter || 1) === -1) err('Достижение ' + a.id + ': неизвестная глава ' + a.chapter + '.');
    });
    var reach = {};
    starts.forEach(function (st) { if (sIds.indexOf(st) === -1) err('Стартовый сектор не найден: ' + st + '.'); reach[st] = true; });
    var changed = true;
    while (changed) {
      changed = false;
      d.sectors.forEach(function (s) {
        if (!reach[s.id] && (s.requires || []).length && s.requires.every(function (r) { return reach[r]; })) { reach[s.id] = true; changed = true; }
      });
    }
    d.sectors.forEach(function (s) { if (!reach[s.id]) err('Сектор ' + s.id + ' недостижим (циклическое или невыполнимое условие).'); });
    (d.world.achievements || []).forEach(function (a) {
      if (a.condition && a.condition.sector && sIds.indexOf(a.condition.sector) === -1) err('Достижение ' + a.id + ': несуществующий сектор.');
    });
    return errors;
  }
  function idxTask(d, id) { return d.tasks.filter(function (t) { return t.id === id; })[0]; }
  function idxSector(d, id) { return d.sectors.filter(function (s) { return s.id === id; })[0]; }

  function init(d) {
    data = d;
    idx = { sectors: {}, tasks: {}, discoveries: {}, achievements: {} };
    d.sectors.forEach(function (s) { idx.sectors[s.id] = s; });
    d.tasks.forEach(function (t) { idx.tasks[t.id] = t; });
    d.discoveries.forEach(function (x) { idx.discoveries[x.id] = x; });
    d.world.achievements.forEach(function (a) { idx.achievements[a.id] = a; });
  }

  function ids() {
    return {
      sectors: data.sectors.map(function (s) { return s.id; }),
      tasks: data.tasks.map(function (t) { return t.id; }),
      discoveries: data.discoveries.map(function (x) { return x.id; }),
      achievements: data.world.achievements.map(function (a) { return a.id; })
    };
  }

  /* ---------- Состояние ---------- */
  function setState(s) {
    state = s;
    // стартовый сектор всегда обнаружен; пересчитываем зависимости (на случай импорта)
    var p = state.progress;
    recomputeDiscovered();
    // фиксируем «полностью изученные» по фактическим заданиям
    data.sectors.forEach(function (sec) {
      if (allDone(sec.id) && p.fullyExploredSectors.indexOf(sec.id) === -1) p.fullyExploredSectors.push(sec.id);
    });
    // выдаём пропущенные открытия исследованных секторов
    data.sectors.forEach(function (sec) {
      if (isExplored(sec.id)) (sec.discoveries || []).forEach(function (d) { if (p.discoveryIds.indexOf(d) === -1) p.discoveryIds.push(d); });
    });
  }
  function getState() { return state; }

  function has(arr, x) { return arr.indexOf(x) !== -1; }
  function tasksOf(sectorId, extra) {
    return (idx.sectors[sectorId].taskIds || []).map(function (t) { return idx.tasks[t]; }).filter(function (t) { return !!t.extra === !!extra; });
  }
  function isDone(taskId) { return has(state.progress.completedTasks, taskId); }
  function doneCount(sectorId) {
    return (idx.sectors[sectorId].taskIds || []).filter(isDone).length;
  }
  function requiredDone(sectorId) {
    var req = tasksOf(sectorId, false);
    return req.filter(function (t) { return isDone(t.id); }).length;
  }
  function isExplored(sectorId) {
    var req = tasksOf(sectorId, false);
    return req.length > 0 && req.every(function (t) { return isDone(t.id); });
  }
  function allDone(sectorId) {
    var all = idx.sectors[sectorId].taskIds || [];
    return all.length > 0 && all.every(isDone);
  }
  function isDiscovered(sectorId) { return has(state.progress.discoveredSectors, sectorId); }

  /** hidden | discovered | exploring | explored | full */
  function sectorStatus(sectorId) {
    if (!isDiscovered(sectorId)) return 'hidden';
    if (has(state.progress.fullyExploredSectors, sectorId) || allDone(sectorId)) return 'full';
    if (isExplored(sectorId)) return 'explored';
    if (doneCount(sectorId) > 0) return 'exploring';
    return 'discovered';
  }

  function chapterOf(s) { return s.chapter || 1; }
  function chapterList() {
    var l = (data.world.chapters || []).slice();
    if (!l.length) l = [{ id: 1, startSector: data.world.planet.startSector }];
    return l;
  }
  /** Данные главы; для главы 1 недостающие поля берутся из world.json. */
  function chapterInfo(n) {
    var c = chapterList().filter(function (x) { return x.id === n; })[0] || chapterList()[0];
    var w = data.world, o = {};
    for (var k in c) if (Object.prototype.hasOwnProperty.call(c, k)) o[k] = c[k];
    if (o.id === 1) {
      o.title = o.title || 'Глава 1. Планета X-01';
      o.mission = o.mission || w.mission; o.intro = o.intro || w.intro; o.knownFacts = o.knownFacts || w.knownFacts;
      o.map = o.map || { mapWidth: w.planet.mapWidth, mapHeight: w.planet.mapHeight, caption: w.planet.title + ' · схема дистанционного сканирования', oceanLabel: 'ОКЕАН', ariaLabel: 'Карта планеты X-01', compass: [930, 70] };
    }
    return o;
  }
  function sectorsOf(n) { return data.sectors.filter(function (s) { return chapterOf(s) === n; }); }
  function chapterExplored(n) {
    var l = sectorsOf(n);
    return l.length > 0 && l.every(function (s) { return isExplored(s.id); });
  }
  /** Стартовый сектор главы доступен сразу, если у главы нет условия requiresChapter. */
  function chapterUnlocked(n) {
    var c = chapterInfo(n);
    return !c.requiresChapter || chapterExplored(c.requiresChapter);
  }

  function recomputeDiscovered() {
    var out = [], changed = true;
    chapterList().forEach(function (c) {
      if (chapterUnlocked(c.id) && !isDiscovered(c.startSector)) { state.progress.discoveredSectors.push(c.startSector); out.push(c.startSector); }
    });
    while (changed) {
      changed = false;
      data.sectors.forEach(function (s) {
        if (isDiscovered(s.id)) return;
        var reqs = s.requires || [];
        if (reqs.length && reqs.every(isExplored)) {
          state.progress.discoveredSectors.push(s.id); out.push(s.id); changed = true;
        }
      });
    }
    return out;
  }

  function addJournal(kind, text) {
    state.journal.push({ t: new Date().toISOString(), text: text, kind: kind });
    if (state.journal.length > 30) state.journal = state.journal.slice(-30);
  }
  function fmt(tpl, vars) {
    return tpl.replace(/\{(\w+)\}/g, function (m, k) { return vars[k] != null ? vars[k] : m; });
  }

  /** Статистика: по одной главе (n) или по всей игре (без аргумента). Очки общие. */
  function stats(n) {
    var p = state.progress;
    var secs = n ? sectorsOf(n) : data.sectors;
    var inCh = function (id) { return !!idx.sectors[id] && (!n || chapterOf(idx.sectors[id]) === n); };
    var dIds = {};
    secs.forEach(function (s) { (s.discoveries || []).forEach(function (d) { dIds[d] = true; }); });
    return {
      explored: secs.filter(function (s) { return isExplored(s.id); }).length,
      total: secs.length,
      tasks: p.completedTasks.filter(function (t) { return idx.tasks[t] && inCh(idx.tasks[t].sectorId); }).length,
      totalTasks: data.tasks.filter(function (t) { return inCh(t.sectorId); }).length,
      points: p.researchPoints,
      discoveries: p.discoveryIds.filter(function (d) { return !n || dIds[d]; }).length,
      totalDiscoveries: n ? Object.keys(dIds).length : data.discoveries.length,
      full: secs.filter(function (s) { return has(p.fullyExploredSectors, s.id); }).length
    };
  }

  function topicCount(topic) {
    return state.progress.completedTasks.filter(function (id) { return idx.tasks[id] && idx.tasks[id].topic === topic; }).length;
  }

  function conditionMet(c, ch) {
    var st = stats(ch || 1);
    switch (c.type) {
      case 'sectorExplored': return isExplored(c.sector);
      case 'exploredCount': return st.explored >= c.n;
      case 'topicTasks': return topicCount(c.topic) >= c.n;
      case 'discoveryCount': return st.discoveries >= c.n;
      case 'fullCount': return st.full >= c.n;
      default: return false;
    }
  }

  function taskReward(t) {
    var pts = data.world.points;
    if (t.extra) return pts.extra;
    return t.complex ? pts.complex : pts.normal;
  }

  /** Проверка ответа. answer: индекс в исходном массиве options либо id области. */
  function checkAnswer(t, answer) {
    if (t.type === 'map_click') return answer === t.correctZone;
    return answer === t.correctAnswer;
  }

  function canStartTask(t) {
    var sec = idx.sectors[t.sectorId];
    if (!isDiscovered(sec.id)) return false;
    if (t.extra && !isExplored(sec.id)) return false;
    return true;
  }

  /**
   * Засчитывает успешное решение. Повторное решение не даёт очков.
   * Возвращает описание последствий для интерфейса.
   */
  function completeTask(taskId) {
    var t = idx.tasks[taskId];
    var p = state.progress;
    var res = { taskId: taskId, repeat: false, points: 0, newSectors: [], explored: false, full: false, newDiscoveries: [], newAchievements: [], entries: [] };
    if (!t) return res;
    if (isDone(taskId)) { res.repeat = true; return res; }
    var sec = idx.sectors[t.sectorId];
    var wasExplored = isExplored(sec.id);
    p.completedTasks.push(taskId);
    res.points = taskReward(t);
    p.researchPoints += res.points;
    var ev = data.events, vars = { name: sec.name, title: t.title, journal: sec.journal || '' };

    if (!wasExplored && isExplored(sec.id)) {
      res.explored = true;
      addJournal('explore', fmt(ev.sectorExplored, vars));
      (sec.discoveries || []).forEach(function (d) {
        if (!has(p.discoveryIds, d)) {
          p.discoveryIds.push(d); res.newDiscoveries.push(d);
          addJournal('discovery', fmt(ev.discovery, { name: idx.discoveries[d].name }));
        }
      });
      recomputeDiscovered().forEach(function (sid) {
        res.newSectors.push(sid);
        addJournal('new', fmt(ev.sectorDiscovered, { name: idx.sectors[sid].name }));
      });
    }
    if (allDone(sec.id) && !has(p.fullyExploredSectors, sec.id)) {
      p.fullyExploredSectors.push(sec.id); res.full = true;
      addJournal('full', fmt(ev.sectorFull, vars));
    }
    // достижения (цикл на случай цепочки)
    data.world.achievements.forEach(function (a) {
      if (!has(p.achievementIds, a.id) && conditionMet(a.condition, a.chapter || 1)) {
        p.achievementIds.push(a.id); res.newAchievements.push(a.id);
        addJournal('achievement', fmt(ev.achievement, { name: a.name }));
      }
    });
    if (!res.explored && !res.full) addJournal('task', fmt(ev.taskDone, vars));
    return res;
  }

  function markIntroSeen() { state.progress.introSeen = true; }

  function newGame() {
    var s = TI.Storage.newState();
    setState(s);
    addJournal('info', data.events.gameStart);
    return state;
  }

  function nextTask(sectorId) {
    var list = tasksOf(sectorId, false).concat(tasksOf(sectorId, true));
    for (var i = 0; i < list.length; i++) if (!isDone(list[i].id) && canStartTask(list[i])) return list[i];
    return null;
  }

  function allExplored(n) { var st = stats(n || 1); return st.total > 0 && st.explored === st.total; }

  /* Вступление и финал: для главы 1 используются прежние поля, для остальных — списки номеров глав. */
  function introSeen(n) { var p = state.progress; return n === 1 ? !!p.introSeen : has(p.introChapters, n); }
  function markIntro(n) { var p = state.progress; if (n === 1) p.introSeen = true; else if (!has(p.introChapters, n)) p.introChapters.push(n); }
  function finaleShown(n) { var p = state.progress; return n === 1 ? !!p.finaleShown : has(p.finaleChapters, n); }
  function markFinale(n) { var p = state.progress; if (n === 1) p.finaleShown = true; else if (!has(p.finaleChapters, n)) p.finaleChapters.push(n); }
  function getChapter() { var c = state.progress.chapter; return chapterList().some(function (x) { return x.id === c; }) ? c : 1; }
  function setChapter(n) { state.progress.chapter = n; }

  TI.Game = {
    validateData: validateData, init: init, ids: ids,
    setState: setState, getState: getState, newGame: newGame,
    get data() { return data; },
    sector: function (id) { return idx.sectors[id]; },
    task: function (id) { return idx.tasks[id]; },
    discovery: function (id) { return idx.discoveries[id]; },
    achievement: function (id) { return idx.achievements[id]; },
    tasksOf: tasksOf, isDone: isDone, doneCount: doneCount, requiredDone: requiredDone,
    isExplored: isExplored, isDiscovered: isDiscovered, sectorStatus: sectorStatus,
    stats: stats, checkAnswer: checkAnswer, completeTask: completeTask, taskReward: taskReward,
    canStartTask: canStartTask, nextTask: nextTask, markIntroSeen: markIntroSeen,
    addJournal: addJournal, allExplored: allExplored,
    chapters: chapterList, chapter: chapterInfo, sectorsOf: sectorsOf, chapterOf: chapterOf,
    chapterExplored: chapterExplored, chapterUnlocked: chapterUnlocked,
    introSeen: introSeen, markIntro: markIntro, finaleShown: finaleShown, markFinale: markFinale,
    getChapter: getChapter, setChapter: setChapter
  };
})(window.TI = window.TI || {});
