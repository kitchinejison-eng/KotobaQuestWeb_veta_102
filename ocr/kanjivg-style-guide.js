/* Kotoba Quest: lightweight stroke-sequence illustration.
 * Inspired by KanjiVG's one-SVG-path-per-stroke format, NOT a KanjiVG dataset
 * and NOT a handwriting recognizer. All sample paths below are original,
 * hand-authored demonstrations; never use them for automated grading.
 * Official KanjiVG data has a separate CC BY-SA 3.0 licence.
 */
(function(root){
 'use strict';
 var SAMPLES={
  '山':['M54 13 L54 88','M24 38 L24 88 L86 88','M85 38 L85 88'],
  '川':['M26 29 C30 56 28 74 20 91','M54 18 C58 48 56 70 53 88','M85 13 L85 92'],
  '木':['M16 37 L93 37','M55 12 L55 96','M53 38 Q39 67 14 83','M55 40 Q74 68 96 84'],
  '人':['M54 16 Q43 65 17 91','M55 22 Q70 66 94 91'],
  '口':['M25 23 L25 86','M25 23 L87 23 L87 85','M25 85 L87 85'],
  '日':['M28 17 L28 93','M28 17 L83 17 L83 93','M29 55 L82 55','M29 92 L83 92']
 };
 var NS='http://www.w3.org/2000/svg';
 function svg(tag,attributes){var node=document.createElementNS(NS,tag);Object.keys(attributes).forEach(function(key){node.setAttribute(key,String(attributes[key]));});return node;}
 function available(ch){return Object.prototype.hasOwnProperty.call(SAMPLES,String(ch));}
 function render(ch,container){
  if(!available(ch)||!container)return false;
  var token=(container.__strokeGuideToken||0)+1;container.__strokeGuideToken=token;
  container.textContent='';
  var graphic=svg('svg',{viewBox:'0 0 109 109',width:'218',height:'218',role:'img','aria-label':ch+'の参考書き順'});
  graphic.style.background='#fff';graphic.style.border='1px solid #cbd5e1';graphic.style.borderRadius='12px';
  [['M54.5 4 L54.5 105'],['M4 54.5 L105 54.5']].forEach(function(sample){
   var guide=svg('path',{d:sample[0],stroke:'#cbd5e1','stroke-width':0.8,'stroke-dasharray':'3 4',fill:'none'});graphic.appendChild(guide);
  });
  var paths=SAMPLES[ch].map(function(d){
   var node=svg('path',{d:d,fill:'none',stroke:'#e11d48','stroke-width':5,'stroke-linecap':'round','stroke-linejoin':'round'});
   graphic.appendChild(node);return node;
  });
  container.appendChild(graphic);
  paths.forEach(function(path){var length=path.getTotalLength();path.style.strokeDasharray=length;path.style.strokeDashoffset=length;});
  var index=0;
  function advance(){
   if(container.__strokeGuideToken!==token||index>=paths.length)return;
   var path=paths[index++];path.style.transition='stroke-dashoffset 0.75s ease-in-out';path.getBoundingClientRect();path.style.strokeDashoffset='0';
   setTimeout(advance,960);
  }
  setTimeout(advance,80);
  return true;
 }
 root.KotobaStrokeGuide={available:available,render:render,exampleCount:Object.keys(SAMPLES).length};
})(window);
