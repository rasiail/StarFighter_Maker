const puppeteer = require('puppeteer');
(async () => {
 const browser = await puppeteer.launch({headless:true});
 try {
 const page = await browser.newPage();
 await page.setViewport({width:1777,height:1037});
 if(process.env.DIAG_STAGE_PATCH) {
 await page.setRequestInterception(true);
 page.on('request',async req=>{
  if(new URL(req.url()).pathname==='/src/config/stages.js') {
   const fs=require('node:fs');
   const source=fs.readFileSync('src/config/stages.js','utf8').replace('waves: Object.freeze([...stage.waves]),','waves: Object.freeze([...stage.waves]), eliteRatios: Object.freeze([...stage.eliteRatios]),');
   await req.respond({status:200,contentType:'text/javascript',body:source});
  } else await req.continue();
 });
 }
 const errors = new Set();
 page.on('pageerror', e => errors.add(e.stack));
 page.on('console', async msg => { if(msg.type()==='error') { for(const arg of msg.args()) { try { errors.add(await arg.evaluate(v=>v instanceof Error?v.stack:String(v))); } catch{} } } });
 await page.goto('http://127.0.0.1:8000', {waitUntil:'networkidle2'});
 await page.waitForFunction(()=>window.player && document.querySelector('#btn-sortie').style.pointerEvents!=='none');
 await page.click('#btn-sortie');
 await page.click('#btn-start-selected-stage');
 await page.evaluate(()=>document.dispatchEvent(new MouseEvent('mouseup',{button:0,bubbles:true})));
 await new Promise(r=>setTimeout(r,3000));
 console.log('ERRORS',JSON.stringify([...errors]));
 console.log('STATE',await page.evaluate(async()=>{
  const {camera,hudCanvas,scene}=await import('/src/rendering/scene.js');
  const {gameState}=await import('/src/core/state.js');
  const {playerMesh}=await import('/src/player/player.js');
  const {enemies}=await import('/src/enemies/fleet.js');
  return {camera:camera.position.toArray(),player:playerMesh.position.toArray(),hud:[hudCanvas.width,hudCanvas.height],running:gameState.isGameRunning,enemies:enemies.length,exhaust:gameState.jetExhaustSystem.particles.filter(p=>p.active).length,objects:scene.children.length};
 }));
 await page.screenshot({path:process.env.DIAG_STAGE_PATCH?'scratch/diagnose-display-patched.png':'scratch/diagnose-display.png'});
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
