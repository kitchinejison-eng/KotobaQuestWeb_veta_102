/*
 * JLect JHR model adapter for the KotobaQuest browser writing exercise.
 * The underlying stroke-signature data is copyright Zachary Read / JLect.com,
 * licensed CC BY-SA 3.0: https://creativecommons.org/licenses/by-sa/3.0/
 * This adapter is also distributed under CC BY-SA 3.0. See JLECT_LICENSE.txt.
 * It produces suggestions, not a reliable assessment of handwriting quality.
 */
(function (root) {
  'use strict';
  function strokeDirection(stroke) {
    var points = stroke && stroke.points || [];
    if (points.length < 2) return '';
    var first = points[0], last = points[points.length - 1];
    var dx = Number(last.x) - Number(first.x);
    var dy = Number(last.y) - Number(first.y);
    if (!Number.isFinite(dx) || !Number.isFinite(dy) || Math.hypot(dx, dy) < 5) return '';
    var angle = ((Math.round((Math.atan2(dy, dx) * 180 / Math.PI + 180) / 45) * 45) % 360 + 360) % 360;
    if (angle === 0 || angle === 180) return 'H';
    if (angle === 90 || angle === 270) return 'V';
    if (angle === 45 || angle === 225) return '2';
    return '3';
  }
  function editDistance(a, b) {
    var previous = Array.from({length:b.length + 1}, function (_, i) { return i; });
    for (var i = 1; i <= a.length; i++) {
      var row = [i];
      for (var j = 1; j <= b.length; j++) {
        row[j] = Math.min(row[j - 1] + 1, previous[j] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      previous = row;
    }
    return previous[b.length];
  }
  function counts(s) {
    return ['H', 'V', '2', '3'].map(function (ch) { return s.split(ch).length - 1; });
  }
  function candidateList(strokes, limit) {
    var model = root.KotobaJlectModel || [];
    var signature = (strokes || []).map(strokeDirection).filter(Boolean).join('');
    if (!signature || !model.length) return [];
    var popular = Object.create(null);
    var words = root.KotobaCopyQuestionBank && root.KotobaCopyQuestionBank.words || [];
    words.forEach(function (word) { Array.from(word).forEach(function (ch) { popular[ch] = true; }); });
    var seen = new Map(), inputCounts = counts(signature);
    for (var i = 0; i < model.length; i++) {
      var entry = model[i], letter = entry[0], pattern = entry[1];
      if (!letter || !pattern || Math.abs(pattern.length - signature.length) > 2) continue;
      var distance = editDistance(signature, pattern);
      var differences = counts(pattern).reduce(function (total, n, index) { return total + Math.abs(n - inputCounts[index]); }, 0);
      var score = distance + differences * 0.13 - (popular[letter] ? 0.32 : 0);
      if (!seen.has(letter) || score < seen.get(letter)) seen.set(letter, score);
    }
    var ceiling = Math.max(1.2, signature.length * 0.32 + 0.5);
    return Array.from(seen.entries()).filter(function (entry) { return entry[1] <= ceiling; })
      .sort(function (a, b) { return a[1] - b[1] || a[0].localeCompare(b[0], 'ja'); })
      .slice(0, Math.max(1, limit || 5)).map(function (entry) { return entry[0]; });
  }
  root.KotobaJlectCandidates = {
    version: '1.0',
    supported: function () { return Array.isArray(root.KotobaJlectModel) && root.KotobaJlectModel.length > 0; },
    recognize: function (cells, limit) {
      var cellCandidates = cells.map(function (cell) { return candidateList(cell.strokes, limit || 5); });
      return {texts:cellCandidates.map(function (a) { return a[0] || ''; }), cellCandidates:cellCandidates,
        phraseCandidates:[], recognitionEngine:'jlect-jhr-stroke-candidates'};
    }
  };
})(window);
