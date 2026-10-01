import {useState} from 'react';
import {Printer,ExternalLink} from 'lucide-react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from './ui/dialog';
import {lawChapters,chapterForArticle} from '../lib/law-chapters';
import {openLawPrint,printSelection,type PrintScope,type PrintOrientation} from '../lib/law-print';
import {officialArticleSource} from '../lib/official-source';
import type {Law} from '../lib/law-types';
import './law-tools.css';
export function LawPrintDialog({law,initial,onClose,onRestoreFocus}:{law:Law;initial:PrintScope;onClose:()=>void;onRestoreFocus:()=>void}){
 const chapters=lawChapters(law.articles);
 const [kind,setKind]=useState(initial.kind),[article,setArticle]=useState(initial.kind==='article'?initial.article:law.articles[0]?.no||'');
 const [chapter,setChapter]=useState(initial.kind==='chapter'?initial.chapter:chapterForArticle(chapters,article)?.id||chapters[0]?.id||'');
 const [orientation,setOrientation]=useState<PrintOrientation>('portrait'),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const original=officialArticleSource({url:law.document?.source||law.url},'');
 const scope:PrintScope=kind==='article'?{kind,article}:kind==='chapter'?{kind,chapter}:{kind:'law'};
 let count=0;try{count=printSelection(law,scope).articles.length;}catch{}
 function preview(){setError('');setNotice('');try{
  if(!openLawPrint(law,scope,orientation))setError('預覽視窗未能開啟，請允許此網站開啟新視窗後重試。');
  else setNotice('列印預覽已開啟，可在預覽頁列印或儲存為 PDF。');
 }catch(e){setError(e instanceof Error?e.message:'無法建立列印預覽，請重試。');}}
 return <Dialog open onOpenChange={v=>{if(!v)onClose();}}><DialogContent className="law-print-dialog" onCloseAutoFocus={event=>{event.preventDefault();onRestoreFocus();}}><DialogTitle>友善列印</DialogTitle><DialogDescription>{law.name}</DialogDescription>
 {law.document||law.coverage!=='full'?<><p className="law-print-note">此法規以原始文件收錄，請開啟官方原檔，使用原檔的列印功能保留完整圖表。</p>{original&&<a className="law-print-submit" href={original.url} target="_blank" rel="noreferrer">開啟官方原檔<ExternalLink size={15}/></a>}</>:<>
 <label>列印範圍<select aria-label="列印範圍" value={kind} onChange={e=>{setKind(e.target.value as PrintScope['kind']);setNotice('');}}><option value="article">單一法條</option><option value="chapter" disabled={!chapters.length}>目前章節／選擇章節</option><option value="law">整部法規</option></select></label>
 {kind==='article'&&<label>法條<select aria-label="法條" value={article} onChange={e=>setArticle(e.target.value)}>{law.articles.map(a=><option key={a.no} value={a.no}>{a.no}</option>)}</select></label>}
 {kind==='chapter'&&<label>章節<select aria-label="章節" value={chapter} onChange={e=>setChapter(e.target.value)}>{chapters.map(c=><option key={c.id} value={c.id}>{c.title} · {c.articles.length} 條</option>)}</select></label>}
 <label>紙張方向<select aria-label="紙張方向" value={orientation} onChange={e=>setOrientation(e.target.value as PrintOrientation)}><option value="portrait">A4 直式</option><option value="landscape">A4 橫式 · 適合寬表</option></select></label>
 <p className="law-print-note">共 {count} 條原文，包含條號、來源與日期。搜尋條件不會刪減所選章節或全文；附件內容需另開原檔列印。</p>
 <button type="button" className="law-print-submit" disabled={!count} onClick={preview}><Printer size={16}/>開啟列印預覽</button>
 </>}{error&&<p role="alert" className="law-print-error">{error}</p>}{notice&&<p role="status" className="law-print-note">{notice}</p>}
 </DialogContent></Dialog>;
}
