import {runtimeSyncStatus} from './runtime-sync-status.mjs';
import {prepareArticleSupplements} from './prepare-article-supplements.mjs';
import {prepareArticleFigures} from './prepare-article-figures.mjs';
import {prepareDocumentReaders} from './prepare-document-readers.mjs';
import {fileURLToPath} from 'node:url';
import {makeUniverseData} from './universe-data.mjs';
import {gzipSync} from 'node:zlib';
import {readFile,writeFile,mkdir,rm,cp} from 'node:fs/promises';
import {join} from './paths.mjs';
import {buildIndex} from '../lib/inverted.ts';
import {normalize} from '../lib/search.ts';
import {numberKey,revocations} from './revocations.mjs';
import {makeCitationTargets,makeCitationContext} from '../lib/citations.ts';
import {enrichLaw,sha} from './schema.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),dir=join(root,'public/data/v2');
const read=p=>readFile(join(root,p),'utf8').then(JSON.parse);
await prepareArticleSupplements(root);
await import('./check-article-supplements.mjs');
const raw=await read('public/data/laws.json'),archive=await read('public/data/rulings.json'),catalog=await read('data/catalog.json'),pkg=await read('package.json'),provenance=await read('data/provenance.json');
let history;try{history=await read('data/history.json');}catch{throw Error('Run npm run snapshot once to create the observation baseline.');}
// This directory contains only generated build output.
await rm(dir,{recursive:true,force:true});await mkdir(dir,{recursive:true});
const files=new Map();
async function emit(kind,value){const compressed=kind==='index'||kind==='universe-rulings',body=compressed?gzipSync(JSON.stringify(value)):JSON.stringify(value),hash=sha(body),url='/data/v2/'+kind+'-'+hash+(compressed?'.bin':'.json');const f={url,sha256:hash,bytes:Buffer.byteLength(body),...(compressed?{encoding:'gzip'}:{})};if(!files.has(url)){await writeFile(join(root,'public',url),body);files.set(url,f);}return f;}
const manifest={schemaVersion:2,release:pkg.version,collected:catalog.collected,laws:{},related:{},rulings:{},rulingHeads:null,rulingCounts:null,documents:{},documentTexts:{},indexes:[],packs:[],provenance:null,history:null,files:[]};
if(catalog.syncStatus)manifest.syncStatus=await emit('sync-status',runtimeSyncStatus(catalog.syncStatus));
const documentSources=await read('data/documents/catalog.json');
const documentPages=new Map();
for(const [id,source] of Object.entries(documentSources)){
 const original=await readFile(join(root,source.file));if(sha(original)!==source.sha256)throw Error('Document source checksum mismatch: '+id);
 const text=await read(source.format==='html'?source.contentFile:source.file.replace('.pdf','-text.json'));
 const pages=text.searchPages||text.pages;documentPages.set(id,pages);
 manifest.documentTexts[id]=await emit('document-text',{pages});
 manifest.documents[id]=await emit('document',source.format==='html'?text:{...text,format:'pdf',pdf:original.toString('base64'),sha256:source.sha256});
}
const readers=await prepareDocumentReaders(root,documentSources,emit);manifest.documentReaders=readers.indices;
const docs=Object.values(raw).sort((a,b)=>a.id.localeCompare(b.id));
// Historical bodies/assets stay addressable without inflating initial or current offline packs.
if(history.archive)await cp(join(root,'data/versions'),join(root,'public/data/versions'),{recursive:true});
const heads=archive.items.map(r=>({...r,body:'',summaryOnly:true,refs:r.refs,attachments:[]}));
manifest.rulingHeads=await emit('ruling-heads',heads);
const articleFigures=await prepareArticleFigures(root,raw);
const rulingCounts={},enriched=[];
for(const law of docs){
 const document=enrichLaw(law,history.laws[law.id],provenance.sources);for(const article of document.articles){const figures=articleFigures[law.id]?.[article.no];if(figures)article.figures=figures;}enriched.push(document);
 manifest.laws[law.id]=await emit('law',document);
 const related=heads.filter(r=>r.refs.some(ref=>ref.law===law.id));
 if(related.length)manifest.related[law.id]=await emit('related',related);
 const articles={};for(const ruling of related)for(const no of new Set(ruling.refs.filter(ref=>ref.law===law.id&&ref.article).map(ref=>normalize(ref.article))))articles[no]=(articles[no]||0)+1;
 rulingCounts[law.id]={total:related.length,articles};
}
manifest.rulingCounts=await emit('ruling-counts',rulingCounts);
const groups=new Map();for(const law of docs){if(law.coverage!=='full'&&!law.document)continue;const key=law.region==='中央'?law.region+':'+sha(law.id)[0]:law.region;let group=groups.get(key);if(!group)groups.set(key,group=[]);for(const a of law.articles)group.push({row:{id:law.id,no:a.no},fields:[law.name,law.region,law.id,...law.keywords,a.text]});for(const p of documentPages.get(law.id)||[])group.push({row:{id:law.id,documentPage:p.page},fields:[law.name,law.region,law.id,...law.keywords,p.text]});}
for(const [region,entries] of groups)manifest.indexes.push({kind:'laws',region:region.split(':')[0],file:await emit('index',buildIndex(entries))});
const buckets=new Map();for(const r of archive.items){const key=String(Math.floor(Number(r.id)/256));let list=buckets.get(key);if(!list)buckets.set(key,list=[]);list.push(r);}
for(const [key,list] of [...buckets].sort(([a],[b])=>Number(a)-Number(b))){list.sort((a,b)=>Number(a.id)-Number(b.id));const file=await emit('rulings',list);manifest.rulings[key]=file;const index=buildIndex(list.map(r=>({row:{id:r.id,articles:[...new Set(r.refs.map(ref=>normalize(ref.article)))]},fields:[r.number,r.numberKey,r.title,r.body,r.topic,r.unit]})));manifest.indexes.push({kind:'rulings',region:key,file:await emit('index',index)});}
const unique=entries=>[...new Map(entries.filter(Boolean).map(f=>[f.url,f])).values()];
for(const region of ['中央',...catalog.regions.map(r=>r.name)]){
 const laws=docs.filter(l=>l.region===region&&(l.coverage==='full'||l.document));const packFiles=unique([...laws.filter(l=>l.document).flatMap(l=>[manifest.documents[l.id],manifest.documentTexts[l.id],...(readers.files[l.id]||[])]),manifest.rulingCounts,...laws.flatMap(l=>[manifest.laws[l.id],manifest.related[l.id]]),...manifest.indexes.filter(i=>i.kind==='laws'&&i.region===region).map(i=>i.file)]);
 manifest.packs.push({id:region,label:region==='中央'?'中央法規':region,lawCount:laws.length,files:packFiles,bytes:packFiles.reduce((s,f)=>s+f.bytes,0)});
}
const rulingFiles=unique([manifest.rulingCounts,manifest.rulingHeads,...Object.values(manifest.rulings),...Object.values(manifest.related),...manifest.indexes.filter(i=>i.kind==='rulings').map(i=>i.file)]);
manifest.packs.push({id:'rulings',label:'國土署函釋全文',lawCount:archive.items.length,files:rulingFiles,bytes:rulingFiles.reduce((s,f)=>s+f.bytes,0)});
// Taoyuan minutes (one region, not a legal source) are read whole by the MCP server.
// Content-addressed like v2 shards, but outside manifest.files: they are not part of
// offline packs, the service-worker precache or the portable single-file build.
{const minutes=await readFile(join(root,'public/data/minutes.json'));const hash=sha(minutes),url='/data/minutes/minutes-'+hash+'.json';
 await rm(join(root,'public/data/minutes'),{recursive:true,force:true});await mkdir(join(root,'public/data/minutes'),{recursive:true});await writeFile(join(root,'public',url),minutes);
 const m=JSON.parse(minutes);manifest.minutes={url,sha256:hash,bytes:minutes.length,region:m.region,fetchedAt:m.fetchedAt,items:m.stats.items,pages:m.stats.pages,ocrPages:m.stats.ocrPages};}
