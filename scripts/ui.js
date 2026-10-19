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
    var head = h('div', { 'class': 'modal-head' }, [h('h2', { id: titleId, text: opts.title || '' })]);
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
  function toast(text, kind) {
    var box = document.getElementById('toasts');
    if (!box) return;
    var t = h('div', { 'class': 'toast toast-' + (kind || 'info') }, [h('span', { text: text })]);
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
      var seq = name === 'ok' ? [[523, 0], [659, 0.1], [784, 0.2]] : name === 'new' ? [[392, 0], [523, 0.12], [659, 0.24], [880, 0.36]] : [[220, 0], [180, 0.12]];
      seq.forEach(function (n) {
        var o = actx.createOscillator(), g = actx.createGain();
        o.type = 'sine'; o.frequency.value = n[0];
        g.gain.setValueAtTime(0.0001, actx.currentTime + n[1]);
        g.gain.exponentialRampToValueAtTime(0.12, actx.currentTime + n[1] + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + n[1] + 0.22);
        o.connect(g); g.connect(actx.destination);
        o.start(actx.currentTime + n[1]); o.stop(actx.currentTime + n[1] + 0.25);
      });
    } catch (e) { /* звук необязателен */ }
  }

  function setAnimations(on) { document.body.classList.toggle('no-anim', !on); }

  TI.UI = { h: h, modal: modal, confirm: confirmBox, alert: alertBox, toast: toast, sound: sound, setSound: setSound, setAnimations: setAnimations };
})(window.TI = window.TI || {});
