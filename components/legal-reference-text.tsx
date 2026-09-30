import {useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {data} from '@/lib/catalog';
import {createCitationMatcher,type CitationTargets,type LegalReference,type CitationContext} from '@/lib/citations';
import targets from '@/data/runtime-citations.json';
import citationContext from '@/data/runtime-citation-context.json';
import {lawHref,legacyLawHash,type ChooseLaw} from '@/lib/routes';
import {isPortable} from '@/lib/portable';
import type {Law} from '@/lib/law-types';
import type {DefinitionOccurrence} from '@/lib/legal-definitions';
import LegalInlinePreview,{type InlineSelection} from './legal-inline-preview';
import './legal-inline-preview.css';
export const findLegalReferences=createCitationMatcher(data.laws,targets as unknown as CitationTargets,citationContext as CitationContext);
let activePreview:{owner:object;pinned:boolean;close:()=>void}|null=null;
export function LegalReferenceText({text,law,onChoose,renderText=(text:string)=>text,definitions=[],sourceOffset=0,references}:{text:string;law?:Law;onChoose:ChooseLaw;renderText?:(text:string)=>ReactNode;definitions?:DefinitionOccurrence[];sourceOffset?:number;references?:LegalReference[]}){
 const found=useMemo(()=>references?references.filter(r=>r.start>=sourceOffset&&r.end<=sourceOffset+text.length).map(r=>({...r,start:r.start-sourceOffset,end:r.end-sourceOffset})):findLegalReferences(text,law),[references,text,law,sourceOffset]);
 const [selection,setSelection]=useState<InlineSelection|null>(null);
 const owner=useRef({}),timer=useRef<ReturnType<typeof setTimeout>|null>(null),currentSelection=useRef<InlineSelection|null>(null);
 const cancelTimer=()=>{if(timer.current){clearTimeout(timer.current);timer.current=null;}};
 const close=()=>{cancelTimer();currentSelection.current=null;setSelection(null);if(activePreview?.owner===owner.current)activePreview=null;};
 const show=(next:InlineSelection)=>{cancelTimer();if(activePreview?.owner!==owner.current)activePreview?.close();currentSelection.current=next;activePreview={owner:owner.current,pinned:next.mode!=='hover',close};setSelection(next);};
 const leave=()=>{cancelTimer();if(currentSelection.current?.mode==='hover')timer.current=setTimeout(close,250);};
 const hover=(ref:LegalReference,trigger:HTMLElement)=>{if(innerWidth<900||!matchMedia('(hover:hover) and (pointer:fine)').matches||activePreview?.pinned)return;cancelTimer();timer.current=setTimeout(()=>show({kind:'citation',reference:ref,trigger,mode:'hover'}),220);};
 useEffect(()=>()=>{cancelTimer();if(activePreview?.owner===owner.current)activePreview=null;},[]);
 useEffect(()=>{if(!selection)return;window.addEventListener('popstate',close);window.addEventListener('hashchange',close);return()=>{window.removeEventListener('popstate',close);window.removeEventListener('hashchange',close);};},[!!selection]);
 useEffect(()=>close(),[text,law?.id]);
 const terms=definitions.filter(d=>d.start>=sourceOffset&&d.end<=sourceOffset+text.length&&!found.some(r=>d.start-sourceOffset<r.end&&d.end-sourceOffset>r.start)).map(d=>({...d,start:d.start-sourceOffset,end:d.end-sourceOffset}));
 const hits=[...found.map(ref=>({start:ref.start,end:ref.end,ref})),...terms.map(term=>({start:term.start,end:term.end,term}))].sort((a,b)=>a.start-b.start);
 const parts:ReactNode[]=[];let at=0;
 for(const hit of hits){
  if(hit.start>at)parts.push(<span key={'t'+at}>{renderText(text.slice(at,hit.start))}</span>);
  if('ref' in hit){const ref=hit.ref;const href=isPortable()?legacyLawHash(ref.law.id,ref.article,ref.unit):lawHref(ref.law.id,ref.article,ref.unit);
   parts.push(<a key={'r'+ref.start} className="legal-reference" href={href} aria-haspopup="dialog" title={`查看《${ref.law.name}》${ref.article} · 本庫快照${ref.fallback?'（項款未核實，顯示整條）':''}`} data-citation-target={ref.unit?'unit':'article'} onPointerEnter={event=>{if(event.pointerType==='mouse')hover(ref,event.currentTarget);}} onPointerLeave={leave} onClick={event=>{if(event.button||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();if(event.detail>0&&window.getSelection()?.toString())return;show({kind:'citation',reference:ref,trigger:event.currentTarget,mode:'pinned'});}}>{renderText(text.slice(ref.start,ref.end))}</a>);
  }else if(law){const term=hit.term;parts.push(<button type="button" key={'d'+term.start} className="legal-definition" aria-haspopup="dialog" aria-label={term.definition.term+'：查看本法規定義'} onClick={event=>{if(event.detail>0&&window.getSelection()?.toString())return;show({kind:'definition',definition:term.definition,law,trigger:event.currentTarget,mode:'pinned'});}}>{renderText(text.slice(term.start,term.end))}</button>);}
  at=hit.end;
 }
 if(at<text.length)parts.push(<span key={'t'+at}>{renderText(text.slice(at))}</span>);
 return <>{parts}{selection&&<LegalInlinePreview selection={selection} onClose={close} onChoose={onChoose} onEnter={cancelTimer} onLeave={leave} onPin={()=>{if(currentSelection.current)show({...currentSelection.current,mode:'pinned'});}}/>}</>;
}
