/* KotobaQuest Ver_beta_8_6: on-device adaptive practice, no remote AI or diagnosis. */
(function () {
  'use strict';
  if (window.KotobaAdaptive) return;
  var PREFIX = 'kotobaquest_adaptive_v86_';
  var DEFAULTS = { enabled: false, manualMode: false, probabilistic: true, review: true, disabilitySupport: false,
    manualLevel: 2, supports: [], disabilityTypes: [] };
  var state = null, currentSession = null;
  function learningOn() {
    return !!(window.KotobaLearningMode && window.KotobaLearningMode.isEnabled());
  }

  function profileId() {
    try { return String(window.KotobaQuestUserProfile.getCurrent().profileId || 'guest').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 50) || 'guest'; }
    catch (_) { return 'guest'; }
  }
  function key() { return PREFIX + profileId(); }
  function fresh() { return { settings: Object.assign({}, DEFAULTS), skills: {}, history: [] }; }
  function read() {
    var id = key();
    if (state && state.profileKey === id) return state;
    try { state = Object.assign(fresh(), JSON.parse(localStorage.getItem(id) || '{}')); }
    catch (_) { state = fresh(); }
    state.settings = Object.assign({}, DEFAULTS, state.settings || {});
    state.skills = state.skills || {};
    state.history = Array.isArray(state.history) ? state.history : [];
    state.profileKey = id;
    return state;
  }
  function save() {
    var s = read();
    try { localStorage.setItem(key(), JSON.stringify({settings:s.settings, skills:s.skills, history:s.history.slice(-1500)})); }
    catch (e) { console.warn('適応学習データを保存できませんでした', e); }
  }
  function skillId(activity) { return String(activity || 'unknown'); }
  function skill(activity) {
    var s=read(), k=skillId(activity);
    if (!s.skills[k]) s.skills[k]={level:1, probability:.35, total:0, correct:0, recent:[], lastQuestionIds:[], lastAdjustedAt:0, byLevel:{}};
    if (!s.skills[k].byLevel || typeof s.skills[k].byLevel!=='object') s.skills[k].byLevel={};
    return s.skills[k];
  }
  function clamp(n,lo,hi) { return Math.max(lo,Math.min(hi,n)); }
  // Heuristic starting tags for legacy items without difficulty metadata.
  // These tags are for question selection only, not clinical skill ratings.
  function difficulty(q) {
    if (q && Number(q.difficultyLevel)>=1 && Number(q.difficultyLevel)<=10) return Number(q.difficultyLevel);
    if (q && Number(q.difficulty)>=1 && Number(q.difficulty)<=3) return Number(q.difficulty);
    var length = String(q && (q.prompt || q.question || q.voiceText || '') || '').length;
    var answerLength = String(q && q.answer || '').length;
    var choices = Array.isArray(q && q.choices) ? q.choices.length : 0;
    if (length>=65 || answerLength>=12 || choices>=6) return 3;
    if (length>=27 || answerLength>=5 || choices>=4) return 2;
    return 1;
  }
  function updateBKT(p,correct) {
    var slip=.12, guess=.23, learn=.07;
    var posterior=correct ? p*(1-slip)/(p*(1-slip)+(1-p)*guess)
                          : p*slip/(p*slip+(1-p)*(1-guess));
    return clamp(posterior+(1-posterior)*learn,.02,.995);
  }
  function questionId(q) {
    if (Array.isArray(q)) return 'pictogram-'+String(q[0]||'');
    return String(q.id || (q.qSpeech ? 'fantasy-'+q.qSpeech : '') ||
      (q.practiceVariant ? 'variant-'+q.practiceVariant : '') || q.prompt || q.question || q.answer || '');
  }
  function select(bank, activity, count) {
    if (!Array.isArray(bank)) return [];
    var config=read().settings, rec=skill(activity);
    var target=window.KotobaLevels ? window.KotobaLevels.get(activity).selected : rec.level;
    if (!learningOn()) {
      var original=bank.slice();
      for(var n=original.length-1;n>0;n--){var j=Math.floor(Math.random()*(n+1)),tmp=original[n];original[n]=original[j];original[j]=tmp;}
      return original.slice(0,count);
    }
    var candidates=bank.slice(), selected=[], used={};
    // Weighted sampling without duplicate questions. Retain the app's requested count.
    while(candidates.length && selected.length<count) {
      var weights=candidates.map(function(q) {
        var gap=Math.abs(difficulty(q)-target), w=gap===0?5:gap===1?2:.7;
        var id=questionId(q);
        if (rec.lastQuestionIds.indexOf(id)>=0) w*=.55;
        if (rec.lastWrongIds && rec.lastWrongIds.indexOf(id)>=0) w*=3;
        if (config.probabilistic) w*=1+(1-rec.probability)*.25;
        return w;
      });
      var rand=Math.random()*weights.reduce(function(a,b){return a+b;},0), picked=candidates.length-1;
      for(var i=0;i<weights.length;i++){rand-=weights[i];if(rand<=0){picked=i;break;}}
      var q=candidates.splice(picked,1)[0];selected.push(q);
      used[questionId(q)]=true;
    }
    return selected;
  }
  function begin(genre, activity) {
    if (!learningOn()) {currentSession=null;return false;}
    currentSession={genre:String(genre||''), activity:skillId(activity), responses:[], startedAt:Date.now()};
    return true;
  }
  function recordAnswer(q,correct) {
    if(!learningOn() || !currentSession || !q || String(q.answer||'')==='できた') return;
    currentSession.responses.push({id:questionId(q),
      difficulty:difficulty(q), correct:!!correct});
  }
  function finish(genre,activity,score,total) {
    if(!learningOn()) {currentSession=null;return null;}
    var s=read(), rec=skill(activity), cfg=s.settings;
    if (!currentSession || currentSession.activity!==skillId(activity)) {currentSession=null;return null;}
    // A completion or self-report is not evidence of correct pronunciation.
    // Only answers that have been graded are used in the probability estimate.
    var responses=currentSession.responses.slice();
    if (!responses.length) {currentSession=null;return null;}
    responses.forEach(function(r){
      rec.total++; if(r.correct)rec.correct++;
      rec.recent.push(r.correct?1:0); if(rec.recent.length>16)rec.recent.shift();
      rec.probability=updateBKT(rec.probability,r.correct);
      var lv=Math.round(clamp(Number(r.difficulty)||1,1,10));
      var by=rec.byLevel[lv] || {total:0,correct:0,probability:.35};
      by.total++; if(r.correct)by.correct++;
      by.probability=updateBKT(by.probability,r.correct);
      rec.byLevel[lv]=by;
    });
    rec.level=window.KotobaLevels ? window.KotobaLevels.get(activity).selected : rec.level;
    rec.lastQuestionIds=responses.map(function(x){return x.id;}).slice(-8);
    rec.lastWrongIds=responses.filter(function(x){return !x.correct;}).map(function(x){return x.id;}).slice(-8);
    var result={level:rec.level,estimatedMastery:Math.round(rec.probability*100),
      activity:activity, observations:responses.length, autoEnabled:true};
    s.history.push({at:new Date().toISOString(),genre:genre,activity:activity,score:score,total:total,
      level:rec.level,probability:result.estimatedMastery});
    if(s.history.length>1500)s.history=s.history.slice(-1500);
    currentSession=null;save();renderStats();return result;
  }
  function element(id){return document.getElementById(id);}
  function checkbox(id,value){var e=element(id);if(e)e.checked=!!value;}
  function renderStats(){
    var s=read(), box=element('adaptiveStats');if(!box)return;
    var items=Object.keys(s.skills).filter(function(k){return s.skills[k].total>0;});
    if(!items.length){box.textContent='まだ分析結果がありません。問題に取り組むとここに表示されます。';return;}
    box.textContent='';
    items.forEach(function(id){var r=s.skills[id],row=document.createElement('p');
      var label=(typeof window.getActivityName==='function')?window.getActivityName(id):id;
      row.textContent=label+'：難易度 Lv.'+r.level+'／回答 '+r.total+'問／正答率 '+Math.round(r.correct/r.total*100)+'%／習熟推定 '+Math.round(r.probability*100)+'%';box.appendChild(row);});
  }
  function setup(){
    var s=read().settings;
    [['adaptiveEnabled','enabled'],['adaptiveManualMode','manualMode'],['adaptiveBKT','probabilistic'],['adaptiveReview','review'],['adaptiveSupport','disabilitySupport']].forEach(function(pair){
      var e=element(pair[0]);if(!e)return;e.checked=!!s[pair[1]];
      e.addEventListener('change',function(){read().settings[pair[1]]=e.checked;save();renderStats();});
    });
    var level=element('adaptiveManualLevel');if(level){level.value=String(s.manualLevel);level.addEventListener('change',function(){s.manualLevel=Number(level.value);save();});}
    var options=document.querySelectorAll('[data-kotoba-support]');options.forEach(function(e){
      e.checked=s.supports.indexOf(e.value)>=0;
      e.addEventListener('change',function(){var i=s.supports.indexOf(e.value);if(e.checked&&i<0)s.supports.push(e.value);else if(!e.checked&&i>=0)s.supports.splice(i,1);save();});
    });
    document.querySelectorAll('[data-kotoba-disability]').forEach(function(e){
      e.checked=s.disabilityTypes.indexOf(e.value)>=0;
      e.addEventListener('change',function(){var i=s.disabilityTypes.indexOf(e.value);if(e.checked&&i<0)s.disabilityTypes.push(e.value);else if(!e.checked&&i>=0)s.disabilityTypes.splice(i,1);save();});
    });
    var reset=element('adaptiveReset');if(reset)reset.addEventListener('click',function(){
      if(!confirm('学習分析と熟練度だけをリセットしますか？既存のトレーニング記録は消えません。'))return;
      read().skills={};read().history=[];save();renderStats();
    });
    renderStats();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
  window.KotobaAdaptive={select:select,begin:begin,recordAnswer:recordAnswer,finish:finish,
    getSettings:function(){return Object.assign({},read().settings);},getSkill:function(id){return Object.assign({},skill(id));},
    difficulty:difficulty,renderStats:renderStats};
})();