// Taoyuan 土管要點 (one region; every announced case, no judgement of which is in force): same treatment.
{const landuse=await readFile(join(root,'public/data/landuse.json'));const hash=sha(landuse),url='/data/landuse/landuse-'+hash+'.json';
 await rm(join(root,'public/data/landuse'),{recursive:true,force:true});await mkdir(join(root,'public/data/landuse'),{recursive:true});await writeFile(join(root,'public',url),landuse);
 const m=JSON.parse(landuse);manifest.landuse={url,sha256:hash,bytes:landuse.length,region:m.region,fetchedAt:m.fetchedAt,items:m.stats.items,areas:m.stats.areas,pages:m.stats.pages,ocrPages:m.stats.ocrPages};}
const cn=t=>{let n=0,cur=0;for(const ch of t){const d='零一二三四五六七八九'.indexOf(ch);if(d>=0)cur=d;else if(ch==='十'){n+=(cur||1)*10;cur=0;}else if(ch==='百'){n+=(cur||1)*100;cur=0;}}return n+cur;};
// Each article's last change (修正／增訂／刪除, or a full-text revision), from the law's history — the same rule the
// skill uses for 國土署 letters: a letter dated before it was written against older text.
const rocNum=t=>/^\d+$/.test(t)?Number(t):cn(t.replace(/〇/g,'零'));
const ROC=/(?:中華)?民國\s*([〇零一二三四五六七八九十百0-9]+)\s*年\s*([〇零一二三四五六七八九十0-9]+)\s*月\s*([〇零一二三四五六七八九十0-9]+)\s*日/u;
const expandNos=chunk=>chunk.replace(/\s/g,'').split(/[、，,]/).filter(Boolean).flatMap(part=>{const m=part.split(/[～~]/);if(m.length!==2)return [part];
 const [pa,pb]=m.map(x=>x.split('-').map(Number));if(pa.some(isNaN)||pb.some(isNaN))return m;const out=[];
 if(pa.length===1&&pb.length===1)for(let i=pa[0];i<=pb[0];i++)out.push(String(i));
 else if(pa.length===2&&pb.length===2&&pa[0]===pb[0])for(let i=pa[1];i<=pb[1];i++)out.push(pa[0]+'-'+i);
 else if(pa.length===1&&pb.length===2){out.push(String(pa[0]));for(let i=1;i<=pb[1];i++)out.push(pb[0]+'-'+i);}
 else out.push(...m);return out;});
