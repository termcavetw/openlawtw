import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {articleSupplement,articleSupplements,supplementAssetURL,supplementViewFile} from '../lib/article-supplements.ts';

const read=path=>fs.readFileSync(path),json=path=>JSON.parse(read(path));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const raw=json('public/data/laws.json'),law=raw.D0070115;
const sources=json('data/documents/article-supplements/catalog.json').records,views=json('public'+supplementViewFile.url).records;
assert.equal(sha(read('public'+supplementViewFile.url)),supplementViewFile.sha256);
const expected=['1','2','3-1','8','14','16','19','23','24','26','28','33','39-1','42','45','60','89','90','107','110','117','118','121','144'];
assert.deepEqual(articleSupplements.map(record=>record.article).sort(),expected.sort());
const supplementLinks=law.attachments.filter(a=>a.title.includes('補充圖例'));
assert.equal(supplementLinks.length,43);
assert.deepEqual(articleSupplements.flatMap(record=>record.alternatives.map(({title,url})=>({title,url}))).sort((a,b)=>a.url.localeCompare(b.url)),supplementLinks.slice().sort((a,b)=>a.url.localeCompare(b.url)));
let imageCount=0,imageBytes=0;
for(const record of sources){
 assert.equal(record.lawId,'D0070115');
 assert.equal(record.articleNo,'第 '+record.article+' 條');
 assert.ok(law.articles.some(article=>article.no===record.articleNo));
 const control=articleSupplement(law.id,record.articleNo,law.attachments);
 const view=views.find(view=>view.id===record.id);
 assert.equal(control?.id,record.id);
 assert.deepEqual(control?.alternatives,record.alternatives.map(({title,url})=>({title,url})));
 assert.equal(view?.id,record.id);
 assert.deepEqual(view?.pages,record.pages.map(({page,src,width,height})=>({page,src,width,height})));
 assert.deepEqual(view?.alternatives,record.alternatives.map(({title,url})=>({title,url})));
 assert.equal(view?.versionNote,record.versionNote);
 assert.equal(view?.retrieved,record.retrieved.slice(0,10));
 assert.equal(articleSupplement(law.id,record.articleNo,[]),undefined,'Changed source links fail closed');
 assert.equal(articleSupplement('D0070116',record.articleNo,law.attachments),undefined,'Never map an article from another compilation');
 assert.ok(record.alternatives.every(a=>a.title.startsWith('第 '+record.article+' 條補充圖例')&&/^https:\/\/law\.moj\.gov\.tw\/LawClass\/LawGetFile\.ashx\?FileId=\d+$/.test(a.url)));
 assert.ok(record.alternatives.some(a=>a.title===record.title&&a.url===record.source));
 assert.equal(record.sourcePage,'https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=D0070115&flno='+record.article);
 assert.ok(record.versionNote&&/^\d{4}-\d{2}-\d{2}/.test(record.retrieved));
 const pdf=read(record.originalFile);assert.equal(pdf.length,record.bytes);assert.equal(sha(pdf),record.sha256);assert.equal(pdf.subarray(0,4).toString(),'%PDF');
 assert.ok(record.pages.length);
 for(const [i,page] of record.pages.entries()){
  assert.equal(page.page,i+1,'Original PDF page numbers are contiguous');
  assert.equal(page.sourceRect.length,4);assert.deepEqual(page.sourceRect.slice(0,2),[0,0],'Preserve complete official pages');
  assert.ok(page.sourceRect[2]>0&&page.sourceRect[3]>0);
 }
 for(const image of [...record.pages,...record.supplementalFiles.filter(file=>file.src)]){
  const url=supplementAssetURL(image.src,'https:','https://example.test');assert.equal(url,'https://example.test'+image.src);
  const bytes=read('public'+image.src);assert.equal(bytes.length,image.bytes);assert.equal(sha(bytes),image.sha256);
  assert.ok(image.width>0&&image.height>0);assert.ok(image.src.includes(image.sha256.slice(0,12)),'Image URL carries its content hash');
  imageCount++;imageBytes+=bytes.length;
 }
 for(const file of record.supplementalFiles){const bytes=read(file.originalFile);assert.equal(sha(bytes),file.sha256);assert.equal(bytes.length,file.bytes);}
}
assert.equal(articleSupplement(law.id,'第 116-2 條',law.attachments),undefined,'Existing legal table is not a supplementary diagram');
assert.equal(articleSupplement(law.id,'第 3 條',law.attachments),undefined,'Do not use a prefix match for 第 3-1 條');
assert.equal(supplementAssetURL('/documents/article-supplements/x-'+ 'a'.repeat(12)+'.webp','file:','null'),'https://openlawtw.vercel.app/documents/article-supplements/x-'+ 'a'.repeat(12)+'.webp');
for(const path of ['javascript:alert(1)','//evil.test/x.webp','/documents/article-supplements/../x.webp','/other/x.webp'])assert.equal(supplementAssetURL(path,'https:','https://example.test'),'');
if(process.argv.includes('--built')){
 assert.equal(sha(read('dist'+supplementViewFile.url)),supplementViewFile.sha256);
 const html=read('dist/laws/D0070115.html').toString();assert.equal((html.match(/class="static-supplement"/g)||[]).length,24);
 const manifest=json('public/data/manifest.json'),builtLaw=json('public'+manifest.laws.D0070115.url);
 assert.ok(!JSON.stringify(builtLaw).includes('/documents/article-supplements/'),'No image payload or manifest added to a law shard');
 assert.deepEqual(builtLaw.articles.map(({no,text})=>({no,text})),law.articles.map(({no,text})=>({no,text})),'Official article text stays unchanged');
 const worker=read('dist/sw.js').toString(),precache=JSON.parse(worker.match(/const PRECACHE=(\[.*?\]),MANIFEST=/s)[1]);
 assert.ok(!precache.some(file=>file.url.includes('/documents/article-supplements/')||file.url.includes('/data/article-supplements/')),'Optional figures are never precached');
 for(const record of sources)for(const image of [...record.pages,...record.supplementalFiles.filter(file=>file.src)])assert.equal(sha(read('dist'+image.src)),image.sha256);
}
console.log(JSON.stringify({articleSupplements:articleSupplements.length,officialLinks:supplementLinks.length,imageCount,imageBytes,sourceValidation:'passed',built:process.argv.includes('--built')}));
