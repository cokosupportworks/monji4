(function(root){
 'use strict';
 const fail=message=>{throw new Error(message);};
 const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
 const text=(v,name,max=256)=>{if(typeof v!=='string'||!v.length||v.length>max)fail(name+'が正しくありません。');return v;};
 const date=(v,fallback)=>{const d=v||fallback;if(typeof d!=='string'||!Number.isFinite(Date.parse(d)))fail('記録の日付が正しくありません。');return new Date(d).toISOString();};
 function prepare(input){
  if(!object(input)||input.version!==1||!['monjibotaru4-archive','monjibotaru4-recovery'].includes(input.format))fail('もんじぼたる４から書き出したJSONファイルを選んでください。');
  let points=0;const lines=value=>{
   if(!Array.isArray(value)||value.length>128)fail('筆跡データが正しくありません。');
   return Array.from(value,line=>{
    if(line==null)return[];
    if(!Array.isArray(line)||line.length>100000)fail('筆跡データが正しくありません。');
    points+=line.length;if(points>3000000)fail('筆跡データが大きすぎます。');
    return line.map(p=>{if(!object(p)||!Number.isFinite(p.x)||!Number.isFinite(p.y)||Math.abs(p.x)>100||Math.abs(p.y)>100||p.t!=null&&(!Number.isFinite(p.t)||p.t<0||p.t>1e10))fail('筆跡の座標・時刻が正しくありません。');return{x:p.x,y:p.y,t:p.t||0};});
   });
  };
  const word=value=>{text(value,'お題',80);if(Array.from(value).length>20||!value.trim()||/\s/u.test(value))fail('お題は空白を含まない20文字以内にしてください。');return value;};
  const flags=(value,length)=>{if(value!=null&&(!Array.isArray(value)||value.some(v=>v!=null&&typeof v!=='boolean')))fail('おてつだいの記録が正しくありません。');return Array.from({length},(_,i)=>value?.[i]===true);};
  const normalizeRecord=raw=>{
   if(!object(raw))fail('文字の記録が正しくありません。');
   const id=text(raw.id,'記録番号'),char=text(raw.char,'文字',4);if(Array.from(char).length!==1)fail('文字の記録が正しくありません。');
   const prompt=word(raw.word||char),strokes=lines(raw.strokes),skipped=flags(raw.skipped,strokes.length);
   if(raw.index!=null&&(!Number.isInteger(raw.index)||raw.index<0||raw.index>=Array.from(prompt).length||Array.from(prompt)[raw.index]!==char))fail('お題と文字の位置が一致しません。');
   const record={id,char,word:prompt,date:date(raw.date),strokes,skipped,assisted:raw.assisted===true||skipped.some(Boolean),favorite:raw.favorite===true,formatVersion:2};
   if(raw.index!=null)record.index=raw.index;
   if(raw.practiceId!=null)record.practiceId=text(raw.practiceId,'練習番号');
   if(raw.practiceStartedAt!=null)record.practiceStartedAt=date(raw.practiceStartedAt);
   if(object(raw.settings))record.settings=raw.settings;
   if(typeof raw.source==='string')record.source=raw.source.slice(0,512);
   return record;
  };
  const records=new Map();const add=record=>{const old=records.get(record.id);if(old&&(old.char!==record.char||old.word!==record.word||old.index!==record.index))fail('同じ記録番号に異なる文字が含まれています。');if(!old)records.set(record.id,record);};
  let draft=null;
  if(input.format==='monjibotaru4-archive'){
   if(!Array.isArray(input.records)||input.records.length>50000)fail('作品帳の記録が正しくありません。');
   for(const raw of input.records)add(normalizeRecord(raw));
  }else{
   if(input.unsavedRecords!=null&&(!Array.isArray(input.unsavedRecords)||input.unsavedRecords.length>50000))fail('未保存の記録が正しくありません。');
   for(const raw of input.unsavedRecords||[])add(normalizeRecord(raw));
   const prompt=word(input.word),chars=Array.from(prompt),stamp=date(input.date||new Date().toISOString());
   if(!Array.isArray(input.items)||input.items.length>chars.length)fail('練習途中の文字数が正しくありません。');
   // Stable fallback IDs make repeated imports of older files idempotent too.
   let digest;const recoveryKey=()=>{
    if(digest)return digest;let a=2166136261,b=2654435769;
    const serialized=JSON.stringify(input);for(let i=0;i<serialized.length;i++){const c=serialized.charCodeAt(i);a=Math.imul(a^c,16777619);b=Math.imul(b^c,2246822519);}
    return digest=(a>>>0).toString(16).padStart(8,'0')+(b>>>0).toString(16).padStart(8,'0');
   };
   const practiceId=input.practiceId?text(input.practiceId,'練習番号'):'recovered-'+recoveryKey();
   const started=input.practiceStartedAt?date(input.practiceStartedAt):stamp;
   const items=Array.from({length:chars.length},(_,index)=>{
    const raw=input.items[index];if(raw==null)return{};if(!object(raw))fail('練習途中のデータが正しくありません。');
    const strokes=lines(raw.strokes||[]),skipped=flags(raw.skipped,strokes.length);
    const strokeIndex=raw.strokeIndex==null?strokes.length:raw.strokeIndex;
    if(!Number.isInteger(strokeIndex)||strokeIndex<0||strokeIndex>strokes.length||strokeIndex>128)fail('練習途中の画数が正しくありません。');
    const item={strokes,skipped,strokeIndex,complete:raw.complete===true,archived:false};
    if(raw.id)item.id=text(raw.id,'記録番号');if(raw.date)item.date=date(raw.date);
    if(item.complete){
     item.id||='recovered-record-'+recoveryKey()+'-'+index;item.date||=stamp;
     if(!records.has(item.id))add({id:item.id,char:chars[index],word:prompt,index,date:item.date,practiceId,practiceStartedAt:started,strokes,skipped,assisted:skipped.some(Boolean),favorite:false,formatVersion:2,...(object(raw.settings)?{settings:raw.settings}:{})});
     const r=records.get(item.id);if(r.word!==prompt||r.char!==chars[index]||r.index!=null&&r.index!==index)fail('練習途中の記録番号が一致しません。');
     item.archived=true;
    }
    return item;
   });
   const inferred=items.findIndex(item=>!item.complete),index=input.index==null?(inferred<0?chars.length-1:inferred):input.index;
   if(!Number.isInteger(index)||index<0||index>=chars.length)fail('再開する文字の位置が正しくありません。');
   draft={word:prompt,index,items,practiceId,practiceStartedAt:started,finished:items.every(item=>item.complete)};
   if(input.sequence!=null){
    if(!Array.isArray(input.sequence)||input.sequence.length>20)fail('連続お題が正しくありません。');
    const sequence=input.sequence.map(word),position=input.sequenceIndex||0;
    if(sequence.length&&(!Number.isInteger(position)||position<0||position>=sequence.length||sequence[position]!==prompt))fail('連続お題の位置が一致しません。');
    draft.sequence=sequence;draft.sequenceIndex=position;
   }
  }
  return {format:input.format,records:[...records.values()],draft};
 }
 root.MonjiBackup={prepare};if(typeof module!=='undefined')module.exports=root.MonjiBackup;
})(globalThis);
