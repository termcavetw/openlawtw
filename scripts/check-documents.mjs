import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
const root=new URL('../',import.meta.url),read=p=>readFile(new URL(p,root)),json=async p=>JSON.parse(await read(p));
const sources=await json('data/documents/catalog.json'),manifest=await json('data/runtime-manifest.json'),catalog=await json('data/runtime-catalog.json');
const html=(await read('openlawtw.html')).toString(),packed=html.match(/atob\("([A-Za-z0-9+/=]+)"\)/)[1],offline=JSON.parse(gunzipSync(Buffer.from(packed,'base64')));
let pages=0;
for(const [id,source] of Object.entries(sources)){
 const original=await read(source.file),file=manifest.documents[id],doc=await json('public'+file.url),law=catalog.laws.find(l=>l.id===id);
 assert.equal(createHash('sha256').update(original).digest('hex'),source.sha256);
 assert.deepEqual(Buffer.from(doc.pdf,'base64'),original);assert.deepEqual(offline[file.url],doc);
 assert.equal(doc.pages.length,source.pages);assert.equal(law.document.sha256,source.sha256);
 assert.equal(law.coverage,'link','PDF is not a structured full-text law');
 assert(manifest.packs.find(p=>p.id==='中央').files.some(f=>f.url===file.url),'PDF in central offline pack');
 for(const [i,page] of doc.pages.entries())assert.equal(page.page,i+1);
 assert(doc.pages[23].text.includes('206.2'));pages+=doc.pages.length;
}
console.log(JSON.stringify({officialDocuments:Object.keys(sources).length,pdfPages:pages,originalBytes:'identical',portableDocument:'passed',offlinePack:'passed'}));
