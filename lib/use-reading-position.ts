import {useEffect,type RefObject} from 'react';
/** Explicit article links take priority; ordinary reopens resume an observed article. */
export function useReadingPosition(ref:RefObject<HTMLDivElement|null>,id:string,ready:boolean,explicit:string,navigationKey:number){
 useEffect(()=>{
  const pane=ref.current;if(!pane||!ready)return;const key='openlawtw-position:'+id;
  let latest:string|null=null,timer:ReturnType<typeof setTimeout>|undefined,frame=0,live=true;
  const save=()=>{if(latest)try{localStorage.setItem(key,latest);}catch{}};
  const capture=()=>{const top=pane.getBoundingClientRect().top;const el=Array.from(pane.querySelectorAll<HTMLElement>('[data-article]')).find(e=>e.getBoundingClientRect().bottom>top);if(!el)return;latest=JSON.stringify({article:el.dataset.article,offset:el.getBoundingClientRect().top-top});clearTimeout(timer);timer=setTimeout(save,200);};
  frame=requestAnimationFrame(()=>{frame=requestAnimationFrame(()=>{if(!live)return;if(!explicit)try{const saved=JSON.parse(localStorage.getItem(key)||'null');const el=Array.from(pane.querySelectorAll<HTMLElement>('[data-article]')).find(e=>e.dataset.article===saved?.article);if(el&&Number.isFinite(saved.offset))pane.scrollTop+=el.getBoundingClientRect().top-pane.getBoundingClientRect().top-saved.offset;}catch{}capture();pane.addEventListener('scroll',capture,{passive:true});window.addEventListener('pagehide',save);});});
  return()=>{live=false;cancelAnimationFrame(frame);clearTimeout(timer);save();pane.removeEventListener('scroll',capture);window.removeEventListener('pagehide',save);};
 },[id,ready,explicit,navigationKey,ref]);
}
