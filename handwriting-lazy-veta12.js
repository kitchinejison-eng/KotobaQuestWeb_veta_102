/* Load the existing handwriting recognizers only when 写字・見写し is opened.
 * The original engines and licensed model data are unchanged. */
(function (root) {
  'use strict';
  var files = [
    'ocr/browser-japanese-ocr.js?v=beta87-multipass-ocr',
    'ocr/kotoba-ink-shape.js?v=beta9-hybrid-ink',
    'ocr/kotoba-kanji-strokes-v92.js?v=92',
    'ocr/kotoba-ink-assist-v92.js?v=92',
    'ocr/kanjivg-style-guide.js?v=1',
    'ocr/kotoba-jlect-model.js?v=1',
    'ocr/kotoba-jlect-candidates.js?v=1'
  ];
  var prepared = null;
  function script(url) {
    return new Promise(function(resolve,reject) {
      var element=document.createElement('script'); element.src=url; element.async=false;
      element.onload=resolve; element.onerror=function(){reject(new Error('認識用データを読み込めませんでした: '+url));};
      document.head.appendChild(element);
    });
  }
  function prepare() {
    if (prepared) return prepared;
    prepared = files.reduce(function(prev,url) {return prev.then(function(){return script(url);});},Promise.resolve())
      .catch(function(e){prepared=null;throw e;});
    return prepared;
  }
  if (typeof root.startActivity === 'function') {
    var original = root.startActivity;
    root.startActivity = function(activityId) {
      if (activityId !== 'copy') return original.apply(this,arguments);
      var context=this,args=arguments;
      var existing=document.getElementById('copyLazyLoading');
      var notice=existing||document.createElement('p');
      if (!existing) {notice.id='copyLazyLoading';notice.setAttribute('role','status');
        notice.style.cssText='padding:10px;margin:8px;border-radius:10px;background:#eef7ff;color:#174564;font-weight:700';
        (document.getElementById('activityCards')||document.body).appendChild(notice);}
      notice.textContent='手書き文字の認識データを準備中です…';
      prepare().then(function(){if(notice.parentNode)notice.parentNode.removeChild(notice);original.apply(context,args);})
        .catch(function(e){notice.textContent='手書き認識の準備に失敗しました。ネット接続を確認して、もう一度試してください。';console.warn(e);});
    };
  }
  root.KotobaHandwritingLazy = {prepare:prepare};
})(window);
