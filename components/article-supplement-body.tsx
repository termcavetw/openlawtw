import {useMemo,useState,type ReactNode} from 'react';
import {ChevronLeft,ChevronRight,ExternalLink,ZoomIn} from 'lucide-react';
import {supplementAssetURL,type ArticleSupplement} from '@/lib/article-supplements';

export function SupplementMessage({failed,retry,children}:{failed?:boolean;retry?:()=>void;children?:ReactNode}){
 return <div className="supp-message" role={failed?'alert':'status'}>{failed?<><p>圖例載入失敗，可重試或開啟官方原檔。</p><button type="button" onClick={retry}>重新載入圖例</button>{children}</>:'正在載入圖例…'}</div>;
}

export function ArticleSupplementBody({record}:{record:ArticleSupplement}){
 return <><SupplementPages record={record}/><details className="supp-source"><summary>來源與版本 · 官方原檔</summary><div>
  <p>{record.versionNote}</p><p>原檔擷取：{record.retrieved.slice(0,10)}。附件快照不代表現時適用，請核對官方條文與沿革。</p>
  <a href={record.sourcePage} target="_blank" rel="noreferrer">本條官方原文<ExternalLink size={12}/></a>
  {record.versionSource&&<a href={record.versionSource} target="_blank" rel="noreferrer">官方版本紀錄<ExternalLink size={12}/></a>}
  {record.alternatives.map(file=><a key={file.url} href={file.url} target="_blank" rel="noreferrer">{file.title}<ExternalLink size={12}/></a>)}
 </div></details></>;
}

function SupplementPages({record}:{record:ArticleSupplement}){
 const pages=useMemo(()=>[
  ...record.pages.map(page=>({...page,label:'PDF 第 '+page.page+' 頁',source:record.source+'#page='+page.page})),
  ...record.supplementalFiles.filter(file=>file.src&&file.width&&file.height).map(file=>({src:file.src!,width:file.width!,height:file.height!,label:file.title,source:file.url}))
 ],[record]);
 const [index,setIndex]=useState(0),[zoom,setZoom]=useState(false);
 const page=pages[index];
 function choose(next:number){setIndex(next);setZoom(false);}
 return <>
  <div className="supp-controls">
   <div><button type="button" aria-label="上一張圖例" disabled={index===0} onClick={()=>choose(index-1)}><ChevronLeft size={16}/></button><span aria-live="polite">{index+1} / {pages.length}</span><button type="button" aria-label="下一張圖例" disabled={index===pages.length-1} onClick={()=>choose(index+1)}><ChevronRight size={16}/></button></div>
   <button type="button" aria-pressed={zoom} onClick={()=>setZoom(value=>!value)}><ZoomIn size={15}/><span>{zoom?'符合寬度':'放大圖例'}</span></button>
  </div>
  <div className="supp-page-source"><span>{page.label}</span><a href={page.source} target="_blank" rel="noreferrer">官方原檔<ExternalLink size={12}/></a></div>
  <SupplementImage key={page.src} src={page.src} width={page.width} height={page.height} alt={record.articleNo+'補充圖例 · '+page.label} zoom={zoom}/>
  {location.protocol==='file:'&&<p className="supp-online">圖例需連線載入；下方保留官方原檔。</p>}
 </>;
}

function SupplementImage({src,width,height,alt,zoom}:{src:string;width:number;height:number;alt:string;zoom:boolean}){
 const [status,setStatus]=useState<'loading'|'ready'|'error'>('loading'),[attempt,setAttempt]=useState(0);
 const url=supplementAssetURL(src,location.protocol,location.origin);
 return <div className="supp-canvas" role="region" tabIndex={0} aria-label={alt+'，可左右及上下捲動'}>
  {status!=='ready'&&<SupplementMessage failed={status==='error'} retry={()=>{setStatus('loading');setAttempt(value=>value+1);}}/>}
  {status!=='error'&&<img key={attempt} src={url+(attempt?'?retry='+attempt:'')} width={width} height={height} alt={alt} decoding="async" onLoad={()=>setStatus('ready')} onError={()=>setStatus('error')} style={zoom?{width:Math.max(width,1000),maxWidth:'none'}:undefined}/>}
 </div>;
}
