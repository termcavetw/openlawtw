import {ThinkingOrb} from './thinking-orb';
import {Fragment,useEffect,useMemo,useState,type CSSProperties} from 'react';
import {Dialog as Modal} from 'radix-ui';
import {X,ExternalLink,ArrowUpRight,Pin} from 'lucide-react';
import {loadLaw} from '../lib/data-client';
import {lawHref,legacyLawHash,type ChooseLaw} from '../lib/routes';
import {isPortable} from '../lib/portable';
import {lawById} from '../lib/catalog';
import {splitLegalText} from '../lib/legal-tables';
import {LegalTable} from './legal-table';
import type {LegalReference} from '../lib/citations';
import type {LegalDefinition} from '../lib/legal-definitions';
import type {Article,Law,LegalUnit} from '../lib/law-types';
import './legal-inline-preview.css';
export type InlineSelection=({kind:'definition';definition:LegalDefinition;law:Law}|{kind:'citation';reference:LegalReference})&{trigger:HTMLElement;mode?:'hover'|'pinned'};
function unitById(units:LegalUnit[],id:string):LegalUnit|undefined {for(const u of units){if(u.id===id)return u;const child=unitById(u.children,id);if(child)return child;}}
function PreviewArticle({article,units,label}:{article:Article;units:string[];label:string}){
 const ranges=units.map(id=>unitById(article.structure?.units||[],id)).filter((u):u is LegalUnit=>!!u).sort((a,b)=>a.start-b.start);
 const marked=(text:string,offset:number)=>{const parts=[];let at=0;for(const range of ranges){const start=Math.max(at,range.start-offset,0),end=Math.min(text.length,range.end-offset);if(end<=start)continue;if(start>at)parts.push(<Fragment key={'s'+at}>{text.slice(at,start)}</Fragment>);parts.push(<mark className="legal-preview-target" key={'m'+start}>{text.slice(start,end)}</mark>);at=end;}if(at<text.length)parts.push(<Fragment key={'s'+at}>{text.slice(at)}</Fragment>);return parts;};
 return <div className="legal-preview-text">{splitLegalText(article.text).map(block=>block.kind==='table'?<LegalTable key={block.start} block={block} label={label}/>:<Fragment key={block.start}>{marked(block.text,block.start)}</Fragment>)}</div>;
}
export default function LegalInlinePreview({selection,onClose,onChoose,onPin,onEnter,onLeave}:{selection:InlineSelection;onClose:()=>void;onChoose:ChooseLaw;onPin?:()=>void;onEnter?:()=>void;onLeave?:()=>void}){
 const hover=selection.mode==='hover',law=selection.kind==='definition'?selection.law:selection.reference.law;
 // The official feed's year-9999 sentinel is not an actual effective date.
 const effectiveDate=law.effective&&!/^9999(?:[-/]|$)/.test(law.effective)?law.effective:'';
 const articleNo=selection.kind==='definition'?selection.definition.article:selection.reference.article;
 const unit=selection.kind==='citation'?selection.reference.unit:'';
 const [loaded,setLoaded]=useState<Law|null>(selection.kind==='definition'?law:null),[error,setError]=useState(false),[attempt,setAttempt]=useState(0);
 const [anchor,setAnchor]=useState({left:12,top:12}),[copyStatus,setCopyStatus]=useState('');
 useEffect(()=>{setCopyStatus('');const place=()=>{const rect=selection.trigger.getBoundingClientRect();setAnchor({left:Math.max(12,Math.min(rect.left,innerWidth-472)),top:Math.max(12,Math.min(rect.bottom+8,innerHeight-Math.min(580,innerHeight*.7)-12))});};place();window.addEventListener('resize',place);return()=>window.removeEventListener('resize',place);},[selection]);
 useEffect(()=>{setError(false);if(selection.kind==='definition'){setLoaded(law);return;}const controller=new AbortController();setLoaded(null);setError(false);loadLaw(law.id,controller.signal).then(setLoaded).catch(e=>{if(e.name!=='AbortError')setError(true);});return()=>controller.abort();},[law.id,attempt,selection.kind]);
 const current=selection.kind==='definition'?selection.law:loaded?.id===law.id?loaded:null;
 const groups=useMemo(()=>{if(selection.kind!=='citation')return [];const map=new Map<string,{article:string;units:string[];fallback:boolean}>();for(const t of selection.reference.articleTargets||[selection.reference]){const g=map.get(t.article)||{article:t.article,units:[],fallback:false};if(t.unit&&!g.units.includes(t.unit))g.units.push(t.unit);g.fallback||=t.fallback;map.set(t.article,g);}return [...map.values()];},[selection]);
 const href=(no:string,id='')=>isPortable()?legacyLawHash(law.id,no,id):lawHref(law.id,no,id);
 const navigate=(event:React.MouseEvent,no:string,id='')=>{if(event.button||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();onClose();onChoose(law.id,no,id);};
 const description=selection.kind==='definition'?'本法規的正式定義原文，僅供此法規語境核對。':'官方條文完整快照；有核實項款時以淡色標示，請核對現行版本。';
 const resolution=selection.kind==='citation'?selection.reference.resolution:undefined,basis=selection.kind==='citation'?selection.reference.basis:undefined;
 const resolutionText=resolution==='source'?'未具名條號：依本條文所屬法規核對。':resolution==='paragraph'?'依同一段落已明示的法規核對。':resolution==='alias'?'依原文已宣告的法規簡稱核對。':resolution==='basis'?'依原文訂定依據核對母法。':'';
 const copyText=selection.kind==='definition'?selection.definition.text:groups.map(g=>{const a=current?.articles.find(a=>a.no===g.article);return a?g.article+'\n'+a.text:'';}).filter(Boolean).join('\n\n');
 return <Modal.Root open modal={!hover} onOpenChange={v=>{if(!v)onClose();}}><Modal.Portal>{!hover&&<Modal.Overlay className="legal-preview-backdrop"/>}<Modal.Content className={'legal-preview '+(hover?'legal-preview-hover':'')} style={{'--preview-left':anchor.left+'px','--preview-top':anchor.top+'px'} as CSSProperties} onPointerEnter={onEnter} onPointerLeave={onLeave} onOpenAutoFocus={event=>{if(hover)event.preventDefault();}} onInteractOutside={event=>{if(selection.trigger.contains(event.target as Node))event.preventDefault();}} onCloseAutoFocus={event=>{event.preventDefault();if(!hover&&selection.trigger.isConnected)selection.trigger.focus({preventScroll:true});}}>
  <header><div><Modal.Title>{selection.kind==='definition'?selection.definition.term:'引用法條'}</Modal.Title><Modal.Description>{law.name} · {groups.length>1?`${groups.length} 條／點`:articleNo}</Modal.Description>{hover&&<span className="legal-preview-hover-note">滑過預覽 · 點擊引用可固定</span>}</div><div className="legal-preview-controls">{hover&&<button className="legal-preview-close" aria-label="固定引用預覽" onClick={onPin}><Pin size={16}/></button>}<Modal.Close className="legal-preview-close" aria-label="關閉解釋與引用"><X size={18}/></Modal.Close></div></header>
  <div className="legal-preview-body"><p className="legal-preview-note">{description}</p>{resolutionText&&<p className="legal-preview-context">{resolutionText}</p>}
   {error&&selection.kind==='citation'?<div role="alert"><p>原文暫時無法載入。</p><button className="legal-preview-action" onClick={()=>setAttempt(n=>n+1)}>重試</button></div>:!current?<p role="status"><ThinkingOrb/> 正在載入官方原文…</p>:selection.kind==='definition'?<div className="legal-preview-text">{selection.definition.text}</div>:groups.map(g=>{const article=current.articles.find(a=>a.no===g.article);return <section className="legal-preview-article" key={g.article}><h3>{g.article}<a href={href(g.article,g.units[0])} onClick={e=>navigate(e,g.article,g.units[0])} aria-label={'閱讀'+g.article+'完整法條'}>前往此條<ArrowUpRight size={12}/></a></h3>{g.fallback&&<p className="legal-preview-note">引用項款未核實，不推測定位；請核對整條原文。</p>}{article?<PreviewArticle article={article} units={g.units} label={law.name+' '+g.article}/>:<p role="alert">本版本找不到對應條文，請核對官方來源。</p>}</section>;})}
   <footer><a href={href(articleNo,unit)} onClick={event=>navigate(event,articleNo,unit)}>閱讀完整法條<ArrowUpRight size={13}/></a><a href={law.url} target="_blank" rel="noreferrer">官方來源<ExternalLink size={12}/></a><button className="legal-preview-action" disabled={!copyText} onClick={async()=>{try{await navigator.clipboard.writeText(law.name+' '+articleNo+'\n'+copyText+'\n'+law.url);setCopyStatus('已複製原文');}catch{setCopyStatus('無法複製，請選取原文');}}}>複製條文</button><span role="status">{copyStatus}</span><span>快照：{law.snapshot||law.retrieved||'日期未列'}</span>{effectiveDate&&<span>法規生效日期：{effectiveDate}</span>}{basis?.sourceLaw&&basis.sourceArticle&&<a href={isPortable()?legacyLawHash(basis.sourceLaw,basis.sourceArticle):lawHref(basis.sourceLaw,basis.sourceArticle)} onClick={e=>{if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();onClose();onChoose(basis.sourceLaw,basis.sourceArticle);}}>引用語境依據：{lawById.get(basis.sourceLaw)?.name||'來源法規'} {basis.sourceArticle}</a>}</footer>
  </div>
 </Modal.Content></Modal.Portal></Modal.Root>;
}
