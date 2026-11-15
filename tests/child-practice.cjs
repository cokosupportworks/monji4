const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {makeDOM}=require('./dom-harness.cjs');const{makeDB}=require('./lesson-db-harness.cjs');
const base=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(base,'index.html'),'utf8');
const childHTML=html.slice(0,html.indexOf('  <!-- 3. Settings Modal -->')).replace(/<ruby>[\s\S]*?<rt>([\s\S]*?)<\/rt><\/ruby>/g,'$1').replace(/<!--[\s\S]*?-->/g,'').replace(/<[^>]+>/g,'');
assert.ok(!/[\u3400-\u9fff]/u.test(childHTML),'static child surfaces contain no unread kanji outside ruby');
const{document}=makeDOM(html),{db,indexedDB}=makeDB();
const oldRecord=structuredClone(db.stores.get('records').get('old-writing'));
const context={document,indexedDB,console,performance,structuredClone,crypto:require('node:crypto').webcrypto,setTimeout,clearTimeout,
 window:{devicePixelRatio:1,addEventListener(){},monjiSettings:{display:{auto:false}}},requestAnimationFrame:()=>1,cancelAnimationFrame(){},ResizeObserver:class{observe(){}},localStorage:{getItem(){return null;},setItem(){}}};
vm.createContext(context);for(const file of ['core.js','lessons.js','archive.js','journey.js','word-archive.js'])vm.runInContext(fs.readFileSync(path.join(base,file),'utf8'),context);
let source=fs.readFileSync(path.join(base,'app.js'),'utf8');source=source.slice(0,source.indexOf('    let booting = false;'))+' globalThis.testExports={App,loader}; })();';vm.runInContext(source,context);
const flush=()=>new Promise(setImmediate);
function readable(node){
 if(node.id==='modalSettings'||node.classList.contains('char-card'))return; // Adult controls and actual practice characters are intentional.
 assert.ok(!/[\u3400-\u9fff]/u.test(node.textContent),'unread runtime practice copy: '+node.textContent);
 for(const [name,value]of Object.entries(node.attributes))if(name==='aria-label')assert.ok(!/[\u3400-\u9fff]/u.test(value),'unread child accessible label');
 for(const child of node.children)readable(child);
}
async function run(){
 const archive=new context.StrokeArchive();await archive.pending;assert.equal(db.version,2);assert.deepEqual(db.created,['lessons']);
 assert.deepEqual(db.stores.get('records').get('old-writing'),oldRecord,'schema upgrade preserves existing handwriting');
 await assert.rejects(archive.saveLesson({word:''}),/もじ/);await assert.rejects(archive.saveLesson({word:'あ'.repeat(21)}),/20/);
 const results=await Promise.all([archive.saveLesson({word:'か\u3099'}),archive.saveLesson({word:'が'})]);
 assert.equal(results[0].lesson.id,results[1].lesson.id,'concurrent canonical duplicates share one lesson');
 const cat=(await archive.saveLesson({word:'ねこ',label:'どうぶつ'})).lesson;
 const dog=(await archive.saveLesson({id:cat.id,word:'いぬ',label:'いぬの おだい'})).lesson;
 assert.equal(dog.id,cat.id);assert.equal(dog.createdAt,cat.createdAt);
 await assert.rejects(archive.saveLesson({id:dog.id,word:'が'}),/おなじ/);
 await archive.archiveLesson(dog.id,true);assert.equal((await archive.listLessons()).find(r=>r.id===dog.id).archived,true);
 const restored=await archive.saveLesson({word:'いぬ'});assert.equal(restored.action,'restored');assert.equal(restored.lesson.id,dog.id);assert.equal(restored.lesson.label,'いぬの おだい');
 db.failNextPut=true;await assert.rejects(archive.saveLesson({word:'ぬ'}),/quota/);assert.ok(!(await archive.listLessons()).some(r=>r.word==='ぬ'),'failed transaction creates no lesson');
 const reopened=new context.StrokeArchive();await reopened.pending;assert.equal((await reopened.listLessons()).length,2,'lessons persist across archive instances');
 context.window.monjiArchive=archive;context.testExports.loader.load=async()=>['M20,50 L90,50'];
 const app=new context.testExports.App();await flush();const lib=app.lessonLibrary;
 document.getElementById('btnOpenSelect').click();await flush();assert.equal(lib.records.length,2);
 lib.word.value='む';lib.label.value='はじめの おだい';await lib.save.onclick();assert.ok(lib.status.textContent.includes('とうろくした'));
 let lesson=lib.records.find(r=>r.word==='む'),row=lib.list.children.find(r=>r.dataset.lessonId===lesson.id);
 row.querySelector('.saved-lesson-choice').click();assert.equal(lib.word.value,'む');assert.equal(document.getElementById('modalSelect').classList.contains('open'),true);lib.start.click();await flush();assert.equal(app.word,'む');assert.equal(document.getElementById('modalSelect').classList.contains('open'),false);
 row.querySelector('.lesson-tools').children[0].click();lib.word.value='ゆ';lib.label.value='よむ おだい';await lib.save.onclick();
 assert.equal(lib.records.find(r=>r.id===lesson.id).word,'ゆ');
 lesson=lib.records.find(r=>r.id===lesson.id);await lib.shelve(lesson,true);assert.ok(lib.records.find(r=>r.id===lesson.id).archived);
 await lib.shelve(lib.records.find(r=>r.id===lesson.id),false);assert.equal(lib.records.find(r=>r.id===lesson.id).archived,false);
 lib.word.value='ゆ';await lib.save.onclick();assert.ok(lib.status.textContent.includes('もう ある'));
 db.failNextPut=true;lib.word.value='ね';await lib.save.onclick();assert.ok(lib.status.textContent.includes('のこせなかった'));
 await lib.current.onclick();assert.ok(lib.records.some(r=>r.word===app.word),'current task can be registered without typing it again');
 lib.setSource('saved');assert.equal(document.getElementById('savedLessonsPanel').hidden,false);lib.setSource('keys');assert.equal(document.getElementById('presetPanel').hidden,false);assert.equal(document.getElementById('lessonSearch'),null);
 readable(document.querySelector('header'));readable(document.querySelector('main'));readable(document.querySelector('footer'));readable(document.getElementById('modalSelect'));
 assert.equal(document.getElementById('badgeStrict').closest('#modalSettings')?.id,'modalSettings','judgement controls are outside child practice');
 assert.equal(document.getElementById('btnExportPending').closest('#modalSettings')?.id,'modalSettings','recovery details are in adult settings');
 document.getElementById('btnCloseSelect').click();document.getElementById('btnSound').click();readable(document.querySelector('header'));readable(document.querySelector('main'));
 app.storageStatus(false);readable(document.querySelector('footer'));app.setNotice('おてほんを ひらけなかったよ。');readable(document.querySelector('main'));
 app.journey.viewport.clientWidth;app.display.mode='fixed';app.journey.apply(app.display);app.journey.layout();readable(app.journey.note);
 const messages=[context.MonjiCore.evaluate([],[],app.params.normal).msg,context.MonjiCore.evaluate([{x:0,y:0},{x:100,y:0}],[],app.params.normal).msg];
 assert.ok(messages.every(msg=>!/[\u3400-\u9fff]/u.test(msg)),'judgement hints are child-readable too');
 clearTimeout(app.tTimer);clearTimeout(app.stopRequestTimer);clearTimeout(app.autoAdvanceTimer);
 console.log('PASS: child-facing static/runtime copy, adult control separation, schema upgrade, persistent lesson CRUD, duplicate prevention, rollback, restore, source switching and confirming a registered task');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
