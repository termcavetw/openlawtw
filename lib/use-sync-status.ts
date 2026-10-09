import {useEffect,useState} from 'react';
import {loadFile,manifest} from './data-client';
import type {SyncStatus} from './law-types';
// Status evidence is loaded only when its UI opens, outside the initial shell.
export function useSyncStatus(active=true){
 const [status,setStatus]=useState<SyncStatus>(),[failed,setFailed]=useState(false),[attempt,setAttempt]=useState(0);
 useEffect(()=>{if(!active||!manifest.syncStatus)return;const controller=new AbortController();setFailed(false);loadFile<SyncStatus>(manifest.syncStatus,controller.signal).then(setStatus).catch(()=>{if(!controller.signal.aborted)setFailed(true);});return ()=>controller.abort();},[active,attempt]);
 return {status,failed,retry:()=>setAttempt(value=>value+1)};
}
