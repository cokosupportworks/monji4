// Transactional test model. This does not replace native-browser IndexedDB QA.
function makeDB(){
 const stores=new Map([['records',new Map([['old-writing',{id:'old-writing',word:'まえ',favorite:true,strokes:[[{x:.2,y:.3,t:1}]]}]])],['state',new Map()]]);
 const db={version:1,stores,created:[],queue:[],objectStoreNames:{contains:name=>stores.has(name)},close(){},
  createObjectStore(name){if(stores.has(name))throw new Error('existing store');stores.set(name,new Map());db.created.push(name);return{createIndex(){}};},
  transaction(name){
   const tx={name,tasks:[],aborted:false,error:null};
   tx.abort=()=>{if(tx.ended)return;tx.aborted=true;tx.error||=new Error('aborted');finish(false);};
   const finish=ok=>{if(tx.ended)return;tx.ended=true;if(ok){stores.set(name,tx.data);tx.oncomplete?.();}else tx.onabort?.();db.queue.shift();db.queue[0]?.start();};
   const step=()=>{
    if(tx.ended)return;
    const task=tx.tasks.shift();if(!task){finish(true);return;}
    try{task.request.result=task.operation();task.request.onsuccess?.();}
    catch(error){tx.error=error;finish(false);return;}
    if(!tx.ended)queueMicrotask(step);
   };
   const request=operation=>{const r={};tx.tasks.push({request:r,operation});return r;};
   tx.objectStore=()=>({
    get:key=>request(()=>structuredClone(tx.data.get(key))),getAll:()=>request(()=>structuredClone([...tx.data.values()])),
    index:()=>({get:word=>request(()=>structuredClone([...tx.data.values()].find(r=>r.word===word)))}),
    put:(value,key)=>request(()=>{
     if(db.failNextPut&&name==='lessons'){db.failNextPut=false;throw new Error('quota');}
     const id=key??value.id;
     if(name==='lessons'&&[...tx.data.values()].some(r=>r.word===value.word&&r.id!==id))throw new Error('ConstraintError');
     tx.data.set(id,structuredClone(value));return id;
    })
   });
   tx.start=()=>{tx.data=new Map([...stores.get(name)].map(([k,v])=>[k,structuredClone(v)]));queueMicrotask(step);};
   db.queue.push(tx);if(db.queue.length===1)tx.start();return tx;
  }
 };
 const indexedDB={open(name,version){const request={};queueMicrotask(()=>{request.result=db;if(version>db.version){request.onupgradeneeded?.();db.version=version;}request.onsuccess?.();});return request;}};
 return{db,indexedDB};
}
module.exports={makeDB};
