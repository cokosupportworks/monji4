const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {makeDOM}=require('./dom-harness.cjs');
const {groupWords}=require('../word-archive.js');
const base=path.resolve(__dirname,'..');
const stroke=[[{x:.2,y:.3,t:100},{x:.8,y:.6,t:500}]];
function record(id,word,index,practiceId,date='2026-11-15T01:00:00.000Z'){
 return{id,word,index,practiceId,char:Array.from(word)[index],date,practiceStartedAt:date,strokes:stroke,skipped:[false],settings:{hotaru:true,level:'normal',display:{direction:'horizontal'}},favorite:false};
}
const records=[record('a0','もも',0,'a'),record('a1','もも',1,'a'),record('b0','もも',0,'b','2026-11-16T01:00:00.000Z'),record('a0redo','もも',0,'a','2026-11-15T02:00:00.000Z'),record('legacy','もも',1,null)];
const frozen=JSON.stringify(records),words=groupWords(records),word=words[0];
assert.equal(word.attempts.length,2,'separate practice IDs never merge');
assert.equal(word.attempts[0].slots[1],null,'missing letter is not borrowed from another practice');
assert.equal(word.attempts[1].slots[0].id,'a0redo','rewritten position uses latest saved writing');
assert.equal(word.attempts[1].slots[1].char,'も','repeated characters retain their individual positions');
assert.equal(word.legacy.length,1,'old records are not guessed into a practice');
assert.equal(JSON.stringify(records),frozen,'grouping never rewrites source records');
assert.equal(groupWords([{...record('bad','ねこ',0,'x'),char:'こ'}])[0].attempts.length,0,'wrong positions are not treated as a complete word');

const {document}=makeDOM(fs.readFileSync(path.join(base,'index.html'),'utf8'));
const stored=new Map();const frames=new Map();let frameId=0;
const archive={saveState:async()=>{},put:async r=>stored.set(r.id,structuredClone(r)),list:async()=>[...stored.values()].sort((a,b)=>b.date.localeCompare(a.date))};
const context={document,console,performance,structuredClone,crypto:require('node:crypto').webcrypto,setTimeout,clearTimeout,
 window:{devicePixelRatio:1,addEventListener(){},monjiArchive:archive,monjiSettings:{display:{mode:'fixed',auto:false}}},
 requestAnimationFrame:fn=>{frames.set(++frameId,fn);return frameId;},cancelAnimationFrame:id=>frames.delete(id),
 ResizeObserver:class{observe(){}},localStorage:{getItem(){return null;},setItem(){}}};
