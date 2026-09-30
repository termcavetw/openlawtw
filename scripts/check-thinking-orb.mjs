import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),source=fs.readFileSync('components/thinking-orb.tsx','utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
function environment({reduced=false,hidden=false,intersection=true,context=true}={}){
 let frames=0,id=0,ioCallback,disconnected=0;const pending=new Map(),listeners=new Map(),media=new Map(),arcs=[],colors=[];
 const motion={matches:reduced,addEventListener:(name,fn)=>media.set('motion',fn),removeEventListener:()=>media.delete('motion')};
 const scheme={matches:false,addEventListener:(name,fn)=>media.set('scheme',fn),removeEventListener:()=>media.delete('scheme')};
 const doc={visibilityState:hidden?'hidden':'visible',addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)};
 const ctx={setTransform(){},clearRect(){frames++;},beginPath(){},arc(...v){arcs.push(v);},fill(){colors.push(this.fillStyle);}};
 const canvas={width:0,height:0,parentElement:{parentElement:null},getContext:()=>context?ctx:null};
 class IO{constructor(fn){ioCallback=fn;}observe(){}disconnect(){disconnected++;}}
 class MO{observe(){}disconnect(){disconnected++;}}
 const exports={};
 Function('require','exports','window','document','IntersectionObserver','MutationObserver','getComputedStyle','requestAnimationFrame','cancelAnimationFrame','performance',code)(require,exports,{devicePixelRatio:3,matchMedia:q=>q.includes('reduced')?motion:scheme},doc,intersection?IO:undefined,MO,()=>({color:'rgb(34, 34, 34)'}),fn=>{pending.set(++id,fn);return id;},id=>pending.delete(id),{now:()=>1000});
 const cleanup=exports.mountThinkingOrb(canvas);
 return {canvas,ctx,arcs,colors,pending,media,listeners,cleanup,get frames(){return frames;},get disconnected(){return disconnected;},visible(v){ioCallback([{isIntersecting:v}]);},hidden(v){doc.visibilityState=v?'hidden':'visible';listeners.get('visibilitychange')?.();},reduced(v){motion.matches=v;media.get('motion')?.();},tick(){const entries=[...pending.values()];pending.clear();entries.forEach(fn=>fn());}};
}
let e=environment();assert.equal(e.canvas.width,40);assert.equal(e.canvas.height,40);assert.equal(e.frames,1);assert.equal(e.pending.size,0,'Offscreen/unknown visibility cannot spin');e.visible(true);assert.equal(e.pending.size,1);e.tick();assert.equal(e.pending.size,1);assert(e.frames>=3);assert(e.arcs.every(a=>a.every(Number.isFinite)));assert(e.arcs.every(([x,y,r])=>x-r>=0&&y-r>=0&&x+r<=20&&y+r<=20),'20px preset fits canvas');assert(e.colors.every(c=>/^rgba\((\d+),\1,\1,/.test(c)),'Monochrome only');e.hidden(true);assert.equal(e.pending.size,0);e.hidden(false);assert.equal(e.pending.size,1);e.visible(false);assert.equal(e.pending.size,0);e.visible(true);e.reduced(true);assert.equal(e.pending.size,0);const staticFrames=e.frames;e.tick();assert.equal(e.frames,staticFrames);e.reduced(false);assert.equal(e.pending.size,1);e.cleanup();assert.equal(e.pending.size,0);assert.equal(e.media.size,0);assert.equal(e.listeners.size,0);assert.equal(e.disconnected,2);e.tick();
e=environment({reduced:true});assert.equal(e.frames,1);e.visible(true);assert.equal(e.pending.size,0);e.cleanup();
e=environment({intersection:false,hidden:true});assert.equal(e.pending.size,0,'No IO fallback must still honor hidden document');e.hidden(false);assert.equal(e.pending.size,1);e.cleanup();
e=environment({context:false});assert.equal(e.frames,0);assert.equal(e.pending.size,0);e.cleanup();
for(let i=0;i<3;i++){e=environment({intersection:false});assert.equal(e.pending.size,1);e.cleanup();assert.equal(e.pending.size,0);}
const {createElement}=await import('react'),{renderToStaticMarkup}=await import('react-dom/server'),exports={};Function('require','exports',code)(require,exports);const html=renderToStaticMarkup(createElement(exports.ThinkingOrb));assert(html.includes('aria-hidden="true"'));assert(html.includes('width="20"'));assert(!html.includes('role="status"'),'Existing adjacent status text is the accessible label');
assert(source.includes('Copyright (c) 2026 Jakub Antalik'));assert(source.includes('Permission is hereby granted'));assert(fs.readFileSync('THIRD_PARTY_NOTICES.md','utf8').includes('THE SOFTWARE IS PROVIDED "AS IS"'));assert(!/from ['"]vue|fetch\(|setTimeout\(/.test(source),'No Vue runtime, network or fake loading delay');
for(const name of ['law-reader','ruling-panel','offline-packs','legal-inline-preview']){const s=fs.readFileSync(`components/${name}.tsx`,'utf8');assert(s.includes('<ThinkingOrb/>'));}
assert(fs.readFileSync('components/offline-packs.tsx','utf8').includes('downloading?<ThinkingOrb/>:state?.complete?'));
console.log(JSON.stringify({preset:'upstream 20px working',monochrome:'passed',dprCap:2,reducedMotion:'static',offscreenAndHidden:'paused',cleanupAndRepeatedMount:'passed',serverRender:'passed',networkAndFakeDelay:'none',license:'retained'}));

const bundles=fs.readdirSync('dist/assets').filter(f=>f.endsWith('.js')).map(f=>fs.readFileSync('dist/assets/'+f,'utf8'));assert(bundles.some(s=>s.includes('Copyright (c) 2026 Jakub Antalik')&&s.includes('Permission is hereby granted')),'Distributed JS retains the full MIT notice');
