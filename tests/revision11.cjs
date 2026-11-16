const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const{makeDOM}=require('./dom-harness.cjs');const{trainColor}=require('../journey.js');
assert.equal(trainColor([... 'あい'],new Set()),'white');
assert.equal(trainColor([... 'あい'],new Set(['あ'])),'green');
assert.equal(trainColor([... 'あいう'],new Set(['あ'])),'green');
assert.equal(trainColor([... 'ああい'],new Set(['あ'])),'blue','counts character occurrences, including repeats');
assert.equal(trainColor([... 'あい'],new Set(['あ','い'])),'red');
const base=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(base,'index.html'),'utf8'),{document}=makeDOM(html);
const records=[{char:'あ',assisted:true}],states=new Map(),timers=new Map();let timer=0;
const archive={list:async()=>records,put:async r=>records.push(structuredClone(r)),saveState:async(k,v)=>states.set(k,structuredClone(v)),listLessons:async()=>[{id:'cat',word:'ねこ',label:'ねこ'},{id:'dog',word:'いぬ',label:'いぬ'}]};
const ctx={document,console,performance,structuredClone,crypto:require('node:crypto').webcrypto,
 setTimeout(fn,delay){timers.set(++timer,{fn,delay});return timer;},clearTimeout(id){timers.delete(id);},
 window:{devicePixelRatio:1,addEventListener(){},monjiArchive:archive,monjiSettings:{display:{auto:false,train:true,direction:'horizontal'},requests:{voice:false}}},
 requestAnimationFrame:()=>1,cancelAnimationFrame(){},ResizeObserver:class{observe(){}},localStorage:{getItem(){return null;},setItem(){}}};
vm.createContext(ctx);for(const file of ['core.js','journey.js','word-archive.js','lessons.js'])vm.runInContext(fs.readFileSync(path.join(base,file),'utf8'),ctx);
let src=fs.readFileSync(path.join(base,'app.js'),'utf8');src=src.slice(0,src.indexOf('    let booting = false;'))+' globalThis.testExports={App,loader,sound,speech}; })();';vm.runInContext(src,ctx);
const{App,loader,sound,speech}=ctx.testExports;loader.load=async()=>['M20,50 L90,50'];const spoken=[],rails=[];speech.speak=(text)=>spoken.push(text);sound.train=(duration)=>{rails.push(duration);return()=>{};};
const flush=()=>new Promise(setImmediate);
async function finish(app){app.sIdx=1;app.userStrokes=[[{x:20,y:50,t:0},{x:90,y:50,t:500}]];app.skipped=[false];await app.finishChar();}
async function run(){
 const app=new App();await flush();
 const panel=document.getElementById('presetPanel');assert.equal(panel.parentNode.children[0],panel,'letter table is the first section');
 const hotaru=document.getElementById('hotaruSettings');assert.equal(hotaru.parentNode.children[0],hotaru,'hotaru toggle is first in settings');
 document.getElementById('btnOpenSelect').click();await flush();assert.ok(document.getElementById('charGrid').children.length>40,'hiragana table populated');
 for(const tab of ['katakana','kanji1','kanji2','numbers']){app.selectCategoryTab(tab);assert.ok(document.getElementById('charGrid').children.length>0,tab+' table is populated');}
 document.getElementById('btnCloseSelect').click();
 for(const[word,color]of [['ぬめ','white'],['あぬ','green'],['ああぬ','blue'],['ああ','red']]){await app.setWord(word);assert.equal(app.trainTheme,color);assert.match(app.journey.cards[2].art.src,new RegExp('-'+color+'\\.svg$'));}
 await app.setWord('あい');spoken.length=0;await finish(app);assert.deepEqual(spoken,[],'no speech for an intermediate character');assert.equal(rails.length,0,'completion itself does not start the rail sound');assert.equal(app.trainTheme,'green','train color stays fixed during this practice');
 await app.travelTo(1);assert.deepEqual(spoken,[],'auto/manual next letter does not speak a new line');await finish(app);assert.deepEqual(spoken,['全部書けました！出発、進行〜']);
 await app.finishPractice();assert.equal(app.journey.viewport.classList.contains('word-finished'),true);
 let finale=app.journey.finale;assert.equal(finale.querySelectorAll('.whole-train-car').length,3,'entire train includes engine and every letter');assert.equal(finale.querySelectorAll('canvas').length,2,'every completed letter uses its own ink');
 let buttons=finale.querySelectorAll('button');assert.deepEqual(buttons.map(b=>b.textContent),['もういっかい','おだいをえらぶ']);
 await app.journey.refresh(app.chars,1,app.sessions,loader,()=>[]);assert.equal(app.journey.viewport.classList.contains('word-finished'),true,'refresh cannot expose the final writing car');
 assert.equal(states.get('draft').finished,true,'finished state is saved');
 buttons[0].click();await flush();assert.equal(app.journey.finale,null,'repeat starts a fresh practice');assert.equal(app.trainTheme,'red','repeated word is now fully practiced');
 const lib=app.lessonLibrary;await lib.refresh();lib.clearEditor();lib.setMode('sequence');lib.addQueue('ねこ');lib.addQueue('いぬ');assert.deepEqual(Array.from(lib.queue),['ねこ','いぬ']);lib.queueStart.click();await flush();assert.equal(app.word,'ねこ');assert.equal(app.lessonSequence.length,2);
 app.sessions=app.chars.map(()=>({complete:true,strokes:[[{x:.2,y:.5,t:0},{x:.8,y:.5,t:500}]],skipped:[false]}));app.showPracticeEnd();finale=app.journey.finale;buttons=finale.querySelectorAll('button');assert.equal(buttons[1].textContent,'つぎのおだい');buttons[1].click();await flush();assert.equal(app.word,'いぬ');assert.equal(app.lessonIndex,1);assert.deepEqual(Array.from(states.get('draft').sequence),['ねこ','いぬ']);
 app.showPracticeEnd();assert.equal(app.journey.finale.querySelectorAll('button')[1].textContent,'おだいをえらぶ','no phantom next task at the end of the queue');
 const draft=states.get('draft');await app.setWord(draft.word,draft);assert.ok(app.journey.finale,'reloading a completed draft restores the whole train');assert.equal(app.lessonIndex,1);
 assert.equal(document.querySelector('.album-title-firefly').classList.contains('hotaruko-bust'),true);
 const album=new ctx.MonjiWords.WordAlbum(document.createElement('div'),[],()=>{});assert.ok(album.container.querySelector('.hotaruko-bust'),'album hero uses the same bust illustration');
 console.log('PASS: visible first letter table, first hotaru controls, history color boundaries and repeats, silent intermediate completion, final announcement, whole-train ending, repeat/selection/queue buttons, persisted sequence/end and Hotaruko album bust');
}
run().catch(e=>{console.error(e);process.exitCode=1;});
