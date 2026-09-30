import {useEffect,useMemo,useState,type ReactNode} from 'react';
import {data} from '@/lib/catalog';
import {createCitationMatcher,type CitationTargets,type LegalReference} from '@/lib/citations';
import targets from '@/data/runtime-citations.json';
import {lawHref,legacyLawHash,type ChooseLaw} from '@/lib/routes';
import {isPortable} from '@/lib/portable';
import type {Law} from '@/lib/law-types';
import type {DefinitionOccurrence} from '@/lib/legal-definitions';
import LegalInlinePreview,{type InlineSelection} from './legal-inline-preview';
import './legal-inline-preview.css';
export const findLegalReferences=createCitationMatcher(data.laws,targets as unknown as CitationTargets);
export function LegalReferenceText({text,law,onChoose,renderText=(text:string)=>text,definitions=[],sourceOffset=0,references}:{text:string;law?:Law;onChoose:ChooseLaw;renderText?:(text:string)=>ReactNode;definitions?:DefinitionOccurrence[];sourceOffset?:number;references?:LegalReference[]}){
 const found=useMemo(()=>references?references.filter(r=>r.start>=sourceOffset&&r.end<=sourceOffset+text.length).map(r=>({...r,start:r.start-sourceOffset,end:r.end-sourceOffset})):findLegalReferences(text,law),[references,text,law,sourceOffset]);
 const [selection,setSelection]=useState<InlineSelection|null>(null);
 useEffect(()=>{if(!selection)return;const close=()=>setSelection(null);window.addEventListener('popstate',close);window.addEventListener('hashchange',close);return()=>{window.removeEventListener('popstate',close);window.removeEventListener('hashchange',close);};},[!!selection]);
 useEffect(()=>setSelection(null),[text,law?.id]);
 const terms=definitions.filter(d=>d.start>=sourceOffset&&d.end<=sourceOffset+text.length&&!found.some(r=>d.start-sourceOffset<r.end&&d.end-sourceOffset>r.start)).map(d=>({...d,start:d.start-sourceOffset,end:d.end-sourceOffset}));
 const hits=[...found.map(ref=>({start:ref.start,end:ref.end,ref})),...terms.map(term=>({start:term.start,end:term.end,term}))].sort((a,b)=>a.start-b.start);
 const parts:ReactNode[]=[];let at=0;
 for(const hit of hits){
  if(hit.start>at)parts.push(<span key={'t'+at}>{renderText(text.slice(at,hit.start))}</span>);
  if('ref' in hit){const ref=hit.ref;const href=isPortable()?legacyLawHash(ref.law.id,ref.article,ref.unit):lawHref(ref.law.id,ref.article,ref.unit);
   parts.push(<a key={'r'+ref.start} className="legal-reference" href={href} aria-haspopup="dialog" title={`查看《${ref.law.name}》${ref.article} · 本庫快照${ref.fallback?'（項款未核實，顯示整條）':''}`} data-citation-target={ref.unit?'unit':'article'} onClick={event=>{if(event.button||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();if(window.getSelection()?.toString())return;setSelection({kind:'citation',reference:ref,trigger:event.currentTarget});}}>{renderText(text.slice(ref.start,ref.end))}</a>);
  }else if(law){const term=hit.term;parts.push(<button type="button" key={'d'+term.start} className="legal-definition" aria-haspopup="dialog" aria-label={term.definition.term+'：查看本法規定義'} onClick={event=>{if(window.getSelection()?.toString())return;setSelection({kind:'definition',definition:term.definition,law,trigger:event.currentTarget});}}>{renderText(text.slice(term.start,term.end))}</button>);}
  at=hit.end;
 }
 if(at<text.length)parts.push(<span key={'t'+at}>{renderText(text.slice(at))}</span>);
 return <>{parts}{selection&&<LegalInlinePreview selection={selection} onClose={()=>setSelection(null)} onChoose={onChoose}/>}</>;
}
