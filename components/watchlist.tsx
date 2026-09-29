import {useEffect,useMemo,useRef,useState} from 'react';
import {Bell,Check,RefreshCw,ArrowUpRight} from 'lucide-react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from './ui/dialog';
import {useCasebook} from './casebook';
import {watchTargets} from '../lib/watch-current';
import {mapLimit} from '../lib/data-client';
import {data} from '../lib/catalog';
import {WATCH_KEY,parseWatchStore,emptyWatchStore,writeWatchStore,compareWatch,isUnreadChange,watchFingerprint,type WatchResult,type WatchStore} from '../lib/watchlist';
import {safeEvidenceURL} from '../lib/casebook';
import './reference-tools.css';

const labels={baseline:'已建立追蹤基準',same:'內容相同',changed:'文字已變動','source-changed':'原檔已變動',unavailable:'目前無法核對'};
export function WatchlistButton({laws,rulings,ready}:{laws:string[];rulings:string[];ready:boolean}){
 const cases=useCasebook(),[open,setOpen]=useState(false),[store,setStore]=useState<WatchStore>(emptyWatchStore),[rows,setRows]=useState<WatchResult[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[revision,setRevision]=useState(0),[showAll,setShowAll]=useState(false);
 const raw=useRef<string|null>(null),canWrite=useRef(false);
 const targets=useMemo(()=>watchTargets(laws,rulings,cases.book),[laws,rulings,cases.book]);
 useEffect(()=>{const changed=(event:StorageEvent)=>{if(event.key===WATCH_KEY||event.key===null)setRevision(n=>n+1);};window.addEventListener('storage',changed);return()=>window.removeEventListener('storage',changed);},[]);
 useEffect(()=>{
  if(!ready||!cases.ready)return;
  const controller=new AbortController();setBusy(true);setError('');canWrite.current=false;
  async function check(){
   let saved:WatchStore;
   try{raw.current=localStorage.getItem(WATCH_KEY);saved=parseWatchStore(raw.current);setStore(saved);canWrite.current=true;}catch(e){setError('原有關注紀錄已保留，未覆寫。'+String(e));setBusy(false);return;}
   const resolved=await mapLimit(targets,t=>t.resolve(),controller.signal);
   if(controller.signal.aborted)return;
   const next:WatchStore={schemaVersion:1,baselines:{},seen:{}};
   const results=targets.map((t,i)=>{
    const result=resolved[i],current=result.status==='fulfilled'?result.value:null,before=t.baseline||saved.baselines[t.key]||null;
    if(!t.baseline&&(before||current))next.baselines[t.key]=before||current!;
    if(saved.seen[t.key])next.seen[t.key]=saved.seen[t.key];
    return compareWatch(t.key,t.label,before,current);
   });
   setRows(results);
   try{raw.current=writeWatchStore(localStorage,next,raw.current);setStore(next);}catch(e){canWrite.current=false;setError('本次比對已顯示，但追蹤紀錄未能儲存。'+String(e));}
   setBusy(false);
  }
  void check().catch(e=>{if(!controller.signal.aborted){setError(String(e));setBusy(false);}});
  return()=>controller.abort();
 },[targets,ready,cases.ready,revision]);
 const unread=rows.filter(r=>isUnreadChange(r,store)).length,unavailable=rows.filter(r=>r.status==='unavailable').length;
 const visible=rows.filter(r=>showAll||isUnreadChange(r,store)||r.status==='unavailable');
 function acknowledge(row:WatchResult){if(!row.current||!canWrite.current)return;try{const next={...store,seen:{...store.seen,[row.key]:watchFingerprint(row.current)}};raw.current=writeWatchStore(localStorage,next,raw.current);setStore(next);}catch(e){setError(String(e));}}
 return <><button className="workspace-tools-button watch-trigger" aria-label={'關注異動'+(unread?'，'+unread+' 筆未讀':'')} onClick={()=>setOpen(true)}><Bell size={17}/><span>關注異動</span>{unread>0&&<b>{unread}</b>}</button>
  <Dialog open={open} onOpenChange={setOpen}><DialogContent className="work-tools-dialog reference-dialog"><DialogTitle>我關心的法規異動</DialogTitle><DialogDescription>收藏與案件引用的本庫版本比對；不代表官方即時修法通知或適用性判斷。</DialogDescription>
   <div className="watch-overview"><div><strong>{unread}</strong><span>筆未讀變動</span></div><div><strong>{rows.length}</strong><span>筆關注內容</span></div><div><strong>{unavailable}</strong><span>筆待核對</span></div></div>
   <p className="reference-note">本庫批次：{data.collected}。收藏以首次追蹤時建立的內容為基準；案件沿用保存時的引用。更新網站資料後，下次開啟會自動比對，案件原文與筆記不會被替換。</p>
   <div className="reference-controls"><label><input type="checkbox" checked={showAll} onChange={e=>setShowAll(e.target.checked)}/>顯示全部與已讀</label><button disabled={busy||!ready||!cases.ready} onClick={()=>setRevision(n=>n+1)}><RefreshCw size={14}/>{busy?'正在核對…':'重新核對本版'}</button></div>
   {(error||cases.error)&&<p role="alert" className="reference-error">{error||cases.error}</p>}
   {!ready||!cases.ready?<p role="status">儲存資料尚未就緒，暫停比對。</p>:busy?<p role="status">正在核對收藏與案件引用…</p>:!targets.length?<div className="reference-empty">先收藏法規、函釋，或把引用加入案件。之後的變動會集中顯示在這裡。</div>:!visible.length?<div className="reference-empty">目前沒有未讀變動。可勾選「顯示全部與已讀」查看已建立的追蹤基準。</div>:null}
   {!busy&&visible.map(row=>{const reference=row.current||row.before;return <article className="watch-row" key={row.key}><div className="watch-row-meta"><span>{row.label}</span><b className={'watch-status '+row.status}>{labels[row.status]}{row.current&&store.seen[row.key]===watchFingerprint(row.current)?' · 已讀':''}</b></div><h3>{reference?.title||row.key}</h3>
    {row.status==='unavailable'&&<p>本版未收錄、資料尚未下載，或目前無法載入；不能據此判定已廢止。</p>}
    {['changed','source-changed'].includes(row.status)&&<details><summary>查看前後原文與日期</summary><div className="watch-comparison">{[{label:'追蹤／保存時',value:row.before},{label:'本版收錄',value:row.current}].map(({label,value})=><section key={label}><h4>{label}</h4><small>來源修正／發布：{value?.officialDate||'未提供'}<br/>擷取：{value?.observedAt||'未提供'}</small><pre>{value?.quote||'此項為原始文件，請由原文入口核對 PDF／圖表。'}</pre>{value?.truncated&&<p>此處僅顯示前 24,000 字；變動判斷使用完整內容。</p>}</section>)}</div>{row.status==='source-changed'&&<p>原檔或所屬法規的來源指紋不同，保存的這段文字相同；圖表及附件請另行核對。</p>}</details>}
    <div className="reference-controls">{reference?.href&&<a href={reference.href}>閱讀目前版本<ArrowUpRight size={14}/></a>}{reference&&safeEvidenceURL(reference.sourceURL)&&<a href={reference.sourceURL} target="_blank" rel="noreferrer">官方來源<ArrowUpRight size={14}/></a>}{isUnreadChange(row,store)&&<button disabled={!canWrite.current} onClick={()=>acknowledge(row)}><Check size={14}/>標記已讀</button>}</div>
   </article>;})}
  </DialogContent></Dialog></>;
}
