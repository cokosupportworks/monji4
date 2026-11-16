const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');const{makeDOM}=require('./dom-harness.cjs');
const base=path.resolve(__dirname,'..'),{document}=makeDOM(fs.readFileSync(path.join(base,'index.html'),'utf8'));
class AudioContext{
 constructor(){this.state='suspended';this.currentTime=5;this.sampleRate=1000;this.destination={};this.nodes=[];this.resumes=0;this.pending=[];}
 resume(){this.resumes++;return new Promise(resolve=>this.pending.push(resolve));}
 release(){this.state='running';this.pending.splice(0).forEach(resolve=>resolve());}
 param(){return{values:[],setValueAtTime(value,time){this.values.push({value,time});},exponentialRampToValueAtTime(value,time){this.values.push({value,time});}};}
 node(kind){const n={kind,frequency:this.param(),Q:this.param(),connect(){},disconnect(){},start(at){this.started=at;},stop(at){(this.stops||=[]).push(at);}};this.nodes.push(n);return n;}
 createOscillator(){return this.node('tone');}createGain(){const g=this.node('gain');g.gain=this.param();return g;}
 createBufferSource(){return this.node('noise');}createBiquadFilter(){return this.node('filter');}
 createBuffer(channels,length,rate){const data=new Float32Array(length);return{length,sampleRate:rate,getChannelData:()=>data};}
}
const archive={list:async()=>[],put:async()=>{},saveState:async()=>{},listLessons:async()=>[]};
const ctx={document,console,performance,structuredClone,crypto:require('node:crypto').webcrypto,setTimeout,clearTimeout,
 window:{AudioContext,devicePixelRatio:1,addEventListener(){},monjiArchive:archive,monjiSettings:{display:{auto:false},requests:{voice:false}}},requestAnimationFrame:()=>1,cancelAnimationFrame(){},ResizeObserver:class{observe(){}},localStorage:{getItem(){return null;},setItem(){}}};
