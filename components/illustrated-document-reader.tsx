import {useEffect,useMemo,useRef,useState} from 'react';
import {BookOpen,ChevronLeft,ChevronRight,ExternalLink,Search,ZoomIn} from 'lucide-react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from './ui/dialog';
import {loadFile,manifest} from '@/lib/data-client';
import {documentChapterAtPage,searchDocumentSections} from '@/lib/document-chapters';
import type {DocumentReaderIndex,DocumentChapter,DocumentImageBlock} from '@/lib/document-chapters';
import type {Law} from '@/lib/law-types';
import './illustrated-document-reader.css';

type Props={law:Law;initialPage:number;navigationKey:number;onPage:(page:number)=>void;onOriginal:(page:number)=>void;onVisiblePage?:(page:number)=>void};
export function IllustratedDocumentReader({law,initialPage,navigationKey,onPage,onOriginal,onVisiblePage}:Props){
 const [index,setIndex]=useState<DocumentReaderIndex|null>(null),[chapter,setChapter]=useState<DocumentChapter|null>(null);
 const [chapterId,setChapterId]=useState(''),[expanded,setExpanded]=useState<string[]>([]),[query,setQuery]=useState('');
 const [error,setError]=useState(''),[retry,setRetry]=useState(0),[image,setImage]=useState<DocumentImageBlock|null>(null),[zoom,setZoom]=useState(false);
 const root=useRef<HTMLElement>(null),pending=useRef<{chapter:string;section?:string;page:number;block?:number}|null>(null),scrollTarget=useRef<{section:string;block?:number}|null>(null);
 const meta=law.document!;
 useEffect(()=>{
  let live=true;setError('');
  loadFile<DocumentReaderIndex>(manifest.documentReaders![law.id]).then(value=>{
   if(value.sourceSha256!==meta.sha256||value.lawId!==law.id)throw Error('圖文版與原始 PDF 的版本不一致。');
   if(live)setIndex(value);
  }).catch(e=>{if(live)setError(String(e.message||e));});
  return()=>{live=false;};
 },[law.id,meta.sha256,retry]);
 useEffect(()=>{
  if(!index)return;
  // Explicit page links also work for the cover, contents, and appendices.
  const preferred=pending.current?.page===initialPage?pending.current:null;
  const page=initialPage||index.chapters.find(c=>/^第.*章/.test(c.title))?.startPage||index.chapters[0].startPage;
  const located=documentChapterAtPage(index,page);
  const selected=preferred?index.chapters.find(c=>c.id===preferred.chapter):located.chapter;
  if(!selected)return;
  onVisiblePage?.(page);
  setChapterId(selected.id);
  const chapterOnly=!!preferred&&!preferred.section;
  const ids=preferred?.section?[preferred.section]:located.sections.map(s=>s.id);
  setExpanded(initialPage&&!chapterOnly?(ids.length?ids:[selected.sections[0]?.id].filter(Boolean)):[]);
  const targetSection=selected.sections.find(s=>s.id===(preferred?.section||ids[0]));
  const targetBlock=preferred?.block??targetSection?.anchors.find(a=>a.page>=page)?.index;
  scrollTarget.current=targetSection&&initialPage&&!chapterOnly?{section:targetSection.id,block:targetBlock}:null;
  pending.current=null;
 },[index,initialPage,navigationKey]);
 const selected=index?.chapters.find(c=>c.id===chapterId);
 useEffect(()=>{
  if(!selected)return;
  let live=true;setChapter(null);setError('');
  loadFile<DocumentChapter>(selected.file).then(value=>{
   if(value.sourceSha256!==meta.sha256||value.id!==selected.id)throw Error('本章圖文版本不一致，請重新載入。');
   if(live)setChapter(value);
  }).catch(e=>{if(live)setError(String(e.message||e));});
  return()=>{live=false;};
 },[selected,meta.sha256,retry]);
 useEffect(()=>{
  if(!chapter||!scrollTarget.current)return;
  const frame=requestAnimationFrame(()=>{
   const location=scrollTarget.current;
   const section=Array.from(root.current?.querySelectorAll<HTMLElement>('[data-document-section]')||[]).find(e=>e.dataset.documentSection===location?.section);
   const block=location?.block===undefined?null:section?.querySelector<HTMLElement>('[data-document-block=\"'+location.block+'\"]');
   const target=block||section;
   if(target){target.scrollIntoView({block:'start',behavior:'instant'});scrollTarget.current=null;}
  });
  return()=>cancelAnimationFrame(frame);
 },[chapter,expanded,navigationKey]);
 const results=useMemo(()=>index?searchDocumentSections(index,query):[],[index,query]);
 function select(id:string,section?:string,page?:number,block?:number){
  const next=index?.chapters.find(c=>c.id===id);if(!next)return;
  const chosen=next.sections.find(s=>s.id===section),nextPage=page||chosen?.startPage||next.startPage;
  pending.current={chapter:id,section,page:nextPage,block};
  setQuery('');setChapterId(id);setExpanded(section?[section]:[]);
  onPage(nextPage);
 }
 const position=index?.chapters.findIndex(c=>c.id===chapterId)??-1;
 return <section className="illustrated-reader" ref={root} aria-label="規範圖文章節">
  <div className="illustrated-intro"><BookOpen size={25}/><div><h3>圖文章節閱讀</h3><p>條文可搜尋，圖例可點開放大。圖表保留官方 PDF 原貌。</p></div></div>
  <details className="illustrated-source"><summary>版本與官方來源</summary><p>{meta.versionNote}</p><p>網站文字由 PDF 排版轉換；附圖、尺寸、表格可逐頁核對原檔。</p><a href={meta.sourcePage} target="_blank" rel="noreferrer">核對官方版本 <ExternalLink size={13}/></a></details>
  {index&&<>
   <div className="illustrated-controls"><label className="illustrated-chapter-picker">選擇章節<select aria-label="圖文章節" value={chapterId} onChange={e=>select(e.target.value)}>{index.chapters.map(c=><option value={c.id} key={c.id}>{c.title}</option>)}</select></label><label className="illustrated-search"><Search size={17}/><input aria-label="搜尋圖文規範" placeholder="搜尋全部章節，例如 203.2.6、扶手" value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<button aria-label="清除圖文搜尋" onClick={()=>setQuery('')}>×</button>}</label></div>
   {query&&<div className="illustrated-results" aria-live="polite"><p>全部章節找到 {results.length} 個段落</p>{results.map(({chapter:c,section:s,anchor})=><button key={c.id+':'+s.id} onClick={()=>select(c.id,s.id,anchor?.page,anchor?.index)}><small>{c.title}</small><strong>{s.title}</strong><span>{excerpt(anchor?.text||s.text,query)}</span></button>)}</div>}
   {selected&&<div className="illustrated-chapter-heading"><div><h3>{selected.title}</h3>{selected.id.startsWith('appendix-')&&<p className="illustrated-reference-note">參考附錄：依第 105 節，供設計參考指導，非強制性規定。</p>}<span>PDF 第 {selected.startPage}–{selected.endPage} 頁 · {selected.sections.length} 個段落</span></div><button onClick={()=>setExpanded(expanded.length===selected.sections.length?[]:selected.sections.map(s=>s.id))}>{expanded.length===selected.sections.length?'收合本章':'展開本章'}</button></div>}
  </>}
  {error?<div className="illustrated-message" role="alert"><p>圖文暫時無法載入：{error}</p><button onClick={()=>setRetry(n=>n+1)}>重新載入圖文</button><button onClick={()=>onOriginal(initialPage||1)}>開啟原始 PDF</button></div>:!chapter?<p className="illustrated-message" role="status">正在載入{index?'本章圖文':'章節目錄'}…</p>:chapter.sections.map(section=><details key={chapter.id+section.id} className="illustrated-section" data-document-section={section.id} open={expanded.includes(section.id)}>
   <summary onClick={e=>{e.preventDefault();if(!expanded.includes(section.id))onVisiblePage?.(section.startPage);setExpanded(current=>current.includes(section.id)?current.filter(id=>id!==section.id):[...current,section.id]);}}><h4>{section.title}</h4><ChevronRight size={18}/></summary>
   <div className="illustrated-blocks">{section.blocks.map((block,i)=>block.type==='text'?<p className={'illustrated-paragraph'+(block.id?' numbered':'')} key={i} data-pdf-page={block.page} data-document-block={i}>{block.id&&block.text.startsWith(block.id)?<><strong className="illustrated-number">{block.id}</strong>{block.text.slice(block.id.length)}</>:block.text}</p>:<figure className="illustrated-figure" key={i} data-document-block={i}><button aria-label={'放大'+(block.caption||block.alt)} onClick={()=>{setImage(block);setZoom(false);}}><img src={block.src} alt={block.alt} width={block.width} height={block.height} loading="lazy"/><span><ZoomIn size={15}/>放大圖表</span></button><figcaption>{block.caption||block.alt} <button onClick={()=>onOriginal(block.page)}>原檔第 {block.page} 頁</button></figcaption></figure>)}
    <div className="illustrated-section-source"><span>來源：PDF 第 {section.startPage}{section.endPage!==section.startPage?'–'+section.endPage:''} 頁</span><button onClick={()=>onOriginal(section.startPage)}>核對原始頁面<ExternalLink size={12}/></button></div>
   </div>
  </details>)}
  {index&&position>=0&&<nav className="illustrated-pager" aria-label="圖文前後章"><button disabled={position===0} onClick={()=>select(index.chapters[position-1].id)}><ChevronLeft size={16}/>上一章</button><span>{position+1} / {index.chapters.length}</span><button disabled={position===index.chapters.length-1} onClick={()=>select(index.chapters[position+1].id)}>下一章<ChevronRight size={16}/></button></nav>}
  <Dialog open={!!image} onOpenChange={v=>{if(!v)setImage(null);}}><DialogContent className="illustrated-zoom"><DialogTitle>{image?.caption||image?.alt||'官方圖表'}</DialogTitle><DialogDescription>官方 PDF 第 {image?.page} 頁。可放大並水平、垂直捲動查看尺寸。</DialogDescription><div className="illustrated-zoom-actions"><button onClick={()=>setZoom(v=>!v)}>{zoom?'符合視窗':'放大 2 倍'}</button><button onClick={()=>{if(image)onOriginal(image.page);setImage(null);}}>核對原始 PDF</button></div><div className={'illustrated-zoom-canvas'+(zoom?' is-zoomed':'')}>{image&&<img src={image.src} width={image.width} height={image.height} alt={image.alt}/>}</div></DialogContent></Dialog>
 </section>;
}
function excerpt(text:string,query:string){const flat=text.replace(/\s+/g,' '),i=Math.max(0,flat.indexOf(query)-24);return (i?'…':'')+flat.slice(i,i+110)+(flat.length>i+110?'…':'');}
