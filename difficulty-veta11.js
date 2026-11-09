/* KotobaQuest browser VETA11: genre display + per-task level/mastery. */
(function (root) {
  'use strict';
  var STORAGE_KEY = 'kotobaquest_difficulty_veta11';
  var LEGACY_STORAGE = 'kotobaquest_user_profile_v1';
  function profileId() {
    try {
      var p = root.KotobaQuestUserProfile && root.KotobaQuestUserProfile.getCurrent();
      if (p && p.profileId) return String(p.profileId);
      var raw = JSON.parse(localStorage.getItem(LEGACY_STORAGE) || '{}');
      if (raw.profileId) return String(raw.profileId);
    } catch (_) { /* use fallback for browsers without storage */ }
    return 'unconfigured';
  }
  function read() {
    try {
      var data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return data && typeof data === 'object' ? data : {};
    } catch (_) { return {}; }
  }
  function write(data) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (_) { /* private mode */ }
  }
  function normalize(item) {
    var x = item && typeof item === 'object' ? item : {};
    var levels = Array.isArray(x.levelPoints) ? x.levelPoints.slice(0, 10) : [];
    while (levels.length < 10) levels.push(0);
    levels = levels.map(function (n) { return Math.max(0, Math.min(100, Math.round(Number(n) || 0))); });
    var unlocked = 1;
    for (var i = 0; i < 9 && levels[i] >= 100; i++) unlocked++;
    // Levels not yet mastered are hidden and cannot be selected, including
    // stale saves created when all levels were manually selectable.
    var selected = Math.max(1, Math.min(unlocked, Math.round(Number(x.selected) || unlocked)));
    return {selected:selected, unlocked:unlocked, mastery:levels[unlocked - 1], selectedMastery:levels[selected - 1], levelPoints:levels};
  }
  function get(id) {
    var data = read();
    var user = data[profileId()] || {};
    return normalize(user[id]);
  }
  function select(id, level) {
    var data = read(); var key = profileId();
    if (!data[key] || typeof data[key] !== 'object') data[key] = {};
    var p = get(id);
    p.selected = Math.max(1, Math.min(p.unlocked, Math.round(Number(level) || 1)));
    data[key][id] = p;
    write(data);
    return p;
  }
  function finish(id, rate, completed, count) {
    var data = read(); var key = profileId();
    if (!data[key] || typeof data[key] !== 'object') data[key] = {};
    var p = get(id); var lv = p.selected, before = p.levelPoints[lv - 1];
    // Incorrect answers still count as participation. Score affects the gain.
    if (completed && Number(count) > 0) {
      var earned = 5 + Math.round(15 * Math.max(0, Math.min(100, Number(rate) || 0)) / 100);
      p.levelPoints[lv - 1] = Math.min(100, before + earned);
    }
    var oldUnlocked = p.unlocked;
    p = normalize(p);
    // Keep the selected level even when other levels are already mastered.
    p.selected = lv;
    data[key][id] = p;
    write(data);
    return {level:lv, before:before, points:p.levelPoints[lv - 1], unlocked:p.unlocked,
      raised:p.unlocked > oldUnlocked, earned:p.levelPoints[lv - 1] - before};
  }
  function genreLevel(category) {
    if (!category || !Array.isArray(category.activities)) return 1;
    // A single readable genre level, derived from the independently stored tasks.
    var total = 0, count = 0;
    category.activities.forEach(function (item) { total += get(item[0]).unlocked; count++; });
    return count ? Math.max(1, Math.min(10, Math.floor(total / count))) : 1;
  }
  function pool(bank, level) {
    if (!Array.isArray(bank) || !bank.length) return [];
    var lv = Math.max(1, Math.min(10, Number(level) || 1));
    var exact = bank.filter(function (q) { return Number(q.difficultyLevel) === lv; });
    // All new 100-item banks have 10 questions per level; older/special banks
    // can continue to run even if they have fewer than ten levelled items.
    if (exact.length >= 5) return exact;
    var other = bank.filter(function (q) { return Number(q.difficultyLevel) !== lv; });
    other.sort(function (a, b) {
      return Math.abs((Number(a.difficultyLevel) || 5) - lv) - Math.abs((Number(b.difficultyLevel) || 5) - lv);
    });
    return exact.concat(other.slice(0, Math.max(0, 10 - exact.length)));
  }
  function draw(bank, id, level, count) {
    var candidates = pool(bank, level), needed = Math.min(Math.max(1, Number(count)||5), candidates.length);
    var data = read(), key = profileId();
    if (!data[key] || typeof data[key] !== 'object') data[key] = {};
    if (!data[key].__recent || typeof data[key].__recent !== 'object') data[key].__recent = {};
    var historyKey = id + '@' + level, recent = data[key].__recent[historyKey] || [];
    function identity(q, index) {
      return q.id ? String(q.id) : q.practiceVariant ? 'variant-' + q.practiceVariant : String(q.itemNo || q.prompt || q.question || q.answer || index);
    }
    var indexed = candidates.map(function (q, i) { return {question:q, key:identity(q, i)}; });
    // Shuffle both halves independently. Prefer unseen questions, then recycle
    // least-recently used ones after exhausting the level's available pool.
    var learning = !!(root.KotobaLearningMode && root.KotobaLearningMode.isEnabled());
    var weakIds = learning && root.KotobaAdaptive ? (root.KotobaAdaptive.getSkill(id).lastWrongIds || []) : [];
    // At most two review questions per run; keep most of the session fresh.
    var review = indexed.filter(function (x) { return weakIds.indexOf(x.key)>=0; }).slice(0,Math.min(2,Math.floor(needed/3)));
    var remainder = indexed.filter(function (x) { return review.indexOf(x)<0; });
    var fresh = remainder.filter(function (x) { return recent.indexOf(x.key) < 0; });
    var used = remainder.filter(function (x) { return recent.indexOf(x.key) >= 0; });
    function shuffle(list) { return list.sort(function () { return Math.random() - 0.5; }); }
    shuffle(fresh);
    used.sort(function (a,b) {return recent.indexOf(a.key) - recent.indexOf(b.key);});
    var selected = review.concat(fresh,used).slice(0, needed);
    var nextRecent = recent.concat(selected.map(function (x) { return x.key; }));
    var unique = [];
    nextRecent.forEach(function (x) { var i=unique.indexOf(x); if (i>=0) unique.splice(i,1); unique.push(x); });
    data[key].__recent[historyKey] = unique.slice(-Math.max(10, candidates.length));
    write(data);
    return selected.map(function (x) { return x.question; });
  }
  root.KotobaLevels = {get:get, select:select, finish:finish, genreLevel:genreLevel, pool:pool, draw:draw};
  if (typeof root.renderCategories === 'function') root.renderCategories();
})(window);
