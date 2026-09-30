import {chineseNumber,normalize} from './search.ts';
import {articleAddress} from './routes.ts';
import type {Article,Law} from './law-types.ts';
// The compact rows contain only verified sequential paragraph/item/subitem counts.
export type CitationTargets=Record<string,Record<string,[no:string,units?:number[][]]>>;
export type LegalReference={start:number;end:number;law:Law;article:string;unit:string;fallback:boolean};
const escape=(s:string)=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const num='[0-9０-９一二三四五六七八九十百千零〇兩]+';
const articlePattern=`第\\s*(${num})(?:\\s*[-－之]\\s*(${num}))?\\s*條(?:\\s*之\\s*(${num}))?`;
const suffix=`(?:\\s*第\\s*(${num})\\s*項)?(?:\\s*第\\s*(${num})\\s*款)?(?:\\s*第\\s*(${num})\\s*目)?`;
const numeric=(s?:string)=>s?Number(chineseNumber(s.normalize('NFKC'))):0;
const selfPattern='本自治條例|本自治規則|本條例|本規則|本辦法|本細則|本準則|本要點|本編|本法';
const selfMatches=(token:string,law?:Law)=>!!law&&(token==='本法'?law.kind==='法律':token==='本編'?law.name.endsWith('編'):law.name.replace(/（[^）]*）$/,'').endsWith(token.slice(1)));
export function createCitationMatcher(laws:Law[],targets:CitationTargets){
 const byName=new Map<string,Law[]>();
 for(const law of laws){const key=normalize(law.name);byName.set(key,[...(byName.get(key)||[]),law]);}
 const names=[...byName.keys()].sort((a,b)=>b.length-a.length).map(name=>escape(name).replace(/臺/g,'[臺台]'));
 const pattern=new RegExp(`(${names.join('|')}|${selfPattern}|依照|按照|準用|適用|依|按)[」』]?\\s*${articlePattern}${suffix}`,'g');
 const aliasPattern=new RegExp(`(${names.join('|')})[（(]以下(?:簡稱|稱)([^）)\\n]{1,20})[）)]`,'g');
 const scopeCache=new WeakMap<Law,{aliases:Map<string,Law[]>;contextualPattern:RegExp}>();
 function context(scope:string){
  const aliases=new Map<string,Law[]>();
  for(const declaration of scope.matchAll(aliasPattern)){
   const before=scope.slice(0,declaration.index);if(/[\p{Script=Han}]$/u.test(before)&&!/(?:依據|依照|按照|準用|適用|違反|符合|依|按|及|與|或|暨|查|如|同|係|為|援引|引用)$/.test(before))continue;
   const choices=byName.get(normalize(declaration[1]));if(choices?.length!==1)continue;
   const key=declaration[2];aliases.set(key,[...(aliases.get(key)||[]),choices[0]]);
  }
  const aliasNames=[...aliases.keys()].filter(key=>new Set(aliases.get(key)!.map(l=>l.id)).size===1);
  const contextualPattern=aliasNames.length?new RegExp(`(${names.join('|')}|${aliasNames.map(escape).join('|')}|${selfPattern}|依照|按照|準用|適用|依|按)[」』]?\\s*${articlePattern}${suffix}`,'g'):pattern;
  return {aliases,contextualPattern};
 }
 return function findReferences(text:string,currentLaw?:Law,currentArticle?:Article):LegalReference[]{
  const found:LegalReference[]=[];
  // An abbreviation must be explicitly declared in this law or ruling.
  let scoped=currentLaw?scopeCache.get(currentLaw):undefined;
  if(!scoped){scoped=context(currentLaw?.articles.length?currentLaw.articles.map(a=>a.text).join('\n'):text);if(currentLaw?.articles.length)scopeCache.set(currentLaw,scoped);}
  const {aliases,contextualPattern}=scoped;
  for(const match of text.matchAll(contextualPattern)){
   const [written,name,base,before,after,paragraph,item,subitem]=match;
   let law:Law|undefined;
   if(name.startsWith('本')&&/[\p{Script=Han}]$/u.test(text.slice(0,match.index))&&!/(?:依據|依照|按照|準用|適用|違反|符合|依|按|及|與|或|暨|如|係|為|受|援引|引用)$/.test(text.slice(0,match.index)))continue;
   if(aliases.has(name)){
    const choices=aliases.get(name)!;if(new Set(choices.map(l=>l.id)).size===1)law=choices[0];
    if(selfMatches(name,currentLaw)&&law?.id!==currentLaw?.id)law=undefined;
   }else if(name.startsWith('本'))law=selfMatches(name,currentLaw)?currentLaw:undefined;
   else if(/^(依照|按照|準用|適用|依|按)$/.test(name)){
    // A bare article is safe only in its own law and without another legal title
    // in the same clause. Rulings never infer a law from the currently open panel.
    const preceding=text.slice(0,match.index).split(/[。；;\n]/).at(-1)||'';
    if(!/(法|條例|規則|辦法|細則|準則|要點|規定)/.test(preceding))law=currentLaw;
   }else{
    const preceding=text.slice(0,match.index);
    // Do not recognize a known title as the suffix of an unknown longer title.
    if(/[\p{Script=Han}]$/u.test(preceding)&&!/(?:依據|依照|按照|準用|適用|違反|符合|依|按|及|與|或|暨|查|如|同|係|為|援引|引用)$/.test(preceding))continue;
    const options=byName.get(normalize(name));if(options?.length===1)law=options[0];
   }
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
   let cursor=match.index+written.length;
   const continuation=new RegExp(`^[、及與]\\s*${articlePattern}${suffix}`);
   for(;;){
    const next=continuation.exec(text.slice(cursor));if(!next)break;
    const [,n,b,a,np,ni,ns]=next;if(b&&a)break;
    const key=String(numeric(n))+(b||a?'-'+numeric(b||a):'');
    const dest=targets[law.id]?.[key];if(!dest||!normalize(dest[0]).endsWith('條'))break;
    const pp=numeric(np),ii=numeric(ni),ss=numeric(ns),rr=dest[1];let nextUnit='',nextFallback=!!(pp||ii||ss);
    if(pp&&rr&&pp<=rr.length&&(!ii||ii<=rr[pp-1].length)&&(!ss||(ii&&ss<=rr[pp-1][ii-1]))){nextUnit=law.id+'/a:'+key+'/p:'+pp+(ii?'/i:'+ii:'')+(ss?'/s:'+ss:'');nextFallback=false;}
    const begin=cursor+next[0].indexOf('第');cursor+=next[0].length;
    found.push({start:begin,end:cursor,law,article:dest[0],unit:nextUnit,fallback:nextFallback});
   }
  }
  if(currentLaw&&currentArticle){
   const address=articleAddress(currentArticle.no),target=targets[currentLaw.id]?.[address];
   if(target){const same=new RegExp(`本條(?![例文約])${suffix}`,'g');for(const m of text.matchAll(same)){
    if(found.some(r=>m.index!<r.end&&m.index!+m[0].length>r.start))continue;
    const [,paragraph,item,subitem]=m,p=numeric(paragraph),i=numeric(item),s=numeric(subitem),rows=target[1];let unit='',fallback=!!(p||i||s);
    if(p&&rows&&p<=rows.length&&(!i||i<=rows[p-1].length)&&(!s||(i&&s<=rows[p-1][i-1]))){unit=currentLaw.id+'/a:'+address+'/p:'+p+(i?'/i:'+i:'')+(s?'/s:'+s:'');fallback=false;}
    found.push({start:m.index!,end:m.index!+m[0].length,law:currentLaw,article:target[0],unit,fallback});
   }}
  }
  return found.sort((a,b)=>a.start-b.start).filter((ref,i,all)=>i===0||ref.start>=all[i-1].end);
 };
}
export function makeCitationTargets(laws:Law[]):CitationTargets{
 return Object.fromEntries(laws.map(law=>[law.id,Object.fromEntries(law.articles.map(article=>{
  const units=article.structure?.status==='parsed'?article.structure.units:null;
  return [articleAddress(article.no),units?[article.no,units.map(p=>p.children.map(i=>i.children.length))]:[article.no]];
 }))]));
}
