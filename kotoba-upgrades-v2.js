/* 全画面共通のヒント設定と、設定変更の確認ダイアログ。 */
(function (root) {
  'use strict';
  var KEY = 'kotobaquest_hints_v2';
  function isEnabled() { try { return localStorage.getItem(KEY) !== '0'; } catch (_) { return true; } }
  function storeHints(value) { try { localStorage.setItem(KEY, value ? '1' : '0'); } catch (_) {} }
  root.KotobaHintSettings = {isEnabled:isEnabled};
  function init() {
    var panel = document.getElementById('settings');
    var checkbox = document.getElementById('hintOn');
    if (checkbox) checkbox.checked = isEnabled();
    if (!panel) return;
    var last = new WeakMap();
    function getValue(element) { return element.type === 'checkbox' ? element.checked : element.value; }
    panel.querySelectorAll('input,select').forEach(function (element) { last.set(element, getValue(element)); });
    panel.addEventListener('pointerdown', function (event) {
      if (event.target && event.target.matches && event.target.matches('input[type="range"]'))
        last.set(event.target, getValue(event.target));
    }, true);
    panel.addEventListener('change', function (event) {
      var element = event.target;
      if (!element || !element.matches || !element.matches('input,select')) return;
      var before = last.get(element), after = getValue(element);
      if (before === after) return;
      if (event.isTrusted && !root.confirm('設定を変更しますか？')) {
        event.stopImmediatePropagation();
        if (element.type === 'checkbox') element.checked = !!before;
        else element.value = String(before);
        // スライダーはinputイベントですでに音量を変えているため、キャンセル時は復元します。
        if (element.type === 'range') element.dispatchEvent(new Event('input', {bubbles:true}));
        return;
      }
      last.set(element, after);
      if (element === checkbox) storeHints(element.checked);
    }, true);
    ['themeBlue','themeRed','themeYellow'].forEach(function (id) {
      var button = document.getElementById(id);
      if (button) button.addEventListener('click', function (event) {
        if (!event.isTrusted) return;
        if (!root.confirm('画面の色の設定を変更しますか？')) { event.stopImmediatePropagation(); event.preventDefault(); }
      }, true);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
