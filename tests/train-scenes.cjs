const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const{makeDOM}=require('./dom-harness.cjs');const base=path.resolve(__dirname,'..');
const{document}=makeDOM(fs.readFileSync(path.join(base,'index.html'),'utf8'));const animations=[],timers=new Map();let timerId=0;
const Node=document.createElement('div').constructor;
Node.prototype.animate=function(frames,options){let resolve;const finished=new Promise(r=>resolve=r);const a={frames,options,finished,finish:resolve,cancel(){this.cancelled=true;}};animations.push(a);return a;};
const context={document,console,performance,structuredClone,crypto:require('node:crypto').webcrypto,
 setTimeout(fn,delay){timers.set(++timerId,{fn,delay});return timerId;},clearTimeout(id){timers.delete(id);},
 window:{devicePixelRatio:1,addEventListener(){},monjiArchive:{saveState:async()=>{},put:async()=>{}},monjiSettings:{display:{mode:'flow',direction:'vertical',auto:false,train:true},requests:{voice:false}}},
 requestAnimationFrame:()=>1,cancelAnimationFrame(){},ResizeObserver:class{observe(){}},localStorage:{getItem(){return null;},setItem(){}}};
vm.createContext(context);for(const file of ['core.js','journey.js','word-archive.js'])vm.runInContext(fs.readFileSync(path.join(base,file),'utf8'),context);
let src=fs.readFileSync(path.join(base,'app.js'),'utf8');src=src.slice(0,src.indexOf('    let booting = false;'))+' globalThis.testExports={App,loader,Sound}; })();';vm.runInContext(src,context);context.testExports.loader.load=async()=>['M20,50 L90,50'];
const flush=()=>new Promise(setImmediate);
async function verify(){
 const app=new context.testExports.App();await flush();const j=app.journey;
 assert.equal(app.transitioning,true);assert.equal(app.inputEnabled(),false);
 const arrival=animations.at(-1);assert.equal(arrival.options.duration,2600);assert.match(arrival.frames[0].transform,/translate\(-50%, calc\(-50% \+ [1-9]/);
 assert.match(j.cards[1].art.src,/locomotive-top-(white|green|blue|red).svg/);arrival.finish();await flush();assert.equal(app.transitioning,false);assert.equal(j.animation,null);assert.match(j.cards[1].art.src,/locomotive-top-(white|green|blue|red).svg/);
 app.chars=['あ','い'];app.sessions=[{},{}];app.cIdx=1;app.scheduleAdvance();assert.equal([...timers.values()].filter(t=>t.delay===1200).length,0);
 const changing=app.setWord('あ');await flush();animations.at(-1).finish();await changing;
 app.sIdx=1;app.userStrokes=[[{x:20,y:50,t:0},{x:90,y:50,t:600}]];app.skipped=[false];await app.finishChar();
 const finalTimer=[...timers.values()].find(t=>t.delay===1200);assert.ok(finalTimer,'all-complete departure is scheduled even with auto advance off');finalTimer.fn();await flush();
 const exit=animations.at(-1);assert.equal(exit.options.duration,2100);assert.match(exit.frames.at(-1).transform,/translate\(-50%, calc\(-50% \+ -/,'vertical last carriage exits above');assert.equal(app.transitioning,true);
 exit.finish();await flush();assert.equal(j.viewport.classList.contains('word-finished'),true);assert.equal(app.transitioning,false);assert.ok(app.sessions[0].complete,'departure preserves handwriting');assert.equal(app.departedPractice,app.practiceId);
 timers.clear();app.scheduleAdvance();assert.equal([...timers.values()].filter(t=>t.delay===1200).length,0,'same practice does not depart repeatedly');
 const restarting=app.setWord('い');await flush();animations.at(-1).finish();await restarting;assert.equal(j.track.style.visibility,'','new task restores the train');
 const count=animations.length;app.display.reduced=true;j.apply(app.display);await app.runTrainScene('arrival');assert.equal(animations.length,count,'reduced motion skips cinematic');
 app.display.reduced=false;app.display.train=false;j.apply(app.display);await app.runTrainScene('arrival');assert.equal(animations.length,count,'train off skips cinematic');
 app.display.train=true;app.display.mode='fixed';j.apply(app.display);await app.runTrainScene('arrival');assert.equal(animations.length,count,'fixed writing display remains stationary');
 app.display.mode='flow';app.display.direction='horizontal';j.apply(app.display);await j.refresh(app.chars,app.cIdx,app.sessions,context.testExports.loader,()=>[]);const horizontal=app.runTrainScene('arrival');await flush();assert.match(j.cards[1].art.src,/locomotive-side/);assert.equal(app.inputEnabled(),false);animations.at(-1).finish();await horizontal;
 const pending=app.runTrainScene('arrival');await flush();document.getElementById('btnSettings').click();await pending;assert.equal(app.transitioning,false,'opening settings finishes arrival without trapping input');assert.equal(j.animation,null);document.getElementById('btnCloseSettings').click();
 const beforeResume=animations.length;await app.setWord('い',{word:'い',items:[],index:0});assert.equal(animations.length,beforeResume,'resuming a draft does not replay arrival');
 let scheduled=0,stopped=0;const sound=new context.testExports.Sound();sound.ctx={state:'running',currentTime:0,destination:{},createOscillator(){scheduled++;return{frequency:{setValueAtTime(){}},connect(){},start(){},stop(){stopped++;}};},createGain(){return{gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}};}};
 sound.on=false;sound.train(2100);assert.equal(scheduled,0,'muted sound schedules no wheel clicks');sound.on=true;const stop=sound.train(2100);assert.ok(scheduled>0);const naturalStops=stopped;stop();assert.equal(stopped,naturalStops+scheduled,'interrupted scene stops all scheduled wheel clicks');
 console.log('PASS: direction-specific engine entry, overhead/side perspectives, input gate, complete-word-only directional departure, manual advance setting, saved ink, single departure and motion/train/fixed settings');
}
verify().catch(e=>{console.error(e);process.exitCode=1;});
