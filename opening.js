(function(root){
 'use strict';
 const opening={
  active:false,started:false,finished:false,
  start(){
   if(this.started)return;this.started=true;this.active=true;
   this.screen=document.getElementById('openingScreen');this.video=document.getElementById('openingVideo');this.button=document.getElementById('btnPlayOpening');
   if(!this.screen||!this.video){this.finish();return;}
   this.video.addEventListener('ended',()=>this.finish());
   this.video.addEventListener('error',()=>this.finish());
   this.video.addEventListener('playing',()=>{this.button.hidden=true;});
   this.button.onclick=()=>this.play();
   if(this.video.error){this.finish();return;}
   this.play();
  },
  play(){
   if(this.finished)return;
   this.button.hidden=true;
   try{Promise.resolve(this.video.play()).catch(error=>{
    if(this.finished)return;
    if(error?.name==='NotAllowedError'){
     // Retain the soundtrack: ask for a tap rather than silently muting it.
     this.button.hidden=false;this.button.focus?.();
    }else this.finish();
   });}catch{this.finish();}
  },
  finish(){
   if(this.finished)return;this.finished=true;this.active=false;
   try{this.video?.pause();}catch{}
   this.screen?.remove();document.querySelector('body')?.classList.remove('opening-active');
   // Remove the last video frame synchronously; no fade, timer or replay.
   root.app?.playWelcomeVoice();
  }
 };
 root.MonjiOpening=opening;
})(globalThis);
