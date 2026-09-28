import {useEffect,useState} from 'react';
import {loadRelated,loadRulingCounts} from './data-client';
import type {Ruling,RulingCounts} from './law-types';

const noItems:Ruling[]=[];
type RelatedState={lawId:string;status:'loading'|'ready'|'error';items:Ruling[]};

/** Counts are small and independent of the official law shard. Summaries need reader intent. */
export function useLawRulings(lawId:string,enabled:boolean){
 const [counts,setCounts]=useState<RulingCounts|null>(null),[countsError,setCountsError]=useState(false);
 const [related,setRelated]=useState<RelatedState|null>(null),[attempt,setAttempt]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();setCountsError(false);
  loadRulingCounts(controller.signal).then(setCounts).catch(error=>{if(error.name!=='AbortError')setCountsError(true);});
  return()=>controller.abort();
 },[attempt]);
 useEffect(()=>{
  if(!enabled)return;
  const controller=new AbortController();setRelated({lawId,status:'loading',items:[]});
  loadRelated(lawId,controller.signal).then(items=>setRelated({lawId,status:'ready',items})).catch(error=>{if(error.name!=='AbortError')setRelated({lawId,status:'error',items:[]});});
  return()=>controller.abort();
 },[lawId,enabled,attempt]);
 const current=related?.lawId===lawId?related:null;
 return {
  counts:counts?.[lawId]??null,countsLoading:!counts&&!countsError,countsError:!counts&&countsError,
  items:current?.items??noItems,
  loading:enabled&&(!current||current.status==='loading'),error:enabled&&current?.status==='error',
  retry:()=>setAttempt(value=>value+1),
 };
}
