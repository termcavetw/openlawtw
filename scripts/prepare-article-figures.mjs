import {readFile} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {createHash} from 'node:crypto';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
/** Supplemental official imagery does not alter canonical article text or quote hashes. */
export async function prepareArticleFigures(root,laws){
 const base=resolve(root,'data/documents/article-figures'),catalog=JSON.parse(await readFile(resolve(base,'catalog.json'),'utf8'));
 async function verified(file,sha256){const path=resolve(root,file);if(!path.startsWith(base+sep))throw Error('Article figure path outside source directory');const bytes=await readFile(path);if(hash(bytes)!==sha256)throw Error('Article figure checksum mismatch: '+file);return bytes;}
 const figures={};
 for(const record of catalog){
  const law=laws[record.lawId],article=law?.articles.find(a=>a.no===record.article);
  if(!article||article.text!==record.articleText||!law.attachments.some(a=>a.url===record.source))throw Error('Article figure no longer matches its source article/attachment: '+record.lawId);
  const original=await verified(record.file,record.sha256);await verified(record.sourceHTML,record.sourceHTMLSha256);
  if(original.length!==record.bytes||!original.subarray(0,5).equals(Buffer.from('%PDF-')))throw Error('Invalid article PDF');
  const images=[];
  for(const image of record.images){
   if(!['image/jpeg','image/png','image/webp'].includes(image.mime)||image.page<1||image.page>record.pages||image.width<=0||image.height<=0)throw Error('Invalid article image');
   const bytes=await verified(image.file,image.sha256);
   const {file,mime,...metadata}=image;images.push({...metadata,src:'data:'+mime+';base64,'+bytes.toString('base64')});
  }
  const {file,sourceHTML,sourceHTMLSha256,articleText,...metadata}=record;
  const figure={...metadata,pdf:'data:application/pdf;base64,'+original.toString('base64'),images};
  const entries=figures[record.lawId]??={};(entries[record.article]??=[]).push(figure);
 }
 return figures;
}
