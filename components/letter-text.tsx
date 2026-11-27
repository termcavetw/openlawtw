import {useState} from 'react';
import {reflow} from '@/lib/reflow';
// A letter's text as paragraphs (lib/reflow.ts), with the source's own line breaks one tap away.
export function LetterText({text}:{text:string}){
 const [raw,setRaw]=useState(false);
 return <><div className={'minutes-text'+(raw?'':' reflowed')}>{raw?text:reflow(text).map((p,i)=><p key={i}>{p}</p>)}</div>
  <button className="plain-link reflow-toggle" onClick={()=>setRaw(!raw)}>{raw?'改回段落排版':'顯示原始排版'}</button></>;
}
