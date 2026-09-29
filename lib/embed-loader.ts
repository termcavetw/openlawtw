import type {DataFile,Law,Ruling} from './law-types';
import {makeArticleEvidence,makeRulingEvidence,type CaseEvidence} from './casebook';
import {articleAddress} from './routes';
import type {EmbedSelector} from './reference-card';

type EmbedIndex={schemaVersion:1;release:string;rulingRetrieved:string;laws:Record<string,DataFile>;rulings:Record<string,DataFile>};
async function readData<T>(file:DataFile|undefined):Promise<T>{
 if(!file||!/^\/data\/v2\/(?:law|rulings)-[a-f0-9]{64}\.json$/.test(file.url)||!file.url.includes(file.sha256))throw Error('本版找不到對應的引用資料。');
 const response=await fetch(file.url,{credentials:'omit'});if(!response.ok)throw Error('引用原文尚未下載或暫時無法取得。');
 const bytes=await response.arrayBuffer();
 if(globalThis.crypto?.subtle){const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');if(hash!==file.sha256)throw Error('引用資料版本不一致，請稍後重試。');}
 return JSON.parse(new TextDecoder().decode(bytes)) as T;
}
export async function loadEmbedEvidence(ref:EmbedSelector):Promise<CaseEvidence>{
 const response=await fetch('/data/embed-index.json',{cache:'no-cache',credentials:'omit'});if(!response.ok)throw Error('目前無法取得本庫引用索引。');
 const index=await response.json() as EmbedIndex;if(index.schemaVersion!==1||!index.laws||!index.rulings)throw Error('引用索引版本無法辨識。');
 if(ref.kind==='ruling'){
  const key=String(Math.floor(Number(ref.rulingId)/256));
  const list=await readData<Ruling[]>(Object.hasOwn(index.rulings,key)?index.rulings[key]:undefined),ruling=list.find(r=>r.id===ref.rulingId);
  if(!ruling)throw Error('本版未收錄這份函釋。');return makeRulingEvidence(ruling,{region:'中央',observedAt:index.rulingRetrieved});
 }
 const law=await readData<Law>(Object.hasOwn(index.laws,ref.lawId!)?index.laws[ref.lawId!]:undefined),article=law.articles.find(a=>articleAddress(a.no)===articleAddress(ref.articleNo!));
 if(!article)throw Error('本版找不到這個條號，請回到完整法規核對。');
 return makeArticleEvidence(law,article,{unitId:ref.unitId});
}
