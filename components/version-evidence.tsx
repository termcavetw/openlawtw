import {useEffect,useMemo,useState} from 'react';
import {ExternalLink,Download,History,LoaderCircle} from 'lucide-react';
import {loadFile,manifest} from '@/lib/data-client';
import {archiveStatus,compareArchivedArticles,versionEvidence,type ArchivedAsset,type VersionLedger,type VersionObject} from '@/lib/version-evidence';
import type {Law} from '@/lib/law-types';
import './version-evidence.css';

const displayTime=(date:string)=>{const value=new Date(date);return Number.isNaN(value.getTime())?date:value.toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false})+'（台北時間）';};
function saveBlob(blob:Blob,filename:string){const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}

export function VersionEvidence({law,summary,batchDate=''}:{law:Law;summary?:Law;batchDate?:string}){
 const [history,setHistory]=useState<VersionLedger|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 const [selected,setSelected]=useState(''),[archive,setArchive]=useState<VersionObject|null>(null),[busy,setBusy]=useState(false),[assetBusy,setAssetBusy]=useState('');
 const versions=history?.archive?.laws[law.id]||[];
 const chosen=selected===''?undefined:versions[Number(selected)];
 const rows=versionEvidence(law,summary||law,batchDate);
 const differences=useMemo(()=>archive?compareArchivedArticles(archive.law,law):[],[archive,law]);
 const documentChanged=archive?.originals.find(a=>a.role==='official-original')?.sha256!==law.document?.sha256;
 const portable=!!window.OPENLAWTW_OFFLINE;
 useEffect(()=>{const controller=new AbortController();setHistory(null);setError('');setArchive(null);setSelected('');setBusy(false);setAssetBusy('');loadFile<VersionLedger>(manifest.history,controller.signal).then(setHistory).catch(e=>{if(!controller.signal.aborted)setError(e.message||'版本索引尚未下載，請連線重試。');});return ()=>controller.abort();},[law.id,retry]);
 useEffect(()=>{setArchive(null);if(!selected||!chosen)return;const controller=new AbortController();setBusy(true);setError('');loadFile<VersionObject>(chosen.file,controller.signal).then(value=>{if(value.law.id!==law.id)throw Error('版本法規代碼不一致');setArchive(value);}).catch(e=>{if(!controller.signal.aborted)setError(e.message||'封存正文尚未下載。');}).finally(()=>{if(!controller.signal.aborted)setBusy(false);});return ()=>controller.abort();},[selected,law.id,retry]);
 async function downloadAsset(asset:ArchivedAsset){setAssetBusy(asset.url);setError('');try{const response=await fetch(asset.url);if(!response.ok)throw Error('封存原檔尚未下載，請連線後重試。');const bytes=await response.arrayBuffer();if(!globalThis.crypto?.subtle)throw Error('目前環境無法驗證封存檔案，請使用 HTTPS 或本機預覽。');const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');if(hash!==asset.sha256)throw Error('封存檔案校驗不符，已停止下載。');saveBlob(new Blob([bytes],{type:'application/octet-stream'}),asset.filename);}catch(e){setError(e instanceof Error?e.message:'封存原檔下載失敗');}finally{setAssetBusy('');}}
 return <section className="version-evidence" aria-label="來源與版本證據">
  <h3 className="reader-subtitle">來源與更新證據</h3>
  <dl className="version-evidence-grid">{rows.map(row=><div key={row.label}><dt>{row.label}</dt><dd>{row.url?<a href={row.url} target="_blank" rel="noreferrer">{row.value}<ExternalLink size={12}/></a>:row.value}{row.detail&&<small>{row.detail}</small>}</dd></div>)}</dl>
  <div className="version-archive-heading"><History size={16}/><h3>本庫完整版本封存</h3></div>
  <p className="version-muted">保存本庫已收錄的正文與原始文件；來源頁面的其他附件不一定已收錄。</p>
  {!history&&!error&&<p className="version-muted">正在載入封存索引…</p>}
  {history&&<><p className="version-muted">{archiveStatus(versions,!!history.laws[law.id]?.previousContentHash)}</p>{versions.length>0&&<><p className="version-muted">最近封存：{displayTime(versions.at(-1)!.recordedAt)}。封存時間表示本庫保存這份內容的時間，並非官方修正或再次核對日期。</p>{portable?<p className="version-muted">單檔離線版保留版本索引；完整歷史正文與原始檔請在網站版開啟。本版目前收錄的全文仍可離線閱讀。</p>:<label className="version-picker">檢視封存內容<select value={selected} onChange={event=>setSelected(event.target.value)}><option value="">選擇一個已封存版本</option>{versions.map((version,index)=>({version,index})).reverse().map(({version,index})=><option value={String(index)} key={index}>{displayTime(version.recordedAt)}{index===versions.length-1?' · 最新封存':''}{version.changedArticles.length?' · '+version.changedArticles.length+' 條異動':''}</option>)}</select></label>}</>}</>}
  {error&&<div className="version-error" role="alert">{error}<button className="plain-button" onClick={()=>setRetry(value=>value+1)}>重新載入版本索引</button></div>}
  {busy&&<p className="version-muted"><LoaderCircle size={14}/>正在核對與載入封存正文…</p>}
  {archive&&chosen&&<div className="archived-version">
   <h4>{archive.law.name} · 封存正文</h4><p className="version-muted">封存於 {displayTime(chosen.recordedAt)}；來源所載修正日期 {archive.law.modified||'未提供'}。</p>
   <p className="version-hash">封存 SHA-256：<code>{chosen.file.sha256}</code></p>
   <button className="plain-button" onClick={()=>saveBlob(new Blob([JSON.stringify(archive,null,2)],{type:'application/json'}),archive.law.id+'-'+chosen.file.sha256.slice(0,12)+'.json')}><Download size={13}/>下載此版完整資料</button>
   {!!archive.originals.length&&<div className="version-downloads">{archive.originals.map(asset=><button className="plain-button" key={asset.url+asset.role} disabled={!!assetBusy} onClick={()=>downloadAsset(asset)}><Download size={13}/>{assetBusy===asset.url?'核對檔案中…':asset.role==='official-original'?'下載此版官方原檔':asset.role==='readable-content'?'下載此版原文與表格資料':'下載此版 PDF 文字'} </button>)}</div>}
   <details className="version-diff"><summary>與本版收錄內容比較 · {differences.length} 條文字異動{documentChanged?' · 原始文件不同':''}</summary><p className="version-muted">逐條比對文字；不是官方修正對照表。公式、圖表與附件請核對封存原檔。</p>{differences.length?differences.map(diff=><div className="version-diff-row" key={diff.no}><h5>{diff.no} · {diff.kind==='added'?'本版新增':diff.kind==='removed'?'本版移除':'文字不同'}</h5><div><section><strong>所選封存版本</strong><pre>{diff.before||'此版沒有這一條'}</pre></section><section><strong>本版收錄內容</strong><pre>{diff.after||'此版沒有這一條'}</pre></section></div></div>):<p>條文文字相同；來源日期、附件與其他資料仍可能不同。</p>}</details>
   {archive.law.preamble&&<p className="archived-text">{archive.law.preamble}</p>}{archive.law.articles.map(article=><section className="archived-article" key={article.no}><h5>{article.no}</h5><p>{article.text}</p></section>)}{!archive.law.articles.length&&<p className="version-muted">此法規以原文文件保存，請下載上方「此版官方原檔」查看完整內容。</p>}
  </div>}
 </section>;
}
