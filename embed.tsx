import {createRoot} from 'react-dom/client';
import {useEffect,useState} from 'react';
import {safeEvidenceURL,type CaseEvidence} from './lib/casebook';
import {loadEmbedEvidence} from './lib/embed-loader';
import {parseEmbedSelector,referenceHref} from './lib/reference-card';
import './components/embed-card.css';

function EmbeddedReference(){
 const [e,setEvidence]=useState<CaseEvidence|null>(null),[expected,setExpected]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(true),[retry,setRetry]=useState(0);
 useEffect(()=>{let active=true;setBusy(true);setError('');setEvidence(null);
  async function load(){const ref=parseEmbedSelector(location.search),current=await loadEmbedEvidence(ref);
   if(active){setEvidence(current);setExpected(ref.expected);document.title=current.title+'｜openlawtw 引用卡';}
  }
  void load().catch(problem=>{if(active)setError(problem instanceof Error?problem.message:'引用內容暫時無法載入。');}).finally(()=>{if(active)setBusy(false);});return()=>{active=false;};
 },[retry]);
 return <main className="embedded-card"><header><a href="/" target="_blank" rel="noreferrer">openlawtw</a><span>官方原文引用卡</span></header>{busy?<p role="status">正在載入引用內容…</p>:error?<section role="alert"><h1>目前無法顯示這份引用</h1><p>{error}</p><button onClick={()=>setRetry(n=>n+1)}>重新載入</button><a href="/" target="_blank" rel="noreferrer">回到法規庫查找 ↗</a></section>:e&&<>
  <div className={'embed-status '+(expected&&expected!==e.contentHash?'changed':'')}>{expected?(expected===e.contentHash?'與建立引用時的文字相同':'此段文字在建立引用後已有變動，請重新核對'):'未指定歷史比對基準'}</div>
  <h1>{e.title}</h1><div className="embed-dates">來源修正／發布：{e.officialModifiedAt||'未提供'}<br/>資料擷取：{e.observedAt||'未提供'}</div>
  <blockquote>{e.quote.length<=700?e.quote:<>{e.quote.slice(0,700)}<span className="embed-excerpt">〔原文節錄；完整內容見下方〕</span></>}</blockquote>{e.quote.length>700&&<details><summary>展開完整原文</summary><pre>{e.quote}</pre></details>}
  <footer>{safeEvidenceURL(e.sourceURL)&&<a href={e.sourceURL} target="_blank" rel="noreferrer">核對官方原文 ↗</a>}<a href={referenceHref(e)} target="_blank" rel="noreferrer">在 openlawtw 閱讀 ↗</a><p>顯示本庫目前收錄快照；來源日期不等於現行適用性判斷。原文與附件請核對官方來源。</p></footer>
 </>}</main>;
}
createRoot(document.getElementById('embed-root')!).render(<EmbeddedReference/>);