const amendCache=new Map();
const amendments=law=>{if(amendCache.has(law.id))return amendCache.get(law.id);const dates=new Map();let full='';
 for(const item of ('\n'+(law.history||'')).split(/\n\s*\d+\.\s*/)){const text=item.replace(/\s*\n\s*/g,'');const m=text.match(ROC);if(!m)continue;
  const iso=`${rocNum(m[1])+1911}-${String(rocNum(m[2])).padStart(2,'0')}-${String(rocNum(m[3])).padStart(2,'0')}`;
  const lists=[...text.matchAll(/第\s*([0-9][0-9\-、～~，,\s]*?)\s*條/gu)].map(x=>x[1]);
  // 「修正公布」 with no article list (and not just a name, chapter title, table or commencement) is a full revision:
  // 消防法 84.08.11. Item by item, so an agency name like 「台內中地字」 cannot cut the match short.
  if(/全文\s*\d*\s*條|修正發布全文|修正全文/u.test(text)||(!lists.length&&/修正(公布|發布)/u.test(text)&&!/名稱|章名|附表|附件|圖|增訂|刪除|施行/u.test(text))){if(iso>full)full=iso;continue;}
  for(const chunk of lists)for(const no of expandNos(chunk)){const key=normalize('第 '+no+' 條');if((dates.get(key)||'')<iso)dates.set(key,iso);}}
 const result={dates,full};amendCache.set(law.id,result);return result;};
