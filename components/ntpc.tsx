import {useEffect,useMemo,useState} from 'react';
import {ArrowLeft,ArrowUpRight,ChevronDown,FileText,Info,Search,X} from 'lucide-react';
import {toast} from 'sonner';
import {loadNtpcManual,manifest} from '@/lib/data-client';
import type {NtpcCase,NtpcManual} from '@/lib/law-types';
import {keywords,strip} from '@/lib/minutes-search';
import {agriSnippet} from './agri';
const isPortable=()=>location.protocol==='file:';
const setHash=(hash:string)=>{try{window.history.replaceState(null,'',(isPortable()?'':location.pathname+location.search)+hash);}catch{}};
export const ntpcHash=(no:string)=>'#ntpc='+encodeURIComponent(no);
export const readNtpcHash=(hash:string)=>{const v=new URLSearchParams(hash.replace(/^#/,'')).get('ntpc');return v&&/^[\w-]{2,12}$/.test(v)?v:null;};
export type NtpcHit={item:NtpcCase;score:number};
const caseText=(c:NtpcCase)=>c.basis+c.rule+c.note;
export function searchNtpc(items:NtpcCase[],words:string[]):NtpcHit[]{
 if(!words.length)return [];const hits:NtpcHit[]=[];
 for(const item of items){const head=strip(item.no+item.question+item.chapter);const all=head+strip(caseText(item));if(!words.every(w=>all.includes(w)))continue;hits.push({item,score:words.filter(w=>head.includes(w)).length});}
 return hits.sort((a,b)=>b.score-a.score||a.item.no.localeCompare(b.item.no));
}
export const ntpcCite=(manual:{edition:string},c:NtpcCase)=>`新北市政府工務局建照業務工作手冊（${manual.edition}）案例 ${c.no}`;

function Notice({manual}:{manual:NtpcManual}){
 return <div className="minutes-notice"><Info size={15}/><p><strong>新北市政府工務局編撰的建照業務執行原則，只適用新北市的案子。</strong>彙整歷年建築法規研討會與建照科簽辦的案例；與條文或國土署函釋不一致時，以條文與中央函釋為準。各案例依據的日期不同，請讀「附註」並對照原手冊。<small>{manual.edition} · 資料更新：{manual.fetchedAt}</small></p></div>;
}
function Field({label,text}:{label:string;text:string}){
 return text?<div className="ntpc-field"><h4>{label}</h4><div className="minutes-text">{text}</div></div>:null;
}
function NtpcReader({manual,item,onBack}:{manual:NtpcManual;item:NtpcCase;onBack:()=>void}){
 useEffect(()=>{setHash(ntpcHash(item.no));document.querySelector('.minutes-reader')?.scrollTo({top:0});},[item.no]);
 const cite=ntpcCite(manual,item);
 return <div className="minutes-reader">
  <button className="ruling-back" onClick={onBack}><ArrowLeft size={14}/><span>新北市工作手冊案例</span></button>
  <h3>{item.question}</h3>
  <div className="minutes-meta"><span>案例 {item.no}</span><span>{item.chapter}</span>{item.page&&<span>手冊第 {item.page} 頁</span>}</div>
  <div className="minutes-pagebar"><span>{cite}</span><button className="minutes-copy" onClick={()=>navigator.clipboard?.writeText(cite+'\n'+location.href).then(()=>toast.success('已複製出處與連結'),()=>toast.error('無法複製'))}>複製出處</button><a href={manual.sourceUrl+'#page='+item.pdfPage} target="_blank" rel="noreferrer">原手冊<ArrowUpRight size={13}/></a></div>
  <Field label="依據" text={item.basis}/>
  <Field label="處理原則" text={item.rule}/>
  <Field label="附註" text={item.note}/>
 </div>;
}
export function NtpcExplorer(){
 const [manual,setManual]=useState<NtpcManual|null>(null),[error,setError]=useState(false),[retry,setRetry]=useState(0);
 const [q,setQ]=useState(''),[query,setQuery]=useState(''),[composing,setComposing]=useState(false);
 const [chapter,setChapter]=useState('all'),[limit,setLimit]=useState(40);
 const [open,setOpen]=useState<string|null>(()=>readNtpcHash(location.hash));
 useEffect(()=>{if(!manifest.ntpcManual){setError(true);return;}let live=true;setError(false);loadNtpcManual().then(a=>{if(live)setManual(a);}).catch(()=>{if(live)setError(true);});return()=>{live=false;};},[retry]);
 useEffect(()=>{if(composing)return;const t=setTimeout(()=>setQuery(q),200);return()=>clearTimeout(t);},[q,composing]);
 useEffect(()=>setLimit(40),[query,chapter]);
 const words=useMemo(()=>keywords(query),[query]);
 const pool=useMemo(()=>manual?manual.cases.filter(c=>chapter==='all'||c.chapter===chapter):[],[manual,chapter]);
 const rows=useMemo(()=>words.length?searchNtpc(pool,words):pool.map(item=>({item,score:0})),[pool,words]);
 if(manual&&open){const item=manual.cases.find(c=>c.no===open);if(item)return <div className="minutes-explorer"><NtpcReader manual={manual} item={item} onBack={()=>{setOpen(null);setHash('');}}/></div>;}
 return <div className="minutes-explorer">
  <div className="section-top"><div><div className="eyebrow">NEW TAIPEI CITY</div><h2>新北市建照業務工作手冊</h2><p>新北市政府工務局整理的建照審查執行原則：容積、開放空間、停車、變更使用、山坡地、農舍等案例。</p></div></div>
  {manual&&<><div className="ruling-overview"><strong>{manual.stats.cases}</strong><span>個案例<br/><small>{manual.edition} · {manual.stats.chapters.length} 章 · 來源：新北市政府工務局</small></span></div><Notice manual={manual}/></>}
  <label className="ruling-search"><Search size={16}/><input value={q} onCompositionStart={()=>setComposing(true)} onCompositionEnd={e=>{setComposing(false);setQ(e.currentTarget.value);}} onChange={e=>setQ(e.target.value)} placeholder="如：陽臺、梯廳、法定空地、農舍、機車停車" aria-label="搜尋新北市工作手冊"/>{q&&<button aria-label="清除搜尋" onClick={()=>setQ('')}><X size={14}/></button>}</label>
  <div className="ruling-filters">
   <select value={chapter} onChange={e=>setChapter(e.target.value)} aria-label="章"><option value="all">全部章節</option>{manual?.stats.chapters.map(c=><option key={c.name} value={c.name}>{c.name}（{c.cases}）</option>)}</select>
  </div>
  <div className="ruling-result-count" role="status">{error?'新北市工作手冊尚未下載，請連線後重試':!manual?'正在載入新北市工作手冊…':words.length?`${rows.length} 個案例符合`:`${rows.length} 個案例（依手冊編號）`}</div>
  {error&&<button className="plain-button" onClick={()=>setRetry(n=>n+1)}>重新載入</button>}
  {rows.slice(0,limit).map(({item})=><button className="minutes-card" key={item.no} onClick={()=>setOpen(item.no)}><h3>{item.question}</h3><div className="minutes-meta"><span>案例 {item.no}</span><span>{item.chapter}</span></div>{words.length>0&&<p>{agriSnippet(caseText(item),words)}</p>}</button>)}
  {manual&&!error&&!rows.length&&<div className="empty-state"><FileText size={26}/><strong>沒有符合的案例</strong><span>試試較短或同義的字詞，或改選「全部章節」。</span></div>}
  {rows.length>limit&&<button className="load-more" onClick={()=>setLimit(n=>n+40)}>更多案例<small>{limit} / {rows.length}</small><ChevronDown size={14}/></button>}
  {manual&&<a className="plain-button" href={manual.sourceUrl} target="_blank" rel="noreferrer">新北市建照業務工作手冊（原檔 PDF）<ArrowUpRight size={14}/></a>}
 </div>;
}
