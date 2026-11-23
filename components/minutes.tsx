import {useEffect,useMemo,useState} from 'react';
import {ArrowLeft,ArrowUpRight,ChevronDown,ChevronLeft,ChevronRight,FileText,Info,Search,X} from 'lucide-react';
import {toast} from 'sonner';
import {loadMinutes,manifest} from '@/lib/data-client';
import type {MinutesArchive,MinutesItem} from '@/lib/law-types';
import {keywords,minutesHash,minutesSnippet,readMinutesHash,searchMinutes,type MinutesHit} from '@/lib/minutes-search';
const isPortable=()=>location.protocol==='file:';
const setHash=(hash:string)=>{try{window.history.replaceState(null,'',(isPortable()?'':location.pathname+location.search)+hash);}catch{}};

function Notice({archive}:{archive:MinutesArchive}){
 return <div className="minutes-notice"><Info size={15}/><p><strong>只適用桃園市，不是法源。</strong>轉載自桃園市建築師公會網站；部分頁面是掃描影像經 OCR，可能有誤字，引用前請開原檔核對。<small>資料更新：{archive.fetchedAt}</small></p></div>;
}

function Meta({item}:{item:MinutesItem}){
 const bits=[item.issuer&&'發文機關：'+item.issuer,item.docDate&&'發文日期：'+item.docDate,item.docNo&&'字號：'+item.docNo].filter(Boolean);
 return bits.length?<div className="minutes-meta">{bits.map(b=><span key={b as string}>{b}</span>)}</div>:null;
}

function MinutesReader({item,archive,startPage,onBack}:{item:MinutesItem;archive:MinutesArchive;startPage:number;onBack:()=>void}){
 const [n,setN]=useState(startPage);
 useEffect(()=>{setN(startPage);setHash(minutesHash(item.id,startPage));},[item.id,startPage]);
 const page=item.pages.find(p=>p.n===n)||item.pages[0];
 const go=(next:number)=>{const to=Math.min(item.pages.length,Math.max(1,next));setN(to);setHash(minutesHash(item.id,to));document.querySelector('.minutes-reader')?.scrollTo({top:0});};
 const original=item.manual?null:item.url;
 return <div className="minutes-reader">
  <button className="ruling-back" onClick={onBack}><ArrowLeft size={14}/><span>會議紀錄列表</span></button>
  <h3>{item.title}</h3>
  <Meta item={item}/>
  <Notice archive={archive}/>
  <div className="minutes-pagebar">
   <button aria-label="上一頁" disabled={page.n<=1} onClick={()=>go(page.n-1)}><ChevronLeft size={15}/></button>
   <select value={page.n} onChange={e=>go(Number(e.target.value))} aria-label="選擇頁碼">{item.pages.map(p=><option key={p.n} value={p.n}>第 {p.n} 頁{p.ocr?'（OCR）':''}</option>)}</select>
   <span>共 {item.pages.length} 頁</span>
   <button aria-label="下一頁" disabled={page.n>=item.pages.length} onClick={()=>go(page.n+1)}><ChevronRight size={15}/></button>
   <button className="minutes-copy" onClick={()=>navigator.clipboard?.writeText(location.href).then(()=>toast.success('已複製連結'),()=>toast.error('無法複製，請手動複製網址'))}>複製連結</button>{original?<a href={original} target="_blank" rel="noreferrer">原檔 PDF<ArrowUpRight size={13}/></a>:<span className="minutes-manual">掃描檔 OCR，無公開原檔連結</span>}
  </div>
  {page.ocr&&<div className="minutes-ocr">這一頁是掃描影像經 OCR 辨識，字可能有誤，請以原檔為準。</div>}
  <div className="minutes-text">{page.text.trim()||'（此頁沒有可辨識的文字）'}</div>
 </div>;
}

