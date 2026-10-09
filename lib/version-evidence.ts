import type {DataFile,Law,SyncOutcome} from './law-types';

export type ArchivedAsset=DataFile&{role:'official-original'|'readable-content'|'extracted-text';filename:string};
export type ArchivedVersion={recordedAt:string;file:DataFile;contentHash:string;previousVersion:string|null;changedArticles:string[];officialModified:string;effectiveDate:string;sourceRetrieved:string;batchDate:string;documentSha256?:string;documentRetrieved?:string};
export type VersionLedger={laws:Record<string,{contentHash:string;observedAt:string;previousContentHash:string|null}>;changes:{law:string}[];archive?:{schemaVersion:1;note:string;laws:Record<string,ArchivedVersion[]>}};
export type VersionObject={schemaVersion:1;law:Law;originals:ArchivedAsset[];documentSource?:Record<string,unknown>};
export type EvidenceRow={label:string;value:string;detail?:string;url?:string};
export function versionEvidence(law:Law,source:Law=law,batchDate='',outcome?:SyncOutcome):EvidenceRow[]{
 const effective=source.effective||law.version?.effectiveDate||'';
 const rows:EvidenceRow[]=[
  {label:'官方來源',value:source.source||'未提供來源名稱',url:source.url},
  {label:'來源所載修正日期',value:source.modified||law.version?.officialModified||'來源未列；尚待核對'},
  {label:'來源所載生效日期',value:effective.startsWith('9999')?'依官方生效說明':effective||'未另列；請查條文與沿革',detail:source.effectiveNote||law.effectiveNote||undefined},
  {label:'資料所載擷取日期',value:source.retrieved||'未保存逐筆擷取日期'},
  {label:'本庫資料批次',value:batchDate||source.snapshot||'未提供批次日期',detail:'批次日期不是這部法規的修正或生效日期。'},
  {label:'官方再次核對',value:'尚未載入逐筆官方再核對紀錄',detail:'本頁顯示已收錄的來源證據；未自動判定目前仍為最新。'},
 ];
 if(outcome?.id===source.id){
  const statuses={updated:'本次來源已取得；資料已更新',unchanged:'本次來源已取得；資料未變',retained:'本次未能更新；保留原快照',unavailable:'本次來源未取得；無可用快照','not-attempted':'本次未重新擷取'};
  rows[5]={label:'本次同步結果',value:statuses[outcome.status],detail:outcome.reason||'來源擷取不代表官方現時適用性判斷；請核對官方原文。'};
  rows.push({label:'本次擷取嘗試時間',value:outcome.attemptedAt||'本次未嘗試擷取'},
   {label:'最近成功擷取日期',value:source.retrieved||'未保存成功擷取日期',detail:'保留舊快照時，此日期不會隨批次更新。'});
 }
 if(law.document){rows.push({label:'原始文件擷取日期',value:law.document.retrieved||'未保存',url:law.document.source},{label:'原始文件 SHA-256',value:law.document.sha256||'未保存',detail:law.document.versionNote||undefined});}
 return rows;
}
export type ArticleChange={no:string;kind:'added'|'removed'|'changed';before:string;after:string};
export function compareArchivedArticles(previous:Law,current:Law):ArticleChange[]{
 const before=new Map(previous.articles.map(a=>[a.no,a.text])),after=new Map(current.articles.map(a=>[a.no,a.text]));
 return [...new Set([...before.keys(),...after.keys()])].filter(no=>before.get(no)!==after.get(no)).map(no=>({no,kind:!before.has(no)?'added':!after.has(no)?'removed':'changed',before:before.get(no)||'',after:after.get(no)||''}));
}
export function archiveStatus(versions:ArchivedVersion[],hashOnlyPrevious:boolean){
 if(!versions.length)return hashOnlyPrevious?'過往僅保留雜湊觀測，未保存可還原正文。':'尚未建立可還原的版本封存。';
 return versions.length===1?'已保存 1 個完整版本；封存基準之前的歷史正文尚未收錄。':`已保存 ${versions.length} 個完整版本。這是本庫觀測歷程，不代表官方全部歷史版本。`;
}
