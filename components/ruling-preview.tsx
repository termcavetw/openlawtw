import {useEffect,useRef,useState} from 'react';
import {loadRuling} from '@/lib/data-client';
import type {Ruling} from '@/lib/law-types';
import {rulingPreviewText} from '@/lib/ruling-preview';
import './ruling-preview.css';

/** List-only preview. Full records from search are reused without another load. */
export function RulingPreview({ruling}:{ruling:Ruling}){
 const host=useRef<HTMLDivElement>(null);
 const [result,setResult]=useState<{id:string;body:string;failed:boolean}|null>(null);
 const needsBody=!!ruling.summaryOnly&&!ruling.body.trim();
 const current=result?.id===ruling.id?result:null;
 useEffect(()=>{
  if(!needsBody||!host.current)return;
  const element=host.current,controller=new AbortController();let started=false;
  const load=()=>{
   if(started||controller.signal.aborted)return;started=true;
   loadRuling(ruling.id,controller.signal).then(full=>{
    if(!controller.signal.aborted)setResult({id:ruling.id,body:full.body,failed:false});
   }).catch(error=>{
    if(error.name!=='AbortError'&&!controller.signal.aborted)setResult({id:ruling.id,body:'',failed:true});
   });
  };
  // Observe the actual clipped list viewport: scrolling through the corpus does
  // not prefetch every card or every ruling bucket. The data client coalesces
  // visible cards that share a bucket and reuses its existing offline/cache data.
  if(typeof IntersectionObserver!=='undefined'){
   const observer=new IntersectionObserver(entries=>{
    if(entries.some(entry=>entry.isIntersecting)){observer.disconnect();load();}
   },{rootMargin:'120px 0px'});
   observer.observe(element);
   return()=>{observer.disconnect();controller.abort();};
  }
  // Older browsers keep a visible-only fallback, including nested list scroll.
  const check=()=>{const rect=element.getBoundingClientRect();if(rect.width&&rect.height&&rect.bottom>0&&rect.top<window.innerHeight&&rect.right>0&&rect.left<window.innerWidth)load();};
  check();document.addEventListener('scroll',check,true);window.addEventListener('resize',check);
  return()=>{controller.abort();document.removeEventListener('scroll',check,true);window.removeEventListener('resize',check);};
 },[ruling.id,needsBody]);
 const text=rulingPreviewText({title:ruling.title,body:needsBody?(current?.body||''):ruling.body});
 const state=!needsBody||current?(current?.failed&&needsBody?'error':text?'ready':'empty'):'loading';
 return <div ref={host} className="ruling-preview" data-preview-state={state}>
  <span className="ruling-preview-label">解釋內容節錄</span>
  {state==='ready'?<p className="ruling-preview-excerpt">{text}</p>:<p className="ruling-preview-message">{state==='loading'?'正在載入解釋內容…':state==='error'?'內容預覽暫時無法載入，點開函釋可重試。':'本筆未收錄主旨以外的解釋本文，請核對官方原文。'}</p>}
 </div>;
}
