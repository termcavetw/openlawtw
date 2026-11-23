// Search over the Taoyuan minutes archive. Small and dependency-free so the main search can use it
// without pulling the 會議 reader into the initial shell.
import type {MinutesItem,MinutesPage} from './law-types.ts';
export const strip=(s:string)=>s.replace(/\s+/g,'');
export const keywords=(q:string)=>q.split(/\s+/).map(strip).filter(Boolean);
export type MinutesHit={item:MinutesItem;page:MinutesPage;score:number;spread:boolean};
export function searchMinutes(items:MinutesItem[],words:string[]):MinutesHit[]{
 const hits:MinutesHit[]=[];if(!words.length)return hits;
 for(const item of items){
  const per=item.pages.map(p=>{const t=strip(p.text);return words.map(w=>t.includes(w));});
  let best=-1,bestScore=0;
  per.forEach((f,i)=>{const score=f.filter(Boolean).length;if(score>bestScore){bestScore=score;best=i;}});
  if(bestScore===words.length)hits.push({item,page:item.pages[best],score:bestScore,spread:false});
  else if(words.every((_,j)=>per.some(f=>f[j])))hits.push({item,page:item.pages[best],score:0,spread:true});
 }
 return hits.sort((a,b)=>b.score-a.score||b.item.sortDate.localeCompare(a.item.sortDate));
}
export function minutesSnippet(text:string,words:string[]){
 const t=text.replace(/\s+/g,' ').replace(/(?<=[一-鿿，。、；：（）「」]) (?=[一-鿿，。、；：（）「」])/g,'');
 let pos=-1;for(const w of words){const i=t.indexOf(w);if(i>=0&&(pos<0||i<pos))pos=i;}
 const a=Math.max(0,pos-30);
 return (a>0?'…':'')+t.slice(a,a+170).trim()+(a+170<t.length?'…':'');
}
export const minutesHash=(id:string,page=1)=>'#minutes='+encodeURIComponent(id)+(page>1?'&page='+page:'');
export function readMinutesHash(hash:string):{id:string;page:number}|null{
 const p=new URLSearchParams(hash.replace(/^#/,''));const id=p.get('minutes');if(!id)return null;
 const page=Number(p.get('page'));return {id,page:Number.isInteger(page)&&page>0?page:1};
}
