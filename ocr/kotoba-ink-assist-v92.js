/* KotobaQuest v9.2: an on-device Japanese character dictionary and a STRICTLY
 * advisory stroke-count cross-check. Stroke count alone NEVER marks a character
 * correct/incorrect or changes one recognized character into another.
 * No target answer is supplied to this module. */
(function(root){
  'use strict';
  if(root.KotobaInkAssist) return;
  var STROKES=root.KotobaKanjiStrokesV92||{};
  var KEY='kotobaquest_ink_stroke_assist_v92_';
  var KANA_H=/^[\u3040-\u309f]$/u, KANA_K=/^[\u30a0-\u30ff\uff66-\uff9f]$/u;
  function normalize(s){return String(s||'').normalize('NFKC').trim();}
  function lookup(text){
    var char=normalize(text),one=Array.from(char);
    if(one.length!==1) return {char:char,kind:'other',strokes:[],known:false};
    var cp=one[0].codePointAt(0),key=cp.toString(16).toUpperCase();
    var raw=STROKES[key],counts=Array.isArray(raw)?raw:(Number.isInteger(raw)?[raw]:[]);
    return {char:char,kind:KANA_H.test(char)?'hiragana':KANA_K.test(char)?'katakana':counts.length?'kanji':'other',
      strokes:counts,known:counts.length>0||KANA_H.test(char)||KANA_K.test(char)};
  }
  function countStrokes(cell){
    return ((cell&&cell.strokes)||[]).filter(function(s){return s&&Array.isArray(s.points)&&s.points.length>0;}).length;
  }
  function closest(count, reference){
    return reference.length?Math.min.apply(null,reference.map(function(n){return Math.abs(count-n);})):Infinity;
  }
  function getUserKey(){
    try {return KEY+String(root.KotobaQuestUserProfile.getCurrent().profileId||'guest').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,50);}
    catch (_) {return KEY+'guest';}
  }
  function strokeAssistOn(){
    try{return localStorage.getItem(getUserKey())!=='0';}catch(_){return true;}
  }
  function setStrokeAssist(on){
    try{localStorage.setItem(getUserKey(),on?'1':'0');}catch(_){}
  }
  function review(cells,recognition){
    var observations=[];
    if(!strokeAssistOn()||!recognition||!Array.isArray(recognition.texts))
      return {uncertainIndex:null,observations:observations};
    for(var i=0;i<Math.min(cells.length,recognition.texts.length);i++){
      var observed=countStrokes(cells[i]),top=lookup(recognition.texts[i]);
      var opts=Array.isArray(recognition.cellCandidates&&recognition.cellCandidates[i])
        ?recognition.cellCandidates[i]:[];
      var topGap=closest(observed,top.strokes);
      var severe=observed>=2&&top.strokes.length>0&&topGap>=Math.max(4,Math.round(Math.max.apply(null,top.strokes)*0.75));
      // Only flag the rare case where the first candidate is grossly
      // inconsistent but another INDEPENDENT recognizer candidate has a
      // plausible stroke count. Different writing styles remain ungraded.
      var alternative=severe?opts.slice(1,6).map(lookup).find(function(x){
        if(x.char===top.char||!x.strokes.length)return false;
        return closest(observed,x.strokes)<=Math.max(1,Math.round(Math.min.apply(null,x.strokes)*0.20));
      }):null;
      observations.push({observed:observed,top:top.char,reference:top.strokes.slice(),
        severeMismatch:!!severe,alternative:alternative?alternative.char:null});
      if(alternative)return {uncertainIndex:i,observations:observations};
    }
    return {uncertainIndex:null,observations:observations};
  }
  function shapeAlphabet(base,candidates){
    // Font-based comparisons over 27k glyphs would be prohibitively slow.
    // Keep the original exercise alphabet, adding independent OCR candidates;
    // all dictionary characters remain available to dedicated AI recognizers.
    var chars=Array.from(String(base||'')).concat((candidates||[]).flatMap(function(x){return Array.from(normalize(x));}));
    return Array.from(new Set(chars.filter(function(c){return c.trim()!=='';}))).slice(0,240).join('');
  }
  function setup(){
    var input=document.getElementById('handwritingStrokeAssist');
    if(!input)return;
    input.checked=strokeAssistOn();
    input.addEventListener('change',function(){setStrokeAssist(input.checked);});
  }
  root.KotobaInkAssist={lookup:lookup,strokeCount:countStrokes,review:review,
    shapeAlphabet:shapeAlphabet,enabled:strokeAssistOn,setEnabled:setStrokeAssist,
    totalKanji:Object.keys(STROKES).length};
  if(typeof document!=='undefined'){
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);
    else setup();
  }
})(window);
