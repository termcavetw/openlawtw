import {useEffect,useMemo,useState} from 'react';
import {StaleBadge,StaleList} from './stale-note';
import {type Flags,useFlags} from '@/lib/stale';
import {ArrowLeft,ArrowUpRight,ChevronDown,FileText,Info,Search,X} from 'lucide-react';
import {toast} from 'sonner';
import {loadLand,manifest} from '@/lib/data-client';
import type {LandArchive,LandItem} from '@/lib/law-types';
import {keywords,strip} from '@/lib/minutes-search';
import {agriSnippet,rocDay} from './agri';
const isPortable=()=>location.protocol==='file:';
const setHash=(hash:string)=>{try{window.history.replaceState(null,'',(isPortable()?'':location.pathname+location.search)+hash);}catch{}};
export const landHash=(id:string)=>'#land='+encodeURIComponent(id);
export const readLandHash=(hash:string)=>{const v=new URLSearchParams(hash.replace(/^#/,'')).get('land');return v&&/^[0-9a-f]{12}$/.test(v)?v:null;};
export type LandHit={item:LandItem;score:number};
const refText=(item:LandItem)=>item.refs.map(r=>r.law+r.article).join('');
export function searchLand(items:LandItem[],words:string[]):LandHit[]{
 if(!words.length)return [];const hits:LandHit[]=[];
 for(const item of items){const head=strip(item.summary+item.docNo+item.issuer+refText(item));const all=head+strip(item.body);if(!words.every(w=>all.includes(w)))continue;hits.push({item,score:words.filter(w=>head.includes(w)).length});}
 return hits.sort((a,b)=>b.score-a.score||b.item.date.localeCompare(a.item.date)||b.item.id.localeCompare(a.item.id));
}
export const landCite=(item:LandItem)=>item.date?`${item.issuer} ${rocDay(item.date)} ${item.docNo}`.trim():item.issuer;
const refLabel=(r:{law:string;article:string})=>r.law+' '+r.article.replace(/\s+/g,'');

function Notice({archive}:{archive:LandArchive}){
 return <div className="minutes-notice"><Info size={15}/><p><strong>內政部地政司「地政法令彙編」依條文歸類的解釋函，也收有行政院、法務部、財政部等與地政有關的函。</strong>彙編由地政司整理，部分內容有刪節或附註；之後的法規修正或較新的函釋可能改變見解，個案仍以主管機關認定為準。<small>資料版本：{archive.fetchedAt} 匯出</small></p></div>;
}
function Meta({item,stale}:{item:LandItem;stale?:Flags|null}){
 return <div className="minutes-meta"><StaleBadge id={item.id} flags={stale}/><span>{item.issuer} {rocDay(item.date)}</span>{item.docNo&&<span>{item.docNo}</span>}{item.refs.slice(0,2).map(r=><span key={r.law+r.article}>{refLabel(r)}</span>)}</div>;
}
function LandReader({item,onBack,stale,onOpen}:{item:LandItem;onBack:()=>void;stale:Flags|null;onOpen:(id:string)=>void}){
 useEffect(()=>{setHash(landHash(item.id));document.querySelector('.minutes-reader')?.scrollTo({top:0});},[item.id]);
 const cite=landCite(item);
 return <div className="minutes-reader">
  <button className="ruling-back" onClick={onBack}><ArrowLeft size={14}/><span>地政司函釋列表</span></button>
  <h3>{item.summary||cite}</h3>
  <Meta item={item} stale={stale}/>
  <StaleList id={item.id} date={item.date} flags={stale} onOpen={onOpen}/>
  <div className="minutes-pagebar"><span>{cite}</span><button className="minutes-copy" onClick={()=>navigator.clipboard?.writeText(cite+'\n'+location.href).then(()=>toast.success('已複製字號與連結'),()=>toast.error('無法複製'))}>複製字號</button><a href="https://www.land.moi.gov.tw/law/Explainqry/99" target="_blank" rel="noreferrer">地政法令彙編<ArrowUpRight size={13}/></a></div>
  <div className="landuse-files"><span>彙編歸類的條文：</span>{item.refs.map(r=><span key={r.law+r.article}>{refLabel(r)}</span>)}</div>
  <div className="minutes-text">{item.body||item.summary}</div>
 </div>;
}
export function LandExplorer(){
 const [archive,setArchive]=useState<LandArchive|null>(null),[error,setError]=useState(false),[retry,setRetry]=useState(0);
 const [q,setQ]=useState(''),[query,setQuery]=useState(''),[composing,setComposing]=useState(false);
 const [law,setLaw]=useState('all'),[limit,setLimit]=useState(30);
 const [open,setOpen]=useState<string|null>(()=>readLandHash(location.hash));
 const stale=useFlags(manifest.landRefs);
 useEffect(()=>{if(!manifest.land){setError(true);return;}let live=true;setError(false);loadLand().then(a=>{if(live)setArchive(a);}).catch(()=>{if(live)setError(true);});return()=>{live=false;};},[retry]);
 useEffect(()=>{if(composing)return;const t=setTimeout(()=>setQuery(q),200);return()=>clearTimeout(t);},[q,composing]);
 useEffect(()=>setLimit(30),[query,law]);
 const words=useMemo(()=>keywords(query),[query]);
 const pool=useMemo(()=>archive?archive.items.filter(i=>law==='all'||i.refs.some(r=>r.law===law)):[],[archive,law]);
 const rows=useMemo(()=>words.length?searchLand(pool,words):pool.map(item=>({item,score:0})),[pool,words]);
 if(archive&&open){const item=archive.items.find(i=>i.id===open);if(item)return <div className="minutes-explorer"><LandReader item={item} stale={stale} onOpen={id=>setOpen(id)} onBack={()=>{setOpen(null);setHash('');}}/></div>;}
 return <div className="minutes-explorer">
  <div className="section-top"><div><div className="eyebrow">DEPARTMENT OF LAND ADMINISTRATION</div><h2>內政部地政司函釋</h2><p>土地法、土地登記規則、平均地權條例、地籍測量、非都市土地使用管制、耕地分割等解釋函。</p></div></div>
  {archive&&<><div className="ruling-overview"><strong>{archive.stats.items.toLocaleString()}</strong><span>則解釋函<br/><small>{archive.stats.laws.length} 部法規 · 來源：內政部地政司地政法令彙編</small></span></div><Notice archive={archive}/></>}
  <label className="ruling-search"><Search size={16}/><input value={q} onCompositionStart={()=>setComposing(true)} onCompositionEnd={e=>{setComposing(false);setQ(e.currentTarget.value);}} onChange={e=>setQ(e.target.value)} placeholder="如：耕地分割、共有、法定空地分割、繼承登記" aria-label="搜尋地政司函釋"/>{q&&<button aria-label="清除搜尋" onClick={()=>setQ('')}><X size={14}/></button>}</label>
  <div className="ruling-filters">
   <select value={law} onChange={e=>setLaw(e.target.value)} aria-label="法規"><option value="all">全部法規</option>{archive?.stats.laws.map(l=><option key={l.name} value={l.name}>{l.name}（{l.items}）</option>)}</select>
  </div>
  <div className="ruling-result-count" role="status">{error?'地政司函釋尚未下載，請連線後重試':!archive?'正在載入地政司函釋…':words.length?`${rows.length.toLocaleString()} 則符合`:`${rows.length.toLocaleString()} 則（依發文日期新到舊）`}</div>
  {error&&<button className="plain-button" onClick={()=>setRetry(n=>n+1)}>重新載入</button>}
  {rows.slice(0,limit).map(({item})=><button className="minutes-card" key={item.id} onClick={()=>setOpen(item.id)}><h3>{item.summary||landCite(item)}</h3><Meta item={item} stale={stale}/>{words.length>0&&<p>{agriSnippet(item.body,words)}</p>}</button>)}
  {archive&&!error&&!rows.length&&<div className="empty-state"><FileText size={26}/><strong>沒有符合的函釋</strong><span>試試較短或同義的字詞，或改選「全部法規」。</span></div>}
  {rows.length>limit&&<button className="load-more" onClick={()=>setLimit(n=>n+30)}>更多函釋<small>{limit} / {rows.length}</small><ChevronDown size={14}/></button>}
  <a className="plain-button" href="https://www.land.moi.gov.tw/law/Explainqry/99" target="_blank" rel="noreferrer">內政部地政司 地政法令彙編（原始資料）<ArrowUpRight size={14}/></a>
 </div>;
}
