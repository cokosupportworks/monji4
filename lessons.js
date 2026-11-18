(function(root){
 'use strict';
 function invalid(message){const error=new Error(message);error.childMessage=message;return error;}
 function normalize(input){
  const word=String(input.word||'').trim().normalize('NFC');
  if(!word)throw invalid('れんしゅうする もじを いれてね。');
  if(/\s/u.test(word))throw invalid('もじと もじの あいだは、あけずに いれてね。');
  if(Array.from(word).length>20)throw invalid('20もじまでで つくってね。');
  const label=String(input.label||'').trim();if(Array.from(label).length>32)throw invalid('なまえは 32もじまでに してね。');
  return{word,label:label||word,hasLabel:!!label,id:input.id||null};
 }
 class LessonLibrary{
  constructor(options){
   this.options=options;this.archive=options.archive;this.records=[];this.generation=0;this.queue=[];this.mode='single';
   const get=id=>document.getElementById(id);this.word=get('customInput');this.label=get('customLabel');this.status=get('lessonStatus');
   this.save=get('btnSaveLesson');this.start=get('btnApplyCustom');this.cancel=get('btnCancelLessonEdit');
   this.list=get('savedLessonList');this.trash=get('archivedLessonList');
   this.save.onclick=()=>this.saveWord({id:this.editingId,word:this.word.value,label:this.label.value},false);
   this.start.onclick=()=>{
    try{const data=normalize({word:this.word.value});if(!this.checkStartOrientation(this.start))return;if(this.options.start(data.word)===false)this.say('いまの もじが おちついてから、もういちど おしてね。');}
    catch(error){this.say(error.childMessage||'もじを たしかめてね。');}
   };
   this.cancel.onclick=()=>this.clearEditor();
   get('btnOpenSelect').addEventListener('click',()=>{this.setSource('keys');this.syncDraft();this.refresh();});
   this.queueList=get('lessonQueueList');this.queueStart=get('btnStartLessonQueue');
   this.queueStart.onclick=()=>{
    try {const pending=this.word.value.trim()?normalize({word:this.word.value}).word:null;const words=[...this.queue,...(pending?[pending]:[])];
     if(!words.length)throw invalid('もじを えらんで おだいを つくってね。');if(words.length>20)throw invalid('おだいは 20こまで ならべられるよ。');
     if(!this.checkStartOrientation(this.queueStart))return;
     if(this.options.startSequence?.(words)===false)this.say('いまの もじが おちついてから、おしてね。');
    }catch(error){this.say(error.childMessage||'おだいを たしかめてね。');}
   };
   get('btnClearLessonQueue').onclick=()=>{this.queue=[];this.clearEditor();};
   for(const [id,kind]of [['btnDakuten','dakuten'],['btnHandakuten','handakuten'],['btnSmallKana','small']])get(id).onclick=()=>this.modifyLast(kind);
   get('btnSourceKeys').onclick=()=>this.setSource('keys');get('btnSourceSaved').onclick=()=>this.setSource('saved');
   get('btnSingleMode').onclick=()=>this.setMode('single');get('btnSequenceMode').onclick=()=>this.setMode('sequence');
   get('btnDraftBackspace').onclick=()=>{this.word.value=Array.from(this.word.value).slice(0,-1).join('');this.syncDraft();};
   get('btnDraftClear').onclick=()=>{this.word.value='';this.syncDraft();};
   get('btnQueueDraft').onclick=()=>{try{const data=normalize({word:this.word.value});if(this.addQueue(data.word)){this.clearEditor();this.say('おだいを ならべたよ。つぎの おだいを つくれるよ。');}}catch(error){this.say(error.childMessage);}};
   this.word.oninput=()=>{this.syncDraft();try{if(this.word.value)normalize({word:this.word.value});this.say('');}catch(error){this.say(error.childMessage);}};this.word.onkeydown=e=>{if(e.key==='Enter'&&!e.isComposing&&e.keyCode!==229){e.preventDefault();this.mode==='single'?this.start.click():this.queueStart.click();}};
   document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!e.isComposing&&!document.querySelector('#orientationPopup.open')&&get('modalSelect').classList.contains('open'))get('btnCloseSelect').click();});
   this.drawQueue();this.setMode('single');this.setSource('keys');
  }
  checkStartOrientation(button){
   if(this.options.canStart?.()!==false)return true;
   this.options.onOrientationRequired?.(button);return false;
  }
  setSource(source){
   this.source=source;document.getElementById('presetPanel').hidden=source!=='keys';document.getElementById('savedLessonsPanel').hidden=source!=='saved';
   document.getElementById('btnSourceKeys').setAttribute('aria-pressed',String(source==='keys'));document.getElementById('btnSourceSaved').setAttribute('aria-pressed',String(source==='saved'));
  }
  setMode(mode){
   this.mode=mode;const sequence=mode==='sequence';document.getElementById('lessonQueuePanel').hidden=!sequence;document.getElementById('btnQueueDraft').hidden=!sequence;this.start.hidden=sequence;this.queueStart.hidden=!sequence;
   document.getElementById('btnSingleMode').setAttribute('aria-pressed',String(!sequence));document.getElementById('btnSequenceMode').setAttribute('aria-pressed',String(sequence));this.syncDraft();
  }
  appendCharacter(char){
   if(this.busy)return;const next=(this.word.value+char).normalize('NFC');if(Array.from(next).length>20){this.say('１つの おだいは 20もじまでだよ。');return;}
   this.word.value=next;this.syncDraft();this.say('');
  }
  modifyLast(kind){
   if(this.busy)return;
   const chars=Array.from(this.word.value.normalize('NFC')),last=chars.at(-1);
   if(!last){this.say('さきに もじを えらんでね。');return;}
   const plain=last.normalize('NFD')[0];let next;
   if(kind==='small'){
    const large='あいうえおやゆよつわアイウエオヤユヨツワ',small='ぁぃぅぇぉゃゅょっゎァィゥェォャュョッヮ';
    const i=large.indexOf(last),j=small.indexOf(last);next=i>=0?small[i]:j>=0?large[j]:null;
   }else{
    const allowed=kind==='dakuten'?'うかきくけこさしすせそたちつてとはひふへほウカキクケコサシスセソタチツテトハヒフヘホ':'はひふへほハヒフヘホ';
    if(allowed.includes(plain)){const marked=(plain+(kind==='dakuten'?'\u3099':'\u309a')).normalize('NFC');next=last===marked?plain:marked;}
   }
   if(!next){this.say('この もじは かえられないよ。ほかの もじを えらんでね。');return;}
   chars[chars.length-1]=next;this.word.value=chars.join('');this.syncDraft();this.say('');
  }
  choose(record){if(this.busy)return;this.selectedLessonId=record.id;this.updateSelection();this.editingId=null;this.cancel.hidden=true;this.save.textContent='このおだいをとうろくする';this.word.value=record.word;this.label.value='';this.syncDraft();this.say('おだいに いれたよ。たしかめてから「はじめる」を おしてね。');}
  syncDraft(){
   const chars=Array.from(this.word.value.normalize('NFC')),preview=document.getElementById('lessonDraftPreview');
   const word=chars.join('');
   if(word!==this.previewWord){
    if(!chars.length){preview.replaceChildren();const hint=document.createElement('span');hint.className='draft-placeholder';hint.textContent='うえの もじを おしてね';preview.append(hint);}
    else{
     if(preview.children[0]?.classList.contains('draft-placeholder'))preview.replaceChildren();
     for(let i=0;i<chars.length;i++){let tile=preview.children[i];if(!tile){tile=document.createElement('span');tile.className='draft-character';preview.append(tile);}if(tile.textContent!==chars[i])tile.textContent=chars[i];}
     while(preview.children.length>chars.length)preview.children[preview.children.length-1].remove();
    }
    this.previewWord=word;
   }
   const selected=this.records.find(r=>r.id===this.selectedLessonId);if(selected&&selected.word!==word)this.selectedLessonId=null;
   this.updateSelection();
   document.getElementById('draftCount').textContent=chars.length+' / 20もじ';
   let valid=true;try{normalize({word:this.word.value});}catch{valid=false;}
   document.getElementById('draftTitle').textContent=this.mode==='sequence'?(this.queue.length+1)+'こめの おだい':'いま つくっている おだい';
   this.save.disabled=this.busy||!valid;this.start.disabled=this.busy||!valid;document.getElementById('btnQueueDraft').disabled=this.busy||!valid||this.queue.length>=20;
   document.getElementById('btnDraftBackspace').disabled=!chars.length;document.getElementById('btnDraftClear').disabled=!chars.length;
   const count=this.queue.length+(this.word.value.trim()?1:0);
   this.queueStart.disabled=this.busy||count===0||count>20||!!this.word.value.trim()&&!valid;
   this.queueStart.textContent=count?count+'この おだいで はじめる':'ならべた おだいで はじめる';
   this.renderQueue();
  }
  addQueue(word){if(this.queue.length>=20){this.say('おだいは 20こまで ならべられるよ。');return false;}this.queue.push(word);this.drawQueue();return true;}
  drawQueue(){this.syncDraft();}
  renderQueue(){
   const pending=this.word.value.trim(),entries=[...this.queue,...(pending?[pending]:[])];
   const signature=JSON.stringify([this.queue.length,...entries]);if(signature===this.queueSignature)return;this.queueSignature=signature;
   const follow=!!pending||this.queue.length>(this.queueShownLength||0);this.queueShownLength=this.queue.length;
   this.queueList.replaceChildren();
   entries.forEach((word,index)=>{
    const draft=index===this.queue.length,item=document.createElement('li');item.className=draft?'queue-current':'';
    item.dataset.word=word;item.dataset.pending=String(draft);const label=document.createElement('span');label.textContent=(index+1)+'．'+word;
    if(draft){const badge=document.createElement('small');badge.className='queue-draft-badge';badge.textContent='いまの おだい';label.append(badge);}
    const remove=document.createElement('button');remove.className='btn';remove.textContent='はずす';remove.setAttribute('aria-label',`${index+1}こめを はずす`);remove.onclick=()=>{if(draft)this.clearEditor();else{this.queue.splice(index,1);this.drawQueue();}};
    const move=delta=>{
     if(entries.length>20){this.say('おだいは 20こまで ならべられるよ。');return;}
     if(pending){try{normalize({word:pending});}catch(error){this.say(error.childMessage);return;}this.queue.push(pending);this.word.value='';this.editingId=null;this.label.value='';this.cancel.hidden=true;this.save.textContent='このおだいをとうろくする';}
     const next=index+delta;if(next<0||next>=this.queue.length)return;
     [this.queue[index],this.queue[next]]=[this.queue[next],this.queue[index]];this.drawQueue();
    };
    const up=document.createElement('button'),down=document.createElement('button');up.className=down.className='btn';up.textContent='まえへ';down.textContent='あとへ';up.disabled=index===0;down.disabled=index===entries.length-1;up.onclick=()=>move(-1);down.onclick=()=>move(1);
    item.append(label,up,down,remove);this.queueList.append(item);
   });
   if(follow)this.queueList.scrollTop=this.queueList.scrollHeight||0;
  }
  updateSelection(){
   for(const row of this.list.querySelectorAll('.saved-lesson')){const selected=row.dataset.lessonId===this.selectedLessonId;row.classList.toggle('is-selected',selected);row.querySelector('.saved-lesson-choice')?.setAttribute('aria-pressed',String(selected));}
  }
  say(text){this.status.textContent=text;}
  lock(busy){this.busy=busy;for(const button of [this.save,this.start,this.cancel])button.disabled=busy;for(const button of this.list.querySelectorAll('.saved-lesson-choice'))button.disabled=busy;this.syncDraft();}
  clearEditor(){
   this.editingId=null;this.word.value='';this.label.value='';this.cancel.hidden=true;
   this.save.textContent='このおだいをとうろくする';this.syncDraft();
  }
  edit(record){
   if(this.busy)return;this.editingId=record.id;this.word.value=record.word;this.label.value=record.label===record.word?'':record.label;
   this.cancel.hidden=false;this.save.textContent='このおだいに かきかえる';
   this.say('もじを なおして、「このおだいに かきかえる」を おしてね。');
   this.syncDraft();document.getElementById('quickRegistration').scrollIntoView?.({block:'nearest',behavior:'auto'});
  }
  async refresh(){
   const token=++this.generation;
   try{const records=await this.archive.listLessons();if(token!==this.generation)return false;this.records=records;this.draw();return true;}
   catch{if(token===this.generation)this.say('つくった おだいを ひらけなかったよ。おとなのひとに おしえてね。');return false;}
  }
  async saveWord(input,clear=false){
   if(this.busy)return;let data;
   try{data=normalize(input);}catch(error){this.say(error.childMessage);return;}
   this.lock(true);
   try{
    const result=await this.archive.saveLesson({...data,label:input.label});
    this.lastSavedId=result.lesson.id;this.selectedLessonId=result.lesson.id;
    if(clear)this.clearEditor();else{this.editingId=null;this.label.value='';this.cancel.hidden=true;this.save.textContent='このおだいをとうろくする';this.syncDraft();}
    if(!await this.refresh()){this.say('おだいは のこしたよ。いちらんを ひらきなおしてね。');return;}
    this.say(result.action==='restored'?'おだいを もどしたよ。':result.action==='existing'?'この おだいは、もう あるよ。':result.action==='updated'?'おだいを なおしたよ。':'おだいを とうろくしたよ。「とうろくした おだい」から えらべるよ。');
   }catch(error){this.say(error.childMessage||'おだいを のこせなかったよ。おとなのひとに おしえてね。');}
   finally{this.lock(false);}
  }
  async shelve(record,archived){
   if(this.busy)return;this.lock(true);
   try{const result=await this.archive.archiveLesson(record.id,archived);if(!result)throw new Error('missing');if(this.editingId===record.id)this.clearEditor();await this.refresh();this.say(archived?'おだいを しまったよ。「しまった おだい」から もどせるよ。':'おだいを もどしたよ。');}
   catch{this.say('おだいを しまいなおせなかったよ。もういちど ためしてね。');}
   finally{this.lock(false);}
  }
  draw(){
   this.list.replaceChildren();this.trash.replaceChildren();
   const matches=this.records;
   const active=matches.filter(record=>!record.archived),archived=matches.filter(record=>record.archived);
   let shown=0;const more=document.createElement('button');more.className='btn lesson-more';more.textContent='もっと みる';
   const card=(record,restoring)=>{
    const row=document.createElement('div');row.className='saved-lesson';row.dataset.lessonId=record.id;row.classList.toggle('is-selected',!restoring&&record.id===this.selectedLessonId);
    const choose=document.createElement('button');choose.type='button';choose.className='saved-lesson-choice';choose.disabled=!!this.busy;choose.setAttribute('aria-pressed',String(!restoring&&record.id===this.selectedLessonId));
    const label=document.createElement('strong');label.textContent=record.label;
    const text=document.createElement('span');text.textContent=record.label===record.word?'おだいに いれる':record.word;
    choose.append(label,text);choose.onclick=()=>this.choose(record);
    const tools=document.createElement('div');tools.className='lesson-tools';
    if(restoring){const restore=document.createElement('button');restore.className='btn';restore.textContent='もどす';restore.onclick=()=>this.shelve(record,false);tools.append(restore);choose.disabled=true;}
    else{
     const edit=document.createElement('button');edit.className='btn';edit.textContent='なおす';edit.onclick=()=>this.edit(record);
     const hide=document.createElement('button');hide.className='btn';hide.textContent='しまう';hide.onclick=()=>this.shelve(record,true);tools.append(edit,hide);

    }
    if(restoring)row.append(choose,tools);else{const management=document.createElement('details');const summary=document.createElement('summary');summary.textContent='なおす・しまう';management.className='lesson-management';management.append(summary,tools);row.append(choose,management);}return row;
   };
   const append=()=>{for(const record of active.slice(shown,shown+24))this.list.append(card(record,false));shown+=24;more.hidden=shown>=active.length;};
   append();more.onclick=append;this.list.append(more);
   if(!active.length){const empty=document.createElement('p');empty.className='lesson-empty';empty.textContent='まだ おだいが ないよ。もじを おして つくり、とうろくしてね。';this.list.append(empty);}
   for(const record of archived)this.trash.append(card(record,true));
   if(!archived.length){const empty=document.createElement('p');empty.textContent='しまった おだいは ないよ。';this.trash.append(empty);}
  }
 }
 root.MonjiLessons={normalize,invalid,LessonLibrary};
 if(typeof module!=='undefined')module.exports=root.MonjiLessons;
})(globalThis);
