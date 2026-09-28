import type {Law,Ruling} from './law-types.ts';

// Lookup normalization only. Official text and displayed article labels stay intact.
export function chineseNumber(value:string):string {
 if(/^\d+$/.test(value))return value;
 const digits:Record<string,number>={零:0,〇:0,一:1,二:2,兩:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9};
 const units:Record<string,number>={十:10,百:100,千:1000};
 if(!/[十百千]/.test(value))return [...value].map(c=>digits[c]??c).join('');
 let sum=0,current=0;
 for(const c of value){if(c in digits)current=digits[c];else if(c in units){sum+=(current||1)*units[c];current=0;}else return value;}
 return String(sum+current);
}
export function normalize(s:string):string {
 return s.normalize('NFKC').toLowerCase().replace(/台/g,'臺').replace(/ㄧ/g,'一').replace(/条/g,'條').replace(/装/g,'裝').replace(/号/g,'號').replace(/[‐‑–—－]/g,'-').replace(/\s+/g,'')
  .replace(/^([\d一二三四五六七八九十百千零〇兩]+)條$/, '第$1條')
  .replace(/第([\d一二三四五六七八九十百千零〇兩]+)之([\d一二三四五六七八九十百千零〇兩]+)點/g,(_,a,b)=>`第${chineseNumber(a)}-${chineseNumber(b)}點`)
  .replace(/第([\d一二三四五六七八九十百千零〇兩]+)(?:條之|之)([\d一二三四五六七八九十百千零〇兩]+)條?/g,(_,a,b)=>`第${chineseNumber(a)}-${chineseNumber(b)}條`)
  .replace(/第([一二三四五六七八九十百千零〇兩]+)([條項款點])/g,(_,a,b)=>`第${chineseNumber(a)}${b}`);
}

// Explicit aliases, never spelling guesses or legal-text substitutions.
import aliasData from '../data/aliases.json' with {type:'json'};
const aliases:Record<string,string>=aliasData;
import vocabulary from '../data/search-vocabulary.json' with {type:'json'};
const vocab=[...new Set([...vocabulary,...Object.keys(aliases)].map(normalize))].sort((a,b)=>b.length-a.length);
const canonical=(s:string)=>aliases[s]||s;
function pieces(term:string):string[]{
 const found:string[]=[];let rest=term;
 while(rest){const word=vocab.find(v=>rest.startsWith(v));if(!word)return [];found.push(canonical(word));rest=rest.slice(word.length);}
 return found.length>1?found:[];
}
type Term={literal:string;value:string;parts:string[]};
const compile=(terms:string[]):Term[]=>terms.map(t=>({literal:t,value:canonical(t),parts:pieces(t)}));
// Highlight the same explicit vocabulary as retrieval, preserving displayed source text.
export function highlightTerms(query:string):string[]{
 return [...new Set(compile(parseQuery(query).terms).flatMap(t=>[t.literal,t.value,...t.parts]))].filter(Boolean).sort((a,b)=>b.length-a.length);
}
function matchTerm(t:Term,fields:string[]):number {
 if(fields.some(f=>f.includes(t.literal)||f.includes(t.value)))return 2;
 return t.parts.length&&t.parts.every(p=>fields.some(f=>f.includes(p)))?1:0;
}
const matches=(terms:Term[],fields:string[])=>terms.every(t=>matchTerm(t,fields)>0);

export function parseQuery(value:string){
 let q=value.normalize('NFKC').replace(/条/g,'條').replace(/ㄧ/g,'一').replace(/[‐‑–—－]/g,'-').trim();
 const n='[0-9一二三四五六七八九十百千零〇兩]+';
 q=q.replace(new RegExp('('+n+')\\s*條之\\s*('+n+')','g'),'$1之$2條');
 const explicit=new RegExp('第\\s*('+n+')(?:\\s*(?:之|-)\\s*('+n+'))?\\s*條(?:\\s*之\\s*('+n+'))?');
 let m=q.match(explicit)||q.match(/§\s*(\d{1,4})(?:-(\d+))?/),article='';
 if(!m){
  const suffix=new RegExp('('+n+')(?:\\s*(?:之|-)\\s*('+n+'))?\\s*(條)?$');
  const candidate=q.match(suffix);
  if(candidate){const prefix=q.slice(0,candidate.index);const base=chineseNumber(candidate[1]);
   if(base.length<=4&&(!prefix||/\s$/.test(prefix)||candidate[3]||/(?:法|條例|辦法|規則|編|建技|室裝|室装|變使|公安|危老|都更)$/.test(prefix))&&!/[.\d-]$/.test(prefix)){
    if(/\d/.test(candidate[1])||candidate[2]||candidate[3])m=candidate;
   }
  }
 }
 if(m){const sub=m[3]&&m[3]!=='條'?m[3]:m[2];article=`第${chineseNumber(m[1])}${sub?'-'+chineseNumber(sub):''}條`;q=q.slice(0,m.index)+' '+q.slice((m.index||0)+m[0].length);}
 return {terms:q.split(/[\s,，、;；]+/).filter(Boolean).map(normalize),article};
}

