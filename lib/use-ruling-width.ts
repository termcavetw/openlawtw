import {useLayoutEffect,useRef,useState} from 'react';
import type {KeyboardEvent,PointerEvent} from 'react';

const storageKey='openlawtw-ruling-width';
const minimum=320;
const divider=10;
function savedWidth(){
  try {const value=Number(localStorage.getItem(storageKey));return Number.isFinite(value)&&value>=minimum?value:null;} catch {return null;}
}

export function useRulingWidth(active:boolean,beforeChange:()=>void){
  const container=useRef<HTMLDivElement>(null);
  const [preferred,setPreferred]=useState<number|null>(savedWidth);
  const [available,setAvailable]=useState(0);
  const [dragging,setDragging]=useState(false);
  const drag=useRef<{id:number;start:number;width:number;previous:number|null}|null>(null);
  const maximum=Math.max(minimum,Math.min(available*.7,available-420-divider));
  const width=Math.round(Math.min(maximum,Math.max(minimum,preferred??available*.4)));
  useLayoutEffect(()=>{
    if(!active||!container.current)return;
    const element=container.current;
    const measure=()=>{beforeChange();setAvailable(element.getBoundingClientRect().width);};
    measure();const observer=new ResizeObserver(measure);observer.observe(element);
    return ()=>observer.disconnect();
  },[active]);
  function persist(value:number|null){try{if(value===null)localStorage.removeItem(storageKey);else localStorage.setItem(storageKey,String(value));}catch{}}
  function change(value:number|null,save=true){beforeChange();const next=value===null?null:Math.round(Math.max(minimum,Math.min(maximum,value)));setPreferred(next);if(save)persist(next);}
  function onPointerDown(e:PointerEvent<HTMLDivElement>){
    if(e.button!==0)return;e.preventDefault();e.currentTarget.focus();
    drag.current={id:e.pointerId,start:e.clientX,width,previous:preferred};
    e.currentTarget.setPointerCapture(e.pointerId);setDragging(true);
  }
  function onPointerMove(e:PointerEvent<HTMLDivElement>){const d=drag.current;if(d?.id===e.pointerId)change(d.width+e.clientX-d.start,false);}
  function finish(e:PointerEvent<HTMLDivElement>,cancel=false){
    const d=drag.current;if(d?.id!==e.pointerId)return;
    if(cancel)change(d.previous,false);else change(d.width+e.clientX-d.start);
    drag.current=null;setDragging(false);
    if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
  }
  function onKeyDown(e:KeyboardEvent<HTMLDivElement>){
    const step=e.shiftKey?80:20;
    const next=e.key==='ArrowRight'?width+step:e.key==='ArrowLeft'?width-step:e.key==='Home'?minimum:e.key==='End'?maximum:e.key==='Enter'?null:undefined;
    if(next!==undefined){e.preventDefault();change(next);}
  }
  return {container,width,dragging,separator:{role:'separator' as const,tabIndex:0,'aria-label':'調整左側函釋欄寬度','aria-orientation':'vertical' as const,'aria-valuemin':minimum,'aria-valuemax':Math.floor(maximum),'aria-valuenow':width,'aria-valuetext':`${width} 像素`,'aria-controls':'article-ruling-panel',title:'拖曳調整函釋欄寬度；雙擊或按 Enter 恢復預設',onPointerDown,onPointerMove,onPointerUp:(e:PointerEvent<HTMLDivElement>)=>finish(e),onPointerCancel:(e:PointerEvent<HTMLDivElement>)=>finish(e,true),onLostPointerCapture:(e:PointerEvent<HTMLDivElement>)=>finish(e,true),onDoubleClick:()=>change(null),onKeyDown}};
}
