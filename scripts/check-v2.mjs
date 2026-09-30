import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {manifest,loadLaw,loadFile,loadRuling,loadRulingCounts,loadRelated,indexedSearch,indexedRulings} from '../lib/data-client.ts';
import {searchLaws,searchRulings,searchDocumentPages,normalize} from '../lib/search.ts';
import {sha,enrichLaw,canonicalLaw} from './schema.mjs';
const root=new URL('../',import.meta.url),read=p=>readFile(new URL(p,root),'utf8').then(JSON.parse);
const original=await read('public/data/laws.json'),heads=(await read('data/runtime-catalog.json')).laws,archive=await read('public/data/rulings.json');
globalThis.window={};let calls=0,fail=true;const requests=[];
globalThis.fetch=async path=>{calls++;requests.push(path);if(fail){fail=false;return new Response('',{status:503});}await new Promise(r=>setTimeout(r,1));return new Response(await readFile(new URL('public'+path,root)));};
await assert.rejects(loadLaw('D0070109'),/資料尚未下載/);
const controller=new AbortController(),canceled=loadLaw('D0070109',controller.signal),rejected=assert.rejects(canceled,{name:'AbortError'}),shared=loadLaw('D0070109');controller.abort();const law=await shared;await rejected;assert.equal(calls,2,'one shared law download, independent cancellation');
assert.equal(law.articles.length,original.D0070109.articles.length);await loadLaw('D0070109');assert.equal(calls,2);
const different=await loadLaw('D0070115');assert.equal(calls,3,'a different law downloads only its own shard');
const provenance=await read('data/provenance.json');
assert.equal(law.sourceRecordId,'CF','Existing central law keeps its original bulk source');
assert.equal(different.sourceRecordId,'CM','Existing central order keeps its original bulk source');
for(const [id,source] of Object.entries(provenance.sources).filter(([,source])=>(source.format==='xml'&&source.bulkKey)||source.parser==='moj-lawall-html')){
 const document=await read('public'+manifest.laws[id].url);
 assert.equal(document.sourceRecordId,id,'Added central law must resolve to its own source observation: '+id);
 assert.equal(provenance.sources[document.sourceRecordId].observedAt,original[id].retrieved,'Source reference retains the actual retrieval date: '+id);
 assert.equal(document.contentHash,sha(canonicalLaw(original[id])),'Source reference selection does not change legal content: '+id);
}
const counts=await loadRulingCounts();assert.equal(calls,4);
assert(!requests.some(url=>/\/(related|ruling-heads|rulings)-/.test(url)),'Reading laws and counts does not fetch ruling summaries or bodies');
assert(manifest.rulingCounts.bytes<64*1024,'Keep the shared count table below 64 KiB');
assert.equal(Object.keys(counts).length,Object.keys(manifest.laws).length);
for(const id of Object.keys(manifest.laws)){
 const records=archive.items.filter(r=>r.refs.some(ref=>ref.law===id));
 assert.equal(counts[id].total,records.length,id+' distinct official ruling IDs');
 const labels=new Set(records.flatMap(r=>r.refs.filter(ref=>ref.law===id&&ref.article).map(ref=>normalize(ref.article))));
 assert.deepEqual(new Set(Object.keys(counts[id].articles)),labels);
 for(const no of labels)assert.equal(counts[id].articles[no],records.filter(r=>r.refs.some(ref=>ref.law===id&&normalize(ref.article)===no)).length,id+' '+no);
}
for(const pack of manifest.packs)assert(pack.files.some(file=>file.url===manifest.rulingCounts.url),'Counts included in offline pack '+pack.id);
const related=await loadRelated('D0070109');assert.equal(related.length,counts.D0070109.total);assert.equal(requests.at(-1),manifest.related.D0070109.url);
let checked=0,parsed=0,raw=0;const ids=new Set();
for(const f of manifest.files){const bytes=await readFile(new URL('public'+f.url,root));assert.equal(sha(bytes),f.sha256,f.url);assert.equal(bytes.length,f.bytes);}
function checkUnit(unit,start,end,text){assert(unit.start>=start&&unit.end<=end&&unit.end>unit.start);assert(!ids.has(unit.id),unit.id);ids.add(unit.id);let at=unit.start;for(const child of unit.children){assert(child.start>=at);checkUnit(child,unit.start,unit.end,text);at=child.end;}assert(text.slice(unit.start,unit.end).trim());}
for(const [id,f] of Object.entries(manifest.laws)){const doc=await read('public'+f.url);assert.equal(doc.contentHash,sha(canonicalLaw(original[id])));assert.equal(doc.schemaVersion,2);assert.equal(doc.articles.length,original[id].articles.length);doc.articles.forEach((a,i)=>{assert.equal(a.text,original[id].articles[i].text);assert.equal(a.no,original[id].articles[i].no);assert.equal(a.officialAmendedAt,null);assert(!ids.has(a.id));ids.add(a.id);if(a.structure.status==='parsed'){parsed++;a.structure.units.forEach(u=>checkUnit(u,0,a.text.length,a.text));}else{raw++;assert.equal(a.structure.units.length,0);}checked++;});}
const third=law.articles.find(a=>normalize(a.no)==='第3條');assert.equal(third.structure.units.length,3);assert.equal(third.structure.units[0].children.length,3);assert.match(third.text.slice(third.structure.units[0].children[1].start,third.structure.units[0].children[1].end),/實施區域計畫地區/);
const originalLaw=original.D0070109,ledger={observedAt:originalLaw.retrieved},originalEnriched=enrichLaw(originalLaw,ledger),refetchedEnriched=enrichLaw({...originalLaw,retrieved:'2099-01-01',snapshot:'20990101',note:'new fetch note'},ledger);assert.equal(originalEnriched.contentHash,refetchedEnriched.contentHash,'unchanged legal content keeps its content hash after a new source observation');assert.equal(refetchedEnriched.retrieved,'2099-01-01','the actual source retrieval date must remain available');assert.equal(refetchedEnriched.snapshot,'20990101','the input batch marker must remain available');assert.equal(refetchedEnriched.version.observedAt,originalEnriched.version.observedAt,'legacy content observation is separate from a new source retrieval');
assert.notEqual(sha(enrichLaw(originalLaw,ledger)),sha(enrichLaw({...originalLaw,articles:originalLaw.articles.map((a,i)=>i? a:{...a,text:a.text+'測試'})},ledger)));
const aliases=await read('data/aliases.json');for(const [key,value] of Object.entries(aliases)){assert(key.trim()&&typeof value==='string'&&value.trim());assert.equal(normalize(key),key);assert(heads.some(l=>normalize(l.name).includes(normalize(value))),key+' alias target');}
const reversed=Object.fromEntries(Object.entries(originalLaw).reverse());reversed.articles=originalLaw.articles.map(a=>Object.fromEntries(Object.entries(a).reverse()));assert.equal(JSON.stringify(enrichLaw(originalLaw,ledger)),JSON.stringify(enrichLaw(reversed,ledger)),'JSON property order must not alter canonical content');
const corpus=Object.values(original).map(l=>({id:l.id,articles:l.articles}));
const key=h=>h.law.id+'|'+(h.article||'')+'|'+h.type+'|'+(h.documentPage||'');
const queries=['建技90','建築法第七十七條之二','建築法 73','樓梯 寬度','室','室內','室內裝','室內裝修','陽臺','無障礙廁所','1.5','H-2','台北市畸零地','新北 騎樓','不存在的法規詞xxxxx','1151162993','0930086992'];
let greatest=0;
const documentTexts=Object.fromEntries(await Promise.all(Object.entries(manifest.documentTexts).map(async([id,file])=>[id,await read('public'+file.url)])));
for(const q of queries){const start=performance.now(),result=await indexedSearch(heads,q,true);const documentHits=heads.flatMap(l=>documentTexts[l.id]?searchDocumentPages(l,documentTexts[l.id].pages,q):[]),rank=items=>[...items,...documentHits].sort((a,b)=>b.score-a.score),expected=rank(searchLaws(heads,corpus,q)),expectedArticles=rank(searchLaws(heads,corpus,q,true)),expectedRulings=searchRulings(archive.items,q);assert.equal(result.missing,0,q);assert.deepEqual(new Set(result.base.map(key)),new Set(expected.map(key)),q+' law recall');assert.deepEqual(new Set(result.articles.map(key)),new Set(expectedArticles.map(key)),q+' article recall');assert.deepEqual(new Set(result.rulings.map(r=>r.id)),new Set(expectedRulings.map(r=>r.id)),q+' ruling recall');if(expected.length)assert.equal(key(result.base[0]),key(expected[0]),q+' ranking');const ms=Math.round(performance.now()-start);greatest=Math.max(greatest,ms);console.log(JSON.stringify({query:q,laws:result.base.length,articles:result.articles.length,rulings:result.rulings.length,candidates:result.candidates,ms}));}
// Grams are only candidate selectors. A reversed phrase must not pass exact verification.
const exact=await indexedSearch(heads,'築建築建',false);assert.equal(exact.base.length,searchLaws(heads,corpus,'築建築建').length);
const scope=heads.filter(l=>l.region==='新北市');const scoped=await indexedSearch(scope,'建築',false);assert(scoped.base.every(h=>h.law.region==='新北市'));
const serial=await indexedRulings('1151162993');assert.equal(serial.items[0].id,'17669');assert(serial.candidates<archive.items.length/100,'rare serial should inspect a small candidate set');
// The portable file uses exactly the same shards and query implementation, without network.
const html=await readFile(new URL('openlawtw.html',root),'utf8');const encoded=html.match(/const packed=Uint8Array\.from\(atob\("([A-Za-z0-9+/=]+)"\)/)?.[1];assert(encoded);window.OPENLAWTW_OFFLINE=JSON.parse(gunzipSync(Buffer.from(encoded,'base64')));globalThis.fetch=()=>{throw Error('Portable file must not use network');};
for(const id of Object.keys(manifest.laws))assert.equal((await loadLaw(id)).id,id);
assert.deepEqual(await loadRulingCounts(),counts,'Portable counts are available without network');
for(const item of archive.items)assert.equal((await loadRuling(item.id)).body,item.body);
const offline=await indexedSearch(heads,'室內裝修');assert.equal(offline.missing,0);assert(offline.base.length>0&&offline.rulings.length>0);
console.log(JSON.stringify({schemaArticles:checked,structuredArticles:parsed,rawArticles:raw,stableIds:ids.size,regressionQueries:queries.length,portableLaws:Object.keys(original).length,portableRulings:archive.items.length,worstComparisonMs:greatest}));
