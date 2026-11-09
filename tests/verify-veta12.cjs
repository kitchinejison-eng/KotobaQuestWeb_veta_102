/* Run: node tests/verify-veta12.cjs (offline; no npm packages). */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname,'..');
const file = name => fs.readFileSync(path.join(root,name),'utf8');
const store = new Map();
const storage = {
  getItem(key) { return store.has(key) ? store.get(key) : null; },
  setItem(key,value) { store.set(key,String(value)); },
  removeItem(key) { store.delete(key); }
};
function boot(profile) {
  const current = {id:profile};
  const document = {
    readyState:'loading',
    addEventListener() {},
    getElementById() { return null; },
    querySelectorAll() { return []; }
  };
  const window = {KotobaQuestUserProfile:{getCurrent:()=>({profileId:current.id,displayName:'試験利用者'})}};
  const context = vm.createContext({window,document,localStorage:storage,console,Date,Math,Number,JSON});
  for (const script of ['learning-mode-veta12.js','difficulty-veta11.js','adaptive-learning.js','unified-learning-veta1.js']) {
    vm.runInContext(file(script),context,{filename:script});
  }
  return {window,current};
}

const off = boot('participant-A');
assert.equal(off.window.KotobaLearningMode.isEnabled(),false,'OFF by default');
assert.equal(off.window.KotobaUnifiedLearning.isEnabledFor('genres'),false);
assert.equal(off.window.KotobaUnifiedLearning.isEnabledFor('dungeon'),false);
assert.equal(off.window.KotobaAdaptive.begin('認知','copy'),false);
off.window.KotobaAdaptive.recordAnswer({id:'p1',difficultyLevel:1,answer:'花'},true);
assert.equal(off.window.KotobaAdaptive.finish('認知','copy',1,1),null);
assert.equal(off.window.KotobaAdaptive.getSkill('copy').total,0,'OFF must not update probabilistic estimate');
off.window.KotobaUnifiedLearning.finish('dungeon',{
  genre:'ことばダンジョン',activity:'copy',score:1,total:2,saveRecord:true,
  questionResults:[{number:1,correct:true}]
});
assert.equal(JSON.parse(storage.getItem('aphasiaTrainingRecordsV4')).length,1,
  'OFF must still save ordinary dungeon training records');

assert.equal(off.window.KotobaLearningMode.setEnabled(true),true);
const on = boot('participant-A'); // Model a user reload after changing the flag.
const w = on.window;
assert.equal(w.KotobaLearningMode.isEnabled(),true);
assert.equal(w.KotobaUnifiedLearning.isEnabledFor('genres'),true);
assert.equal(w.KotobaUnifiedLearning.isEnabledFor('dungeon'),true);
assert.equal(w.KotobaUnifiedLearning.isEnabledFor('records'),true);
assert.equal(w.KotobaUnifiedLearning.isEnabledFor('hints'),true);
w.KotobaLevels.select('copy',2);
assert.equal(w.KotobaUnifiedLearning.begin('genres','認知','copy'),true);
for(let i=0;i<6;i++) w.KotobaUnifiedLearning.recordAnswer('genres',
  {id:'handwriting-'+i,answer:'花',difficultyLevel:2},i!==3);
w.KotobaUnifiedLearning.recordAnswer('genres',{id:'ungraded',answer:'できた',difficultyLevel:2},true);
const result = w.KotobaUnifiedLearning.finish('genres',
  {genre:'認知',activity:'copy',score:5,total:10});
assert.ok(result,'should return learning estimate');
assert.equal(result.observations,6,'only actual judged responses count');
const stats = w.KotobaAdaptive.getSkill('copy');
assert.equal(stats.total,6,'summary total must not invent remaining four answers');
assert.equal(stats.byLevel[2].total,6);
assert.equal(stats.byLevel[2].correct,5);
assert.ok(Number.isFinite(stats.byLevel[2].probability));
assert.equal(stats.lastWrongIds[0],'handwriting-3');
assert.ok(w.KotobaLearningMode.recommendation('copy',2),'recommendation after >=5 observations');
assert.equal(w.KotobaAdaptive.getSkill('listen').total,0,'activities have independent histories');

const selected = w.KotobaUnifiedLearning.select('genres',[
  {id:'handwriting-3',answer:'花',difficultyLevel:2},
  {id:'handwriting-9',answer:'草',difficultyLevel:2}
],'copy',2);
assert.equal(selected.length,2);

w.KotobaLearningMode.setEnabled(false);
const again = boot('participant-A');
assert.equal(again.window.KotobaAdaptive.getSkill('copy').total,6,'OFF keeps prior data');
const separate = boot('participant-B');
assert.equal(separate.window.KotobaLearningMode.isEnabled(),false,'profile switches are independent');
assert.equal(separate.window.KotobaAdaptive.getSkill('copy').total,0,'profile analysis data is independent');

const htmls=['index.html','pictogram-3d.html','reading-memory.html','kotoba-quest-ud.html','kotoba-dungeon.html'];
for(const html of htmls) {
  const source=file(html);
  assert.match(source,/learning-mode-veta12\.js/,'missing learning mode '+html);
  for(const ref of source.matchAll(/<(?:script|link)\b[^>]*(?:src|href)="([^"]+)"/gi)) {
    const uri=ref[1].split('?')[0];
    if(!uri || /^(https?:|\/\/|#|data:)/.test(uri)) continue;
    assert.ok(fs.existsSync(path.join(root,uri)),html+' -> missing '+uri);
  }
}
const index = file('index.html');
assert.match(index,/id="learningModeEnabled"/);
assert.equal((index.match(/id="learningModeEnabled"/g)||[]).length,1,'one unified toggle');
assert.doesNotMatch(index,/id="adaptiveEnabled"|id="unifiedAllGenres"|id="unifiedDungeon"/);
assert.match(index,/handwriting-lazy-veta12\.js/);
assert.doesNotMatch(index,/<script src="ocr\/browser-japanese-ocr\.js/,'OCR code should load lazily');
const sw=file('service-worker.js');
assert.match(sw,/veta-ver1(?:2|3|4|5|6)-pc-/);
assert.doesNotMatch(sw,/\.\/ocr\/vendor\/core\/tesseract/,'large OCR wasm must not be eager-cached');
assert.doesNotMatch(sw,/\.\/images\/quiz-jpg/,'question images must not be eager-cached');
console.log('PASS: unified ON/OFF, per-profile BKT, review, no fabricated observations');
console.log('PASS: ordinary record saving while OFF, preserved historical data');
console.log('PASS: page references and opt-in lightweight resource loading');
