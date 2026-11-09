/* VETA16: node tests/verify-veta16.cjs — no external dependencies. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const read = name => fs.readFileSync(path.join(root,name),'utf8');

const app = read('app.js');
const pronunciation = read('pronunciation-training.js');
const ai = read('generative-ai-chat.js');
const profile = read('user-profile.js');
const sw = read('service-worker.js');

// No artificial scoring of skipped / unanswered tasks.
assert.match(app,/status: skipped \? 'スキップ' : '未回答'/);
assert.match(app,/status:gameOver \? '未出題' : '未回答'/);
assert.match(pronunciation,/correct === null\?'未回答'/);
assert.match(app,/s\.skipped\?'スキップ'/);

const statusFunction = app.match(/function questionRecordStatus\(item\) \{[\s\S]*?\n\}/);
assert.ok(statusFunction,'shared records should have a status formatter');
const status = vm.runInNewContext('('+statusFunction[0]+')');
assert.equal(status({status:'未判定',correct:null}),'未回答');
assert.equal(status({status:'未判定',correct:true}),'正解');
assert.equal(status({status:'未判定',skipped:true}),'スキップ');
assert.equal(status({status:'正解',correct:true}),'正解');

// Previously, a correct AI answer increased score but wrote no per-question result.
assert.match(ai,/KotobaAIQuizBridge\.correct\(answer\)/);
assert.match(app,/recordQuestionOutcome\(questions\[current\], true, recognizedAnswer/);
assert.match(ai,/KotobaAIQuizBridge\.wrong\(answer\)/);
assert.match(app,/recordQuestionOutcome\(questions\[current\], false, recognizedAnswer/);

// Simulate first launch, legacy missing-name state and successful profile registration.
const values=new Map();
values.set('aphasiaTrainingRecordsV4','[{"id":"past-record"}]');
const localStorage={getItem:key=>values.has(key)?values.get(key):null,setItem:(key,value)=>values.set(key,String(value))};
const window={dispatchEvent:()=>{}};
const document={getElementById:()=>null};
vm.runInNewContext(profile,{window,document,localStorage,Date,Math,Uint32Array,Event:class Event{},console},{filename:'user-profile.js'});
assert.equal(window.KotobaQuestUserProfile.hasProfile(),false);
assert.equal(window.KotobaQuestUserProfile.getCurrent().displayName,'名前未登録');
values.set('kotobaquest_user_profile_v1',JSON.stringify({profileId:'unconfigured',displayName:'未設定'}));
assert.equal(window.KotobaQuestUserProfile.hasProfile(),false);
const updated=window.KotobaQuestUserProfile.updateDisplayName('テスト利用者');
assert.equal(updated.ok,true);
assert.notEqual(updated.profile.profileId,'unconfigured');
assert.equal(window.KotobaQuestUserProfile.hasProfile(),true);
assert.equal(window.KotobaQuestUserProfile.getCurrent().displayName,'テスト利用者');
assert.equal(values.get('aphasiaTrainingRecordsV4'),'[{"id":"past-record"}]','old records must not be erased');

assert.match(sw,/veta-ver16-pc-/);
for(const file of ['app.js','pronunciation-training.js','generative-ai-chat.js','user-profile.js','kotoba-dungeon.js','unified-learning-veta1.js','service-worker.js']){
  new vm.Script(read(file),{filename:file});
}

const files = ['app.js','pronunciation-training.js','user-profile.js','unified-learning-veta1.js','reading-memory.html','pictogram-3d.html','kotoba-quest-ud.html','kotoba-dungeon.js'];
const occurrences = word => files.reduce((sum,file)=>sum + read(file).split(word).length - 1,0);
assert.ok(occurrences('未設定')<=3,'legacy wording should not be shown as a generic fallback');
assert.ok(occurrences('未判定')<=2,'remaining mentions should only support old records');
console.log('PASS: VETA16 AI-answer recording, skipped/unanswered/not-presented status, old records and profile migration');
console.log('Legacy source references only: 未設定='+occurrences('未設定')+', 未判定='+occurrences('未判定'));
