const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {makeDOM}=require('./dom-harness.cjs');
const base=path.resolve(__dirname,'..');
const {document,calls}=makeDOM(fs.readFileSync(path.join(base,'index.html'),'utf8'));
const saved=[];
const archive={saveState:async()=>{},put:async record=>saved.push(structuredClone(record))};
const window={devicePixelRatio:1,addEventListener(){},monjiArchive:archive,monjiSettings:{display:{mode:'fixed',direction:'vertical',auto:false,train:true},requests:{voice:false}}};
const ctx={window,document,console,performance,structuredClone,crypto:require('node:crypto').webcrypto,setTimeout,clearTimeout,
 requestAnimationFrame:()=>1,cancelAnimationFrame(){},ResizeObserver:class{observe(){}},localStorage:{getItem(){return null;},setItem(){}}};
vm.createContext(ctx);
for(const file of ['core.js','journey.js','word-archive.js'])vm.runInContext(fs.readFileSync(path.join(base,file),'utf8'),ctx);
let source=fs.readFileSync(path.join(base,'app.js'),'utf8');source=source.slice(0,source.indexOf('    let booting = false;'))+' globalThis.testExports={App,loader}; })();';
vm.runInContext(source,ctx);const{App,loader}=ctx.testExports;
const paths=['M20,50 L90,50','M50,20 L50,90'];loader.load=async()=>paths;
const flush=()=>new Promise(setImmediate);
async function run(){
 const app=new App();await flush();await flush();
 await app.setWord('あいうえお');await app.journey.ready;
 assert.equal(app.journey.cards.length,5,'all five letters have stationary cells');
 assert.equal(app.display.mode,'fixed');
 const stage=document.getElementById('stage'),canvas=document.getElementById('drawCanvas');
 assert.equal(stage.parentNode,app.journey.cards[0].car,'writing canvas starts in the first tile');
 // Begin directly on another tile. Its first contact must reach the actual drawing handler.
 const car=app.journey.cards[2].car,size=app.W;
 const px=100+size*(.12+20*.76/109),py=100+size*(.12+50*.76/109);
 car.emit('pointerdown',{pointerId:9,pointerType:'pen',button:0,clientX:px,clientY:py});
 assert.equal(app.cIdx,2);assert.equal(stage.parentNode,car,'writing surface moves to touched tile without moving any tile');
 assert.equal(app.isDown,true);assert.equal(app.drawing.length,1,'initial pen contact is retained');
 app.journey.cards[4].car.emit('pointerdown',{pointerId:10,pointerType:'touch',clientX:px,clientY:py});
 assert.equal(app.cIdx,2,'another pointer cannot move the active writing tile');
 canvas.emit('pointermove',{pointerId:9,pointerType:'pen',clientX:100+size*(.12+55*.76/109),clientY:py,getCoalescedEvents:()=>[]});
 assert.equal(app.drawing.length,2,'an empty coalesced-event array retains the ordinary event');
 canvas.emit('pointerup',{pointerId:9,pointerType:'pen',clientX:100+size*(.12+90*.76/109),clientY:py});
 assert.equal(app.sIdx,1,'the first line is judged on the selected tile');
 const old=JSON.stringify(app.sessions[2].strokes);
 app.selectFixed(0,null);assert.equal(app.cIdx,0);
 assert.equal(JSON.stringify(app.sessions[2].strokes),old,'partial handwriting is kept in its own tile');
 app.selectFixed(2,null);assert.equal(app.sIdx,1,'returning restores the next stroke');
 assert.equal(app.userStrokes.length,1);
 // Finishing records the correct occurrence, and the visual previews remain linked to it.
 app.userStrokes.push([{x:size*.5,y:size*.2,t:500},{x:size*.5,y:size*.8,t:800}]);app.skipped.push(false);app.sIdx=2;
 await app.finishChar();assert.equal(saved.at(-1).index,2);assert.equal(saved.at(-1).char,'う');
 assert.equal(app.journey.cards[2].car.classList.contains('completed-car'),true);
 app.selectFixed(1,null);assert.equal(app.hanamaru.classList.contains('show'),false,'completion controls disappear on an unfinished tile');
 app.selectFixed(2,null);
 document.getElementById('journey-mode').value='flow';document.getElementById('journey-direction').value='horizontal';
 document.getElementById('journey-mode').emit('change');await app.journey.ready;
 assert.equal(app.display.mode,'flow');assert.equal(stage.parentNode,app.journey.cards[2].car,'flow puts input back in the central car');
 document.getElementById('journey-mode').value='fixed';document.getElementById('journey-mode').emit('change');await app.journey.ready;
 assert.equal(app.display.mode,'fixed');assert.equal(app.sIdx,2,'display-mode switching preserves completed strokes');
 assert.ok(calls.some(call=>call[0]==='scale'),'drawing scales with the fixed tile size');
 // A separate loader instance exercises real deduplication and the concurrency limit.
 const pool=new loader.constructor();let active=0,maximum=0,sourceCalls=0;const releases=[];
 pool.loadSource=async ch=>{sourceCalls++;active++;maximum=Math.max(maximum,active);await new Promise(resolve=>releases.push(resolve));active--;return[ch];};
 const same=pool.load('同');assert.equal(pool.load('同'),same,'same pending glyph shares one request');
 const jobs=[same,...Array.from({length:8},(_,i)=>pool.load(String(i)))];await flush();
 assert.equal(maximum,4,'whole-word loading is bounded to four requests');
 while(releases.length){releases.splice(0).forEach(resolve=>resolve());await flush();}
 await Promise.all(jobs);assert.equal(sourceCalls,9);assert.equal(pool.activeRequests,0);
 pool.loadSource=async()=>{throw new Error('offline');};await assert.rejects(pool.load('失'),/offline/);
 assert.equal(pool.pending.size,0,'failed glyph request is retryable');
 clearTimeout(app.stopRequestTimer);clearTimeout(app.autoAdvanceTimer);clearTimeout(app.tTimer);
 console.log('PASS: DOM startup, direct-tile initial contact, stroke judgement, partial snapshots, archive position and display-mode switching');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
