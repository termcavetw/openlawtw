import {useMemo,type ReactNode} from 'react';
import {data} from '@/lib/catalog';
import {createCitationMatcher,type CitationTargets} from '@/lib/citations';
import targets from '@/data/runtime-citations.json';
import {lawHref,legacyLawHash,type ChooseLaw} from '@/lib/routes';
import {isPortable} from '@/lib/portable';
import type {Law} from '@/lib/law-types';
const findReferences=createCitationMatcher(data.laws,targets as unknown as CitationTargets);
export function LegalReferenceText({text,law,onChoose,renderText=(text:string)=>text}:{text:string;law?:Law;onChoose:ChooseLaw;renderText?:(text:string)=>ReactNode}){
 const references=useMemo(()=>findReferences(text,law),[text,law?.id]);
 const parts:ReactNode[]=[];let at=0;
 for(const ref of references){
  if(ref.start>at)parts.push(<span key={'t'+at}>{renderText(text.slice(at,ref.start))}</span>);
  const href=isPortable()?legacyLawHash(ref.law.id,ref.article,ref.unit):lawHref(ref.law.id,ref.article,ref.unit);
  parts.push(<a key={'r'+ref.start} className="legal-reference" href={href} title={`閱讀《${ref.law.name}》${ref.article} · 本庫快照${ref.fallback?'（項款未核實，連至整條）':''}`} data-citation-target={ref.unit?'unit':'article'} onClick={event=>{if(event.button||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();onChoose(ref.law.id,ref.article,ref.unit);}}>{renderText(text.slice(ref.start,ref.end))}</a>);
  at=ref.end;
 }
 if(at<text.length)parts.push(<span key={'t'+at}>{renderText(text.slice(at))}</span>);
 return <>{parts}</>;
}
