import {useEffect,useMemo,useState} from 'react';
import {StaleBadge,StaleList} from './stale-note';
import {type Stale,useStale} from '@/lib/stale';
import {ArrowLeft,ArrowUpRight,ChevronDown,FileText,Info,Search,X} from 'lucide-react';
import {toast} from 'sonner';
import {loadTaipei,manifest} from '@/lib/data-client';
import type {TaipeiArchive,TaipeiItem} from '@/lib/law-types';
import {keywords,strip} from '@/lib/minutes-search';
import {agriSnippet,rocDay} from './agri';
const isPortable=()=>location.protocol==='file:';
const setHash=(hash:string)=>{try{window.history.replaceState(null,'',(isPortable()?'':location.pathname+location.search)+hash);}catch{}};
export const taipeiHash=(id:string)=>'#taipei='+encodeURIComponent(id);
export const readTaipeiHash=(hash:string)=>{const v=new URLSearchParams(hash.replace(/^#/,'')).get('taipei');return v&&/^\w{2,20}$/.test(v)?v:null;};
export type TaipeiHit={item:TaipeiItem;score:number};
const refText=(item:TaipeiItem)=>item.refs.map(r=>r.law+r.articles.join('')).join('');
export function searchTaipei(items:TaipeiItem[],words:string[]):TaipeiHit[]{
 if(!words.length)return [];const hits:TaipeiHit[]=[];
 for(const item of items){const head=strip(item.summary+item.docNo+item.issuer+refText(item));const all=head+strip(item.body);if(!words.every(w=>all.includes(w)))continue;hits.push({item,score:words.filter(w=>head.includes(w)).length});}
 return hits.sort((a,b)=>b.score-a.score||b.item.date.localeCompare(a.item.date)||b.item.id.localeCompare(a.item.id));
}
export const taipeiCite=(item:TaipeiItem)=>`${item.issuer} ${rocDay(item.date)} ${item.docNo}`.trim();

function Notice({archive}:{archive:TaipeiArchive}){
 return <div className="minutes-notice"><Info size={15}/><p><strong>臺北市政府（都市發展局、建築管理工程處、法務局等）的解釋令函，只適用臺北市的案子。</strong>與條文或國土署函釋不一致時，以條文與中央函釋為準。多數是針對個案的回覆，引用時請讀全文、注意當時的法規版本，並確認之後有無新的函釋或修法。<small>資料更新：{archive.fetchedAt}</small></p></div>;
}
function Meta({item,stale}:{item:TaipeiItem;stale?:Stale|null}){
 return <div className="minutes-meta"><StaleBadge id={item.id} stale={stale}/><span>{item.category}</span><span>{item.issuer} {rocDay(item.date)}</span><span>{item.docNo}</span>{item.refs.slice(0,2).map(r=><span key={r.law}>{r.law}{r.articles.length?' '+r.articles.slice(0,3).join('、'):''}</span>)}</div>;
}
function TaipeiReader({item,onBack,stale}:{item:TaipeiItem;onBack:()=>void;stale:Stale|null}){
 useEffect(()=>{setHash(taipeiHash(item.id));document.querySelector('.minutes-reader')?.scrollTo({top:0});},[item.id]);
 const cite=taipeiCite(item);
 return <div className="minutes-reader">
  <button className="ruling-back" onClick={onBack}><ArrowLeft size={14}/><span>臺北市函釋列表</span></button>
  <h3>{item.summary||cite}</h3>
  <Meta item={item} stale={stale}/>
  <StaleList id={item.id} date={item.date} stale={stale}/>
  <div className="minutes-pagebar"><span>{cite}</span><button className="minutes-copy" onClick={()=>navigator.clipboard?.writeText(cite+'\n'+location.href).then(()=>toast.success('已複製字號與連結'),()=>toast.error('無法複製'))}>複製字號</button><a href={item.url} target="_blank" rel="noreferrer">官方原文<ArrowUpRight size={13}/></a></div>
  {item.refs.length>0&&<div className="landuse-files"><span>市府歸類的相關法條：</span>{item.refs.map(r=><span key={r.scope+r.law}>{r.law}{r.articles.length?' '+r.articles.join('、'):''}</span>)}</div>}
  <div className="minutes-text">{item.body||item.summary}</div>
 </div>;
}
export function TaipeiExplorer(){
 const [archive,setArchive]=useState<TaipeiArchive|null>(null),[error,setError]=useState(false),[retry,setRetry]=useState(0);
 const [q,setQ]=useState(''),[query,setQuery]=useState(''),[composing,setComposing]=useState(false);
 const [cat,setCat]=useState('all'),[limit,setLimit]=useState(30);
 const [open,setOpen]=useState<string|null>(()=>readTaipeiHash(location.hash));
 const stale=useStale(manifest.taipeiRefs);
 useEffect(()=>{if(!manifest.taipei){setError(true);return;}let live=true;setError(false);loadTaipei().then(a=>{if(live)setArchive(a);}).catch(()=>{if(live)setError(true);});return()=>{live=false;};},[retry]);
 useEffect(()=>{if(composing)return;const t=setTimeout(()=>setQuery(q),200);return()=>clearTimeout(t);},[q,composing]);
 useEffect(()=>setLimit(30),[query,cat]);
 const words=useMemo(()=>keywords(query),[query]);
 const pool=useMemo(()=>archive?archive.items.filter(i=>cat==='all'||i.category===cat):[],[archive,cat]);
 const rows=useMemo(()=>words.length?searchTaipei(pool,words):pool.map(item=>({item,score:0})),[pool,words]);
 if(archive&&open){const item=archive.items.find(i=>i.id===open);if(item)return <div className="minutes-explorer"><TaipeiReader item={item} stale={stale} onBack={()=>{setOpen(null);setHash('');}}/></div>;}
 return <div className="minutes-explorer">
  <div className="section-top"><div><div className="eyebrow">TAIPEI CITY</div><h2>臺北市解釋令函</h2><p>臺北市法規查詢系統「都市發展類」「工務類」的解釋令函：建管、都市計畫、都市設計、騎樓、公設保留地等。</p></div></div>
  {archive&&<><div className="ruling-overview"><strong>{archive.stats.items.toLocaleString()}</strong><span>則解釋令函<br/><small>{archive.stats.categories.map(c=>c.name+' '+c.items).join(' · ')} · 來源：臺北市政府法務局</small></span></div><Notice archive={archive}/></>}
  <label className="ruling-search"><Search size={16}/><input value={q} onCompositionStart={()=>setComposing(true)} onCompositionEnd={e=>{setComposing(false);setQ(e.currentTarget.value);}} onChange={e=>setQ(e.target.value)} placeholder="如：騎樓、人工地盤、公共設施保留地、防火門" aria-label="搜尋臺北市解釋令函"/>{q&&<button aria-label="清除搜尋" onClick={()=>setQ('')}><X size={14}/></button>}</label>
  <div className="ruling-filters">
   <select value={cat} onChange={e=>setCat(e.target.value)} aria-label="類別"><option value="all">全部類別</option>{archive?.stats.categories.map(c=><option key={c.name} value={c.name}>{c.name}（{c.items}）</option>)}</select>
  </div>
  <div className="ruling-result-count" role="status">{error?'臺北市函釋尚未下載，請連線後重試':!archive?'正在載入臺北市函釋…':words.length?`${rows.length.toLocaleString()} 則符合`:`${rows.length.toLocaleString()} 則（依發文日期新到舊）`}</div>
  {error&&<button className="plain-button" onClick={()=>setRetry(n=>n+1)}>重新載入</button>}
  {rows.slice(0,limit).map(({item})=><button className="minutes-card" key={item.id} onClick={()=>setOpen(item.id)}><h3>{item.summary||taipeiCite(item)}</h3><Meta item={item} stale={stale}/>{words.length>0&&<p>{agriSnippet(item.body,words)}</p>}</button>)}
  {archive&&!error&&!rows.length&&<div className="empty-state"><FileText size={26}/><strong>沒有符合的函釋</strong><span>試試較短或同義的字詞，或改選「全部類別」。</span></div>}
  {rows.length>limit&&<button className="load-more" onClick={()=>setLimit(n=>n+30)}>更多函釋<small>{limit} / {rows.length}</small><ChevronDown size={14}/></button>}
  <a className="plain-button" href="https://laws.gov.taipei/law/Interpretation" target="_blank" rel="noreferrer">臺北市法規查詢系統 解釋令函（原始資料）<ArrowUpRight size={14}/></a>
 </div>;
}
