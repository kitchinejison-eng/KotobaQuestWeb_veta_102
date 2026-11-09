/* Run: node tests/verify-veta15.cjs — static tests for the VETA15 follow-up. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const root = path.join(__dirname,'..');
const read = file => fs.readFileSync(path.join(root,file),'utf8');

const scene = read('pictogram-3d.html');
const index = read('index.html');
const dungeon = read('kotoba-dungeon.html');
const gameJs = read('kotoba-dungeon.js');
const sw = read('service-worker.js');
const app = read('app.js');

assert.doesNotMatch(scene,/id="startBtn"|id="start"|ゲームスタート/,'3D starts without a manual start screen');
assert.match(scene,/id="loading"/);
assert.match(scene,/startGame\(\);\s*\}\s*catch\s*\(e\)/,'3D quiz launches after loading');
assert.match(scene,/id="pictogramQuestionCount"/);
for(const count of ['5','10','15','20'])assert.match(scene,new RegExp('option value="'+count+'"'));
assert.match(scene,/function getPictogramCount\(/);
assert.match(scene,/pickPictogramQuestions\(pool,getPictogramCount\(\)\)/);
assert.match(scene,/idx>=deck\.length/);
assert.match(scene,/total:deck\.length/);
assert.match(scene,/score\/deck\.length\*100/);
assert.match(scene,/score===deck\.length/);
assert.match(scene,/id="pictogramLevelSelect"/);
assert.match(index,/class="head-icon-button v15-genre-settings-btn" id="genreSettingsBtn"[^>]*>[^<]*<span[^>]*>⚙️<\/span><span>設定<\/span>/);
assert.match(app,/kotobaquest_question_count_v15/);
assert.match(dungeon,/id="kdEquippedOutfitLabel"/);
assert.match(gameJs,/kd-outfit-' \+ outfit\.id/);
assert.match(gameJs,/aria-pressed/);
assert.match(read('veta14-dungeon.css'),/\.kd-pixel-room \.kd-outfit-glasses/);
assert.match(read('veta14-dungeon.css'),/\.kd-outfit-item\.is-equipped::after/);
assert.match(sw,/veta-ver1(?:5|6)-pc-/);

const scripts = /<script\b([^>]*)>([\s\S]*?)<\/script>/g;
for (const file of ['pictogram-3d.html']) {
  let match;
  while ((match = scripts.exec(read(file)))) {
    if (match[1].includes('src=')) continue;
    new vm.Script(match[2],{filename:file});
  }
}
for(const file of ['app.js','kotoba-dungeon.js'])new vm.Script(read(file),{filename:file});

const known = ['未設定','未判定'].map(word => [word,[
  'app.js','pronunciation-training.js','user-profile.js','unified-learning-veta1.js',
  'reading-memory.html','pictogram-3d.html','kotoba-quest-ud.html','kotoba-dungeon.js'
].reduce((n,file) => n + read(file).split(word).length - 1,0)]);
console.log('PASS: VETA15 automatic 3D, 5–20 questions, dynamic score, settings label, outfits and JS syntax');
console.log('Visible placeholders (source occurrences only): '+known.map(([k,v])=>k+'='+v).join(', '));
