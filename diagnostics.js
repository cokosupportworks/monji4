(function(root){
 'use strict';
 class PerformanceDiagnostics{
  constructor(options){
   this.options=options;this.generation=0;
   this.status=document.getElementById('diagnosticStatus');this.results=document.getElementById('diagnosticRows');
   this.runButton=document.getElementById('btnRunDiagnostics');this.stopButton=document.getElementById('btnStopDiagnostics');
   this.exportButton=document.getElementById('btnExportDiagnostics');
   this.runButton.onclick=()=>this.run();this.stopButton.onclick=()=>this.cancel();
   this.exportButton.onclick=()=>{if(this.report)this.options.export(this.report);};
   document.getElementById('btnPracticeReported').onclick=()=>{this.cancel(false);this.options.practice();};
   document.getElementById('btnCloseSettings').addEventListener('click',()=>this.cancel(false));
   document.addEventListener('visibilitychange',()=>{if(document.hidden)this.cancel();});
  }
  cancel(announce=true){
   const running=this.running;this.generation++;this.running=false;
   this.runButton.disabled=false;this.stopButton.disabled=true;
   if(running&&announce)this.status.textContent='検査を中止しました。ここまでの結果は残っています。';
  }
  async run(){
   if(this.running)return;
   const token=++this.generation;this.running=true;this.runButton.disabled=true;this.stopButton.disabled=false;this.exportButton.disabled=true;
   this.results.replaceChildren();this.status.textContent='実際の書き順データで検査しています…';
   const params={...this.options.params()};
   this.report={format:'monjibotaru4-diagnostics',version:1,date:new Date().toISOString(),
    environment:'Actual browser automatic test; not a measurement of pen-to-screen latency',
    datasetSnapshot:root.MonjiBundledStrokes?.snapshot||'remote/cache',params,rows:[]};
   const width=Math.max(1,Math.min(440,this.options.width()||460));
   const canvas=document.createElement('canvas');canvas.width=canvas.height=Math.round(width);
   const ctx=canvas.getContext('2d');ctx.lineWidth=14*width/460;ctx.lineCap=ctx.lineJoin='round';ctx.strokeStyle='#30483d';
   try{
    for(const char of Array.from('ひぬめねあむのゆるろをんシソツヌメ鬱')){
     if(token!==this.generation||document.hidden)return;
     const row={char};
     try{
      const paths=await this.options.load(char);
      if(token!==this.generation||document.hidden)return;
      const start=performance.now();const targets=paths.map(path=>this.options.sample(path,460,460));
      row.geometryMs=performance.now()-start;row.strokes=paths.length;row.samples=targets.reduce((sum,p)=>sum+p.length,0);
      row.judgeMaxMs=0;row.drawMs=0;row.pass=true;
      for(const target of targets){
       if(target.length<2)throw new Error('書き順を点列に変換できません');
       const input=MonjiCore.resample(target,.7),judgeStart=performance.now();
       const result=MonjiCore.evaluate(target,input,params);row.judgeMaxMs=Math.max(row.judgeMaxMs,performance.now()-judgeStart);row.pass=row.pass&&result.pass;
       ctx.clearRect(0,0,width,width);const drawStart=performance.now();
       for(let at=1;at<input.length;at+=40){
        ctx.beginPath();ctx.moveTo(input[at-1].x*width/460,input[at-1].y*width/460);
        for(let i=at;i<Math.min(input.length,at+40);i++)ctx.lineTo(input[i].x*width/460,input[i].y*width/460);
        ctx.stroke();
       }
       row.drawMs+=performance.now()-drawStart;
      }
     }catch(error){row.pass=false;row.error=String(error.message||error);}
     if(token!==this.generation)return;
     this.report.rows.push(row);this.appendRow(row);
     this.status.textContent=`${this.report.rows.length} ／ 18文字を確認しました`;
     this.exportButton.disabled=false;
     // Release the UI between characters. No practice state is changed.
     await new Promise(resolve=>setTimeout(resolve,0));
    }
    if(token===this.generation){
     const failures=this.report.rows.filter(row=>!row.pass).length;
     this.status.textContent=failures?`検査が終わりました。${failures}文字で確認が必要です。`:'18文字の検査が終わりました。見本どおりの入力はすべて合格しました。';
    }
   }finally{
    if(token===this.generation){this.running=false;this.runButton.disabled=false;this.stopButton.disabled=true;}
   }
  }
  appendRow(row){
   const tr=document.createElement('tr');
   const ms=value=>Number.isFinite(value)?value.toFixed(1):'—';
   for(const text of [row.char,row.strokes??'—',ms(row.geometryMs),ms(row.drawMs),ms(row.judgeMaxMs),row.error|| (row.pass?'一致':'要確認')]){
    const td=document.createElement('td');td.textContent=String(text);tr.append(td);
   }
   this.results.append(tr);
  }
 }
 root.PerformanceDiagnostics=PerformanceDiagnostics;
})(globalThis);
