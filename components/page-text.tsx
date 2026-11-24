import {useEffect,useMemo,useState} from 'react';
import {layoutPage} from '@/lib/ocr-layout';
// One page of minutes / 土管 text: a reading layout by default (paragraphs, lists, tables), the raw text on request.
export function PageText({text,empty,source}:{text:string;empty:string;source?:string}){
 const [raw,setRaw]=useState(false);
 const blocks=useMemo(()=>layoutPage(text),[text]);
 if(!text.trim())return <div className="minutes-text">{empty}</div>;
 return <div className="page-text">
  <div className="page-text-mode" role="group" aria-label="文字顯示方式"><button aria-pressed={!raw} onClick={()=>setRaw(false)}>排版閱讀</button><button aria-pressed={raw} onClick={()=>setRaw(true)}>原始文字</button></div>
  {raw?<div className="minutes-text">{text}</div>:<div className="ocr-flow">{blocks.map((b,i)=>{
   if(b.kind==='meta')return <p key={i} className="ocr-meta">{b.text}</p>;
   const check=source?<a href={source} target="_blank" rel="noreferrer">請對照原檔</a>:'請對照原檔';
   if(b.kind==='raw')return <div key={i} className="ocr-raw"><p className="ocr-table-warn">這段表格的欄位無法可靠對齊，以下是原始辨識文字（「|」分隔同一列的格子），{check}。</p><pre>{b.lines.join('\n')}</pre></div>;
   if(b.kind==='table')return <div key={i}>{b.warn&&<p className="ocr-table-warn">{b.merged?'跨行的名稱已自動併回第一欄；':''}欄位可能錯位，{check}。</p>}<div className="ocr-table-wrap"><table className="ocr-table"><tbody>{b.rows.map((r,k)=><tr key={k}>{r.map((c,m)=><td key={m} colSpan={r.length===1?b.cols:undefined}>{c}</td>)}</tr>)}</tbody></table></div></div>;
   return <p key={i} className={'ocr-p l'+b.level+(b.marker?' ocr-mark':'')+(b.head?' ocr-h':'')}>{b.text}</p>;
  })}</div>}
 </div>;
}
// Desktop readers sit in the narrow sidebar; 放大閱讀 lifts the reader into a full-window page (Esc closes).
export function useWide(){
 const [wide,setWide]=useState(false);
 useEffect(()=>{if(!wide)return;const key=(e:KeyboardEvent)=>{if(e.key==='Escape')setWide(false);};document.addEventListener('keydown',key);document.body.style.overflow='hidden';return()=>{document.removeEventListener('keydown',key);document.body.style.overflow='';};},[wide]);
 return [wide,setWide] as const;
}
export const WideButton=({wide,setWide}:{wide:boolean;setWide:(v:boolean)=>void})=><button className="minutes-copy page-wide" aria-pressed={wide} onClick={()=>setWide(!wide)}>{wide?'結束放大':'放大閱讀'}</button>;
