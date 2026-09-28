import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createCitationMatcher} from '../lib/citations.ts';
import {lawHref,readRoute,legacyLawHash,articleAddress,unitAnchor} from '../lib/routes.ts';
import {safeJSON} from './static-html.mjs';
const root=new URL('../',import.meta.url),read=p=>readFile(new URL(p,root),'utf8'),json=async p=>JSON.parse(await read(p));
const manifest=await json('data/runtime-manifest.json'),targets=await json('data/runtime-citations.json');
const docs=await Promise.all(Object.entries(manifest.laws).map(async([id,file])=>[id,await json('public'+file.url)])),byId=new Map(docs),laws=docs.map(([,law])=>law);
const find=createCitationMatcher(laws,targets),building=byId.get('D0070109'),design=byId.get('D0070115');
const ref=text=>find(text)[0];
assert.equal(ref('依建築法第73條第2項辦理。').unit,'D0070109/a:73/p:2');
assert.equal(ref('建築法第七十三條第二項').unit,'D0070109/a:73/p:2');
assert.equal(ref('「建築法」第７３條第２項').unit,'D0070109/a:73/p:2');
assert.equal(ref('建築技術規則建築設計施工編第164條之1第1項第2款').unit,'D0070115/a:164-1/p:1/i:2');
assert.equal(ref('建築技術規則建築設計施工編第一百六十四之一條第一項第二款').unit,'D0070115/a:164-1/p:1/i:2');
assert.equal(find('本法第73條第2項',building)[0].unit,'D0070109/a:73/p:2');
assert.equal(find('應依第73條辦理。',building)[0].article,'第 73 條');
assert.equal(find('本法第73條',design).length,0,'本法 in a regulation must not become that regulation');
assert.equal(find('本法第73條').length,0,'A ruling does not infer a law from an open reading panel');
assert.equal(find('依未收錄自治條例第73條辦理。',building).length,0);
assert.equal(find('未收錄條例所稱依第73條辦理。',building).length,0);
assert.equal(find('依前項辦理；第1000000條').length,0);
assert.equal(find('建築法第1000000條').length,0,'Unknown article stays plain text');
assert.equal(find('建築法第73-1條之2').length,0,'Malformed compound article is not guessed');
assert.equal(ref('建築法第73條第99項').unit,'');assert.equal(ref('建築法第73條第99項').fallback,true);
assert.equal(ref('建築法第73條第2款').unit,'','Missing paragraph is not guessed');
const duplicate=createCitationMatcher([...laws,{...building,id:'duplicate'}],targets);assert.equal(duplicate('建築法第73條').length,0,'Ambiguous titles stay plain text');
const path='/laws/D0070109.html',anchor='#a-73-p-2';
assert.equal(lawHref('D0070109','第 73 條','D0070109/a:73/p:2'),path+anchor);
assert.deepEqual(readRoute(path,anchor),{law:'D0070109',article:'第 73 條',unit:'D0070109/a:73/p:2',ruling:''});
assert.deepEqual(readRoute('/',legacyLawHash('D0070109','第 73 條','D0070109/a:73/p:2')),readRoute(path,anchor));
assert.equal(readRoute('/','').law,'');assert.equal(readRoute('/','#ruling=17669').ruling,'17669');assert.equal(readRoute('/laws/%zz.html','').law,'');
const units=new Set(),anchors=new Map(),pages=new Map();
const visit=unit=>{units.add(unit.id);unit.children.forEach(visit);};for(const law of laws)for(const article of law.articles)article.structure?.units.forEach(visit);
const decode=s=>s.replace(/&(amp|lt|gt|quot|#39);/g,(_,key)=>({amp:'&',lt:'<',gt:'>',quot:'"','#39':"'"}[key]));
let textArticles=0,staticLinks=0,bodyReferences=0,unitReferences=0;
for(const law of laws){
 const html=await read('dist'+lawHref(law.id));pages.set(law.id,html);
 const embedded=JSON.parse(html.match(/<script type="application\/json" id="openlawtw-law-snapshot">([\s\S]*?)<\/script>/)[1]);assert.deepEqual(embedded,law);
 assert(html.includes(`<link rel="canonical" href="https://openlawtw.vercel.app${lawHref(law.id)}"/>`));
 const texts=[...html.matchAll(/<div class="static-text">([\s\S]*?)<\/div>/g)].map(m=>decode(m[1].replace(/<[^>]*>/g,'')));
 assert.deepEqual(texts,law.articles.map(a=>a.text),law.id+' no-JavaScript original-text fidelity');textArticles+=texts.length;
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>decode(m[1]));assert.equal(new Set(ids).size,ids.length,law.id+' unique HTML anchors');anchors.set(law.id,new Set(ids));
 for(const article of law.articles){const url=new URL(lawHref(law.id,article.no),'https://example.test');const route=readRoute(url.pathname,url.hash);assert.equal(route.law,law.id);assert.equal(articleAddress(route.article),articleAddress(article.no));}
}
for(const [id,html] of pages)for(const match of html.matchAll(/href="(\/laws\/[^"#]+\.html)(#[^"]+)?"/g)){
 if(match[1]==='/laws/index.html')continue;const route=readRoute(decode(match[1]),'');assert(byId.has(route.law),id+' link target '+route.law);if(match[2])assert(anchors.get(route.law).has(decode(match[2].slice(1))),match[0]);staticLinks++;
}
const check=(text,law)=>{for(const target of find(text,law)){assert(byId.get(target.law.id).articles.some(a=>a.no===target.article));if(target.unit){assert(units.has(target.unit));unitReferences++;}assert(text.slice(target.start,target.end));bodyReferences++;}};
for(const law of laws)for(const article of law.articles)check(article.text,law);
const rulings=await json('public/data/rulings.json');for(const ruling of rulings.items)check(ruling.body);
const sitemap=await read('dist/sitemap.xml'),urls=[...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>decode(m[1]));assert.equal(urls.length,laws.length+2);assert.equal(new Set(urls).size,laws.length+2);for(const law of laws)assert(urls.includes('https://openlawtw.vercel.app'+lawHref(law.id)));
assert((await read('dist/robots.txt')).includes('Sitemap: https://openlawtw.vercel.app/sitemap.xml'));
assert(!safeJSON({text:'</script><script>alert(1)</script>'}).includes('<'));
assert.equal(unitAnchor('D0070115/a:164-1/p:1/i:2'),'a-164-1-p-1-i-2');
assert.equal(articleAddress('第四之一點'),'4-1','Inserted local point retains a numeric share anchor');
assert.equal(articleAddress('第二十二之一點'),'22-1');
console.log(JSON.stringify({citationCases:17,staticLawPages:pages.size,staticOriginalArticles:textArticles,checkedStaticLinks:staticLinks,checkedBodyReferences:bodyReferences,checkedUnitReferences:unitReferences,sitemapURLs:urls.length,legacyRoutes:'passed'}));
