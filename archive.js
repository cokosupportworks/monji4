(function (root) {
  'use strict';
  class StrokeArchive {
    constructor() { this.database = null; this.pending = this.open(); this.pending.catch(() => {}); }
    open() {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open('monjibotaru4', 2);
        request.onupgradeneeded = () => {
          const db = request.result;
          if(!db.objectStoreNames.contains('records')){
            const records = db.createObjectStore('records', { keyPath: 'id' });records.createIndex('date', 'date');
          }
          if(!db.objectStoreNames.contains('state'))db.createObjectStore('state');
          if(!db.objectStoreNames.contains('lessons')){
            const lessons=db.createObjectStore('lessons',{keyPath:'id'});lessons.createIndex('word','word',{unique:true});
          }
        };
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error('ほかの画面を閉じて、もう一度お試しください'));
        request.onsuccess = () => { this.database = request.result; this.database.onversionchange = () => this.database.close(); resolve(); };
      });
    }
    async run(store, mode, action) {
      await this.pending;
      return new Promise((resolve, reject) => {
        const tx = this.database.transaction(store, mode);
        let result;
        try { const request = action(tx.objectStore(store)); request.onsuccess = () => { result = request.result; }; }
        catch (error) { tx.abort(); reject(error); return; }
        tx.oncomplete = () => resolve(result);
        tx.onabort = tx.onerror = () => reject(tx.error || new Error('保存に失敗しました'));
      });
    }
    put(record) { return this.run('records', 'readwrite', store => store.put(record)); }
    async restoreBackup(prepared){
      await this.pending;
      return new Promise((resolve,reject)=>{
        const tx=this.database.transaction(['records','state'],'readwrite'),store=tx.objectStore('records');
        const result={added:0,skipped:0,recovery:!!prepared.draft};let problem;
        for(const record of prepared.records){
          const get=store.get(record.id);get.onsuccess=()=>{
            if(get.result){
              if(get.result.char!==record.char||(get.result.word||get.result.char)!==record.word){problem=new Error('記録番号が既存の別の文字と重なっています。復元を中止しました。');tx.abort();return;}
              result.skipped++;
            }else{store.put(record);result.added++;}
          };
        }
        if(prepared.draft)tx.objectStore('state').put(prepared.draft,'importedRecovery');
        tx.oncomplete=()=>resolve(result);
        tx.onabort=tx.onerror=()=>reject(problem||tx.error||new Error('復元できませんでした。既存の記録は変更していません。'));
      });
    }
    async activateRecovery(previous=false){
      await this.pending;
      return new Promise((resolve,reject)=>{
        const tx=this.database.transaction('state','readwrite'),store=tx.objectStore('state');let target,problem;
        const get=store.get(previous?'previousRecovery':'importedRecovery');
        get.onsuccess=()=>{
          target=get.result;if(!target?.word){problem=new Error('再開できる練習データがありません。');tx.abort();return;}
          const current=store.get('draft');current.onsuccess=()=>{
            if(current.result?.word)store.put(current.result,'previousRecovery');
            store.put(target,'draft');
          };
        };
        tx.oncomplete=()=>resolve(target);
        tx.onabort=tx.onerror=()=>reject(problem||tx.error||new Error('練習を切り替えられませんでした。'));
      });
    }
    async deleteRecords(ids){
      const keys=[...new Set(ids)].filter(Boolean);await this.pending;
      if(!keys.length)return 0;
      return new Promise((resolve,reject)=>{
        const tx=this.database.transaction('records','readwrite'),store=tx.objectStore('records');
        try{for(const id of keys)store.delete(id);}catch(error){tx.abort();reject(error);return;}
        tx.oncomplete=()=>resolve(keys.length);
        tx.onabort=tx.onerror=()=>reject(tx.error||new Error('記録を削除できませんでした'));
      });
    }
    async list() { return (await this.run('records', 'readonly', store => store.getAll())).sort((a, b) => b.date.localeCompare(a.date)); }
    state(key) { return this.run('state', 'readonly', store => store.get(key)); }
    saveState(key, value) { return this.run('state', 'readwrite', store => store.put(value, key)); }
    async listLessons(){
      return (await this.run('lessons','readonly',store=>store.getAll())).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)||a.id.localeCompare(b.id));
    }
    async saveLesson(input){
      const data=MonjiLessons.normalize(input);await this.pending;
      return new Promise((resolve,reject)=>{
        const tx=this.database.transaction('lessons','readwrite'),store=tx.objectStore('lessons');let result,customError;
        const fail=message=>{customError=MonjiLessons.invalid(message);tx.abort();};
        const lookup=store.index('word').get(data.word);
        lookup.onsuccess=()=>{
          const same=lookup.result;
          if(data.id&&same&&same.id!==data.id){fail('おなじ おだいが あるよ。いちらんから えらんでね。');return;}
          const save=existing=>{
            if(data.id&&!existing){fail('その おだいが みつからないよ。もういちど えらんでね。');return;}
            const now=new Date().toISOString();
            const label=data.id?data.label:(data.hasLabel?data.label:existing?.label||data.label);
            const lesson={id:existing?.id||(globalThis.crypto?.randomUUID?crypto.randomUUID():Date.now()+'-'+Math.random()),word:data.word,label,
              createdAt:existing?.createdAt||now,updatedAt:now,archived:false};
            const action=!existing?'created':existing.archived?'restored':existing.word===lesson.word&&existing.label===lesson.label?'existing':'updated';
            result={lesson,action};store.put(lesson);
          };
          if(data.id){const get=store.get(data.id);get.onsuccess=()=>save(get.result);}
          else save(same);
        };
        tx.oncomplete=()=>resolve(result);tx.onerror=tx.onabort=()=>reject(customError||tx.error||new Error('lesson save failed'));
      });
    }
    async archiveLesson(id,archived){
      await this.pending;
      return new Promise((resolve,reject)=>{
        const tx=this.database.transaction('lessons','readwrite'),store=tx.objectStore('lessons');let result;
        const request=store.get(id);request.onsuccess=()=>{if(request.result){result={...request.result,archived:!!archived,updatedAt:new Date().toISOString()};store.put(result);}};
        tx.oncomplete=()=>resolve(result);tx.onerror=tx.onabort=()=>reject(tx.error||new Error('lesson update failed'));
      });
    }
    async associateDraft(word, items, practiceId, practiceStartedAt) {
      await this.pending;
      // Only the exact record IDs held by the resumed draft are evidence of
      // one practice. Do not infer groups from dates or matching words.
      return new Promise((resolve,reject) => {
        const tx=this.database.transaction('records','readwrite'),store=tx.objectStore('records');
        items.forEach((item,index) => {
          if(!item?.id)return;
          const get=store.get(item.id);
          get.onsuccess=()=>{
            const record=get.result;
            if(record && !record.practiceId && record.word===word && record.index===index)
              store.put({...record,practiceId,practiceStartedAt});
          };
        });
        tx.oncomplete=()=>resolve();tx.onabort=tx.onerror=()=>reject(tx.error||new Error('記録を整理できませんでした'));
      });
    }
    // This build intentionally never prunes old handwriting automatically.
    // Retention limits will be chosen after measuring real practice data.
  }
  root.StrokeArchive = StrokeArchive;
})(globalThis);
