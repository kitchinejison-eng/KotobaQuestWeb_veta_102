/* KotobaQuest Ver_beta_8_6: on-device adaptive practice, no remote AI or diagnosis. */
(function () {
  'use strict';
  if (window.KotobaAdaptive) return;
  var PREFIX = 'kotobaquest_adaptive_v86_';
  var DEFAULTS = { enabled: false, manualMode: false, probabilistic: true, review: true, disabilitySupport: false,
    manualLevel: 2, supports: [], disabilityTypes: [] };
  var state = null, currentSession = null;

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
    if (!s.skills[k]) s.skills[k]={level:2, probability:.35, total:0, correct:0, recent:[], lastQuestionIds:[], lastAdjustedAt:0};
    return s.skills[k];
  }
  function clamp(n,lo,hi) { return Math.max(lo,Math.min(hi,n)); }
  // Heuristic starting tags for legacy items without difficulty metadata.
  // These tags are for question selection only, not clinical skill ratings.
  function difficulty(q) {
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
  function select(bank, activity, count) {
    if (!Array.isArray(bank)) return [];
    var config=read().settings, rec=skill(activity), target=config.enabled?rec.level:Number(config.manualLevel);
    if (!config.enabled && !config.manualMode) {
      var original=bank.slice();
      for(var n=original.length-1;n>0;n--){var j=Math.floor(Math.random()*(n+1)),tmp=original[n];original[n]=original[j];original[j]=tmp;}
      return original.slice(0,count);
    }
    var candidates=bank.slice(), selected=[], used={};
    // Weighted sampling without duplicate questions. Retain the app's requested count.
    while(candidates.length && selected.length<count) {
      var weights=candidates.map(function(q) {
        var gap=Math.abs(difficulty(q)-target), w=gap===0?5:gap===1?2:.7;
        var id=String(q.id || q.prompt || q.question || q.answer || '');
        if (rec.lastQuestionIds.indexOf(id)>=0) w*=.55;
        if (config.review && rec.lastWrongIds && rec.lastWrongIds.indexOf(id)>=0) w*=2;
        if (config.probabilistic) w*=1+(1-rec.probability)*.25;
        return w;
      });
      var rand=Math.random()*weights.reduce(function(a,b){return a+b;},0), picked=candidates.length-1;
      for(var i=0;i<weights.length;i++){rand-=weights[i];if(rand<=0){picked=i;break;}}
      var q=candidates.splice(picked,1)[0];selected.push(q);
      used[String(q.id || q.prompt || q.question || q.answer || '')]=true;
    }
    return selected;
  }
  function begin(genre, activity) {
    currentSession={genre:String(genre||''), activity:skillId(activity), responses:[], startedAt:Date.now()};
  }
  function recordAnswer(q,correct) {
    if(!currentSession || !q) return;
    currentSession.responses.push({id:String(q.id||q.prompt||q.question||q.answer||''),
      difficulty:difficulty(q), correct:!!correct});
  }
  function finish(genre,activity,score,total) {
    var s=read(), rec=skill(activity), cfg=s.settings;
    if (!currentSession || currentSession.activity!==skillId(activity)) begin(genre,activity);
    var responses=currentSession.responses.slice(), missing=Math.max(0,Number(total||0)-responses.length);
    // For custom tasks with independent answer handlers, aggregate session scores
    // are recorded without inventing specific question-level answers.
    var countedCorrect=responses.filter(function(r){return r.correct;}).length;
    var extraCorrect=clamp(Number(score||0)-countedCorrect,0,missing);
    for(var i=0;i<missing;i++) responses.push({id:'aggregate-'+i,difficulty:rec.level,correct:i<extraCorrect, aggregate:true});
    responses.forEach(function(r){
      rec.total++; if(r.correct)rec.correct++;
      rec.recent.push(r.correct?1:0); if(rec.recent.length>16)rec.recent.shift();
      if(cfg.probabilistic) rec.probability=updateBKT(rec.probability,r.correct);
    });
    // veta_ver1: 連動ONの課題は直近5問で判定。既存モードは従来の8問ルールを維持。
    var unified=window.KotobaUnifiedLearning;
    var adaptiveScope=String(activity||'').indexOf('dungeon-tier-')===0?'dungeon':'genres';
    var linked=!!(unified && unified.isEnabledFor(adaptiveScope));
    var windowSize=linked?5:8, minAnswers=linked?5:6;
    var last=rec.recent.slice(-windowSize),rate=last.length?last.reduce(function(a,b){return a+b;},0)/last.length:0;
    if(cfg.enabled && rec.total-rec.lastAdjustedAt>=windowSize && last.length>=minAnswers){
      if(rate>=(linked?.80:.85) && rec.level<3){rec.level++;rec.lastAdjustedAt=rec.total;}
      else if(rate<(linked?.40:.45) && rec.level>1){rec.level--;rec.lastAdjustedAt=rec.total;}
    }
    rec.lastQuestionIds=responses.filter(function(x){return !x.aggregate;}).map(function(x){return x.id;}).slice(-8);
    rec.lastWrongIds=responses.filter(function(x){return !x.aggregate&&!x.correct;}).map(function(x){return x.id;}).slice(-8);
    var result={level:rec.level,estimatedMastery:Math.round(rec.probability*100),
      activity:activity, observations:responses.length, autoEnabled:cfg.enabled};
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
