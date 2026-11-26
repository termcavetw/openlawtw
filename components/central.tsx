import {useEffect,useMemo,useState} from 'react';
import {ArrowLeft,ArrowUpRight,ChevronDown,FileText,Info,Search,X} from 'lucide-react';
import {toast} from 'sonner';
import {loadCentral,manifest} from '@/lib/data-client';
import type {CentralArchive,CentralItem} from '@/lib/law-types';
import {keywords,strip} from '@/lib/minutes-search';
import {agriSnippet,rocDay} from './agri';
const isPortable=()=>location.protocol==='file:';
const setHash=(hash:string)=>{try{window.history.replaceState(null,'',(isPortable()?'':location.pathname+location.search)+hash);}catch{}};
export const centralHash=(id:string)=>'#central='+encodeURIComponent(id);
export const readCentralHash=(hash:string)=>{const v=new URLSearchParams(hash.replace(/^#/,'')).get('central');return v&&/^\w{2,20}$/.test(v)?v:null;};
export type CentralHit={item:CentralItem;score:number};
const refText=(item:CentralItem)=>item.filed.map(r=>r.law+r.article).join('');
export function searchCentral(items:CentralItem[],words:string[]):CentralHit[]{
 if(!words.length)return [];const hits:CentralHit[]=[];
 for(const item of items){const head=strip(item.summary+item.docNo+item.issuer+refText(item));const all=head+strip(item.body);if(!words.every(w=>all.includes(w)))continue;hits.push({item,score:words.filter(w=>head.includes(w)).length});}
 return hits.sort((a,b)=>b.score-a.score||b.item.date.localeCompare(a.item.date)||b.item.id.localeCompare(a.item.id));
}
export const centralCite=(item:CentralItem)=>`${item.issuer} ${rocDay(item.date)} ${item.docNo}`.trim();

function Notice({archive}:{archive:CentralArchive}){
 return <div className="minutes-notice"><Info size={15}/><p><strong>消防署、經濟部、農委會（農業部）、法務部等中央機關的解釋令函，依臺北市法規查詢系統歸在消防法、工廠管理輔導法、農業發展條例等條文下者收錄。</strong>只是臺北市法務局整理的部分，不是各部會的完整函釋；多為個案回覆，引用時請讀全文、注意發文時的法規版本，並確認之後有無新的函釋或修法。<small>資料更新：{archive.fetchedAt}</small></p></div>;
}
function Meta({item}:{item:CentralItem}){
 return <div className="minutes-meta"><span>{item.issuer} {rocDay(item.date)}</span><span>{item.docNo}</span>{item.filed.slice(0,2).map(r=><span key={r.law+r.article}>{r.law} {r.article.replace(/\s+/g,'')}</span>)}</div>;
}
function CentralReader({item,onBack}:{item:CentralItem;onBack:()=>void}){
 useEffect(()=>{setHash(centralHash(item.id));document.querySelector('.minutes-reader')?.scrollTo({top:0});},[item.id]);
 const cite=centralCite(item);
 return <div className="minutes-reader">
  <button className="ruling-back" onClick={onBack}><ArrowLeft size={14}/><span>部會函釋列表</span></button>
  <h3>{item.summary||cite}</h3>
  <Meta item={item}/>
  <div className="minutes-pagebar"><span>{cite}</span><button className="minutes-copy" onClick={()=>navigator.clipboard?.writeText(cite+'\n'+location.href).then(()=>toast.success('已複製字號與連結'),()=>toast.error('無法複製'))}>複製字號</button><a href={item.url} target="_blank" rel="noreferrer">官方原文<ArrowUpRight size={13}/></a></div>
  <div className="landuse-files"><span>歸類的條文：</span>{item.filed.map(r=><span key={r.law+r.article}>{r.law} {r.article.replace(/\s+/g,'')}</span>)}</div>
  <div className="minutes-text">{item.body||item.summary}</div>
 </div>;
}
export function CentralExplorer(){
 const [archive,setArchive]=useState<CentralArchive|null>(null),[error,setError]=useState(false),[retry,setRetry]=useState(0);
 const [q,setQ]=useState(''),[query,setQuery]=useState(''),[composing,setComposing]=useState(false);
 const [topic,setTopic]=useState('all'),[limit,setLimit]=useState(30);
 const [open,setOpen]=useState<string|null>(()=>readCentralHash(location.hash));
 useEffect(()=>{if(!manifest.central){setError(true);return;}let live=true;setError(false);loadCentral().then(a=>{if(live)setArchive(a);}).catch(()=>{if(live)setError(true);});return()=>{live=false;};},[retry]);
 useEffect(()=>{if(composing)return;const t=setTimeout(()=>setQuery(q),200);return()=>clearTimeout(t);},[q,composing]);
 useEffect(()=>setLimit(30),[query,topic]);
 const words=useMemo(()=>keywords(query),[query]);
 const lawTopic=useMemo(()=>new Map((archive?.laws||[]).map(l=>[l.name,l.topic])),[archive]);
 const pool=useMemo(()=>archive?archive.items.filter(i=>topic==='all'||i.filed.some(f=>lawTopic.get(f.law)===topic)):[],[archive,topic,lawTopic]);
 const rows=useMemo(()=>words.length?searchCentral(pool,words):pool.map(item=>({item,score:0})),[pool,words]);
 if(archive&&open){const item=archive.items.find(i=>i.id===open);if(item)return <div className="minutes-explorer"><CentralReader item={item} onBack={()=>{setOpen(null);setHash('');}}/></div>;}
 return <div className="minutes-explorer">
  <div className="section-top"><div><div className="eyebrow">CENTRAL AGENCIES</div><h2>消防署・經濟部・農業部等函釋</h2><p>消防法、工廠管理輔導法（含施行細則）、農業發展條例（含施行細則）、農業設施容許使用、農業使用證明等條文下的中央機關解釋令函。</p></div></div>
  {archive&&<><div className="ruling-overview"><strong>{archive.stats.items.toLocaleString()}</strong><span>則解釋令函<br/><small>{archive.stats.topics.map(c=>c.name+' '+c.items).join(' · ')} · 來源：臺北市法規查詢系統</small></span></div><Notice archive={archive}/></>}
  <label className="ruling-search"><Search size={16}/><input value={q} onCompositionStart={()=>setComposing(true)} onCompositionEnd={e=>{setComposing(false);setQ(e.currentTarget.value);}} onChange={e=>setQ(e.target.value)} placeholder="如：檢修申報、工廠登記、臨時工廠、農業設施、資材室" aria-label="搜尋部會函釋"/>{q&&<button aria-label="清除搜尋" onClick={()=>setQ('')}><X size={14}/></button>}</label>
  <div className="ruling-filters">
   <select value={topic} onChange={e=>setTopic(e.target.value)} aria-label="主題"><option value="all">全部主題</option>{archive?.stats.topics.map(c=><option key={c.name} value={c.name}>{c.name}（{c.items}）</option>)}</select>
  </div>
  <div className="ruling-result-count" role="status">{error?'部會函釋尚未下載，請連線後重試':!archive?'正在載入部會函釋…':words.length?`${rows.length.toLocaleString()} 則符合`:`${rows.length.toLocaleString()} 則（依發文日期新到舊）`}</div>
  {error&&<button className="plain-button" onClick={()=>setRetry(n=>n+1)}>重新載入</button>}
  {rows.slice(0,limit).map(({item})=><button className="minutes-card" key={item.id} onClick={()=>setOpen(item.id)}><h3>{item.summary||centralCite(item)}</h3><Meta item={item}/>{words.length>0&&<p>{agriSnippet(item.body,words)}</p>}</button>)}
  {archive&&!error&&!rows.length&&<div className="empty-state"><FileText size={26}/><strong>沒有符合的函釋</strong><span>試試較短或同義的字詞，或改選「全部主題」。</span></div>}
  {rows.length>limit&&<button className="load-more" onClick={()=>setLimit(n=>n+30)}>更多函釋<small>{limit} / {rows.length}</small><ChevronDown size={14}/></button>}
  <a className="plain-button" href="https://laws.gov.taipei/law/LawSearch" target="_blank" rel="noreferrer">臺北市法規查詢系統（原始資料）<ArrowUpRight size={14}/></a>
 </div>;
}
