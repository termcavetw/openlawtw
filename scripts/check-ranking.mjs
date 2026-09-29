import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {normalize,searchLaws,searchDocumentPages} from '../lib/search.ts';

const root=new URL('../',import.meta.url),read=path=>readFile(new URL(path,root),'utf8').then(JSON.parse);
const original=await read('public/data/laws.json'),laws=Object.values(original),heads=(await read('data/runtime-catalog.json')).laws;
const key=hit=>`${hit.law.id}|${normalize(hit.article||'')}`;
// Expectations describe findability of source passages, not their applicability
// to a project. No topic-to-article priority table is used by the search engine.
const cases=[
 ['直通樓梯','D0070115','第1條',1,'直通樓梯：'],
 ['直通樓梯','D0070115','第90條',5,'直通樓梯於避難層'],
 ['直通樓梯','D0070115','第93條',5,'直通樓梯之設置'],
 ['避難層','D0070115','第1條',1,'避難層：'],
 ['居室','D0070115','第1條',1,'居室：'],
 ['分間牆','D0070115','第1條',1,'分間牆：'],
 ['建築基地面積','D0070115','第1條',1,'建築基地面積：'],
 ['防火門','D0070115','第76條',1,'防火門窗係指'],
 ['採光','D0070115','第41條',2,'居室應設置採光'],
 ['採光','D0070115','第42條',2,'有效採光範圍'],
 ['安全梯','D0070115','第97條',3,'安全梯之構造'],
 ['無障礙廁所','D0070115','第167-3條',1,'無障礙廁所盥洗室數量'],
 ['樓梯寬度','D0070115','第33條',3,'樓梯及平臺之寬度'],
 ['樓梯 寬度','D0070115','第98條',3,'直通樓梯每一座之寬度'],
 ['直通樓梯 寬度','D0070115','第98條',1,'直通樓梯每一座之寬度'],
 ['居室 採光','D0070115','第41條',1,'居室應設置採光'],
 ['台北免辦變更使用','臺北市-FL038035','第3條',1,'建築物變更使用類組'],
 ['臺北 免辦 變更使用','臺北市-FL038035','第3條',1,'建築物變更使用類組'],
 ['新北 騎樓','新北市-C0170005','第3條',1,'騎樓之淨寬'],
];
const rows=[];
for(const [query,id,article,top,evidence] of cases){
 const source=original[id].articles.find(a=>normalize(a.no)===article);
 assert(source?.text.includes(evidence),`${id} ${article} source evidence`);
 assert(/^https:\/\/(?:[^/]+\.gov\.tw|laws\.gov\.taipei)\//.test(original[id].url),`${id} official source`);
 const hits=searchLaws(heads,laws,query,true),rank=hits.findIndex(h=>key(h)===`${id}|${article}`)+1;
 assert(rank>0&&rank<=top,`${query}: ${id} ${article} expected top ${top}, actual ${rank}`);
 rows.push({query,law:id,article,rank});
 // Runtime catalogue and full records must produce the same scores and order.
 assert.deepEqual(hits.map(h=>[key(h),h.score]),searchLaws(laws,laws,query,true).map(h=>[key(h),h.score]));
}
const explicit=['建築法 第77條之2','建築法第七十七條之二','建築法 §77-2','建築法 77-2','建築法77之2','建築法第77之2條'];
for(const q of explicit)assert.deepEqual(searchLaws(heads,laws,q).map(key),['D0070109|第77-2條'],q);
for(const q of ['建技90','建技第九十條','建築技術規則９０']){
 const hits=searchLaws(heads,laws,q);assert(hits.some(h=>key(h)==='D0070115|第90條'),q);
 assert(hits.every(h=>normalize(h.article||'')==='第90條'),q);
}
for(const [q,name] of [['建築法','建築法'],['室裝','建築物室內裝修管理辦法'],['台北市建築管理自治條例','臺北市建築管理自治條例']])assert.equal(searchLaws(heads,laws,q)[0]?.law.name,name,q+' exact law / alias');
for(const q of ['樓梯 絕不存在詞彙','直通樓梯絕不存在詞彙','築建築建'])assert.equal(searchLaws(heads,laws,q,true).length,0,q+' exact AND / phrase recall');
const compound=searchLaws(heads,laws,'樓梯寬度',true),firstSegmented=compound.findIndex(h=>h.match==='keywords');
if(firstSegmented>=0)assert(compound.slice(firstSegmented).every(h=>h.match==='keywords'),'exact phrase stays above segmented match');

// Adversarial ranking cases: a glossary mention in another definition, distant
// terms in a long glossary, boilerplate, short articles, and input order.
const synthetic={...original.D0070115,id:'ranking-fixture',name:'測試規則',keywords:[],articles:[
 {no:'第1條',text:'其他規定適用。甲題僅為附帶提及。'},
 {no:'第2條',text:'甲題之設置應依下列規定。甲題寬度不得小於標示尺寸。'},
 {no:'第3條',text:'本規則用語定義如下。一、甲題：供人通行之設施。'+('其他定義與說明。'.repeat(300))+'二、乙題：其寬度依標示尺寸。'},
 {no:'第4條',text:'本規則依授權訂定之。'},
 {no:'第5條',text:'甲題之設置應依下列規定。'+('背景說明。'.repeat(200))+'甲題寬度依規定。'},
]};
const fixtureSearch=q=>searchLaws([synthetic],[synthetic],q,true);
assert.equal(fixtureSearch('甲題')[0].article,'第3條','a definition beats an incidental mention');
assert.equal(fixtureSearch('甲題 寬度')[0].article,'第2條','a distant glossary word cannot promote the wrong definition');
assert(fixtureSearch('甲題').find(h=>h.article==='第2條').score>fixtureSearch('甲題').find(h=>h.article==='第5條').score,'continuous focus separates short and long articles');
assert.equal(fixtureSearch('測試規則 甲題')[0].article,'第3條','a complete law name does not dilute topic evidence');
assert.deepEqual(fixtureSearch('甲題').map(key),searchLaws([synthetic],[{...synthetic,articles:[...synthetic.articles].reverse()}],'甲題',true).map(key),'ranking does not depend on article order');
const untouched=JSON.stringify(synthetic);fixtureSearch('甲題');assert.equal(JSON.stringify(synthetic),untouched,'ranking never mutates official text');

// The PDF / source-document pathway retains its page and scoring contracts.
const manifest=await read('data/runtime-manifest.json'),documentCases=(await read('data/document-search-quality.json')).cases;
for(const test of documentCases){
 const text=await read('public'+manifest.documentTexts[test.id].url),hits=searchDocumentPages(original[test.id],text.pages,test.query);
 assert(hits.some(h=>h.documentPage===test.page),test.id+' document page '+test.page);
 assert(hits.every(h=>h.type==='documents'&&h.score===150),test.query+' document score unchanged');
}
console.log(JSON.stringify({rankingPassages:cases.length,exactCitationQueries:explicit.length+3,lawAliases:3,negativeQueries:3,documentQueries:documentCases.length,definitionAndDensity:'passed',phrasePriority:'passed',runtimeParity:'passed',highlights:rows.filter(row=>['直通樓梯','台北免辦變更使用','直通樓梯 寬度'].includes(row.query))}));