export type SearchDoc={id:string;articles:{no:string;text:string}[]};
export type SearchHit={law:Law;article?:string;excerpt?:string;score:number;type:'laws'|'articles';match?:'phrase'|'keywords'};
export type ResultType='all'|'laws'|'articles'|'rulings';
const normalizedText=new WeakMap<object,string>();
function bodyOf(a:{text:string}){let text=normalizedText.get(a);if(text===undefined){text=normalize(a.text);normalizedText.set(a,text);}return text;}
const corpusMaps=new WeakMap<SearchDoc[],Map<string,SearchDoc['articles']>>();
function corpusMap(corpus:SearchDoc[]){let map=corpusMaps.get(corpus);if(!map){map=new Map(corpus.map(d=>[d.id,d.articles]));corpusMaps.set(corpus,map);}return map;}
const headings=new WeakMap<Law,string[]>();
function lawFields(law:Law){let fields=headings.get(law);if(!fields){fields=[normalize(law.name),normalize(law.region),...law.keywords.map(normalize)];headings.set(law,fields);}return fields;}
function namedTerm(t:Term){return !!aliases[t.literal]||/(法|條例|辦法|規則|編)$/.test(t.value);}
function excerptOf(text:string,terms:Term[]){
 const words=terms.flatMap(t=>[t.literal,t.value,...t.parts]);
 const at=words.map(t=>text.indexOf(t)).filter(i=>i>=0);const start=Math.max(0,(at.length?Math.min(...at):0)-25);
 return (start?'…':'')+text.slice(start,start+150)+(text.length>start+150?'…':'');
}
export function searchLaws(laws:Law[],corpus:SearchDoc[],query:string,articleMode=false):SearchHit[]{
 if(!query.trim())return [];
 const parsed=parseQuery(query),terms=compile(parsed.terms),article=parsed.article,index=corpusMap(corpus),results:SearchHit[]=[];
 const named=article?terms.filter(t=>namedTerm(t)&&laws.some(l=>matchTerm(t,[normalize(l.name)]))):[];
 for(const law of laws){
  const fields=lawFields(law),name=fields[0];
  if(named.some(t=>!matchTerm(t,[name])))continue;
  const titleMatch=matches(terms,fields);
  // Category membership is a filter, never a spurious title match.
  if(titleMatch&&!article&&!articleMode){
   const exact=terms.length===1&&(terms[0].value===name||terms[0].literal===name);
   results.push({law,type:'laws',score:exact?600:terms.some(t=>matchTerm(t,[name])===2)?400:240});continue;
  }
  for(const a of index.get(law.id)||law.articles){
   if(article&&normalize(a.no)!==article)continue;
   const body=bodyOf(a),all=[...fields,body];if(!matches(terms,all))continue;
   const phrase=terms.every(t=>matchTerm(t,all)===2);
   const bodyTerms=terms.filter(t=>matchTerm(t,[body])>0).length;
   const focus=bodyTerms?Math.min(35,1500/Math.sqrt(Math.max(1,body.length))):0;
   results.push({law,article:a.no,excerpt:excerptOf(a.text,terms),type:'articles',match:phrase?'phrase':'keywords',score:(article?350:100)+(named.length?170:0)+(titleMatch?35:0)+(phrase?50:0)+focus+(law.region==='中央'?3:0)});
  }
 }
 return results.sort((a,b)=>b.score-a.score);
}
export function matchesArticle(a:{no:string;text:string},query:string):boolean {
 if(!query.trim())return true;const {terms,article}=parseQuery(query);
 return (!article||normalize(a.no)===article)&&matches(compile(terms),[normalize(a.no),bodyOf(a)]);
}

const rulingText=new WeakMap<Ruling,{fields:string[];title:string;number:string}>();
export function searchRulings(rulings:Ruling[],query:string):Ruling[]{
 if(!query.trim())return [];
 const {terms:raw,article}=parseQuery(query),terms=compile(raw),named=terms.filter(namedTerm),needle=normalize(query);
 const found:{r:Ruling;score:number}[]=[];
 for(const r of rulings){
  let entry=rulingText.get(r);if(!entry){const title=normalize(r.title),number=normalize(r.number);entry={title,number,fields:[number,r.numberKey,title,normalize(r.body),normalize(r.topic),normalize(r.unit)]};rulingText.set(r,entry);}
  if(!matches(terms,entry.fields))continue;
  if(article&&!r.refs.some(ref=>normalize(ref.article)===article&&named.every(t=>matchTerm(t,[normalize(ref.evidence)])>0)))continue;
  const exactNumber=r.numberKey===needle||entry.number===needle;
  found.push({r,score:(exactNumber?1000:entry.number.includes(needle)?500:0)+(terms.length&&matches(terms,[entry.title])?100:0)+(terms.every(t=>matchTerm(t,entry!.fields)===2)?20:0)});
 }
 return found.sort((a,b)=>b.score-a.score).map(x=>x.r);
}

// Each term is OR between literal, alias, and an AND of curated segmented parts.
export function candidateTerms(query:string):string[][][]{return compile(parseQuery(query).terms).map(t=>[[t.literal],[t.value],...(t.parts.length?[t.parts]:[])]);}
