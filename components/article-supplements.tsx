import {useEffect,useRef,useState} from 'react';
import {Dialog,DialogTrigger,DialogContent,DialogTitle,DialogDescription,DialogClose} from './ui/dialog';
import {articleSupplement,supplementViewFile,type ArticleSupplementIndex,type ArticleSupplement} from '@/lib/article-supplements';
import {loadFile} from '@/lib/data-client';
import {ArticleSupplementBody} from './article-supplement-body';
import type {Attachment} from '@/lib/law-types';
import './article-supplements.css';

export function ArticleSupplementControl({lawId,article,attachments,navigationKey}:{lawId:string;article:string;attachments:Attachment[];navigationKey:string}){
 const record=articleSupplement(lawId,article,attachments);
 return record?<SupplementDialog key={record.id} record={record} navigationKey={navigationKey}/>:null;
}

function SupplementDialog({record,navigationKey}:{record:ArticleSupplementIndex;navigationKey:string}){
 const [open,setOpen]=useState(false),[detail,setDetail]=useState<ArticleSupplement|null>(null),[failed,setFailed]=useState(false),[attempt,setAttempt]=useState(0);
 const closeForNavigation=useRef(false);
 useEffect(()=>{closeForNavigation.current=true;setOpen(false);},[navigationKey]);
 useEffect(()=>{
  if(!open||detail)return;
  let active=true;setFailed(false);
  loadFile<{records:ArticleSupplement[]}>(supplementViewFile).then(value=>{const found=value.records.find(item=>item.id===record.id);if(!found)throw Error();if(active)setDetail(found);}).catch(()=>{if(active)setFailed(true);});
  return()=>{active=false;};
 },[open,detail,attempt,record.id]);
 return <Dialog open={open} onOpenChange={value=>{if(value)closeForNavigation.current=false;setOpen(value);}}>
  <DialogTrigger asChild><button type="button" className="supp-trigger" aria-label={record.articleNo+'補充圖例'}>圖例</button></DialogTrigger>
  {open&&<DialogContent className="supp-dialog" onCloseAutoFocus={event=>{if(closeForNavigation.current)event.preventDefault();}}>
   <DialogTitle>{record.articleNo}補充圖例</DialogTitle>
   <DialogDescription>官方附件原頁。可放大並在圖框內捲動查看。</DialogDescription>
   {detail?<ArticleSupplementBody record={detail}/>:failed?<div className="supp-message" role="alert"><p>圖例載入失敗，可重試或開啟官方原檔。</p><button type="button" onClick={()=>setAttempt(value=>value+1)}>重新載入圖例</button>{record.alternatives.map(file=><p key={file.url}><a href={file.url} target="_blank" rel="noreferrer">{file.title}</a></p>)}</div>:<p className="supp-message" role="status">正在載入圖例…</p>}
   <DialogClose asChild><button className="supp-return" type="button">關閉圖例，返回條文</button></DialogClose>
  </DialogContent>}
 </Dialog>;
}
