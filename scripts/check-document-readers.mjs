import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {documentChapterAtPage,searchDocumentSections} from '../lib/document-chapters.ts';
const root=new URL('../',import.meta.url),read=p=>readFile(new URL(p,root)),json=async p=>JSON.parse(await read(p));
const manifest=await json('data/runtime-manifest.json'),catalog=await json('data/documents/readers/catalog.json'),sources=await json('data/documents/catalog.json');
const html=(await read('openlawtw.html')).toString(),payload=JSON.parse(gunzipSync(Buffer.from(html.match(/atob\("([A-Za-z0-9+/=]+)"\)/)[1],'base64')));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
let images=0,texts=0,groups=0;
for(const [id,path] of Object.entries(catalog)){
 const source=await json('data/documents/readers/'+path),file=manifest.documentReaders[id],index=await json('public'+file.url);
 assert.equal(sha(await read(sources[id].file)),index.sourceSha256);
 assert.equal(index.sourceSha256,source.sourceSha256);assert.equal(index.lawId,id);
 assert.equal(index.chapters.length,source.chapters.length);assert(!JSON.stringify(index).includes('data:image/'),'Chapter index contains no images');
 assert.deepEqual(payload[file.url],index,'Portable chapter index');
 const packed=manifest.packs.find(p=>p.id==='中央').files;
 assert(packed.some(f=>f.url===file.url));
 for(let page=1;page<=index.pages;page++){
  const location=documentChapterAtPage(index,page);
  assert(location.chapter&&location.sections.length,'A chapter and section for physical page '+page);
  assert(location.chapter.startPage<=page&&location.chapter.endPage>=page);
 }
 for(const [ci,chapter] of index.chapters.entries()){
  groups++;
  const bytes=await read('public'+chapter.file.url),body=JSON.parse(bytes),original=source.chapters[ci];
  assert.equal(sha(bytes),chapter.file.sha256);assert.equal(body.sourceSha256,index.sourceSha256);assert.deepEqual(payload[chapter.file.url],body);
  assert(packed.some(f=>f.url===chapter.file.url),'Chapter included in regional offline pack');
  assert.equal(body.sections.length,original.sections.length);
  for(const [si,section] of body.sections.entries()){
   const originalSection=original.sections[si];
   assert.equal(section.id,originalSection.id);assert.equal(section.blocks.length,originalSection.blocks.length);
   for(const [bi,block] of section.blocks.entries()){
    const originalBlock=originalSection.blocks[bi];
    assert.equal(chapter.sections[si].anchors[bi].page,block.page);
    if(block.type==='text'){texts++;assert.equal(block.text,originalBlock.text,'No content lost between authoring and web payload');}
    else{
     images++;const bytes=Buffer.from(block.src.split(',')[1],'base64'),sourceBytes=await read('data/documents/readers/'+path.replace(/reader\.json$/,originalBlock.file));
     assert.deepEqual(bytes,sourceBytes,'Original rendered asset preserved');assert.equal(sha(bytes),block.sha256);assert(block.alt&&block.width>0&&block.height>0);
    }
   }
  }
 }
 const exact=searchDocumentSections(index,'203.2.6');
 assert.equal(exact.length,1);assert.equal(exact[0].chapter.id,'chapter-2');assert.equal(exact[0].section.id,'203');assert.equal(exact[0].anchor.id,'203.2.6');assert.equal(exact[0].anchor.page,12);
 assert(searchDocumentSections(index,'室外通路突出物限制').some(r=>r.anchor.id==='203.2.6'),'Find phrases across original hard wraps');
 assert(searchDocumentSections(index,'A405.10').some(r=>r.chapter.id==='appendix-4'),'Appendix search');
 assert.equal(searchDocumentSections(index,'不存在的規範xyz').length,0);assert.equal(searchDocumentSections(index,' ').length,0);
 assert.equal(documentChapterAtPage(index,21).sections[0].id,'205','Image-only page keeps its owning section');
 assert.equal(documentChapterAtPage(index,35).chapter.id,'chapter-3');
}
console.log(JSON.stringify({illustratedReaders:Object.keys(catalog).length,chapterGroups:groups,images,textBlocks:texts,sourceIntegrity:'passed',pageCoverage:'passed',sectionSearch:'passed',portableAndRegionalPack:'passed'}));
