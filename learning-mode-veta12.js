/* KotobaQuest VETA12 — one learning-mode switch, shared by every page.
 * This flag controls optional analysis only. Stored records, user levels,
 * medals and handwriting/voice models are never reset or replaced. */
(function (root) {
  'use strict';
  if (root.KotobaLearningMode) return;
  var PREFIX = 'kotobaquest_learning_mode_veta12_';
  function profileId() {
    try {
      var p = root.KotobaQuestUserProfile && root.KotobaQuestUserProfile.getCurrent();
      if (p && p.profileId) return String(p.profileId).replace(/[^\w-]/g,'').slice(0,60);
      var old = JSON.parse(localStorage.getItem('kotobaquest_user_profile_v1') || '{}');
      if (old.profileId) return String(old.profileId).replace(/[^\w-]/g,'').slice(0,60);
    } catch (_) {}
    return 'unconfigured';
  }
  function key() { return PREFIX + profileId(); }
  function isEnabled() {
    try { return localStorage.getItem(key()) === '1'; } catch (_) { return false; }
  }
  function setEnabled(enabled) {
    try { localStorage.setItem(key(), enabled ? '1' : '0'); return true; }
    catch (_) { return false; }
  }
  function recommendation(id, selectedLevel) {
    var level = Math.max(1, Math.min(10, Number(selectedLevel) || 1));
    if (!isEnabled() || !root.KotobaAdaptive) return null;
    var skill = root.KotobaAdaptive.getSkill(id);
    var stats = skill && skill.byLevel && skill.byLevel[level];
    if (!stats || Number(stats.total) < 5) return null;
    var rate = Number(stats.correct) / Math.max(1, Number(stats.total));
    var estimate = Number(stats.probability);
    var suggested = level;
    if (estimate >= .78 && rate >= .8) suggested = Math.min(10, level + 1);
    else if (estimate < .38 && rate < .5) suggested = Math.max(1, level - 1);
    return {level:suggested, current:level, total:stats.total,
      estimate:Math.round(estimate * 100), rate:Math.round(rate * 100)};
  }
  function syncSettings() {
    var input = document.getElementById('learningModeEnabled');
    var status = document.getElementById('learningModeStatus');
    if (!input) return;
    input.checked = isEnabled();
    if (status) status.textContent = input.checked
      ? 'ON：全ジャンル・RPG・3D・ダンジョンの回答分析と復習支援を有効にします。'
      : 'OFF：通常の練習は使えます。問題別の学習分析は更新しません。';
  }
  function setup() {
    var input = document.getElementById('learningModeEnabled');
    if (!input || input.dataset.boundLearningMode) return;
    input.dataset.boundLearningMode = '1';
    syncSettings();
    input.addEventListener('change', function () {
      if (!setEnabled(input.checked)) {
        input.checked = !input.checked;
        var status = document.getElementById('learningModeStatus');
        if (status) status.textContent = '設定を保存できませんでした。ブラウザの保存領域を確認してください。';
        return;
      }
      syncSettings();
      // Other pages read the same flag. Reload clears an in-progress session.
      var button = document.getElementById('learningModeReload');
      if (button) button.hidden = false;
    });
    var reload = document.getElementById('learningModeReload');
    if (reload) reload.addEventListener('click', function () { root.location.reload(); });
  }
  root.KotobaLearningMode = {isEnabled:isEnabled,setEnabled:setEnabled,
    recommendation:recommendation,syncSettings:syncSettings};
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
  else setup();
})(window);
