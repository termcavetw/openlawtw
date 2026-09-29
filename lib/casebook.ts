import type {Article,Law,LegalUnit,Ruling} from './law-types.ts';

/** Personal evidence snapshots. Original text is never replaced by a later dataset. */
export type CaseEvidence={
 id:string;kind:'article'|'ruling'|'document'|'source';title:string;locator:{lawId?:string;articleNo?:string;unitId?:string;unitLabel?:string;rulingId?:string;sourceId?:string;page?:number};
 quote:string;contentHash:string;sourceHash:string|null;sourceURL:string;sourcePageURL:string;region:string;observedAt:string|null;officialModifiedAt:string|null;effectiveAt:string|null;capturedAt:string;note:string;
};
export type CaseFolder={id:string;name:string;createdAt:string;updatedAt:string;notes:string;questions:string;entries:CaseEvidence[]};
export type Casebook={format:'openlawtw-casebook';schemaVersion:1;folders:CaseFolder[]};
export type EvidenceVersion={contentHash:string|null;sourceHash:string|null;observedAt?:string|null};
export type EvidenceComparison='same'|'changed'|'source-changed'|'unavailable';
export const CASEBOOK_KEY='openlawtw-casebook-v1';
export const CASEBOOK_MAX_BYTES=4*1024*1024;
export const CASEBOOK_LIMITS={folders:50,entries:1000,quote:200_000,note:20_000,name:120};
const now=()=>new Date().toISOString();
export const newCasebook=():Casebook=>({format:'openlawtw-casebook',schemaVersion:1,folders:[]});
export function newCaseId(){return globalThis.crypto?.randomUUID?.()||`case-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;}
export function safeEvidenceURL(value:string){try{const url=new URL(value);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)return null;return url.href;}catch{return null;}}
const requiredURL=(value:string)=>{const safe=safeEvidenceURL(value);if(!safe)throw Error('來源網址必須是有效的 HTTP 或 HTTPS 網址。');return safe;};
const optionalDate=(value:string|undefined|null)=>value?.trim()&&!value.startsWith('9999')?value:null;

// A small SHA-256 fallback keeps portable/file copies usable without Web Crypto.
export async function hashEvidenceText(value:string):Promise<string>{
 const bytes=new TextEncoder().encode(value);
 if(globalThis.crypto?.subtle)return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
 const constants=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
 const state=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
 const padded=new Uint8Array(Math.ceil((bytes.length+9)/64)*64);padded.set(bytes);padded[bytes.length]=128;
 const view=new DataView(padded.buffer);view.setUint32(padded.length-8,Math.floor(bytes.length/0x20000000));view.setUint32(padded.length-4,(bytes.length*8)>>>0);
 const rot=(x:number,n:number)=>(x>>>n)|(x<<(32-n));const words=new Uint32Array(64);
 for(let start=0;start<padded.length;start+=64){
  for(let i=0;i<16;i++)words[i]=view.getUint32(start+i*4);
  for(let i=16;i<64;i++){const x=words[i-15],y=words[i-2];words[i]=(words[i-16]+(rot(x,7)^rot(x,18)^(x>>>3))+words[i-7]+(rot(y,17)^rot(y,19)^(y>>>10)))>>>0;}
  let [a,b,c,d,e,f,g,h]=state;
  for(let i=0;i<64;i++){const t1=(h+(rot(e,6)^rot(e,11)^rot(e,25))+((e&f)^(~e&g))+constants[i]+words[i])>>>0;const t2=((rot(a,2)^rot(a,13)^rot(a,22))+((a&b)^(a&c)^(b&c)))>>>0;h=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;}
  [a,b,c,d,e,f,g,h].forEach((v,i)=>state[i]=(state[i]+v)>>>0);
 }
 return state.map(v=>v.toString(16).padStart(8,'0')).join('');
}

function verifiedUnit(article:Article,id:string):LegalUnit{
 const visit=(units:LegalUnit[]):LegalUnit|undefined=>{for(const unit of units){if(unit.id===id)return unit;const nested=visit(unit.children);if(nested)return nested;}};
 const unit=article.structure?.status==='parsed'?visit(article.structure.units):undefined;
 if(!unit||!Number.isSafeInteger(unit.start)||!Number.isSafeInteger(unit.end)||unit.start<0||unit.end>article.text.length||unit.end<=unit.start)throw Error('此項款尚無可核對的原文範圍，請改存整條條文。');
 return unit;
}
export async function makeArticleEvidence(law:Law,article:Article,options:{unitId?:string;unitLabel?:string}={}):Promise<CaseEvidence>{
 const unit=options.unitId?verifiedUnit(article,options.unitId):null;const quote=unit?article.text.slice(unit.start,unit.end):article.text;
 if(!quote.trim())throw Error('條文沒有可保存的原文。');
 return {id:newCaseId(),kind:'article',title:[law.name,article.no,unit?options.unitLabel||options.unitId:''].filter(Boolean).join(' '),locator:{lawId:law.id,articleNo:article.no,...(unit?{unitId:unit.id,unitLabel:options.unitLabel||unit.id}:{})},quote,contentHash:await hashEvidenceText(quote),sourceHash:law.contentHash||null,sourceURL:requiredURL(law.url),sourcePageURL:requiredURL(law.url),region:law.region,observedAt:optionalDate(law.retrieved),officialModifiedAt:optionalDate(law.modified),effectiveAt:optionalDate(law.effective),capturedAt:now(),note:''};
}
export async function makeRulingEvidence(ruling:Ruling,options:{region?:string;observedAt?:string|null}={}):Promise<CaseEvidence>{
 if(ruling.summaryOnly||!ruling.body.trim())throw Error('請先載入函釋全文，再加入案件。');
 const quote=ruling.body;
 return {id:newCaseId(),kind:'ruling',title:[ruling.number,ruling.title].filter(Boolean).join(' '),locator:{rulingId:ruling.id},quote,contentHash:await hashEvidenceText(quote),sourceHash:null,sourceURL:requiredURL(ruling.url),sourcePageURL:requiredURL(ruling.url),region:options.region||'未標示',observedAt:optionalDate(options.observedAt),officialModifiedAt:optionalDate(ruling.modified||ruling.published||ruling.date),effectiveAt:null,capturedAt:now(),note:''};
}
export async function makeDocumentEvidence(law:Law,document:{page:number;text:string}):Promise<CaseEvidence>{
 if(!law.document||!Number.isSafeInteger(document.page)||document.page<1||document.page>law.document.pages)throw Error('文件頁碼不在已收錄範圍內。');
 if(law.document.startPage&&document.page<law.document.startPage||law.document.endPage&&document.page>law.document.endPage)throw Error('這一頁不在本法規的正文範圍內。');
 if(!document.text.trim())throw Error('此頁尚無可保存的文字，請核對官方原檔。');
 return {id:newCaseId(),kind:'document',title:law.name+(law.document.format==='html'?' 原文文件':` PDF 第 ${document.page} 頁`),locator:{lawId:law.id,page:document.page},quote:document.text,contentHash:await hashEvidenceText(document.text),sourceHash:law.document.sha256||null,sourceURL:requiredURL(law.document.source),sourcePageURL:requiredURL(law.document.sourcePage||law.url),region:law.region,observedAt:optionalDate(law.document.retrieved||law.retrieved),officialModifiedAt:optionalDate(law.modified),effectiveAt:optionalDate(law.effective),capturedAt:now(),note:''};
}
export async function makeSourceEvidence(source:{id:string;title:string;region:string;url:string;sourcePageURL:string;text:string;sourceHash:string;observedAt:string|null;effectiveAt?:string|null;officialModifiedAt?:string|null}):Promise<CaseEvidence>{
 if(!source.text.trim())throw Error('此資料尚無可保存的原文。');
 return {id:newCaseId(),kind:'source',title:source.title,locator:{sourceId:source.id},quote:source.text,contentHash:await hashEvidenceText(source.text),sourceHash:source.sourceHash,sourceURL:requiredURL(source.url),sourcePageURL:requiredURL(source.sourcePageURL),region:source.region,observedAt:optionalDate(source.observedAt),officialModifiedAt:optionalDate(source.officialModifiedAt),effectiveAt:optionalDate(source.effectiveAt),capturedAt:now(),note:''};
}
export function currentEvidenceVersion(evidence:CaseEvidence):EvidenceVersion{return {contentHash:evidence.contentHash,sourceHash:evidence.sourceHash,observedAt:evidence.observedAt};}
export function compareEvidence(captured:CaseEvidence,current:EvidenceVersion|null|undefined):EvidenceComparison{
 if(!current?.contentHash)return 'unavailable';
 if(captured.contentHash!==current.contentHash)return 'changed';
 if(captured.sourceHash&&current.sourceHash&&captured.sourceHash!==current.sourceHash)return 'source-changed';
 return 'same';
}
export function evidenceIdentity(entry:CaseEvidence){const l=entry.locator;return JSON.stringify([entry.kind,l.lawId||'',l.articleNo||'',l.unitId||'',l.rulingId||'',l.sourceId||'',l.page||0,entry.sourceURL,entry.contentHash,entry.sourceHash]);}
export function createCaseFolder(book:Casebook,name:string):{book:Casebook;folder:CaseFolder}{
 const title=name.trim();if(!title||title.length>CASEBOOK_LIMITS.name)throw Error('案件名稱需為 1 至 120 個字。');if(book.folders.length>=CASEBOOK_LIMITS.folders)throw Error('最多可建立 50 個案件，請先匯出備份再整理。');
 const date=now(),folder:CaseFolder={id:newCaseId(),name:title,createdAt:date,updatedAt:date,notes:'',questions:'',entries:[]};return {book:{...book,folders:[...book.folders,folder]},folder};
}
export function updateCaseFolder(book:Casebook,id:string,patch:Partial<Pick<CaseFolder,'name'|'notes'|'questions'>>):Casebook{
 if(!book.folders.some(f=>f.id===id))throw Error('找不到這個案件。');
 if(patch.name!==undefined&&(!patch.name.trim()||patch.name.trim().length>CASEBOOK_LIMITS.name))throw Error('案件名稱需為 1 至 120 個字。');
 if((patch.notes?.length||0)>CASEBOOK_LIMITS.note||(patch.questions?.length||0)>CASEBOOK_LIMITS.note)throw Error('案件筆記或待確認事項不可超過 20,000 個字。');
 return {...book,folders:book.folders.map(f=>f.id===id?{...f,...patch,...(patch.name!==undefined?{name:patch.name.trim()}:{}),updatedAt:now()}:f)};
}
export function addCaseEvidence(book:Casebook,folderId:string,evidence:CaseEvidence):{book:Casebook;duplicate:boolean}{
 const folder=book.folders.find(f=>f.id===folderId);if(!folder)throw Error('請先建立或選擇案件。');
 if(folder.entries.some(e=>evidenceIdentity(e)===evidenceIdentity(evidence)))return {book,duplicate:true};
 if(book.folders.reduce((n,f)=>n+f.entries.length,0)>=CASEBOOK_LIMITS.entries)throw Error('最多可保存 1,000 筆引用，請先匯出備份再整理。');
 const snapshot=JSON.parse(JSON.stringify(evidence)) as CaseEvidence;
 if(folder.entries.some(e=>e.id===snapshot.id))snapshot.id=newCaseId();
 return {book:{...book,folders:book.folders.map(f=>f.id===folderId?{...f,updatedAt:now(),entries:[...f.entries,snapshot]}:f)},duplicate:false};
}
export function updateEvidenceNote(book:Casebook,folderId:string,entryId:string,note:string):Casebook{
 if(note.length>CASEBOOK_LIMITS.note)throw Error('引用註記不可超過 20,000 個字。');
 const folder=book.folders.find(f=>f.id===folderId);if(!folder?.entries.some(e=>e.id===entryId))throw Error('找不到這筆引用。');
 return {...book,folders:book.folders.map(f=>f.id===folderId?{...f,updatedAt:now(),entries:f.entries.map(e=>e.id===entryId?{...e,note}:e)}:f)};
}

const fail=(message:string):never=>{throw Error('案件檔案格式錯誤：'+message);};
function object(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))return fail('需為物件');return value as Record<string,unknown>;}
function string(value:unknown,label:string,max=1000,allowEmpty=false){if(typeof value!=='string'||value.length>max||(!allowEmpty&&!value.trim()))return fail(label);return value;}
function timestamp(value:unknown,label:string){const s=string(value,label,64);if(!/^\d{4}-\d{2}-\d{2}T/.test(s)||Number.isNaN(Date.parse(s)))return fail(label);return s;}
function nullableString(value:unknown,label:string,max=200){return value===null?null:string(value,label,max);}
function hash(value:unknown,label:string){const s=string(value,label,64);if(!/^[a-f0-9]{64}$/.test(s))return fail(label);return s;}
function parseEntry(value:unknown):CaseEvidence{
 const e=object(value),l=object(e.locator),kind=e.kind;if(!['article','ruling','document','source'].includes(String(kind)))return fail('引用類型');
 const locator:CaseEvidence['locator']={};
 for(const key of ['lawId','articleNo','unitId','unitLabel','rulingId','sourceId'] as const)if(l[key]!==undefined)locator[key]=string(l[key],key,500);
 if(l.page!==undefined){if(!Number.isSafeInteger(l.page)||Number(l.page)<1||Number(l.page)>100_000)return fail('文件頁碼');locator.page=Number(l.page);}
 if(kind==='article'&&(!locator.lawId||!locator.articleNo)||kind==='ruling'&&!locator.rulingId||kind==='document'&&(!locator.lawId||!locator.page)||kind==='source'&&!locator.sourceId)return fail('引用位置不完整');
 const sourceURL=requiredURL(string(e.sourceURL,'來源網址',4000)),sourcePageURL=requiredURL(string(e.sourcePageURL,'來源頁面',4000));
 return {id:string(e.id,'引用識別碼',160),kind:kind as CaseEvidence['kind'],title:string(e.title,'引用標題',2000),locator,quote:string(e.quote,'引用原文',CASEBOOK_LIMITS.quote),contentHash:hash(e.contentHash,'原文雜湊'),sourceHash:e.sourceHash===null?null:hash(e.sourceHash,'來源雜湊'),sourceURL,sourcePageURL,region:string(e.region,'縣市',120),observedAt:nullableString(e.observedAt,'觀測日期'),officialModifiedAt:nullableString(e.officialModifiedAt,'官方日期'),effectiveAt:nullableString(e.effectiveAt,'生效日期'),capturedAt:timestamp(e.capturedAt,'保存日期'),note:string(e.note,'引用註記',CASEBOOK_LIMITS.note,true)};
}
export function parseCasebook(text:string):Casebook{
 if(new TextEncoder().encode(text).length>CASEBOOK_MAX_BYTES)throw Error('案件檔案超過 4 MB，請拆成較小的備份。');
 let root:Record<string,unknown>;try{root=object(JSON.parse(text));}catch(e){throw Error(e instanceof SyntaxError?'案件檔案不是有效的 JSON。':String(e instanceof Error?e.message:e));}
 if(root.format!=='openlawtw-casebook'||root.schemaVersion!==1)return fail('不支援此格式或版本');
 if(!Array.isArray(root.folders)||root.folders.length>CASEBOOK_LIMITS.folders)return fail('案件數量');
 const ids=new Set<string>();let total=0;
 const folders=root.folders.map(value=>{const f=object(value),id=string(f.id,'案件識別碼',160);if(ids.has(id))return fail('案件識別碼重複');ids.add(id);
  if(!Array.isArray(f.entries)||(total+=f.entries.length)>CASEBOOK_LIMITS.entries)return fail('引用數量');
  const entryIds=new Set<string>();const entries=f.entries.map(v=>{const e=parseEntry(v);if(entryIds.has(e.id))return fail('引用識別碼重複');entryIds.add(e.id);return e;});
  return {id,name:string(f.name,'案件名稱',CASEBOOK_LIMITS.name),createdAt:timestamp(f.createdAt,'建立日期'),updatedAt:timestamp(f.updatedAt,'更新日期'),notes:string(f.notes,'案件筆記',CASEBOOK_LIMITS.note,true),questions:string(f.questions,'待確認事項',CASEBOOK_LIMITS.note,true),entries};
 });
 return {format:'openlawtw-casebook',schemaVersion:1,folders};
}
export async function verifyCasebook(book:Casebook){for(const folder of book.folders)for(const entry of folder.entries)if(await hashEvidenceText(entry.quote)!==entry.contentHash)throw Error(`「${entry.title}」的原文與雜湊不一致；未匯入。`);return book;}
export async function importCasebook(text:string){return verifyCasebook(parseCasebook(text));}
export function mergeCasebooks(current:Casebook,incoming:Casebook):{book:Casebook;added:number;duplicates:number;renamed:number}{
 // Matching identical folders are skipped. A changed folder with the same id is
 // retained as a separate imported copy, so older notes and quotations survive.
 const folders=current.folders.map(f=>({...f,entries:f.entries.map(e=>({...e,locator:{...e.locator}}))}));let added=0,duplicates=0,renamed=0;
 for(const folder of incoming.folders){const existing=folders.find(f=>f.id===folder.id);if(existing&&JSON.stringify(existing)===JSON.stringify(folder)){duplicates++;continue;}
  const copy=JSON.parse(JSON.stringify(folder)) as CaseFolder;
  if(existing||folders.some(f=>f.name===copy.name)){copy.id=newCaseId();copy.name=(copy.name.slice(0,105)+'（匯入副本）').slice(0,120);renamed++;}
  folders.push(copy);added++;
 }
 const book:Casebook={...current,folders};parseCasebook(JSON.stringify(book));return {book,added,duplicates,renamed};
}
export interface CasebookStorage{getItem(key:string):string|null;setItem(key:string,value:string):void;}
export function writeCasebook(storage:CasebookStorage,book:Casebook,expectedRaw:string|null):string{
 const serialized=JSON.stringify(book);parseCasebook(serialized);
 try{if(storage.getItem(CASEBOOK_KEY)!==expectedRaw)throw Error('案件已在其他分頁更新，請重新載入後再操作。');storage.setItem(CASEBOOK_KEY,serialized);}
 catch(e){if(e instanceof Error&&e.message.includes('其他分頁'))throw e;throw Error('案件未儲存：瀏覽器空間不足或禁止本機儲存。請匯出備份後再整理空間。');}
 return serialized;
}

const escapeHTML=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const escapeMarkdown=(value:string)=>value.replace(/[\\`*_{}\[\]<>#+.!|~\-]/g,'\\$&');
const labelDate=(value:string|null)=>value||'未提供／待核對';
const locatorLabel=(entry:CaseEvidence)=>[entry.locator.articleNo,entry.locator.unitLabel,entry.locator.page?`原檔第 ${entry.locator.page} 頁`:null].filter(Boolean).join(' · ')||entry.locator.rulingId||'原文';
export function exportCasebookJSON(book:Casebook,folderId?:string){return JSON.stringify({...book,folders:folderId?book.folders.filter(f=>f.id===folderId):book.folders},null,2);}
export function exportCaseMarkdown(folder:CaseFolder){
 const lines=[`# ${escapeMarkdown(folder.name)}`,'','案件引用快照。保存內容不會隨資料更新自動替換；使用前請核對官方來源、版本及個案適用性。','','## 案件筆記','',escapeMarkdown(folder.notes)||'（無）','','## 待確認事項','',escapeMarkdown(folder.questions)||'（無）'];
 for(const entry of folder.entries){lines.push('',`## ${escapeMarkdown(entry.title)}`,'',`位置：${escapeMarkdown(locatorLabel(entry))}`,`地區：${escapeMarkdown(entry.region)}`,`來源：${escapeMarkdown(safeEvidenceURL(entry.sourceURL)||'無效網址')}`,`官方頁面：${escapeMarkdown(safeEvidenceURL(entry.sourcePageURL)||'無效網址')}`,`來源觀測：${escapeMarkdown(labelDate(entry.observedAt))}`,`官方修正／發布：${escapeMarkdown(labelDate(entry.officialModifiedAt))}`,`生效日期：${escapeMarkdown(labelDate(entry.effectiveAt))}`,`保存時間：${escapeMarkdown(entry.capturedAt)}`,`原文 SHA-256：${entry.contentHash}`,`來源內容 SHA-256：${entry.sourceHash||'未提供'}`,'',...entry.quote.split('\n').map(line=>'> '+escapeMarkdown(line)),'',`引用註記：${escapeMarkdown(entry.note)||'（無）'}`);}
 return lines.join('\n')+'\n';
}
export function exportCaseHTML(folder:CaseFolder){
 const esc=escapeHTML,link=(value:string)=>{const url=safeEvidenceURL(value);return url?`<a href="${esc(url)}" rel="noreferrer">${esc(url)}</a>`:'無效網址';};
 const entries=folder.entries.map(entry=>`<article><h2>${esc(entry.title)}</h2><dl><dt>位置／地區</dt><dd>${esc(locatorLabel(entry))}／${esc(entry.region)}</dd><dt>官方原文</dt><dd>${link(entry.sourceURL)}</dd><dt>官方頁面</dt><dd>${link(entry.sourcePageURL)}</dd><dt>來源觀測</dt><dd>${esc(labelDate(entry.observedAt))}</dd><dt>官方修正／發布</dt><dd>${esc(labelDate(entry.officialModifiedAt))}</dd><dt>生效日期</dt><dd>${esc(labelDate(entry.effectiveAt))}</dd><dt>保存時間</dt><dd>${esc(entry.capturedAt)}</dd><dt>原文 SHA-256</dt><dd>${esc(entry.contentHash)}</dd><dt>來源內容 SHA-256</dt><dd>${esc(entry.sourceHash||'未提供')}</dd></dl><blockquote>${esc(entry.quote)}</blockquote><h3>引用註記</h3><p>${esc(entry.note||'（無）')}</p></article>`).join('');
 return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${esc(folder.name)}｜案件引用</title><style>body{font:16px/1.75 system-ui,sans-serif;color:#172635;max-width:880px;margin:40px auto;padding:0 24px}h1,h2{line-height:1.4}h2{font-size:21px}article{border-top:1px solid #bbb;padding-top:18px;margin-top:32px}p,blockquote{white-space:pre-wrap;overflow-wrap:anywhere}blockquote{margin:16px 0;border-left:3px solid #667;padding:12px 18px;background:#f5f7f9}dl{display:grid;grid-template-columns:140px 1fr;font-size:13px;gap:5px 12px}dd{margin:0;overflow-wrap:anywhere}dt{color:#536170}a{color:#154d7a;overflow-wrap:anywhere}@media print{body{margin:0;max-width:none;padding:0}h2,h3{break-after:avoid}blockquote{background:none}a{color:inherit}}</style></head><body><h1>${esc(folder.name)}</h1><p>案件引用快照。保存內容不會隨資料更新自動替換；使用前請核對官方來源、版本及個案適用性。可使用瀏覽器「列印」儲存為 PDF。</p><h2>案件筆記</h2><p>${esc(folder.notes||'（無）')}</p><h2>待確認事項</h2><p>${esc(folder.questions||'（無）')}</p>${entries}</body></html>`;
}
