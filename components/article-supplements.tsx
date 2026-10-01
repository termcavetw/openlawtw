import {useEffect,useRef,useState} from 'react';
import {Image} from 'lucide-react';
import {Dialog,DialogTrigger,DialogContent,DialogTitle,DialogDescription,DialogClose} from './ui/dialog';
import {supplementViewFile,type ArticleSupplementIndex,type ArticleSupplement} from '@/lib/article-supplements';
import {loadFile} from '@/lib/data-client';
import {ArticleSupplementBody,SupplementMessage} from './article-supplement-body';
import './article-supplements.css';

export function ArticleSupplementControl({record,navigationKey}:{record:ArticleSupplementIndex;navigationKey:string}){
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
  <DialogTrigger asChild><button type="button" className="supp-trigger" aria-label={record.articleNo+'補充圖例'}><Image size={13} aria-hidden="true"/>圖例</button></DialogTrigger>
  {open&&<DialogContent className="supp-dialog" onCloseAutoFocus={event=>{if(closeForNavigation.current)event.preventDefault();}}>
   <DialogTitle>{record.articleNo}補充圖例</DialogTitle>
   <DialogDescription>官方附件原頁。可放大並在圖框內捲動查看。</DialogDescription>
   {detail?<ArticleSupplementBody record={detail}/>:<SupplementMessage failed={failed} retry={()=>setAttempt(value=>value+1)}>{record.alternatives.map(file=><p key={file.url}><a href={file.url} target="_blank" rel="noreferrer">{file.title}</a></p>)}</SupplementMessage>}
   <DialogClose asChild><button className="supp-return" type="button">關閉圖例，返回條文</button></DialogClose>
  </DialogContent>}
 </Dialog>;
}
