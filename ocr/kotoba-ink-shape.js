/* Kotoba Quest beta9: independent, on-device visual handwriting comparator.
 * This is a conservative geometry-based second opinion, NOT a trained neural
 * handwriting model. It must never receive or inspect the question's answer.
 * Its candidate alphabet is the entire copy-practice vocabulary, not the
 * particular character currently displayed on screen.
 */
(function(root){
 'use strict';
 var SIZE=32, SOURCE=128, caches=Object.create(null);
 var fontFamilies=['"Noto Sans CJK JP", "Yu Gothic", Meiryo, sans-serif',
                   '"Noto Serif CJK JP", "Yu Mincho", serif'];
 function canvas(w,h){var c=document.createElement('canvas');c.width=w;c.height=h;return c;}
 function inkRaster(cell){
  var c=canvas(SOURCE,SOURCE),g=c.getContext('2d');if(!g)throw new Error('shape-canvas-unavailable');
  var points=[];((cell&&cell.strokes)||[]).forEach(function(s){(s.points||[]).forEach(function(p){if(Number.isFinite(p.x)&&Number.isFinite(p.y))points.push(p);});});
  if(!points.length)throw new Error('ocr-empty-ink');
  var x1=Math.min.apply(null,points.map(function(p){return p.x;})),x2=Math.max.apply(null,points.map(function(p){return p.x;}));
  var y1=Math.min.apply(null,points.map(function(p){return p.y;})),y2=Math.max.apply(null,points.map(function(p){return p.y;}));
  var scale=94/Math.max(x2-x1,y2-y1,20),left=(SOURCE-(x2-x1)*scale)/2-x1*scale,top=(SOURCE-(y2-y1)*scale)/2-y1*scale;
  g.fillStyle='#fff';g.fillRect(0,0,SOURCE,SOURCE);g.strokeStyle='#000';g.fillStyle='#000';g.lineWidth=4.2;g.lineCap='round';g.lineJoin='round';
  ((cell&&cell.strokes)||[]).forEach(function(s){var ps=(s.points||[]).filter(function(p){return Number.isFinite(p.x)&&Number.isFinite(p.y);});if(!ps.length)return;
   g.beginPath();g.moveTo(left+ps[0].x*scale,top+ps[0].y*scale);
   for(var i=1;i<ps.length;i++)g.lineTo(left+ps[i].x*scale,top+ps[i].y*scale);
   if(ps.length===1){g.arc(left+ps[0].x*scale,top+ps[0].y*scale,2.1,0,2*Math.PI);g.fill();}else g.stroke();
  });
  return c;
 }
 function glyphRaster(ch,family){
  var c=canvas(SOURCE,SOURCE),g=c.getContext('2d');
  g.fillStyle='#fff';g.fillRect(0,0,SOURCE,SOURCE);
  g.fillStyle='#000';g.font='112px '+family;g.textAlign='center';g.textBaseline='middle';g.fillText(ch,SOURCE/2,SOURCE/2+3);
  var src=g.getImageData(0,0,SOURCE,SOURCE).data,minX=SOURCE,minY=SOURCE,maxX=-1,maxY=-1;
  for(var y=0;y<SOURCE;y++)for(var x=0;x<SOURCE;x++){if(src[(y*SOURCE+x)*4]<170){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}}
  if(maxX<0)return c;
  var crop=canvas(SOURCE,SOURCE),ctx=crop.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,SOURCE,SOURCE);
  var w=maxX-minX+1,h=maxY-minY+1,scale=94/Math.max(w,h);
  ctx.drawImage(c,minX,minY,w,h,(SOURCE-w*scale)/2,(SOURCE-h*scale)/2,w*scale,h*scale);
  return crop;
 }
 function fingerprint(c){
  var small=canvas(SIZE,SIZE),g=small.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,SIZE,SIZE);g.drawImage(c,0,0,SIZE,SIZE);
  var pixels=g.getImageData(0,0,SIZE,SIZE).data,mask=new Uint8Array(SIZE*SIZE),count=0;
  for(var i=0;i<mask.length;i++){mask[i]=pixels[i*4]<190?1:0;count+=mask[i];}
  return {mask:mask,count:count,dist:distanceField(mask)};
 }
 // Two-pass Euclidean-style chamfer distance (diagonal cost ~= 1.41).
 function distanceField(mask){
  var d=new Float32Array(SIZE*SIZE),INF=100;
  for(var i=0;i<d.length;i++)d[i]=mask[i]?0:INF;
  for(var y=0;y<SIZE;y++)for(var x=0;x<SIZE;x++){var p=y*SIZE+x,v=d[p];if(x)v=Math.min(v,d[p-1]+1);if(y){v=Math.min(v,d[p-SIZE]+1);if(x)v=Math.min(v,d[p-SIZE-1]+1.414);if(x+1<SIZE)v=Math.min(v,d[p-SIZE+1]+1.414);}d[p]=v;}
  for(var yy=SIZE-1;yy>=0;yy--)for(var xx=SIZE-1;xx>=0;xx--){var q=yy*SIZE+xx,z=d[q];if(xx+1<SIZE)z=Math.min(z,d[q+1]+1);if(yy+1<SIZE){z=Math.min(z,d[q+SIZE]+1);if(xx)z=Math.min(z,d[q+SIZE-1]+1.414);if(xx+1<SIZE)z=Math.min(z,d[q+SIZE+1]+1.414);}d[q]=z;}
  return d;
 }
 function dissimilarity(a,b){
  if(!a.count||!b.count)return 100;
  var ab=0,ba=0;
  for(var i=0;i<a.mask.length;i++){if(a.mask[i])ab+=b.dist[i];if(b.mask[i])ba+=a.dist[i];}
  return (ab/a.count+ba/b.count)/2+0.65*Math.abs(Math.log(a.count/b.count));
 }
 function entries(alphabet){
  var letters=Array.from(new Set(Array.from(String(alphabet||'')).filter(function(c){return c.trim()!=='';})));
  var key=letters.slice().sort().join('');
  if(caches[key])return caches[key];
  var models=[];
  letters.forEach(function(ch){
   var fp=fontFamilies.map(function(font){return fingerprint(glyphRaster(ch,font));});
   models.push({text:ch,prototypes:fp});
  });
  caches[key]=models;return models;
 }
 function recognizeCell(cell,alphabet){
  var sample=fingerprint(inkRaster(cell)),ranked=entries(alphabet).map(function(model){
   var perFont=model.prototypes.map(function(p){return dissimilarity(sample,p);});
   return {text:model.text,distance:Math.min.apply(null,perFont),perFont:perFont};
  }).sort(function(a,b){return a.distance-b.distance;});
  var first=ranked[0],second=ranked[1];if(!first)return {text:'',confidence:0,margin:0,decisive:false,candidates:[]};
  var margin=second?second.distance-first.distance:0;
  var score=1/(1+first.distance/2.0);
  // Strict acceptance: a glyph must resemble a printed form AND stand out
  // from the other possible exercise characters. Ambiguity is not a wrong answer.
  // We calibrated the initial threshold against simple hand-drawn kanji
  // fixtures. Even above it, this is a secondary opinion, not a substitute
  // for evaluating handwriting samples from actual users.
  var fontAgree=fontFamilies.every(function(font,index){var closest=ranked.reduce(function(best,item){return !best||item.perFont[index]<best.perFont[index]?item:best;},null);return closest&&closest.text===first.text;});
  var decisive=score>=0.52&&margin>=0.50&&sample.count>=8&&fontAgree;
  return {text:first.text,confidence:Math.round(score*100),margin:margin,decisive:decisive,candidates:ranked.slice(0,4).map(function(c){return c.text;}),distance:first.distance};
 }
 function recognize(cells,alphabet){
  if(!Array.isArray(cells)||cells.length<1||cells.length>4||!alphabet)throw new Error('shape-invalid-input');
  var chars=cells.map(function(c){return recognizeCell(c,alphabet);});
  return {texts:chars.map(function(c){return c.text;}),cellCandidates:chars.map(function(c){return c.candidates;}),phraseCandidates:[],shapeEvidence:chars,recognitionEngine:'kotoba-shape-v1'};
 }
 root.KotobaInkShape={supported:function(){return typeof document!=='undefined'&&typeof document.createElement==='function';},recognize:recognize,recognizeCell:recognizeCell};
})(window);
