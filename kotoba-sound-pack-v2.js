/* ユーザー提供SE/BGM。音が再生できなくてもゲームを止めません。 */
(function (root) {
  'use strict';
  var files = {
    tap: 'sounds/tap.mp3', gacha: 'sounds/gacha-reward.mp3',
    clear: 'sounds/all-correct.mp3', record: 'sounds/record-saved.mp3',
    footsteps: 'sounds/footstep.mp3'
  };
  var pool = Object.create(null);
  function play(kind) {
    if (!files[kind]) return false;
    var volume = root.__appMasterVolume;
    if (typeof volume !== 'number') {
      try { volume = Number(localStorage.getItem('kotobaquest_volume_v3') || 60) / 100; }
      catch (_) { volume = .6; }
      try {
        var options = JSON.parse(localStorage.getItem('kotobaquest_audio_v86') || '{}');
        if (options.seOn === false) volume = 0;
        else volume *= Math.max(0, Math.min(1, Number(options.se == null ? 100 : options.se) / 100));
      } catch (_) {}
    }
    volume = Math.max(0, Math.min(1, Number(volume) || 0));
    if (!volume || !root.Audio) return true;
    try {
      var audio = pool[kind] || (pool[kind] = new Audio(files[kind]));
      audio.volume = volume;
      audio.currentTime = 0;
      var pending = audio.play();
      if (pending && pending.catch) pending.catch(function () {});
      return true;
    } catch (error) { return false; }
  }
  root.KotobaSoundPack = {play: play, files: Object.assign({}, files)};
})(window);
