import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {rulingPreviewText} from '../lib/ruling-preview.ts';
import {loadRuling} from '../lib/data-client.ts';

const root=new URL('../',import.meta.url),read=path=>readFileSync(new URL(path,root),'utf8');
const ruling={id:'preview-test',title:'測試主旨',body:'一、原文說明。\n\n二、另一段解釋。',number:'測試字第123號',date:'2026-09-30',published:'2026-09-30',modified:'',unit:'測試機關',topic:'測試主題',numberKey:'123',url:'https://example.com/official',refs:[],status:'unchecked',attachments:[],citations:[]};
assert.equal(rulingPreviewText(ruling),'一、原文說明。 二、另一段解釋。');
assert.equal(rulingPreviewText({...ruling,body:'測試主旨\n\n一、說明本文。'}),'一、說明本文。');
assert.equal(rulingPreviewText({...ruling,body:'主旨： 測試主旨\n\n說明：仍為官方文字。'}),'說明：仍為官方文字。');
assert.equal(rulingPreviewText({...ruling,body:'主旨:測試主旨'}),'');
assert.equal(rulingPreviewText({...ruling,body:'測試主旨中所提事項另依規定辦理。'}),'測試主旨中所提事項另依規定辦理。','Do not remove a subject that is merely a prefix of substantive text');
assert.equal(rulingPreviewText({...ruling,body:' \n '}),'');
assert.equal(rulingPreviewText({...ruling,body:'甲😀乙丙丁'},3),'甲😀乙…','Truncation never splits a Unicode character');
assert.equal(rulingPreviewText({...ruling,body:'短文。'},220),'短文。');

