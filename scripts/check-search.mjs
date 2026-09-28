import assert from 'node:assert/strict';
import fs from 'node:fs';
import {normalize, parseQuery, searchLaws, searchRulings} from '../lib/search.ts';
const data=JSON.parse(fs.readFileSync(new URL('../data/catalog.json',import.meta.url),'utf8'));
const archive=JSON.parse(fs.readFileSync(new URL('../public/data/rulings.json',import.meta.url),'utf8'));
const rulings=archive.items;
const corpus=Object.values(JSON.parse(fs.readFileSync(new URL('../public/data/laws.json',import.meta.url),'utf8'))).map(l=>({id:l.id,articles:l.articles}));
for(const q of ['建築法 第77條之2','建築法第七十七條之二','建築法 §77-2','建築法 77-2']){
 const found=searchLaws(data.laws,corpus,q);assert.equal(found[0]?.law.name,'建築法',q);assert.equal(normalize(found[0]?.article||''),'第77-2條',q);assert(found.every(h=>normalize(h.article||'')==='第77-2條'));
}
for(const q of ['建技 第90條','建技90','建技 90']){
 const found=searchLaws(data.laws,corpus,q);assert.equal(found[0]?.law.name,'建築技術規則建築設計施工編',q);assert(found.every(h=>normalize(h.article||'')==='第90條'),q);
}
const exact=searchLaws(data.laws,corpus,'建築法 第97條');assert(exact.every(h=>normalize(h.article||'')==='第97條'));
assert.equal(normalize('第 二十九 條之ㄧ'),'第29-1條');
assert.equal(parseQuery('1.5').article,'');
assert(searchLaws(data.laws,corpus,'陽臺',true).filter(h=>h.law.name==='建築技術規則建築設計施工編').length>3,'Every matching article is searchable');
assert.equal(searchLaws(data.laws,corpus,'台北市建築管理自治條例')[0]?.law.region,'臺北市');
assert.equal(searchRulings(rulings,rulings[0].number)[0]?.id,rulings[0].id);
assert.equal(searchLaws(data.laws,corpus,'thisdoesnotexist').length,0);
const localLast=searchLaws(data.laws,corpus,'都市計畫法臺中市施行自治條例 第57條');assert.equal(localLast[0]?.article,'五十七條','An official heading without 第 remains searchable without rewriting its display');
console.log('Passed citation forms, exact article boundaries, aliases, local naming, full result coverage and ruling search.');

assert.equal(searchRulings(rulings,'1151162993')[0]?.id,'17669');
assert(searchRulings(rulings,'建技90').length>0);
assert(searchRulings(rulings,'建技90').every(r=>r.refs.some(ref=>normalize(ref.article)==='第90條')));
assert(searchRulings(rulings,'0930086992').some(r=>r.id==='5396'));
assert.equal(rulings.find(r=>r.id==='17694').date,'2026-01-28','Issue date is distinct from September publication date');
assert(rulings.find(r=>r.id==='13820').citations.includes('5396'),'A cited full document is linked by its number');
assert.equal(archive.stats.count,rulings.length);
console.log('Ruling number lookup, article aliases, original issue dates and cross-document references passed.');

const qualified=searchRulings(rulings,'建築法 第73條');assert(qualified.length>0);assert(qualified.every(r=>r.refs.some(ref=>ref.law==='D0070109'&&normalize(ref.article)==='第73條')),'Bind an article number to its named law, not another law in the same letter');

// Regressions reported by readers: complete phrases, adjacent numbers and IME output.
for(const q of ['建築技術規則90','建築技術規則 90','建技９０','建技第九十條']){
 const hits=searchLaws(data.laws,corpus,q);assert(hits.some(h=>h.law.id==='D0070115'&&normalize(h.article)==='第90條'),q);
 assert(hits.every(h=>normalize(h.article)==='第90條'&&h.law.name.startsWith('建築技術規則')),q);
}
for(const q of ['77之2','77-2','第77條之2','七十七條之二','７７之２'])assert.equal(parseQuery(q).article,'第77-2條',q);
for(const q of ['建築法77之2','建築法第77之2條','建築法 第七十七條之二']){
 const hits=searchLaws(data.laws,corpus,q);assert.equal(hits.length,1,q);assert.equal(hits[0].law.id,'D0070109');assert.equal(normalize(hits[0].article),'第77-2條');
}
for(const q of ['室','室內','室內裝','室內裝修','樓梯','樓梯 寬度','防火區劃','無障礙廁所','長照','民宿']){
 const hits=searchLaws(data.laws,corpus,q);assert(hits.length>0,q);
}
const room=searchLaws(data.laws,corpus,'室內裝修');assert.equal(room[0].law.name,'建築物室內裝修管理辦法');
assert(!room.some(h=>h.type==='laws'&&h.law.name==='違章建築處理辦法'),'Category membership must not pass as a title match');
assert.equal(searchLaws(data.laws,corpus,'建築法')[0].law.name,'建築法');
assert.equal(searchLaws(data.laws,corpus,'樓梯 絕不存在詞彙').length,0,'All keywords are required, not loose OR matching');
const phrase=searchLaws(data.laws,corpus,'樓梯寬度',true);const relaxed=phrase.findIndex(h=>h.match==='keywords');if(relaxed>=0)assert(phrase.slice(relaxed).every(h=>h.match==='keywords'),'Exact phrases rank above segmented keywords');
const sourceById=new Map(corpus.map(l=>[l.id,l]));
for(const h of searchLaws(data.laws,corpus,'樓梯 寬度',true)){
 const text=normalize(h.law.name+h.law.region+sourceById.get(h.law.id).articles.find(a=>a.no===h.article).text);
 assert(text.includes('樓梯')&&text.includes('寬度'),'Each matched article contains both keywords');
}
for(const r of rulings.slice(0,30))if(r.numberKey)assert(searchRulings(rulings,r.number).some(x=>x.id===r.id),'The 第 inside a letter serial is not an article');
for(const q of ['1151162993','1.5','H-2'])assert.equal(parseQuery(q).article,'',q);
console.log('Long Chinese queries, precise law/article binding, serials, multi-keyword AND and ranking passed.');
