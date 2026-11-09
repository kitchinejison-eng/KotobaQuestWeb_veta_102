/* Run: node tests/verify-veta11.cjs (no browser or npm dependencies). */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
function read(name) { return fs.readFileSync(path.join(root,name),'utf8'); }
const activities = ['mouth','sound','stepup','repeat','mora','accent','sentenceRhythm','voiceRead',
  'listen','instruction','tf','matching','copy','anagram','naming','cue','fill',
  'gesture','board','roleplay','aac','kotobaQuestClassic'];
const banks = Object.fromEntries(activities.map(id=>[id, []]));
for (const id of ['listen','instruction','matching','naming','gesture','board','roleplay','aac']) {
  banks[id].push({answer:'かさ',target:'かさ',image:'images/quiz-jpg/listen/kasa.jpg',
    voiceText:'かさ',prompt:'雨の日に使うものを選んでください。',choices:['かさ','ほん','みず','いす']});
}
const memory = new Map();
const ctx = {console,window:{QUESTIONS:banks,AI_CHAT_QUIZ_BANK:[],
  KotobaQuestUserProfile:{getCurrent:()=>({profileId:'userA'})}},
  localStorage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)}};
vm.createContext(ctx);
vm.runInContext(read('question-bank-veta11.js'),ctx,{filename:'question-bank-veta11.js'});
for (const id of activities) {
  assert.ok(banks[id].length >= 100, `${id}: fewer than 100 questions`);
  for (let lv=1;lv<=10;lv++) assert.ok(banks[id].filter(q=>q.difficultyLevel===lv).length>=10,
    `${id}: fewer than 10 level-${lv} questions`);
}
assert.equal(ctx.window.AI_CHAT_QUIZ_BANK.length,100);
assert.equal(new Set(banks.copy.map(q=>q.answer)).size,100);
assert.ok(banks.copy.every(q=>Array.from(q.answer).length<=4));
assert.ok(banks.fill.every(q=>q.prompt.includes('（　）')));
assert.ok(banks.sound.every(q=>q.choices.length===4 && new Set(q.choices).size===4));
assert.ok(banks.anagram.every(q=>q.tokens.slice().sort().join('')===Array.from(q.answer).sort().join('')));
vm.runInContext(read('difficulty-veta11.js'),ctx,{filename:'difficulty-veta11.js'});
const levels=ctx.window.KotobaLevels;
assert.equal(levels.get('copy').unlocked,1);
for(let i=0;i<5;i++) levels.finish('copy',100,true,10);
assert.equal(levels.get('copy').unlocked,2,'five perfect sessions must unlock level2');
levels.select('copy',7);
const high=levels.finish('copy',40,true,5);
assert.equal(high.level,2,'locked levels must remain unavailable');
assert.equal(levels.get('copy').unlocked,2,'attempting locked level must not fake earlier progress');
assert.equal(levels.get('tf').unlocked,1,'task progress must be independent');
ctx.window.KotobaQuestUserProfile.getCurrent=()=>({profileId:'userB'});
assert.equal(levels.get('copy').unlocked,1,'progress must be isolated by user profile');
const firstFive=levels.draw(banks.copy,'copy',1,5);
const nextFive=levels.draw(banks.copy,'copy',1,5);
const seen=new Set(firstFive.map(q=>q.practiceVariant));
assert.equal(firstFive.length,5);
assert.equal(nextFive.length,5);
assert.ok(nextFive.every(q=>!seen.has(q.practiceVariant)),'do not repeat until ten level questions exhausted');
assert.equal(levels.genreLevel({activities:[['copy'],['tf']]}),1,'show one combined level per genre');
vm.runInContext(read('fact-bank-veta11.js'),ctx,{filename:'fact-bank-veta11.js'});
assert.equal(ctx.window.KotobaV11Facts.length,80);
const references = ['index.html','pictogram-3d.html','reading-memory.html','kotoba-quest-ud.html'];
for(const filename of references){
  for(const match of read(filename).matchAll(/<(?:script|link)\b[^>]*(?:src|href)="([^"]+)"/gi)){
    const uri=match[1].split('?')[0];
    if (!uri || /^https?:|^\/\//.test(uri) || uri.startsWith('#')) continue;
    assert.ok(fs.existsSync(path.join(root,uri)),`missing: ${filename} -> ${uri}`);
  }
}
console.log(`PASS: ${activities.length} activity banks + 100 chat questions + 80 3D questions`);
console.log('PASS: 10 difficulty levels, mastery progression, per-task/per-user isolation, source references');
