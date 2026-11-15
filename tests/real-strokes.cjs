const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {performance}=require('node:perf_hooks');
const {makeDOM}=require('./dom-harness.cjs');
const {svgPathProperties}=require(process.env.MONJI_GEOMETRY_MODULE||'svg-path-properties');
const base=path.resolve(__dirname,'..');
const manifest=JSON.parse(fs.readFileSync(path.join(base,'assets/kanjivg/manifest.json'),'utf8'));
const current=require('../core.js'),reference=require('./fixtures/evaluator-before.cjs');
const {document}=makeDOM(fs.readFileSync(path.join(base,'index.html'),'utf8'));
const context={window:{},document,console,performance,setTimeout,clearTimeout,MonjiCore:current,localStorage:{getItem(){return null;}}};
vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(base,'stroke-data.js'),'utf8'),context);
let source=fs.readFileSync(path.join(base,'app.js'),'utf8');source=source.slice(0,source.indexOf('    let booting = false;'))+' globalThis.testExports={samplePath,loader}; })();';
vm.runInContext(source,context);
const helper=document.getElementById('svgHelperPath'),originalSet=helper.setAttribute.bind(helper);let geometry,queries=0;
helper.setAttribute=(key,value)=>{originalSet(key,value);if(key==='d')geometry=new svgPathProperties(value);};
helper.getTotalLength=()=>geometry.getTotalLength();helper.getPointAtLength=value=>{queries++;return geometry.getPointAtLength(value);};
const {samplePath,loader}=context.testExports;
const params={dev:26,startTol:32,maxRatio:1.6,validRatio:.85,minCoverage:.8};
const levels=[{dev:38,startTol:45,maxRatio:2.2,validRatio:.72,minCoverage:.65},params,{dev:16,startTol:20,maxRatio:1.3,validRatio:.92,minCoverage:.9}];
async function run(){
 const rows=[];
 for(const entry of manifest.entries){
  const bytes=fs.readFileSync(path.join(base,'assets/kanjivg',entry.file));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),entry.sha256,'fixture checksum');
  const originalPaths=Array.from(bytes.toString().matchAll(/<path\b[^>]*\bd="([^"]+)"/g),match=>match[1]);
  const bundled=context.MonjiBundledStrokes.characters[entry.char];
  assert.deepEqual(Array.from(bundled),originalPaths,'bundled paths exactly match the original SVG');
  const loaded=await loader.load(entry.char);assert.equal(loaded.length,entry.strokes);
  const start=performance.now(),targets=Array.from(loaded,d=>samplePath(d,460,460));
  const geometryMs=performance.now()-start,queryCount=queries;
  let maximum=0,points=0;
  for(const [i,target]of targets.entries()){
   assert.ok(target.length>1,'real path sampled');points+=target.length;
   const input=current.resample(target,.7);
   for(const level of levels){
    const before=reference.evaluate(target,input,level),judgeStart=performance.now();
    const after=current.evaluate(target,input,level);maximum=Math.max(maximum,performance.now()-judgeStart);
    assert.deepEqual(after,before,entry.char+' stroke '+(i+1)+' judgement equivalence');
    assert.equal(after.pass,true,'following the exact real stroke passes at every preset');
   }
   samplePath(loaded[i],400,400);samplePath(loaded[i],460,460);
  }
  assert.equal(queries,queryCount,'reusing and resizing real paths never recalculates SVG curves');
  rows.push({char:entry.char,strokes:loaded.length,samples:points,geometryMs:+geometryMs.toFixed(2),judgeMaxMs:+maximum.toFixed(2),pass:true,sha256:entry.sha256});
 }
 const report={environment:`Node ${process.version}; svg-path-properties 2.2.0, not native browser SVG or iPad`,snapshot:manifest.snapshot,characters:rows.length,totalStrokes:rows.reduce((n,r)=>n+r.strokes,0),presets:levels.length,rows};
 if(process.env.MONJI_REPORT_PATH)fs.writeFileSync(process.env.MONJI_REPORT_PATH,JSON.stringify(report,null,2)+'\n');
 console.log('PASS: '+report.characters+' real KanjiVG characters / '+report.totalStrokes+' strokes; original checksums, bundled paths, cached sampling and matching judgements');
 console.table(rows.map(({char,strokes,samples,geometryMs,judgeMaxMs})=>({char,strokes,samples,geometryMs,judgeMaxMs})));
}
run().catch(error=>{console.error(error);process.exitCode=1;});
