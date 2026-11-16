(function(root){
 'use strict';
 function isFullyAssisted(record){
  const strokes=record?.strokes;
  return Array.isArray(strokes)&&strokes.length>0&&Array.from({length:strokes.length},(_,index)=>record.skipped?.[index]===true).every(Boolean);
 }
 function teacherSummary(settings={}){
  settings=settings||{};
  const level={relaxed:'げきあま',easy:'やさしい',normal:'ふつう',strict:'しっかり'}[settings.level]||'不明';
  const flag=(value,on='あり',off='なし')=>value===true?on:value===false?off:'不明';
  const seconds=value=>Number.isFinite(value)&&value>=0?String(value):'不明';
  const direction=settings.display?.direction==='vertical'?'縦書き':settings.display?.direction==='horizontal'?'横書き':'書字方向：不明';
  const fields=[`判定：${level}`,`ほたるモード：${flag(settings.hotaru,'ON','OFF')}`];
  if(settings.hotaru!==false)fields.push(`ほたるON（${seconds(settings.visibleSec)}）秒／OFF（${seconds(settings.hiddenSec)}）秒`);
  fields.push(`印：${flag(settings.showGuide)}`,`マス目：${flag(settings.showGrid)}`,direction);
  if(settings.hotaru===true&&typeof settings.once==='boolean')fields.push('見本：'+(settings.once?'はじめだけ':'くりかえし'));
  if(settings.level==='relaxed')fields.push('おおまかな形で判定（開始位置・長さ・方向は不問）');
  if(settings.level!=='relaxed'&&Number.isFinite(settings.params?.dev)&&settings.params.dev>=0)fields.push(`判定許容幅：${settings.params.dev}px`);
  if(settings.level!=='relaxed'&&Number.isFinite(settings.params?.maxRatio)&&settings.params.maxRatio>0)fields.push(`塗りつぶし許容：${settings.params.maxRatio}倍`);
  return fields.join(' ｜ ');
 }
 function teacherMetadata(records,word=false){
  const box=document.createElement('div');box.className='teacher-metadata';box.setAttribute('aria-label','教師向けの練習条件');
  const caption=document.createElement('strong');caption.className='teacher-condition-title';caption.textContent='教師向け・記録時の設定';box.append(caption);
  const valid=records.filter(Boolean),groups=new Map();
  for(const [i,record]of valid.entries()){
   const text=teacherSummary(record.settings);
   if(!groups.has(text))groups.set(text,[]);groups.get(text).push(Number.isInteger(record.index)?record.index+1:i+1);
  }
  for(const [text,positions]of groups){const row=document.createElement('div');row.className='teacher-condition-row';row.textContent=(word?(groups.size===1?'全記録共通：':positions.join('・')+'文字目：'):'')+text;box.append(row);}
  return box;
 }
 function groupWords(records){
  const words=new Map();
  for(const record of records){
   const word=String(record.word||record.char||'');if(!word)continue;
   if(!words.has(word))words.set(word,{word,attempts:[],legacy:[],latestDate:'',byPractice:new Map()});
   const entry=words.get(word);entry.latestDate=entry.latestDate>record.date?entry.latestDate:record.date;
   const letters=Array.from(word),index=record.index;
   if(!record.practiceId||!Number.isInteger(index)||index<0||index>=letters.length||record.char!==letters[index]){entry.legacy.push(record);continue;}
   if(!entry.byPractice.has(record.practiceId)){
    const attempt={id:record.practiceId,word,startedAt:record.practiceStartedAt||record.date,date:record.date,slots:Array(letters.length).fill(null),variants:0};
    entry.byPractice.set(record.practiceId,attempt);entry.attempts.push(attempt);
   }
   const attempt=entry.byPractice.get(record.practiceId);attempt.variants++;
   const startedAt=record.practiceStartedAt||record.date;if(startedAt<attempt.startedAt)attempt.startedAt=startedAt;
   if(record.date>attempt.date)attempt.date=record.date;
   const old=attempt.slots[index];
   if(!old||record.date>old.date||(record.date===old.date&&record.id>old.id))attempt.slots[index]=record;
  }
  return [...words.values()].map(entry=>{
   delete entry.byPractice;
   entry.attempts.sort((a,b)=>b.date.localeCompare(a.date));entry.legacy.sort((a,b)=>b.date.localeCompare(a.date));
   return entry;
  }).sort((a,b)=>b.latestDate.localeCompare(a.latestDate));
 }
 function paintRecord(canvas,record,progress=1){
  const ctx=canvas.getContext('2d'),width=canvas.width,height=canvas.height;ctx.clearRect(0,0,width,height);
  if(!record)return;
  ctx.lineCap=ctx.lineJoin='round';ctx.lineWidth=Math.max(1,14*width/460);
  let first=Infinity,last=0;
  if(progress<1)for(const line of record.strokes||[])for(const point of line){first=Math.min(first,point.t||0);last=Math.max(last,point.t||0);}
  const cutoff=progress>=1?Infinity:first+(last-first)*Math.max(0,progress);
  for(const [i,line]of (record.strokes||[]).entries()){
   ctx.strokeStyle=record.skipped?.[i]?'#94a3b8':'#30483d';let started=false;
   for(const point of line){
    if((point.t||0)>cutoff)break;
    if(!started){ctx.beginPath();ctx.moveTo(point.x*width,point.y*height);started=true;}
    else ctx.lineTo(point.x*width,point.y*height);
   }
   if(started)ctx.stroke();
  }
 }
 function rubyText(base,reading){
  const ruby=document.createElement('ruby');ruby.textContent=base;
  const rt=document.createElement('rt');rt.textContent=reading;ruby.append(rt);return ruby;
 }
 function childDate(value,withTime=false){
  const date=new Date(value);if(!Number.isFinite(date.getTime()))return 'ひづけ なし';
  const day=`${date.getFullYear()}ねん ${date.getMonth()+1}がつ ${date.getDate()}にち`;
  return withTime?day+' '+String(date.getHours()).padStart(2,'0')+':'+String(date.getMinutes()).padStart(2,'0'):day;
 }
 class WordAlbum{
  constructor(container,records,onCharacter){
   this.container=container;this.records=records;this.onCharacter=onCharacter;this.token=0;
   this.words=groupWords(records);this.drawIndex();
  }
  cancelReplay(){this.token++;}
  drawIndex(){
   this.cancelReplay();this.container.replaceChildren();
   const hero=document.createElement('div');hero.className='album-hero';
   const firefly=document.createElement('div');firefly.className='album-firefly hotaruko-bust';firefly.setAttribute('role','img');firefly.setAttribute('aria-label','ほたるこちゃん');
   const welcome=document.createElement('div');const title=document.createElement('h3');title.append(rubyText('作品','さくひん'));const titleEnd=document.createElement('span');titleEnd.textContent='を えらぼう';title.append(titleEnd);
   const intro=document.createElement('p');intro.textContent='かいた もじが、たからもの。どれを ひらこうかな？';welcome.append(title,intro);
   const count=document.createElement('span');count.className='album-collection-count';count.textContent=`${this.words.length}この ことば`;
   hero.append(firefly,welcome,count);this.container.append(hero);
   const list=document.createElement('div');list.className='word-book-index';this.container.append(list);
   let shown=0;const more=document.createElement('button');more.className='btn album-more';more.textContent='もっと みる';
   const appendPage=()=>{for(const entry of this.words.slice(shown,shown+24)){
    const button=document.createElement('button');button.className='word-book-entry';button.type='button';
    const tone=Array.from(entry.word).reduce((sum,ch)=>sum+ch.codePointAt(0),0)%3;button.dataset.tone=String(tone);
    button.setAttribute('aria-label',`${entry.word}の さくひんを ひらく`);
    const preview=document.createElement('div');preview.className='album-cover-preview';preview.setAttribute('aria-hidden','true');
    const latest=entry.attempts[0];const samples=latest?latest.slots:entry.legacy.slice(0,1);
    for(const record of samples.slice(0,6)){
     const canvas=document.createElement('canvas');canvas.className='album-cover-canvas';canvas.width=canvas.height=128;
     paintRecord(canvas,record);if(!record)canvas.classList.add('album-blank-preview');preview.append(canvas);
    }
    if(samples.length>6){const dots=document.createElement('span');dots.className='album-cover-more';dots.textContent='…';preview.append(dots);}
    const stamp=document.createElement('span');stamp.className='album-cover-stamp';stamp.textContent=latest?(latest.slots.every(Boolean)?'かけたね！':'ここまで かけたよ'):'まえの もじ';
    const title=document.createElement('strong');title.textContent=entry.word;
    const detail=document.createElement('span');detail.className='album-cover-meta';detail.textContent=entry.attempts.length?`${entry.attempts.length}かい かいたよ`:'ひとつずつ みられるよ';
    const date=document.createElement('span');date.className='album-cover-date';date.textContent=childDate(entry.latestDate);
    button.append(preview,stamp,title,detail,date);button.onclick=()=>this.drawWord(entry);list.append(button);
   }shown+=24;more.hidden=shown>=this.words.length;};
   more.onclick=appendPage;appendPage();this.container.append(more);
   if(!this.words.length){const p=document.createElement('p');p.className='album-empty';p.textContent='はじめの いちまいを つくろう。もじを かくと、ここに あつまるよ。';this.container.append(p);}
  }
  drawWord(entry,selected=0){
   this.cancelReplay();this.container.replaceChildren();
   const back=document.createElement('button');back.className='btn album-back';back.textContent='← ことばを えらぶ';back.onclick=()=>this.drawIndex();
   const heading=document.createElement('h3');heading.className='album-word-heading';heading.textContent=entry.word;this.container.append(back,heading);
   if(entry.attempts.length){
    const picker=document.createElement('label');picker.className='word-attempts';
    const prompt=document.createElement('span');prompt.textContent='いつの さくひん？';
    const select=document.createElement('select');select.className='album-date-select';select.setAttribute('aria-label','みたい ひづけを えらぶ');
    entry.attempts.forEach((attempt,i)=>{
     const option=document.createElement('option');option.value=String(i);
     const done=attempt.slots.filter(Boolean).length;option.textContent=`${childDate(attempt.startedAt,true)}　${done}もじ`;
     select.append(option);
    });select.value=String(selected);select.onchange=()=>this.drawWord(entry,Number(select.value));picker.append(prompt,select);this.container.append(picker);this.drawAttempt(entry.attempts[selected]);
   }
   if(entry.legacy.length){
    const section=document.createElement('details');section.className='word-legacy';section.open=!entry.attempts.length;
    const summary=document.createElement('summary');summary.textContent=`まえに かいた もじ（${entry.legacy.length}こ）`;
    const note=document.createElement('p');note.textContent='みたい もじを おしてね。';
    section.append(summary,note);
    for(const record of entry.legacy){const b=document.createElement('button');b.className='btn';b.textContent=`${Number.isInteger(record.index)?record.index+1+'もじめ ':''}${record.char}　${childDate(record.date,true)}`;b.onclick=()=>this.onCharacter(record);section.append(b);}
    this.container.append(section);
   }
  }
  drawAttempt(attempt){
   const done=attempt.slots.filter(Boolean).length;
   const status=document.createElement('p');status.className='word-attempt-status';status.textContent=done===attempt.slots.length?'ぜんぶ かけたね！':`${done}もじ かけたよ。かいてある もじを みてみよう。`;
   const sheet=document.createElement('div');sheet.className='word-sheet';
   const last=attempt.slots.filter(Boolean).sort((a,b)=>b.date.localeCompare(a.date))[0];
   const direction=last?.settings?.display?.direction==='vertical'?'vertical':'horizontal';
   sheet.dataset.direction=direction;sheet.style.setProperty('--word-rows',String(Math.min(5,attempt.slots.length)));
   const canvases=[];
   attempt.slots.forEach((record,index)=>{
    const tile=document.createElement('button');tile.className='word-sheet-tile';tile.type='button';
    const label=document.createElement('span');label.textContent=`${index+1}もじめ`;
    const canvas=document.createElement('canvas');canvas.className='word-sheet-canvas';canvas.width=canvas.height=300;
    canvas.setAttribute('aria-label',record?`${record.char}の かいたもじ`:`${index+1}もじめは これから`);
    tile.append(canvas,label);canvases.push(canvas);
    if(record){paintRecord(canvas,record);tile.onclick=()=>this.onCharacter(record);}
    else{tile.disabled=true;tile.classList.add('missing-record');const empty=document.createElement('span');empty.className='word-empty';empty.textContent='まだ';tile.append(empty);}
    sheet.append(tile);
   });
   const controls=document.createElement('div');controls.className='word-replay-controls';
   const replay=document.createElement('button');replay.className='btn btn-primary';replay.textContent='▶ かいたところを みる';
   const stop=document.createElement('button');stop.className='btn';stop.textContent='■ ぜんぶ みる';
   const all=()=>attempt.slots.forEach((record,i)=>paintRecord(canvases[i],record));
   stop.onclick=()=>{this.cancelReplay();all();};
   replay.onclick=()=>{
    const token=++this.token,indices=attempt.slots.map((r,i)=>r?i:-1).filter(i=>i>=0);
    if(!indices.length)return;
    const duration=Math.max(3000,Math.min(12000,indices.length*1600)),start=performance.now();
    for(const canvas of canvases)paintRecord(canvas,null);
    let lastSlot=-1,lastPaint=-Infinity;
    const frame=now=>{
     if(token!==this.token||!document.getElementById('modalRecord').classList.contains('open'))return;
     const elapsed=Math.max(0,(now-start)/duration*indices.length),at=Math.min(indices.length-1,Math.floor(elapsed));
     if(at!==lastSlot&&lastSlot>=0)paintRecord(canvases[indices[lastSlot]],attempt.slots[indices[lastSlot]]);
     if(now-lastPaint>=30||elapsed>=indices.length){
      // Paint only the currently replaying character; completed neighbours stay put.
      for(let i=Math.max(0,lastSlot+1);i<at;i++)paintRecord(canvases[indices[i]],attempt.slots[indices[i]]);
      const index=indices[at];paintRecord(canvases[index],attempt.slots[index],Math.min(1,elapsed-at));lastPaint=now;lastSlot=at;
     }
     if(elapsed<indices.length)requestAnimationFrame(frame);else all();
    };requestAnimationFrame(frame);
   };
   const hint=document.createElement('p');hint.className='word-book-hint';hint.textContent='もじを おすと、おおきく みられるよ。うすい はいいろの せんは、おてつだいの おてほんだよ。';
   controls.append(replay,stop);this.container.append(status,sheet,controls,hint,teacherMetadata(attempt.slots,true));
  }
 }
 root.MonjiWords={teacherSummary,teacherMetadata,isFullyAssisted,groupWords,paintRecord,WordAlbum,rubyText,childDate};
 if(typeof module!=='undefined')module.exports=root.MonjiWords;
})(globalThis);
