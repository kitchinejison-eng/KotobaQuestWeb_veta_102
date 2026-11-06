/* Independent BGM, sound-effect and read-aloud levels. Master volume remains supported. */
(function(){
  'use strict';
  if(window.KotobaAudio)return;
  var KEY='kotobaquest_audio_v86';
  var values={bgm:100,se:100,tts:100,rate:100,seOn:true,ttsOn:true};
  try{Object.assign(values,JSON.parse(localStorage.getItem(KEY)||'{}'));}catch(_){}
  function ratio(name){return Math.max(0,Math.min(1,Number(values[name]||0)/100));}
  function master(){var n=Number(localStorage.getItem('kotobaquest_volume_v3'));return localStorage.getItem('kotobaquest_volume_v3')===null?.6:Math.max(0,Math.min(1,isFinite(n)?n/100:.6));}
  function bgmLevel(){return ratio('bgm');}
  function seLevel(){return values.seOn?ratio('se'):0;}
  function ttsLevel(){return values.ttsOn?ratio('tts'):0;}
  function ttsRate(){return Math.max(.5,Math.min(1.5,Number(values.rate)/100||1));}
  function effectiveTts(){return master()*ttsLevel();}
  function apply(){
    window.__appMasterVolume=master()*seLevel();
    var bgm=document.getElementById('bgmAudio');
    if(bgm)try{bgm.volume=master()*.32*bgmLevel();}catch(_){}
  }
  function save(){try{localStorage.setItem(KEY,JSON.stringify(values));}catch(_){}apply();}
  function setup(){
    [['kotobaBgmVolume','bgm','kotobaBgmValue'],['kotobaSeVolume','se','kotobaSeValue'],['kotobaTtsVolume','tts','kotobaTtsValue'],['kotobaTtsRate','rate','kotobaTtsRateValue']].forEach(function(row){
      var input=document.getElementById(row[0]),out=document.getElementById(row[2]);if(!input)return;
      input.value=values[row[1]];if(out)out.textContent=input.value+'%';
      input.addEventListener('input',function(){values[row[1]]=Number(input.value);if(out)out.textContent=input.value+'%';save();});
    });
    [['kotobaSeOn','seOn'],['kotobaTtsOn','ttsOn']].forEach(function(row){
      var input=document.getElementById(row[0]);if(!input)return;input.checked=!!values[row[1]];
      input.addEventListener('change',function(){values[row[1]]=input.checked;save();});
    });
    var masterRange=document.getElementById('masterVolume');
    if(masterRange)masterRange.addEventListener('input',function(){setTimeout(apply,0);});
    apply();
  }
  window.KotobaAudio={bgmLevel:bgmLevel,seLevel:seLevel,ttsLevel:ttsLevel,ttsRate:ttsRate,
    effectiveTts:effectiveTts,apply:apply,isTtsOn:function(){return !!values.ttsOn;}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
})();
