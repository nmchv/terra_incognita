/* TERRA INCOGNITA — общие элементы интерфейса: окна, уведомления, звук */
(function (TI) {
  'use strict';

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

  var stack = [];
  var FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

  /**
   * Модальное окно. opts: {title, content: Node, className, dismissible (по умолчанию true), closeLabel}
   * Возвращает {close(), el, body}
   */
  function modal(opts) {
    var opener = document.activeElement;
    clearToasts(); // уведомления не должны закрывать кнопки окна; всё важное есть в журнале
    var dismissible = opts.dismissible !== false;
    var overlay = h('div', { 'class': 'overlay' });
    var titleId = 'modal-title-' + (stack.length + 1) + '-' + Date.now();
    var box = h('div', { 'class': 'modal ' + (opts.className || ''), role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId, tabindex: '-1' });
    var head = h('div', { 'class': 'modal-head' }, [
      h('h2', { id: titleId }, [opts.icon ? h('span', { 'class': 'modal-icon', 'aria-hidden': 'true', text: opts.icon }) : null, document.createTextNode(opts.title || '')])
    ]);
    var closeBtn = null;
    if (dismissible) {
      closeBtn = h('button', { type: 'button', 'class': 'btn btn-ghost modal-close', 'aria-label': 'Закрыть окно', text: 'Закрыть ✕' });
      head.appendChild(closeBtn);
    }
    var body = h('div', { 'class': 'modal-body' });
    if (opts.content) body.appendChild(opts.content);
    box.appendChild(head); box.appendChild(body);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    document.body.classList.add('modal-open');

    var api = { el: box, body: body, closed: false };
    function close() {
      if (api.closed) return;
      api.closed = true;
      var i = stack.indexOf(api); if (i !== -1) stack.splice(i, 1);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      if (!stack.length) document.body.classList.remove('modal-open');
      if (opener && opener.focus && document.body.contains(opener)) { try { opener.focus(); } catch (e) { /* ignore */ } }
      if (opts.onClose) opts.onClose();
    }
    api.close = close;
    api.dismissible = dismissible;
    if (closeBtn) closeBtn.addEventListener('click', close);
    overlay.addEventListener('mousedown', function (ev) { if (ev.target === overlay && dismissible) close(); });
    stack.push(api);
    setTimeout(function () {
      var f = box.querySelector('[data-autofocus]') || box;
      f.focus();
    }, 0);
    return api;
  }

  document.addEventListener('keydown', function (ev) {
    if (!stack.length) return;
    var top = stack[stack.length - 1];
    if (ev.key === 'Escape' && top.dismissible) { ev.preventDefault(); top.close(); return; }
    if (ev.key === 'Tab') {
      var items = Array.prototype.slice.call(top.el.querySelectorAll(FOCUSABLE)).filter(function (n) { return n.offsetParent !== null || n === document.activeElement; });
      if (!items.length) { ev.preventDefault(); top.el.focus(); return; }
      var first = items[0], last = items[items.length - 1];
      if (ev.shiftKey && (document.activeElement === first || document.activeElement === top.el)) { ev.preventDefault(); last.focus(); }
      else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
    }
  });

  /** Окно подтверждения. Возвращает Promise<boolean>. */
  function confirmBox(opts) {
    return new Promise(function (resolve) {
      var done = false;
      var content = h('div', null, [h('p', { 'class': 'modal-text', text: opts.message })]);
      (opts.extra || []).forEach(function (t) { content.appendChild(h('p', { 'class': 'modal-text note', text: t })); });
      var yes = h('button', { type: 'button', 'class': 'btn ' + (opts.danger ? 'btn-danger' : 'btn-primary'), text: opts.confirmLabel || 'Да' });
      var no = h('button', { type: 'button', 'class': 'btn btn-ghost', 'data-autofocus': '1', text: opts.cancelLabel || 'Отмена' });
      content.appendChild(h('div', { 'class': 'task-actions' }, [no, yes]));
      var m = modal({ title: opts.title, content: content, className: 'modal-small', onClose: function () { if (!done) { done = true; resolve(false); } } });
      yes.addEventListener('click', function () { done = true; m.close(); resolve(true); });
      no.addEventListener('click', function () { done = true; m.close(); resolve(false); });
    });
  }

  function alertBox(title, message, extra) {
    var content = h('div', null, [h('p', { 'class': 'modal-text', text: message })]);
    (extra || []).forEach(function (t) { content.appendChild(h('p', { 'class': 'modal-text note', text: t })); });
    var ok = h('button', { type: 'button', 'class': 'btn btn-primary', 'data-autofocus': '1', text: 'Понятно' });
    content.appendChild(h('div', { 'class': 'task-actions' }, [ok]));
    var m = modal({ title: title, content: content, className: 'modal-small' });
    ok.addEventListener('click', m.close);
    return m;
  }

  /* ---------- Уведомления ---------- */
  function clearToasts() { var box = document.getElementById('toasts'); if (box) box.innerHTML = ''; }
  var TOAST_ICON = { info: '📝', 'new': '🧭', ach: '🏆', medal: '🎖️', level: '🚀', star: '⭐' };
  function toast(text, kind) {
    var box = document.getElementById('toasts');
    if (!box) return;
    var t = h('div', { 'class': 'toast toast-' + (kind || 'info') }, [
      h('span', { 'class': 'toast-icon', 'aria-hidden': 'true', text: TOAST_ICON[kind] || TOAST_ICON.info }),
      h('span', { 'class': 'toast-text', text: text })
    ]);
    var x = h('button', { type: 'button', 'class': 'toast-close', 'aria-label': 'Скрыть уведомление', text: '✕' });
    t.appendChild(x);
    box.appendChild(t);
    var timer = setTimeout(remove, 7000);
    function remove() { clearTimeout(timer); if (t.parentNode) t.parentNode.removeChild(t); }
    x.addEventListener('click', remove);
  }

  /* ---------- Звук (WebAudio, без файлов) ---------- */
  var actx = null, soundOn = false;
  function setSound(on) { soundOn = !!on; }
  function sound(name) {
    if (!soundOn) return;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!actx) actx = new AC();
      if (actx.state === 'suspended') actx.resume();
      var SEQ = {
        ok: [[523, 0], [659, 0.1], [784, 0.2]],
        star: [[784, 0], [988, 0.09], [1175, 0.18]],
        'new': [[392, 0], [523, 0.12], [659, 0.24], [880, 0.36]],
        level: [[523, 0], [659, 0.1], [784, 0.2], [1047, 0.32], [1319, 0.46]],
        bad: [[220, 0], [180, 0.12]]
      };
      var seq = SEQ[name] || SEQ.bad;
      var wave = name === 'level' || name === 'star' || name === 'ok' ? 'triangle' : 'sine';
      seq.forEach(function (n) {
        var o = actx.createOscillator(), g = actx.createGain();
        o.type = wave; o.frequency.value = n[0];
        g.gain.setValueAtTime(0.0001, actx.currentTime + n[1]);
        g.gain.exponentialRampToValueAtTime(0.12, actx.currentTime + n[1] + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + n[1] + 0.22);
        o.connect(g); g.connect(actx.destination);
        o.start(actx.currentTime + n[1]); o.stop(actx.currentTime + n[1] + 0.25);
      });
    } catch (e) { /* звук необязателен */ }
  }

  function setAnimations(on) { document.body.classList.toggle('no-anim', !on); }
  function animationsOn() { return !document.body.classList.contains('no-anim') && !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }

  /* ---------- Эффекты: конфетти, баннер, счётчик (не блокируют клики, отключаются вместе с анимациями) ---------- */
  function fxLayer() {
    var box = document.getElementById('fx');
    if (!box) { box = h('div', { id: 'fx', 'class': 'fx', 'aria-hidden': 'true' }); document.body.appendChild(box); }
    return box;
  }
  var CONFETTI_COLORS = ['#ffc83d', '#ff4f9a', '#19c3e6', '#7c3aed', '#22c55e', '#ff8a3d', '#2f80ff'];
  /** opts: {count, x, y} — x, y в долях окна (0..1), по умолчанию верх по центру. */
  function confetti(opts) {
    if (!animationsOn()) return;
    opts = opts || {};
    var box = fxLayer(), n = Math.min(opts.count || 48, 90);
    var ox = (opts.x != null ? opts.x : 0.5) * 100, oy = (opts.y != null ? opts.y : 0.3) * 100;
    for (var i = 0; i < n; i++) {
      var p = h('span', { 'class': 'confetti' + (i % 3 === 0 ? ' confetti-round' : '') });
      var ang = Math.random() * Math.PI * 2, dist = 120 + Math.random() * 320;
      p.style.left = ox + 'vw'; p.style.top = oy + 'vh';
      p.style.setProperty('--dx', Math.round(Math.cos(ang) * dist) + 'px');
      p.style.setProperty('--dy', Math.round(Math.sin(ang) * dist - 140) + 'px');
      p.style.setProperty('--rot', Math.round(Math.random() * 900 - 450) + 'deg');
      p.style.setProperty('--c', CONFETTI_COLORS[i % CONFETTI_COLORS.length]);
      p.style.animationDuration = (1.2 + Math.random() * 1.1).toFixed(2) + 's';
      box.appendChild(p);
      (function (el) { setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 2600); })(p);
    }
  }
  /** Крупная плашка по центру экрана (повышение уровня и т. п.). Сама исчезает, на клики не реагирует. */
  function banner(opts) {
    var box = fxLayer();
    var b = h('div', { 'class': 'banner banner-' + (opts.kind || 'level') }, [
      h('span', { 'class': 'banner-icon', text: opts.icon || '🚀' }),
      h('span', { 'class': 'banner-small', text: opts.small || '' }),
      h('span', { 'class': 'banner-title', text: opts.title || '' }),
      opts.text ? h('span', { 'class': 'banner-text', text: opts.text }) : null
    ]);
    box.appendChild(b);
    setTimeout(function () { if (b.parentNode) b.parentNode.removeChild(b); }, opts.ms || 3000);
  }
  /** Объявление для скринридеров без визуального уведомления (когда на экране открыто окно и toast закрыл бы кнопки). */
  function announce(text) {
    var box = document.getElementById('sr-live');
    if (!box) { box = h('div', { id: 'sr-live', 'class': 'sr-only', role: 'status', 'aria-live': 'polite' }); document.body.appendChild(box); }
    box.textContent = '';
    setTimeout(function () { box.textContent = text; }, 50);
  }
  /** Плавно меняет число в элементе (очки в шапке). */
  function countTo(el, to, ms) {
    if (!el) return;
    var from = parseInt(el.textContent, 10);
    if (!isFinite(from) || from === to || !animationsOn()) { el.textContent = String(to); return; }
    var t0 = null, dur = ms || 700;
    function step(ts) {
      if (t0 === null) t0 = ts;
      var k = Math.min(1, (ts - t0) / dur);
      el.textContent = String(Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3))));
      if (k < 1) requestAnimationFrame(step); else el.textContent = String(to);
    }
    requestAnimationFrame(step);
  }
  /** Перезапускает CSS-анимацию на элементе (например, «подпрыгивание» счётчика). */
  function pulse(el, cls) {
    if (!el) return;
    el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
  }

  TI.UI = {
    h: h, modal: modal, confirm: confirmBox, alert: alertBox, toast: toast, sound: sound, setSound: setSound, setAnimations: setAnimations,
    confetti: confetti, banner: banner, announce: announce, countTo: countTo, pulse: pulse, animationsOn: animationsOn
  };
})(window.TI = window.TI || {});
