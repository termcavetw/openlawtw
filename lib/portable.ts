import {loadLaw} from './data-client';
type OfflinePayload = Record<string, unknown>;
declare global {interface Window {OPENLAWTW_OFFLINE?:OfflinePayload}}
export const isPortable=()=>!!window.OPENLAWTW_OFFLINE;
export const shareURL=()=>location.protocol==='file:'?'https://openlawtw.vercel.app':location.origin;
export async function loadJSON<T>(path:string,signal?:AbortSignal):Promise<T>{
 if(signal?.aborted)throw new DOMException('Aborted','AbortError');
 const embedded=window.OPENLAWTW_OFFLINE?.[decodeURIComponent(path)];
 if(embedded!==undefined)return embedded as T;
 const law=path.match(/^\/data\/laws\/([^/]+)\.json$/);
 if(law)return loadLaw(decodeURIComponent(law[1]),signal) as Promise<T>;
 const response=await fetch(path,{signal});if(!response.ok)throw new Error('資料讀取失敗');return response.json();
}
export function downloadCatalog(data:unknown,filename='openlawtw-catalog.json'){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export async function copyText(text:string){
 if(navigator.clipboard?.writeText){try{await navigator.clipboard.writeText(text);return;}catch{}}
 const el=document.createElement('textarea');el.value=text;el.style.cssText='position:fixed;left:-9999px;top:0';document.body.appendChild(el);el.select();const ok=document.execCommand('copy');el.remove();if(!ok)throw new Error('無法複製');
}
