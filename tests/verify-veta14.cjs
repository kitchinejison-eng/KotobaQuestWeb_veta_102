/* Run: node tests/verify-veta14.cjs */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const index=read('index.html'),dungeon=read('kotoba-dungeon.html'),logic=read('kotoba-dungeon.js');
const pictogram=read('pictogram-3d.html'),fantasy=read('kotoba-quest-ud.html');
for(const id of ['genreQuestionCount','genreHints','themeGreen','themePurple','v14MasteryResult','kotobaTtsOn'])assert.match(index,new RegExp('id="'+id+'"'));
assert.doesNotMatch(index,/id="voiceOn"|id="editUserProfileBtn"/);
assert.match(read('app.js'),/genrePreferences\(selectedCategory\.id\)/);
assert.match(read('difficulty-veta11.js'),/Math\.min\(.*unlocked/);
for(const id of ['kdGacha10Btn','kdGachaSkipBtn','kdGachaAgain10Btn','kdCollectionTreasures'])assert.match(dungeon,new RegExp('id="'+id+'"'));
assert.doesNotMatch(dungeon,/id="kdSetupName"/);
assert.match(logic,/count=count===10\?10:1/);
assert.match(logic,/var cost=count\*5/);
assert.match(logic,/data\.medals-=cost/);
assert.match(logic,/pendingGachaDraws\.push\(grantPrize\(picked\)\)/);
assert.match(logic,/saveData\(\);renderHome\(\)/);
assert.match(logic,/gachaRevealTimer=setTimeout/);
assert.match(logic,/function syncProfileName/);
assert.match(logic,/updateDisplayName\(name\)/);
assert.match(logic,/startDungeonBgm\(\)/);
assert.doesNotMatch(logic,/localStorage\.setItem\('kotobaquest_music_v3','0'\)/);
assert.match(pictogram,/spriteNpcs\.forEach/);
assert.match(pictogram,/animalNpcs\.forEach/);
assert.match(pictogram,/let npcWalkTime=0/);
assert.match(fantasy,/id="fantasyHeroName"/);
assert.match(fantasy,/playSE\('hit'\)/);
assert.match(read('service-worker.js'),/veta-ver1(?:4|5|6)-pc-/);
assert.ok(fs.statSync(path.join(root,'veta14-dungeon.css')).size<16000,'gacha visuals should be small CSS');
for(const file of ['app.js','app-ui.js','kotoba-dungeon.js','difficulty-veta11.js','user-profile.js','veta14-theme-sync.js'])new vm.Script(read(file),{filename:file});
for(const filename of ['index.html','kotoba-dungeon.html','kotoba-quest-ud.html','pictogram-3d.html']){
 for(const ref of read(filename).matchAll(/<(?:script|link)\b[^>]*(?:src|href)="([^"]+)"/gi)){
  const url=ref[1].split('?')[0];if(/^(?:https?:|\/\/|#)/.test(url))continue;
  assert.ok(fs.existsSync(path.join(root,url)),filename+' missing '+url);
 }
}
for(const file of ['kotoba-quest-ud.html','pictogram-3d.html']){
 for(const script of read(file).matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))if(script[1].trim())new vm.Script(script[1],{filename:file});
}
console.log('PASS: VETA14 settings, per-genre preferences, mastery, level locking and theme');
console.log('PASS: 1x/10x gacha cost/persistence, shared names, NPC walking, fantasy audio and JavaScript syntax');
