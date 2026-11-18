
  (function() {
    'use strict';

    // 1. Web Audio Synthesizer
    class Sound {
      constructor() { this.ctx = null; this.on = true; }
      init() {
        try {
          if(this.ctx?.state==='closed'){this.ctx=null;this.noiseBuffer=null;}
          if(!this.ctx){const AC=window.AudioContext||window.webkitAudioContext;if(AC)this.ctx=new AC();}
          if(!this.ctx)return;
          const ctx=this.ctx;
          if(ctx.state==='suspended'||ctx.state==='interrupted')this.ready=Promise.resolve(ctx.resume()).catch(error=>{this.lastError=error;return false;});
          else this.ready=Promise.resolve(true);
        }catch(error){this.lastError=error;}
      }
      whenReady(play,active=()=>true){
        const ctx=this.ctx;if(!ctx)return;
        const run=()=>{if(this.on&&this.ctx===ctx&&(!ctx.state||ctx.state==='running')&&active())play(ctx);};
        if(!ctx.state||ctx.state==='running')run();else Promise.resolve(this.ready).then(run).catch(error=>{this.lastError=error;});
      }
      success() {
        if(!this.on)return;this.init();const requested=performance.now();
        this.whenReady(ctx=>{
          try{
            const t=ctx.currentTime,o=ctx.createOscillator(),g=ctx.createGain();
            o.type='sine';o.frequency.setValueAtTime(988,t);
            g.gain.setValueAtTime(.001,t);g.gain.exponentialRampToValueAtTime(.12,t+.008);g.gain.exponentialRampToValueAtTime(.001,t+.115);
            o.connect(g);g.connect(ctx.destination);o.start(t);o.stop(t+.12);
            this.stopFeedback=()=>{try{o.stop();}catch(e){}};
            o.onended=()=>{o.disconnect?.();g.disconnect?.();};
          }catch(error){this.lastError=error;}
        },()=>performance.now()-requested<400);
      }
      fail() {
        if (!this.on) return; this.init(); if (!this.ctx) return;
        try {
          const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
          o.type = 'triangle'; o.frequency.setValueAtTime(329.63, t); o.frequency.linearRampToValueAtTime(261.63, t + 0.2);
          g.gain.setValueAtTime(0.2, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
          o.connect(g); g.connect(this.ctx.destination); o.start(t); o.stop(t + 0.25);
        } catch(e){}
      }
      train(duration, delay=0) {
        this.stopTrain?.();
        if(!this.on)return()=>{};this.init();
        let active=true;const voices=[],deadline=performance.now()+duration+delay;
        const stop=()=>{active=false;for(const voice of voices)try{voice.stop();}catch(e){}};
        this.stopTrain=stop;
        this.whenReady(ctx=>{
          try {
            const t=ctx.currentTime+delay/1000;
            if(ctx.createBuffer&&!this.noiseBuffer){
              this.noiseBuffer=ctx.createBuffer(1,Math.ceil((ctx.sampleRate||44100)*.07),ctx.sampleRate||44100);
              const data=this.noiseBuffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.exp(-i/data.length*4);
            }
            for(let beat=0;beat<duration/1000;beat+=.48)for(const shift of [0,.16]){
              if(beat+shift>=duration/1000)continue;
              const at=t+beat+shift,o=ctx.createOscillator(),g=ctx.createGain();
              o.type='triangle';o.frequency.setValueAtTime(shift?460:330,at);
              g.gain.setValueAtTime(.001,at);g.gain.exponentialRampToValueAtTime(.13,at+.004);g.gain.exponentialRampToValueAtTime(.001,at+.085);
              o.connect(g);g.connect(ctx.destination);o.start(at);o.stop(at+.09);voices.push(o);
              o.onended=()=>{o.disconnect?.();g.disconnect?.();};
              if(this.noiseBuffer&&ctx.createBufferSource){
                const clack=ctx.createBufferSource(),volume=ctx.createGain();clack.buffer=this.noiseBuffer;
                volume.gain.setValueAtTime(.15,at);volume.gain.exponentialRampToValueAtTime(.001,at+.065);
                const filter=ctx.createBiquadFilter?.();
                if(filter){filter.type='bandpass';filter.frequency.setValueAtTime(1400,at);filter.Q.setValueAtTime(.7,at);clack.connect(filter);filter.connect(volume);}else clack.connect(volume);
                volume.connect(ctx.destination);clack.start(at);clack.stop(at+.07);voices.push(clack);
                clack.onended=()=>{clack.disconnect?.();filter?.disconnect?.();volume.disconnect?.();};
              }
            }
          }catch(error){this.lastError=error;}
        },()=>active&&performance.now()<deadline);
        return()=>{stop();if(this.stopTrain===stop)this.stopTrain=null;};
      }
      complete() {
        if (!this.on) return; this.init(); if (!this.ctx) return;
        try {
          const t = this.ctx.currentTime;
          [523.25, 659.25, 783.99, 1046.50].forEach((f, i) => {
            const o = this.ctx.createOscillator(), g = this.ctx.createGain();
            o.type = 'triangle'; o.frequency.setValueAtTime(f, t + i * 0.09);
            g.gain.setValueAtTime(0.18, t + i * 0.09); g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.09 + 0.6);
            o.connect(g); g.connect(this.ctx.destination); o.start(t + i * 0.09); o.stop(t + i * 0.09 + 0.6);
          });
        } catch(e){}
      }
    }
    const sound = new Sound();

    // User-supplied recordings share the same unlocked audio context as the effects.
    class RecordedVoice {
      constructor(){this.enabled=true;this.generation=0;this.buffers=new Map();this.paths={speed:'assets/voice/slow.wav',pause:'assets/voice/imagine.wav',complete:'assets/voice/complete.wav',welcome:'assets/voice/welcome.wav'};}
      unlock(){
        const ctx=sound.ctx;if(!ctx?.decodeAudioData||typeof fetch!=='function')return;
        if(this.context!==ctx){this.context=ctx;this.buffers.clear();}
        for(const [kind,url]of Object.entries(this.paths))if(!this.buffers.has(kind)){
          const loading=fetch(url).then(response=>{if(!response.ok)throw new Error('音声を読み込めません: '+url);return response.arrayBuffer();}).then(data=>ctx.decodeAudioData(data));
          this.buffers.set(kind,loading);
          loading.catch(error=>{this.lastError=error;if(this.buffers.get(kind)===loading)this.buffers.delete(kind);});
        }
      }
      cancel(){this.generation++;if(this.current){try{this.current.stop();}catch{}this.current=null;}}
      play(kind,onStarted){
        this.cancel();if(!this.enabled||!sound.on||!this.paths[kind])return;
        this.kind=kind;sound.init();this.unlock();const token=this.generation,ctx=sound.ctx,pending=this.buffers.get(kind),requested=performance.now();if(!pending)return;
        const active=()=>token===this.generation&&this.enabled&&sound.on&&!document.hidden&&performance.now()-requested<4000;
        pending.then(buffer=>{if(!active()||sound.ctx!==ctx)return;sound.whenReady(()=>{
          if(!active())return;
          try{const source=ctx.createBufferSource();source.buffer=buffer;source.connect(ctx.destination);this.current=source;source.onended=()=>{source.disconnect?.();if(this.current===source)this.current=null;};source.start();onStarted?.();}
          catch(error){this.lastError=error;}
        },active);}).catch(error=>{this.lastError=error;});
      }
    }
    const speech = new RecordedVoice();

    // 2. Preset Lists
    const PRESETS = {
      hiragana: 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん'.split(''),
      katakana: 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン'.split(''),
      kanji1: '一二三四五六七八九十百千上下左右中大小月日年早木林森山川土空田天生花草犬虫音町村男女子目耳手足見立休言字学校文本日名正水火'.split(''),
      kanji2: '引羽雲園遠何科夏家歌画会回海絵外角楽活間丸岩顔汽記帰弓牛魚京強教近兄形計元原戸古午後語工公広交光考行'.split(''),
      numbers: Array.from({length:61},(_,i)=>String(i))
    };

    // 3. Official KanjiVG Stroke Vector Loader
    class StrokeLoader {
      constructor() {
        this.cache = new Map();
        this.pending = new Map(); this.activeRequests = 0; this.requestQueue = [];
      }
      getHex(ch) {
        return ch.codePointAt(0).toString(16).padStart(5, '0');
      }
      load(ch) {
        if (this.cache.has(ch)) return Promise.resolve(this.cache.get(ch));
        if (this.pending.has(ch)) return this.pending.get(ch);
        const task = (async () => {
          if (this.activeRequests < 4) this.activeRequests++;
          else await new Promise(resolve => this.requestQueue.push(resolve));
          try { return await this.loadSource(ch); }
          finally {
            const next = this.requestQueue.shift();
            if (next) next(); else this.activeRequests--;
          }
        })().finally(() => this.pending.delete(ch));
        this.pending.set(ch, task); return task;
      }

      async loadSource(ch) {
        if (this.cache.has(ch)) return this.cache.get(ch);
        const bundled = globalThis.MonjiBundledStrokes?.characters?.[ch];
        if (Array.isArray(bundled) && bundled.length) {
          const paths = bundled.slice(); this.cache.set(ch, paths); return paths;
        }
        const k = `kvg_${ch}`;
        try {
          const local = localStorage.getItem(k);
          if (local) {
            const p = JSON.parse(local);
            if (Array.isArray(p) && p.length > 0 && p.every(v => typeof v === 'string' && /^[Mm]/.test(v))) {
              this.cache.set(ch, p);
              return p;
            }
          }
        } catch(e) {}

        const hex = this.getHex(ch);
        const urls = [
          `https://cdn.jsdelivr.net/gh/KanjiVG/kanjivg@master/kanji/${hex}.svg`,
          `https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji/${hex}.svg`,
          `https://unpkg.com/kanjivg@latest/kanji/${hex}.svg`
        ];

        for (const u of urls) {
          try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 2500);
            const res = await fetch(u, { cache: 'force-cache', signal: controller.signal });
            clearTimeout(timer);
            if (res.ok) {
              const txt = await res.text();
              const doc = new DOMParser().parseFromString(txt, 'image/svg+xml');
              const paths = Array.from(doc.querySelectorAll('path[d]'))
                .filter(p => !((p.getAttribute('id') || '').includes('StrokeNumbers')))
                .map(p => p.getAttribute('d'));
              if (paths.length > 0) {
                this.cache.set(ch, paths);
                try { localStorage.setItem(k, JSON.stringify(paths)); } catch(e) {}
                return paths;
              }
            }
          } catch(e) {}
        }

        throw new Error('この文字の書き順を取得できません。未対応または通信の問題です。');
      }
    }
    const loader = new StrokeLoader();

    // 4. SVG Curve Sampler
    // Cache design-space geometry once. Resizing scales points, not SVG curves.
    const pathCache = new Map();
    function samplePath(dStr, w, h) {
      let entry = pathCache.get(dStr);
      if (!entry) {
        try {
          const path = document.getElementById('svgHelperPath');
          if (!path?.getTotalLength) return [];
          path.setAttribute('d', dStr);
          const length = path.getTotalLength();
          if (!(length > 0) || !Number.isFinite(length)) return [];
          const scale = 460 * 0.76 / 109, margin = 460 * 0.12;
          const count = Math.max(30, Math.min(2048, Math.ceil(length * scale / 2)));
          const points = [];
          for (let i = 0; i <= count; i++) {
            const pt = path.getPointAtLength(i * length / count);
            points.push({ x: margin + pt.x * scale, y: margin + pt.y * scale });
          }
          entry = { points, sizes: new Map() }; pathCache.set(dStr, entry);
          if (pathCache.size > 256) pathCache.delete(pathCache.keys().next().value);
        } catch { return []; }
      } else {
        pathCache.delete(dStr); pathCache.set(dStr, entry);
      }
      if (w === 460 && h === 460) return entry.points;
      const key = w + ':' + h;
      if (!entry.sizes.has(key)) {
        entry.sizes.set(key, entry.points.map(pt => ({x:pt.x*w/460,y:pt.y*h/460})));
        if (entry.sizes.size > 3) entry.sizes.delete(entry.sizes.keys().next().value);
      }
      return entry.sizes.get(key);
    }

    // 5. Strict Stroke Evaluator
    const evaluateStroke = MonjiCore.evaluate;

    // 6. Main App Controller
    class App {
      constructor() {
        this.word = '';
        this.chars = Array.from(this.word);
        this.cIdx = 0;
        this.strokes = [];
        this.sIdx = 0;
        this.drawing = [];
        this.userStrokes = []; // 軌跡保存用配列
        this.isDown = false;
        this.showGrid = true;
        this.showGuide = true;
        this.currentCategoryTab = 'hiragana';
        this.knownChars=new Set();this.lessonSequence=[];this.lessonIndex=0;
        
        // もんじぼたる設定
        this.baseOpacity = 1.0;
        this.hotaru = {
          enabled: true,
          visibleSec: 1.5,
          hiddenSec: 3.0,
          currentOpacity: 1.0,
          startTime: 0
        };

        // 学習履歴の読み込み
        this.history = this.loadHistory();

        this.level = 'relaxed';
        this.params = {
          relaxed: { relaxed:true, dev:46, startTol:460, maxRatio:2.5, validRatio:.60, minCoverage:.55 },
          easy: { dev: 38, startTol: 45, maxRatio: 2.2, validRatio: 0.72, minCoverage: 0.65 },
          normal: { dev: 26, startTol: 32, maxRatio: 1.6, validRatio: 0.85, minCoverage: 0.80 },
          strict: { dev: 16, startTol: 20, maxRatio: 1.3, validRatio: 0.92, minCoverage: 0.90 }
        };

        this.stage = document.getElementById('stage');
        this.tplCanvas = document.getElementById('templateCanvas');
        this.drwCanvas = document.getElementById('drawCanvas');
        this.anmCanvas = document.getElementById('animCanvas');
        this.inkCanvas = document.getElementById('inkCanvas');
        this.tplCtx = this.tplCanvas.getContext('2d');
        this.drwCtx = this.drwCanvas.getContext('2d');
        this.anmCtx = this.anmCanvas.getContext('2d');
        this.inkCtx = this.inkCanvas.getContext('2d');
        this.toast = document.getElementById('toast');
        this.hanamaru = document.getElementById('hanamaru');

        const unlockAudio=event=>{if(sound.on&&!event.isComposing){sound.init();speech.unlock();if(this.welcomeVoicePending&&['pointerdown','touchend','keydown'].includes(event.type))this.playWelcomeVoice();}};
        for(const type of ['pointerdown','pointerup','touchend','click','keydown'])document.addEventListener(type,unlockAudio,true);
        this.bindEvents();
        this.bindFoundationEvents();
        this.bindPracticeTools();
        this.resize();
        window.addEventListener('resize', () => { this.resize(); this.render();this.updateOrientation(); });
        window.addEventListener('orientationchange',()=>this.updateOrientation());
        this.restoreSettings(window.monjiSettings || {});
        if(globalThis.MonjiLessons)this.lessonLibrary=new MonjiLessons.LessonLibrary({
          archive:this.archive,currentWord:()=>this.word,
          canStart:()=>this.orientationReady(),
          onOrientationRequired:button=>this.showOrientationPrompt(button),
          startSequence:words=>this.startSequence(words),
          start:word=>{
            if(this.finishing||this.transitioning||this.isDown||!this.orientationReady())return false;
            this.setWord(word);document.getElementById('modalSelect').classList.remove('open');return true;
          }
        });
        this.journey = new JourneyView(this.stage, () => { this.resize(); this.render(); }, (index,event) => this.selectFixed(index,event));
        this.journey.apply(this.display); this.resize();
        this.bindJourneyEvents();
        this.updateOrientation();
        this.journey.beginReset();
        this.setNotice('');
        this.renderPills();
        this.welcomeVoicePending=true;this.playWelcomeVoice();
      }

      playWelcomeVoice(){
        if(!this.welcomeVoicePending||this.word||document.hidden||globalThis.MonjiOpening?.active)return;
        speech.play('welcome',()=>{this.welcomeVoicePending=false;});
      }

      loadHistory() {
        try {
          const raw = localStorage.getItem('trace_study_history');
          return raw ? JSON.parse(raw) : {};
        } catch(e) {
          return {};
        }
      }

      saveHistoryRecord(char) {
        if (!char) return;
        if (!this.history[char]) {
          this.history[char] = { count: 0, lastDate: null };
        }
        this.history[char].count += 1;
        this.history[char].lastDate = new Date().toISOString();
        try {
          localStorage.setItem('trace_study_history', JSON.stringify(this.history));
        } catch(e) {}
      }

      startHotaru() {
        if (!this.orientationReady() || this.awaitingArrival || this.preparingWord || !this.hotaru.enabled || this.transitioning || this.loading || this.sIdx >= this.strokes.length || document.hidden || document.querySelector('.modal-overlay.open')) return;
        this.hotaru.startTime = performance.now();
        if (!this.hotaruAnimId) {
          const loop = (time) => {
            if (!this.hotaru.enabled) {
              this.hotaruAnimId = null;
              this.applyModelOpacity(this.baseOpacity);
              return;
            }
            const elapsed = (time - this.hotaru.startTime) / 1000;
            const cycle = this.hotaru.visibleSec + this.hotaru.hiddenSec;
            const phaseTime = this.hotaru.once && elapsed >= this.hotaru.visibleSec ? this.hotaru.visibleSec : elapsed % cycle;
            
            // 蛍のような滑らかなフェードを計算（0.3秒間でフェードイン/アウト）
            // 設定時間が短すぎる場合は半分の時間でフェード
            const fadeDur = Math.min(0.3, this.hotaru.visibleSec / 2, this.hotaru.hiddenSec / 2);
            
            let val = 0;
            if (phaseTime < this.hotaru.visibleSec) {
              // 見えている時間帯
              if (phaseTime < fadeDur) {
                // フェードイン中
                val = phaseTime / fadeDur;
              } else if (phaseTime > this.hotaru.visibleSec - fadeDur) {
                // フェードアウト中
                val = (this.hotaru.visibleSec - phaseTime) / fadeDur;
              } else {
                // 完全表示
                val = 1.0;
              }
            } else {
              // 消えている時間帯は完全に0
              val = 0.0;
            }
            
            this.applyModelOpacity(val * this.baseOpacity);
            this.hotaruAnimId = requestAnimationFrame(loop);
          };
          this.hotaruAnimId = requestAnimationFrame(loop);
        }
      }

      stopHotaru() {
        if (this.hotaruAnimId) {
          cancelAnimationFrame(this.hotaruAnimId);
          this.hotaruAnimId = null;
        }
        this.applyModelOpacity(this.baseOpacity);
      }

      applyModelOpacity(value) {
        this.hotaru.currentOpacity = value;
        const opacity = Math.round(value * 255) / 255;
        if (opacity !== this.modelOpacity) {
          this.modelOpacity = opacity; this.tplCanvas.style.opacity = String(opacity);
        }
        const hidden = value < 0.05;
        if (hidden !== this.modelHidden) {
          this.modelHidden = hidden;
          this.journey?.setModelVisibility(!hidden);
        }
      }

      resize() {
        const w = this.stage.clientWidth || 460, h = this.stage.clientHeight || 460,dpr=window.devicePixelRatio||1;
        if(w===this.W&&h===this.H&&dpr===this.pixelRatio)return false;
        this.cancelDrawingFrame();
        const previousW=this.W,previousH=this.H;
        const normalized=previousW?MonjiCore.pack(this.userStrokes,previousW,previousH):null;
        this.isDown=false;this.pointerId=null;this.activePointerType=null;this.drawing=[];
        this.pixelRatio=dpr;
        [this.tplCanvas, this.inkCanvas, this.drwCanvas, this.anmCanvas].forEach(c => {
          c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
          c.getContext('2d').setTransform(dpr,0,0,dpr,0,0);
        });
        this.W = w; this.H = h;
        if (normalized) this.userStrokes = MonjiCore.unpack(normalized, w, h);
      }

      showOrientationPrompt(returnFocus){
        if(!this.orientationPopup){
          const popup=document.createElement('div');popup.id='orientationPopup';popup.className='modal-overlay orientation-popup';
          popup.setAttribute('role','alertdialog');popup.setAttribute('aria-modal','true');popup.setAttribute('aria-labelledby','orientationPopupTitle');popup.setAttribute('aria-describedby','orientationPopupMessage');
          const card=document.createElement('div');card.className='modal';
          const title=document.createElement('h2');title.id='orientationPopupTitle';title.textContent='がめんの むきを かえてね';
          const message=document.createElement('p');message.id='orientationPopupMessage';
          const okay=document.createElement('button');okay.className='btn btn-primary';okay.textContent='わかった';
          const close=()=>{popup.classList.remove('open');this.orientationReturnFocus?.focus?.();};
          okay.onclick=close;
          popup.addEventListener('keydown',event=>{if(event.key==='Tab'){event.preventDefault();okay.focus?.();}});
          document.addEventListener('keydown',event=>{if(event.key==='Escape'&&popup.classList.contains('open')){event.preventDefault();close();}});
          card.append(title,message,okay);popup.append(card);document.querySelector('body').append(popup);
          this.orientationPopup=popup;this.orientationPopupMessage=message;this.orientationPopupOkay=okay;
        }
        this.orientationReturnFocus=returnFocus||document.activeElement;
        this.orientationPopupMessage.textContent=this.display.direction==='vertical'
          ?'たてがきの おだいだよ。\nがめんを たてにしてね。\nそのあと「はじめる」を おしてね。'
          :'よこがきの おだいだよ。\nがめんを よこにしてね。\nそのあと「はじめる」を おしてね。';
        this.orientationPopup.classList.add('open');this.orientationPopupOkay.focus?.();
      }
      orientationReady(){return globalThis.MonjiOrientationMatches(this.display?.direction||'vertical',window.innerWidth,window.innerHeight);}
      updateOrientation(){
        const ready=this.orientationReady();this.journey?.setOrientationBlocked(!!this.word&&!ready,this.display?.direction||'vertical');
        const hint=document.getElementById('selectionOrientationHint');
        if(hint){hint.hidden=ready;hint.textContent=this.display?.direction==='vertical'?'がめんを たてにすると はじめられるよ。':'がめんを よこにすると はじめられるよ。';}
        this.lessonLibrary?.syncDraft();
        if(!this.word)return;
        if(!ready){this.cancelDrawingFrame();this.isDown=false;this.pointerId=null;this.drawing=[];this.renderDrawing();clearTimeout(this.autoAdvanceTimer);clearTimeout(this.stopRequestTimer);this.stopHotaru();sound.stopTrain?.();this.journey?.animation?.finish();}
        else if(this.awaitingArrival && !this.loading && !this.preparingWord)this.resumeArrival();
        else if(this.hotaru.enabled && this.inputEnabled())this.startHotaru();
        else if(!this.loading&&!this.preparingWord&&!this.transitioning&&this.strokes.length&&this.sIdx>=this.strokes.length)this.scheduleAdvance();
      }
      async resumeArrival(){
        if(!this.awaitingArrival || !this.orientationReady() || this.loading || this.transitioning || document.hidden || document.querySelector('.modal-overlay.open'))return false;
        this.awaitingArrival=false;
        if(this.journey?.canBookend())return this.runTrainScene('arrival');
        this.journey?.revealPrepared();
        if(this.hotaru.enabled && this.inputEnabled())this.startHotaru();
        return true;
      }
      startSequence(words){
        if(this.finishing||this.transitioning||this.isDown||!words.length||!this.orientationReady())return false;
        this.lessonSequence=[...words];this.lessonIndex=0;
        this.setWord(words[0],null,true);
        document.getElementById('modalSelect').classList.remove('open');return true;
      }
      showPracticeEnd(){
        this.departedPractice=this.practiceId;
        this.journey?.showFinale(this.sessions,{
          hasNext:!!this.lessonSequence?.[this.lessonIndex+1],
          again:()=>this.setWord(this.word,null,true),
          next:()=>{
            if(this.lessonSequence?.[this.lessonIndex+1]){this.lessonIndex++;this.setWord(this.lessonSequence[this.lessonIndex],null,true);}
            else document.getElementById('btnOpenSelect').click();
          }
        });
        this.hanamaru.classList.remove('show');this.saveDraft();
      }
      async finishPractice(){
        if(!this.orientationReady() || this.transitioning || this.departedPractice===this.practiceId)return;
        if(this.journey?.canBookend())await this.runTrainScene('departure');
        else this.showPracticeEnd();
      }
      async setWord(w, draft = null, keepSequence = false) {
        if (!w || !w.trim() || this.finishing || this.transitioning) return;
        clearTimeout(this.autoAdvanceTimer);clearTimeout(this.stopRequestTimer);
        this.preparingWord=true;this.awaitingArrival=!draft;this.stopHotaru();this.stopAnim();sound.stopTrain?.();
        this.journey?.beginReset();this.journey?.clearFinale();
        if(this.journey?.welcome)this.journey.welcome.hidden=true;
        document.querySelector('body')?.classList.remove('no-task');
        this.welcomeVoicePending=false;speech.cancel();speech.unlock();
        if(draft?.sequence?.length){this.lessonSequence=[...draft.sequence];this.lessonIndex=draft.sequenceIndex||0;}
        else if(!keepSequence){this.lessonSequence=[];this.lessonIndex=0;}
        this.word = w.trim().normalize('NFC');
        document.getElementById('btnTools').disabled=false;
        this.chars = Array.from(this.word);
        const matchingDraft = draft?.word === this.word;this.awaitingArrival=!matchingDraft;
        this.sessions = matchingDraft && Array.isArray(draft.items) ? draft.items : [];
        this.practiceId = matchingDraft && typeof draft.practiceId === 'string' ? draft.practiceId : null;
        this.practiceStartedAt = matchingDraft && draft.practiceStartedAt ? draft.practiceStartedAt : null;
        if (matchingDraft && !this.practiceStartedAt)
          this.practiceStartedAt = this.sessions.map(item => item?.date).filter(Boolean).sort()[0] || null;
        this.ensurePractice();
        this.practiceAssociation = matchingDraft && this.archive.associateDraft
          ? this.archive.associateDraft(this.word,this.sessions,this.practiceId,this.practiceStartedAt).catch(() => this.showToast('まえに かいた もじは、ひとつずつ みられるよ'))
          : Promise.resolve();
        this.cIdx = draft ? Math.max(0, Math.min(this.chars.length - 1, draft.index || 0)) : 0;
        this.loadedIndex = null;
        this.renderPills();
        const practice=this.practiceId;
        this.strokes=[];this.userStrokes=[];this.drawing=[];this.render();
        this.journey?.refresh(this.chars,this.cIdx,this.sessions,loader,samplePath);
        const known=new Set([...(this.knownChars||[]),...Object.keys(this.history||{}).filter(ch=>this.history[ch]?.count>0)]);
        try {for(const record of await (this.archive.list?.()||Promise.resolve([])))if(record.char)known.add(record.char);}catch{}
        if(practice!==this.practiceId)return;
        this.knownChars=known;
        this.trainTheme=matchingDraft&&draft.trainTheme?draft.trainTheme:globalThis.MonjiTrainColor(this.chars,known);
        this.journey?.setTheme(this.trainTheme);
        if(!matchingDraft)this.journey?.prepareArrival();
        try {
          await this.loadChar();
          if(matchingDraft && draft.finished)this.showPracticeEnd();
          else if(!matchingDraft && practice===this.practiceId && this.loadedIndex===0) await this.resumeArrival();
          else if(matchingDraft || this.loadedIndex===null){this.awaitingArrival=false;this.journey?.revealPrepared();}
        } finally {
          if(practice===this.practiceId){this.preparingWord=false;this.updateOrientation();}
        }

      }

      async runTrainScene(kind) {
        if(!this.orientationReady() || !this.journey?.canBookend() || this.transitioning || document.hidden || document.querySelector('.modal-overlay.open'))return false;
        if(kind==='departure' && this.cIdx!==this.chars.length-1) {
          await this.travelTo(this.chars.length-1);
          if(this.cIdx!==this.chars.length-1 || document.hidden || document.querySelector('.modal-overlay.open'))return false;
        }
        this.transitioning=true;this.stopHotaru();this.stopAnim();
        this.journey.viewport.classList.add('moving');
        const practice=this.practiceId;
        this.coachSay(kind==='arrival'?'ほたるこちゃんの でんしゃが くるよ！':'ぜんぶ かけました！ しゅっぱつ、しんこう〜',kind==='arrival'?'guide':'praise');
        try {
          const played=await this.journey.bookend(kind,duration=>sound.train(duration));
          if(!played && kind==='arrival')this.awaitingArrival=true;
          if(played && kind==='departure')this.showPracticeEnd();
          return played;
        }
        finally {
          this.transitioning=false;this.journey.viewport.classList.remove('moving');
          if(practice===this.practiceId && kind==='arrival' && !this.awaitingArrival) {
            this.coachSay('とまったよ。かたちを おもいうかべて、かいてみよう');
            if(this.inputEnabled() && this.hotaru.enabled)this.startHotaru();
          }
        }
      }

      renderPills() {
        const container = document.getElementById('wordPills');
        if(!this.chars.length){container.replaceChildren();document.getElementById('wordProgress').textContent='';return;}
        const key = this.practiceId + ':' + this.word;
        const reuse = container.dataset.practice === key && container.children.length === this.chars.length;
        if (!reuse) { container.replaceChildren(); container.dataset.practice = key; }
        container.style.setProperty('--word-count',String(this.chars.length));
        let completed = 0;
        this.chars.forEach((ch,index) => {
          let item = this.sessions?.[index];
          if (this.loadedIndex === index && !this.loading && this.strokes.length)
            item = { ...item, complete: this.sIdx >= this.strokes.length, strokes: MonjiCore.pack(this.userStrokes,this.W,this.H), skipped: this.skipped };
          const done = !!item?.complete; if (done) completed++;
          const button = reuse ? container.children[index] : document.createElement('button'); button.type='button';
          button.className = `word-pill word-slot ${index === this.cIdx ? 'active' : ''} ${done ? 'completed' : ''}`;
          button.setAttribute('aria-label',`${index+1}もじめ、${done?'かきおわり'+(item.skipped?.some(Boolean)?'、おてつだいあり':''):index===this.cIdx?'いま かく ます':'まだ かいていない ます'}`);
          button.setAttribute('aria-current',index === this.cIdx ? 'step' : 'false');
          const thumb = reuse ? button.querySelector('canvas') : document.createElement('canvas');
          if (!reuse) {
            thumb.width=thumb.height=96;thumb.className='word-thumb';thumb.setAttribute('aria-hidden','true');
            const number=document.createElement('span');number.className='slot-number';number.textContent=String(index+1);
            button.append(thumb,number);container.append(button);
          }
          const signature = done ? String(item.id || 'draft-'+(item.strokes||[]).length)+'|'+(item.skipped||[]).join(',') : 'empty';
          if (thumb.dataset.signature !== signature) {
            if (done) MonjiWords.paintRecord(thumb,{...item,strokes:(item.strokes||[]).map((line,i)=>item.skipped?.[i]?[]:line)});
            else if (reuse) MonjiWords.paintRecord(thumb,null);
            thumb.dataset.signature=signature;
          }
          button.onclick=()=>this.travelTo(index);
        });
        document.getElementById('wordProgress').textContent=`いま ${this.cIdx+1}/${this.chars.length}　かけた ${completed}/${this.chars.length}`;
      }

      async loadChar() {
        if(!this.chars.length)return;
        if (this.finishing || (this.transitioning && !this.travelLoading)) return;
        this.rememberCurrent();
        const generation = ++this.loadGeneration, index = this.cIdx, ch = this.chars[index];
        this.loading = true; this.isDown = false; this.pointerId = null;
        this.hanamaru.classList.remove('show');
        this.stopAnim(); this.stopHotaru(); this.strokes = []; this.drawing = []; this.userStrokes = [];
        this.setNotice('おてほんを じゅんびしているよ…'); this.renderPills(); this.render();
        try {
          const strokes = await loader.load(ch);
          if (generation !== this.loadGeneration) return;
          this.installChar(index, strokes);
        } catch (error) {
          if (generation !== this.loadGeneration) return;
          this.loading = false; this.loadedIndex = null;
          document.getElementById('curStroke').textContent = '—'; document.getElementById('totalStroke').textContent = '—';
          this.setNotice(`「${ch}」の おてほんを ひらけなかったよ。おとなのひとに おしえてね。`, true);
        }
      }

      coachSay(message, pose = 'guide') {
        const coach = document.getElementById('hotarukoCoach');
        if (coach) coach.dataset.pose = pose;
        document.getElementById('coachMessage').textContent = message;
      }

      installChar(index, strokes) {
        this.coachSay('かたちを おもいうかべて、かいてみよう');
        this.cIdx = index;
        this.hanamaru.classList.remove('show');
        this.renderPills();
          this.strokes = strokes; this.loading = false; this.loadedIndex = index;
          const previous = this.sessions[index] || {};
          this.sIdx = Math.min(strokes.length, previous.strokeIndex || 0);
          this.userStrokes = MonjiCore.unpack(previous.strokes || [], this.W, this.H);
          this.skipped = [...(previous.skipped || [])];
          this.attemptStart = performance.now();
          this.timeOffset = Math.max(0, ...this.userStrokes.flat().map(p => p.t || 0));
          document.getElementById('curStroke').textContent = Math.min(strokes.length, this.sIdx + 1);
          document.getElementById('totalStroke').textContent = strokes.length;
          this.setNotice(''); this.render(); this.saveDraft();
          this.journey?.refresh(this.chars, index, this.sessions, loader, samplePath);
          if (this.sIdx >= strokes.length) {
            this.hanamaru.classList.remove('show');
            if (!previous.archived) this.finishChar();
          } else if (this.hotaru.enabled && !document.querySelector('.modal-overlay.open')) this.startHotaru();
      }

      selectFixed(index, event) {
        if(this.isDown&&event?.pointerType==='pen'&&this.activePointerType==='touch')this.cancelStroke?.();
        if (this.display.mode !== 'fixed' || !Number.isInteger(index) || index < 0 || index >= this.chars.length ||
            this.loading || this.finishing || this.transitioning || this.isDown) return;
        if (event && ((event.pointerType === 'mouse' && event.button !== 0) || this.pointerId != null)) return;
        if (index !== this.cIdx) {
          const paths = this.journey.materials.get(this.chars[index]);
          if (!paths) { this.showToast('おてほんが でてから かいてみよう'); this.travelTo(index); return; }
          clearTimeout(this.autoAdvanceTimer);
          this.rememberCurrent(); this.stopHotaru(); this.stopAnim();
          this.journey.focus(index); this.resize(); this.installChar(index, paths);
        }
        if (event) this.beginPointer(event);
      }

      render() {
        // 描画エンジンを分離し、必要なレイヤーだけを更新できるように最適化
        this.renderTemplate();
        this.renderCompleted();
        this.renderDrawing();
      }

      renderTemplate() {
        this.applyModelOpacity(this.hotaru.currentOpacity);
        const ctx = this.tplCtx;
        ctx.clearRect(0, 0, this.W, this.H);
        if (!this.strokes || this.strokes.length === 0) return;

        ctx.save(); ctx.scale(this.W / 460, this.H / 460);
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        this.strokes.forEach((d, i) => {
          const pts = samplePath(d, 460, 460);
          if (pts.length === 0) return;

          if (i >= this.sIdx) {
            ctx.beginPath();
            ctx.moveTo(pts[0].x, pts[0].y);
            for (let j = 1; j < pts.length; j++) ctx.lineTo(pts[j].x, pts[j].y);

            if (i === this.sIdx) {
              // 完成後でない場合のみ半透明や点滅を適用
              if (this.sIdx < this.strokes.length) {
                ctx.globalAlpha = 1;
                ctx.strokeStyle = 'rgba(56, 189, 248, 0.65)'; ctx.lineWidth = 18; ctx.stroke();
                ctx.strokeStyle = '#0284c7'; ctx.lineWidth = 3; ctx.setLineDash([8, 6]); ctx.stroke(); ctx.setLineDash([]);
              
                // 空間認知・方向ガイド（始点バッジ ＋ 運筆方向の矢印表示）
                if (this.showGuide && pts.length > 0) {
                  const sp = pts[0];
                  ctx.beginPath(); ctx.arc(sp.x, sp.y, 14, 0, Math.PI*2); ctx.fillStyle = 'rgba(239,68,68,0.25)'; ctx.fill();
                  ctx.beginPath(); ctx.arc(sp.x, sp.y, 8, 0, Math.PI*2); ctx.fillStyle = '#dc2626'; ctx.fill();
                  ctx.beginPath(); ctx.arc(sp.x - 18, sp.y - 18, 12, 0, Math.PI*2); ctx.fillStyle = '#2563eb'; ctx.fill();
                  ctx.fillStyle = '#ffffff'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                  ctx.fillText(i + 1, sp.x - 18, sp.y - 18);
                  
                  // 運筆方向の矢印を2箇所程度に描画
                  this.drawDirectionArrows(ctx, pts);
                }
              }
            } else {
              ctx.globalAlpha = 1;
              ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)'; ctx.lineWidth = 14; ctx.stroke();
            }
            ctx.globalAlpha = 1.0;
          }
        });
        ctx.restore();
      }

      renderCompleted() {
        const ctx = this.inkCtx;
        ctx.clearRect(0,0,this.W,this.H);
        ctx.lineCap = ctx.lineJoin = 'round'; ctx.lineWidth = 14 * this.W / 460;
        this.userStrokes.forEach((points,i) => {
          if (i >= this.sIdx || !points.length) return;
          ctx.strokeStyle = this.skipped?.[i] ? '#94a3b8' : '#1e293b';
          ctx.beginPath(); ctx.moveTo(points[0].x,points[0].y);
          for (let j=1;j<points.length;j++) ctx.lineTo(points[j].x,points[j].y);
          ctx.stroke();
        });
      }

      cancelDrawingFrame() {
        if (this.drawingFrame != null) cancelAnimationFrame(this.drawingFrame);
        this.drawingFrame = null;
      }

      renderDrawing() {
        this.cancelDrawingFrame();
        this.drwCtx.clearRect(0,0,this.W,this.H);
        this.paintedPoints = 0; this.paintDrawingIncrement();
      }

      queueDrawing() {
        if (this.drawingFrame != null) return;
        this.drawingFrame = requestAnimationFrame(() => {
          this.drawingFrame = null;
          if (this.isDown) this.paintDrawingIncrement();
        });
      }

      paintDrawingIncrement() {
        const points = this.drawing, count = points.length;
        const painted = this.paintedPoints || 0;
        if (count <= painted) return;
        const ctx = this.drwCtx, width = 14 * this.W / 460;
        ctx.lineCap = ctx.lineJoin = 'round'; ctx.lineWidth = width; ctx.strokeStyle = '#1e293b';
        if (count === 1) {
          ctx.beginPath(); ctx.arc(points[0].x,points[0].y,width/2,0,Math.PI*2);
          ctx.fillStyle = '#1e293b'; ctx.fill();
        } else {
          const start = Math.max(0,painted-1);
          ctx.beginPath(); ctx.moveTo(points[start].x,points[start].y);
          for(let i=start+1;i<count;i++)ctx.lineTo(points[i].x,points[i].y);
          ctx.stroke();
        }
        this.paintedPoints = count;
      }

      // 運筆方向の矢印を描画するヘルパー
      drawDirectionArrows(ctx, pts) {
        if (!pts || pts.length < 5) return;
        const arrowIndices = [Math.floor(pts.length * 0.35), Math.floor(pts.length * 0.7)];
        arrowIndices.forEach(idx => {
          if (idx > 0 && idx < pts.length) {
            const p1 = pts[idx - 1];
            const p2 = pts[idx];
            const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
            const size = 9;

            ctx.save();
            ctx.translate(p2.x, p2.y);
            ctx.rotate(angle);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(-size, -size * 0.6);
            ctx.lineTo(-size * 0.5, 0);
            ctx.lineTo(-size, size * 0.6);
            ctx.closePath();
            ctx.fillStyle = '#0284c7';
            ctx.fill();
            ctx.restore();
          }
        });
      }

      getPos(e, bounds) {
        const r = bounds || this.drwCanvas.getBoundingClientRect();
        return { x: (e.clientX - r.left) * this.W / r.width, y: (e.clientY - r.top) * this.H / r.height };
      }

      bindEvents() {
        const c = this.drwCanvas;
        const addPoint = (event,bounds) => {
          if(!Number.isFinite(event.clientX)||!Number.isFinite(event.clientY))return;
          const stamp=Number.isFinite(event.timeStamp)?event.timeStamp:null;
          if(stamp!==null&&this.lastSampleTime!==null&&stamp<this.lastSampleTime)return;
          if(stamp!==null)this.lastSampleTime=stamp;
          const point=this.getPos(event,bounds);point.t=this.timeOffset+performance.now()-this.attemptStart;
          const previous=this.drawing.at(-1);if(!previous||MonjiCore.distance(previous,point)>.2)this.drawing.push(point);
        };
        const cancelStroke=()=>{
          const id=this.pointerId;
          clearTimeout(this.stopRequestTimer);this.cancelDrawingFrame();this.isDown=false;this.pointerId=null;this.activePointerType=null;this.drawing=[];this.renderDrawing();
          try{if(id!=null)c.releasePointerCapture(id);}catch{}
        };
        this.cancelStroke=cancelStroke;
        const finishPointer=(event,includeEnd=true)=>{
          if(!this.isDown||event.pointerId!==this.pointerId)return;
          event.preventDefault?.();if(includeEnd)addPoint(event);
          this.cancelDrawingFrame();this.paintDrawingIncrement();
          const id=this.pointerId;if(this.activePointerType==='pen')this.lastPenAt=performance.now();
          this.isDown=false;this.pointerId=null;this.activePointerType=null;clearTimeout(this.stopRequestTimer);
          try{c.releasePointerCapture(id);}catch{}
          this.checkStroke();
        };
        this.beginPointer=event=>{
          if(!this.inputEnabled()||(event.pointerType==='mouse'&&event.button!==0))return;
          // A resting finger must not own the stroke once the Pencil touches down.
          if(this.pointerId!=null){if(event.pointerType==='pen'&&this.activePointerType==='touch')cancelStroke();else return;}
          if(event.pointerType==='touch'&&performance.now()-(this.lastPenAt??-Infinity)<350)return;
          event.preventDefault();sound.init();this.pointerId=event.pointerId;this.activePointerType=event.pointerType||'touch';this.isDown=true;this.drawing=[];
          this.lastSampleTime=null;this.penHadContact=event.pointerType==='pen'&&(event.buttons===1||event.pressure>0);
          this.speedPoints=[];this.armStopRequest();try{c.setPointerCapture(event.pointerId);}catch{}
          addPoint(event);this.renderDrawing();
        };
        c.addEventListener('pointerdown',this.beginPointer);
        document.addEventListener('pointermove',event=>{
          if(!this.isDown||event.pointerId!==this.pointerId)return;
          event.preventDefault();
          let samples=[];try{samples=Array.from(event.getCoalescedEvents?.()||[]);}catch{}
          samples=samples.filter(sample=>!Number.isFinite(event.timeStamp)||!Number.isFinite(sample.timeStamp)||sample.timeStamp<=event.timeStamp).sort((a,b)=>(a.timeStamp||0)-(b.timeStamp||0));
          const hover=this.activePointerType==='pen'&&event.buttons===0&&event.pressure===0;
          const batchContact=samples.some(sample=>sample.buttons===1||sample.pressure>0);
          if(hover&&!batchContact&&this.penHadContact){finishPointer(event,false);return;}
          if(this.activePointerType==='pen'&&(event.buttons===1||event.pressure>0||batchContact))this.penHadContact=true;
          const bounds=c.getBoundingClientRect();for(const sample of samples)addPoint(sample,bounds);
          // Some engines return only earlier samples: always retain the dispatched endpoint.
          if(!hover)addPoint(event,bounds);this.observeMovement(this.drawing.at(-1));this.queueDrawing();
        },{capture:true,passive:false});
        document.addEventListener('pointerup',event=>finishPointer(event),{capture:true,passive:false});
        document.addEventListener('pointercancel',event=>{if(event.pointerId===this.pointerId)cancelStroke();},true);
        // Capture loss alone is not a cancelled stroke. Document listeners still own its pen-up.
        c.addEventListener('lostpointercapture',()=>{});

        const onClk = (id, fn) => {
          const el = document.getElementById(id);
          if (el) el.onclick = fn;
        };

        onClk('btnDemo', () => this.playDemo());
        onClk('btnGrid', (e) => {
          this.showGrid = !this.showGrid;
          const gl = document.getElementById('gridLayer');
          if (gl) gl.style.display = this.showGrid ? 'block' : 'none';
          e.currentTarget.classList.toggle('active', this.showGrid);
        });
        onClk('btnGuide', (e) => {
          this.showGuide = !this.showGuide;
          if(!this.showGuide&&document.getElementById('coachMessage')?.textContent==='はじめの しるしから かいてみよう'){this.coachSay('かたちを おもいうかべて、かいてみよう','guide');this.toast?.classList.remove('show');}
          e.currentTarget.classList.toggle('active', this.showGuide);
          this.render();
        });
        onClk('badgeStrict', () => {
          const lvls = ['relaxed', 'easy', 'normal', 'strict'];
          this.setStrict(lvls[(lvls.indexOf(this.level) + 1) % lvls.length]);
        });

        const mSel = document.getElementById('modalSelect');
        const mSet = document.getElementById('modalSettings');
        const mRec = document.getElementById('modalRecord');

        // 学習記録モーダル
        onClk('btnOpenRecord', () => {
          this.renderRecordModal(this.currentRecordTab || 'hiragana');
          if (mRec) mRec.classList.add('open');
        });
        onClk('btnCloseRecord', () => { if (mRec) mRec.classList.remove('open'); });

        // お題選択モーダル
        onClk('btnOpenSelect', () => {
          this.selectCategoryTab(this.currentCategoryTab || 'hiragana');
          if (mSel) mSel.classList.add('open');
          const body=mSel?.querySelector('.modal-body');if(body)body.scrollTop=0;
        });
        onClk('btnWelcomeSelect',()=>document.getElementById('btnOpenSelect').click());
        onClk('btnCloseSelect', () => { if (mSel) mSel.classList.remove('open'); });
        onClk('btnSettings', () => { if (mSet) mSet.classList.add('open'); });
        onClk('btnCloseSettings', () => { if (mSet) mSet.classList.remove('open'); });

        document.querySelectorAll('#tabBar .tab-btn').forEach(btn => {
          btn.onclick = () => {
            this.selectCategoryTab(btn.dataset.tab);
          };
        });

        document.querySelectorAll('.set-strict').forEach(btn => {
          btn.onclick = () => this.setStrict(btn.dataset.level);
        });

        const sldTol = document.getElementById('sldTol');
        if (sldTol) {
          sldTol.oninput = (e) => {
            const v = parseInt(e.target.value, 10);
            this.params[this.level].dev = v;
            const lbl = document.getElementById('lblTol');
            if (lbl) lbl.textContent = `${v}px`;
          };
        }

        const sldFill = document.getElementById('sldFill');
        if (sldFill) {
          sldFill.oninput = (e) => {
            const v = parseFloat(e.target.value) / 10;
            this.params[this.level].maxRatio = v;
            const lbl = document.getElementById('lblFill');
            if (lbl) lbl.textContent = `${v}倍まで`;
          };
        }

        const sldOpac = document.getElementById('sldOpac');
        if (sldOpac) {
          sldOpac.oninput = (e) => {
            const v = parseInt(e.target.value, 10);
            this.baseOpacity = v / 100;
            const lbl = document.getElementById('lblOpac');
            if (lbl) lbl.textContent = `${v}%`;
            if (!this.hotaru.enabled) {
              this.hotaru.currentOpacity = this.baseOpacity;
              this.render();
            }
          };
        }

        const chkHotaru = document.getElementById('chkHotaru');
        if (chkHotaru) {
          chkHotaru.onchange = (e) => {
            this.hotaru.enabled = e.target.checked;
            if (this.hotaru.enabled) {
              this.startHotaru();
            } else {
              this.stopHotaru();
            }
          };
        }

        const sldHotaruVis = document.getElementById('sldHotaruVis');
        if (sldHotaruVis) {
          sldHotaruVis.oninput = (e) => {
            const v = parseFloat(e.target.value) / 10;
            this.hotaru.visibleSec = v;
            const lbl = document.getElementById('lblHotaruVis');
            if (lbl) lbl.textContent = `${v.toFixed(1)}秒`;
          };
        }

        const sldHotaruHid = document.getElementById('sldHotaruHid');
        if (sldHotaruHid) {
          sldHotaruHid.oninput = (e) => {
            const v = parseFloat(e.target.value) / 10;
            this.hotaru.hiddenSec = v;
            const lbl = document.getElementById('lblHotaruHid');
            if (lbl) lbl.textContent = `${v.toFixed(1)}秒`;
          };
        }
      }



      restoreSettings(saved) {
        this.archive = window.monjiArchive;
        this.display = { mode: saved.display?.mode === 'fixed' ? 'fixed' : 'flow', direction: saved.display?.direction === 'vertical' ? 'vertical' : 'horizontal',
          train: saved.display?.train !== false, reduced: saved.display?.reduced === true,
          auto: saved.display?.auto !== false };
        document.getElementById('journey-direction').value = this.display.direction;
        document.getElementById('journey-mode').value = this.display.mode;
        for (const key of ['train','reduced','auto']) document.getElementById('journey-' + key).checked = this.display[key];
        this.sessions = [];
        this.unsavedRecords = {};
        this.requests = { speed: saved.requests?.speed !== false, pause: saved.requests?.pause !== false,
          voice: saved.requests?.voice !== false, speedLimit: Math.max(0.5, Math.min(4, saved.requests?.speedLimit || 1.8)),
          pauseMs: Math.max(1500, Math.min(10000, saved.requests?.pauseMs || 2500)) };
        this.loading = true;
        this.loadGeneration = 0;
        this.loadedIndex = null;
        this.baseOpacity = Math.max(0.1, Math.min(1, saved.baseOpacity || 1));
        this.hotaru.enabled = saved.hotaru?.enabled !== false;
        this.hotaru.visibleSec = Math.max(0.5, Math.min(10, saved.hotaru?.visibleSec ?? 1.5));
        this.hotaru.hiddenSec = Math.max(0.5, Math.min(10, saved.hotaru?.hiddenSec ?? 3));
        this.hotaru.once = saved.hotaru?.once === true;
        this.hotaru.currentOpacity = this.baseOpacity;
        this.showGuide = saved.showGuide !== false;
        this.showGrid = saved.showGrid !== false;
        sound.on = true; speech.enabled = true;
        if (['relaxed','easy','normal','strict'].includes(saved.level)) this.level = saved.level;
        if (saved.params) for (const level of ['easy','normal','strict']) {
          const p = saved.params[level];
          if (p && Number.isFinite(p.dev) && Number.isFinite(p.maxRatio)) {
            this.params[level].dev = Math.max(14, Math.min(46, p.dev));
            this.params[level].maxRatio = Math.max(1.2, Math.min(2.5, p.maxRatio));
          }
        }
        document.getElementById('chkHotaru').checked = this.hotaru.enabled;
        document.getElementById('chkOnce').checked = this.hotaru.once;
        document.getElementById('sldHotaruVis').value = this.hotaru.visibleSec * 10;
        document.getElementById('sldHotaruHid').value = this.hotaru.hiddenSec * 10;
        document.getElementById('lblHotaruVis').textContent = this.hotaru.visibleSec.toFixed(1) + '秒';
        document.getElementById('lblHotaruHid').textContent = this.hotaru.hiddenSec.toFixed(1) + '秒';
        document.getElementById('sldOpac').value = this.baseOpacity * 100;
        document.getElementById('lblOpac').textContent = Math.round(this.baseOpacity * 100) + '%';
        document.getElementById('gridLayer').style.display = this.showGrid ? 'block' : 'none';
        document.getElementById('btnGrid').classList.toggle('active', this.showGrid);
        document.getElementById('btnGuide').classList.toggle('active', this.showGuide);
        for (const key of ['speed','pause','voice']) document.getElementById('request-' + key).checked = this.requests[key];
        document.getElementById('request-wait').value = this.requests.pauseMs / 1000;
        document.getElementById('request-speed-limit').value = this.requests.speedLimit;
        this.setStrict(this.level);
      }

      saveSettings() {
        const settings = { baseOpacity: this.baseOpacity, level: this.level, params: this.params,
          hotaru: { enabled: this.hotaru.enabled, once: !!this.hotaru.once, visibleSec: this.hotaru.visibleSec, hiddenSec: this.hotaru.hiddenSec },
          showGuide: this.showGuide, showGrid: this.showGrid, sound: sound.on, requests: this.requests, display: this.display };
        this.archive.saveState('settings', settings).catch(() => this.storageStatus(false));
      }

      storageStatus(ok) {
        ok = ok && !Object.keys(this.unsavedRecords || {}).length;
        const el = document.getElementById('storageStatus');
        el.textContent = ok ? 'かいた もじを のこしたよ' : 'もじを のこせなかったよ。とじずに おとなのひとを よんでね。';
        const details=document.getElementById('storageDetails');
        if(details)details.textContent=ok?'記録はこのブラウザー内に保存しています。環境を変える前に書き出してください。':'未保存の記録があります。画面を閉じる前に、下のボタンで練習中の筆跡を書き出してください。';
        el.classList.toggle('unsaved', !ok);
      }

      ensurePractice() {
        if (!this.practiceId) this.practiceId = globalThis.crypto?.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random();
        if (!this.practiceStartedAt) this.practiceStartedAt = new Date().toISOString();
      }

      rememberCurrent() {
        if (this.loadedIndex === null || this.loading || !this.strokes.length) return;
        const old = this.sessions[this.loadedIndex] || {};
        this.sessions[this.loadedIndex] = { ...old, strokeIndex: this.sIdx,
          strokes: MonjiCore.pack(this.userStrokes, this.W, this.H),
          skipped: [...(this.skipped || [])], complete: this.sIdx >= this.strokes.length };
        if (this.journey?.chars === this.chars) this.journey.updateSnapshot(this.loadedIndex, this.sessions[this.loadedIndex]);
      }

      saveDraft() {
        if(!this.word)return;
        this.rememberCurrent();
        const draft = { word: this.word, index: this.cIdx, items: this.sessions, practiceId: this.practiceId, practiceStartedAt: this.practiceStartedAt, sequence:this.lessonSequence||[],sequenceIndex:this.lessonIndex||0,trainTheme:this.trainTheme,finished:this.departedPractice===this.practiceId };
        const copy = typeof structuredClone === 'function' ? structuredClone(draft) : JSON.parse(JSON.stringify(draft));
        this.archive.saveState('draft', copy).catch(() => this.storageStatus(false));
      }

      inputEnabled() {
        return this.orientationReady() && !this.preparingWord && !this.awaitingArrival && !this.transitioning && !this.loading && !this.finishing && this.strokes.length > 0 && this.sIdx < this.strokes.length &&
          !document.hidden && !document.querySelector('.modal-overlay.open');
      }

      askGently(kind) {
        if (!this.inputEnabled() || !this.isDown || performance.now() - (this.lastRequest || -20000) < 15000) return;
        this.lastRequest = performance.now();
        const message = kind === 'speed' ? 'もうすこし、ゆっくり かいてみよう' :
          'かたちを おもいうかべて、つづきを かいてみよう';
        this.coachSay(message, 'request');
        if (this.requests.voice) speech.play(kind);
      }

      armStopRequest() {
        clearTimeout(this.stopRequestTimer);
        if (!this.requests.pause) return;
        this.stopRequestTimer = setTimeout(() => this.askGently('pause'), this.requests.pauseMs);
      }

      observeMovement(point) {
        const previous = this.speedPoints?.at(-1);
        if (!previous || MonjiCore.distance(previous, point) / this.W > 0.006) this.armStopRequest();
        const now = performance.now();
        this.speedPoints = [...(this.speedPoints || []), { ...point, time: now }].filter(p => now - p.time <= 180);
        if (!this.requests.speed || this.speedPoints.length < 4) return;
        const first = this.speedPoints[0], elapsed = (now - first.time) / 1000;
        if (elapsed >= 0.12 && MonjiCore.distance(first, point) / this.W / elapsed > this.requests.speedLimit) this.askGently('speed');
      }

      setNotice(text, retry = false) {
        const box = document.getElementById('loadMessage');
        box.hidden = !text;
        document.getElementById('loadText').textContent = text;
        document.getElementById('btnRetry').hidden = !retry;
      }

      resetAttempt() {
        if (this.loading || this.finishing || this.transitioning) return;
        if(this.departedPractice===this.practiceId)return this.setWord(this.word,null,true);
        clearTimeout(this.autoAdvanceTimer);
        this.isDown = false; this.pointerId = null; this.drawing = [];
        this.sIdx = 0; this.userStrokes = []; this.skipped = [];
        this.sessions[this.cIdx] = {};
        this.hanamaru.classList.remove('show');
        document.getElementById('curStroke').textContent = 1;
        this.renderPills(); this.render(); this.saveDraft();
        if (this.hotaru.enabled) this.startHotaru();
      }

      bindFoundationEvents() {
        document.getElementById('btnRetry').onclick = () => this.loadChar();
        document.getElementById('btnCloseRecord').addEventListener('click', () => { this.replayGeneration++; this.wordAlbum?.cancelReplay(); });
        document.getElementById('btnUndo').onclick = () => {
          if (this.loading || this.finishing || this.transitioning || !this.sIdx) return;
          clearTimeout(this.autoAdvanceTimer);
          this.sIdx--; this.userStrokes.pop(); this.skipped.pop(); this.drawing = [];
          this.sessions[this.cIdx] = { ...(this.sessions[this.cIdx] || {}), archived: false, id: null, date: null };
          this.hanamaru.classList.remove('show');
          document.getElementById('curStroke').textContent = this.sIdx + 1;
          if (this.hotaru.enabled && !this.hotaruAnimId) this.startHotaru();
          this.renderPills(); this.render(); this.saveDraft();
        };
        document.getElementById('btnReset').onclick = () => this.resetAttempt();
        document.getElementById('btnSkip').onclick = () => {
          if (!this.inputEnabled() || this.isDown) return;
          this.userStrokes[this.sIdx] = samplePath(this.strokes[this.sIdx], this.W, this.H);
          this.skipped[this.sIdx] = true;
          this.sIdx++; this.saveDraft();
          if (this.sIdx >= this.strokes.length) this.finishChar();
          else { document.getElementById('curStroke').textContent = this.sIdx + 1; this.render(); }
        };
        document.getElementById('btnPrev').onclick = () => {
          this.travelTo(this.cIdx - 1);
        };
        document.getElementById('btnNext').onclick = () => {
          this.travelTo(this.cIdx + 1);
        };
        document.getElementById('chkOnce').onchange = e => {
          this.hotaru.once = e.target.checked;
          if (this.hotaru.enabled) this.startHotaru();
          this.saveSettings();
        };
        for (const key of ['speed','pause','voice']) document.getElementById('request-' + key).onchange = e => { this.requests[key] = e.target.checked; this.saveSettings(); };
        document.getElementById('request-wait').onchange = e => { this.requests.pauseMs = Number(e.target.value) * 1000; this.saveSettings(); };
        document.getElementById('request-speed-limit').onchange = e => { this.requests.speedLimit = Number(e.target.value); this.saveSettings(); };
        const settings = document.getElementById('modalSettings');
        settings.addEventListener('input', () => this.saveSettings());
        settings.addEventListener('change', () => this.saveSettings());
        for (const id of ['btnGuide','btnGrid','badgeStrict'])
          document.getElementById(id).addEventListener('click', () => this.saveSettings());
        for (const button of settings.querySelectorAll('.set-strict')) button.addEventListener('click', () => this.saveSettings());
        const suspend = event => {
          clearTimeout(this.autoAdvanceTimer);
          this.travelGeneration = (this.travelGeneration || 0) + 1;
          if (this.journey?.animation) this.journey.animation.finish();
          sound.stopTrain?.();
          clearTimeout(this.stopRequestTimer);
          this.isDown = false; this.pointerId = null; this.drawing = []; this.renderDrawing();
          this.stopAnim(); this.stopHotaru(); this.saveDraft();
          if(event?.currentTarget?.id!=='btnOpenSelect'||speech.kind!=='welcome')speech.cancel();
        };
        for (const id of ['btnOpenSelect','btnOpenRecord','btnSettings']) document.getElementById(id).addEventListener('click', suspend);
        for (const id of ['btnCloseSelect','btnCloseRecord','btnCloseSettings']) document.getElementById(id).addEventListener('click', () => {
          this.updateOrientation();
        });
        document.addEventListener('visibilitychange', () => {
          if (document.hidden) suspend();
          else if (this.inputEnabled() && this.hotaru.enabled) this.startHotaru();
        });
        window.addEventListener('pagehide', () => this.saveDraft());
        document.getElementById('btnExportPending').onclick = () => {
          this.rememberCurrent();
          this.downloadJSON({ format: 'monjibotaru4-recovery', version: 1, date: new Date().toISOString(), word: this.word, items: this.sessions, practiceId: this.practiceId, practiceStartedAt: this.practiceStartedAt, unsavedRecords: Object.values(this.unsavedRecords) }, 'monjibotaru4-recovery.json');
        };
      }


      bindPracticeTools(){
        const button=document.getElementById('btnTools'),modal=document.getElementById('modalTools'),closeButton=document.getElementById('btnCloseTools');
        const close=(resume=true)=>{modal.classList.remove('open');button.setAttribute('aria-expanded','false');button.focus?.();if(resume)this.updateOrientation();};
        button.onclick=()=>{
          if(!this.word||this.isDown||this.transitioning)return;
          clearTimeout(this.autoAdvanceTimer);clearTimeout(this.stopRequestTimer);this.stopHotaru();this.stopAnim();this.saveDraft();
          modal.classList.add('open');button.setAttribute('aria-expanded','true');closeButton.focus?.();
        };
        closeButton.onclick=()=>close();
        modal.onclick=event=>{if(event.target===modal)close();};
        for(const id of ['btnDemo','btnUndo','btnReset','btnGrid','btnGuide','btnPrev','btnNext','btnSkip']){
          const tool=document.getElementById(id),action=tool.onclick;
          tool.onclick=event=>{close(false);action?.call(tool,event);this.updateOrientation();};
        }
        document.addEventListener('keydown',event=>{if(event.key==='Escape'&&modal.classList.contains('open')){event.preventDefault();close();}});
        modal.addEventListener('keydown',event=>{
          if(event.key!=='Tab')return;
          const buttons=Array.from(modal.querySelectorAll('button')).filter(item=>!item.disabled),first=buttons[0],last=buttons.at(-1);
          if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus?.();}
          else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus?.();}
        });
      }
      bindJourneyEvents() {
        const change = () => {
          if (this.transitioning) return;
          clearTimeout(this.autoAdvanceTimer);
          this.display.direction = document.getElementById('journey-direction').value;
          this.display.mode = document.getElementById('journey-mode').value;
          for (const key of ['train','reduced','auto']) this.display[key] = document.getElementById('journey-' + key).checked;
          this.rememberCurrent();this.journey.beginReset(); this.journey.apply(this.display); this.resize(); this.render(); this.saveSettings();
          this.journey.refresh(this.chars, this.cIdx, this.sessions, loader, samplePath).then(()=>{
            if(this.departedPractice===this.practiceId)this.showPracticeEnd();
            else if(!this.awaitingArrival)this.journey.revealPrepared();
            this.updateOrientation();
          });
          this.updateOrientation();
        };
        for (const id of ['journey-mode','journey-direction','journey-train','journey-reduced','journey-auto']) document.getElementById(id).addEventListener('change',change);
      }

      scheduleAdvance() {
        clearTimeout(this.autoAdvanceTimer);
        if(!this.chars.length)return;
        const allDone=this.chars.every((_,i)=>this.sessions[i]?.complete);
        if(allDone && this.departedPractice!==this.practiceId) {
          const practice=this.practiceId;
          this.autoAdvanceTimer=setTimeout(()=>{
            if(practice===this.practiceId && !document.hidden && !document.querySelector('.modal-overlay.open')) this.finishPractice();
          },1200);
          return;
        }
        if (!this.display?.auto || this.cIdx >= this.chars.length - 1) return;
        const index = this.cIdx;
        this.autoAdvanceTimer = setTimeout(() => {
          if (this.cIdx === index && !document.hidden && !document.querySelector('.modal-overlay.open')) this.travelTo(index + 1);
        }, 1200);
      }

      async travelTo(index) {
        if (!this.orientationReady() || !Number.isInteger(index) || index < 0 || index >= this.chars.length || index === this.cIdx ||
          this.loading || this.finishing || this.isDown || this.transitioning) return;
        clearTimeout(this.autoAdvanceTimer); clearTimeout(this.stopRequestTimer);
        this.transitioning = true; this.stopHotaru(); this.stopAnim(); this.rememberCurrent();
        const previous = this.cIdx;
        const token = this.travelGeneration = (this.travelGeneration || 0) + 1;
        this.journey?.viewport.classList.add('moving');
        try {
          // Validate the destination before moving the child's work out of view.
          await loader.load(this.chars[index]);
          if (token !== this.travelGeneration || document.hidden || document.querySelector('.modal-overlay.open')) return;
          if (this.journey) await this.journey.move(index - previous,duration=>sound.train(duration));
          if (token !== this.travelGeneration || document.hidden || document.querySelector('.modal-overlay.open')) {
            this.journey?.refresh(this.chars, previous, this.sessions, loader, samplePath);
            return;
          }
          this.cIdx = index; this.travelLoading = true;
          await this.loadChar();
        } catch {
          this.showToast('つぎの もじを ひらけなかったよ。おとなのひとに おしえてね。');
          this.journey?.refresh(this.chars, previous, this.sessions, loader, samplePath);
        } finally {
          this.travelLoading = false; this.transitioning = false;
          this.journey?.viewport.classList.remove('moving');
          if (this.hotaru.enabled && this.inputEnabled()) this.startHotaru();
        }
      }

      downloadJSON(data, name) {
        const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
        const a = document.createElement('a'); a.href = url; a.download = name; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }

      async renderRecordModal() {
        this.wordAlbum?.cancelReplay();
        const generation = this.replayGeneration = (this.replayGeneration || 0) + 1;
        const body = document.querySelector('#modalRecord .modal-body');body.replaceChildren();
        const note = document.createElement('p');note.className='album-loading';note.textContent='さくひんを ひらいているよ…';body.append(note);
        let records;
        try { await this.practiceAssociation; records = await this.archive.list(); }
        catch { note.textContent='さくひんを ひらけなかったよ。おとなのひとと、もういちど ためしてね。'; return; }
        if(generation !== this.replayGeneration)return;
        note.hidden=true;
        const backup=document.createElement('button');backup.className='btn';backup.textContent='ほぞんようの ファイルを つくる';
        backup.onclick=()=>this.downloadJSON({format:'monjibotaru4-archive',version:1,records},'monjibotaru4-handwriting.json');
        const tabs=document.createElement('div');tabs.className='archive-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','さくひんちょうの みかた');
        const words=document.createElement('button'),characters=document.createElement('button');
        words.className=characters.className='btn';words.textContent='ことば・ぶん';characters.textContent='１もじずつ';
        words.id='archiveWordTab';characters.id='archiveCharTab';
        const wordPage=document.createElement('div'),charPage=document.createElement('div');
        wordPage.id='archiveWordPage';charPage.id='archiveCharPage';
        for(const [button,page]of [[words,wordPage],[characters,charPage]]){
          button.setAttribute('role','tab');button.setAttribute('aria-controls',page.id);
          page.setAttribute('role','tabpanel');page.setAttribute('aria-labelledby',button.id);
        }
        tabs.append(words,characters);body.append(tabs,wordPage,charPage);
        const grownup=document.createElement('details');grownup.className='album-grownup';
        const summary=document.createElement('summary');summary.textContent='おとなのかたへ';
        const help=document.createElement('p');help.textContent='かいたもじを ファイルに ほぞんできます。まえの さくひんは、ひとつの ことばに まとめられない ことがあります。もとの もじは のこっています。';
        grownup.append(summary,help,backup);body.append(grownup);
        const select=(wordMode,record)=>{
          this.replayGeneration++;this.wordAlbum?.cancelReplay();
          wordPage.hidden=!wordMode;charPage.hidden=wordMode;
          words.setAttribute('aria-selected',String(wordMode));characters.setAttribute('aria-selected',String(!wordMode));
          if(!wordMode)this.renderCharacterArchive(records,charPage,record?.id);
        };
        this.wordAlbum=new MonjiWords.WordAlbum(wordPage,records,record=>select(false,record));
        words.onclick=()=>select(true);characters.onclick=()=>select(false);select(true);
      }

      renderCharacterArchive(records, container, selectedId) {
        const excludedSelection=records.some(record=>record.id===selectedId&&MonjiWords.isFullyAssisted(record));
        records=records.filter(record=>!MonjiWords.isFullyAssisted(record));
        container.replaceChildren();
        if(!records.length){const p=document.createElement('p');p.className='album-empty';p.textContent='もじを かいたら、ここに あつまるよ。';container.append(p);return;}
        const list = document.createElement('div'); list.className = 'archive-list';
        const detail = document.createElement('div'); detail.className = 'archive-detail';
        container.append(list, detail);
        const show = record => {
          this.replayGeneration++;
          detail.replaceChildren();
          for(const button of list.querySelectorAll('.archive-letter-card'))button.setAttribute('aria-pressed',String(button.dataset.recordId===record.id));
          const title = document.createElement('div');title.className='album-piece-title';
          const letter=document.createElement('h3');letter.textContent=record.char;
          const date=document.createElement('span');date.textContent=MonjiWords.childDate(record.date,true);
          const badge=document.createElement('span');badge.className='album-piece-badge';badge.textContent=record.assisted?'おてつだいと いっしょ':'じぶんで かけたよ';
          title.append(letter,date,badge);
          const context=document.createElement('p');context.className='album-piece-context';
          context.textContent=`おだい「${record.word}」の ${record.index+1}もじめ ／ ${record.settings?.hotaru?'ほたるで れんしゅう':'おてほんと れんしゅう'}`;
          const canvas = document.createElement('canvas'); canvas.className = 'archive-canvas'; canvas.width = canvas.height = 460;
          const ctx = canvas.getContext('2d');
          const draw = (elapsed = Infinity) => {
            ctx.clearRect(0,0,460,460); ctx.lineCap = ctx.lineJoin = 'round'; ctx.lineWidth = 10;
            record.strokes.forEach((stroke, index) => {
              ctx.strokeStyle = record.skipped?.[index] ? '#94a3b8' : '#30483d';
              const points = stroke.filter(p => p.t <= elapsed);
              if (!points.length) return;
              ctx.beginPath(); ctx.moveTo(points[0].x * 460, points[0].y * 460);
              for (const p of points.slice(1)) ctx.lineTo(p.x * 460, p.y * 460);
              ctx.stroke();
            });
          };
          const replay = document.createElement('button'); replay.className = 'btn btn-primary'; replay.textContent = '▶ かいたところを みる';
          const stop = document.createElement('button'); stop.className = 'btn'; stop.textContent = '■ ぜんぶ みる';
          stop.onclick = () => { this.replayGeneration++; draw(); };
          replay.onclick = () => {
            const token = ++this.replayGeneration, start = performance.now();
            const duration = Math.max(1, ...record.strokes.flat().map(p => p.t || 0));
            const frame = () => {
              if (token !== this.replayGeneration || !document.getElementById('modalRecord').classList.contains('open')) return;
              const elapsed = (performance.now() - start) / 3500 * duration;
              draw(elapsed);
              if (elapsed < duration) requestAnimationFrame(frame);
            }; requestAnimationFrame(frame);
          };
          const star = document.createElement('button'); star.className = 'btn'; star.textContent = record.favorite ? '★ おきにいり' : '☆ おきにいりに する';star.setAttribute('aria-pressed',String(!!record.favorite));
          star.onclick = async () => {
            const next = { ...record, favorite: !record.favorite };
            try { await this.archive.put(next); record.favorite = next.favorite; star.textContent = record.favorite ? '★ おきにいり' : '☆ おきにいりに する';star.setAttribute('aria-pressed',String(!!record.favorite));message.dataset.kind='saved';message.textContent=record.favorite?'おきにいりに いれたよ。':'おきにいりから はずしたよ。'; }
            catch { this.storageStatus(false);message.dataset.kind='error';message.textContent='ほぞんが できなかったよ。おとなのひとに おしえてね。'; }
          };
          const message=document.createElement('p');message.className='album-inline-status';message.setAttribute('role','status');
          const controls=document.createElement('div');controls.className='album-piece-controls';controls.append(replay,stop,star);
          detail.append(title,context,MonjiWords.teacherMetadata([record]),canvas,controls,message);draw();
        };
        const displayedIds=new Set();
        const addCard=record=>{
          if(displayedIds.has(record.id))return;displayedIds.add(record.id);
          const button=document.createElement('button');button.className='archive-letter-card';button.type='button';button.dataset.recordId=record.id;
          button.setAttribute('aria-label',`${record.char}の かいたもじを みる`);
          const thumb=document.createElement('canvas');thumb.className='album-letter-thumb';thumb.width=thumb.height=128;thumb.setAttribute('aria-hidden','true');MonjiWords.paintRecord(thumb,record);
          const info=document.createElement('span');info.className='album-letter-info';
          const character=document.createElement('strong');character.textContent=record.char;
          const date=document.createElement('span');date.textContent=MonjiWords.childDate(record.date);
          info.append(character,date);button.append(thumb,info);button.onclick=()=>show(record);list.append(button);
        };
        let shown=0;const more=document.createElement('button');more.className='btn album-more';more.textContent='もっと みる';
        const appendPage=()=>{for(const record of records.slice(shown,shown+60))addCard(record);shown+=60;more.hidden=shown>=records.length;};
        appendPage();more.onclick=appendPage;container.append(more);
        const selected=records.find(record=>record.id===selectedId);if(selected&&records.indexOf(selected)>=60)addCard(selected);
        if(excludedSelection){
          const note=document.createElement('p');note.className='album-empty';note.textContent='この もじは、ぜんぶ おてつだいで かいたよ。１もじずつの きろくには いれていないよ。';detail.append(note);
        }else show(records.find(record => record.id === selectedId) || records[0]);
      }

      setStrict(lvl) {
        this.level = lvl;
        const b = document.getElementById('badgeStrict');
        if (b) {
          b.className = `badge ${lvl}`;
          const names = { relaxed:'げきあま', easy: 'やさしい', normal: 'ふつう', strict: 'しっかり' };
          b.textContent = `判定: ${names[lvl] || lvl}`;
        }
        document.querySelectorAll('.set-strict').forEach(btn => {
          btn.classList.toggle('btn-primary', btn.dataset.level === lvl);
        });
        for(const id of ['sldTol','sldFill']){const el=document.getElementById(id);if(el){el.disabled=lvl==='relaxed';el.parentNode.hidden=lvl==='relaxed';}}
        const p = this.params[lvl];
        const sldTol = document.getElementById('sldTol');
        const lblTol = document.getElementById('lblTol');
        const sldFill = document.getElementById('sldFill');
        const lblFill = document.getElementById('lblFill');
        if (sldTol) sldTol.value = p.dev;
        if (lblTol) lblTol.textContent = `${p.dev}px`;
        if (sldFill) sldFill.value = Math.round(p.maxRatio * 10);
        if (lblFill) lblFill.textContent = `${p.maxRatio}倍まで`;
        const names = { relaxed:'げきあま', easy: 'やさしい', normal: 'ふつう', strict: 'しっかり' };

      }

      selectCategoryTab(tab) {
        this.currentCategoryTab = tab || 'hiragana';
        document.querySelectorAll('#tabBar .tab-btn').forEach(b => {
          b.classList.toggle('active', b.dataset.tab === this.currentCategoryTab);
        });
        this.populateGrid(this.currentCategoryTab);
      }

      populateGrid(tab) {
        const g = document.getElementById('charGrid');
        if (!g) return;
        g.replaceChildren();
        const kana=tab==='hiragana'||tab==='katakana';g.dataset.layout=kana?'kana':tab==='numbers'?'numbers':'kanji';
        document.getElementById('kanaModifiers').hidden=!kana;
        const key=ch=>{
          if(!ch){const gap=document.createElement('span');gap.className='kana-gap';gap.setAttribute('aria-hidden','true');g.append(gap);return;}
          const b=document.createElement('button');b.className='char-card';b.textContent=ch;b.type='button';b.setAttribute('aria-label',ch+'を おだいに いれる');b.onclick=()=>this.lessonLibrary.appendCharacter(ch);g.append(b);
        };
        const heading=text=>{const title=document.createElement('div');title.className='keyboard-section-title';title.textContent=text;g.append(title);};
        const katakana=text=>tab==='katakana'?Array.from(text,ch=>String.fromCodePoint(ch.codePointAt(0)+0x60)).join(''):text;
        if(kana){
          heading(tab==='katakana'?'ア・カ・サ… の じゅん':'あ・か・さ… の じゅん');
          for(const row of ['あいうえお','かきくけこ','さしすせそ','たちつてと','なにぬねの','はひふへほ','まみむめも','や ゆ よ','らりるれろ','わ   を','ん    '])for(const ch of row)key(ch===' '?null:katakana(ch));
          heading('てんてん・まる');
          for(const ch of 'がぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽ')key(katakana(ch));
          // ヴ and ゔ are both supported, alongside the usual contracted sounds.
          key(tab==='katakana'?'ヴ':'ゔ');for(let i=0;i<4;i++)key(null);
          heading('ちいさい もじ');
          for(const row of ['ぁぃぅぇぉ','ゃ ゅ ょ','っゎ   '])for(const ch of row)key(ch===' '?null:katakana(ch));
        }else (PRESETS[tab]||[]).forEach(key);
        g.scrollTop=0;
      }

      checkStroke() {
        if (this.loading || this.sIdx >= this.strokes.length) return;
        const target = samplePath(this.strokes[this.sIdx], 460, 460);
        const scale = 460 / this.W;
        const normalize = pts => pts.map(p => ({ x: p.x * scale, y: p.y * scale }));
        const res = evaluateStroke(target, normalize(this.drawing), this.params[this.level]);
        if (res.pass) {
          sound.success(); this.userStrokes[this.sIdx] = this.drawing.map(p => ({ ...p }));
          this.skipped[this.sIdx] = false; this.drawing = []; this.sIdx++;
          this.saveDraft();
          if (this.sIdx >= this.strokes.length) this.finishChar();
          else { document.getElementById('curStroke').textContent = this.sIdx + 1; this.render(); }
        } else {
          const hiddenMessages=['ここから、こちらむきに かいてみよう','もうすこし さきまで かいてみよう','すこし せんを かいてみよう'];
          if(res.msg&&!hiddenMessages.includes(res.msg)&&(this.showGuide||res.msg!=='はじめの しるしから かいてみよう'))this.showToast(res.msg);
          else this.toast?.classList.remove('show');
          this.drawing = []; this.render();
        }
      }

      async finishChar() {
        if (this.finishing) return;
        this.finishing = true; this.stopHotaru(); this.stopAnim(); this.rememberCurrent();
        this.ensurePractice();
        const index = this.cIdx, ch = this.chars[index], entry = this.sessions[index];
        entry.id = entry.id || (globalThis.crypto?.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random());
        entry.date = entry.date || new Date().toISOString();
        const record = { id: entry.id, date: entry.date, word: this.word, index, char: ch,
          practiceId: this.practiceId, practiceStartedAt: this.practiceStartedAt,
          strokes: entry.strokes, skipped: entry.skipped, assisted: entry.skipped.some(Boolean),
          settings: { display: { ...this.display }, level: this.level, showGuide:!!this.showGuide, showGrid:!!this.showGrid, params:{...this.params[this.level]}, hotaru: this.hotaru.enabled, once: !!this.hotaru.once,
            visibleSec: this.hotaru.visibleSec, hiddenSec: this.hotaru.hiddenSec, width: this.W, height: this.H },
          formatVersion: 2, favorite: false, source: globalThis.MonjiBundledStrokes?.characters?.[ch]
            ? 'KanjiVG bundled snapshot ' + globalThis.MonjiBundledStrokes.snapshot : 'KanjiVG (remote/cache)' };
        if (!entry.archived) {
          try {
            await this.archive.put(record); entry.archived = true; delete this.unsavedRecords[record.id];
            if (!record.assisted) this.saveHistoryRecord(ch);
            this.storageStatus(true);
          } catch { this.unsavedRecords[record.id] = record; this.storageStatus(false); }
        }
        this.finishing = false; this.render(); this.renderPills(); this.saveDraft();
        this.hanamaru.classList.remove('show');
        this.knownChars?.add(ch);
        const allDone=this.chars.every((_,i)=>this.sessions[i]?.complete);
        if(allDone){
          this.coachSay('ぜんぶ かけました！ しゅっぱつ、しんこう〜','praise');
          speech.play('complete');
        }else{
          const coach=document.getElementById('hotarukoCoach');if(coach)coach.dataset.pose='guide';
        }
        this.scheduleAdvance();
      }

      showToast(msg, type = 'info') {
        this.coachSay(msg, 'guide');
        if (this.display?.mode === 'fixed') {
          document.getElementById('coachMessage').textContent = msg;
          return;
        }
        if (!this.toast) return;
        this.toast.textContent = msg;
        this.toast.className = `toast show ${type}`;
        if (this.tTimer) clearTimeout(this.tTimer);
        this.tTimer = setTimeout(() => {
          if (this.toast) this.toast.classList.remove('show');
        }, 2400);
      }

      playDemo() {
        if (!this.inputEnabled() || this.isDown) return;
        this.stopAnim();
        const target = samplePath(this.strokes[this.sIdx], this.W, this.H);
        if (target.length === 0) return;

        let frame = 0, total = 45;
        const ctx = this.anmCtx;

        const loop = () => {
          ctx.clearRect(0, 0, this.W, this.H);
          const p = Math.min(1, frame / total);
          const idx = Math.floor(p * (target.length - 1));

          ctx.beginPath(); ctx.moveTo(target[0].x, target[0].y);
          for (let i = 1; i <= idx; i++) ctx.lineTo(target[i].x, target[i].y);
          ctx.strokeStyle = '#2563eb'; ctx.lineWidth = 14 * this.W / 460; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();

          const tip = target[idx];
          ctx.beginPath(); ctx.arc(tip.x, tip.y, 8 * this.W / 460, 0, Math.PI*2); ctx.fillStyle = '#f97316'; ctx.fill();

          frame++;
          if (frame <= total) this.animId = requestAnimationFrame(loop);
          else this.demoClearTimer = setTimeout(() => ctx.clearRect(0, 0, this.W, this.H), 500);
        };
        this.animId = requestAnimationFrame(loop);
      }

      stopAnim() {
        clearTimeout(this.demoClearTimer);
        if (this.animId) cancelAnimationFrame(this.animId);
        this.anmCtx.clearRect(0, 0, this.W, this.H);
      }
    }

    let booting = false;
    async function init() {
      if (window.app || booting) return;
      booting = true;
      globalThis.MonjiOpening?.start();
      window.monjiArchive = new StrokeArchive();
      let storageError = false;
      try {
        [window.monjiSettings, window.monjiDraft] = await Promise.all([
          monjiArchive.state('settings'), monjiArchive.state('draft')]);
      } catch { storageError = true; }
      try {
        if(!globalThis.MonjiLessons?.LessonLibrary)throw new Error("文字選択機能を読み込めませんでした");
        window.app = new App();
        if (storageError) window.app.storageStatus(false);
      } catch(error) {
        console.error('もんじぼたる４の起動に失敗しました',error);
        const message=document.createElement('div');message.className='startup-error';message.setAttribute('role','alert');
        const text=document.createElement('p');text.textContent='アプリを じゅんびできなかったよ。もういちど ひらいてね。';
        const retry=document.createElement('button');retry.className='btn btn-primary';retry.textContent='もういちど ひらく';retry.onclick=()=>location.reload();
        message.append(text,retry);document.body.append(message);
      }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
    window.addEventListener('load', init);
  })();
