const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const appDirectory = path.resolve(__dirname, '..');
const core = require(path.join(appDirectory, 'core.js'));

const normal = { dev:26,startTol:32,maxRatio:1.6,validRatio:.85,minCoverage:.8 };
const strict = { dev:16,startTol:20,maxRatio:1.3,validRatio:.92,minCoverage:.9 };
const line = [{x:0,y:0},{x:100,y:0}];
assert.equal(core.evaluate(line,line,normal).pass,true,'two-point short input is usable');
assert.equal(core.evaluate(line,[...line].reverse(),normal).pass,false,'reversed direction');
assert.equal(core.evaluate(line,[{x:100,y:100},{x:150,y:100}],normal).pass,false,'wrong start');
assert.equal(core.evaluate(line,[{x:0,y:0},{x:50,y:0}],strict).pass,false,'unfinished');
const arc=Array.from({length:101},(_,i)=>({x:100*Math.cos(Math.PI*i/100),y:100*Math.sin(Math.PI*i/100)}));
assert.equal(core.evaluate(arc,arc,normal).pass,true,'curved stroke');
assert.equal(core.evaluate(arc,[arc[0],arc[50],arc[100]],normal).pass,false,'shortcut through curved stroke is rejected');
assert.equal(core.evaluate(line,[{x:0,y:0},{x:100,y:0},{x:0,y:0},{x:100,y:0}],normal).pass,false,'scribbling');
const packed=core.pack([[{x:20,y:40,t:123}]],200,200);
assert.deepEqual(core.unpack(packed,400,400),[[{x:40,y:80,t:123}]],'resize preserves geometry and timestamps');
assert.equal(core.evaluate([{x:0,y:0},{x:4,y:0}],[{x:0,y:0},{x:4,y:0}],normal).pass,true,'short stroke');
assert.equal(core.evaluate(line,[{x:0,y:0}],normal).pass,false,'tap alone');

function element(){return {textContent:'',dataset:{},hidden:false,classList:{add(){},remove(){},toggle(){},contains(){return false;}},style:{},replaceChildren(){},append(){},setAttribute(){}};}
const els=new Map(); const get=id=>{if(!els.has(id))els.set(id,element());return els.get(id);};
const context={console,MonjiCore:core,MonjiOrientationMatches:require('../journey.js').orientationMatches,performance,structuredClone,crypto:require('node:crypto').webcrypto,
  setTimeout,clearTimeout,requestAnimationFrame:()=>1,cancelAnimationFrame(){},
  document:{getElementById:get,querySelector:()=>null,hidden:false}, window:{},localStorage:{getItem(){return null;},setItem(){}}};
context.globalThis=context;
let source=fs.readFileSync(path.join(appDirectory, 'app.js'),'utf8');
source=source.slice(0,source.indexOf('    let booting = false;'))+' globalThis.testExports={App,loader,speech}; })();';
vm.runInNewContext(source,context);
const {App,loader,speech}=context.testExports; speech.enabled=false;
function app(){const a=Object.create(App.prototype);Object.assign(a,{level:'normal',params:{normal},loadGeneration:0,word:'あい',chars:['あ','い'],cIdx:0,sessions:[],loadedIndex:null,strokes:[],userStrokes:[],skipped:[],drawing:[],W:400,H:400,hotaru:{enabled:false},hanamaru:element(),
  archive:{saveState:async()=>{},put:async()=>{}},unsavedRecords:{},baseOpacity:1,
  render(){},renderPills(){},stopAnim(){},stopHotaru(){},setNotice(text){this.notice=text;},
  saveDraft(){this.rememberCurrent();},storageStatus(ok){this.saved=ok;},saveHistoryRecord(){this.historyCount=(this.historyCount||0)+1;}});return a;}