// A law's last full-text revision: article numbers only hold since then.
const renumbered=law=>amendments(law).full;
const amendedOn=(law,no)=>{const {dates,full}=amendments(law);const d=dates.get(no)||'';return d>full?d:full;};
// Letters older than the article they discuss: {letterId:[[lawId, articleKey, amendedOn, lawName]]}.
const staleness=(hits,date,lawById)=>{const out=[];for(const [id,nos] of hits){const law=lawById.get(id);for(const no of nos){const d=amendedOn(law,no);if(d&&date&&date<d)out.push([id,no,d,law.name]);}}return out;};
const lawById=new Map(docs.map(l=>[l.id,l]));
// Letters a later letter of the same source declares 停止適用: {oldId:[byId, byDate, byIssuerAndDocNo, partial 0|1]}.
const revokedMap=items=>{const out={};for(const [id,{by,partial}] of revocations(items.map(x=>({id:x.id,date:x.date||'',docNo:x.docNo||'',issuer:x.issuer||'',text:[x.title,x.summary,x.body].filter(Boolean).join('\n')}))))out[id]=[String(by.id),by.date,(by.issuer+' '+by.docNo).trim(),partial?1:0];return out;};
// 農業部 farmland / farmhouse interpretations (rmis.ardswc.gov.tw): same treatment.
{const agri=await readFile(join(root,'public/data/agri-rulings.json'));const hash=sha(agri),url='/data/agri/agri-rulings-'+hash+'.json';
 await rm(join(root,'public/data/agri'),{recursive:true,force:true});await mkdir(join(root,'public/data/agri'),{recursive:true});await writeFile(join(root,'public',url),agri);
 const m=JSON.parse(agri);manifest.agri={url,sha256:hash,bytes:agri.length,fetchedAt:m.fetchedAt,items:m.stats.items};
 // Letters linked to central laws: by the site's law field, and to articles by an explicit "<law name>第N條" in the text.
 const central=new Map();for(const law of docs)if(law.region==='中央'&&!central.has(law.name))central.set(law.name,law);
 const alias={'農發條例':'農業發展條例'},names=[...new Set([...m.items.flatMap(x=>x.laws),...Object.values(alias),'農業發展條例施行細則'])].filter(n=>central.has(n));
 const spelled=[...names,...Object.keys(alias).filter(a=>names.includes(alias[a]))].sort((a,b)=>b.length-a.length).map(n=>n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
 const cite=new RegExp('('+spelled.join('|')+')第\\s*([0-9０-９一二三四五六七八九十百零〇]+)\\s*條(?:之\\s*([0-9０-９一二三四五六七八九十]+))?','gu');
 // Article numbers only hold since the law's last full-text revision (全文); older letters link to the law alone.
 const since=new Map([...central.values()].map(l=>[l.id,renumbered(l)]));
 const refs={},heads={},stale={};
 for(const x of m.items){const hit=new Map();for(const n of x.laws)if(central.has(n))hit.set(central.get(n).id,new Set());
  for(const [,n,a,b] of (x.title+'\n'+x.body).matchAll(cite)){const law=central.get(alias[n]||n);const no=normalize('第'+a+(b?'之'+b:'')+'條');if(x.date<since.get(law.id)||!law.articles.some(r=>normalize(r.no)===no))continue;if(!hit.has(law.id))hit.set(law.id,new Set());hit.get(law.id).add(no);}
  if(!hit.size)continue;heads[x.id]=[x.date,x.docNo,x.title];{const st=staleness(hit,x.date,lawById);if(st.length)stale[x.id]=st;}
  for(const [id,nos] of hit){const r=refs[id]||(refs[id]={ids:[],articles:{}});r.ids.push(x.id);for(const no of nos)(r.articles[no]||(r.articles[no]=[])).push(x.id);}}
 const newest=(a,b)=>heads[b][0].localeCompare(heads[a][0])||b-a;for(const r of Object.values(refs)){r.ids.sort(newest);for(const k in r.articles)r.articles[k].sort(newest);}
 manifest.agriRefs={...await emit('agri-refs',{laws:refs,heads,stale,revoked:revokedMap(m.items)}),laws:Object.keys(refs).sort()};}
// 內政部地政司 地政法令彙編 解釋函 (preserved export): lazy, and linked to central law articles by the compilation's own filing.
{const land=await readFile(join(root,'public/data/land-rulings.json'));const hash=sha(land),url='/data/land/land-rulings-'+hash+'.json';
 await rm(join(root,'public/data/land'),{recursive:true,force:true});await mkdir(join(root,'public/data/land'),{recursive:true});await writeFile(join(root,'public',url),land);
 const m=JSON.parse(land);manifest.land={url,sha256:hash,bytes:land.length,fetchedAt:m.fetchedAt,items:m.stats.items};
 const byName=new Map();for(const law of docs)if(law.region==='中央'&&!byName.has(law.name))byName.set(law.name,law);
 const refs={},heads={},stale={};
 for(const x of m.items){const hit=new Map();
  for(const r of x.refs){const law=byName.get(r.law);if(!law)continue;if(!hit.has(law.id))hit.set(law.id,new Set());const no=normalize(r.article);if(law.articles.some(z=>normalize(z.no)===no))hit.get(law.id).add(no);}
  if(!hit.size)continue;heads[x.id]=[x.date,(x.issuer+' '+x.docNo).trim(),x.summary];{const st=staleness(hit,x.date,lawById);if(st.length)stale[x.id]=st;}
  for(const [id,nos] of hit){const r=refs[id]||(refs[id]={ids:[],articles:{}});r.ids.push(x.id);for(const no of nos)(r.articles[no]||(r.articles[no]=[])).push(x.id);}}
 const newest=(a,b)=>heads[b][0].localeCompare(heads[a][0])||b.localeCompare(a);for(const r of Object.values(refs)){r.ids.sort(newest);for(const k in r.articles)r.articles[k].sort(newest);}
 manifest.landRefs={...await emit('land-refs',{laws:refs,heads,stale,revoked:revokedMap(m.items)}),laws:Object.keys(refs).sort()};}
// 內政部消防署 法令解釋／執法疑義 (preserved export): lazy, and linked by the system's own 相關法條 — article links only
// when the law version the letter cites is on or after the law's last full-text revision (and not a former version).
{const nfa=await readFile(join(root,'public/data/nfa-rulings.json'));const hash=sha(nfa),url='/data/nfa/nfa-rulings-'+hash+'.json';
 await rm(join(root,'public/data/nfa'),{recursive:true,force:true});await mkdir(join(root,'public/data/nfa'),{recursive:true});await writeFile(join(root,'public',url),nfa);
 const m=JSON.parse(nfa);manifest.nfa={url,sha256:hash,bytes:nfa.length,fetchedAt:m.fetchedAt,items:m.stats.items};
 const alias={'公共危險物品及可燃性高壓氣體設置標準暨安全管理辦法':'公共危險物品及可燃性高壓氣體製造儲存處理場所設置標準暨安全管理辦法'};
 const byName=new Map();for(const law of docs)if(law.region==='中央'&&!byName.has(law.name))byName.set(law.name,law);
 const refs={},heads={},stale={};
 for(const x of m.items){const hit=new Map();
  for(const r of x.refs){const law=byName.get(alias[r.law]||r.law);if(!law)continue;if(!hit.has(law.id))hit.set(law.id,new Set());
   if(r.historical||!r.version||r.version<renumbered(law))continue;for(const a of r.articles){const no=normalize(a);if(law.articles.some(z=>normalize(z.no)===no))hit.get(law.id).add(no);}}
  if(!hit.size)continue;heads[x.id]=[x.date,(x.issuer+' '+x.docNo).trim(),x.summary];{const st=staleness(hit,x.date,lawById);if(st.length)stale[x.id]=st;}
  for(const [id,nos] of hit){const r=refs[id]||(refs[id]={ids:[],articles:{}});r.ids.push(x.id);for(const no of nos)(r.articles[no]||(r.articles[no]=[])).push(x.id);}}
 const newest=(a,b)=>heads[b][0].localeCompare(heads[a][0])||b.localeCompare(a);for(const r of Object.values(refs)){r.ids.sort(newest);for(const k in r.articles)r.articles[k].sort(newest);}
 manifest.nfaRefs={...await emit('nfa-refs',{laws:refs,heads,stale,revoked:revokedMap(m.items)}),laws:Object.keys(refs).sort()};}
// 新北市建照業務工作手冊: same lazy treatment.
{const ntpc=await readFile(join(root,'public/data/ntpc-manual.json'));const hash=sha(ntpc),url='/data/ntpc/ntpc-manual-'+hash+'.json';
 await rm(join(root,'public/data/ntpc'),{recursive:true,force:true});await mkdir(join(root,'public/data/ntpc'),{recursive:true});await writeFile(join(root,'public',url),ntpc);
 const m=JSON.parse(ntpc);manifest.ntpcManual={url,sha256:hash,bytes:ntpc.length,fetchedAt:m.fetchedAt,edition:m.edition,cases:m.stats.cases};}
// Central agencies' letters: those filed under central laws in laws.gov.taipei (weekly sync), plus 經濟部中部辦公室
// 《工廠管理輔導法暨相關函釋彙編》 (preserved import). A letter in both is kept once (Taipei's copy, with both filings).
{const readJSON=async path=>{try{return JSON.parse(await readFile(join(root,path),'utf8'));}catch(error){if(error.code==='ENOENT')return null;throw error;}};
 const base=await readJSON('public/data/central-rulings.json'),moea=await readJSON('public/data/moea-factory-rulings.json');
 if(base||moea){
 const factoryTopic='工廠與產業';
 const m=base?{...base,laws:[...base.laws],items:base.items.map(x=>({...x,filed:[...x.filed]}))}:{source:'',sourceUrl:'',note:'',fetchedAt:moea.fetchedAt,laws:[],stats:{},items:[]};
 if(moea){
  const byKey=new Map();for(const x of m.items){const k=numberKey(x.docNo);if(k)byKey.set(k,x);}
  const origin='經濟部中部辦公室《工廠管理輔導法暨相關函釋彙編》（'+Object.keys(moea.editions).sort().reverse().map(e=>moea.editions[e].label).join('、')+'）';
  for(const x of moea.items){const same=byKey.get(numberKey(x.docNo));
   if(same){for(const f of x.filed)if(!same.filed.some(g=>g.law===f.law&&g.article===f.article))same.filed.push(f);continue;}
   m.items.push({id:x.id,date:x.date,docNo:x.docNo,issuer:x.issuer,summary:x.summary,body:x.body,filed:x.filed,refs:[],url:'',topics:x.topics,
    origin:origin.replace(/（.*）/,'（'+x.editions.map(e=>moea.editions[e].label).join('、')+'）')+(x.note?'；'+x.note:'')});}
  for(const name of new Set(moea.items.flatMap(x=>x.filed.map(f=>f.law))))if(!m.laws.some(l=>l.name===name))m.laws.push({id:'',name,topic:name==='申請農業用地作農業設施容許使用審查辦法'||name==='農業發展條例'?'農業':name==='消防法'?'消防':factoryTopic});
  m.items.sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id));
  const topicOf=new Map(m.laws.map(l=>[l.name,l.topic])),count=list=>Object.entries(list.reduce((o,k)=>(o[k]=(o[k]||0)+1,o),{})).map(([name,items])=>({name,items})).sort((a,b)=>b.items-a.items);
  m.source=(base?.source?base.source+'；':'')+moea.source;
  m.note=(base?.note?base.note+'\n':'')+moea.note;
  m.stats={...(base?.stats||{}),items:m.items.length,sources:{taipei:base?.items.length||0,moea:m.items.length-(base?.items.length||0)},
   topics:['消防',factoryTopic,'農業'].map(name=>({name,items:m.items.filter(x=>x.filed.some(f=>topicOf.get(f.law)===name)).length})),issuers:count(m.items.map(x=>x.issuer))};
 }
 const central=Buffer.from(JSON.stringify(m));const hash=sha(central),url='/data/central/central-rulings-'+hash+'.json';
 await rm(join(root,'public/data/central'),{recursive:true,force:true});await mkdir(join(root,'public/data/central'),{recursive:true});await writeFile(join(root,'public',url),central);
 manifest.central={url,sha256:hash,bytes:central.length,fetchedAt:m.fetchedAt,items:m.items.length};
 const byName=new Map();for(const law of docs)if(law.region==='中央'&&!byName.has(law.name))byName.set(law.name,law);
 const refs={},heads={},stale={};
 for(const x of m.items){const hit=new Map();
  // Article numbers a letter merely names (cited) hold only since the law's last full-text revision; a compiler's filing is trusted.
  for(const f of x.filed){const law=byName.get(f.law);if(!law)continue;if(!hit.has(law.id))hit.set(law.id,new Set());if(!f.article||(f.cited&&x.date<renumbered(law)))continue;const no=normalize(f.article);if(law.articles.some(z=>normalize(z.no)===no))hit.get(law.id).add(no);}
  if(!hit.size)continue;heads[x.id]=[x.date,(x.issuer+' '+x.docNo).trim(),x.summary];{const st=staleness(hit,x.date,lawById);if(st.length)stale[x.id]=st;}
  for(const [id,nos] of hit){const r=refs[id]||(refs[id]={ids:[],articles:{}});r.ids.push(x.id);for(const no of nos)(r.articles[no]||(r.articles[no]=[])).push(x.id);}}
 const newest=(a,b)=>heads[b][0].localeCompare(heads[a][0])||b.localeCompare(a);for(const r of Object.values(refs)){r.ids.sort(newest);for(const k in r.articles)r.articles[k].sort(newest);}
 manifest.centralRefs={...await emit('central-refs',{laws:refs,heads,stale,revoked:revokedMap(m.items)}),laws:Object.keys(refs).sort()};
}}
// 臺北市解釋令函 (laws.gov.taipei), when the weekly sync has collected them: same lazy treatment, and links to the
// central and 臺北市 laws by the city's own related-law filing (article links only since the law's last full-text revision).
try{const taipei=await readFile(join(root,'public/data/taipei-rulings.json'));const hash=sha(taipei),url='/data/taipei/taipei-rulings-'+hash+'.json';
 await rm(join(root,'public/data/taipei'),{recursive:true,force:true});await mkdir(join(root,'public/data/taipei'),{recursive:true});await writeFile(join(root,'public',url),taipei);
 const m=JSON.parse(taipei);manifest.taipei={url,sha256:hash,bytes:taipei.length,fetchedAt:m.fetchedAt,items:m.stats.items};
 const byName=new Map();for(const law of docs)if(law.region==='中央'||law.region==='臺北市'){const key=law.region+':'+law.name;if(!byName.has(key))byName.set(key,law);}
 const refs={},heads={},stale={};
 for(const x of m.items){const hit=new Map();
  for(const r of x.refs){const law=byName.get((r.scope==='臺北市'?'臺北市':'中央')+':'+r.law);if(!law)continue;if(!hit.has(law.id))hit.set(law.id,new Set());
   for(const a of r.articles){const no=normalize(a);if(x.date>=renumbered(law)&&law.articles.some(z=>normalize(z.no)===no))hit.get(law.id).add(no);}}
  if(!hit.size)continue;heads[x.id]=[x.date,(x.issuer+' '+x.docNo).trim(),x.summary];{const st=staleness(hit,x.date,lawById);if(st.length)stale[x.id]=st;}
  for(const [id,nos] of hit){const r=refs[id]||(refs[id]={ids:[],articles:{}});r.ids.push(x.id);for(const no of nos)(r.articles[no]||(r.articles[no]=[])).push(x.id);}}
 const newest=(a,b)=>heads[b][0].localeCompare(heads[a][0])||b.localeCompare(a);for(const r of Object.values(refs)){r.ids.sort(newest);for(const k in r.articles)r.articles[k].sort(newest);}
 manifest.taipeiRefs={...await emit('taipei-refs',{laws:refs,heads,stale,revoked:revokedMap(m.items)}),laws:Object.keys(refs).sort()};
}catch(error){if(error.code!=='ENOENT')throw error;}
provenance.sources.NLMA={url:archive.stats.feed,sha256:archive.stats.sha256,hashScope:'downloaded-json-feed',observedAt:archive.stats.retrieved};manifest.provenance=await emit('provenance',provenance);
manifest.history=await emit('history',history);
const universe=makeUniverseData(catalog,archive);
manifest.universe=await emit('universe',universe.laws);
manifest.universeRulings=await emit('universe-rulings',universe.rulings);
manifest.files=[...files.values()];
// The starter catalogue carries counts, not every chapter/article or full text.
// Per-law status labels are unused by the lightweight catalogue; the full
// law shard preserves them. Avoid duplicating them in every initial shell.
const {syncStatus:_syncStatus,...runtimeCatalog}=catalog;
const slim={...runtimeCatalog,version:pkg.version,laws:catalog.laws.map(l=>({...l,articles:[],articleCount:l.articles.length,history:'',note:'',status:'',preamble:'',attachments:[]}))};
// A loaded law already contains its own declarations. Only cross-volume
// general-provision evidence must be carried by the lightweight app shell.
const externalCitationContext=Object.fromEntries(Object.entries(makeCitationContext(enriched)).map(([id,scope])=>[id,Object.fromEntries(Object.entries(scope).map(([alias,rows])=>[alias,rows.filter(row=>row.sourceLaw!==id)]).filter(([,rows])=>rows.length))]).filter(([,scope])=>Object.keys(scope).length));
await writeFile(join(root,'data/runtime-citation-context.json'),JSON.stringify(externalCitationContext));
await writeFile(join(root,'data/runtime-citations.json'),JSON.stringify(makeCitationTargets(enriched)));
await writeFile(join(root,'data/runtime-catalog.json'),JSON.stringify(slim));
await writeFile(join(root,'data/runtime-manifest.json'),JSON.stringify(manifest));
await writeFile(join(root,'public/data/manifest.json'),JSON.stringify(manifest));
await writeFile(join(root,'public/data/aliases.json'),await readFile(join(root,'data/aliases.json')));
await writeFile(join(root,'public/data/yinxian-laws.js'),'// Generated from aliases.json and the same official catalogue.\nexport const aliases='+JSON.stringify(await read('data/aliases.json'))+';\nexport const laws='+JSON.stringify(docs.map(l=>({id:l.id,name:l.name,url:l.url})))+';\n');
console.log(JSON.stringify({schema:2,laws:docs.length,shards:files.size,indexBytes:manifest.indexes.reduce((s,i)=>s+i.file.bytes,0),catalogBytes:Buffer.byteLength(JSON.stringify(slim))}));


// Compact public lookup for standalone cards; no personal workspace data.
await writeFile(join(root,'public/data/embed-index.json'),JSON.stringify({schemaVersion:1,release:pkg.version,rulingRetrieved:archive.stats.retrieved,laws:manifest.laws,rulings:manifest.rulings}));
