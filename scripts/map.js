/* TERRA INCOGNITA — SVG-карта планеты */
(function (TI) {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var svg, onSelect, activeId = null, nodes = {}, routeLayer, labelLayer;

  var STATUS_LABEL = {
    hidden: 'Не обнаружена', discovered: 'Обнаружена', exploring: 'Исследуется',
    explored: 'Исследована', full: 'Полностью изучена'
  };
  var GLYPH = { hidden: '?', discovered: '!', exploring: '…', explored: '✓', full: '★' };

  function el(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    if (attrs) for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  function wrapName(name) {
    var words = name.split(' ');
    if (name.length <= 13 || words.length < 2) return [name];
    var best = 0, bestDiff = 1e9;
    for (var i = 1; i < words.length; i++) {
      var a = words.slice(0, i).join(' ').length, b = words.slice(i).join(' ').length;
      if (Math.abs(a - b) < bestDiff) { bestDiff = Math.abs(a - b); best = i; }
    }
    return [words.slice(0, best).join(' '), words.slice(best).join(' ')];
  }

  function buildStatic(world) {
    var defs = el('defs', null, svg);
    var g = el('linearGradient', { id: 'oceanGrad', x1: '0', y1: '0', x2: '0', y2: '1' }, defs);
    el('stop', { offset: '0', 'stop-color': '#0b2038' }, g);
    el('stop', { offset: '1', 'stop-color': '#071626' }, g);
    var pHatch = el('pattern', { id: 'pat-hatch', width: '10', height: '10', patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
    el('rect', { width: '10', height: '10', fill: '#13304a' }, pHatch);
    el('line', { x1: '0', y1: '0', x2: '0', y2: '10', stroke: '#2a6f86', 'stroke-width': '3' }, pHatch);
    var pDots = el('pattern', { id: 'pat-dots', width: '12', height: '12', patternUnits: 'userSpaceOnUse' }, defs);
    el('rect', { width: '12', height: '12', fill: '#1b4a63' }, pDots);
    el('circle', { cx: '6', cy: '6', r: '2.2', fill: '#7fd6d0' }, pDots);
    var pFog = el('pattern', { id: 'pat-fog', width: '14', height: '14', patternUnits: 'userSpaceOnUse' }, defs);
    el('rect', { width: '14', height: '14', fill: '#0c1b2c' }, pFog);
    el('path', { d: 'M0 14 L14 0', stroke: '#16293d', 'stroke-width': '1.5' }, pFog);

    el('rect', { x: '0', y: '0', width: world.planet.mapWidth, height: world.planet.mapHeight, fill: 'url(#oceanGrad)' }, svg);
    var grid = el('g', { 'class': 'graticule', 'aria-hidden': 'true' }, svg);
    for (var x = 100; x < world.planet.mapWidth; x += 100) el('line', { x1: x, y1: 0, x2: x, y2: world.planet.mapHeight }, grid);
    for (var y = 100; y < world.planet.mapHeight; y += 100) el('line', { x1: 0, y1: y, x2: world.planet.mapWidth, y2: y }, grid);
    var t1 = el('text', { x: 28, y: 598, 'class': 'map-caption', 'aria-hidden': 'true' }, svg);
    t1.textContent = world.planet.title + ' · схема дистанционного сканирования';
    var t2 = el('text', { x: 40, y: 330, 'class': 'ocean-label', 'aria-hidden': 'true', transform: 'rotate(-90 40 330)' }, svg);
    t2.textContent = 'ОКЕАН';
    // компас
    var c = el('g', { 'class': 'compass', transform: 'translate(930 70)', 'aria-hidden': 'true' }, svg);
    el('circle', { r: '34' }, c);
    el('path', { d: 'M0 -28 L7 0 L0 28 L-7 0 Z', 'class': 'compass-needle' }, c);
    var n = el('text', { y: '-40', 'text-anchor': 'middle' }, c); n.textContent = 'С';
    var s = el('text', { y: '52', 'text-anchor': 'middle' }, c); s.textContent = 'Ю';
    var e = el('text', { x: '46', y: '5', 'text-anchor': 'middle' }, c); e.textContent = 'В';
    var w = el('text', { x: '-46', y: '5', 'text-anchor': 'middle' }, c); w.textContent = 'З';
  }

  function init(container, world, sectors, selectCb) {
    onSelect = selectCb;
    container.innerHTML = '';
    svg = el('svg', {
      viewBox: '0 0 ' + world.planet.mapWidth + ' ' + world.planet.mapHeight,
      role: 'group', 'aria-label': 'Карта планеты X-01', 'class': 'planet-map', preserveAspectRatio: 'xMidYMid meet'
    });
    container.appendChild(svg);
    buildStatic(world);
    nodes = {};
    routeLayer = el('g', { 'class': 'routes', 'aria-hidden': 'true' }, svg);
    labelLayer = el('g', { 'class': 'labels', 'aria-hidden': 'true' }, svg);
    sectors.forEach(function (s) {
      var g = el('g', { 'class': 'sector', 'data-id': s.id, 'data-type': s.type }, svg);
      var poly = el('polygon', { points: s.poly, 'class': 'sector-shape' }, g);
      var tl = el('title', null, g);
      var badge = el('g', { 'class': 'badge', transform: 'translate(' + s.center[0] + ' ' + (s.center[1] - 14) + ')' }, labelLayer);
      el('circle', { r: '17' }, badge);
      var gl = el('text', { 'class': 'badge-glyph', 'text-anchor': 'middle', y: '7' }, badge);
      var label = el('text', { 'class': 'sector-name', 'text-anchor': 'middle', x: s.center[0], y: s.center[1] + 28 }, labelLayer);
      nodes[s.id] = { g: g, poly: poly, title: tl, glyph: gl, label: label, badge: badge, s: s };
      svg.insertBefore(g, routeLayer);
      g.addEventListener('click', function () { if (g.getAttribute('data-status') !== 'hidden') onSelect(s.id); });
      g.addEventListener('keydown', function (ev) {
        if ((ev.key === 'Enter' || ev.key === ' ') && g.getAttribute('data-status') !== 'hidden') { ev.preventDefault(); onSelect(s.id); }
      });
    });
  }

  function renderLabel(n, show) {
    while (n.label.firstChild) n.label.removeChild(n.label.firstChild);
    if (!show) return;
    var lines = wrapName(n.s.name);
    lines.forEach(function (ln, i) {
      var ts = el('tspan', { x: n.s.center[0], dy: i === 0 ? '0' : '19' }, n.label);
      ts.textContent = ln;
    });
  }

  function render(getStatus, newIds) {
    newIds = newIds || [];
    for (var id in nodes) {
      if (!Object.prototype.hasOwnProperty.call(nodes, id)) continue;
      var n = nodes[id], st = getStatus(id);
      n.g.setAttribute('data-status', st);
      n.badge.setAttribute('data-status', st); n.label.setAttribute('data-status', st);
      n.g.classList.toggle('active', id === activeId);
      n.glyph.textContent = GLYPH[st];
      var visible = st !== 'hidden';
      renderLabel(n, visible);
      if (visible) {
        n.g.setAttribute('role', 'button'); n.g.setAttribute('tabindex', '0'); n.g.removeAttribute('aria-hidden');
        n.g.setAttribute('aria-label', n.s.name + '. ' + STATUS_LABEL[st] + '.');
        n.title.textContent = n.s.name + ' — ' + STATUS_LABEL[st];
        n.g.setAttribute('aria-pressed', id === activeId ? 'true' : 'false');
      } else {
        n.g.removeAttribute('role'); n.g.removeAttribute('tabindex'); n.g.removeAttribute('aria-pressed');
        n.g.setAttribute('aria-hidden', 'true'); n.g.removeAttribute('aria-label');
        n.title.textContent = '';
      }
      if (newIds.indexOf(id) !== -1) {
        n.g.classList.remove('reveal'); void n.g.getBoundingClientRect(); n.g.classList.add('reveal');
      }
    }
    // маршруты между обнаруженными секторами
    while (routeLayer.firstChild) routeLayer.removeChild(routeLayer.firstChild);
    for (var sid in nodes) {
      if (!Object.prototype.hasOwnProperty.call(nodes, sid)) continue;
      var sec = nodes[sid].s;
      if (getStatus(sid) === 'hidden') continue;
      (sec.requires || []).forEach(function (r) {
        var from = nodes[r].s;
        var done = getStatus(r) === 'explored' || getStatus(r) === 'full';
        var line = el('line', {
          x1: from.center[0], y1: from.center[1], x2: sec.center[0], y2: sec.center[1],
          'class': 'route' + (done ? ' route-open' : '') + (newIds.indexOf(sec.id) !== -1 ? ' route-new' : '')
        }, routeLayer);
        if (!line) return;
      });
    }
  }

  function setActive(id) {
    activeId = id;
    for (var k in nodes) if (Object.prototype.hasOwnProperty.call(nodes, k)) {
      nodes[k].g.classList.toggle('active', k === id);
      if (nodes[k].g.getAttribute('role')) nodes[k].g.setAttribute('aria-pressed', k === id ? 'true' : 'false');
    }
    // активный сектор рисуем поверх соседей
    if (id && nodes[id]) {
      svg.insertBefore(nodes[id].g, routeLayer);
      // на узком экране карта прокручивается внутри рамки: показываем выбранный сектор
      var box = svg.parentNode, vb = svg.viewBox.baseVal;
      if (box && box.scrollWidth > box.clientWidth + 4) {
        var x = nodes[id].s.center[0] / vb.width * box.scrollWidth;
        box.scrollLeft = Math.max(0, x - box.clientWidth / 2);
      }
    }
  }

  function focusSector(id) { if (nodes[id]) nodes[id].g.focus(); }

  TI.Map = { init: init, render: render, setActive: setActive, focusSector: focusSector, STATUS_LABEL: STATUS_LABEL, GLYPH: GLYPH };
})(window.TI = window.TI || {});
