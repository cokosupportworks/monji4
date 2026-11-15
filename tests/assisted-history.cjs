const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const{makeDOM}=require('./dom-harness.cjs'),{isFullyAssisted,groupWords}=require('../word-archive.js');
const stroke=[{x:.2,y:.3,t:0},{x:.8,y:.7,t:500}],record=(id,skipped,assisted=true)=>({id,char:'ぬ',word:'ぬ',index:0,practiceId:id,date:'2026-11-16T01:00:00Z',strokes:[stroke,stroke],skipped,assisted,settings:{}});
assert.equal(isFullyAssisted(record('all',[true,true])),true);
assert.equal(isFullyAssisted({...record('one',[true]),strokes:[stroke]}),true,'one-stroke character entirely helped is excluded');
assert.equal(isFullyAssisted(record('part',[true,false])),false);assert.equal(isFullyAssisted(record('self',[false,false],false)),false);
assert.equal(isFullyAssisted(record('legacy',undefined)),false,'missing old per-stroke metadata is not guessed from assisted flag');
assert.equal(isFullyAssisted(record('short',[true])),false,'missing flags do not prove every stroke was helped');
assert.equal(isFullyAssisted({...record('empty',[]),strokes:[]}),false);
const base=path.resolve(__dirname,'..'),{document}=makeDOM(fs.readFileSync(path.join(base,'index.html'),'utf8'));
const records=[record('all',[true,true]),record('part',[true,false]),record('self',[false,false],false)];let writes=0;
const context={document,console,performance,structuredClone,crypto:require('node:crypto').webcrypto,setTimeout,clearTimeout,window:{devicePixelRatio:1,addEventListener(){},monjiArchive:{list:async()=>records,put:async()=>writes++,saveState:async()=>{}},monjiSettings:{display:{auto:false}}},requestAnimationFrame:()=>1,cancelAnimationFrame(){},ResizeObserver:class{observe(){}},localStorage:{getItem(){return null;},setItem(){}}};
vm.createContext(context);for(const file of ['core.js','journey.js','word-archive.js'])vm.runInContext(fs.readFileSync(path.join(base,file),'utf8'),context);
let src=fs.readFileSync(path.join(base,'app.js'),'utf8');src=src.slice(0,src.indexOf('    let booting = false;'))+' globalThis.testExports={App,loader}; })();';vm.runInContext(src,context);context.testExports.loader.load=async()=>['M20,50 L90,50'];
async function run(){
 const app=new context.testExports.App();await new Promise(setImmediate);const original=JSON.stringify(records);await app.renderRecordModal();document.getElementById('archiveCharTab').click();
 const page=document.getElementById('archiveCharPage');assert.deepEqual(page.querySelectorAll('.archive-letter-card').map(n=>n.dataset.recordId),['part','self']);
 app.renderCharacterArchive(records,page,'all');assert.equal(page.querySelector('.archive-canvas'),null,'excluded selection does not silently open another character');assert.match(page.querySelector('.archive-detail').textContent||page.querySelector('.archive-detail').children[0].textContent,/ぜんぶ おてつだい/);
 app.renderCharacterArchive([records[0]],page);assert.equal(page.querySelectorAll('.archive-letter-card').length,0);assert.ok(page.querySelector('.album-empty'));
 assert.equal(JSON.stringify(records),original,'stored strokes and whole-word records are preserved');assert.equal(writes,0,'opening the album never rewrites stored history');assert.equal(groupWords(records)[0].attempts.length,3,'word grouping retains the fully assisted practice');
 const many=Array.from({length:65},(_,i)=>record('help'+i,[true,true]));app.renderCharacterArchive([...many,records[1]],page);assert.deepEqual(page.querySelectorAll('.archive-letter-card').map(n=>n.dataset.recordId),['part'],'filter is applied before pagination');
 console.log('PASS: fully helped strokes excluded from character history, partial/self records kept, conservative legacy handling, selection fallback, empty history, pagination and unchanged word/storage records');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
