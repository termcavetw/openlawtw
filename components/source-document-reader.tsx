import {useEffect,useMemo,useState} from 'react';
import {Search,ExternalLink} from 'lucide-react';
import {loadFile,manifest} from '@/lib/data-client';
import {normalize} from '@/lib/search';
import type {Law} from '@/lib/law-types';
type SourceData={format:'html';html:string;pages:{page:number;text:string}[];sha256:string};
export function SourceDocumentReader({law}:{law:Law}){
 const [doc,setDoc]=useState<SourceData|null>(null),[error,setError]=useState(false),[retry,setRetry]=useState(0),[query,setQuery]=useState('');
 useEffect(()=>{const controller=new AbortController();setDoc(null);setError(false);loadFile<SourceData>(manifest.documents![law.id],controller.signal).then(value=>{if(value.format!=='html'||value.sha256!==law.document!.sha256)throw Error('Source integrity');setDoc(value);}).catch(e=>{if(e.name!=='AbortError')setError(true);});return()=>controller.abort();},[law.id,law.document,retry]);
 const count=useMemo(()=>{if(!query.trim()||!doc)return 0;return normalize(doc.pages[0].text).split(normalize(query)).length-1;},[doc,query]);
 return <section className="document-reader" id="document-page-1"><div className="document-intro"><div><h3>官方原文文件</h3><p>保留正文、表格與原始編號順序。</p></div></div><p className="document-version">{law.document!.versionNote}</p><div className="document-actions"><a href={law.url} target="_blank" rel="noreferrer">核對官方原文與附件<ExternalLink size={14}/></a></div>{error?<p role="alert">原文尚未下載或載入失敗。<button onClick={()=>setRetry(n=>n+1)}>重試</button></p>:!doc?<p role="status">正在載入官方原文…</p>:<><label className="document-search"><Search size={16}/><input aria-label="原文文件內查找" placeholder="查找本文文字…" value={query} onChange={e=>setQuery(e.target.value)}/></label>{query.trim()&&<p role="status">本文有 {count} 處符合；可使用瀏覽器的頁內尋找定位。</p>}<div className="source-document-scroll"><div className="source-document" dangerouslySetInnerHTML={{__html:doc.html}}/></div><p className="portal-note">原文文字與表格結構已核對。版面依螢幕調整，獨立附圖與附件請由官方頁面開啟。</p></>}</section>;
}