export function MinutesExplorer(){
 const [archive,setArchive]=useState<MinutesArchive|null>(null),[error,setError]=useState(false),[retry,setRetry]=useState(0);
 const [q,setQ]=useState(''),[query,setQuery]=useState(''),[composing,setComposing]=useState(false);
 const [year,setYear]=useState('all'),[limit,setLimit]=useState(30);
 const [open,setOpen]=useState<{id:string;page:number}|null>(()=>readMinutesHash(location.hash));
 const close=()=>{setOpen(null);setHash('');};
 useEffect(()=>{if(!manifest.minutes){setError(true);return;}let live=true;setError(false);loadMinutes().then(a=>{if(live)setArchive(a);}).catch(()=>{if(live)setError(true);});return()=>{live=false;};},[retry]);
 useEffect(()=>{if(composing)return;const t=setTimeout(()=>setQuery(q),160);return()=>clearTimeout(t);},[q,composing]);
 useEffect(()=>setLimit(30),[query,year]);
 const words=useMemo(()=>keywords(query),[query]);
 const years=useMemo(()=>archive?[...new Set(archive.items.map(i=>i.year).filter((y):y is number=>y!==null))].sort((a,b)=>b-a):[],[archive]);
 const pool=useMemo(()=>archive?archive.items.filter(i=>year==='all'||String(i.year)===year):[],[archive,year]);
 const hits=useMemo(()=>words.length?searchMinutes(pool,words):[],[pool,words]);
 const rows:MinutesHit[]=words.length?hits:pool.map(item=>({item,page:item.pages[0],score:0,spread:false}));
 if(archive&&open){const item=archive.items.find(i=>i.id===open.id);if(item)return <div className="minutes-explorer"><MinutesReader item={item} archive={archive} startPage={open.page} onBack={close}/></div>;}
 return <div className="minutes-explorer">
  <div className="section-top"><div><div className="eyebrow">TAOYUAN MINUTES</div><h2>桃園市疑義會議紀錄</h2><p>桃園市政府建管單位的法規執行疑義會議紀錄與公文。</p></div></div>
  {archive&&<><div className="ruling-overview"><strong>{archive.stats.items.toLocaleString()}</strong><span>份會議紀錄與公文<br/><small>共 {archive.stats.pages.toLocaleString()} 頁 · 其中 {archive.stats.ocrPages.toLocaleString()} 頁為 OCR</small></span></div><Notice archive={archive}/></>}
  <label className="ruling-search"><Search size={16}/><input value={q} onCompositionStart={()=>setComposing(true)} onCompositionEnd={e=>{setComposing(false);setQ(e.currentTarget.value);}} onChange={e=>setQ(e.target.value)} placeholder="如：室內裝修 現況測量圖、陽臺、免計容積" aria-label="搜尋桃園市會議紀錄"/>{q&&<button aria-label="清除搜尋" onClick={()=>setQ('')}><X size={14}/></button>}</label>
  <div className="ruling-filters"><select value={year} onChange={e=>setYear(e.target.value)} aria-label="年度（民國）"><option value="all">全部年度</option>{years.map(y=><option key={y} value={String(y)}>民國 {y} 年</option>)}</select></div>
  <div className="ruling-result-count" role="status">{error?'會議紀錄尚未下載，請連線後重試':!archive?'正在載入會議紀錄…':words.length?`${rows.length.toLocaleString()} 份符合`:`${rows.length.toLocaleString()} 份（新到舊）`}</div>
  {error&&<button className="plain-button" onClick={()=>setRetry(n=>n+1)}>重新載入</button>}
  {rows.slice(0,limit).map(({item,page,spread})=><button className="minutes-card" key={item.id} onClick={()=>setOpen({id:item.id,page:words.length?page.n:1})}>
   <h3>{item.title}</h3>
   <Meta item={item}/>
   {words.length>0&&<p>{spread?'關鍵字分散在不同頁，請點開逐頁讀。':<><b>第 {page.n} 頁{page.ocr?'（OCR）':''}</b>　{minutesSnippet(page.text,words)}</>}</p>}
  </button>)}
  {archive&&!error&&!rows.length&&<div className="empty-state"><FileText size={26}/><strong>沒有符合的會議紀錄</strong><span>試試較短或同義的字詞。這裡只收桃園市公會網站公開的紀錄，沒有不代表桃園沒有相關決議。</span></div>}
  {rows.length>limit&&<button className="load-more" onClick={()=>setLimit(n=>n+30)}>更多會議紀錄<small>{limit} / {rows.length}</small><ChevronDown size={14}/></button>}
  <p className="coverage-note">市府自己召開並作成決議者，可視為桃園市主管機關的認定（只適用桃園市）；公會自行召開、市府只是轉送的會議，僅供實務參考。紀錄之間有矛盾時，以較新的為準。</p>
  <a className="plain-button" href="https://www.tyaa.org.tw/listFiles.php?Id=665f644e43731ff9db3d341da5c827e1" target="_blank" rel="noreferrer">桃園市建築師公會原始檔案列表<ArrowUpRight size={14}/></a>
 </div>;
}
