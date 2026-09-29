import {SourceDocumentReader} from './source-document-reader';
import {IllustratedDocumentReader} from './illustrated-document-reader';
import {useEffect,useMemo,useState} from 'react';
import {Download,ExternalLink,FileText,Search} from 'lucide-react';
import {loadFile,manifest} from '@/lib/data-client';
import {normalize} from '@/lib/search';
import type {Law} from '@/lib/law-types';
type PdfData={pdf:string;sha256:string;pages:{page:number;text:string}[];searchPages?:{page:number;text:string}[]};
export function DocumentReader(props:{law:Law;mobile:boolean;initialPage:number;navigationKey:number;onPage:(page:number)=>void;onVisiblePage?:(page:number)=>void}){
 const illustrated=!!manifest.documentReaders?.[props.law.id];
 const [mode,setMode]=useState<'chapters'|'pdf'>('chapters');
 if(props.law.document?.format==='html')return <SourceDocumentReader law={props.law}/>;
 return <>{illustrated&&<div className="document-view-switch" role="group" aria-label="文件閱讀方式"><button aria-pressed={mode==='chapters'} onClick={()=>setMode('chapters')}>圖文章節</button><button aria-pressed={mode==='pdf'} onClick={()=>{setMode('pdf');props.onVisiblePage?.(props.initialPage||1);}}>原始 PDF</button></div>}{illustrated&&mode==='chapters'?<IllustratedDocumentReader {...props} onOriginal={page=>{setMode('pdf');props.onPage(page);}}/>:<PdfReader {...props}/>}</>;
}
function PdfReader({law,mobile,initialPage,navigationKey,onPage}:{law:Law;mobile:boolean;initialPage:number;navigationKey:number;onPage:(page:number)=>void}){
 const [requested,setRequested]=useState(initialPage>0),[retry,setRetry]=useState(0),[pdf,setPdf]=useState<PdfData|null>(null),[url,setUrl]=useState(''),[error,setError]=useState(false),[query,setQuery]=useState(''),[page,setPage]=useState(Math.min(law.document!.pages,Math.max(1,initialPage||law.document!.startPage||1)));
 useEffect(()=>{setPage(Math.min(law.document!.pages,Math.max(1,initialPage||law.document!.startPage||1)));if(initialPage>0)setRequested(true);},[initialPage,navigationKey,law.document]);
 const goPage=(value:number)=>{const next=Math.min(law.document!.pages,Math.max(1,Math.floor(value)||1));setPage(next);onPage(next);};
 const meta=law.document!;
 useEffect(()=>{if(!requested)return;let live=true;let blob='';setError(false);loadFile<PdfData>(manifest.documents![law.id]).then(async value=>{const bytes=Uint8Array.from(atob(value.pdf),c=>c.charCodeAt(0));if(crypto.subtle){const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');if(hash!==meta.sha256)throw Error('PDF integrity');}if(!live)return;blob=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));setPdf(value);setUrl(blob);}).catch(()=>{if(live)setError(true);});return()=>{live=false;if(blob)URL.revokeObjectURL(blob);};},[requested,retry,law.id,meta.sha256]);
 const chapters=useMemo(()=>pdf?.pages.filter(p=>/^\s*(第[一二三四五六七八九十]+章|附錄)/.test(p.text)).map(p=>({page:p.page,title:p.text.split('\n')[0].trim()}))||[],[pdf]);
 const results=useMemo(()=>query.trim()?(pdf?.searchPages||pdf?.pages)?.filter(p=>normalize(p.text).includes(normalize(query)))||[]:[],[pdf,query]);
 return <section className="document-reader" id={'document-page-'+page}><div className="document-intro"><FileText size={28}/><div><h3>官方圖文 PDF · {meta.pages} 頁</h3><p>保留原始圖表、尺寸及附錄；尚未拆為項款條文。</p></div></div><p className="document-version">{meta.versionNote}</p><div className="document-actions"><a href={meta.sourcePage} target="_blank" rel="noreferrer">核對官方版本<ExternalLink size={14}/></a><a href={meta.source} target="_blank" rel="noreferrer">官方 PDF<ExternalLink size={14}/></a>{!requested&&<button onClick={()=>setRequested(true)}>載入圖文與頁內查找（約 {((manifest.documents?.[law.id]?.bytes||0)/1024/1024).toFixed(1)} MB）</button>}{url&&<a href={url} download={law.name+'.pdf'}><Download size={14}/>下載完整 PDF</a>}</div>
 {requested&&!pdf&&!error&&<p role="status">正在載入圖文原檔…</p>}{error&&<p role="alert">原檔未能載入。<button onClick={()=>setRetry(n=>n+1)}>重試</button>，或使用上方官方 PDF 入口。</p>}
 {pdf&&<><label className="document-search"><Search size={16}/><input aria-label="PDF 頁內查找" placeholder="輸入 PDF 內的關鍵字…" value={query} onChange={e=>setQuery(e.target.value)}/></label>{query&&<div className="document-results"><p>{results.length} 頁含有此文字（依 PDF 抽取文字查找）</p>{results.map(p=><button key={p.page} onClick={()=>goPage(p.page)}>PDF 第 {p.page} 頁 · {p.text.replace(/\s+/g,' ').slice(Math.max(0,p.text.replace(/\s+/g,' ').indexOf(query)-20),Math.max(0,p.text.replace(/\s+/g,' ').indexOf(query)-20)+90)}</button>)}</div>}<details className="document-chapters"><summary>章節與附錄</summary><div>{chapters.map(c=><button key={c.page} onClick={()=>goPage(c.page)}>{c.title}<small>PDF {c.page}</small></button>)}</div></details><div className="document-pagebar"><label>PDF 頁碼 <input aria-label="PDF 頁碼" type="number" min={1} max={meta.pages} value={page} onChange={e=>goPage(Number(e.target.value))}/></label><a href={url+'#page='+page} target="_blank" rel="noreferrer">在獨立視窗開啟第 {page} 頁<ExternalLink size={14}/></a></div>{mobile?<p className="portal-note">手機請由上方開啟或下載 PDF，以便縮放檢視圖面。部分 PDF 閱讀器不支援頁碼跳轉，可在閱讀器輸入 PDF 頁碼。</p>:<iframe key={url+page} title={law.name+' PDF 第 '+page+' 頁'} src={url+'#page='+page+'&view=FitH'} className="document-frame"/>}<p className="portal-note">PDF 頁碼包含封面與目錄，與頁面印製頁碼不同。抽取文字僅供定位，規定與圖表以原檔為準。</p></>}
 </section>;
}
