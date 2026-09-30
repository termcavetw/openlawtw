import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createCitationMatcher,makeCitationTargets,makeCitationContext} from '../lib/citations.ts';
import {articleAddress} from '../lib/routes.ts';
const laws=Object.values(JSON.parse(fs.readFileSync('public/data/laws.json','utf8'))),targets=JSON.parse(fs.readFileSync('data/runtime-citations.json','utf8'));
const context=makeCitationContext(laws),find=createCitationMatcher(laws,targets,context),building=laws.find(l=>l.id==='D0070109'),design=laws.find(l=>l.id==='D0070115');
const current=design.articles.find(a=>a.no==='第 14 條');
const one=(text,law=design,article=current)=>find(text,law,article)[0];
assert.equal(one('本法第五十一條').law.id,building.id);
assert.equal(one('建築師法第9條').law.id,'D0070112','Never reuse the extension archive\'s outdated pcode');
assert.equal(one('營造業法第3條').law.id,'D0070110');
assert.equal(one('本編第六○條').article,'第 60 條');
assert.equal(one('本法第五十一條').basis.sourceLaw,'D0070114');
assert.equal(one('建築設計施工編第92條').law.id,design.id);
assert.equal(one('建築技術規則建築設計施工編第92條').law.id,design.id);
assert.equal(one('建築法（以下簡稱本法）第九十七條').law.id,building.id);
assert.equal(one('依本編第十六條').law.id,design.id);
assert.equal(one('建築法第73條，同法第74條').articleTargets?.length||find('建築法第73條，同法第74條',design,current).length,2);
const listed=find('建築法第73條及74條與第75條',design,current);assert.equal(listed.length,3);assert.equal(listed[0].articleTargets.length,3);assert(listed.every(r=>r.law.id===building.id));
const range=one('建築法第77條至第79條',design,current);assert.deepEqual(range.articleTargets.map(t=>t.article),['第 77 條','第 77-1 條','第 77-2 條','第 77-3 條','第 77-4 條','第 78 條','第 79 條']);
assert.equal(one('建築法第73條第1項及第2項').articleTargets.length,2);
assert.equal(one('建築法第73條第1項至第2項').articleTargets.length,2);
assert(one('本編第十六條第一款').unit.endsWith('/p:1/i:1'),'Only a verified single paragraph allows omitted paragraph');
assert.equal(one('建築法第73條第99項').fallback,true);
assert.equal(one('建築法第73條第2款').fallback,true);
assert.equal(find('日本法第73條',building,building.articles[0]).length,0);
assert.equal(find('依未收錄特別建築法第73條，其第74條規定',building,building.articles[0]).length,0);
assert.equal(find('建築法第73-1條之2',design,current).length,0);
assert.equal(find('本法第1000000條',design,current).length,0);
assert.equal(find('建築法及都市計畫法（以下合稱兩法）第3條',design,current).length,0,'Collective aliases are not a single-law target');
assert.equal(find('建築法第1條至第79條',design,current).length,0,'Oversized ranges stay plain rather than silently truncating');
const duplicate=createCitationMatcher([...laws,{...building,id:'duplicate'}],targets);assert.equal(duplicate('建築法第73條',design,current).length,0);
const testLaw=(id,name,nums,kind='法律')=>({...building,id,name,kind,articles:nums.map(n=>({no:`第 ${n} 條`,text:'原文',path:[]}))});
const procedure=testLaw('procedure','刑事訴訟法',['253-1','323']),criminal=testLaw('criminal','刑法',['83','323']);
const fixtureTargets={'procedure':{'253-1':['第 253-1 條',[[],[],[],[]]],'323':['第 323 條',[[]]]},'criminal':{'83':['第 83 條',[[],[],[]]],'323':['第 323 條',[[]]]}};
const match=createCitationMatcher([procedure,criminal],fixtureTargets);
assert.deepEqual(match('刑法第83條第3項。\n第323條第1項但書',procedure,procedure.articles[0]).map(r=>r.law.id),['criminal','procedure']);
assert.deepEqual(match('刑法第83條、第323條第1項',procedure,procedure.articles[0]).map(r=>r.law.id),['criminal','criminal']);
assert.equal(match('刑法第83條。\n同法第323條',procedure,procedure.articles[0]).length,1,'Pronouns never inherit a foreign law across paragraphs');
const parent={...procedure,name:'測試法',articles:[{no:'第 1 條',text:'測試條文。',path:[]}]},child={...design,id:'child',name:'測試法施行細則',articles:[{no:'第 1 條',text:'本細則依測試法第一條規定訂定之。',path:[]},{no:'第 2 條',text:'依本法第一條。',path:[]}]};
const parentMatch=createCitationMatcher([parent,child],makeCitationTargets([parent,child]));assert.equal(parentMatch('本法第一條',child,child.articles[1])[0].law.id,parent.id);
const points={...design,id:'points',name:'測試作業要點',articles:[1,2,3].map(n=>({no:`第 ${n} 點`,text:'官方文字',path:[]}))};const pointMatch=createCitationMatcher([points],makeCitationTargets([points]));assert.equal(pointMatch('測試作業要點第一點至第三點')[0].articleTargets.length,3);assert.equal(pointMatch('本要點第二點',points,points.articles[0])[0].article,'第 2 點');
const sourceOrder=(a,b)=>{const x=a.split('-').map(Number),y=b.split('-').map(Number);return x[0]-y[0]||(x[1]||0)-(y[1]||0);};
let references=0,bundles=0;
for(const law of laws){
 const addresses=law.articles.map(a=>articleAddress(a.no));if(addresses.every(a=>/^\d+(?:-\d+)?$/.test(a)))assert.deepEqual([...addresses].sort(sourceOrder),addresses,'Verified target ordering agrees with source: '+law.id);
 for(const article of law.articles){let end=0;for(const r of find(article.text,law,article)){
  assert(r.start>=end&&r.end>r.start&&r.end<=article.text.length);end=r.end;assert(laws.find(l=>l.id===r.law.id).articles.some(a=>a.no===r.article));
  for(const t of r.articleTargets||[r])assert(laws.find(l=>l.id===r.law.id).articles.some(a=>a.no===t.article));
  references++;if(r.articleTargets)bundles++;
 }}
}
console.log(JSON.stringify({fixtureCases:24,sourceLawReset:'passed',explicitAliasesAndParent:'passed',pointsAndRanges:'passed',omittedPrefixAndInsertedArticles:'passed',ambiguousNames:'plain text',corpusReferences:references,referenceGroups:bundles,sourceOrder:'verified'}));

assert(fs.statSync('data/runtime-citation-context.json').size<12000,'Only external general-provision context belongs in the initial shell');
