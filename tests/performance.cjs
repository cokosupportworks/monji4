const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {performance}=require('node:perf_hooks');
const {makeDOM}=require('./dom-harness.cjs');
const base=path.resolve(__dirname,'..');
const current=require('../core.js'),before=require('./fixtures/evaluator-before.cjs');
const cfg={dev:26,startTol:32,maxRatio:1.6,validRatio:.85,minCoverage:.8};

// This is synthetic stress geometry, not a claim to have profiled an iPad or
// downloaded the four reported KanjiVG characters.
function loop(count,jitter=0){return Array.from({length:count},(_,i)=>{
 const t=i/(count-1)*Math.PI*2;
 return{x:230+150*Math.sin(t)+jitter*Math.sin(31*t),y:230+140*Math.sin(2*t)+jitter*Math.cos(29*t)};
});}
for(let i=0;i<60;i++){
 const target=loop(45+i),input=loop(55+i*3,i%3?i%12:35);
 if(i%7===0)input.reverse();
 const params={...cfg,dev:[16,26,38][i%3]};
 assert.deepEqual(current.evaluate(target,input,params),before.evaluate(target,input,params),'indexed judgement must match the former exact-segment judgement');
}
const target=loop(900),input=loop(7200,2);
function measure(core){const start=performance.now();const result=core.evaluate(target,input,cfg);return{ms:performance.now()-start,pass:result.pass};}
const oldTiming=measure(before),newTiming=measure(current);assert.equal(oldTiming.pass,newTiming.pass);

const {document,calls}=makeDOM(fs.readFileSync(path.join(base,'index.html'),'utf8'));
const frames=new Map();let nextFrame=0;
const archive={saveState:async()=>{},put:async()=>{}};
const window={devicePixelRatio:1,addEventListener(){},monjiArchive:archive,monjiSettings:{display:{mode:'flow',auto:false},requests:{speed:false,pause:false,voice:false}}};
const context={window,document,console,performance,structuredClone,crypto:require('node:crypto').webcrypto,setTimeout,clearTimeout,
 requestAnimationFrame:fn=>{frames.set(++nextFrame,fn);return nextFrame;},cancelAnimationFrame:id=>frames.delete(id),
 ResizeObserver:class{observe(){}},localStorage:{getItem(){return null;},setItem(){}}};
vm.createContext(context);
for(const file of ['core.js','journey.js','word-archive.js'])vm.runInContext(fs.readFileSync(path.join(base,file),'utf8'),context);
let source=fs.readFileSync(path.join(base,'app.js'),'utf8');
source=source.slice(0,source.indexOf('    let booting = false;'))+' globalThis.testExports={App,loader,samplePath,pathCache}; })();';
vm.runInContext(source,context);const {App,loader,samplePath,pathCache}=context.testExports;
const curve='M10,80 C90,-40 0,10 90,70 C60,110 20,100 10,80';
let queries=0,lengthQueries=0;const helper=document.getElementById('svgHelperPath');
helper.getTotalLength=()=>{lengthQueries++;return 450;};
helper.getPointAtLength=length=>{queries++;const t=length/450*Math.PI*2;return{x:54+40*Math.sin(t),y:54+40*Math.sin(2*t)};};
loader.load=async()=>[curve];
const flush=()=>new Promise(setImmediate);
function frame(time){const pending=[...frames.values()];frames.clear();for(const fn of pending)fn(time);}
async function run(){
 const app=new App();await flush();await app.setWord('ひ');await app.journey.ready;
 const sampled=queries,lengthSampled=lengthQueries;
 for(let i=0;i<100;i++){samplePath(curve,460,460);samplePath(curve,400,400);samplePath(curve,220,220);}
 assert.equal(queries,sampled,'SVG geometry is not recalculated on repeated uses and sizes');
 assert.equal(lengthQueries,lengthSampled,'path length is cached too');
 const inkOpacity=app.inkCanvas.style.opacity;
 const beforeFade=calls.length;app.hotaru.enabled=true;app.startHotaru();const start=app.hotaru.startTime;
 for(let i=0;i<180;i++)frame(start+i*1000/60);
 assert.equal(calls.length,beforeFade,'180 fade frames issue no canvas redraw commands');
 assert.equal(queries,sampled,'fading never resamples SVG curves');
 app.applyModelOpacity(0);assert.equal(app.tplCanvas.style.opacity,'0');
 assert.equal(app.inkCanvas.style.opacity,inkOpacity,'model fade does not hide completed handwriting');
 app.stopHotaru();app.hotaru.enabled=false;
 const canvas=document.getElementById('drawCanvas');
 canvas.emit('pointerdown',{pointerId:1,pointerType:'pen',clientX:150,clientY:150});
 const beforePen=calls.filter(c=>c[0]==='lineTo').length;
 let boundsReads=0;const getBounds=canvas.getBoundingClientRect.bind(canvas);
 canvas.getBoundingClientRect=()=>{boundsReads++;return getBounds();};
 for(let batch=0;batch<100;batch++){
  const events=Array.from({length:40},(_,j)=>{const i=batch*40+j;return{clientX:130+((i*.7)%180),clientY:230+65*Math.sin(i*.03)};});
  canvas.emit('pointermove',{pointerId:1,pointerType:'pen',...events.at(-1),getCoalescedEvents:()=>events});
  assert.equal(frames.size,1,'a coalesced input batch queues only one drawing frame');
  frame(performance.now());
 }
 const lineCommands=calls.filter(c=>c[0]==='lineTo').length-beforePen;
 assert.equal(app.drawing.length,4001,'all 4000 coalesced samples are kept for saving and judgement');
 assert.equal(lineCommands,4000,'each new segment is painted once instead of repainting the stroke prefix');
 assert.equal(boundsReads,100,'one canvas bounds read per event, not per coalesced point');
 canvas.emit('pointercancel',{pointerId:1});assert.equal(frames.size,0,'cancellation leaves no stale drawing frame');
 for(let i=0;i<300;i++)samplePath('M'+i+',0 L'+(i+1)+',10',460,460);
 assert.ok(pathCache.size<=256,'geometry caching remains bounded');
 clearTimeout(app.tTimer);clearTimeout(app.stopRequestTimer);clearTimeout(app.autoAdvanceTimer);
 console.log('PASS: 60 judgement-equivalence cases, cached curves, zero redraws during fading, 4000 retained samples / 4000 drawn segments, bounded cache');
 console.log(JSON.stringify({environment:'Node synthetic stroke benchmark (not browser/iPad)',baselineMs:+oldTiming.ms.toFixed(2),updatedMs:+newTiming.ms.toFixed(2),sameJudgement:oldTiming.pass===newTiming.pass}));
}
run().catch(error=>{console.error(error);process.exitCode=1;});
