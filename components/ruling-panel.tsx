import {useEffect,useMemo,useRef,useState} from 'react';
import {ArrowLeft,ChevronDown,FileText,LoaderCircle,Search,X} from 'lucide-react';
import {RulingCard,RulingReader} from './rulings';
import {loadHeads,loadRuling} from '../lib/data-client';
import {searchRulings} from '../lib/search';
import {lawById} from '../lib/catalog';
import type {Article,Law,Ruling} from '../lib/law-types';

export function RulingPanel({law,article,items,initial,count,summariesLoading,summariesError,onRetry,onClose,onChoose,onCopy,saved,onSave}:{law:Law;article:Article|null;items:Ruling[];initial?:Ruling;count?:number;summariesLoading:boolean;summariesError:boolean;onRetry:()=>void;onClose:()=>void;onChoose:(id:string,article?:string,unit?:string)=>void;onCopy:(text:string)=>void;saved:string[];onSave:(id:string)=>void}){
 const [selection,setSelection]=useState<Ruling|null>(initial||null),[full,setFull]=useState<Ruling|null>(null),[history,setHistory]=useState<Ruling[]>([]);
 const [loading,setLoading]=useState(false),[error,setError]=useState(false),[retry,setRetry]=useState(0);
 const [query,setQuery]=useState(''),[limit,setLimit]=useState(20),[heads,setHeads]=useState<Ruling[]>(items);
 const list=useRef<HTMLDivElement>(null),listPosition=useRef(0);
 useEffect(()=>{if(!selection){setFull(null);return;}const controller=new AbortController();setLoading(true);setError(false);setFull(null);(selection.summaryOnly?loadRuling(selection.id,controller.signal):Promise.resolve(selection)).then(setFull).catch(e=>{if(e.name!=='AbortError')setError(true);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});return()=>controller.abort();},[selection?.id,retry]);
 useEffect(()=>{if(!selection)return;const controller=new AbortController();loadHeads(controller.signal).then(setHeads).catch(()=>{});return()=>controller.abort();},[!!selection]);
 const found=useMemo(()=>query.trim()?searchRulings(items,query):items,[items,query]);
 function openRuling(r:Ruling){listPosition.current=list.current?.scrollTop||0;if(selection&&selection.id!==r.id)setHistory(prev=>[...prev,selection]);setSelection(r);}
 function back(){const previous=history.at(-1);if(previous){setHistory(prev=>prev.slice(0,-1));setSelection(previous);}else{setSelection(null);requestAnimationFrame(()=>{if(list.current)list.current.scrollTop=listPosition.current;});}}
 return <div className="ruling-panel-content" id="article-ruling-panel">
  <button className="pair-return" onClick={onClose}><ArrowLeft size={15}/><span>返回搜尋與目錄</span></button><header className="ruling-panel-heading"><div><span className="eyebrow">條文與函釋並讀</span><h3>{article?.no||'本法規'} <span>解釋令 {count??items.length}</span></h3></div><button className="icon-btn" onClick={onClose} aria-label="關閉函釋並讀"><X size={19}/></button></header>
  <p className="ruling-panel-law">{law.name}</p>
  <div className="ruling-panel-list" ref={list} hidden={!!selection}>
   <p className="ruling-panel-intro">{article?'依原文明示條號連結。點選後在此閱讀，原條文保留在旁。':'此法規已連結的解釋函令。'}</p>
   {summariesLoading?<p className="ruling-list-message" role="status"><LoaderCircle size={18}/>正在載入相關函釋…</p>:summariesError?<div className="ruling-list-message" role="alert"><p>相關函釋尚未下載，請連線後重試。</p><button className="plain-button" onClick={onRetry}>重新載入函釋</button></div>:<><label className="ruling-search"><Search size={15}/><input autoComplete="off" value={query} onChange={e=>{setQuery(e.target.value);setLimit(20);}} aria-label="搜尋此條相關函釋" placeholder="搜尋主旨、字號或引用文字"/>{query&&<button onClick={()=>setQuery('')} aria-label="清除並讀搜尋"><X size={14}/></button>}</label>
   <div className="ruling-result-count" role="status">{found.length} 筆函釋</div>
   {found.slice(0,limit).map(r=><RulingCard key={r.id} ruling={r} onClick={()=>openRuling(r)}/>)}
   {found.length>limit&&<button className="load-more" onClick={()=>setLimit(n=>n+20)}>載入更多<ChevronDown size={15}/></button>}
   {!found.length&&<div className="empty-state"><FileText size={24}/>沒有符合的已收錄函釋。</div>}</>}
  </div>
  {selection&&(loading||error)&&<div className="ruling-panel-pending"><button className="plain-button" onClick={back}><ArrowLeft size={14}/>返回函釋清單</button>{loading?<p role="status"><LoaderCircle size={18}/>正在載入函釋全文…</p>:<><p role="alert">這份函釋全文尚未下載，請連線後重試。</p><button className="plain-button" onClick={()=>setRetry(n=>n+1)}>重新載入</button><a href={selection.url} target="_blank" rel="noreferrer">官方原函</a></>}</div>}
  {selection&&full&&!loading&&!error&&<RulingReader ruling={full} items={heads} lawById={lawById} onBack={back} backLabel={history.length?'上一則函釋':'函釋清單'} onOpen={openRuling} onChoose={onChoose} onCopy={onCopy} saved={saved.includes(full.id)} onSave={()=>onSave(full.id)} reference={{law:law.id,article:article?.no||''}}/>}
 </div>;
}