vm.createContext(ctx);for(const file of ['core.js','lessons.js','journey.js','word-archive.js'])vm.runInContext(fs.readFileSync(path.join(base,file),'utf8'),ctx);let src=fs.readFileSync(path.join(base,'app.js'),'utf8');src=src.slice(0,src.indexOf('    let booting = false;'))+' globalThis.testExports={App,loader,Sound,sound,samplePath}; })();';vm.runInContext(src,ctx);const{App,loader,Sound,sound,samplePath}=ctx.testExports;loader.load=async()=>['M20,50 L90,50','M50,20 L50,90'];const flush=()=>new Promise(setImmediate),get=id=>document.getElementById(id);
async function run(){
 const muted=new Sound();muted.on=false;muted.train(480);muted.success();assert.equal(muted.ctx,null,'muted effects do not create audio');
 const rail=new Sound(),stopRail=rail.train(480);assert.equal(rail.ctx.nodes.length,0,'train waits for audio resume');rail.ctx.release();await flush();
 const tones=rail.ctx.nodes.filter(n=>n.kind==='tone'),noise=rail.ctx.nodes.filter(n=>n.kind==='noise');assert.equal(tones.length,2);assert.equal(noise.length,2,'paired rail impacts include an audible clack layer');assert.deepEqual(tones.map(n=>n.frequency.values[0].value),[330,460]);assert.ok(rail.ctx.nodes.filter(n=>n.kind==='gain').some(n=>n.gain.values.some(v=>v.value===.13)));assert.ok(noise.every(n=>n.buffer.getChannelData(0).some(v=>v!==0)));stopRail();assert.ok([...tones,...noise].every(n=>n.stops.length===2),'scene stop cancels every scheduled source');
 const cancelled=new Sound(),cancel=cancelled.train(2600);cancel();cancelled.ctx.release();await flush();assert.equal(cancelled.ctx.nodes.length,0,'late resume cannot replay a stopped train');
 const lateMute=new Sound();lateMute.train(480);lateMute.on=false;lateMute.ctx.release();await flush();assert.equal(lateMute.ctx.nodes.length,0);
 const ding=new Sound();ding.init();ding.ctx.release();ding.success();const confirmation=ding.ctx.nodes.find(n=>n.kind==='tone');assert.equal(confirmation.frequency.values[0].value,988);assert.ok(Math.abs(confirmation.stops[0]-confirmation.started-.12)<1e-9,'stroke confirmation is a short 120 ms tone');
 const app=new App();await flush();await app.setWord('ねこ');app.sIdx=1;app.userStrokes=[[{x:20,y:40,t:0},{x:80,y:40,t:500}]];app.skipped=[false];app.rememberCurrent();
 get('btnOpenSelect').click();await flush();assert.ok(sound.ctx.resumes>0,'selection click unlocks audio without waiting for a canvas touch');sound.ctx.release();await flush();
 const modal=get('modalSelect'),close=modal.classList.remove.bind(modal.classList),observed=[];
 modal.classList.remove=(...names)=>{if(names.includes('open')&&modal.classList.contains('open'))observed.push({opacity:app.journey.track.style.opacity,preparing:app.journey.viewport.classList.contains('journey-preparing')});close(...names);};
 let releaseHistory;archive.list=()=>new Promise(resolve=>releaseHistory=resolve);app.lessonLibrary.word.value='いぬ';app.lessonLibrary.syncDraft();app.lessonLibrary.start.click();
 assert.deepEqual(observed[0],{opacity:'0',preparing:true},'unfinished train is hidden before the selector closes');await flush();assert.equal(app.journey.track.style.opacity,'0','whole layer remains hidden during slow history read even though cars explicitly have visibility:visible');assert.ok(app.journey.cards.some(c=>c.car.style.visibility==='visible'));
 releaseHistory([]);await flush();archive.list=async()=>[];assert.equal(app.word,'いぬ');assert.equal(app.journey.track.style.opacity,'','new prepared scene is revealed');
 get('btnOpenSelect').click();await flush();app.startSequence(['ねこ','い']);assert.deepEqual(observed.at(-1),{opacity:'0',preparing:true},'sequence start conceals before closing too');await flush();
 let accepted=0;const originalSuccess=sound.success.bind(sound);sound.success=()=>{accepted++;originalSuccess();};const rails=[];sound.train=(duration,delay)=>{rails.push({duration,delay});return()=>{};};
 const drawCurrent=()=>{app.drawing=samplePath(app.strokes[app.sIdx],app.W,app.H).map((p,i)=>({...p,t:i*20}));app.checkStroke();};
 drawCurrent();assert.equal(app.sIdx,1);assert.equal(accepted,1);drawCurrent();await flush();assert.equal(app.sIdx,2);assert.equal(accepted,2,'final stroke also receives confirmation');assert.equal(rails.length,0,'letter completion no longer plays a premature rail sound');
 await app.setWord('ぬ');app.drawing=[];app.checkStroke();assert.equal(accepted,2,'rejected stroke gets no success tone');get('btnSkip').click();assert.equal(accepted,2,'assistance does not impersonate a successful handwritten stroke');
 sound.ctx.state='interrupted';const resumes=sound.ctx.resumes;document.emit('keydown',{key:'Enter'});assert.ok(sound.ctx.resumes>resumes,'keyboard gesture retries interrupted audio');sound.ctx.release();
 const css=fs.readFileSync(path.join(base,'journey.css'),'utf8');assert.match(css,/\.journey\.journey-preparing>\.journey-track[^}]*opacity:0!important/s,'CSS hiding is not overridable by child visibility');
 clearTimeout(app.tTimer);clearTimeout(app.autoAdvanceTimer);clearTimeout(app.stopRequestTimer);
 console.log('PASS: concealment before single/sequence modal close, slow reads, gesture audio unlock, resume-aware rail clacks, cancellation/mute, 120 ms confirmation on every accepted stroke including last, and no confirmation for rejection/assistance');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
