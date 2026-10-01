import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {indexedSearch,indexedRulings} from '../lib/data-client.ts';
import {normalize} from '../lib/search.ts';
import {searchGuides,queryRegion} from '../lib/search-guidance.ts';
import {regionCoverage} from '../lib/coverage.ts';
const root=new URL('../',import.meta.url),read=p=>readFile(new URL(p,root),'utf8').then(JSON.parse);
const [suite,catalog,laws,guides]=await Promise.all(['data/search-quality.json','data/runtime-catalog.json','public/data/laws.json','data/search-guides.json'].map(read));
globalThis.window={};globalThis.fetch=async url=>new Response(await readFile(new URL('public'+url,root)));
// Each editorial suggestion must point to a real source and an exact excerpt.
for(const guide of guides)for(const ref of guide.refs){const law=laws[ref.law];assert(law,ref.law);const text=ref.article?law.articles.find(a=>normalize(a.no)===normalize(ref.article))?.text:law.name;assert(text?.includes(ref.contains),guide.id+' source evidence');assert(/^https:\/\//.test(law.url));}
const rows=[];
for(const test of suite.cases){
 if(test.basis.contains)for(const expected of test.expected){
  const law=laws[expected.law];
  const source=expected.article?law?.articles.find(a=>normalize(a.no)===normalize(expected.article))?.text:law?.name;
  assert(source?.includes(test.basis.contains),test.query+' expected official passage');
 }
 let results=[],passed=false;
 if(test.kind==='guide'){results=searchGuides(test.query).map(g=>({guide:g.id}));passed=test.expected.some(e=>results.some(r=>r.guide===e.guide));}
 else if(test.kind==='ruling'){const found=await indexedRulings(test.query);assert.equal(found.missing,0);results=found.items.slice(0,test.top).map(r=>({ruling:r.id}));passed=test.expected.some(e=>results.some(r=>r.ruling===e.ruling));assert.equal(found.items[0]?.numberKey,test.query,'exact serial must rank before other rulings that cite it');}
 else{const scope=catalog.laws.filter(l=>test.region==='全台'||l.region===test.region||l.region==='中央');const found=await indexedSearch(scope,test.query,false);assert.equal(found.missing,0);results=(test.kind==='article'?found.articles:found.base).slice(0,test.top||5).map(r=>({law:r.law.id,...(r.article?{article:r.article}:{})}));passed=test.kind==='empty'?found.base.length===0:test.expected.some(e=>results.some(r=>r.law===e.law&&(!e.article||normalize(r.article||'')===normalize(e.article))));if(test.basis.source)assert(test.expected.some(e=>laws[e.law]?.url===test.basis.source));}
 rows.push({query:test.query,kind:test.kind,passed,expected:test.expected,actual:results});
 if(!passed)console.error(JSON.stringify(rows.at(-1)));
}
for(const region of ['中央',...catalog.regions.map(r=>r.name)]){const coverage=regionCoverage(catalog.laws,region);assert.equal(coverage.full.length+coverage.documents.length+coverage.links.length,coverage.records.length);assert(coverage.topics.every(t=>t.laws.every(l=>l.region===region)));for(const [kind,records] of [['full',coverage.full],['link',coverage.links]])assert.deepEqual(records.map(l=>l.id).sort(),Object.values(laws).filter(l=>l.region===region&&l.coverage===kind&&(kind!=='link'||!l.document)).map(l=>l.id).sort(),region+' coverage matches canonical records');}
assert.equal(queryRegion('台北畸零地',catalog.regions.map(r=>r.name)),'臺北市');assert.equal(queryRegion('新竹騎樓',catalog.regions.map(r=>r.name)),null,'ambiguous city/county must not be guessed');
const report={version:catalog.version,cases:rows.length,passed:rows.filter(r=>r.passed).length,scope:'Curated retrieval expectations, not a legal applicability or expert precision score',results:rows};
if(process.env.OPENLAWTW_QUALITY_REPORT)await writeFile(process.env.OPENLAWTW_QUALITY_REPORT,JSON.stringify(report,null,2));
console.log(JSON.stringify({qualityCases:report.cases,passed:report.passed,coverageRegions:catalog.regions.length+1,guideSources:guides.flatMap(g=>g.refs).length}));
assert.equal(report.passed,report.cases,'Search quality expectations must all pass.');