// Render the actual shared card, not a reimplemented fixture. TSX is compiled
// in memory only; no test dependency or browser bundle is added to the app.
function compileComponent(path,dependencies){
 let code=ts.transpileModule(read(path),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 code=code.replace(/^import ["'][^"']+\.css["'];?$/gm,'');
 code=code.replace(/from (["'])([^"']+)\1/g,(_,quote,specifier)=>{
  const url=dependencies[specifier]||(specifier.startsWith('@/')?new URL(specifier.slice(2)+'.ts',root).href:import.meta.resolve(specifier));
  return 'from '+JSON.stringify(url);
 });
 return 'data:text/javascript;base64,'+Buffer.from(code).toString('base64');
}
const previewURL=compileComponent('components/ruling-preview.tsx',{});
const {RulingCard}=await import(compileComponent('components/ruling-card.tsx',{'./ruling-preview':previewURL}));
const render=value=>renderToStaticMarkup(createElement(RulingCard,{ruling:value,onClick:()=>{}}));
const full=render(ruling);
assert(full.includes('解釋內容節錄')&&full.includes('一、原文說明。 二、另一段解釋。'));
assert(full.includes('測試主旨')&&full.includes('測試字第123號')&&full.includes('2026-09-30'));
assert(full.includes('data-preview-state="ready"'));
assert.equal((full.match(/<button/g)||[]).length,1,'A card stays one native button without nested interactive controls');
assert(render({...ruling,body:'',summaryOnly:true}).includes('data-preview-state="loading"'),'Index-only records are not falsely described as missing body');
assert(render({...ruling,body:''}).includes('本筆未收錄主旨以外的解釋本文'));
assert(render({...ruling,body:ruling.title}).includes('data-preview-state="empty"'));
const unsafe=render({...ruling,body:'<img src=x onerror=alert(1)> & 原文'});
assert(unsafe.includes('&lt;img')&&!unsafe.includes('<img'),'Excerpts render as escaped React text');

const corpus=JSON.parse(read('public/data/rulings.json')).items;
let bodyCount=0,previewCount=0;
for(const item of corpus){
 const snapshot=JSON.stringify(item),text=rulingPreviewText(item),normalized=item.body.replace(/\s+/gu,' ').trim();
 if(item.body.trim())bodyCount++;
 if(text){previewCount++;assert(normalized.includes(text.endsWith('…')?text.slice(0,-1):text),item.id+' preview remains a contiguous original-text excerpt');}
 assert(Array.from(text).length<=221,item.id+' bounded preview length');
 assert.equal(JSON.stringify(item),snapshot,item.id+' source is unchanged');
}
// Exercise the same bucket cache used by visible cards and full-reader opens.
const originalFetch=globalThis.fetch,originalWindow=globalThis.window;
let calls=0,release;const gate=new Promise(resolve=>{release=resolve;});
globalThis.window={};globalThis.fetch=async path=>{calls++;await gate;return new Response(readFileSync(new URL('public'+path,root)));};
try{
 const first=corpus[0],other=corpus.find(r=>r.id!==first.id&&Math.floor(Number(r.id)/256)===Math.floor(Number(first.id)/256));
 assert(other);
 const controller=new AbortController(),cancelled=loadRuling(first.id,controller.signal),rejection=assert.rejects(cancelled,{name:'AbortError'}),shared=loadRuling(other.id);
 controller.abort();release();const loaded=await shared;await rejection;
 assert.equal(loaded.body,other.body);assert.equal(calls,1,'Unmounted card does not cancel another visible card sharing its bucket');
 assert.equal((await loadRuling(first.id)).body,first.body);assert.equal(calls,1,'Repeated navigation reuses the cached full bucket');
 const aborted=new AbortController();aborted.abort();await assert.rejects(loadRuling(first.id,aborted.signal),{name:'AbortError'});assert.equal(calls,1,'An already-aborted card makes no request');
 const fresh=corpus.find(r=>Math.floor(Number(r.id)/256)!==Math.floor(Number(first.id)/256));let fail=true;
 globalThis.fetch=async path=>{calls++;if(fail){fail=false;return new Response('',{status:503});}return new Response(readFileSync(new URL('public'+path,root)));};
 await assert.rejects(loadRuling(fresh.id),/無法連線/);assert.equal((await loadRuling(fresh.id)).body,fresh.body,'A failed preview can be retried by opening the ruling');
 assert.equal(calls,3,'Failed requests are not kept in the shared pending cache');
}finally{globalThis.fetch=originalFetch;globalThis.window=originalWindow;}
const component=read('components/ruling-preview.tsx'),css=read('components/ruling-preview.css');
assert(component.includes('IntersectionObserver')&&component.includes('entry.isIntersecting')&&component.includes('observer.disconnect()'),'Preview loading is gated by list visibility');
assert(component.includes('controller.abort()')&&component.includes('controller.signal.aborted'),'Unmount and newer navigation discard stale loads');
assert(component.includes('loadRuling(ruling.id,controller.signal)'),'Use existing integrity-checked cached loader');
assert(!component.includes('dangerouslySetInnerHTML')&&!component.includes('loadHeads('),'Do not inject HTML or preload the corpus');
assert(css.includes('-webkit-line-clamp:3')&&css.includes('font-size:14px'),'Three-line clamp and mobile-readable text');

// Run the actual page handler with deterministic timer/data adapters. This
// verifies its lifecycle without claiming a browser/Sonner visual test.
const pageSource=ts.createSourceFile('page.tsx',read('app/page.tsx'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let openHandler;function findHandler(node){if(ts.isFunctionDeclaration(node)&&node.name?.text==='openRuling')openHandler=node;ts.forEachChild(node,findHandler);}findHandler(pageSource);assert(openHandler);
const handlerJS=ts.transpileModule(openHandler.getText(pageSource),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.trim();
function harness(loader){
 const timers=new Map(),events=[],selected=[],request={current:0};let timerId=0;
 const scope={ruling:null,rulingReturnURL:{current:''},isPortable:()=>false,location:{pathname:'/',search:'',hash:''},rulingRequest:request,query:'',drawerNavigation:false,remember:()=>{},setRulingHistory:()=>{},setRuling:value=>selected.push(value.id),setNavigationOpen:()=>{},applyPageMetadata:()=>{},loadRuling:loader,
  window:{setTimeout:(fn,delay)=>{assert.equal(delay,150);timers.set(++timerId,fn);return timerId;},clearTimeout:id=>timers.delete(id),history:{replaceState:()=>{}}},
  toast:{loading:(_,{id})=>events.push(['loading',id]),dismiss:id=>events.push(['dismiss',id]),error:()=>events.push(['error'])}};
 const open=Function(...Object.keys(scope),'return ('+handlerJS+');')(...Object.values(scope));
 return {open,timers,events,selected,request,fire:()=>{for(const fn of [...timers.values()])fn();}};
}
const direct=harness(()=>{throw Error('Full records must not refetch');});await direct.open(ruling);assert.deepEqual(direct.events,[]);assert.equal(direct.timers.size,0);
const quick=harness(async()=>ruling);await quick.open({...ruling,summaryOnly:true});assert.deepEqual(quick.events,[]);assert.equal(quick.timers.size,0,'Fast cached resolution clears the delayed loading timer');
let finish;const slow=harness(()=>new Promise(resolve=>{finish=resolve;})),slowRun=slow.open({...ruling,summaryOnly:true});slow.fire();finish(ruling);await slowRun;assert.deepEqual(slow.events,[['loading','ruling-load-1'],['dismiss','ruling-load-1']]);assert.equal(slow.timers.size,0);
let fail;const broken=harness(()=>new Promise((_,reject)=>{fail=reject;})),brokenRun=broken.open({...ruling,summaryOnly:true});broken.fire();fail(Error('offline'));await brokenRun;assert.deepEqual(broken.events,[['loading','ruling-load-1'],['error'],['dismiss','ruling-load-1']]);assert.equal(broken.timers.size,0);
const resolutions=[];const newer=harness(()=>new Promise(resolve=>resolutions.push(resolve))),oldRun=newer.open({...ruling,summaryOnly:true});newer.fire();const newRun=newer.open({...ruling,id:'newer',summaryOnly:true});newer.timers.get(2)();resolutions[0](ruling);await oldRun;assert.deepEqual(newer.selected,[],'An old navigation cannot replace the new selection');assert.deepEqual(newer.events.at(-1),['dismiss','ruling-load-1'],'Old request dismisses only its own toast');resolutions[1]({...ruling,id:'newer'});await newRun;assert.deepEqual(newer.selected,['newer']);assert.deepEqual(newer.events.at(-1),['dismiss','ruling-load-2']);assert.equal(newer.timers.size,0);
console.log(JSON.stringify({previewUnitCases:8,cardRenderScenarios:5,toastLifecycleScenarios:5,corpusRecords:corpus.length,bodyCount,previewCount,sourceFidelity:'passed',safeTextRendering:'passed',independentCancellation:'passed',sharedBucketCache:'passed',retryAfterFailure:'passed',lazyLoadSourceContract:'passed',browserInteraction:'not run by this script'}));
