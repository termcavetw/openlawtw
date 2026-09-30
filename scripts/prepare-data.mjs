import {prepareDocumentReaders} from './prepare-document-readers.mjs';
import {fileURLToPath} from 'node:url';
import {makeUniverseData} from './universe-data.mjs';
import {gzipSync} from 'node:zlib';
import {readFile,writeFile,mkdir,rm,cp} from 'node:fs/promises';
import {join} from './paths.mjs';
import {buildIndex} from '../lib/inverted.ts';
import {normalize} from '../lib/search.ts';
import {makeCitationTargets,makeCitationContext} from '../lib/citations.ts';
import {enrichLaw,sha} from './schema.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),dir=join(root,'public/data/v2');
const read=p=>readFile(join(root,p),'utf8').then(JSON.parse);
const raw=await read('public/data/laws.json'),archive=await read('public/data/rulings.json'),catalog=await read('data/catalog.json'),pkg=await read('package.json'),provenance=await read('data/provenance.json');
let history;try{history=await read('data/history.json');}catch{throw Error('Run npm run snapshot once to create the observation baseline.');}
// This directory contains only generated build output.
await rm(dir,{recursive:true,force:true});await mkdir(dir,{recursive:true});
const files=new Map();
async function emit(kind,value){const compressed=kind==='index'||kind==='universe-rulings',body=compressed?gzipSync(JSON.stringify(value)):JSON.stringify(value),hash=sha(body),url='/data/v2/'+kind+'-'+hash+(compressed?'.bin':'.json');const f={url,sha256:hash,bytes:Buffer.byteLength(body),...(compressed?{encoding:'gzip'}:{})};if(!files.has(url)){await writeFile(join(root,'public',url),body);files.set(url,f);}return f;}
const manifest={schemaVersion:2,release:pkg.version,collected:catalog.collected,laws:{},related:{},rulings:{},rulingHeads:null,rulingCounts:null,documents:{},documentTexts:{},indexes:[],packs:[],provenance:null,history:null,files:[]};
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
const rulingCounts={},enriched=[];
for(const law of docs){
 const document=enrichLaw(law,history.laws[law.id],provenance.sources);enriched.push(document);
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
provenance.sources.NLMA={url:archive.stats.feed,sha256:archive.stats.sha256,hashScope:'downloaded-json-feed',observedAt:archive.stats.retrieved};manifest.provenance=await emit('provenance',provenance);
manifest.history=await emit('history',history);
const universe=makeUniverseData(catalog,archive);
manifest.universe=await emit('universe',universe.laws);
manifest.universeRulings=await emit('universe-rulings',universe.rulings);
manifest.files=[...files.values()];
// The starter catalogue carries counts, not every chapter/article or full text.
const slim={...catalog,version:pkg.version,laws:catalog.laws.map(l=>({...l,articles:[],articleCount:l.articles.length,history:'',note:'',preamble:'',attachments:[]}))};
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
