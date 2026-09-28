import {chineseNumber,normalize} from './search.ts';
import {articleAddress} from './routes.ts';
import type {Law} from './law-types.ts';
// The compact rows contain only verified sequential paragraph/item/subitem counts.
export type CitationTargets=Record<string,Record<string,[no:string,units?:number[][]]>>;
export type LegalReference={start:number;end:number;law:Law;article:string;unit:string;fallback:boolean};
const escape=(s:string)=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const num='[0-9０-９一二三四五六七八九十百千零〇兩]+';
const articlePattern=`第\\s*(${num})(?:\\s*[-－之]\\s*(${num}))?\\s*條(?:\\s*之\\s*(${num}))?`;
const suffix=`(?:\\s*第\\s*(${num})\\s*項)?(?:\\s*第\\s*(${num})\\s*款)?(?:\\s*第\\s*(${num})\\s*目)?`;
const numeric=(s?:string)=>s?Number(chineseNumber(s.normalize('NFKC'))):0;
const selfPattern='本自治條例|本自治規則|本條例|本規則|本辦法|本細則|本準則|本要點|本法';
const selfMatches=(token:string,law?:Law)=>!!law&&(token==='本法'?law.kind==='法律':law.name.includes(token.slice(1)));
export function createCitationMatcher(laws:Law[],targets:CitationTargets){
 const byName=new Map<string,Law[]>();
 for(const law of laws){const key=normalize(law.name);byName.set(key,[...(byName.get(key)||[]),law]);}
 const names=[...byName.keys()].sort((a,b)=>b.length-a.length).map(name=>escape(name).replace(/臺/g,'[臺台]'));
 const pattern=new RegExp(`(${names.join('|')}|${selfPattern}|依照|按照|準用|適用|依|按)[」』]?\\s*${articlePattern}${suffix}`,'g');
 return function findReferences(text:string,currentLaw?:Law):LegalReference[]{
  const found:LegalReference[]=[];
  for(const match of text.matchAll(pattern)){
   const [written,name,base,before,after,paragraph,item,subitem]=match;
   let law:Law|undefined;
   if(name.startsWith('本'))law=selfMatches(name,currentLaw)?currentLaw:undefined;
   else if(/^(依照|按照|準用|適用|依|按)$/.test(name)){
    // A bare article is safe only in its own law and without another legal title
    // in the same clause. Rulings never infer a law from the currently open panel.
    const preceding=text.slice(0,match.index).split(/[。；;\n]/).at(-1)||'';
    if(!/(法|條例|規則|辦法|細則|準則|要點|規定)/.test(preceding))law=currentLaw;
   }else{const options=byName.get(normalize(name));if(options?.length===1)law=options[0];}
   if(!law||(before&&after))continue;
   const address=String(numeric(base))+(before||after?'-'+numeric(before||after):'');
   const target=targets[law.id]?.[address];if(!target||!normalize(target[0]).endsWith('條'))continue;
   const p=numeric(paragraph),i=numeric(item),s=numeric(subitem),rows=target[1];let unit='',fallback=!!(p||i||s);
   // No inferred paragraph when it was not written. Fall back to the whole article.
   if(p&&rows&&p<=rows.length&&(!i||i<=rows[p-1].length)&&(!s||(i&&s<=rows[p-1][i-1]))){
    unit=law.id+'/a:'+address+'/p:'+p+(i?'/i:'+i:'')+(s?'/s:'+s:'');fallback=false;
   }
   const prefix=/^(依照|按照|準用|適用|依|按)$/.test(name)?name.length:0;
   found.push({start:match.index+prefix,end:match.index+written.length,law,article:target[0],unit,fallback});
  }
  return found;
 };
}
export function makeCitationTargets(laws:Law[]):CitationTargets{
 return Object.fromEntries(laws.map(law=>[law.id,Object.fromEntries(law.articles.map(article=>{
  const units=article.structure?.status==='parsed'?article.structure.units:null;
  return [articleAddress(article.no),units?[article.no,units.map(p=>p.children.map(i=>i.children.length))]:[article.no]];
 }))]));
}
