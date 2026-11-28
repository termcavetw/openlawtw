// What changed in the laws lately, and how fresh each region's copy is: for the MCP server and other readers.
// recentChanges comes from the version archive (data/history.json → data/versions/objects), comparing each law's
// latest archived copy with the one before. recordedAt is when this project saw the change, not the official date;
// modified is the official 修正日期 of the current text. kinds: 條文修正 (text and 修正日期 changed), 條文差異（修正日期未變）,
// 註記移除／註記新增 (a 函告無效-type note), 附件更新, 修正日期, 名稱; whitespace-only changes are left out.
import {readFile} from 'node:fs/promises';
import {join} from './paths.mjs';

const bare=text=>String(text||'').replace(/\s+/g,'');
const NOTE=/函告[^。]{0,60}無效|無效[^。]{0,10}（註|停止適用|經[^。]{0,30}函[^。]{0,20}無效/;

function kinds(before,after){
 const out=[],a=new Map((before.articles||[]).map(x=>[x.no,x.text])),b=new Map((after.articles||[]).map(x=>[x.no,x.text]));
 const nos=new Set([...a.keys(),...b.keys()]);
 const changed=[...nos].filter(no=>bare(a.get(no))!==bare(b.get(no)));
 // same 修正日期 but different words: an editorial fix at the source or this project's parser, not an amendment
 if(changed.length)out.push((before.modified||'')!==(after.modified||'')?'條文修正':'條文差異（修正日期未變）');
 else if([...nos].some(no=>a.get(no)!==b.get(no)))out.push('條文排版');
 const noteBefore=[...a.values()].some(t=>NOTE.test(t)),noteAfter=[...b.values()].some(t=>NOTE.test(t));
 if(noteBefore&&!noteAfter)out.push('註記移除');
 if(!noteBefore&&noteAfter)out.push('註記新增');
 const files=x=>JSON.stringify((x.attachments||[]).map(f=>f.url).sort());
 if(files(before)!==files(after))out.push('附件更新');
 if((before.modified||'')!==(after.modified||''))out.push('修正日期');
 if(before.name!==after.name)out.push('名稱');
 return {kinds:out,changedArticles:changed};
}

export async function recentChanges(root,laws,{days=90}={}){
 const history=JSON.parse(await readFile(join(root,'data/history.json'),'utf8'));
 const archive=history.archive?.laws||{},out=[];
 const latest=Math.max(...Object.values(archive).flatMap(v=>v.map(x=>Date.parse(x.recordedAt))));
 const since=latest-days*86400000;
 const object=async url=>JSON.parse(await readFile(join(root,url.slice(1)),'utf8')).law;
 for(const [id,versions] of Object.entries(archive)){
  if(!laws[id]||versions.length<2)continue;
  // newest first: the latest change that is more than a re-check of the same text
  for(let i=versions.length-1;i>=1;i--){
   const v=versions[i];if(Date.parse(v.recordedAt)<since)break;
   const {kinds:k,changedArticles}=kinds(await object(versions[i-1].file.url),await object(v.file.url));
   if(!k.length||(k.length===1&&k[0]==='條文排版'))continue;  // whitespace only: not a change a reader needs
   out.push({id,name:laws[id].name,region:laws[id].region,modified:laws[id].modified||'',recordedAt:v.recordedAt,kinds:k,changedArticles});
   break;
  }
 }
 return out.sort((a,b)=>b.recordedAt.localeCompare(a.recordedAt)||a.id.localeCompare(b.id));
}

export async function regionSync(root,laws){
 let report={};try{report=JSON.parse(await readFile(join(root,'data/sync-report.json'),'utf8'));}catch{}
 const failed={};for(const f of report.localFailures||[]){const region=laws[f.id]?.region||String(f.id).split('-')[0];failed[region]=(failed[region]||0)+1;}
 const regions={};
 for(const law of Object.values(laws)){
  const r=regions[law.region]??={laws:0,newestRetrieved:'',oldestRetrieved:''};r.laws++;
  const t=law.retrieved||'';if(!t)continue;
  if(t>r.newestRetrieved)r.newestRetrieved=t;if(!r.oldestRetrieved||t<r.oldestRetrieved)r.oldestRetrieved=t;
 }
 for(const [region,r] of Object.entries(regions))r.failedLastWeeklyRun=failed[region]||0;
 return {lastWeeklyRun:report.fetchedAt||'',note:'newestRetrieved／oldestRetrieved 是該地區法規最近／最久一次向官方核對的時間；failedLastWeeklyRun 是最近一次每週同步連不到或需人工確認的法規數。',regions};
}
