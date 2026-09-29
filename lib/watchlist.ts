import {safeEvidenceURL,type CaseEvidence} from './casebook.ts';
import {lawHref} from './routes.ts';

export const WATCH_KEY='openlawtw-watch-v1';
export const WATCH_MAX_BYTES=4*1024*1024;
export const WATCH_QUOTE_LIMIT=24_000;
export type WatchSnapshot={title:string;quote:string;truncated:boolean;contentHash:string;sourceHash:string|null;observedAt:string|null;officialDate:string|null;sourceURL:string;href:string};
export type WatchStore={schemaVersion:1;baselines:Record<string,WatchSnapshot>;seen:Record<string,string>};
export type WatchTarget={key:string;label:string;baseline?:WatchSnapshot;resolve:()=>Promise<WatchSnapshot|null>};
export type WatchResult={key:string;label:string;before:WatchSnapshot|null;current:WatchSnapshot|null;status:'baseline'|'same'|'changed'|'source-changed'|'unavailable'};
export const emptyWatchStore=():WatchStore=>({schemaVersion:1,baselines:{},seen:{}});
const hash=(s:unknown):s is string=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
export function watchFingerprint(s:WatchSnapshot){return s.contentHash+':'+(s.sourceHash||'');}
export function evidenceWatchSnapshot(e:CaseEvidence):WatchSnapshot{
 const l=e.locator;
 return {title:e.title,quote:e.quote.slice(0,WATCH_QUOTE_LIMIT),truncated:e.quote.length>WATCH_QUOTE_LIMIT,contentHash:e.contentHash,sourceHash:e.sourceHash,observedAt:e.observedAt,officialDate:e.officialModifiedAt,sourceURL:e.sourceURL,href:l.lawId?lawHref(l.lawId,l.articleNo,l.unitId,l.page):l.rulingId?'/?#ruling='+encodeURIComponent(l.rulingId):''};
}
export function parseWatchStore(raw:string|null):WatchStore{
 if(raw===null)return emptyWatchStore();
 if(new TextEncoder().encode(raw).length>WATCH_MAX_BYTES)throw Error('關注紀錄超過容量限制。');
 const value=JSON.parse(raw);
 if(value?.schemaVersion!==1||!value.baselines||Array.isArray(value.baselines)||typeof value.baselines!=='object'||!value.seen||Array.isArray(value.seen)||typeof value.seen!=='object')throw Error('關注紀錄格式無法辨識。');
 if(Object.keys(value.baselines).length>3000||Object.keys(value.seen).length>4000)throw Error('關注紀錄數量異常。');
 for(const [key,s] of Object.entries(value.baselines) as [string,WatchSnapshot][]){
  if(!/^(law|ruling):.{1,200}$/.test(key)||!s||typeof s.title!=='string'||s.title.length>2500||typeof s.quote!=='string'||s.quote.length>WATCH_QUOTE_LIMIT||typeof s.truncated!=='boolean'||!hash(s.contentHash)||(s.sourceHash!==null&&!hash(s.sourceHash))||!safeEvidenceURL(s.sourceURL)||typeof s.href!=='string'||!/^\/(?:laws\/[^/?#]+\.html(?:#[^\s]*)?|\?#ruling=\d+)$/.test(s.href)||![s.observedAt,s.officialDate].every(v=>v===null||(typeof v==='string'&&v.length<160)))throw Error('關注基準資料不完整。');
 }
 for(const [key,v] of Object.entries(value.seen)){if(!key||key.length>500||typeof v!=='string'||!/^([a-f0-9]{64}):([a-f0-9]{64})?$/.test(v))throw Error('已讀紀錄格式不正確。');}
 return value as WatchStore;
}
export function writeWatchStore(storage:Pick<Storage,'getItem'|'setItem'>,next:WatchStore,previous:string|null){
 const text=JSON.stringify(next);parseWatchStore(text);
 if(storage.getItem(WATCH_KEY)!==previous)throw Error('另一個分頁更新了關注紀錄，請重新核對。');
 storage.setItem(WATCH_KEY,text);return text;
}
export function compareWatch(key:string,label:string,before:WatchSnapshot|null,current:WatchSnapshot|null):WatchResult{
 const status=!current?'unavailable':!before?'baseline':before.contentHash!==current.contentHash?'changed':before.sourceHash&&current.sourceHash&&before.sourceHash!==current.sourceHash?'source-changed':'same';
 return {key,label,before,current,status};
}
export function isUnreadChange(row:WatchResult,store:WatchStore){return !!row.current&&['changed','source-changed'].includes(row.status)&&store.seen[row.key]!==watchFingerprint(row.current);}
