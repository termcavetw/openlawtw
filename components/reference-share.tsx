import {createContext,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import {Share2,Download,Copy,ExternalLink} from 'lucide-react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from './ui/dialog';
import type {CaseEvidence} from '../lib/casebook';
import {cardLimit,validateExcerpt,embedURL,embedCode,type CardFormat} from '../lib/reference-card';
import {renderReferenceImage} from '../lib/reference-image';
import {copyText,shareURL} from '../lib/portable';
import './reference-tools.css';

const ShareContext=createContext<((e:CaseEvidence,selection:string,trigger:HTMLElement|null)=>void)|null>(null);
export function ReferenceShareProvider({children}:{children:ReactNode}){
 const [selection,setSelection]=useState<{e:CaseEvidence;quote:string}|null>(null),trigger=useRef<HTMLElement|null>(null);
 return <ShareContext.Provider value={(e,text,button)=>{trigger.current=button;setSelection({e,quote:text&&e.quote.includes(text)?text:[...e.quote].slice(0,180).join('')});}}>{children}{selection&&<ReferenceShareDialog evidence={selection.e} initialQuote={selection.quote} onClose={()=>setSelection(null)} onRestoreFocus={()=>trigger.current?.focus()}/>}</ShareContext.Provider>;
}
export function ReferenceShareButton({makeEvidence,label='分享／嵌入',title}:{makeEvidence:()=>Promise<CaseEvidence>;label?:string;title?:string}){
 const open=useContext(ShareContext),[busy,setBusy]=useState(false),[error,setError]=useState('');
 return <><button type="button" className="reference-share-button" aria-label={title||label} disabled={busy||!open} onClick={async event=>{const button=event.currentTarget,text=window.getSelection()?.toString()||'';setBusy(true);setError('');try{open?.(await makeEvidence(),text,button);}catch(e){setError(String(e));}finally{setBusy(false);}}}><Share2 size={13}/>{busy?'載入中…':label}</button>{error&&<small role="alert" className="reference-error">{error}</small>}</>;
}
function ReferenceShareDialog({evidence:e,initialQuote,onClose,onRestoreFocus}:{evidence:CaseEvidence;initialQuote:string;onClose:()=>void;onRestoreFocus:()=>void}){
 const [mode,setMode]=useState<'image'|'embed'>('image'),[format,setFormat]=useState<CardFormat>('portrait'),[quote,setQuote]=useState(initialQuote),[preview,setPreview]=useState(''),[blob,setBlob]=useState<Blob|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[rendering,setRendering]=useState(false);
 const invalid=validateExcerpt(e.quote,quote,format),url=embedURL(e,shareURL()),code=embedCode(e,shareURL());
 useEffect(()=>{
  let active=true,objectURL='';setPreview('');setBlob(null);setError('');
  if(invalid||mode!=='image'){setRendering(false);return;}
  setRendering(true);const timer=setTimeout(()=>{void renderReferenceImage(e,quote,format).then(result=>{if(!active)return;objectURL=URL.createObjectURL(result);setPreview(objectURL);setBlob(result);}).catch(problem=>{if(active)setError(String(problem));}).finally(()=>{if(active)setRendering(false);});},180);
  return()=>{active=false;clearTimeout(timer);if(objectURL)URL.revokeObjectURL(objectURL);};
 },[e,quote,format,invalid,mode]);
 async function copy(text:string){try{await copyText(text);setNotice('已複製。');}catch{setNotice('無法自動複製，請選取下方文字複製。');}}
 function download(){if(!preview||!blob)return;const a=document.createElement('a');a.href=preview;a.download='openlawtw-'+(e.locator.lawId||e.locator.rulingId)+'-'+format+'.png';document.body.append(a);a.click();a.remove();setNotice('圖片已下載；手機也可長按預覽圖片儲存。');}
 async function nativeShare(){if(!blob)return;const file=new File([blob],'openlawtw-reference.png',{type:'image/png'});try{if(navigator.canShare?.({files:[file]}))await navigator.share({files:[file],title:e.title});else download();}catch(problem){if(!(problem instanceof DOMException&&problem.name==='AbortError'))setError('無法開啟系統分享，請使用下載 PNG 或長按圖片。');}}
 return <Dialog open onOpenChange={v=>{if(!v)onClose();}}><DialogContent className="work-tools-dialog reference-dialog" onCloseAutoFocus={event=>{event.preventDefault();onRestoreFocus();}}><DialogTitle>讓每一份引用，都找得到依據</DialogTitle><DialogDescription>{e.title}</DialogDescription>
  <div className="reference-mode"><button aria-pressed={mode==='image'} onClick={()=>setMode('image')}>分享圖卡</button><button aria-pressed={mode==='embed'} onClick={()=>setMode('embed')}>網站嵌入卡</button></div>
  {mode==='image'?<div className="share-layout"><div className="share-settings"><label>圖片比例<select value={format} onChange={event=>setFormat(event.target.value as CardFormat)}><option value="portrait">4:5 · 1080 × 1350</option><option value="square">方形 · 1080 × 1080</option></select></label><label>選擇原文節錄<textarea aria-label="分享圖卡原文節錄" rows={7} value={quote} onChange={event=>setQuote(event.target.value)}/></label><small>{[...quote].length} / {cardLimit(format)} 字</small><p className="reference-note">可在閱讀頁選取文字後開啟，或貼入原文中連續的一段。圖卡保留資料日期，QR Code 直達官方來源。</p><details><summary>完整原文，供選取節錄</summary><pre className="reference-original">{e.quote}</pre></details>{(invalid||error)&&<p className="reference-error" role="alert">{invalid||error}</p>}<div className="reference-controls"><button disabled={!blob||rendering} onClick={download}><Download size={15}/>下載 PNG</button><button disabled={!blob||rendering} onClick={()=>void nativeShare()}><Share2 size={15}/>手機分享</button></div></div><div className="share-preview">{preview?<img src={preview} alt={e.title+'分享圖卡預覽；'+quote}/>:<p role="status">{rendering?'正在製作圖卡…':'選擇原文後顯示預覽'}</p>}</div></div>:<div className="embed-settings"><p>把下方代碼貼到支援 iframe 的網站或知識庫。引用卡顯示本庫目前收錄內容；文字與建立引用時不同，會顯示變動提示。</p><iframe className="embed-preview" src={url} title="網站嵌入卡預覽" height="480" referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"/><label>嵌入代碼<textarea aria-label="網站嵌入代碼" readOnly rows={5} value={code} onFocus={event=>event.currentTarget.select()}/></label><div className="reference-controls"><button onClick={()=>void copy(code)}><Copy size={15}/>複製嵌入代碼</button><button onClick={()=>void copy(url)}><Copy size={15}/>複製引用卡網址</button><a href={url} target="_blank" rel="noreferrer">另開引用卡<ExternalLink size={15}/></a></div><p className="reference-note">只公開此條文／函釋的識別碼與版本指紋，不包含案件名稱、筆記或收藏。平台若不支援 iframe，可改貼引用卡網址。引用卡不是固定不變的歷史版本。</p></div>}
  {notice&&<p role="status" className="reference-notice">{notice}</p>}
 </DialogContent></Dialog>;
}