async function run(){
  let resolvers={};loader.load=ch=>new Promise((resolve,reject)=>resolvers[ch]={resolve,reject});
  const a=app();const first=a.loadChar();a.cIdx=1;const second=a.loadChar();
  resolvers['い'].resolve(['M1,1 L2,2']);await second;
  resolvers['あ'].resolve(['M3,3 L4,4','M5,5 L6,6']);await first;
  assert.equal(a.strokes.length,1,'stale response cannot replace current character');
  assert.equal(a.loadedIndex,1);
  loader.load=async()=>{throw new Error('offline');};await a.loadChar();
  assert.equal(a.strokes.length,0,'network error cannot leave old strokes active');
  assert.match(a.notice,/ひらけなかった/);assert.equal(a.loading,false);
  const b=app();b.loading=false;b.loadedIndex=0;b.strokes=['M1,1 L2,2'];b.sIdx=1;b.userStrokes=[[{x:20,y:30,t:10},{x:80,y:60,t:100}]];b.skipped=[true];
  let record;b.archive.put=async r=>{record=r;};await b.finishChar();
  assert.equal(record.assisted,true);assert.equal(b.historyCount,undefined,'skip is not a self-completed count');
  assert.equal(record.strokes[0][0].x,.05);assert.equal(b.sessions[0].archived,true);
  const c=app();c.loading=false;c.loadedIndex=0;c.strokes=['M1,1 L2,2'];c.sIdx=1;c.userStrokes=b.userStrokes;c.skipped=[false];
  c.archive.put=async()=>{throw new Error('quota');};await c.finishChar();
  assert.equal(c.saved,false,'quota failure stays visible');assert.equal(Object.keys(c.unsavedRecords).length,1,'failed save remains exportable');
  assert.equal(c.sessions[0].archived,undefined,'failed save is not marked archived');
  const d=app();d.loading=false;d.strokes=['M1,1 L2,2'];d.sIdx=0;d.isDown=true;d.requests={voice:false};
  d.hotaru={enabled:true,currentOpacity:0};d.askGently('pause');
  assert.match(get('coachMessage').textContent,/おもいうかべて/,'hidden-model pause gets memory cue');
  const message=get('coachMessage').textContent;d.askGently('speed');
  assert.equal(get('coachMessage').textContent,message,'requests do not repeat during cooldown');
  d.isDown=false;d.lastRequest=-20000;d.askGently('speed');
  assert.equal(get('coachMessage').textContent,message,'lifting the pen does not trigger pause requests');
  const travelling=app();travelling.loading=false;travelling.loadedIndex=0;travelling.sIdx=1;
  travelling.strokes=['M1,1 L2,2'];travelling.userStrokes=[[{x:40,y:80,t:10},{x:80,y:100,t:50}]];travelling.skipped=[false];
  let completeMove;const motionFinished=new Promise(resolve=>completeMove=resolve);
  travelling.journey={viewport:element(),move:()=>motionFinished,refresh(){}};
  loader.load=async()=>['M1,1 L2,2'];
  const travel=travelling.travelTo(1);await new Promise(setImmediate);
  assert.equal(travelling.transitioning,true);assert.equal(travelling.cIdx,0,'current index stays until movement completes');
  assert.equal(travelling.inputEnabled(),false,'no drawing while travelling');
  completeMove();await travel;
  assert.equal(travelling.cIdx,1);assert.equal(travelling.sessions[0].strokes[0][0].x,.1,'departing handwriting retained');
  assert.equal(travelling.transitioning,false);
  loader.load=async()=>{throw new Error('offline');};travelling.showToast=()=>{};
  await travelling.travelTo(0);assert.equal(travelling.cIdx,1,'failed destination leaves current character in place');
  const archiveContext={};vm.runInNewContext(fs.readFileSync(path.join(appDirectory, 'archive.js'),'utf8'),archiveContext);
  const store=Object.create(archiveContext.StrokeArchive.prototype);store.pending=Promise.resolve();
  let tx,request;
  store.database={transaction(){tx={objectStore:()=>({put(){request={};return request;}})};return tx;}};
  let committed=false;const writing=store.put({id:'one'}).then(()=>{committed=true;});await new Promise(setImmediate);
  request.result='one';request.onsuccess();await Promise.resolve();
  assert.equal(committed,false,'request success is not reported as transaction commit');
  tx.oncomplete();await writing;assert.equal(committed,true,'successful commit resolves save');
  const failing=store.put({id:'two'});await new Promise(setImmediate);
  request.result='two';request.onsuccess();tx.error=new Error('quota');tx.onabort();
  await assert.rejects(failing,/quota/,'transaction abort propagates even after request success');
  console.log('PASS: geometry, resize, async-load, assisted records, failed-save recovery, gentle requests and transaction-commit checks');
}
run().catch(e=>{console.error(e);process.exitCode=1;});