vm.createContext(context);for(const file of ['core.js','journey.js','word-archive.js'])vm.runInContext(fs.readFileSync(path.join(base,file),'utf8'),context);
let source=fs.readFileSync(path.join(base,'app.js'),'utf8');source=source.slice(0,source.indexOf('    let booting = false;'))+' globalThis.testExports={App,loader}; })();';
vm.runInContext(source,context);context.testExports.loader.load=async()=>['M20,50 L90,50'];
const flush=()=>new Promise(setImmediate);
async function run(){
 const app=new context.testExports.App();await flush();await app.setWord('もも');await app.journey.ready;
 const practice=app.practiceId;
 let slots=document.getElementById('wordPills').children;
 assert.equal(slots.length,2);assert.equal(slots[0].querySelector('canvas').getContext('2d').trace.length,0,'unfinished header slot is blank');
 app.userStrokes=stroke.map(line=>line.map(p=>({x:p.x*app.W,y:p.y*app.H,t:p.t})));app.skipped=[false];app.sIdx=1;
 await app.finishChar();slots=document.getElementById('wordPills').children;
 assert.equal(slots[0].classList.contains('completed'),true);
 const trace=slots[0].querySelector('canvas').getContext('2d').trace;
 assert.ok(trace.some(c=>c[0]==='moveTo'&&c[1]===.2*96&&c[2]===.3*96),'header paints actual normalized handwriting');
 assert.ok(!trace.some(c=>c[0]==='fillText'),'header does not substitute a font glyph');
 const header=document.getElementById('wordPills'),firstSlot=header.children[0],before=trace.length;
 app.applyModelOpacity(0);app.applyModelOpacity(1);
 assert.equal(header.children[0],firstSlot,'blinking does not rebuild header slots');assert.equal(trace.length,before,'blinking does not redraw header handwriting');
 assert.ok(!header.classList.contains('model-hidden'),'header never joins model blinking');
 await app.travelTo(1);assert.equal(header.children[0],firstSlot,'header slots keep their identity when moving to the next character');
 assert.equal(trace.length,before,'completed thumbnails are not repainted when only current position changes');
 app.userStrokes=stroke.map(line=>line.map(p=>({x:p.x*app.W,y:p.y*app.H,t:p.t})));app.skipped=[false];app.sIdx=1;await app.finishChar();
 assert.ok([...stored.values()].every(r=>r.practiceId===practice));assert.equal(groupWords([...stored.values()])[0].attempts[0].slots.filter(Boolean).length,2);
 await app.renderRecordModal();document.getElementById('modalRecord').classList.add('open');
 const wordPage=document.getElementById('archiveWordPage');assert.equal(wordPage.hidden,false,'word page is the initial album page');
 wordPage.querySelector('.word-book-entry').click();assert.equal(wordPage.querySelectorAll('.word-sheet-tile').length,2);
 const replay=wordPage.querySelector('.word-replay-controls').children[0];replay.click();
 assert.equal(frames.size,1);const playback=[...frames.values()];frames.clear();for(const frame of playback)frame(performance.now()+20000);
 assert.equal(frames.size,0,'whole-word playback reaches the finished word');
 replay.click();const oldToken=app.wordAlbum.token;const stale=[...frames.values()];frames.clear();app.wordAlbum.cancelReplay();
 assert.ok(app.wordAlbum.token>oldToken);for(const frame of stale)frame(performance.now()+20000);assert.equal(frames.size,0,'cancelled word playback cannot schedule stale frames');
 wordPage.querySelector('.word-sheet-tile').click();assert.equal(document.getElementById('archiveCharPage').hidden,false,'word tile opens character details');
 document.getElementById('archiveWordTab').click();assert.equal(wordPage.hidden,false);
 const draft={word:app.word,index:app.cIdx,items:structuredClone(app.sessions),practiceId:app.practiceId,practiceStartedAt:app.practiceStartedAt};
 await app.setWord('もも',draft);assert.equal(app.practiceId,practice,'resuming a draft keeps its practice ID');
 await app.setWord('もも');assert.notEqual(app.practiceId,practice,'starting the same word again gets a separate practice ID');
 await app.setWord('一');app.userStrokes=stroke.map(line=>line.map(p=>({x:p.x*app.W,y:p.y*app.H,t:0})));app.skipped=[true];app.sIdx=1;await app.finishChar();
 const assistedThumb=document.getElementById('wordPills').querySelector('canvas').getContext('2d').trace;
 assert.ok(!assistedThumb.some(c=>c[0]==='moveTo'||c[0]==='lineTo'),'header does not pass off skipped model strokes as the child’s writing');
 // Exact draft IDs are the only association evidence for older records.
 vm.runInContext(fs.readFileSync(path.join(base,'archive.js'),'utf8'),context);
 const migration=Object.create(context.StrokeArchive.prototype);migration.pending=Promise.resolve();let tx;const gets=[],writes=[];
 migration.database={transaction(){tx={objectStore:()=>({get(id){const request={};gets.push({id,request});return request;},put(r){writes.push(r);}})};return tx;}};
 const migrating=migration.associateDraft('もも',[{id:'old0'},{id:'other'}],'new-id','2026-11-15');await flush();
 gets[0].request.result={...record('old0','もも',0,null),favorite:true};gets[0].request.onsuccess();
 gets[1].request.result=record('other','ねこ',1,null);gets[1].request.onsuccess();tx.oncomplete();await migrating;
 assert.equal(writes.length,1);assert.equal(writes[0].practiceId,'new-id');assert.equal(writes[0].favorite,true);assert.equal(writes[0].strokes,stroke);
 clearTimeout(app.tTimer);clearTimeout(app.autoAdvanceTimer);clearTimeout(app.stopRequestTimer);
 console.log('PASS: word grouping, repeated letters, missing slots, legacy records, draft identity, exact-ID association, stable handwriting header and album navigation');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
