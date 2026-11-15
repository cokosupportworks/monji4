const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {makeDOM}=require('./dom-harness.cjs');
const {performance}=require('node:perf_hooks');
const base=path.resolve(__dirname,'..');
const {document}=makeDOM(fs.readFileSync(path.join(base,'index.html'),'utf8'));
const context={document,performance,MonjiCore:require('../core.js'),setTimeout};vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(base,'diagnostics.js'),'utf8'),context);
const params={dev:26,startTol:32,maxRatio:1.6,validRatio:.85,minCoverage:.8};
let practiceCalls=0,exported;
const diag=new context.PerformanceDiagnostics({load:async()=>['M1,1L2,2'],sample:()=>[{x:10,y:10},{x:20,y:20}],params:()=>params,width:()=>320,practice:()=>practiceCalls++,export:report=>exported=report});
async function run(){
 await diag.run();assert.equal(diag.report.rows.length,18);assert.ok(diag.report.rows.every(r=>r.pass));
 assert.equal(practiceCalls,0,'automatic diagnostics never replaces the exercise');
 assert.equal(diag.runButton.disabled,false);assert.equal(diag.exportButton.disabled,false);assert.equal(diag.stopButton.disabled,true);
 document.getElementById('btnExportDiagnostics').click();assert.equal(exported,diag.report);
 document.getElementById('btnPracticeReported').click();assert.equal(practiceCalls,1,'practice starts only on explicit action');
 let resolve;diag.options.load=()=>new Promise(done=>resolve=done);
 const cancelled=diag.run();diag.cancel();resolve(['M1,1L2,2']);await cancelled;
 assert.equal(diag.report.rows.length,0,'cancelled run cannot append stale results');
 assert.equal(diag.runButton.disabled,false);assert.equal(diag.stopButton.disabled,true);
 diag.options.load=async()=>{throw new Error('offline');};await diag.run();
 assert.equal(diag.report.rows.length,18);assert.ok(diag.report.rows.every(row=>!row.pass&&row.error==='offline'));
 assert.equal(diag.exportButton.disabled,false,'failures can be exported for troubleshooting');
 console.log('PASS: diagnostic controls, local export, no automatic exercise change, cancellation and visible acquisition errors');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
