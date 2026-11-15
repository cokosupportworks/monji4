// DOM integration harness, not a browser layout/pixel test.
const fs=require('node:fs');
function makeDOM(html){
 const calls=[];
 class Node{
  constructor(tag='div'){
   this.tagName=tag.toUpperCase();this.attributes={};this.children=[];this.listeners={};this.parentNode=null;
   this.style={setProperty:(k,v)=>this.style[k]=v};this.textContent='';this.value='';
   this.classList={add:(...xs)=>this.className=[...new Set([...this.className.split(/\s+/),...xs])].filter(Boolean).join(' '),
    remove:(...xs)=>this.className=this.className.split(/\s+/).filter(x=>!xs.includes(x)).join(' '),
    contains:x=>this.className.split(/\s+/).includes(x),
    toggle:(x,force)=>{const on=force===undefined?!this.classList.contains(x):force;on?this.classList.add(x):this.classList.remove(x);return on;}};
  }
  get className(){return this.attributes.class||'';}set className(v){this.attributes.class=v;}
  get id(){return this.attributes.id||'';}set id(v){this.attributes.id=v;}
  get dataset(){if(!this._dataset)this._dataset={};return this._dataset;}
  setAttribute(k,v){this.attributes[k]=String(v);if(k.startsWith('data-'))this.dataset[k.slice(5).replace(/-([a-z])/g,(_,x)=>x.toUpperCase())]=String(v);}
  getAttribute(k){return this.attributes[k]??null;}removeAttribute(k){delete this.attributes[k];}
  append(...nodes){for(const n of nodes){n.remove();n.parentNode=this;this.children.push(n);}}
  appendChild(node){this.append(node);return node;}
  set innerHTML(value){if(value==='')this.replaceChildren();else throw new Error('HTML parsing is outside this test harness');}
  get innerHTML(){return '';}
  replaceChildren(...nodes){for(const n of this.children)n.parentNode=null;this.children=[];this.append(...nodes);}
  remove(){if(this.parentNode){const siblings=this.parentNode.children;siblings.splice(siblings.indexOf(this),1);this.parentNode=null;}}
  replaceWith(node){const p=this.parentNode,index=p.children.indexOf(this);this.remove();node.remove();node.parentNode=p;p.children.splice(index,0,node);}
  addEventListener(type,fn,capture=false){(this.listeners[type]||=[]).push({fn,capture});}
  click(){return this.emit('click',{currentTarget:this});}
  emit(type,properties={}){
   const event={target:this,preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.stopped=true;},...properties};
   const parents=[];for(let n=this.parentNode;n;n=n.parentNode)parents.unshift(n);
   for(const n of [...parents,this])for(const l of n.listeners[type]||[]){if(l.capture)l.fn(event);if(event.stopped)return event;}
   for(const n of [this,...parents.reverse()]){if(n['on'+type])n['on'+type](event);for(const l of n.listeners[type]||[])if(!l.capture)l.fn(event);if(event.stopped)break;}
   return event;
  }
  matches(selector){
   const id=selector.match(/#([\w-]+)/);if(id&&this.id!==id[1])return false;
   for(const x of selector.matchAll(/\.([\w-]+)/g))if(!this.classList.contains(x[1]))return false;
   const tag=selector.match(/^[a-z]+/i);if(tag&&this.tagName!==tag[0].toUpperCase())return false;
   for(const attr of selector.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g))if(this.getAttribute(attr[1])===null||(attr[2]!==undefined&&this.getAttribute(attr[1])!==attr[2]))return false;
   return true;
  }
  closest(selector){for(let n=this;n;n=n.parentNode)if(n.matches(selector))return n;return null;}
  querySelectorAll(selector){
   const parts=selector.trim().split(/\s+/),results=[];
   function walk(n){for(const child of n.children){if(child.matches(parts.at(-1))){let at=parts.length-2,p=child.parentNode;while(at>=0&&p){if(p.matches(parts[at]))at--;p=p.parentNode;}if(at<0)results.push(child);}walk(child);}}
   walk(this);return results;
  }
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  get clientWidth(){if(this.classList.contains('journey'))return 800;if(this.id==='stage')return Number.parseFloat(this.closest('.journey')?.style['--car-size']||'300');return 300;}
  get clientHeight(){if(this.classList.contains('journey'))return 500;return this.clientWidth;}
  getBoundingClientRect(){return {left:100,top:100,width:this.closest('.journey')?Number.parseFloat(this.closest('.journey').style['--car-size']||'300'):300,height:this.closest('.journey')?Number.parseFloat(this.closest('.journey').style['--car-size']||'300'):300};}
  getContext(){if(!this.context)this.context=new Proxy({canvas:this,trace:[]},{get:(object,key)=>key in object?object[key]:(...args)=>{calls.push([key,...args]);object.trace.push([key,...args]);}});return this.context;}
  setPointerCapture(id){this.capture=id;}releasePointerCapture(){this.capture=null;}
  getTotalLength(){const n=(this.getAttribute('d')||'').match(/-?\d+(?:\.\d+)?/g)?.map(Number)||[0,0,1,1];return Math.hypot(n[2]-n[0],n[3]-n[1]);}
  getPointAtLength(length){const n=(this.getAttribute('d')||'').match(/-?\d+(?:\.\d+)?/g).map(Number),t=length/this.getTotalLength();return{x:n[0]+(n[2]-n[0])*t,y:n[1]+(n[3]-n[1])*t};}
 }
 const document=new Node('document'),stack=[document];
 const voids=new Set(['meta','link','input','img','hr','br']);
 for(const match of html.matchAll(/<!--[\s\S]*?-->|<\/?([\w-]+)([^>]*)>/g)){
  if(!match[1])continue;
  if(match[0].startsWith('</')){if(stack.length>1)stack.pop();continue;}
  const node=new Node(match[1]);for(const a of match[2].matchAll(/([\w:-]+)(?:="([^"]*)")?/g))node.setAttribute(a[1],a[2]||'');
  stack.at(-1).append(node);if(!voids.has(match[1])&&!match[0].endsWith('/>'))stack.push(node);
 }
 document.createElement=tag=>new Node(tag);document.getElementById=id=>document.querySelector('#'+id);document.hidden=false;
 return {document,Node,calls};
}
module.exports={makeDOM};
