import {chineseNumber,normalize} from './search.ts';
import {articleAddress} from './routes.ts';
import type {Article,Law} from './law-types.ts';
export type CitationTargets=Record<string,Record<string,[no:string,units?:number[][]]>>;
export type CitationTarget={article:string;unit:string;fallback:boolean};
export type CitationBasis={law:string;sourceLaw:string;sourceArticle:string;kind:'alias'|'basis'};
export type CitationContext=Record<string,Record<string,CitationBasis[]>>;
export type LegalReference=CitationTarget&{start:number;end:number;law:Law;articleTargets?:CitationTarget[];resolution?:'named'|'self'|'alias'|'basis'|'paragraph'|'source';basis?:CitationBasis};
const escape=(s:string)=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const num='[0-9０-９一二三四五六七八九十百千零〇○兩]+';
const gap='[ \\t\\u3000]*';
const atom=`(${num})(?:${gap}[-－之]${gap}(${num}))?${gap}(條|點)(?:${gap}之${gap}(${num}))?`;
const subpart=`(?:${gap}第${gap}${num}${gap}[項款目](?:${gap}(?:至|及|與|、|和|或)${gap}(?:第${gap})?${num}${gap}[項款目])*)*`;
const numeric=(s?:string)=>s?Number(chineseNumber(s.normalize('NFKC').replace(/○/g,'〇'))):0;
const suffixes='自治條例|自治規則|條例|規則|辦法|細則|準則|要點|基準|注意事項|標準|通則|規程|規範|編|法';
const kindOf=(name:string)=>name.match(new RegExp(`(${suffixes})$`))?.[1]||'';
const cleanName=(name:string)=>normalize(name).replace(/\([0-9.年月日]+(?:訂定|修正)\)$/,'');
const own=(token:string,law?:Law)=>!!law&&(token==='本法'?law.kind==='法律':token==='本編'?law.name.endsWith('編'):token==='本規則'&&/規則.+編$/.test(law.name)?true:cleanName(law.name).endsWith(token.slice(1)));
const boundary=(before:string)=>!/[\p{Script=Han}]$/u.test(before)||/(?:依據|依照|按照|準用|適用|違反|符合|依|按|及|與|或|暨|查|如|同|係|為|受|援引|引用|參照|參酌|所稱|所定)$/.test(before);
const shortNames:Record<string,string>={建築設計施工編:'建築技術規則建築設計施工編',建築構造編:'建築技術規則建築構造編',建築設備編:'建築技術規則建築設備編',刑法:'中華民國刑法',憲法:'中華民國憲法'};
function registry(laws:Law[]){
 const byName=new Map<string,Law[]>();
 const add=(name:string,law:Law)=>{const key=normalize(name),items=byName.get(key)||[];if(!items.some(item=>item.id===law.id))byName.set(key,[...items,law]);};
 for(const law of laws){add(law.name,law);add(cleanName(law.name),law);}
 for(const [short,full] of Object.entries(shortNames)){const items=byName.get(normalize(full));if(items?.length===1)add(short,items[0]);}
 const names=[...byName.keys()].sort((a,b)=>b.length-a.length).map(name=>escape(name).replace(/臺/g,'[臺台]'));
 return {byName,names};
}
function declared(scope:string,source:Law,article:string,byName:Map<string,Law[]>,names:string[]):Record<string,CitationBasis[]>{
 const result:Record<string,CitationBasis[]>={},recognized=new Set<number>();
 const add=(name:string,law:Law,kind:'alias'|'basis')=>{const row={law:law.id,sourceLaw:source.id,sourceArticle:article,kind};result[name]=[...(result[name]||[]),row];};
 const aliases=new RegExp(`(${names.join('|')})${gap}[（(]${gap}(?:以下)?(?:簡|合|逕)?稱(?:為)?${gap}([\\p{Script=Han}]{2,16})${gap}[）)]`,'gu');
 for(const m of scope.matchAll(aliases)){if(/合稱/.test(m[0]))continue;if(!boundary(scope.slice(0,m.index)))continue;const ls=byName.get(normalize(m[1]));if(ls?.length===1){add(m[2],ls[0],'alias');recognized.add(m.index!+m[0].length);}}
 for(const m of scope.matchAll(/[（(]\s*(?:以下)?(?:簡|合|逕)?稱(?:為)?\s*([\p{Script=Han}]{2,16})\s*[）)]/gu))if(!recognized.has(m.index!+m[0].length))result[m[1]]=[{law:'',sourceLaw:source.id,sourceArticle:article,kind:'alias'}];
 // Only the law's own opening enactment declaration creates an implicit parent.
 const basis=new RegExp(`^本(${suffixes})${gap}(?:依據|依照|依)${gap}(${names.join('|')})(?:[^。\\n]{0,90})規定(?:訂定|訂之|制定)`,'u').exec(scope);
 if(basis&&own('本'+basis[1],source)){const ls=byName.get(normalize(basis[2]));if(ls?.length===1&&ls[0].id!==source.id)add('本'+kindOf(cleanName(ls[0].name)),ls[0],'basis');}
 return result;
}
/** Compact, source-derived declarations. No extension-supplied pcode is trusted. */
export function makeCitationContext(laws:Law[]):CitationContext{
 const {byName,names}=registry(laws),result:CitationContext={};
 for(const law of laws){const first=law.articles[0];if(first){const scope=declared(first.text,law,first.no,byName,names);if(Object.keys(scope).length)result[law.id]=scope;}}
 // Volumes of the same named rules inherit only the explicit parent-law alias
 // in their general provisions, not arbitrary page-wide prior mentions.
 for(const general of laws.filter(l=>l.name.endsWith('規則總則編'))){
  const stem=general.name.slice(0,-3),parent=result[general.id]?.本法;if(!parent?.length)continue;
  for(const part of laws)if(part.id!==general.id&&part.name.startsWith(stem)&&part.name.endsWith('編'))result[part.id]={...result[part.id],本法:result[part.id]?.本法||parent};
 }
 return result;
}
const compareAddress=(a:string,b:string)=>{const x=a.split('-').map(Number),y=b.split('-').map(Number);return x[0]-y[0]||(x[1]||0)-(y[1]||0);};
function targetUnits(law:Law,address:string,row:[string,number[][]?],parts:string):CitationTarget[]{
 const base={article:row[0],unit:'',fallback:!!parts.trim()};if(!parts.trim())return [base];
 const rows=row[1];if(!rows)return [base];
 const tokens=[...parts.matchAll(new RegExp(`(?:第${gap})?(${num})${gap}([項款目])`,'g'))];
 let p=0,i=0,s=0,previous=0,priorEnd=0;const out:CitationTarget[]=[];
 const level=(unit:string)=>unit==='項'?1:unit==='款'?2:3;
 const emit=()=>{const pp=p||((i||s)&&rows.length===1?1:0);if(!pp||pp>rows.length||i>rows[pp-1].length||(s&&(!i||s>rows[pp-1][i-1])))return false;out.push({article:row[0],unit:law.id+'/a:'+address+'/p:'+pp+(i?'/i:'+i:'')+(s?'/s:'+s:''),fallback:false});return true;};
 for(let n=0;n<tokens.length;n++){
  const t=tokens[n],lev=level(t[2]),value=numeric(t[1]),connector=parts.slice(priorEnd,t.index);
  if(!value)return [base];
  if(lev<=previous){
   if(!emit())return [base];
   if(connector.includes('至')){
    if(lev!==previous||(tokens[n+1]&&level(tokens[n+1][2])>lev))return [base];
    const from=lev===1?p:lev===2?i:s,pp=p||(rows.length===1?1:0);
    const length=lev===1?rows.length:lev===2?(rows[pp-1]?.length||0):(rows[pp-1]?.[i-1]||0);
    if(value<from||value>length||value-from>20)return [base];
    for(const verified of Array.from({length},(_,k)=>k+1).filter(k=>k>from&&k<value)){if(lev===1){p=verified;i=0;s=0;}else if(lev===2){i=verified;s=0;}else s=verified;if(!emit())return [base];}
   }
  }
  if(lev===1){p=value;i=0;s=0;}else if(lev===2){i=value;s=0;}else s=value;
  previous=lev;priorEnd=t.index!+t[0].length;
 }
 if(!tokens.length||!emit()||out.length>20)return [base];
 return [...new Map(out.map(t=>[t.unit,t])).values()];
}
export function createCitationMatcher(laws:Law[],targets:CitationTargets,context:CitationContext=makeCitationContext(laws)){
 const {byName,names}=registry(laws),byId=new Map(laws.map(l=>[l.id,l]));
 const scopeCache=new WeakMap<Law,Record<string,CitationBasis[]>>();
 const order=new Map<string,string[]>();for(const [id,rows] of Object.entries(targets))order.set(id,Object.keys(rows).filter(key=>/^\d+(?:-\d+)?$/.test(key)).sort(compareAddress));
 return function findReferences(text:string,currentLaw?:Law,currentArticle?:Article):LegalReference[]{
  let global=currentLaw?scopeCache.get(currentLaw):undefined;
  if(!global&&currentLaw){const first=currentLaw.articles[0];global={...context[currentLaw.id],...(first?declared(first.text,currentLaw,first.no,byName,names):{})};scopeCache.set(currentLaw,global);}
  global=global||{};
  const aliasNames=[...new Set([...Object.keys(global),...Object.keys(declared(text,currentLaw||{id:'',name:'',kind:''} as Law,currentArticle?.no||'',byName,names))])];
  const prefix=new RegExp(`(${[...names,...aliasNames.map(escape),`[本同該此](?:${suffixes})`].join('|')})[」』】》〉）)”"']?${gap}$`,'u');
  const declaredPrefix=new RegExp(`(${names.join('|')})${gap}[（(]${gap}(?:以下)?(?:簡|合|逕)?稱(?:為)?${gap}[\\p{Script=Han}]{2,16}${gap}[）)]${gap}$`,'u');
  const scan=new RegExp(`第${gap}${atom}(${subpart})`,'gu');
  const next=new RegExp(`^${gap}(至|及|與|、|和|或)${gap}(?:第${gap})?${atom}(${subpart})`,'u');
  const found:LegalReference[]=[];let consumed=0,paragraphKey='',named:Law[]=[],unknown=false;
  const paragraphStart=(at:number)=>{const p=currentArticle?.structure?.units.find(u=>at>=u.start&&at<u.end);return p?p.start:text.lastIndexOf('\n',at-1)+1;};
  for(const m of text.matchAll(scan)){
   if(m.index!<consumed)continue;
   const start=m.index!,para=paragraphStart(start),key=String(para);if(key!==paragraphKey){paragraphKey=key;named=[];unknown=false;}
   const before=text.slice(para,start),pm=declaredPrefix.exec(before)||prefix.exec(before);let law:Law|undefined,resolution:LegalReference['resolution'],basis:CitationBasis|undefined,begin=start;
   if(pm){
    if(/合稱/.test(pm[0])){unknown=true;continue;}
    const token=pm[1];begin=para+pm.index!;
    if(!boundary(before.slice(0,pm.index))){unknown=true;continue;}
    const local=declared(before,currentLaw||{id:'',name:'',kind:''} as Law,currentArticle?.no||'',byName,names),choices=local[token]||global[token];
    if(choices){const ids=[...new Set(choices.map(c=>c.law))];if(ids.length===1){law=byId.get(ids[0]);basis=choices[0];resolution=basis.kind;if(own(token,currentLaw)&&law?.id!==currentLaw?.id)law=undefined;}}
    else if(token.startsWith('本')){if(own(token,currentLaw)){law=currentLaw;resolution='self';}}
    else if(/^[同該此]/.test(token)){const wanted=token.slice(1),matches=named.filter(l=>kindOf(cleanName(l.name))===wanted);law=matches.at(-1);resolution='paragraph';}
    else{const options=byName.get(normalize(token));if(options?.length===1){law=options[0];resolution='named';}}
    if(!law){unknown=true;continue;}
   }else{
    // Unknown named laws must never fall through to a bare source-law target.
    if(new RegExp(`(?:${suffixes})[」』】》〉）)”"']?${gap}$`).test(before)){unknown=true;continue;}
    if(unknown)continue;
    const distinct=[...new Map(named.map(l=>[l.id,l])).values()];
    if(!distinct.length&&new RegExp(`(?:${suffixes})`).test(before)){unknown=true;continue;}
    if(distinct.length===1){law=distinct[0];resolution='paragraph';}
    else if(!distinct.length&&currentLaw&&(currentArticle||/(?:依據|依照|按照|準用|適用|依|按)$/.test(before))){law=currentLaw;resolution='source';}
    else continue;
   }
   const [,base,beforeNo,unit,afterNo,parts]=m;if(beforeNo&&afterNo)continue;
   const address=String(numeric(base))+(beforeNo||afterNo?'-'+numeric(beforeNo||afterNo):'');
   const row=targets[law.id]?.[address];if(!row||!normalize(row[0]).endsWith(unit))continue;
   const units=targetUnits(law,address,row,parts),first:LegalReference={start:begin,end:start+m[0].length,law,...units[0],resolution,basis};
   const pieces:LegalReference[]=[first],allTargets=[...units];let cursor=first.end,lastAddress=address,range=false,rejectRange=false;
   for(;;){
    const tail=next.exec(text.slice(cursor));if(!tail)break;
    const [,conj,b,pre,u,post,sub]=tail;if(pre&&post||u!==unit)break;
    const addr=String(numeric(b))+(pre||post?'-'+numeric(pre||post):''),dest=targets[law.id]?.[addr];if(!dest||!normalize(dest[0]).endsWith(u))break;
    const subtargets=targetUnits(law,addr,dest,sub);let additions=subtargets;
    if(conj==='至'){
     const list=order.get(law.id)||[],from=list.indexOf(lastAddress),to=list.indexOf(addr);
     if(from<0||to<from||to-from>20||parts.trim()||sub.trim()){rejectRange=true;cursor+=tail[0].length;break;}
     additions=list.slice(from+1,to+1).map(key=>({article:targets[law!.id][key][0],unit:'',fallback:false}));range=true;
    }
    if(allTargets.length+additions.length>20){if(conj==='至'){rejectRange=true;cursor+=tail[0].length;}break;}
    const tailBegin=cursor+tail[0].indexOf(conj)+conj.length;cursor+=tail[0].length;
    pieces.push({start:tailBegin,end:cursor,law,...subtargets[0],resolution,basis});allTargets.push(...additions);lastAddress=addr;
   }
   if(rejectRange){consumed=cursor;if(resolution!=='source')named.push(law);continue;}
   const distinctTargets=[...new Map(allTargets.map(t=>[t.article+'|'+t.unit,t])).values()];
   if(range){first.end=cursor;first.articleTargets=distinctTargets;found.push(first);}
   else{for(const piece of pieces){if(distinctTargets.length>1)piece.articleTargets=distinctTargets;found.push(piece);}}
   consumed=cursor;if(resolution!=='source')named.push(law);
  }
  if(currentLaw&&currentArticle){const address=articleAddress(currentArticle.no),row=targets[currentLaw.id]?.[address];if(row){
   const same=new RegExp(`本(條|點)(?![例文約])(${subpart})`,'gu');for(const m of text.matchAll(same)){
    if(!boundary(text.slice(paragraphStart(m.index!),m.index))||!normalize(row[0]).endsWith(m[1])||found.some(r=>m.index!<r.end&&m.index!+m[0].length>r.start))continue;
    const units=targetUnits(currentLaw,address,row,m[2]);found.push({start:m.index!,end:m.index!+m[0].length,law:currentLaw,...units[0],...(units.length>1?{articleTargets:units}:{}),resolution:'self'});
   }
  }}
  const out:LegalReference[]=[];for(const ref of found.sort((a,b)=>a.start-b.start))if(!out.length||ref.start>=out.at(-1)!.end)out.push(ref);return out;
 };
}
export function makeCitationTargets(laws:Law[]):CitationTargets{
 return Object.fromEntries(laws.map(law=>[law.id,Object.fromEntries(law.articles.map(article=>{
  const units=article.structure?.status==='parsed'?article.structure.units:null;
  return [articleAddress(article.no),units?[article.no,units.map(p=>p.children.map(i=>i.children.length))]:[article.no]];
 }))]));
}
