import {useState,useMemo,Fragment,type ReactNode} from 'react';
import {Copy,Link2,ChevronDown} from 'lucide-react';
import type {Article,Law,LegalUnit} from '@/lib/law-types';
import {Highlight} from './law-navigation';
import {LegalReferenceText,findLegalReferences} from './legal-reference-text';
import {lawHref,unitAnchor,type ChooseLaw} from '@/lib/routes';
import {shareURL} from '@/lib/portable';
import {AddEvidenceButton} from './casebook';
import {ReferenceShareButton} from './reference-share';
import {LegalTable} from './legal-table';
import {splitLegalText} from '@/lib/legal-tables';
import {definitionOccurrences} from '@/lib/legal-definitions';
import {makeArticleEvidence} from '@/lib/casebook';
export function ArticleText({article,law,query,fontSize,onCopy,onChoose,activeUnit}:{article:Article;law:Law;query:string;fontSize:number;onCopy:(s:string)=>void;onChoose:ChooseLaw;activeUnit:string}){
 const [opened,setOpened]=useState(false);
 const citations=useMemo(()=>findLegalReferences(article.text,law,article),[article,law]);
 const definitions=useMemo(()=>definitionOccurrences(law,article,citations),[article,law,citations]);
 const linked=(text:string,offset:number)=><LegalReferenceText text={text} law={law} onChoose={onChoose} references={citations} definitions={definitions} sourceOffset={offset} renderText={part=><Highlight text={part} query={query}/>}/>;
 const formatted=(text:string,offset:number)=><>{splitLegalText(text).map(block=>block.kind==='table'?<LegalTable key={block.start} block={block} label={law.name+' '+article.no} renderText={part=><LegalReferenceText text={part} onChoose={onChoose} renderText={piece=><Highlight text={piece} query={query}/>}/>}/>:<Fragment key={block.start}>{linked(block.text,offset+block.start)}</Fragment>)}</>;
 const units=article.structure?.units||[],references:{unit:LegalUnit;label:string}[]=[];
 function visit(unit:LegalUnit,label:string){const title=label+`第 ${unit.number} ${unit.kind==='paragraph'?'項':unit.kind==='item'?'款':'目'}`;references.push({unit,label:title});unit.children.forEach(child=>visit(child,title));}
 units.forEach(u=>visit(u,''));
 function range(start:number,end:number,children:LegalUnit[]):ReactNode[]{const parts:ReactNode[]=[];let at=start;for(const u of children){if(u.start>at)parts.push(<Fragment key={'text'+at}>{formatted(article.text.slice(at,u.start),at)}</Fragment>);parts.push(<span className={'legal-unit legal-unit--'+u.kind+' '+(u.id===activeUnit?'unit-target':'')} key={u.id} id={unitAnchor(u.id)} data-unit={u.id}>{range(u.start,u.end,u.children)}</span>);at=u.end;}if(at<end)parts.push(<Fragment key={'text'+at}>{formatted(article.text.slice(at,end),at)}</Fragment>);return parts;}
 return <div className="article-text" style={{fontSize}}>{range(0,article.text.length,units)}{article.figures?.map(figure=><figure key={figure.sha256} className="official-article-figure"><figcaption>{figure.title} · 官方附件<span>寬表可左右捲動</span></figcaption>{figure.images.map(img=><div key={img.sha256} className="official-figure-scroll" role="region" tabIndex={0} aria-label={figure.title+'，可左右捲動'}><img src={img.src} width={img.width} height={img.height} alt={img.alt}/></div>)}<div className="official-figure-links"><a href={figure.source} target="_blank" rel="noreferrer">官方 PDF</a><a href={figure.pdf} download={law.id+'-'+article.no+'.pdf'}>下載本庫原檔</a><span>原檔第 {figure.images.map(i=>i.page).join('、')} 頁 · 擷取 {figure.retrieved.slice(0,10)}</span></div></figure>)}{!!units.length&&<details className="unit-tools" onToggle={e=>setOpened(e.currentTarget.open)}><summary><ChevronDown size={12}/>項款引用</summary>{opened&&<div className="unit-reference-list">{references.map(({unit,label})=><div key={unit.id}><span>{label}</span><button aria-label={'複製'+law.name+article.no+label} onClick={()=>onCopy(law.name+' '+article.no+' '+label+'\n'+article.text.slice(unit.start,unit.end).trim()+'\n'+law.url)}><Copy size={12}/>引用</button><button aria-label={'複製'+article.no+label+'連結'} onClick={()=>onCopy(shareURL()+lawHref(law.id,article.no,unit.id))}><Link2 size={12}/>連結</button><ReferenceShareButton title={"分享或嵌入"+article.no+label} makeEvidence={()=>makeArticleEvidence(law,article,{unitId:unit.id,unitLabel:label})}/><AddEvidenceButton title={'將'+article.no+label+'加入案件'} makeEvidence={()=>makeArticleEvidence(law,article,{unitId:unit.id,unitLabel:label})}/></div>)}<p>依來源段落與列款標示解析；原文與官方附件仍為核對依據。</p></div>}</details>}</div>;
}
