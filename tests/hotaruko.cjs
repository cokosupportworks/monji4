const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {makeDOM}=require('./dom-harness.cjs');
const base=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(base,'index.html'),'utf8');
const {document}=makeDOM(html);
const context={document,console,performance,structuredClone,crypto:require('node:crypto').webcrypto,setTimeout,clearTimeout,
 window:{devicePixelRatio:1,addEventListener(){},monjiArchive:{saveState:async()=>{},put:async()=>{}},monjiSettings:{display:{mode:'flow',direction:'horizontal',auto:false,train:true},requests:{voice:false}}},requestAnimationFrame:()=>1,cancelAnimationFrame(){},ResizeObserver:class{observe(){}},localStorage:{getItem(){return null;},setItem(){}}};
vm.createContext(context);for(const file of ['core.js','journey.js','word-archive.js'])vm.runInContext(fs.readFileSync(path.join(base,file),'utf8'),context);
let source=fs.readFileSync(path.join(base,'app.js'),'utf8');source=source.slice(0,source.indexOf('    let booting = false;'))+' globalThis.testExports={App,loader}; })();';vm.runInContext(source,context);
context.testExports.loader.load=async()=>['M20,50 L90,50'];
const flush=()=>new Promise(setImmediate);
async function run(){
 const app=new context.testExports.App();await flush();await app.setWord('あい');await app.journey.ready;
 const coach=document.getElementById('hotarukoCoach'),overview=document.getElementById('driverOverview');
 assert.equal(document.getElementById('btnSettings').getAttribute('aria-label'),'おとなの せってい');
 assert.equal(document.getElementById('btnSettings').children[0].getAttribute('src'),'assets/gear.svg');
 assert.equal(coach.dataset.pose,'guide');
 assert.equal(app.journey.cards.filter(c=>c.car.classList.contains('locomotive-car')).length,1,'one leading locomotive precedes the first letter');
 assert.equal(app.journey.cards[1].car.dataset.index,'-1');
 assert.match(app.journey.cards[1].art.src,/locomotive-side/);
 app.isDown=true;app.askGently('speed');assert.equal(coach.dataset.pose,'request');assert.match(document.getElementById('coachMessage').textContent,/ゆっくり/);
 const message=document.getElementById('coachMessage').textContent;app.askGently('pause');assert.equal(document.getElementById('coachMessage').textContent,message,'request cooldown is preserved');app.isDown=false;
 app.sIdx=1;app.userStrokes=[[{x:20,y:50,t:0},{x:90,y:50,t:500}]];app.skipped=[false];await app.finishChar();assert.equal(coach.dataset.pose,'guide','intermediate letter uses short rail audio rather than praise dialogue');
 await app.setWord('うえ');await app.journey.ready;assert.equal(coach.dataset.pose,'guide','next task resets expression');
 app.display.direction='vertical';app.journey.apply(app.display);await app.journey.refresh(app.chars,0,app.sessions,context.testExports.loader,()=>[]);
 assert.equal(overview.dataset.direction,'vertical');assert.match(document.getElementById('driverTrainArt').src,/locomotive-top/);assert.match(app.journey.cards[1].art.src,/locomotive-top/);
 await app.journey.refresh(app.chars,1,app.sessions,context.testExports.loader,()=>[]);assert.equal(app.journey.cards[0].car.classList.contains('locomotive-car'),true,'locomotive travels with the word, not the active letter');
 app.display.mode='fixed';app.journey.apply(app.display);await app.journey.refresh(app.chars,0,app.sessions,context.testExports.loader,()=>[]);
 assert.equal(app.journey.cards.length,2,'fixed layout does not add a writing cell for the locomotive');assert.equal(overview.hidden,false,'cab overview stays available in fixed display');
 app.display.train=false;app.journey.apply(app.display);assert.equal(overview.hidden,true,'train setting hides the cab overview too');
 document.getElementById('btnSettings').click();assert.equal(document.getElementById('modalSettings').classList.contains('open'),true,'gear retains settings action');
 const png=fs.readFileSync(path.join(base,'assets/hotaruko/poses.png'));assert.equal(png[25],6,'PNG includes a real RGBA channel');
 const top=fs.readFileSync(path.join(base,'assets/locomotive-top.svg'),'utf8');assert.match(top,/真上/);assert.ok(!top.includes('<circle'),'no side-facing wheels in overhead cab');
 clearTimeout(app.stopRequestTimer);clearTimeout(app.autoAdvanceTimer);clearTimeout(app.tTimer);
 console.log('PASS: accessible gear, real transparent pose sheet, gentle request cooldown, praise/reset, single traveling locomotive, dedicated overhead cab, fixed display and train toggle');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
