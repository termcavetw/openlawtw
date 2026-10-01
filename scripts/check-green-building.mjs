import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {searchLaws} from '../lib/search.ts';
import {indexedSearch,manifest} from '../lib/data-client.ts';
const read=p=>readFile(new URL('../'+p,import.meta.url));
const json=async p=>JSON.parse(await read(p));
const input=await json('data/green-building-sources.json'),catalog=await json('data/runtime-catalog.json');
for(const [query,id] of [
 ['基地綠化規範','NLMA-976'],['基地保水規範','NLMA-961'],['建築節能規範','NLMA-6187'],
 ['雨水回收規範','NLMA-936'],['雜排水回收規範','NLMA-937'],['中水回收','NLMA-937'],
 ['綠建材規範','NLMA-170'],['綠建築標章申請審核認可及使用作業要點','ABRI-330726'],
]) assert(searchLaws(catalog.laws,[],query).some(h=>h.law.id===id),query);
const ee=searchLaws(catalog.laws,[],'EEWH');
for(const item of input.manuals){
 assert(ee.some(h=>h.law.id===item.id),'Every EEWH edition is discoverable: '+item.id);
 const page=await read('dist/laws/'+item.id+'.html');
 assert(page.includes('版本與生效說明：')&&page.includes('未收錄手冊全文'),'Visible link-only edition note');
 if(item.edition===2026)assert(page.includes('2030-07-01')&&page.includes('自願'),'Future implementation and early adoption are visible');
 assert(!manifest.documents[item.id]&&!manifest.documentTexts[item.id],'No unlicensed manual payload');
 assert(!manifest.packs.some(p=>p.files.some(f=>f.url===manifest.laws[item.id].url)),'Link-only books are not falsely described as downloaded full texts');
}
globalThis.window={};globalThis.fetch=async url=>new Response(await read('public'+url));
for(const [id,query] of [['NLMA-976','綠化總固碳當量'],['NLMA-961','基地保水指標'],['NLMA-6187','外牆平均熱傳透率'],['NLMA-936','雨水貯留利用設施'],['NLMA-937','再生水資源利用量'],['NLMA-170','綠建材使用面積'],['ABRI-330726','候選建築能效證書']]){
 const found=await indexedSearch(catalog.laws.filter(l=>l.id===id),query,false);
 assert.equal(found.missing,0,id);
 assert(found.articles.some(h=>h.law.id===id&&h.documentPage),'Official PDF text searchable: '+query);
}
console.log('Green-building originals, aliases, text-only PDF search, 11 separate manual editions and link-only rights boundaries passed.');
