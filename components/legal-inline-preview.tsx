import {useEffect,useState,type CSSProperties} from 'react';
import {Dialog as Modal} from 'radix-ui';
import {X,ExternalLink,ArrowUpRight} from 'lucide-react';
import {loadLaw} from '../lib/data-client';
import {lawHref,legacyLawHash,type ChooseLaw} from '../lib/routes';
import {isPortable} from '../lib/portable';
import {LegalTextWithTables} from './legal-table';
import type {LegalReference} from '../lib/citations';
import type {LegalDefinition} from '../lib/legal-definitions';
import type {Law,LegalUnit} from '../lib/law-types';
import './legal-inline-preview.css';
export type InlineSelection={kind:'definition';definition:LegalDefinition;law:Law;trigger:HTMLElement}|{kind:'citation';reference:LegalReference;trigger:HTMLElement};
function unitById(units:LegalUnit[],id:string):LegalUnit|undefined {for(const u of units){if(u.id===id)return u;const child=unitById(u.children,id);if(child)return child;}}
export default function LegalInlinePreview({selection,onClose,onChoose}:{selection:InlineSelection;onClose:()=>void;onChoose:ChooseLaw}){
 const law=selection.kind==='definition'?selection.law:selection.reference.law;
 // Official feeds use year 9999 as an undetermined-date sentinel.
 const effectiveDate=law.effective&&!/^9999(?:[-/]|$)/.test(law.effective)?law.effective:'';
 const articleNo=selection.kind==='definition'?selection.definition.article:selection.reference.article;
 const unit=selection.kind==='citation'?selection.reference.unit:'';
 const [loaded,setLoaded]=useState<Law|null>(selection.kind==='definition'?law:null),[error,setError]=useState(false),[attempt,setAttempt]=useState(0);
 const [anchor,setAnchor]=useState({left:12,top:12});
 useEffect(()=>{const place=()=>{const rect=selection.trigger.getBoundingClientRect();setAnchor({left:Math.max(12,Math.min(rect.left,innerWidth-452)),top:Math.max(12,Math.min(rect.bottom+8,innerHeight-Math.min(560,innerHeight*.7)-12))});};place();window.addEventListener('resize',place);return()=>window.removeEventListener('resize',place);},[selection]);
 useEffect(()=>{if(selection.kind==='definition')return;const controller=new AbortController();setError(false);loadLaw(law.id,controller.signal).then(setLoaded).catch(e=>{if(e.name!=='AbortError')setError(true);});return()=>controller.abort();},[law.id,attempt,selection.kind]);
 const article=loaded?.articles.find(a=>a.no===articleNo),target=unit?unitById(article?.structure?.units||[],unit):undefined;
 const text=selection.kind==='definition'?selection.definition.text:article?(target?article.text.slice(target.start,target.end):article.text):'';
 const href=isPortable()?legacyLawHash(law.id,articleNo,unit):lawHref(law.id,articleNo,unit);
 return <Modal.Root open onOpenChange={v=>{if(!v)onClose();}}><Modal.Portal><Modal.Overlay className="legal-preview-backdrop"/><Modal.Content className="legal-preview" style={{'--preview-left':anchor.left+'px','--preview-top':anchor.top+'px'} as CSSProperties} onCloseAutoFocus={event=>{event.preventDefault();if(selection.trigger.isConnected)selection.trigger.focus({preventScroll:true});}}>
  <header><div><Modal.Title>{selection.kind==='definition'?selection.definition.term:'引用法條'}</Modal.Title><Modal.Description>{law.name} · {articleNo}{target?' · 指定項款':''}</Modal.Description></div><Modal.Close className="legal-preview-close" aria-label="關閉解釋與引用"><X size={18}/></Modal.Close></header>
  <div className="legal-preview-body">
   <p className="legal-preview-note">{selection.kind==='definition'?'本法規的正式定義原文，僅供此法規語境核對。':'以下為本庫收錄的官方條文快照，請核對現行版本。'}{selection.kind==='citation'&&selection.reference.fallback?' 引用的項款尚未核實，顯示整條。':''}</p>
   {error?<div role="alert"><p>原文暫時無法載入。</p><button onClick={()=>setAttempt(n=>n+1)}>重試</button></div>:!loaded?<p role="status">正在載入官方原文…</p>:text?<div className="legal-preview-text"><LegalTextWithTables text={text} label={law.name+' '+articleNo} renderText={part=>part}/></div>:<p role="alert">本版本找不到對應條文，請核對官方來源。</p>}
   <footer><a href={href} onClick={event=>{if(event.button||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();onClose();onChoose(law.id,articleNo,unit);}}>閱讀完整法條<ArrowUpRight size={13}/></a><a href={law.url} target="_blank" rel="noreferrer">官方來源<ExternalLink size={12}/></a><span>快照：{law.snapshot||law.retrieved||'日期未列'}</span>{effectiveDate&&<span>法規生效日期：{effectiveDate}</span>}</footer>
  </div>
 </Modal.Content></Modal.Portal></Modal.Root>;
}
