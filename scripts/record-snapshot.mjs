import {readFile,writeFile,mkdir,rename,rm} from 'node:fs/promises';
import {resolve,relative,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {canonicalLaw,sha} from './schema.mjs';

const archiveNote='本庫自建立封存起保留可重現的版本；較早的雜湊觀測紀錄沒有正文，不能還原為歷史法規。封存時間不是官方修正、生效或再次核對日期。';
const sorted=value=>Array.isArray(value)?value.map(sorted):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>[k,sorted(v)])):value;
const encode=value=>JSON.stringify(sorted(value));
function inputPath(root,path){const full=resolve(root,path),local=relative(root,full);if(local==='..'||local.startsWith('..'+sep)||resolve(path)===path)throw Error('Source path must remain inside project: '+path);return full;}
async function readOptional(path,fallback){try{return JSON.parse(await readFile(path,'utf8'));}catch(error){if(error.code==='ENOENT')return fallback;throw error;}}

/** history.json is the sole commit point. Before it is atomically replaced, a
 * failure can leave only unreferenced immutable objects, never partial history.
 * No network request happens here: recordedAt means archive creation, not an
 * official-source check. Existing hash-only history is retained without bodies.
 */
export async function recordSnapshots(root,{recordedAt=new Date().toISOString(),beforeCommit}={}){
 if(!Number.isFinite(Date.parse(recordedAt)))throw Error('Invalid archive timestamp');
 root=resolve(root);const read=path=>readFile(inputPath(root,path),'utf8').then(JSON.parse);
 const [laws,catalog,documents]=await Promise.all([read('public/data/laws.json'),read('data/catalog.json'),readOptional(inputPath(root,'data/documents/catalog.json'),{})]);
 const historyPath=inputPath(root,'data/history.json');
 const ledger=await readOptional(historyPath,{schemaVersion:2,note:'觀測紀錄不是官方修法日期；基準之前的歷史尚未收錄。',laws:{},changes:[]});
 ledger.archive??={schemaVersion:1,note:archiveNote,laws:{}};
 if(ledger.archive.schemaVersion!==1)throw Error('Unsupported version archive schema');
 let changes=0,archived=0,newObjects=0,newAssets=0;
 const immutable=async(kind,bytes,extension)=>{
  const hash=sha(bytes),url='/data/versions/'+kind+'/'+hash+extension;
  const path=inputPath(root,url.slice(1));await mkdir(resolve(path,'..'),{recursive:true});
  try{await writeFile(path,bytes,{flag:'wx'});if(kind==='objects')newObjects++;else newAssets++;}
  catch(error){if(error.code!=='EEXIST')throw error;const previous=await readFile(path);if(sha(previous)!==hash)throw Error('Immutable archive is damaged: '+url);}
  return {url,sha256:hash,bytes:bytes.length};
 };
 for(const law of Object.values(laws).sort((a,b)=>a.id.localeCompare(b.id))){
  const originals=[],source=documents[law.id];
  if(law.document&&!source)throw Error('Original document is missing from source catalogue: '+law.id);
  if(law.document?.sha256&&source?.sha256!==law.document.sha256)throw Error('Law and original source checksums disagree: '+law.id);
  if(source){
   const roles=[['official-original',source.file],['readable-content',source.contentFile],['extracted-text',source.format==='html'?null:source.file.replace(/\.pdf$/i,'-text.json')]];
   for(const [role,path] of roles){if(!path)continue;const bytes=await readFile(inputPath(root,path));if(role==='official-original'&&sha(bytes)!==source.sha256)throw Error('Original source checksum mismatch: '+law.id);const extension=extname(path).toLowerCase();if(!['.pdf','.html','.json'].includes(extension))throw Error('Unsupported archive source: '+path);originals.push({role,filename:path.split(/[\\/]/).at(-1),...await immutable('assets',bytes,extension)});}
  }
  // Keep the complete input law, including evidence metadata. Archive hashes
  // exclude the recording clock; rerunning an unchanged snapshot is a no-op.
  const object={schemaVersion:1,law,originals,...(source?{documentSource:source}:{})};
  const bytes=Buffer.from(encode(object)),file=await immutable('objects',bytes,'.json');
  const versions=ledger.archive.laws[law.id]??=[];const previous=versions.at(-1);
  const hash=sha(canonicalLaw(law)),old=ledger.laws[law.id];
  const articles=Object.fromEntries(law.articles.map(a=>[a.no,sha(a.text)]));
  const changed=old?[...new Set([...Object.keys(old.articles||{}),...Object.keys(articles)])].filter(no=>old.articles?.[no]!==articles[no]):[];
  if(previous?.file.sha256!==file.sha256){
   let archiveChangedArticles=[];
   if(previous){const oldObject=JSON.parse(await readFile(inputPath(root,previous.file.url.slice(1)),'utf8'));if(sha(encode(oldObject))!==previous.file.sha256)throw Error('Previous archive checksum mismatch: '+law.id);const oldArticles=new Map(oldObject.law.articles.map(a=>[a.no,a.text]));const currentArticles=new Map(law.articles.map(a=>[a.no,a.text]));archiveChangedArticles=[...new Set([...oldArticles.keys(),...currentArticles.keys()])].filter(no=>oldArticles.get(no)!==currentArticles.get(no));}
   versions.push({recordedAt,file,contentHash:hash,previousVersion:previous?.file.sha256||null,changedArticles:archiveChangedArticles,officialModified:law.modified||'',effectiveDate:law.effective||'',sourceRetrieved:law.retrieved||'',batchDate:catalog.collected||'',...(source?{documentSha256:source.sha256,documentRetrieved:source.retrieved||''}:{})});archived++;
  }
  if(old?.contentHash!==hash){const observedAt=catalog.collected;ledger.laws[law.id]={contentHash:hash,observedAt,previousContentHash:old?.contentHash||null,articles};if(old)ledger.changes.push({law:law.id,name:law.name,observedAt,previousContentHash:old.contentHash,contentHash:hash,changedArticles:changed});changes++;}
 }
 if(changes||archived){
  const temporary=historyPath+'.'+randomUUID()+'.tmp';
  try{await writeFile(temporary,JSON.stringify(ledger));await beforeCommit?.();await rename(temporary,historyPath);}finally{await rm(temporary,{force:true});}
 }
 return {changes,archived,newObjects,newAssets,laws:Object.keys(laws).length};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const result=await recordSnapshots(fileURLToPath(new URL('../',import.meta.url)));
 console.log(JSON.stringify({snapshot:'committed',...result}));
}
