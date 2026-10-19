/* TERRA INCOGNITA — экран задания: четыре типа, подсказки, проверка, объяснения */
(function (TI) {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var TYPE_LABEL = {
    multiple_choice: 'Вопрос с вариантами ответа',
    identify: 'Определи объект',
    analysis: 'Географический анализ',
    map_click: 'Задание на карте'
  };
  var TOPIC_LABEL = { orientation: 'Ориентирование', relief: 'Рельеф', climate: 'Климат', water: 'Воды' };

  function h(tag, attrs, children) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) {
      if (k === 'class') e.className = attrs[k];
      else if (k === 'text') e.textContent = attrs[k];
      else e.setAttribute(k, attrs[k]);
    }
    (children || []).forEach(function (c) { if (c) e.appendChild(c); });
    return e;
  }
  function s(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  function wrapText(str, maxChars) {
    var words = String(str).split(' '), lines = [], cur = '';
    words.forEach(function (w) {
      if (!cur) cur = w;
      else if ((cur + ' ' + w).length <= maxChars) cur += ' ' + w;
      else { lines.push(cur); cur = w; }
    });
    if (cur) lines.push(cur);
    return lines;
  }

  function putText(parent, str, cx, cy, w, cls) {
    var longest = Math.max.apply(null, String(str).split(' ').map(function (x) { return x.length; }));
    var fs = Math.max(8, Math.min(11.5, (w - 6) / (longest * 0.6)));
    var lines = wrapText(str, Math.max(4, Math.floor((w - 6) / (fs * 0.58))));
    var t = s('text', { 'class': cls || 'dz-label', 'text-anchor': 'middle', 'font-size': fs, x: cx }, parent);
    var lh = fs * 1.2, y0 = cy - ((lines.length - 1) * lh) / 2 + fs * 0.35;
    lines.forEach(function (ln, i) {
      var ts = s('tspan', { x: cx, y: y0 + i * lh }, t);
      ts.textContent = ln;
    });
    return t;
  }

  /** Схема задания. onZone(id) вызывается при выборе области (если interactive). */
  function drawDiagram(d, interactive, onZone) {
    var svg = s('svg', { viewBox: d.viewBox || '0 0 300 180', 'class': 'diagram', role: 'img', preserveAspectRatio: 'xMidYMid meet' });
    var desc = [];
    var defs = s('defs', null, svg);
    var m = s('marker', { id: 'arrowhead', viewBox: '0 0 10 10', refX: '8', refY: '5', markerWidth: '7', markerHeight: '7', orient: 'auto-start-reverse' }, defs);
    s('path', { d: 'M0 0 L10 5 L0 10 z', fill: '#e8f1f5' }, m);
    var zones = {};
    d.items.forEach(function (it) {
      var c = 'd-' + (it.c || 'land');
      if (it.t === 'rect') {
        s('rect', { x: it.x, y: it.y, width: it.w, height: it.h, 'class': c }, svg);
      } else if (it.t === 'poly') {
        s('polygon', { points: it.pts, 'class': c + ' d-poly' }, svg);
      }
    });
    d.items.forEach(function (it) {
      var c = 'd-' + (it.c || 'land');
      if (it.t === 'zone') {
        var g = s('g', { 'class': 'dz ' + c + (interactive ? ' dz-active' : ''), 'data-zone': it.id }, svg);
        s('rect', { x: it.x, y: it.y, width: it.w, height: it.h, rx: 3 }, g);
        putText(g, it.label, it.x + it.w / 2, it.y + it.h / 2, it.w);
        desc.push(it.label);
        zones[it.id] = g;
        if (interactive) {
          g.setAttribute('role', 'radio'); g.setAttribute('tabindex', '0'); g.setAttribute('aria-checked', 'false');
          g.setAttribute('aria-label', it.label);
          g.addEventListener('click', function () { onZone(it.id); });
          g.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onZone(it.id); } });
        }
      } else if (it.t === 'arrow') {
        s('line', { x1: it.x1, y1: it.y1, x2: it.x2, y2: it.y2, 'class': 'd-arrow', 'marker-end': 'url(#arrowhead)' }, svg);
        if (it.label) {
          var mx = (it.x1 + it.x2) / 2, my = (it.y1 + it.y2) / 2;
          var vertical = Math.abs(it.y2 - it.y1) > Math.abs(it.x2 - it.x1);
          var tt = s('text', { 'class': 'd-text d-halo', x: vertical ? mx + 6 : mx, y: vertical ? my : my - 7, 'text-anchor': vertical ? 'start' : 'middle' }, svg);
          tt.textContent = it.label; desc.push(it.label);
        }
      } else if (it.t === 'dot') {
        s('circle', { cx: it.x, cy: it.y, r: 4.5, 'class': 'd-dot' }, svg);
        var dt = s('text', { 'class': 'd-text d-halo', x: it.x, y: it.y - 9, 'text-anchor': 'middle' }, svg);
        dt.textContent = it.label; desc.push(it.label);
      } else if (it.t === 'text') {
        var tx = s('text', { 'class': 'd-text d-halo d-caption', x: it.x, y: it.y, 'text-anchor': 'middle' }, svg);
        tx.textContent = it.s; desc.push(it.s);
      }
    });
    if (d.compass) {
      var cg = s('g', { 'class': 'd-compass', transform: 'translate(278 22)' }, svg);
      s('line', { x1: 0, y1: 12, x2: 0, y2: -10, 'class': 'd-arrow', 'marker-end': 'url(#arrowhead)' }, cg);
      var ct = s('text', { x: 0, y: -14, 'text-anchor': 'middle', 'class': 'd-text d-halo' }, cg); ct.textContent = 'С';
      var cl = s('text', { x: -14, y: 4, 'text-anchor': 'middle', 'class': 'd-text d-halo' }, cg); cl.textContent = 'З';
      var cr = s('text', { x: 14, y: 4, 'text-anchor': 'middle', 'class': 'd-text d-halo' }, cg); cr.textContent = 'В';
      var cs = s('text', { x: 0, y: 24, 'text-anchor': 'middle', 'class': 'd-text d-halo' }, cg); cs.textContent = 'Ю';
    }
    svg.setAttribute('aria-label', 'Схема. Север вверху, восток справа. ' + desc.join('; '));
    return { svg: svg, zones: zones };
  }

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  /**
   * Рисует задание в контейнере.
   * handlers: { complete(task) -> result, ui: {sound(name)}, onFinish(result|null), isRepeat: bool }
   */
  function render(container, task, sector, handlers) {
    var selected = null, hintShown = false, answered = false;
    var order = null; // перемешанный порядок вариантов
    var root = h('div', { 'class': 'task' });
    container.innerHTML = '';
    container.appendChild(root);

    function build() {
      root.innerHTML = '';
      selected = null; answered = false;
      var repeat = TI.Game.isDone(task.id);
      var meta = h('div', { 'class': 'task-meta' }, [
        h('span', { 'class': 'tag', text: sector.name }),
        h('span', { 'class': 'tag tag-type', text: TYPE_LABEL[task.type] }),
        h('span', { 'class': 'tag', text: TOPIC_LABEL[task.topic] || 'География' }),
        h('span', { 'class': 'tag tag-pts', text: task.extra ? 'Дополнительное' : (task.complex ? 'Комплексное' : 'Обычное') + '' })
      ]);
      root.appendChild(meta);
      root.appendChild(h('h2', { 'class': 'task-title', id: 'task-title', text: task.title }));
      root.appendChild(h('p', { 'class': 'task-situation', text: task.description }));
      if (repeat) root.appendChild(h('p', { 'class': 'note', text: 'Это задание уже выполнено. Очки за повторное решение не начисляются.' }));

      var zoneApi = null;
      var interactive = task.type === 'map_click';
      var answerWrap;
      if (task.diagram) {
        var fig = h('figure', { 'class': 'task-figure' });
        zoneApi = drawDiagram(task.diagram, interactive, function (id) {
          if (answered) return;
          selected = id;
          Object.keys(zoneApi.zones).forEach(function (k) {
            zoneApi.zones[k].classList.toggle('selected', k === id);
            zoneApi.zones[k].setAttribute('aria-checked', k === id ? 'true' : 'false');
          });
          submit.disabled = false;
          live.textContent = 'Выбрано: ' + (task.diagram.items.filter(function (i) { return i.id === id; })[0] || {}).label;
        });
        fig.appendChild(zoneApi.svg);
        root.appendChild(fig);
      }
      root.appendChild(h('p', { 'class': 'task-question', text: task.question }));
      var live = h('div', { 'class': 'sr-only', 'aria-live': 'polite' });
      root.appendChild(live);

      var inputs = [];
      if (!interactive) {
        order = shuffle(task.options.map(function (_, i) { return i; }));
        answerWrap = h('fieldset', { 'class': 'options' }, [h('legend', { 'class': 'sr-only', text: 'Варианты ответа' })]);
        order.forEach(function (orig, pos) {
          var id = 'opt-' + task.id + '-' + pos;
          var inp = h('input', { type: 'radio', name: 'answer', id: id, value: String(orig) });
          var lab = h('label', { 'class': 'option', 'for': id }, [
            inp, h('span', { 'class': 'option-mark', text: String.fromCharCode(1040 + pos) }), h('span', { 'class': 'option-text', text: task.options[orig] })
          ]);
          inp.addEventListener('change', function () { selected = orig; submit.disabled = false; });
          inputs.push({ inp: inp, lab: lab, orig: orig });
          answerWrap.appendChild(lab);
        });
        root.appendChild(answerWrap);
      } else {
        root.appendChild(h('p', { 'class': 'note', text: 'Нажми на нужную область схемы, затем «Ответить».' }));
      }

      var hintBox = h('div', { 'class': 'hint', hidden: 'hidden', role: 'note' });
      var hintBtn = h('button', { type: 'button', 'class': 'btn btn-ghost', text: 'Подсказка' });
      var submit = h('button', { type: 'button', 'class': 'btn btn-primary', text: 'Ответить', disabled: 'disabled' });
      var actions = h('div', { 'class': 'task-actions' }, [hintBtn, submit]);
      root.appendChild(hintBox);
      root.appendChild(actions);
      var result = h('div', { 'class': 'result', 'aria-live': 'polite' });
      root.appendChild(result);

      hintBtn.addEventListener('click', function () {
        hintShown = true;
        hintBox.textContent = 'Подсказка: ' + task.hint;
        hintBox.hidden = false;
        hintBtn.disabled = true;
      });
      if (hintShown) { hintBox.textContent = 'Подсказка: ' + task.hint; hintBox.hidden = false; hintBtn.disabled = true; }

      submit.addEventListener('click', function () {
        if (selected === null || answered) return;
        answered = true;
        var ok = TI.Game.checkAnswer(task, selected);
        submit.disabled = true; hintBtn.disabled = true;
        inputs.forEach(function (o) {
          o.inp.disabled = true;
          if (o.orig === selected) o.lab.classList.add(ok ? 'is-correct' : 'is-wrong');
          if (!ok && o.orig === task.correctAnswer) o.lab.classList.add('is-right-answer');
        });
        if (zoneApi) {
          Object.keys(zoneApi.zones).forEach(function (k) {
            var z = zoneApi.zones[k];
            if (k === selected) z.classList.add(ok ? 'is-correct' : 'is-wrong');
            if (!ok && k === task.correctZone) z.classList.add('is-right-answer');
            z.removeAttribute('tabindex');
          });
        }
        showResult(ok, result, actions, submit, hintBtn);
      });
    }

    function correctText() {
      if (task.type === 'map_click') {
        var z = task.diagram.items.filter(function (i) { return i.id === task.correctZone; })[0];
        return z ? z.label : '';
      }
      return task.options[task.correctAnswer];
    }

    function showResult(ok, result, actions) {
      result.innerHTML = '';
      result.className = 'result ' + (ok ? 'result-ok' : 'result-bad');
      handlers.sound(ok ? 'ok' : 'bad');
      var head = h('p', { 'class': 'result-head' }, [
        h('span', { 'class': 'result-icon', 'aria-hidden': 'true', text: ok ? '✓' : '✕' }),
        h('span', { text: ok ? 'Верно!' : 'Пока неверно.' })
      ]);
      result.appendChild(head);
      if (!ok) result.appendChild(h('p', { 'class': 'result-answer' }, [h('strong', { text: 'Правильный ответ: ' }), document.createTextNode(correctText())]));
      result.appendChild(h('p', { 'class': 'result-expl', text: task.explanation }));

      var res = null;
      var buttons = h('div', { 'class': 'task-actions' });
      if (ok) {
        res = handlers.complete(task);
        result.appendChild(rewardBlock(res));
        var go = h('button', { type: 'button', 'class': 'btn btn-primary', text: 'Продолжить исследование' });
        go.addEventListener('click', function () { handlers.onFinish(res); });
        buttons.appendChild(go);
      } else {
        var retry = h('button', { type: 'button', 'class': 'btn btn-primary', text: 'Повторить задание' });
        retry.addEventListener('click', function () { build(); var t = root.querySelector('.task-title'); if (t) t.scrollIntoView({ block: 'start' }); focusFirst(); });
        var close = h('button', { type: 'button', 'class': 'btn btn-ghost', text: 'Вернуться на карту' });
        close.addEventListener('click', function () { handlers.onFinish(null); });
        buttons.appendChild(retry); buttons.appendChild(close);
      }
      result.appendChild(buttons);
      actions.hidden = true;
      var first = buttons.querySelector('button'); if (first) first.focus();
      result.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    }

    function rewardBlock(res) {
      var box = h('div', { 'class': 'rewards' });
      if (res.repeat) { box.appendChild(h('p', { text: 'Повторное решение: очки не начисляются.' })); return box; }
      box.appendChild(h('p', { 'class': 'reward-line', text: '+' + res.points + ' исследовательских очков' }));
      res.newDiscoveries.forEach(function (d) {
        box.appendChild(h('p', { 'class': 'reward-line' }, [h('strong', { text: 'Открытие: ' }), document.createTextNode(TI.Game.discovery(d).name)]));
      });
      if (res.explored) box.appendChild(h('p', { 'class': 'reward-line', text: 'Сектор «' + sector.name + '» исследован.' }));
      if (res.full) box.appendChild(h('p', { 'class': 'reward-line', text: 'Сектор изучен полностью.' }));
      res.newSectors.forEach(function (sid) {
        box.appendChild(h('p', { 'class': 'reward-line reward-new' }, [h('strong', { text: 'Новая территория: ' }), document.createTextNode(TI.Game.sector(sid).name)]));
      });
      res.newAchievements.forEach(function (a) {
        box.appendChild(h('p', { 'class': 'reward-line' }, [h('strong', { text: 'Достижение: ' }), document.createTextNode(TI.Game.achievement(a).name)]));
      });
      return box;
    }

    function focusFirst() {
      var f = root.querySelector('input[type=radio], .dz-active');
      if (f) f.focus();
    }

    build();
    return { focus: focusFirst };
  }

  TI.Tasks = { render: render, TYPE_LABEL: TYPE_LABEL };
})(window.TI = window.TI || {});
