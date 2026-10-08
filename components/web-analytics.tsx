import {useEffect,useState} from 'react';
import type {BeforeSendEvent} from '@vercel/analytics/react';
import {data} from '../lib/catalog';
import {analyticsEnabled,sanitizeAnalyticsEvent} from '../lib/analytics';
import {isPortable} from '../lib/portable';

const publicPaths=new Set(['/', '/index.html', '/laws/index.html', ...data.laws.map(l=>'/laws/'+encodeURIComponent(l.id)+'.html')]);
const enabled=()=>analyticsEnabled(window.location.origin,isPortable(),navigator.onLine);
const beforeSend=(event:BeforeSendEvent)=>enabled()?sanitizeAnalyticsEvent(event,publicPaths):null;

export function WebAnalytics(){
 const [active,setActive]=useState(enabled);
 const [Client,setClient]=useState<typeof import('./analytics-client').default|null>(null);
 useEffect(()=>{
  const update=()=>setActive(enabled());
  window.addEventListener('online',update);
  window.addEventListener('offline',update);
  return()=>{window.removeEventListener('online',update);window.removeEventListener('offline',update);};
 },[]);
 useEffect(()=>{
  if(!active)return;
  let current=true;
  // A failed/blocked analytics download must never break the reader.
  void import('./analytics-client').then(module=>{if(current)setClient(()=>module.default);}).catch(()=>{});
  return()=>{current=false;};
 },[active]);
 return active&&Client?<Client mode="production" beforeSend={beforeSend}/>:null;
}
