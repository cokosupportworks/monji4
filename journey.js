(function(root) {
  'use strict';
  const artwork = direction => direction === 'vertical'
    ? { car: 'assets/train-top.svg', rail: 'assets/rail-top.svg', locomotive: 'assets/locomotive-top.svg' }
    : { car: 'assets/train-side.svg', rail: 'assets/rail-side.svg', locomotive: 'assets/locomotive-side.svg' };
  const motion = (direction, distance) => direction === 'vertical'
    ? `translate(-50%, calc(-50% + ${distance}px))`
    : `translate(calc(-50% + ${distance}px), -50%)`;

  function trainColor(chars,known){
    const old=chars.filter(ch=>known.has(ch)).length,fresh=chars.length-old;
    return old===0?'white':fresh===0?'red':fresh>=old?'green':'blue';
  }
  function orientationMatches(direction,width,height){
    if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)return true;
    return direction==='vertical'?height>width:width>height;
  }
  const themed=(path,theme)=>theme?path.replace('.svg','-'+theme+'.svg'):path;
  function fixedLayout(count, width, height, direction) {
    const availableWidth = Math.max(1,width-40), availableHeight = Math.max(1,height-80);
    let best = {cols:1,rows:Math.max(1,count),size:0};
    for(let cols=1;cols<=Math.max(1,count);cols++) {
      const rows=Math.ceil(Math.max(1,count)/cols);
      const size=Math.min(availableWidth/(cols*1.5-.2),availableHeight/(rows*1.5-.1),440);
      const tie=direction==='vertical'?rows>best.rows:cols>best.cols;
      if(size>best.size+.01 || (Math.abs(size-best.size)<.01 && tie)) best={cols,rows,size};
    }
    return {...best,size:Math.max(1,Math.floor(best.size))};
  }

  class JourneyView {
    constructor(stage, onResize, onSelect) {
      this.stage=stage;this.onResize=onResize;this.onSelect=onSelect;
      this.generation=0;this.size=300;this.materials=new Map();this.cards=[];
      this.viewport=document.createElement('div');this.viewport.className='journey';
      this.viewport.setAttribute('aria-label','もじの れんしゅう');
      this.rail=document.createElement('div');this.rail.className='journey-rail';this.rail.setAttribute('aria-hidden','true');
      this.track=document.createElement('div');this.track.className='journey-track';
      this.marker=document.createElement('div');this.marker.className='station-marker';this.marker.setAttribute('aria-hidden','true');
      this.progress=document.createElement('div');this.progress.className='journey-progress';this.progress.setAttribute('aria-live','polite');
      this.note=document.createElement('div');this.note.className='journey-size-note';
      stage.replaceWith(this.viewport);this.viewport.append(this.rail,this.track,this.marker,this.progress,this.note);
      this.welcome=document.getElementById('welcomeMessage');if(this.welcome)this.viewport.append(this.welcome);
      this.display={mode:'flow',direction:'vertical',train:true,reduced:false};
      this.build([],0);
      this.viewport.addEventListener('pointerdown',event=>{
        if(this.display.mode!=='fixed' || event.target.closest('button'))return;
        const cell=event.target.closest('.journey-car');if(!cell)return;
        const index=Number(cell.dataset.index);
        event.preventDefault();event.stopPropagation();
        this.onSelect?.(index,event);
      },true);
      this.observer=new ResizeObserver(()=>{
        if(this.animation){if(this.finale?.classList.contains('finale-departing'))this.animation.cancel();else this.animation.finish();return;}
        if(this.layout())this.onResize();
      });this.observer.observe(this.viewport);
    }
    setDataLoading(active){
      clearTimeout(this.dataLoadingTimer);
      if(!this.dataLoadingPanel){
        const panel=document.createElement('section');panel.className='train-loading-panel';panel.setAttribute('role','status');panel.setAttribute('aria-live','polite');panel.hidden=true;
        const text=document.createElement('p'),retry=document.createElement('button');retry.className='btn';retry.textContent='もういちど よみこむ';retry.hidden=true;
        panel.append(text,retry);this.viewport.append(panel);this.dataLoadingPanel=panel;this.dataLoadingText=text;this.dataLoadingRetry=retry;
      }
      this.viewport.classList.toggle('data-loading',active);this.dataLoadingPanel.hidden=true;this.dataLoadingRetry.hidden=true;
      if(active)this.dataLoadingTimer=setTimeout(()=>{
        if(!this.viewport.classList.contains('data-loading'))return;
        this.dataLoadingText.textContent='ただいま れっしゃがおくれております。もうしばらくおまちください。';this.dataLoadingPanel.hidden=false;
      },600);
    }
    setDataError(message,retry){
      this.setDataLoading(true);clearTimeout(this.dataLoadingTimer);this.dataLoadingText.textContent=message;this.dataLoadingRetry.hidden=false;this.dataLoadingRetry.onclick=retry;this.dataLoadingPanel.hidden=false;
    }
    build(chars,index) {
      const fixed=this.display.mode==='fixed', signature=fixed?'fixed:'+chars.length:'flow';
      if(signature===this.signature)return;
      this.signature=signature;this.stage.remove();this.track.replaceChildren();
      const length=fixed?Math.max(1,chars.length):5;
      this.cards=Array.from({length},(_,slot)=>{
        const car=document.createElement('div');car.className='journey-car';
        const rail=document.createElement('div');rail.className='cell-rail';rail.setAttribute('aria-hidden','true');
        const art=document.createElement('img');art.className='journey-art';art.alt='';art.draggable=false;
        const canvas=document.createElement('canvas');canvas.width=canvas.height=400;canvas.className='journey-preview';
        const ink=document.createElement('canvas');ink.width=ink.height=400;ink.className='journey-ink';
        const label=document.createElement('button');label.type='button';label.className='cell-label';
        label.onclick=()=>this.onSelect?.(Number(car.dataset.index),null);
        const driver=document.createElement('div');driver.className='cab-driver';driver.setAttribute('aria-hidden','true');
        const sprite=document.createElement('div');sprite.className='hotaruko-sprite';driver.append(sprite);
        car.append(rail,art,canvas,ink,label,driver);this.track.append(car);
        return {car,rail,art,canvas,ink,label,driver};
      });
      this.focus(index);
    }
    focus(index) {
      const fixed=this.display.mode==='fixed';this.index=index;
      for(const [slot,card]of this.cards.entries()){
        const active=fixed?slot===index:slot===2;
        card.car.classList.toggle('current-car',active);
        card.label.setAttribute('aria-pressed',String(active));
        if(active)card.car.append(this.stage);
      }
      this.progress.textContent=`${index+1} ／ ${this.chars?.length||1} もじ`;
    }
    apply(display) {
      this.display={...display,mode:display.mode==='fixed'?'fixed':'flow'};
      this.viewport.dataset.direction=display.direction;this.viewport.dataset.mode=this.display.mode;
      this.viewport.classList.toggle('without-train',!display.train);
      this.build(this.chars||[],this.index||0);this.setArtwork();this.layout();
    }
    setTheme(theme){
      this.theme=['white','green','blue','red'].includes(theme)?theme:'white';
      this.viewport.dataset.trainColor=this.theme;this.setArtwork();
    }
    beginReset(){
      this.generation++;this.viewport.classList.add('journey-preparing');this.track.style.opacity='0';this.track.style.visibility='hidden';
      if(this.animation){this.animation.cancel();this.animation=null;}
    }
    revealPrepared(){this.viewport.classList.remove('journey-preparing','arrival-pending');this.track.style.visibility='';this.track.style.opacity='';}
    setOrientationBlocked(blocked,direction){
      this.orientationBlocked=blocked;
      if(!this.orientationGate){
        this.orientationGate=document.createElement('div');this.orientationGate.className='orientation-gate';this.orientationGate.setAttribute('role','status');
        this.viewport.append(this.orientationGate);
      }
      this.orientationGate.textContent=direction==='vertical'?'たてがきだよ。がめんを たてにすると はじめられるよ。':'よこがきだよ。がめんを よこにすると はじめられるよ。';
      this.orientationGate.hidden=!blocked;this.viewport.classList.toggle('orientation-blocked',blocked);
    }
    layoutFinale(){
      if(!this.finale)return;
      const count=(this.chars?.length||1)+1,vertical=this.display.direction==='vertical';
      const extra=40+(vertical?28:52)+(this.finale.querySelector('h2')?.offsetHeight||40)+(this.finale.querySelector('.finale-actions')?.offsetHeight||60);
      const zone=this.finale.querySelector('.station-train-zone');
      const width=Math.max(1,this.viewport.clientWidth-40);
      const height=Math.max(1,zone?.clientHeight?Math.min(zone.clientHeight-(vertical?0:24),this.viewport.clientHeight-40):this.viewport.clientHeight-extra);
      const size=Math.max(1,Math.floor(Math.min(180,vertical?width:width/count,vertical?height/count*480/560:height*480/560)));
      this.finale.style.setProperty('--whole-car-size',size+'px');
    }
    clearFinale(){this.finale?.remove();this.finale=null;this.viewport.classList.remove('word-finished');}
    showFinale(sessions,actions){
      this.revealPrepared();this.clearFinale();this.viewport.classList.add('word-finished');
      const panel=document.createElement('section');panel.className='journey-finale';panel.setAttribute('aria-label','かきおわった でんしゃ');
      const title=document.createElement('h2');title.textContent='ぜんぶ かけたね！';
      if(actions.station){panel.dataset.station=actions.station.id;panel.style.backgroundImage=`url("${this.display.direction==='vertical'?actions.station.top:actions.station.side}?v=0.29.0")`;const name=document.createElement('small');name.className='station-name';name.textContent=actions.station.name;title.append(name);}
      const strip=document.createElement('div');strip.className='whole-train';strip.style.setProperty('--train-count',String(this.chars.length+1));
      const art=artwork(this.display.direction);
      const engine=document.createElement('div');engine.className='whole-train-car locomotive-car';
      const img=document.createElement('img');img.src=themed(art.locomotive,this.theme);img.alt='ほたるこちゃんの せんとうしゃ';engine.append(img);
      if(this.display.direction!=='vertical'){const cab=document.createElement('div');cab.className='cab-driver';const girl=document.createElement('div');girl.className='hotaruko-sprite';cab.append(girl);engine.append(cab);}
      strip.append(engine);
      this.chars.forEach((_,index)=>{
        const cell=document.createElement('div');cell.className='whole-train-car';
        const picture=document.createElement('img');picture.src=themed(art.car,this.theme);picture.alt='';
        const ink=document.createElement('canvas');ink.width=ink.height=240;ink.setAttribute('aria-label',`${index+1}もじめの さくひん`);
        const record=sessions[index];
        root.MonjiWords?.paintRecord(ink,{...record,strokes:(record?.strokes||[]).map((line,i)=>record?.skipped?.[i]?[]:line)});
        cell.append(picture,ink);strip.append(cell);
      });
      const buttons=document.createElement('div');buttons.className='finale-actions';
      const again=document.createElement('button');again.className='btn btn-primary';again.textContent='もういっかい';again.onclick=actions.again;
      const next=document.createElement('button');next.className='btn';next.textContent=actions.hasNext?'つぎのおだい':'おだいをえらぶ';next.onclick=actions.next;
      const zone=document.createElement('div');zone.className='station-train-zone';zone.append(strip);
      buttons.append(again,next);panel.append(title,zone,buttons);this.viewport.append(panel);this.finale=panel;this.layoutFinale();
    }
    async departFinale(onStart){
      const panel=this.finale;if(!panel)return false;
      const strip=panel.querySelector('.whole-train'),buttons=panel.querySelectorAll('button');
      for(const button of buttons)button.disabled=true;
      panel.classList.add('finale-departing');
      const vertical=this.display.direction==='vertical',extent=vertical?this.viewport.clientHeight:this.viewport.clientWidth;
      const span=vertical?(strip.offsetHeight||extent):(strip.offsetWidth||extent),distance=-(extent+span+120);
      const reduced=this.display.reduced||root.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      const duration=4200;
      let animation,stopSound;
      try{
        if(strip.animate){
          const frames=reduced?[{opacity:1,offset:0},{opacity:1,offset:.92},{opacity:0,offset:1}]:[
            {transform:'translate(0,0)',offset:0},
            {transform:vertical?'translateY(-12px)':'translateX(-12px)',offset:.12},
            {transform:vertical?`translateY(${distance}px)`:`translateX(${distance}px)`,offset:1}];
          animation=strip.animate(frames,{duration,easing:'ease-in',fill:'forwards'});this.animation=animation;
          stopSound=onStart?.(duration);await animation.finished;
        }
        strip.style.visibility='hidden';panel.classList.add('finale-departed');return true;
      }catch{return false;}
      finally{
        stopSound?.();animation?.cancel?.();if(this.animation===animation)this.animation=null;
        if(!panel.classList.contains('finale-departed')){panel.classList.remove('finale-departing');for(const button of buttons)button.disabled=false;}
      }
    }
    setArtwork(){
      const art=artwork(this.display.direction);this.rail.style.backgroundImage=`url("${art.rail}")`;
      const overview=root.document?.getElementById('driverOverview'),cab=root.document?.getElementById('driverTrainArt');
      if(overview){overview.dataset.direction=this.display.direction;overview.hidden=!this.display.train;}
      if(cab)cab.src=themed(art.locomotive,this.theme);
      for(const card of this.cards){card.art.src=themed(card.car?.classList.contains('locomotive-car')?art.locomotive:art.car,this.theme);card.rail.style.backgroundImage=`url("${art.rail}")`; }
    }
    layout(){
      this.layoutFinale();
      const width=this.viewport.clientWidth,height=this.viewport.clientHeight;if(!width||!height)return false;
      const fixed=this.display.mode==='fixed';
      const grid=fixed?fixedLayout(this.chars?.length||1,width,height,this.display.direction):null;
      const labelWidth=this.stage.querySelector('.counter')?.offsetWidth||80;
      const widthLimit=this.display.direction==='vertical'?(width-2*(labelWidth+12))/1.2:(width-32)/1.2;
      const heightLimit=(height-(this.display.direction==='vertical'?36:60))/1.4;
      const size=fixed?grid.size:Math.max(24,Math.floor(Math.min(widthLimit,heightLimit,440)));
      if(fixed){
        this.track.style.gridTemplateColumns=`repeat(${grid.cols}, var(--car-size))`;
        this.track.style.gridTemplateRows=`repeat(${grid.rows}, var(--car-size))`;
      }else{this.track.style.gridTemplateColumns='';this.track.style.gridTemplateRows='';}
      this.note.textContent=fixed&&size<120?'ますが ちいさいね。おとなのひとと せっていを かえてね。':'';
      this.viewport.classList.toggle('small-cells',size<120);
      if(size===this.size)return false;
      this.size=size;this.viewport.style.setProperty('--car-size',size+'px');return true;
    }
    setModelVisibility(visible){this.viewport.classList.toggle('models-hidden',!visible);}
    async refresh(chars,index,sessions,loader,sample){
      const token=++this.generation;this.chars=chars;this.sessions=sessions;this.loader=loader;this.sample=sample;
      if(this.animation){this.animation.cancel();this.animation=null;}
      this.build(chars,index);this.focus(index);this.setArtwork();
      if(this.layout())this.onResize();
      this.track.style.transform=motion(this.display.direction,0);
      this.track.style.visibility='';
      const tasks=this.cards.map((card,slot)=>{
        const at=this.display.mode==='fixed'?slot:index+slot-2;
        card.car.dataset.index=String(at);card.label.textContent=String(at+1);
        card.label.setAttribute('aria-label',`${at+1}もじめを えらぶ`);
        const lead=this.display.mode==='flow'&&at===-1&&chars.length>0&&this.display.train;
        card.car.classList.toggle('locomotive-car',lead);
        card.art.src=themed(lead?artwork(this.display.direction).locomotive:artwork(this.display.direction).car,this.theme);
        card.car.style.visibility=(!lead&&at<0)||at>=chars.length?'hidden':'visible';
        card.car.removeAttribute('aria-hidden');
        if(this.display.mode!=='fixed')card.car.setAttribute('aria-hidden',slot===2?'false':'true');
        this.paint(card,at,sessions[at],[]);
        const task=(async()=>{
          if(at<0||at>=chars.length)return;
          try{
            const paths=await loader.load(chars[at]);
            this.materials.set(chars[at],paths);
            if(token!==this.generation)return;
            this.paint(card,at,this.sessions[at],paths);
          }catch{
            if(token!==this.generation)return;
            // Loading errors are presented outside the carriage by the application.
          }
        })();card.ready=task;return task;
      });
      this.ready=Promise.allSettled(tasks);return this.ready;
    }
    paint(card,index,saved,paths){
      const model=card.canvas.getContext('2d'),ink=card.ink.getContext('2d');
      model.clearRect(0,0,400,400);ink.clearRect(0,0,400,400);
      card.car.classList.toggle('completed-car',!!saved?.complete);
      const stroke=(ctx,points,color)=>{
        if(!points.length)return;ctx.lineCap=ctx.lineJoin='round';ctx.lineWidth=12;ctx.strokeStyle=color;
        ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);for(const p of points.slice(1))ctx.lineTo(p.x,p.y);ctx.stroke();
      };
      if(!saved?.complete&&this.sample)for(const path of paths)stroke(model,this.sample(path,400,400),'#b9c4b5');
      for(const [i,line]of (saved?.strokes||[]).entries())stroke(ink,line.map(p=>({x:p.x*400,y:p.y*400})),saved.skipped?.[i]?'#94a3b8':'#30483d');
    }
    updateSnapshot(index,saved){
      if(!this.chars)return;this.sessions[index]=saved;
      for(const card of this.cards)if(Number(card.car.dataset.index)===index)this.paint(card,index,saved,this.materials.get(this.chars[index])||[]);
    }
    canBookend(){
      return this.display.mode==='flow' && this.display.train && !this.display.reduced &&
        !root.matchMedia?.('(prefers-reduced-motion: reduce)').matches && !!this.track.animate;
    }
    prepareArrival(){
      if(!this.canBookend())return false;
      this.viewport.classList.add('arrival-pending');return true;
    }
    async bookend(kind, onStart){
      if(!this.canBookend()){this.track.style.visibility='';return false;}
      await this.ready;
      if(this.orientationBlocked)return false;
      const vertical=this.display.direction==='vertical';
      const extent=vertical?this.viewport.clientHeight:this.viewport.clientWidth;
      // The leading engine is one complete carriage spacing before letter one.
      // Start/end outside the viewport including art overhang and the final coupling.
      const arrival=kind==='arrival';
      const offset=extent/2+this.size*(arrival?2.25:1.1);
      const distance=arrival?offset:-offset;
      const frames=arrival?[
        {transform:motion(this.display.direction,distance),offset:0},
        {transform:motion(this.display.direction,this.size*.45),offset:.75},
        {transform:motion(this.display.direction,0),offset:1}
      ]:[
        {transform:motion(this.display.direction,0),offset:0},
        {transform:motion(this.display.direction,-this.size*.2),offset:.22},
        {transform:motion(this.display.direction,distance),offset:1}
      ];
      this.track.style.visibility='';this.viewport.classList.remove('arrival-pending','journey-preparing');this.viewport.classList.add('train-cinematic');
      const animation=this.track.animate(frames,{duration:arrival?2600:2100,easing:'ease-in-out',fill:'forwards'});
      this.track.style.opacity='';
      this.animation=animation;
      const stopSound=onStart?.(arrival?2600:2100);
      try{await animation.finished;}catch{}
      finally{
        stopSound?.();
        this.track.style.transform=motion(this.display.direction,0);
        if(!arrival)this.track.style.visibility='hidden';
        animation.cancel();
        if(this.animation===animation)this.animation=null;
        this.viewport.classList.remove('train-cinematic');this.setArtwork();
      }
      return true;
    }
    async move(delta,onStart){
      if(this.display.mode==='fixed')return;
      await this.cards[delta>0?3:1]?.ready;
      const reduced=this.display.reduced||root.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      if(reduced||Math.abs(delta)!==1||!this.track.animate)return;
      const animation=this.track.animate([
        {transform:motion(this.display.direction,0)},
        {transform:motion(this.display.direction,-delta*this.size*1.5)}
      ],{duration:850,easing:'cubic-bezier(.4,0,.2,1)',fill:'forwards'});
      this.animation=animation;const stopSound=onStart?.(850);
      try{await animation.finished;}catch{}finally{stopSound?.();animation.cancel?.();if(this.animation===animation)this.animation=null;}
    }
  }
  root.JourneyView=JourneyView;root.MonjiTrainColor=trainColor;root.MonjiOrientationMatches=orientationMatches;
  if(typeof module!=='undefined')module.exports={JourneyView,artwork,motion,fixedLayout,trainColor,orientationMatches};
})(globalThis);
