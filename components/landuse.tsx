import {useEffect,useMemo,useState} from 'react';
import {ArrowLeft,ArrowUpRight,ChevronDown,ChevronLeft,ChevronRight,FileText,Info,Search,X} from 'lucide-react';
import {toast} from 'sonner';
import {loadLanduse,loadMinutes,manifest} from '@/lib/data-client';
import type {LanduseArchive,LanduseItem} from '@/lib/law-types';
import {keywords,minutesSnippet,searchMinutes,type MinutesHit} from '@/lib/minutes-search';
import {landuseHash,readLanduseHash,rocDate,searchLanduse,type LanduseHit} from '@/lib/landuse-search';
const isPortable=()=>location.protocol==='file:';
const setHash=(hash:string)=>{try{window.history.replaceState(null,'',(isPortable()?'':location.pathname+location.search)+hash);}catch{}};

function Notice({archive}:{archive:LanduseArchive}){
 return <div className="minutes-notice"><Info size={15}/><p><strong>每份是那一次都市計畫公告的土管要點，市府網站沒有標示哪一份是現行版本。</strong>同一計畫區常有多個細部計畫與後續修訂，引用前要確認基地屬於哪一個計畫、之後有沒有較新的公告。部分頁面是掃描影像經 OCR，表格與數字可能有誤，請以原檔為準。<small>資料更新：{archive.fetchedAt}</small></p></div>;
}

function Meta({item}:{item:LanduseItem}){
 const bits=[item.area,item.kind,item.date&&'公告：'+rocDate(item.date),item.docNo&&'文號：'+item.docNo].filter(Boolean);
 return <div className="minutes-meta">{bits.map(b=><span key={b as string}>{b}</span>)}</div>;
}

function LanduseReader({item,archive,startPage,onBack,onOpen}:{item:LanduseItem;archive:LanduseArchive;startPage:number;onBack:()=>void;onOpen:(id:string)=>void}){
 const [n,setN]=useState(startPage);
 useEffect(()=>{setN(startPage);setHash(landuseHash(item.id,startPage));},[item.id,startPage]);
 const page=item.pages.find(p=>p.n===n)||item.pages[0];
 const go=(next:number)=>{const to=Math.min(item.pages.length,Math.max(1,next));setN(to);setHash(landuseHash(item.id,to));document.querySelector('.minutes-reader')?.scrollTo({top:0});};
 // Later announcements in the same plan area: a fact from the city's list, not a judgement of which applies.
 const newer=useMemo(()=>archive.items.filter(i=>i.area===item.area&&i.id!==item.id&&i.date>item.date),[archive,item]);
 return <div className="minutes-reader">
  <button className="ruling-back" onClick={onBack}><ArrowLeft size={14}/><span>土管要點列表</span></button>
  <h3>{item.title}</h3>
  <Meta item={item}/>
  <Notice archive={archive}/>
  {newer.length>0&&<details className="landuse-newer"><summary>同一計畫區之後還有 {newer.length} 份土管要點公告（可能是別的細部計畫，也可能修訂了本文）</summary>{newer.slice().reverse().map(i=><button key={i.id} onClick={()=>onOpen(i.id)}><b>{rocDate(i.date)}</b>{i.title}</button>)}</details>}
  <div className="minutes-pagebar">
   <button aria-label="上一頁" disabled={page.n<=1} onClick={()=>go(page.n-1)}><ChevronLeft size={15}/></button>
   <select value={page.n} onChange={e=>go(Number(e.target.value))} aria-label="選擇頁碼">{item.pages.map(p=><option key={p.n} value={p.n}>第 {p.n} 頁{p.ocr?'（OCR）':''}</option>)}</select>
   <span>共 {item.pages.length} 頁</span>
   <button aria-label="下一頁" disabled={page.n>=item.pages.length} onClick={()=>go(page.n+1)}><ChevronRight size={15}/></button>
   <button className="minutes-copy" onClick={()=>navigator.clipboard?.writeText(location.href).then(()=>toast.success('已複製連結'),()=>toast.error('無法複製，請手動複製網址'))}>複製連結</button><a href={item.url} target="_blank" rel="noreferrer">原檔 PDF<ArrowUpRight size={13}/></a>
  </div>
  {item.files.length>0&&<div className="landuse-files"><span>同案其他檔案：</span>{item.files.map(f=><a key={f.url} href={f.url} target="_blank" rel="noreferrer">{f.name||'檔案'}<ArrowUpRight size={12}/></a>)}</div>}
  {page.ocr&&<div className="minutes-ocr">這一頁是掃描影像經 OCR 辨識，字與數字可能有誤，請以原檔為準。</div>}
  <div className="minutes-text">{page.text.trim()||'（此頁沒有可辨識的文字，可能是圖或表，請開原檔）'}</div>
 </div>;
}

