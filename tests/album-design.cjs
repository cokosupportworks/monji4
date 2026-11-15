const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {makeDOM}=require('./dom-harness.cjs');
const base=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(base,'index.html'),'utf8');
assert.match(html,/<ruby>作品帳<rt>さくひんちょう<\/rt><\/ruby>/,'the title has a real ruby reading');
const {document}=makeDOM(html),strokes=[[{x:.2,y:.3,t:0},{x:.7,y:.6,t:500}]];
const records=Array.from({length:30},(_,i)=>({id:'r'+i,word:'ことば'+i,index:0,char:'こ',practiceId:'p'+i,practiceStartedAt:'2026-11-15T01:00:00.000Z',date:'2026-11-15T01:00:'+String(i).padStart(2,'0')+'.000Z',strokes,skipped:[false],settings:{hotaru:true,level:'normal',display:{direction:'horizontal'}}}));
records.push({id:'old',word:'ねこ',index:0,char:'ね',date:'2026-11-14T01:00:00.000Z',strokes,skipped:[false],settings:{hotaru:false,level:'normal'}});
let writes=0;const archive={saveState:async()=>{},list:async()=>records,put:async()=>{writes++;}};
const context={document,console,performance,structuredClone,crypto:require('node:crypto').webcrypto,setTimeout,clearTimeout,
 window:{devicePixelRatio:1,addEventListener(){},monjiArchive:archive,monjiSettings:{display:{auto:false}}},
 requestAnimationFrame:()=>1,cancelAnimationFrame(){},ResizeObserver:class{observe(){}},localStorage:{getItem(){return null;},setItem(){}}};
vm.createContext(context);for(const file of ['core.js','journey.js','word-archive.js'])vm.runInContext(fs.readFileSync(path.join(base,file),'utf8'),context);
let source=fs.readFileSync(path.join(base,'app.js'),'utf8');source=source.slice(0,source.indexOf('    let booting = false;'))+' globalThis.testExports={App,loader}; })();';
vm.runInContext(source,context);context.testExports.loader.load=async()=>['M20,50 L90,50'];
function readable(node,inRuby=false){
 const ruby=node.tagName==='RUBY';
 if(ruby){const reading=node.querySelector('rt');assert.ok(reading&&reading.textContent,'ruby has an actual reading');}
 if(!inRuby&&!ruby)assert.ok(!/[\u3400-\u9fff]/u.test(node.textContent),'unread kanji in static album copy: '+node.textContent);
 for(const child of node.children)readable(child,inRuby||ruby);
}
async function run(){
 const app=new context.testExports.App();await new Promise(setImmediate);await app.renderRecordModal();
 const body=document.querySelector('#modalRecord .modal-body'),page=document.getElementById('archiveWordPage');
 readable(body);
 assert.equal(page.querySelectorAll('.word-book-entry').length,24,'large collections initially paint only 24 covers');
 const cover=page.querySelector('.word-book-entry'),preview=cover.querySelector('canvas');
 assert.ok(preview.getContext('2d').trace.some(c=>c[0]==='lineTo'),'covers feature real handwriting');
 assert.ok(!preview.getContext('2d').trace.some(c=>c[0]==='fillText'),'cover artwork does not impersonate handwriting with a font');
 page.querySelector('.album-more').click();assert.equal(page.querySelectorAll('.word-book-entry').length,31);readable(body);
 cover.click();readable(body);assert.ok(page.querySelector('.album-date-select'),'practice dates are chosen with a compact labelled picker');
 const date=page.querySelector('.album-date-select');assert.ok(date.children[0].textContent.includes('ねん'));assert.ok(date.children[0].textContent.includes('がつ'));
 page.querySelector('.word-sheet-tile').click();readable(body);
 const charPage=document.getElementById('archiveCharPage');
 assert.equal(charPage.hidden,false);assert.ok(charPage.querySelector('.album-letter-thumb'),'letter list has handwriting thumbnails');
 const star=charPage.querySelector('.album-piece-controls').children[2];await star.onclick();
 assert.equal(writes,1);assert.equal(star.getAttribute('aria-pressed'),'true');readable(body);
 assert.equal(charPage.querySelector('.album-inline-status').textContent,'おきにいりに いれたよ。');
 archive.put=async()=>{throw new Error('quota');};await star.onclick();readable(body);
 assert.equal(star.getAttribute('aria-pressed'),'true','a failed favourite save does not pretend it changed');
 document.getElementById('archiveWordTab').click();app.wordAlbum.drawWord(app.wordAlbum.words.find(entry=>entry.word==='ねこ'));readable(body);
 const empty=document.createElement('div');new context.MonjiWords.WordAlbum(empty,[],()=>{});readable(empty);assert.ok(empty.querySelector('.album-empty'));
 // Kanji in the child's actual prompt are preserved rather than inventing a reading.
 const kanji={...records[0],id:'kanji',word:'学校',char:'学',practiceId:'school'};
 const custom=document.createElement('div');const book=new context.MonjiWords.WordAlbum(custom,[kanji],()=>{});
 assert.equal(custom.querySelector('.word-book-entry strong').textContent,'学校');book.drawWord(book.words[0]);assert.equal(custom.querySelector('.album-word-heading').textContent,'学校');
 archive.list=async()=>{throw new Error('unavailable');};await app.renderRecordModal();readable(body);
 assert.ok(body.children[0].textContent.includes('ひらけなかった'),'archive errors remain child-readable');
 clearTimeout(app.tTimer);clearTimeout(app.stopRequestTimer);clearTimeout(app.autoAdvanceTimer);
 console.log('PASS: ruby readings, kana interface copy, child-readable dates, handwriting covers, bounded gallery, favourite feedback and preserved prompt characters');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
