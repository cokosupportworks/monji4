(function(root){
 'use strict';
 const opening={
  active:false,started:false,finished:false,progressing:false,
  start(){
   if(this.started)return;this.started=true;this.active=true;
   this.screen=document.getElementById('openingScreen');this.video=document.getElementById('openingVideo');this.button=document.getElementById('btnPlayOpening');
   if(!this.screen||!this.video){this.finish();return;}
   this.lastTime=Number(this.video.currentTime)||0;this.lastProgress=performance.now();
   this.video.addEventListener('ended',()=>this.finish());
   this.video.addEventListener('error',()=>this.finish());
   // A resolved play() or "playing" event alone does not establish visible playback.
   this.video.addEventListener('timeupdate',()=>this.observeProgress());
   this.video.addEventListener('pause',()=>{if(!this.finished)this.showPlay();});
   this.button.onclick=()=>this.play();
   document.getElementById('btnSkipOpening').onclick=()=>this.finish();
   this.screen.addEventListener('click',event=>{if((event.target===this.screen||event.target===this.video)&&!this.progressing)this.play();});
   this.watchdog=setInterval(()=>{
    if(this.finished||document.hidden)return;
    this.observeProgress();
    if(performance.now()-this.lastProgress>=2000)this.showPlay();
   },500);
   this.showPlay();
   if(this.video.error){this.finish();return;}
   this.play();
  },
  showPlay(){
   this.progressing=false;this.button.hidden=false;
   this.button.textContent=this.lastTime>0?'タップして つづける':'タップして はじめる';
  },
  observeProgress(){
   if(this.finished)return;
   const now=Number(this.video.currentTime)||0;
   if(now>this.lastTime+.01){this.lastTime=now;this.lastProgress=performance.now();this.progressing=true;this.button.hidden=true;}
  },
  play(){
   if(this.finished)return;
   // Keep the button available while Safari leaves its play promise pending.
   try{Promise.resolve(this.video.play()).catch(error=>{
    if(this.finished)return;
    if(error?.name==='NotAllowedError'||error?.name==='AbortError')this.showPlay();
    else this.finish();
   });}catch{this.finish();}
  },
  finish(){
   if(this.finished)return;this.finished=true;this.active=false;
   clearInterval(this.watchdog);
   try{this.video?.pause();}catch{}
   this.screen?.remove();document.querySelector('body')?.classList.remove('opening-active');
   root.app?.playWelcomeVoice();
  }
 };
 root.MonjiOpening=opening;
})(globalThis);
