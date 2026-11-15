const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JourneyView,artwork,motion,fixedLayout}=require('../journey.js');

assert.notEqual(artwork('vertical').car,artwork('horizontal').car,'vertical uses separate overhead art');
assert.notEqual(artwork('vertical').rail,artwork('horizontal').rail,'rails also use separate perspective');
assert.match(artwork('vertical').car,/train-top/);
assert.match(artwork('horizontal').car,/train-side/);
assert.equal(motion('vertical',-300),'translate(-50%, calc(-50% + -300px))');
assert.equal(motion('horizontal',-300),'translate(calc(-50% + -300px), -50%)');
for (const direction of ['vertical','horizontal']) {
  const v=Object.create(JourneyView.prototype);
  v.viewport={dataset:{},classList:{toggle(key,value){this[key]=value;}}};
  v.rail={style:{}};v.cards=[{art:{},rail:{style:{}}},{art:{},rail:{style:{}}}];v.layout=()=>{};v.build=()=>{};
  v.apply({direction,train:false,reduced:true});
  assert.equal(v.viewport.dataset.direction,direction);
  assert.equal(v.viewport.classList['without-train'],true);
  assert.equal(v.cards[0].art.src,artwork(direction).car);
  assert.match(v.rail.style.backgroundImage,new RegExp(artwork(direction).rail.replaceAll('.','\\.')));
}
const top=fs.readFileSync(path.join(__dirname,'../assets/train-top.svg'),'utf8');
const side=fs.readFileSync(path.join(__dirname,'../assets/train-side.svg'),'utf8');
assert.match(top,/真上/);assert.match(side,/横から/);
assert.ok(!top.includes('<circle'),'overhead view has no side-facing wheels');
assert.ok(side.includes('<circle'),'side view includes wheels');
assert.ok(!fs.readFileSync(path.join(__dirname,'../journey.css'),'utf8').includes('rotate('),'no rotation of side art into overhead view');
for(const [width,height]of [[320,250],[768,480],[1024,600]])for(let count=1;count<=20;count++)for(const direction of ['vertical','horizontal']){
 const grid=fixedLayout(count,width,height,direction);
 assert.ok(grid.cols*grid.rows>=count,'all letters have a slot');
 assert.ok(grid.size*(grid.cols*1.5-.2)<=width-40+.01,'whole fixed row fits width');
 assert.ok(grid.size*(grid.rows*1.5-.1)<=height-80+.01,'whole fixed column fits height');
}

async function run(){
 const v=Object.create(JourneyView.prototype);v.size=200;v.display={direction:'vertical',reduced:false};
 v.cards=Array.from({length:5},()=>({ready:Promise.resolve()}));
 let animation,frames;
 v.track={animate(value){frames=value;let finish;const finished=new Promise(resolve=>finish=resolve);animation={finished,finish};return animation;}};
 const moving=v.move(1);await new Promise(setImmediate);
 let finished=false;moving.then(()=>finished=true);await Promise.resolve();
 assert.equal(finished,false,'next character must wait until movement finishes');
 assert.equal(frames[1].transform,motion('vertical',-300));
 animation.finish();await moving;
 v.display={direction:'horizontal',reduced:false};const backwards=v.move(-1);await new Promise(setImmediate);
 assert.equal(frames[1].transform,motion('horizontal',300));animation.finish();await backwards;
 let invoked=false;v.track.animate=()=>{invoked=true;};v.display.reduced=true;await v.move(1);
 assert.equal(invoked,false,'reduced motion skips travel animation');
 v.display={mode:'fixed',direction:'vertical',reduced:false};await v.move(1);
 assert.equal(invoked,false,'fixed display never moves the text');
 console.log('PASS: perspective-specific assets, rail selection, direction, motion completion and reduced motion');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
