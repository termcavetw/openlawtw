import practice from '../data/runtime-practice.json' with {type:'json'};
import {loadFile,manifest} from './data-client';
import {normalize} from './search';
export type PracticeForm={id:string;title:string;region:string;kind:string;source:string;sourcePage:string;versionLabel:string;versionDate:string;retrieved:string;sha256:string;filename:string;mime:string;bytes:number;group:string;note:string};
export type PracticeDocument=PracticeForm&{text:string;original:string};
export const practiceForms=practice.items as PracticeForm[];
export const practiceSource=practice.source;
export const practiceObservedAt=practice.observedAt;
export const practiceLaws=[
 {id:'D0070148',article:'第 33 條',label:'簡易室裝的中央規定',reason:'官方施工許可證明載建築物室內裝修管理辦法第 33 條。'},
 {id:'新北市-C0170020',article:'',label:'新北審核與查驗作業',reason:'官方書表附註引用本規範；實際條次及完整規定請開啟原文核對。'},
 {id:'新北市-C0170033',article:'',label:'涉及一定規模以下變更時',reason:'官方施工許可審核表列為需確認項目；不代表每一案件均適用。'},
 {id:'新北市-C0170078',article:'',label:'涉及違建部分時',reason:'原申請內容及違建情形須個別核對。'},
] as const;
export function loadPracticeDocument(id:string,signal?:AbortSignal):Promise<PracticeDocument>{const file=manifest.practiceDocuments?.[id];if(!file)return Promise.reject(Error('本版尚未收錄這份書表'));return loadFile<PracticeDocument>(file,signal);}
export function practiceMatches(form:PracticeForm,text:string,query:string){const terms=query.trim().split(/\s+/).map(normalize).filter(Boolean);const haystack=normalize([form.title,form.group,form.versionLabel,text].join(' '));return terms.every(t=>haystack.includes(t));}
export async function downloadPracticeOriginal(form:PracticeForm){
 const doc=await loadPracticeDocument(form.id);const bytes=Uint8Array.from(atob(doc.original),c=>c.charCodeAt(0));
 if(crypto.subtle){const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');if(hash!==form.sha256)throw Error('原檔版本核對失敗，請重新下載資料包');}
 const url=URL.createObjectURL(new Blob([bytes],{type:form.mime}));const a=document.createElement('a');a.href=url;a.download=form.filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