export function LanduseExplorer(){
 const [archive,setArchive]=useState<LanduseArchive|null>(null),[error,setError]=useState(false),[retry,setRetry]=useState(0);
 const [q,setQ]=useState(''),[query,setQuery]=useState(''),[composing,setComposing]=useState(false);
 const [area,setArea]=useState('all'),[kind,setKind]=useState('all'),[limit,setLimit]=useState(30);
 const [open,setOpen]=useState<{id:string;page:number}|null>(()=>readLanduseHash(location.hash));
 const close=()=>{setOpen(null);setHash('');};
 useEffect(()=>{if(!manifest.landuse){setError(true);return;}let live=true;setError(false);loadLanduse().then(a=>{if(live)setArchive(a);}).catch(()=>{if(live)setError(true);});return()=>{live=false;};},[retry]);
 useEffect(()=>{if(composing)return;const t=setTimeout(()=>setQuery(q),200);return()=>clearTimeout(t);},[q,composing]);
 useEffect(()=>setLimit(30),[query,area,kind]);
 const words=useMemo(()=>keywords(query),[query]);
 const areas=useMemo(()=>{if(!archive)return [];const c=new Map<string,number>();archive.items.forEach(i=>c.set(i.area,(c.get(i.area)||0)+1));return [...c].sort((a,b)=>b[1]-a[1]);},[archive]);
 const kinds=useMemo(()=>archive?[...new Set(archive.items.map(i=>i.kind).filter(Boolean))].sort():[],[archive]);
 const pool=useMemo(()=>archive?archive.items.filter(i=>(area==='all'||i.area===area)&&(kind==='all'||i.kind===kind)):[],[archive,area,kind]);
 const hits=useMemo(()=>words.length?searchLanduse(pool,words):[],[pool,words]);
 const rows:LanduseHit[]=words.length?hits:pool.map(item=>({item,page:item.pages[0],score:0,spread:false}));
 if(archive&&open){const item=archive.items.find(i=>i.id===open.id);if(item)return <div className="minutes-explorer"><LanduseReader item={item} archive={archive} startPage={open.page} onBack={close} onOpen={id=>setOpen({id,page:1})}/></div>;}
 return <div className="minutes-explorer">
  <div className="section-top"><div><div className="eyebrow">TAOYUAN ZONING</div><h2>桃園市都市計畫土管要點</h2><p>各都市計畫公告的土地使用分區管制要點：建蔽率、容積率、退縮、停車、容許使用。</p></div></div>
  {archive&&<><div className="ruling-overview"><strong>{archive.stats.items.toLocaleString()}</strong><span>份土管要點 · {archive.stats.areas} 個計畫區<br/><small>共 {archive.stats.pages.toLocaleString()} 頁 · 其中 {archive.stats.ocrPages.toLocaleString()} 頁為 OCR</small></span></div><Notice archive={archive}/></>}
  <label className="ruling-search"><Search size={16}/><input value={q} onCompositionStart={()=>setComposing(true)} onCompositionEnd={e=>{setComposing(false);setQ(e.currentTarget.value);}} onChange={e=>setQ(e.target.value)} placeholder="如：退縮建築、開挖率、停車空間、青埔" aria-label="搜尋桃園市土管要點"/>{q&&<button aria-label="清除搜尋" onClick={()=>setQ('')}><X size={14}/></button>}</label>
  <div className="ruling-filters">
   <select value={area} onChange={e=>setArea(e.target.value)} aria-label="計畫區"><option value="all">全部計畫區</option>{areas.map(([a,n])=><option key={a} value={a}>{a}（{n}）</option>)}</select>
   <select value={kind} onChange={e=>setKind(e.target.value)} aria-label="計畫層級"><option value="all">全部計畫層級</option>{kinds.map(k=><option key={k} value={k}>{k}</option>)}</select>
  </div>
  <div className="ruling-result-count" role="status">{error?'土管要點尚未下載，請連線後重試':!archive?'正在載入土管要點…':words.length?`${rows.length.toLocaleString()} 份符合`:`${rows.length.toLocaleString()} 份（依公告日期新到舊）`}</div>
  {error&&<button className="plain-button" onClick={()=>setRetry(n=>n+1)}>重新載入</button>}
  {rows.slice(0,limit).map(({item,page,spread})=><button className="minutes-card" key={item.id} onClick={()=>setOpen({id:item.id,page:words.length?page.n:1})}>
   <h3>{item.title}</h3>
   <Meta item={item}/>
   {words.length>0&&<p>{spread?'關鍵字分散在不同頁，請點開逐頁讀。':<><b>第 {page.n} 頁{page.ocr?'（OCR）':''}</b>　{minutesSnippet(page.text,words)}</>}</p>}
  </button>)}
  {archive&&!error&&!rows.length&&<div className="empty-state"><FileText size={26}/><strong>沒有符合的土管要點</strong><span>試試較短或同義的字詞，或換一個計畫區。這裡只收市府網站上有「土管要點」檔的公告案；寫在計畫書內文、沒有獨立檔的，請到市府網站查。</span></div>}
  {rows.length>limit&&<button className="load-more" onClick={()=>setLimit(n=>n+30)}>更多土管要點<small>{limit} / {rows.length}</small><ChevronDown size={14}/></button>}
  <p className="coverage-note">土管要點是都市計畫的一部分，依都市計畫法第 22 條與都市計畫法桃園市施行細則訂定，只適用該計畫區。基地屬於哪個計畫區與分區，請以桃園市都市計畫地理資訊系統與土地使用分區證明為準。</p>
  <a className="plain-button" href="https://urplanning.tycg.gov.tw/Urban/plans.html" target="_blank" rel="noreferrer">桃園市都市計畫書圖查詢（市府原始資料）<ArrowUpRight size={14}/></a>
 </div>;
}

