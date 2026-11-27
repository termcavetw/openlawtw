import {useEffect,useMemo,useState} from 'react';
import {LetterText} from './letter-text';
import {type Flags,useFlags} from '@/lib/stale';
import {StaleBadge,StaleList} from './stale-note';
import {ArrowLeft,ArrowUpRight,ChevronDown,FileText,Info,Search,X} from 'lucide-react';
import {toast} from 'sonner';
import {loadAgri,manifest} from '@/lib/data-client';
import type {AgriArchive,AgriItem} from '@/lib/law-types';
import {keywords,strip} from '@/lib/minutes-search';
const isPortable=()=>location.protocol==='file:';
const setHash=(hash:string)=>{try{window.history.replaceState(null,'',(isPortable()?'':location.pathname+location.search)+hash);}catch{}};
export const agriHash=(id:number)=>'#agri='+id;
export const readAgriHash=(hash:string)=>{const v=Number(new URLSearchParams(hash.replace(/^#/,'')).get('agri'));return Number.isInteger(v)&&v>0?v:null;};
export const rocDay=(iso:string)=>{const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);return m?`${Number(m[1])-1911}.${m[2]}.${m[3]}`:'';};
export type AgriHit={item:AgriItem;score:number};
export function searchAgri(items:AgriItem[],words:string[]):AgriHit[]{
 if(!words.length)return [];const hits:AgriHit[]=[];
 for(const item of items){const head=strip(item.title+item.docNo+item.laws.join(''));const all=head+strip(item.body);if(!words.every(w=>all.includes(w)))continue;hits.push({item,score:words.filter(w=>head.includes(w)).length});}
 return hits.sort((a,b)=>b.score-a.score||b.item.date.localeCompare(a.item.date)||b.item.id-a.item.id);
}
export function agriSnippet(text:string,words:string[]){const t=text.replace(/\s+/g,' ');let at=-1;for(const w of words){const i=t.indexOf(w);if(i>=0&&(at<0||i<at))at=i;}const s=Math.max(0,at-30);return (s>0?'…':'')+t.slice(s,s+110)+(t.length>s+110?'…':'');}

function Notice({archive}:{archive:AgriArchive}){
 return <div className="minutes-notice"><Info size={15}/><p><strong>農業部（原農委會）對農地、農舍、農業設施等規定的解釋函令，也有少數內政部等機關的相關函。</strong>多數是回覆個別縣市政府的疑義，引用時請注意當時的法規版本；之後的法規修正或較新的函釋可能改變見解。函釋不是條文，個案仍以主管機關認定為準。<small>資料更新：{archive.fetchedAt}</small></p></div>;
}
function Meta({item,stale}:{item:AgriItem;stale?:Flags|null}){
 return <div className="minutes-meta"><StaleBadge id={item.id} flags={stale}/><span>{item.cls}</span><span>{item.issuer} {rocDay(item.date)}</span><span>{item.docNo}</span>{item.laws.slice(0,3).map(l=><span key={l}>{l}</span>)}</div>;
}
function AgriReader({item,onBack,stale,onOpen}:{item:AgriItem;onBack:()=>void;stale:Flags|null;onOpen:(id:string)=>void}){
 useEffect(()=>{setHash(agriHash(item.id));document.querySelector('.minutes-reader')?.scrollTo({top:0});},[item.id]);
 const cite=`${item.issuer} ${rocDay(item.date)} ${item.docNo}${/[函令]$/.test(item.docNo)?'':item.cls==='解釋令'?'令':'函'}`;
 return <div className="minutes-reader">
  <button className="ruling-back" onClick={onBack}><ArrowLeft size={14}/><span>農業部函釋列表</span></button>
  <h3>{item.title}</h3>
  <Meta item={item} stale={stale}/>
  <StaleList id={item.id} date={item.date} flags={stale} onOpen={onOpen}/>
  <div className="minutes-pagebar"><span>{cite}</span><button className="minutes-copy" onClick={()=>navigator.clipboard?.writeText(cite+'\n'+location.href).then(()=>toast.success('已複製字號與連結'),()=>toast.error('無法複製'))}>複製字號</button><a href={item.url} target="_blank" rel="noreferrer">官方原文<ArrowUpRight size={13}/></a></div>
  {item.laws.length>0&&<div className="landuse-files"><span>網站歸類的法規：</span>{item.laws.map(l=><span key={l}>{l}</span>)}</div>}
  <LetterText text={item.body}/>
 </div>;
}
export function AgriExplorer(){
 const [archive,setArchive]=useState<AgriArchive|null>(null),[error,setError]=useState(false),[retry,setRetry]=useState(0);
 const [q,setQ]=useState(''),[query,setQuery]=useState(''),[composing,setComposing]=useState(false);
 const [law,setLaw]=useState('all'),[cls,setCls]=useState('all'),[limit,setLimit]=useState(30);
 const [open,setOpen]=useState<number|null>(()=>readAgriHash(location.hash));
 const stale=useFlags(manifest.agriRefs);
 useEffect(()=>{if(!manifest.agri){setError(true);return;}let live=true;setError(false);loadAgri().then(a=>{if(live)setArchive(a);}).catch(()=>{if(live)setError(true);});return()=>{live=false;};},[retry]);
 useEffect(()=>{if(composing)return;const t=setTimeout(()=>setQuery(q),200);return()=>clearTimeout(t);},[q,composing]);
 useEffect(()=>setLimit(30),[query,law,cls]);
 const words=useMemo(()=>keywords(query),[query]);
 const pool=useMemo(()=>archive?archive.items.filter(i=>(law==='all'||(law==='none'?!i.laws.length:i.laws.includes(law)))&&(cls==='all'||i.cls===cls)):[],[archive,law,cls]);
 const rows=useMemo(()=>words.length?searchAgri(pool,words):pool.map(item=>({item,score:0})),[pool,words]);
 if(archive&&open){const item=archive.items.find(i=>i.id===open);if(item)return <div className="minutes-explorer"><AgriReader item={item} stale={stale} onOpen={id=>setOpen(Number(id))} onBack={()=>{setOpen(null);setHash('');}}/></div>;}
 return <div className="minutes-explorer">
  <div className="section-top"><div><div className="eyebrow">MINISTRY OF AGRICULTURE</div><h2>農業部農地農舍函釋</h2><p>農業發展條例、農舍、農業設施容許使用、農業使用證明、耕地分割等解釋函令。</p></div></div>
  {archive&&<><div className="ruling-overview"><strong>{archive.stats.items.toLocaleString()}</strong><span>則解釋函令<br/><small>其中解釋令 {archive.stats.interpretationOrders} 則 · 來源：農村發展及水土保持署</small></span></div><Notice archive={archive}/></>}
  <label className="ruling-search"><Search size={16}/><input value={q} onCompositionStart={()=>setComposing(true)} onCompositionEnd={e=>{setComposing(false);setQ(e.currentTarget.value);}} onChange={e=>setQ(e.target.value)} placeholder="如：農業設施 容許使用、農舍 共有、資材室、農業使用證明" aria-label="搜尋農業部函釋"/>{q&&<button aria-label="清除搜尋" onClick={()=>setQ('')}><X size={14}/></button>}</label>
  <div className="ruling-filters">
   <select value={law} onChange={e=>setLaw(e.target.value)} aria-label="法規"><option value="all">全部法規</option>{archive?.stats.laws.map(l=><option key={l.name} value={l.name}>{l.name}（{l.items}）</option>)}<option value="none">網站未歸類法規</option></select>
   <select value={cls} onChange={e=>setCls(e.target.value)} aria-label="類別"><option value="all">函＋令</option><option value="解釋函">解釋函</option><option value="解釋令">解釋令</option></select>
  </div>
  <div className="ruling-result-count" role="status">{error?'農業部函釋尚未下載，請連線後重試':!archive?'正在載入農業部函釋…':words.length?`${rows.length.toLocaleString()} 則符合`:`${rows.length.toLocaleString()} 則（依發文日期新到舊）`}</div>
  {error&&<button className="plain-button" onClick={()=>setRetry(n=>n+1)}>重新載入</button>}
  {rows.slice(0,limit).map(({item})=><button className="minutes-card" key={item.id} onClick={()=>setOpen(item.id)}><h3>{item.title}</h3><Meta item={item} stale={stale}/>{words.length>0&&<p>{agriSnippet(item.body,words)}</p>}</button>)}
  {archive&&!error&&!rows.length&&<div className="empty-state"><FileText size={26}/><strong>沒有符合的函釋</strong><span>試試較短或同義的字詞，或改選「全部法規」。</span></div>}
  {rows.length>limit&&<button className="load-more" onClick={()=>setLimit(n=>n+30)}>更多函釋<small>{limit} / {rows.length}</small><ChevronDown size={14}/></button>}
  <a className="plain-button" href="https://rmis.ardswc.gov.tw/web/NewsList.aspx" target="_blank" rel="noreferrer">農地及農舍法規檢索系統（農業部原始資料）<ArrowUpRight size={14}/></a>
 </div>;
}
