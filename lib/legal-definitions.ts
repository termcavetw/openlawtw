import type {Article,Law} from './law-types.ts';
import {splitLegalText} from './legal-tables.ts';
export type LegalDefinition={term:string;article:string;start:number;end:number;text:string};
export type DefinitionOccurrence={start:number;end:number;definition:LegalDefinition};
const self='本自治條例|本自治規則|本條例|本規則|本辦法|本細則|本準則|本要點|本法|本編';
const owns=(token:string,law:Law)=>token==='本法'?law.kind==='法律':token==='本編'?law.name.endsWith('編'):law.name.endsWith(token.slice(1));
const cleanTitle=(name:string)=>name.replace(/（[^）]*）$/,'');
const cache=new WeakMap<Law,LegalDefinition[]>();
/** Extract only explicit whole-law definitions in this loaded official snapshot.
 * Chapter/section-only definitions, parent-law definitions and ambiguous duplicate
 * terms are deliberately excluded. Every excerpt retains exact source offsets.
 */
export function lawDefinitions(law:Law):LegalDefinition[]{
 const cached=cache.get(law);if(cached)return cached;
 const found:LegalDefinition[]=[];
 const scopedLaw={...law,name:cleanTitle(law.name)};
 function add(term:string,a:Article,start:number,end:number){if(/^[\p{Script=Han}A-Za-z]{2,24}$/u.test(term))found.push({term,article:a.no,start,end,text:a.text.slice(start,end)});}
 for(const a of law.articles){
  const list=new RegExp(`^(${self})(?:之|所用)?(?:專用)?(?:建築技術)?(?:用詞|用語|用辭|名詞)[^。\\n：:]{0,28}定義(?:規定)?如下[：:]`).exec(a.text);
  if(list&&owns(list[1],scopedLaw)){
   const rows=[...a.text.matchAll(/^[ \t]*[一二三四五六七八九十百零〇]+、([^：:\n]{1,60})[：:]/gm)];
   for(let i=0;i<rows.length;i++){
    const row=rows[i],start=row.index!,end=rows[i+1]?.index??a.text.length;
    const label=row[1].trim(),alias=/^(.+?)（以下(?:簡稱|稱)([^）]+)）$/.exec(label);
    add(alias?alias[1]:label,a,start,end);
    if(alias)add(alias[2],a,start,end);
   }
  }
  const single=new RegExp(`^(${self})所稱([\\p{Script=Han}]{2,24})[，,](?:係指|指|為)`,'u').exec(a.text);
  if(single&&owns(single[1],scopedLaw))add(single[2],a,0,a.text.length);
 }
 const groups=new Map<string,LegalDefinition[]>();for(const d of found)groups.set(d.term,[...(groups.get(d.term)||[]),d]);
 const result=[...groups.values()].filter(group=>group.length===1).map(group=>group[0]).sort((a,b)=>b.term.length-a.term.length);
 cache.set(law,result);return result;
}
/** First occurrence per term, at most six different terms per article. */
export function definitionOccurrences(law:Law,article:Article,excluded:{start:number;end:number}[]=[]):DefinitionOccurrence[]{
 const definitions=lawDefinitions(law).filter(d=>d.article!==article.no);
 if(!definitions.length)return [];
 const terms=new Map(definitions.map(d=>[d.term,d]));
 const pattern=new RegExp(definitions.map(d=>d.term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|'),'gu');
 const blocked=[...excluded,...splitLegalText(article.text).filter(block=>block.kind==='table'),...[...article.text.matchAll(/[\p{Script=Han}]{2,35}(?:法|條例|規則|辦法|細則|準則|要點|規範)/gu)].map(m=>({start:m.index!,end:m.index!+m[0].length}))];
 const seen=new Set<string>(),result:DefinitionOccurrence[]=[];
 for(const match of article.text.matchAll(pattern)){
  const term=match[0],start=match.index!,end=start+term.length;
  if(seen.has(term)||blocked.some(b=>start<b.end&&end>b.start))continue;
  seen.add(term);result.push({start,end,definition:terms.get(term)!});if(result.length===6)break;
 }
 return result;
}
