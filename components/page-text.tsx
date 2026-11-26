import {useEffect,useMemo,useState,type ReactNode} from 'react';
import {layoutPage} from '@/lib/ocr-layout';
import type {PageTable} from '@/lib/law-types';
// One page of minutes / 土管 text: a reading layout by default (paragraphs, lists, tables), the raw text on request.
export function PageText({text,empty,source,tables}:{text:string;empty:string;source?:string;tables?:PageTable[]}){
 const [raw,setRaw]=useState(false);
 // Rebuilt tables take the place of their lines; the text around them gets the reading layout.
 const parts=useMemo(()=>{const lines=text.split('\n'),out:({kind:'model';table:PageTable}|{kind:'text';blocks:ReturnType<typeof layoutPage>})[]=[];let at=0;
  for(const t of [...(tables||[])].sort((a,b)=>a.from-b.from)){if(t.from<at)continue;if(t.from>at)out.push({kind:'text',blocks:layoutPage(lines.slice(at,t.from).join('\n'))});out.push({kind:'model',table:t});at=t.to;}
  if(at<lines.length)out.push({kind:'text',blocks:layoutPage(lines.slice(at).join('\n'))});return out;},[text,tables]);
 if(!text.trim())return <div className="minutes-text">{empty}</div>;
 const check=source?<a href={source} target="_blank" rel="noreferrer">請對照原檔</a>:'請對照原檔';
 return <div className="page-text">
  <div className="page-text-mode" role="group" aria-label="文字顯示方式"><button aria-pressed={!raw} onClick={()=>setRaw(false)}>排版閱讀</button><button aria-pressed={raw} onClick={()=>setRaw(true)}>原始文字</button></div>
  {raw?<div className="minutes-text">{text}</div>:<div className="ocr-flow">{parts.map((part,pi)=>part.kind==='model'?<ModelTable key={pi} table={part.table} check={check}/>:part.blocks.map((b,i)=>{
   if(b.kind==='meta')return <p key={pi+'-'+i} className="ocr-meta">{b.text}</p>;
   if(b.kind==='raw')return <div key={pi+'-'+i} className="ocr-raw"><p className="ocr-table-warn">這段表格的欄位無法可靠對齊，以下是原始辨識文字（「|」分隔同一列的格子），{check}。</p><pre>{b.lines.join('\n')}</pre></div>;
   if(b.kind==='table')return <div key={pi+'-'+i}>{b.warn&&<p className="ocr-table-warn">{b.merged?'跨行的名稱已自動併回第一欄；':''}欄位可能錯位，{check}。</p>}<div className="ocr-table-wrap"><table className="ocr-table"><tbody>{b.rows.map((r,k)=><tr key={k}>{r.map((c,m)=><td key={m} colSpan={r.length===1?b.cols:undefined}>{c}</td>)}</tr>)}</tbody></table></div></div>;
   return <p key={pi+'-'+i} className={'ocr-p l'+b.level+(b.marker?' ocr-mark':'')+(b.head?' ocr-h':'')}>{b.text}</p>;
  }))}</div>}
 </div>;
}
// Desktop readers sit in the narrow sidebar; 放大閱讀 lifts the reader into a full-window page (Esc closes).
export function useWide(){
 const [wide,setWide]=useState(false);
 useEffect(()=>{if(!wide)return;const key=(e:KeyboardEvent)=>{if(e.key==='Escape')setWide(false);};document.addEventListener('keydown',key);document.body.style.overflow='hidden';return()=>{document.removeEventListener('keydown',key);document.body.style.overflow='';};},[wide]);
 return [wide,setWide] as const;
}
export const WideButton=({wide,setWide}:{wide:boolean;setWide:(v:boolean)=>void})=><button className="minutes-copy page-wide" aria-pressed={wide} onClick={()=>setWide(!wide)}>{wide?'結束放大':'放大閱讀'}</button>;
function ModelTable({table,check}:{table:PageTable;check:ReactNode}){
 return <div className="ocr-model"><p className="ocr-table-warn">表格由辨識模型依掃描影像重建（含合併儲存格），數字與欄位仍可能有誤，{check}。</p><div className="ocr-table-wrap"><table className="ocr-table"><tbody>{table.rows.map((r,k)=><tr key={k}>{r.map((c,m)=><td key={m} colSpan={c[1]&&c[1]>1?c[1]:undefined} rowSpan={c[2]&&c[2]>1?c[2]:undefined}>{c[0]}</td>)}</tr>)}</tbody></table></div></div>;
}
