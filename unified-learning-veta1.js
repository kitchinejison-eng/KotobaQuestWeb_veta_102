/* ことばクエスト veta_ver1: optional cross-mode learning bridge.
 * The saved switches take effect on the next page/app start; the active session
 * keeps a fixed settings snapshot. The legacy adaptive system is preserved.
 */
(function () {
  'use strict';
  if (window.KotobaUnifiedLearning) return;

  var RECORDS_KEY = 'aphasiaTrainingRecordsV4';
  var runtime = null;

  function currentProfile() {
    try {
      if (window.KotobaQuestUserProfile && window.KotobaQuestUserProfile.getCurrent) {
        return window.KotobaQuestUserProfile.getCurrent();
      }
      var data = JSON.parse(localStorage.getItem('kotobaquest_user_profile_v1') || 'null');
      if (data && typeof data === 'object') return data;
    } catch (_) {}
    return { profileId: 'unconfigured', displayName: '名前未登録', recordCode: '' };
  }
  // Capture only once. Changing a switch deliberately requires a restart.
  function activeSettings() {
    // VETA12: one profile-scoped switch controls every learning scope.
    // Retain the launch-time snapshot so running lessons do not change midway.
    if (!runtime) {
      var on = !!(window.KotobaLearningMode && window.KotobaLearningMode.isEnabled());
      runtime = {allGenres:on, dungeon:on, records:on, adaptiveHints:on};
    }
    return runtime;
  }
  function enabled(scope) {
    var cfg = activeSettings();
    if (!cfg.allGenres) return false;
    if (scope === 'dungeon') return !!cfg.dungeon;
    if (scope === 'records') return !!cfg.records;
    if (scope === 'hints') return !!cfg.adaptiveHints;
    return scope === 'genres';
  }
  function adaptive() { return window.KotobaAdaptive || null; }
  function shuffle(items) {
    var result = (items || []).slice();
    for (var i = result.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = result[i]; result[i] = result[j]; result[j] = tmp;
    }
    return result;
  }
  function select(scope, bank, activity, count) {
    if (enabled(scope) && adaptive()) return adaptive().select(bank, activity, count);
    return shuffle(bank).slice(0, Math.max(0, Number(count) || 0));
  }
  function begin(scope, genre, activity) {
    if (!enabled(scope) || !adaptive()) return false;
    adaptive().begin(genre, activity);
    return true;
  }
  function recordAnswer(scope, question, correct) {
    if (!enabled(scope) || !adaptive()) return;
    adaptive().recordAnswer(question, !!correct);
  }
  function finish(scope, session) {
    session = session || {};
    var summary = null;
    if (enabled(scope) && adaptive()) {
      summary = adaptive().finish(session.genre, session.activity, session.score, session.total);
    }
    // A disabled learning mode must never stop ordinary lesson records.
    if (session.saveRecord) saveExternalRecord(session, summary);
    return summary;
  }
  function saveExternalRecord(data, summary) {
    var now = new Date();
    var finished = data.finishedAt ? new Date(data.finishedAt) : now;
    var started = data.startedAt ? new Date(data.startedAt) : finished;
    if (!Number.isFinite(finished.getTime())) finished = now;
    if (!Number.isFinite(started.getTime())) started = finished;
    var profile = currentProfile();
    var total = Math.max(0, Number(data.total) || 0);
    var score = Math.max(0, Math.min(total, Number(data.score) || 0));
    var record = {
      id: finished.getTime() + '-unified-' + Math.random().toString(36).slice(2, 8),
      date: finished.getFullYear() + '-' + String(finished.getMonth() + 1).padStart(2, '0') + '-' + String(finished.getDate()).padStart(2, '0'),
      time: finished.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
      startedAt: started.toISOString(), finishedAt: finished.toISOString(),
      durationSec: Math.max(0, Math.round((finished - started) / 1000)),
      category: String(data.category || data.genre || ''),
      genre: String(data.genre || ''),
      activity: String(data.activity || ''),
      score: score, total: total,
      rate: total ? Math.round(score / total * 100) : null,
      kind: String(data.kind || 'training'), turns: 0,
      userProfileId: String(profile.profileId || 'unconfigured'),
      userName: String(profile.displayName || '名前未登録'),
      userCode: String(profile.recordCode || '')
    };
    if (summary) record.adaptive = summary;
    if (data.dungeon) record.dungeon = data.dungeon;
    if (Array.isArray(data.questionResults)) record.questionResults = data.questionResults.slice(0, 100);
    try {
      var records = JSON.parse(localStorage.getItem(RECORDS_KEY) || '[]');
      if (!Array.isArray(records)) records = [];
      records.push(record);
      records.sort(function (a, b) { return String(a.finishedAt || '').localeCompare(String(b.finishedAt || '')); });
      localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
      return true;
    } catch (err) {
      console.warn('学習記録への連動を保存できませんでした。', err);
      return false;
    }
  }
  function shouldSuggestHint(scope, activity) {
    if (!enabled(scope) || !enabled('hints') || !adaptive()) return false;
    var skill = adaptive().getSkill(activity);
    return Number(skill.level) <= 1 || Number(skill.probability) < 0.30;
  }
  function setup() {
    // Ensure the profile is available before the once-per-launch snapshot.
    activeSettings();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
  else setup();

  window.KotobaUnifiedLearning = {
    isEnabledFor: enabled, select: select, begin: begin, recordAnswer: recordAnswer,
    finish: finish, saveExternalRecord: saveExternalRecord,
    shouldSuggestHint: shouldSuggestHint,
    getRuntimeSettings: function () { return Object.assign({}, activeSettings()); },
    getSavedSettings: function () { return Object.assign({}, activeSettings()); }
  };
})();
