/* Run: node tests/verify-veta13.cjs — no network or npm packages required. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const dungeon=read('kotoba-dungeon.html');
const fantasy=read('kotoba-quest-ud.html');
const dungeonJS=read('kotoba-dungeon.js');

for(const id of ['kdHomeAvatar','kdHomePortrait','kdHomeOutfit','kdHomeMedals','kdTopMedals',
  'kdHomeName','kdHomeExpText','kdHomeExpBar','kdHomeFriendshipHearts','kdStartChallengeBtn','kdGachaBtn',
  'kdOpenCollectionBtn','kdShowHistoryBtn','kdOpenTrainingRecordsBtn','kdHomeBottomBtn',
  'kdTrainingRecordsPanel','kdCloseTrainingRecordsBtn','kdCollectionPanel']) {
  assert.equal((dungeon.match(new RegExp('id="'+id+'"','g'))||[]).length,1,'missing/duplicate: '+id);
}
assert.match(dungeonJS,/kdHomePortrait'\)\.src = assetAvatar\(data\.profile\.avatar\)/,
  'the portrait must show the selected avatar');
assert.match(dungeonJS,/kdHomeAvatar'\)\.src = assetAvatar\(data\.profile\.avatar\)/,
  'the room character must show the selected avatar');
assert.match(dungeonJS,/kdOpenTrainingRecordsBtn'\)\.addEventListener/);
assert.match(dungeonJS,/kdHomeBottomBtn'\)\.addEventListener/);
assert.match(read('kotoba-dungeon-pixel-veta13.css'),/\.kd-pixel-room/);
assert.match(read('fantasy-event-veta13.css'),/orientation:landscape/);

for(const filename of ['kotoba-dungeon.html','kotoba-quest-ud.html']) {
  for (const match of read(filename).matchAll(/<(?:script|link)\b[^>]*(?:src|href)="([^"]+)"/gi)) {
    const ref=match[1].split('?')[0];
    if(!ref || /^(https?:|\/\/|#)/.test(ref)) continue;
    assert.ok(fs.existsSync(path.join(root,ref)),filename+' -> missing '+ref);
  }
}
assert.match(read('service-worker.js'),/kotoba-quest-veta-ver1(?:3|4|5|6)-pc-/);
assert.match(fantasy,/id="eventSkipBtn"/);
assert.match(fantasy,/id="eventProgress"/);

// Extract only the dialogue state machine so the full battle engine need not
// execute in Node; exercise the failure path that previously accessed isWin.
const start=fantasy.indexOf('const EVENT_CHARACTER_PROFILES = [');
const end=fantasy.indexOf('function initGame() {',start);
assert.ok(start>0 && end>start,'dialogue functions not found');
const source=fantasy.slice(start,end);
assert.doesNotMatch(source,/\!\!isWin/,'undefined isWin crashed the opening event');
let battles=0,spoken=0,stopped=0;
const element=()=>({style:{},dataset:{},textContent:'',src:'',alt:'',classList:{toggle(){},add(){},remove(){}},setAttribute(k,v){this[k]=v},getAttribute(k){return this[k]}});
const byId=new Map();
for(const id of ['eventOverlay','eventName','eventText','eventNextBtn','eventProgress','eventCharacterImage','overlay'])byId.set(id,element());
const scene=element(),character=element();
const memory=new Map(),storage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,String(v))};
const ctx=vm.createContext({
  window:{sessionStorage:storage,KQEventMessageSound:{play(){spoken++},stop(){stopped++}}},
  sessionStorage:storage,
  document:{getElementById:id=>byId.get(id),querySelector:q=>q.endsWith('.event-bg')?scene:character},
  stopSpeech(){},spawnEnemy(){battles++},console,
  setInterval(){return 7},clearInterval(){},setTimeout(){return 8},clearTimeout(){},
  Math,Date
});
vm.runInContext(source,ctx,{filename:'fantasy-event-dialogue.js'});
vm.runInContext('startConversationEvent()',ctx);
assert.equal(byId.get('eventOverlay').style.display,'flex');
assert.equal(byId.get('eventProgress').textContent,'1 / 4');
assert.ok(spoken>0,'character message sound should play');
vm.runInContext('advanceEvent()',ctx); // finish the typing animation
vm.runInContext('advanceEvent()',ctx); // move to step two
assert.equal(byId.get('eventProgress').textContent,'2 / 4');
vm.runInContext('finishEvent();finishEvent()',ctx);
assert.equal(byId.get('eventOverlay').style.display,'none');
assert.equal(byId.get('eventOverlay')['aria-hidden'],'true');
assert.equal(battles,1,'skipping or fast clicking must start one battle');
assert.ok(stopped>0,'message sound must stop on skip');

// Validate every updated inline script parses; the 3D external module remains
// independently exercised by the older source tests.
for(const name of ['kotoba-dungeon.js','learning-mode-veta12.js'])new vm.Script(read(name),{filename:name});
for(const name of ['kotoba-dungeon.html','kotoba-quest-ud.html']){
  let n=0;for(const m of read(name).matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)){
    if(m[1].trim()){new vm.Script(m[1],{filename:name+' inline '+(++n)});}
  }
}
console.log('PASS: responsive pixel menu structure, selected-avatar wiring and history buttons');
console.log('PASS: fantasy dialogue progress, skip, reentry guard and no undefined isWin');
console.log('PASS: CSS/JS resource links and script syntax');
