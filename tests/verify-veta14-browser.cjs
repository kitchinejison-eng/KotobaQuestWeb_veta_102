/* Run with local HTTP server on port 8764: node tests/verify-veta14-browser.cjs */
'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const opts={headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=swiftshader']};
 if(process.env.CHROME_BIN)opts.executablePath=process.env.CHROME_BIN;
 const browser=await chromium.launch(opts);
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
  const fatal=[];page.on('pageerror',e=>fatal.push(String(e)));
  await page.addInitScript(()=>{
   if(!localStorage.getItem('kotobaquest_user_profile_v1'))localStorage.setItem('kotobaquest_user_profile_v1',JSON.stringify({profileId:'browser-test',displayName:'テスト冒険者',recordCode:'TEST14'}));
   if(!localStorage.getItem('kotobaDungeonSaveV1'))localStorage.setItem('kotobaDungeonSaveV1',JSON.stringify({profile:{name:'旧名',avatar:4,outfitId:null},medals:55,unlockedAvatarIds:[1,2,3,4],unlockedOutfitIds:[],totalExp:130,clears:2}));
   localStorage.setItem('kotobaquest_theme_v3','purple');
   localStorage.setItem('kotobaquest_music_v3','0');
  });
  await page.goto('http://127.0.0.1:8764/kotoba-dungeon.html',{waitUntil:'domcontentloaded'});
  await page.locator('#kdHomeScreen').waitFor({state:'visible'});
  assert.equal(await page.locator('#kdHomeName').textContent(),'テスト冒険者');
  assert.equal(await page.locator('body').getAttribute('data-theme'),'purple');
  const room=await page.locator('.kd-pixel-room').boundingBox();
  const avatar=await page.locator('.kd-pixel-avatar-wrap').boundingBox();
  assert.ok(room&&avatar&&Math.abs((avatar.x+avatar.width/2)-(room.x+room.width/2))<25,'avatar should be centered');
  await page.locator('#kdGachaBtn').click();
  assert.equal(await page.locator('#kdGachaOwnedMedals').textContent(),'🪙 50枚');
  await page.locator('#kdGachaSkipBtn').click();
  assert.equal(await page.locator('#kdGachaRewardVisual .kd-gacha-card').count(),1);
  await page.locator('#kdGachaAgain10Btn').click();
  await page.locator('#kdGachaSkipBtn').click();
  assert.equal(await page.locator('#kdGachaRewardVisual .kd-gacha-card').count(),10);
  assert.equal(await page.locator('#kdTopMedals').textContent(),'0');
  const save=await page.evaluate(()=>JSON.parse(localStorage.getItem('kotobaDungeonSaveV1')));
  assert.equal(save.medals,0);
  assert.ok(save.unlockedTreasureIds.length+save.unlockedOutfitIds.length+(save.unlockedAvatarIds.length-4)>=11);
  await page.locator('#kdGachaCloseBtn').click();
  await page.locator('#kdOpenSettingsBtn').click();
  await page.locator('#kdSettingsName').fill('新しい勇者');
  await page.locator('#kdSaveSettingsBtn').click();
  assert.equal(await page.locator('#kdHomeName').textContent(),'新しい勇者');
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('kotobaquest_user_profile_v1')).displayName),'新しい勇者');
  assert.deepEqual(fatal,[],'uncaught errors in dungeon');
  if(process.env.VETA14_SCREENSHOT)await page.screenshot({path:process.env.VETA14_SCREENSHOT,fullPage:true});
  await page.goto('http://127.0.0.1:8764/index.html',{waitUntil:'domcontentloaded'});
  assert.equal(await page.locator('#themePurple').count(),1);
  assert.equal(await page.locator('#genreQuestionCount').count(),1);
  assert.equal(await page.locator('#genreHints').count(),1);
  assert.equal(await page.locator('#voiceOn').count(),0);
  assert.equal(await page.locator('#kotobaTtsOn').count(),1);
  assert.equal(await page.locator('#editUserProfileBtn').count(),0);
  console.log('PASS: dungeon 1x/10x gacha, medals, saved prizes, avatar alignment, shared name, theme, settings UI');
 } finally {await browser.close();}
})().catch(err=>{console.error(err);process.exitCode=1;});
