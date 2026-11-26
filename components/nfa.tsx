import {useEffect,useMemo,useState} from 'react';
import {StaleBadge,StaleList} from './stale-note';
import {type Flags,useFlags} from '@/lib/stale';
import {ArrowLeft,ArrowUpRight,ChevronDown,FileText,Info,Search,X} from 'lucide-react';
import {toast} from 'sonner';
import {loadNfa,manifest} from '@/lib/data-client';
import type {NfaArchive,NfaItem} from '@/lib/law-types';
import {keywords,strip} from '@/lib/minutes-search';
import {agriSnippet,rocDay} from './agri';
const isPortable=()=>location.protocol==='file:';
const setHash=(hash:string)=>{try{window.history.replaceState(null,'',(isPortable()?'':location.pathname+location.search)+hash);}catch{}};
export const nfaHash=(id:string)=>'#nfa='+encodeURIComponent(id);
export const readNfaHash=(hash:string)=>{const v=new URLSearchParams(hash.replace(/^#/,'')).get('nfa');return v&&/^[0-9a-f]{12}$/.test(v)?v:null;};
export type NfaHit={item:NfaItem;score:number};
const refText=(item:NfaItem)=>item.refs.map(r=>r.law+r.articles.join('')).join('');
export function searchNfa(items:NfaItem[],words:string[]):NfaHit[]{
 if(!words.length)return [];const hits:NfaHit[]=[];
 for(const item of items){const head=strip(item.summary+item.docNo+item.issuer+refText(item));const all=head+strip(item.body);if(!words.every(w=>all.includes(w)))continue;hits.push({item,score:words.filter(w=>head.includes(w)).length});}
 return hits.sort((a,b)=>b.score-a.score||b.item.date.localeCompare(a.item.date)||b.item.id.localeCompare(a.item.id));
}
export const nfaCite=(item:NfaItem)=>item.date?`${item.issuer} ${rocDay(item.date)} ${item.docNo}`.trim():item.issuer;
const refLabel=(r:{law:string;articles:string[];historical:boolean})=>(r.historical?'（舊版）':'')+r.law+(r.articles.length?' '+r.articles.map(a=>a.replace(/\s+/g,'')).join('、'):'');

function Notice({archive}:{archive:NfaArchive}){
 return <div className="minutes-notice"><Info size={15}/><p><strong>內政部消防署「消防法令查詢系統」的法令解釋與執法疑義（內政部、消防署等的函、令）。</strong>系統標示的相關法條是函釋當時的版本；之後的法規修正或較新的函釋可能改變見解，個案仍以主管機關認定為準。部分以令發布者只有要旨，全文請查行政院公報。<small>資料版本：{archive.fetchedAt} 擷取</small></p></div>;
}
function Meta({item,stale}:{item:NfaItem;stale?:Flags|null}){
 return <div className="minutes-meta"><StaleBadge id={item.id} flags={stale}/><span>{item.issuer} {rocDay(item.date)}</span>{item.docNo&&<span>{item.docNo}</span>}<span>{item.kind}</span>{item.abolished&&<span className="ruling-abolished">已廢止</span>}{item.refs.slice(0,2).map(r=><span key={r.law+r.version}>{refLabel(r)}</span>)}</div>;
}
function NfaReader({item,onBack,stale,onOpen}:{item:NfaItem;onBack:()=>void;stale:Flags|null;onOpen:(id:string)=>void}){
 useEffect(()=>{setHash(nfaHash(item.id));document.querySelector('.minutes-reader')?.scrollTo({top:0});},[item.id]);
 const cite=nfaCite(item);
 return <div className="minutes-reader">
  <button className="ruling-back" onClick={onBack}><ArrowLeft size={14}/><span>消防署函釋列表</span></button>
  <h3>{item.summary||cite}</h3>
  <Meta item={item} stale={stale}/>
  <StaleList id={item.id} date={item.date} flags={stale} onOpen={onOpen}/>
  <div className="minutes-pagebar"><span>{cite}</span><button className="minutes-copy" onClick={()=>navigator.clipboard?.writeText(cite+'\n'+location.href).then(()=>toast.success('已複製字號與連結'),()=>toast.error('無法複製'))}>複製字號</button><a href="https://law.nfa.gov.tw/GNFA/FINT/index.aspx" target="_blank" rel="noreferrer">消防法令查詢系統<ArrowUpRight size={13}/></a></div>
  {item.refs.length>0&&<div className="landuse-files"><span>系統標示的相關法條：</span>{item.refs.map(r=><span key={r.law+r.version}>{refLabel(r)}（{rocDay(r.version)} 版）</span>)}</div>}
  <div className="minutes-text">{item.body||item.summary}</div>
  {item.abolished&&<p className="ocr-table-warn">消防法令查詢系統將這則標為已廢止（字號前加「廢」），只供參考，不再適用。</p>}
  {!item.body&&!item.abolished&&<p className="ocr-table-warn">消防法令查詢系統{item.summary?'只收這則的要旨':'沒有這則的內容'}{item.origin?'（來源：'+item.origin+'）':''}，全文請查原始出處。</p>}
 </div>;
}
export function NfaExplorer(){
 const [archive,setArchive]=useState<NfaArchive|null>(null),[error,setError]=useState(false),[retry,setRetry]=useState(0);
 const [q,setQ]=useState(''),[query,setQuery]=useState(''),[composing,setComposing]=useState(false);
 const [law,setLaw]=useState('all'),[limit,setLimit]=useState(30);
 const [open,setOpen]=useState<string|null>(()=>readNfaHash(location.hash));
 const stale=useFlags(manifest.nfaRefs);
 useEffect(()=>{if(!manifest.nfa){setError(true);return;}let live=true;setError(false);loadNfa().then(a=>{if(live)setArchive(a);}).catch(()=>{if(live)setError(true);});return()=>{live=false;};},[retry]);
 useEffect(()=>{if(composing)return;const t=setTimeout(()=>setQuery(q),200);return()=>clearTimeout(t);},[q,composing]);
 useEffect(()=>setLimit(30),[query,law]);
 const words=useMemo(()=>keywords(query),[query]);
 const pool=useMemo(()=>archive?archive.items.filter(i=>law==='all'||(law==='執法疑義'?i.kind==='執法疑義':i.refs.some(r=>r.law===law))):[],[archive,law]);
 const rows=useMemo(()=>words.length?searchNfa(pool,words):pool.map(item=>({item,score:0})),[pool,words]);
 if(archive&&open){const item=archive.items.find(i=>i.id===open);if(item)return <div className="minutes-explorer"><NfaReader item={item} stale={stale} onOpen={id=>setOpen(id)} onBack={()=>{setOpen(null);setHash('');}}/></div>;}
 return <div className="minutes-explorer">
  <div className="section-top"><div><div className="eyebrow">NATIONAL FIRE AGENCY</div><h2>內政部消防署函釋</h2><p>消防法、各類場所消防安全設備設置標準、公共危險物品場所設置標準、檢修申報等法令解釋與執法疑義。</p></div></div>
  {archive&&<><div className="ruling-overview"><strong>{archive.stats.items.toLocaleString()}</strong><span>則解釋函<br/><small>法令解釋 {archive.stats.kinds['法令解釋']} · 執法疑義 {archive.stats.kinds['執法疑義']} · 來源：消防法令查詢系統</small></span></div><Notice archive={archive}/></>}
  <label className="ruling-search"><Search size={16}/><input value={q} onCompositionStart={()=>setComposing(true)} onCompositionEnd={e=>{setComposing(false);setQ(e.currentTarget.value);}} onChange={e=>setQ(e.target.value)} placeholder="如：排煙設備、撒水、防火管理人、檢修申報、地下室" aria-label="搜尋消防署函釋"/>{q&&<button aria-label="清除搜尋" onClick={()=>setQ('')}><X size={14}/></button>}</label>
  <div className="ruling-filters">
   <select value={law} onChange={e=>setLaw(e.target.value)} aria-label="法規"><option value="all">全部法規</option><option value="執法疑義">只看執法疑義</option>{archive?.stats.laws.slice(0,40).map(l=><option key={l.name} value={l.name}>{l.name}（{l.items}）</option>)}</select>
  </div>
  <div className="ruling-result-count" role="status">{error?'消防署函釋尚未下載，請連線後重試':!archive?'正在載入消防署函釋…':words.length?`${rows.length.toLocaleString()} 則符合`:`${rows.length.toLocaleString()} 則（依發文日期新到舊）`}</div>
  {error&&<button className="plain-button" onClick={()=>setRetry(n=>n+1)}>重新載入</button>}
  {rows.slice(0,limit).map(({item})=><button className="minutes-card" key={item.id} onClick={()=>setOpen(item.id)}><h3>{item.summary||nfaCite(item)}</h3><Meta item={item} stale={stale}/>{words.length>0&&<p>{agriSnippet(item.body,words)}</p>}</button>)}
  {archive&&!error&&!rows.length&&<div className="empty-state"><FileText size={26}/><strong>沒有符合的函釋</strong><span>試試較短或同義的字詞，或改選「全部法規」。</span></div>}
  {rows.length>limit&&<button className="load-more" onClick={()=>setLimit(n=>n+30)}>更多函釋<small>{limit} / {rows.length}</small><ChevronDown size={14}/></button>}
  <a className="plain-button" href="https://law.nfa.gov.tw/GNFA/FINT/index.aspx" target="_blank" rel="noreferrer">內政部消防署 消防法令查詢系統（原始資料）<ArrowUpRight size={14}/></a>
 </div>;
}
