import {createHash} from 'node:crypto';
import {normalize,chineseNumber} from '../lib/search.ts';
const sorted=value=>Array.isArray(value)?value.map(sorted):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>[k,sorted(v)])):value;
export const sha=value=>createHash('sha256').update(typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(sorted(value))).digest('hex');
export const canonicalLaw=law=>sorted(Object.fromEntries(Object.entries(law).filter(([k])=>!['retrieved','snapshot','note','schemaVersion','contentHash','sourceRecordId','version'].includes(k)).map(([k,v])=>[k,k==='articles'?v.map(a=>({no:a.no,text:a.text,path:a.path})):v])));
export function structure(text,id,allowed){
 const fallback=reason=>({status:'unparsed',method:'raw-text-v1',units:[],reason});
 if(!allowed)return fallback('來源有換行與排版混用；尚未核實項款邊界。');
 if(/[│┌┬┼┐└┴┘]/.test(text)||/\n[ \t　]+\S/.test(text))return fallback('含表格或縮排續行，保留原文待核對。');
 const lines=[...text.matchAll(/[^\n]+(?:\n|$)/g)],units=[];let paragraph=null,item=null,sub=null;
 for(const line of lines){
  const raw=line[0],start=line.index,end=start+raw.length;
  const m=raw.match(/^([一二三四五六七八九十百千]+)、/),sm=raw.match(/^[（(]([一二三四五六七八九十百千]+)[）)]/);
  if(m){if(!paragraph)return fallback('款缺少可核對的前導項。');const number=Number(chineseNumber(m[1]));if(number!==paragraph.children.length+1)return fallback('款序不連續。');item={id:paragraph.id+'/i:'+number,kind:'item',number,start,end,children:[]};paragraph.children.push(item);paragraph.end=end;sub=null;}
  else if(sm){if(!item)return fallback('目缺少上層款。');const number=Number(chineseNumber(sm[1]));if(number!==item.children.length+1)return fallback('目序不連續。');sub={id:item.id+'/s:'+number,kind:'subitem',number,start,end,children:[]};item.children.push(sub);item.end=end;paragraph.end=end;}
  else if(units.length&&![...raw.trim()].length){continue;}
  else{
   // An unnumbered line after a nonterminal line may be wrapping, never invent an item.
   const previous=lines[lines.indexOf(line)-1]?.[0].trim();
   if(previous&&!/[。；：:]$/.test(previous))return fallback('段落界線不明確。');
   paragraph={id:id+'/p:'+(units.length+1),kind:'paragraph',number:units.length+1,start,end,children:[]};units.push(paragraph);item=null;sub=null;
  }
 }
 if(!units.length)return fallback('未解析到項。');
 return {status:'parsed',method:'moj-xml-line-boundaries-v1',units};
}
export function enrichLaw(law,ledger,sources={}){const canonical=canonicalLaw(law),contentHash=sha(canonical),source=Object.hasOwn(sources,law.id)?sources[law.id]:null;const individualXML=source?.format==='xml'&&['CF','CM'].includes(source.bulkKey)&&(!source.lawId||source.lawId===law.id);return {...canonical,retrieved:law.retrieved||'',snapshot:law.snapshot||'',schemaVersion:2,contentHash,sourceRecordId:law.region==='中央'&&law.source==='全國法規資料庫'?(individualXML?law.id:law.kind==='法律'?'CF':'CM'):law.id,version:{observedAt:ledger?.observedAt||law.retrieved||'',previousContentHash:ledger?.previousContentHash||null,officialModified:law.modified,effectiveDate:law.effective},articles:canonical.articles.map(a=>{const address=normalize(a.no).replace(/^第/,'').replace(/[條點]$/,'');const id=law.id+'/a:'+address;return {...a,id,anchor:'a-'+address,contentHash:sha(a.text),officialAmendedAt:null,structure:structure(a.text,id,law.source==='全國法規資料庫')};})};}
