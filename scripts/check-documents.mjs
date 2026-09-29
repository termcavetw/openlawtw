import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {indexedSearch,manifest} from '../lib/data-client.ts';
import {normalize} from '../lib/search.ts';
import {lawHref,legacyLawHash,readRoute} from '../lib/routes.ts';
const root=new URL('../',import.meta.url),read=p=>readFile(new URL(p,root)),json=async p=>JSON.parse(await read(p));
const sources=await json('data/documents/catalog.json'),catalog=await json('data/runtime-catalog.json');
const html=(await read('openlawtw.html')).toString(),packed=html.match(/atob\("([A-Za-z0-9+/=]+)"\)/)[1],offline=JSON.parse(gunzipSync(Buffer.from(packed,'base64')));
let pdfPages=0,htmlDocuments=0;const textById=new Map();
for(const [id,source] of Object.entries(sources)){
 const original=await read(source.file),file=manifest.documents[id],doc=await json('public'+file.url),textFile=manifest.documentTexts[id],search=await json('public'+textFile.url),law=catalog.laws.find(l=>l.id===id);
 assert.equal(createHash('sha256').update(original).digest('hex'),source.sha256);
 if(source.format==='html'){assert.equal(doc.format,'html');assert(!/<(?:script|iframe|object|embed|style|form)\b|\son\w+\s*=|javascript:/i.test(doc.html));htmlDocuments++;}
 else{assert.deepEqual(Buffer.from(doc.pdf,'base64'),original);pdfPages+=doc.pages.length;}
 assert.deepEqual(offline[file.url],doc);assert.deepEqual(offline[textFile.url],search);assert(!('pdf' in search),'Search text never includes PDF bytes');
 assert.deepEqual(search.pages,doc.searchPages||doc.pages);
 assert.equal(doc.pages.length,source.pages);assert.equal(law.document.sha256,source.sha256);
 assert.equal(law.coverage,'link','Document snapshots do not invent structured articles');
 for(const f of [file,textFile])assert(manifest.packs.find(p=>p.id===law.region).files.some(x=>x.url===f.url),'Document and search text in regional offline pack');
 for(const [i,page] of doc.pages.entries())assert.equal(page.page,i+1);
 assert(search.pages.some(p=>p.text.trim()),id+' searchable text');textById.set(id,search.pages);
 const staticPage=(await read('dist/laws/'+id+'.html')).toString();if(source.format==='html')assert(staticPage.includes(doc.html),'No-JavaScript source document');
 for(const page of search.pages){assert(staticPage.includes('id="document-page-'+page.page+'"'),'Static page anchor');const url=new URL(lawHref(id,'','',page.page),'https://example.test');const route=readRoute(url.pathname,url.hash);assert.equal(route.documentPage,page.page);assert.equal(route.law,id);assert.deepEqual(readRoute('/',legacyLawHash(id,'','',page.page)),route);}
}
assert.deepEqual(textById.get('臺北市-FL069302').map(p=>p.page),[9,10,11,12]);
assert(!textById.get('臺北市-FL069302').some(p=>p.text.includes('職能發展學院')),'Other gazette laws never attributed to this scheme');
for(const hash of ['#document-page-0','#document-page--1','#document-page-1.5','#document-page-9007199254740993'])assert.equal(readRoute('/laws/test.html',hash).documentPage,0);
const requests=[];globalThis.window={};globalThis.fetch=async url=>{requests.push(url);return new Response(await read('public'+url));};
const cases=(await json('data/document-search-quality.json')).cases;
for(const test of cases){const page=textById.get(test.id).find(p=>p.page===test.page);assert(normalize(page.text).includes(normalize(test.query)),test.id+' source evidence');const found=await indexedSearch(catalog.laws,test.query,false);assert.equal(found.missing,0);assert(found.articles.some(h=>h.law.id===test.id&&h.documentPage===test.page),JSON.stringify(test));}
const binaryUrls=new Set(Object.values(manifest.documents).map(f=>f.url));assert(!requests.some(url=>binaryUrls.has(url)),'Global search fetches text shards, never PDF/HTML payloads');
const scoped=await indexedSearch(catalog.laws.filter(l=>l.region==='雲林縣'),'臨街深度指數',false);assert(scoped.articles.some(h=>h.documentPage===2));assert(scoped.base.every(h=>h.law.region==='雲林縣'));
const unrelated=await indexedSearch(catalog.laws.filter(l=>l.id==='臺北市-FL069302'),'職能發展學院',false);assert.equal(unrelated.base.length,0);
const reversed=await indexedSearch(catalog.laws,'數指度深街臨',false);assert.equal(reversed.base.length,0,'Gram candidates still require an exact phrase');
const canceled=new AbortController();canceled.abort();await assert.rejects(indexedSearch(catalog.laws,'扶手',false,canceled.signal),{name:'AbortError'});
// A cold search with an unavailable text shard reports incomplete results.
const cold=await import('../lib/data-client.ts?document-failure');const missingFile=manifest.documentTexts['雲林縣-GL000243'].url;
globalThis.fetch=async url=>url===missingFile?new Response('',{status:503}):new Response(await read('public'+url));
const partial=await cold.indexedSearch(catalog.laws.filter(l=>l.region==='雲林縣'),'臨街深度指數',false);assert.equal(partial.missing,1);assert(!partial.base.some(h=>h.law.id==='雲林縣-GL000243'));
window.OPENLAWTW_OFFLINE=offline;globalThis.fetch=()=>{throw Error('Portable search must not use network');};
for(const test of cases){const found=await cold.indexedSearch(catalog.laws,test.query,false);assert.equal(found.missing,0);assert(found.articles.some(h=>h.law.id===test.id&&h.documentPage===test.page),'portable '+test.id);}
console.log(JSON.stringify({officialDocuments:Object.keys(sources).length,pdfPages,htmlDocuments,documentQueries:cases.length,originalBytes:'identical',pageRoutes:'passed',textOnlySearch:'passed',missingShard:'passed',portableDocument:'passed',offlinePack:'passed'}));