// The Taoyuan 土管要點 and minutes sections of the main search. Lives in this lazy chunk so their
// search code stays out of the initial offline shell; data files load on the first query.
type Props={debounced:string;openLanduse:(id:string,page:number)=>void;openMinutes:(id:string,page:number)=>void;setView:(v:string)=>void};
export function RegionalHits({debounced,openLanduse,openMinutes,setView}:Props){
  const [minutesHits,setMinutesHits]=useState<MinutesHit[]>([]);
  const [landuseHits,setLanduseHits]=useState<LanduseHit[]>([]);
  useEffect(()=>{setMinutesHits([]);const words=keywords(debounced);if(!words.length||!manifest.minutes)return;const controller=new AbortController();loadMinutes(controller.signal).then(a=>{if(!controller.signal.aborted)setMinutesHits(searchMinutes(a.items,words));}).catch(()=>{});return()=>controller.abort();},[debounced]);
  useEffect(()=>{setLanduseHits([]);const words=keywords(debounced);if(!words.length||!manifest.landuse)return;const controller=new AbortController();loadLanduse(controller.signal).then(a=>{if(!controller.signal.aborted)setLanduseHits(searchLanduse(a.items,words));}).catch(()=>{});return()=>controller.abort();},[debounced]);
  return <>
   {landuseHits.length>0&&<section className="minutes-hits" aria-label="桃園市土管要點"><h3>桃園市都市計畫土管要點<span>{landuseHits.length} 份符合</span></h3><small>每份是該次公告的要點，市府未標示現行版本；只適用該計畫區，引用前請確認有無較新公告並開原檔。</small>{landuseHits.slice(0,5).map(({item,page,spread})=><button className="minutes-card" key={item.id} onClick={()=>openLanduse(item.id,page.n)}><h3>{item.title}</h3><div className="minutes-meta"><span>{item.area}</span>{item.date&&<span>公告：{rocDate(item.date)}</span>}</div>{!spread&&<p><b>第 {page.n} 頁{page.ocr?'（OCR）':''}</b>　{minutesSnippet(page.text,keywords(debounced))}</p>}</button>)}{landuseHits.length>5&&<button className="load-more" onClick={()=>{setView('landuse');}}>到「土管」分頁看全部 {landuseHits.length} 份</button>}</section>}
   {minutesHits.length>0&&<section className="minutes-hits" aria-label="桃園市會議紀錄"><h3>桃園市會議紀錄<span>{minutesHits.length} 份符合</span></h3><small>只適用桃園市，不是法源；OCR 頁可能有誤字，引用前請開原檔。</small>{minutesHits.slice(0,5).map(({item,page,spread})=><button className="minutes-card" key={item.id} onClick={()=>openMinutes(item.id,page.n)}><h3>{item.title}</h3>{!spread&&<p><b>第 {page.n} 頁{page.ocr?'（OCR）':''}</b>　{minutesSnippet(page.text,keywords(debounced))}</p>}</button>)}{minutesHits.length>5&&<button className="load-more" onClick={()=>{setView('minutes');}}>到「會議」分頁看全部 {minutesHits.length} 份</button>}</section>}
  </>;
}
