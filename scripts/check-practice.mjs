import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {inflateRawSync,gunzipSync} from 'node:zlib';
import {normalize} from '../lib/search.ts';

const root=new URL('../',import.meta.url),read=p=>readFile(new URL(p,root)),json=async p=>JSON.parse(await read(p));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
// Read original ZIP members via their central-directory offsets, including
// archives that use a data descriptor. No extraction to disk or file rewriting.
function member(zip,wanted){
 let end=zip.length-22;while(end>=Math.max(0,zip.length-65557)&&zip.readUInt32LE(end)!==0x06054b50)end--;
 assert(end>=0,'ODT ZIP end record');let at=zip.readUInt32LE(end+16);
 for(let i=0;i<zip.readUInt16LE(end+10);i++){
  assert.equal(zip.readUInt32LE(at),0x02014b50);const nameLength=zip.readUInt16LE(at+28),extraLength=zip.readUInt16LE(at+30),commentLength=zip.readUInt16LE(at+32),name=zip.subarray(at+46,at+46+nameLength).toString();
  if(name===wanted){const method=zip.readUInt16LE(at+10),size=zip.readUInt32LE(at+20),offset=zip.readUInt32LE(at+42);assert.equal(zip.readUInt32LE(offset),0x04034b50);const start=offset+30+zip.readUInt16LE(offset+26)+zip.readUInt16LE(offset+28),body=zip.subarray(start,start+size);assert([0,8].includes(method));return method===8?inflateRawSync(body):body;}
  at+=46+nameLength+extraLength+commentLength;
 }
 throw Error('Missing ODT member '+wanted);
}
const decode=text=>text.replace(/&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);/gi,(_,entity)=>entity[0]==='#'?String.fromCodePoint(entity[1].toLowerCase()==='x'?parseInt(entity.slice(2),16):parseInt(entity.slice(1),10)):({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"})[entity]);
const source=await json('data/practice/ntpc-interior-forms.json'),page=await read(source.pageFile);
assert.equal(sha(page),source.pageSHA256);assert.equal(source.items.length,11);
assert(source.pageFile.endsWith('/'+source.pageSHA256+'.html'),'immutable original source snapshot');
const links=[...page.toString().matchAll(/<a\b[^>]*\bhref=["']([^"']+)["']/gi)].map(m=>new URL(decode(m[1]),source.source).href);
let originals=0;
for(const [i,item] of source.items.entries()){
 assert.equal(item.id,`ntpc-interior-${String(i+1).padStart(2,'0')}`);assert.equal(item.sourcePageSHA256,source.pageSHA256);assert.equal(item.sourcePage,source.source);
 assert.equal(links.filter(link=>link===item.source).length,1,item.id+' official page links to exact original');
 assert.equal(decodeURIComponent(new URL(item.source).pathname.split('/').at(-1)),item.filename);
 assert.equal(new URL(item.source).hostname,'www.publicwork.ntpc.gov.tw');assert(item.note.includes('版本標示不等於施行日期'));assert(!('effectiveDate' in item));
 const bytes=await read(item.file);originals+=bytes.length;assert.equal(sha(bytes),item.sha256);assert.equal(bytes.length,item.bytes);assert.equal(member(bytes,'mimetype').toString().trim(),item.mime);
 // ODT can nest text boxes / paragraphs; the Python importer test independently
 // verifies exact extraction with an XML parser. Here verify each preview
 // paragraph has direct text evidence in the untouched original XML.
 const content=decode(member(bytes,'content.xml').toString().replace(/<[^>]+>/g,''));
 for(const paragraph of item.text.split('\n').filter(line=>line.trim()))assert(content.includes(paragraph),item.id+' preview paragraph has original evidence');
}
assert(source.items[5].text.includes('簡易室內裝修申請竣工核備預審表'),'source title evidence');
assert(source.items[5].text.includes('115年8月版'),'document-version evidence remains distinct from the source row date');
const laws=await json('public/data/laws.json');
for(const [id,no,evidence] of [['D0070148','第33條','申報施工'],['新北市-C0170020','第10點','審核查驗期限'],['新北市-C0170033','','一定規模以下'],['新北市-C0170078','','違建']]){
 const law=laws[id];assert(law,id);assert((no?law.articles.find(a=>normalize(a.no)===no)?.text:law.name)?.includes(evidence),id+' source citation');
}
if(!process.argv.includes('--source-only')){
 const manifest=await json('data/runtime-manifest.json'),runtime=await json('data/runtime-practice.json');
 assert.equal(Object.keys(manifest.practiceDocuments||{}).length,11,'Run build before practice bundle checks');
 assert.equal(runtime.items.length,11);assert.equal(runtime.pageSHA256,source.pageSHA256);
 const html=(await read('openlawtw.html')).toString(),packed=html.match(/const packed=Uint8Array\.from\(atob\("([A-Za-z0-9+/=]+)"\)/)?.[1];assert(packed);
 const offline=JSON.parse(gunzipSync(Buffer.from(packed,'base64'))),pack=manifest.packs.find(p=>p.id==='新北市');assert(pack);
 for(const item of source.items){
  const file=manifest.practiceDocuments[item.id],bytes=await read('public'+file.url),doc=JSON.parse(bytes),head=runtime.items.find(form=>form.id===item.id);
  assert.equal(sha(bytes),file.sha256);assert.equal(bytes.length,file.bytes);assert.equal(doc.sha256,item.sha256);assert.equal(doc.text,item.text);assert.equal(doc.source,item.source);
  assert.deepEqual(Buffer.from(doc.original,'base64'),await read(item.file),'original ODT bytes survive build');
  assert.deepEqual(offline[file.url],doc,'portable form with original and preview');assert(pack.files.some(f=>f.url===file.url),'New Taipei offline pack includes form');
  assert(!('text' in head)&&!('original' in head)&&!('file' in head),'initial catalogue excludes body and original bytes');
  assert.equal(head.versionLabel,item.versionLabel);assert.equal(head.filename,item.filename);assert.equal(head.source,item.source);
 }
 globalThis.window={OPENLAWTW_OFFLINE:offline};globalThis.fetch=()=>{throw Error('Practice offline reader must not fetch network');};
 const {loadFile}=await import('../lib/data-client.ts?practice-offline');
 for(const item of source.items)assert.equal((await loadFile(manifest.practiceDocuments[item.id])).sha256,item.sha256);
}
console.log(JSON.stringify({practiceForms:11,originalBytes:originals,sourceHash:'passed',sourceLinks:'passed',odtParagraphs:'passed',lawCitations:'passed',build:process.argv.includes('--source-only')?'not requested':'passed',offline:process.argv.includes('--source-only')?'not requested':'passed'}));
