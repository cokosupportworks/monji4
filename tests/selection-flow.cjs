const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {makeDOM}=require('./dom-harness.cjs');const base=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(base,'index.html'),'utf8'),{document}=makeDOM(html);
const lessons=[{id:'dog',word:'いぬ',label:'いぬ'}];const archive={list:async()=>[],put:async()=>{},saveState:async()=>{},listLessons:async()=>lessons,saveLesson:async input=>{const lesson={...input,id:input.id||'saved'};lessons.push(lesson);return{lesson,action:'created'};}};
const ctx={document,console,performance,structuredClone,crypto:require('node:crypto').webcrypto,setTimeout,clearTimeout,
 window:{devicePixelRatio:1,addEventListener(){},monjiArchive:archive,monjiSettings:{display:{auto:false,train:true},requests:{voice:false}}},requestAnimationFrame:()=>1,cancelAnimationFrame(){},ResizeObserver:class{observe(){}},localStorage:{getItem(){return null;},setItem(){}}};
vm.createContext(ctx);for(const file of ['core.js','lessons.js','journey.js','word-archive.js'])vm.runInContext(fs.readFileSync(path.join(base,file),'utf8'),ctx);
let source=fs.readFileSync(path.join(base,'app.js'),'utf8');source=source.slice(0,source.indexOf('    let booting = false;'))+' globalThis.testExports={App,loader}; })();';vm.runInContext(source,ctx);ctx.testExports.loader.load=async()=>['M20,50 L90,50'];
const flush=()=>new Promise(setImmediate),get=id=>document.getElementById(id);
async function run(){
 const app=new ctx.testExports.App();await flush();const lib=app.lessonLibrary;let starts=0;const set=app.setWord.bind(app);app.setWord=(...args)=>{starts++;return set(...args);};
 get('btnOpenSelect').click();await flush();const original=app.word;
 const key=ch=>{const button=get('charGrid').children.find(b=>b.textContent===ch);assert.ok(button,'keyboard includes '+ch);button.click();};
 key('ね');key('こ');assert.equal(lib.word.value,'ねこ');assert.equal(app.word,original);assert.equal(starts,0);assert.equal(get('modalSelect').classList.contains('open'),true,'choosing letters never starts immediately');assert.equal(get('lessonDraftPreview').children.length,2);
 app.selectCategoryTab('katakana');key('ネ');assert.equal(lib.word.value,'ねこネ','switching keyboard preserves composed word');get('btnDraftBackspace').click();assert.equal(lib.word.value,'ねこ');
 get('btnSourceSaved').click();assert.equal(get('presetPanel').hidden,true);lib.list.querySelector('.saved-lesson-choice').click();assert.equal(lib.word.value,'いぬ');assert.equal(starts,0,'saved choice also waits for confirmation');get('btnSourceKeys').click();assert.equal(lib.word.value,'いぬ');assert.equal(get('lessonSearch'),null,'search input is removed');
 get('btnDraftClear').click();assert.equal(lib.start.disabled,true);lib.word.value='あ'.repeat(20);lib.syncDraft();app.selectCategoryTab('hiragana');key('ね');assert.equal(Array.from(lib.word.value).length,20,'keyboard cannot append a 21st character');
 lib.word.value='𠮷';lib.syncDraft();get('btnDraftBackspace').click();assert.equal(lib.word.value,'','delete uses Unicode characters, not surrogate halves');
 key('ぬ');lib.word.emit('keydown',{key:'Enter',isComposing:true});assert.equal(starts,0,'IME confirmation does not start practice');lib.start.click();await flush();assert.equal(starts,1,'explicit start calls App exactly once');assert.equal(app.word,'ぬ');assert.equal(get('modalSelect').classList.contains('open'),false);
 get('btnOpenSelect').click();await flush();lib.clearEditor();get('btnSequenceMode').click();assert.equal(lib.start.hidden,true);assert.equal(lib.queueStart.hidden,false);assert.equal(lib.queueStart.disabled,true);
 key('ね');key('こ');get('btnQueueDraft').click();assert.deepEqual(Array.from(lib.queue),['ねこ']);assert.equal(lib.word.value,'');key('い');key('ぬ');get('btnQueueDraft').click();
 const second=get('lessonQueueList').children[1];second.children[1].click();assert.deepEqual(Array.from(lib.queue),['いぬ','ねこ'],'queue can be reordered');get('lessonQueueList').children[0].children[2].click();assert.deepEqual(Array.from(lib.queue),['ねこ','いぬ']);
 key('あ');key('め');assert.match(lib.queueStart.textContent,/3/);lib.queueStart.click();await flush();assert.deepEqual(Array.from(app.lessonSequence),['ねこ','いぬ','あめ'],'start includes unfinished draft once, after the explicitly queued lessons');assert.equal(app.word,'ねこ');
 get('btnOpenSelect').click();await flush();lib.clearEditor();get('btnSingleMode').click();key('め');await lib.save.onclick();assert.equal(lib.word.value,'め','registering a task preserves the composed word for starting');assert.ok(lessons.some(r=>r.word==='め'));
 const before=starts;get('btnCloseSelect').click();assert.equal(starts,before,'close cancels without starting');get('btnOpenSelect').click();document.emit('keydown',{key:'Escape'});assert.equal(get('modalSelect').classList.contains('open'),false);
 lib.queue=Array.from({length:20},()=> 'あ');lib.word.value='い';lib.syncDraft();assert.equal(lib.queueStart.disabled,true,'no silently omitted 21st task');
 for(const word of ['あ あ','あ'.repeat(21)]){lib.word.value=word;lib.word.oninput();assert.equal(lib.start.disabled,true);assert.ok(lib.status.textContent,'invalid manual entry explains why start is unavailable');}
 clearTimeout(app.tTimer);clearTimeout(app.autoAdvanceTimer);clearTimeout(app.stopRequestTimer);
 console.log('PASS: keyboard composition before explicit start, mixed tabs, draft preview and Unicode delete, no search, saved selection confirmation, IME, one start event, sequence ordering and pending draft, registration without clearing, cancellation and limits');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
