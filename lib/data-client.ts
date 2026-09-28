import rawManifest from '../data/runtime-manifest.json' with {type:'json'};
import type {DataFile,DataManifest,Law,Ruling,RulingCounts} from './law-types.ts';
import {candidates,type InvertedIndex,type IndexRow} from './inverted.ts';
import {searchLaws,searchRulings,type SearchDoc,type SearchHit} from './search.ts';
declare global {interface Window {OPENLAWTW_PAGE_LAW?:Law}}
export const manifest=rawManifest as DataManifest;
const pending=new Map<string,Promise<unknown>>(),memory=new Map<string,unknown>();
const aborted=(signal?:AbortSignal)=>{if(signal?.aborted)throw new DOMException('Aborted','AbortError');};
function consume<T>(promise:Promise<T>,signal?:AbortSignal):Promise<T>{if(!signal)return promise;aborted(signal);return new Promise((resolve,reject)=>{const cancel=()=>reject(new DOMException('Aborted','AbortError'));signal.addEventListener('abort',cancel,{once:true});promise.then(v=>{signal.removeEventListener('abort',cancel);if(!signal.aborted)resolve(v);},e=>{signal.removeEventListener('abort',cancel);reject(e);});});}
export async function loadFile<T>(file:DataFile,signal?:AbortSignal):Promise<T>{
 aborted(signal);if(!file)throw Error('本版沒有這份資料');
 const embedded=window.OPENLAWTW_OFFLINE?.[file.url];if(embedded!==undefined)return embedded as T;
 if(memory.has(file.url)){const value=memory.get(file.url);memory.delete(file.url);memory.set(file.url,value);return value as T;}
 let request=pending.get(file.url);if(!request){request=(async()=>{const response=await fetch(file.url);if(!response.ok)throw Error('資料尚未下載或目前無法連線');const bytes=await response.arrayBuffer();if(globalThis.crypto?.subtle){const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');if(hash!==file.sha256)throw Error('資料版本不一致，請重新檢查更新');}const text=file.encoding==='gzip'?await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text():new TextDecoder().decode(bytes);const value=JSON.parse(text);memory.set(file.url,value);while(memory.size>160)memory.delete(memory.keys().next().value!);return value;})().catch(error=>{console.warn('openlawtw 資料載入失敗',file.url,String(error));throw error;}).finally(()=>pending.delete(file.url));pending.set(file.url,request);}
 return consume(request as Promise<T>,signal);
}
export const loadLaw=(id:string,signal?:AbortSignal)=>{aborted(signal);return window.OPENLAWTW_PAGE_LAW?.id===id?Promise.resolve(window.OPENLAWTW_PAGE_LAW):loadFile<Law>(manifest.laws[id],signal);};
export const loadRulingCounts=(signal?:AbortSignal)=>loadFile<RulingCounts>(manifest.rulingCounts,signal);
export async function loadRelated(id:string,signal?:AbortSignal){return manifest.related[id]?loadFile<Ruling[]>(manifest.related[id],signal):[];}
export const loadHeads=(signal?:AbortSignal)=>loadFile<Ruling[]>(manifest.rulingHeads,signal);
export async function loadRuling(id:string,signal?:AbortSignal){const bucket=manifest.rulings[String(Math.floor(Number(id)/256))];const list=await loadFile<Ruling[]>(bucket,signal);const result=list.find(r=>r.id===id);if(!result)throw Error('本版找不到此函釋');return result;}
export async function mapLimit<T,R>(items:T[],fn:(value:T)=>Promise<R>,signal?:AbortSignal):Promise<PromiseSettledResult<R>[]>{let cursor=0;const out:PromiseSettledResult<R>[]=[];await Promise.all(Array.from({length:Math.min(6,items.length)},async()=>{while(cursor<items.length){aborted(signal);const i=cursor++;try{out[i]={status:'fulfilled',value:await fn(items[i])};}catch(reason){aborted(signal);out[i]={status:'rejected',reason};}}}));return out;}
export type IndexedResults={base:SearchHit[];articles:SearchHit[];rulings:Ruling[];missing:number;candidates:number};
async function candidateRows(query:string,kind:'laws'|'rulings',regions:Set<string>,signal?:AbortSignal){const indices=manifest.indexes.filter(i=>i.kind===kind&&(kind==='rulings'||regions.has(i.region)));const found=await mapLimit(indices,async i=>candidates(await loadFile<InvertedIndex>(i.file,signal),query),signal);return {rows:found.flatMap(r=>r.status==='fulfilled'?r.value:[]),missing:found.filter(r=>r.status==='rejected').length};}
export async function indexedRulings(query:string,signal?:AbortSignal):Promise<{items:Ruling[];missing:number;candidates:number}>{if(!query.trim())return {items:[],missing:0,candidates:0};const found=await candidateRows(query,'rulings',new Set(),signal);const ids=new Set(found.rows.map(r=>r.id));const buckets=[...new Set([...ids].map(id=>String(Math.floor(Number(id)/256))))];const loaded=await mapLimit(buckets,key=>loadFile<Ruling[]>(manifest.rulings[key],signal),signal);aborted(signal);const records=loaded.flatMap(r=>r.status==='fulfilled'?r.value.filter(r=>ids.has(r.id)):[]);return {items:searchRulings(records,query),missing:found.missing+loaded.filter(r=>r.status==='rejected').length,candidates:ids.size};}
export async function indexedSearch(laws:Law[],query:string,includeRulings=true,signal?:AbortSignal):Promise<IndexedResults>{
 if(!query.trim())return {base:[],articles:[],rulings:[],missing:0,candidates:0};
 const [found,rulingResult]=await Promise.all([candidateRows(query,'laws',new Set(laws.map(l=>l.region)),signal),includeRulings?indexedRulings(query,signal):Promise.resolve({items:[],missing:0,candidates:0})]);
 const allowed=new Set(laws.map(l=>l.id)),byLaw=new Map<string,Set<string>>();for(const row of found.rows){if(!allowed.has(row.id)||!row.no)continue;let set=byLaw.get(row.id);if(!set)byLaw.set(row.id,set=new Set());set.add(row.no);}
 const loaded=await mapLimit([...byLaw],async([id,nos])=>{const law=await loadLaw(id,signal);return {id,articles:law.articles.filter(a=>nos.has(a.no))};},signal);aborted(signal);
 const corpus:SearchDoc[]=loaded.flatMap(r=>r.status==='fulfilled'?[r.value]:[]);
 // The existing exact matcher/ranker verifies candidates, so grams never create false positives.
 return {base:searchLaws(laws,corpus,query),articles:searchLaws(laws,corpus,query,true),rulings:rulingResult.items,missing:found.missing+rulingResult.missing+loaded.filter(r=>r.status==='rejected').length,candidates:found.rows.length+rulingResult.candidates};
}
