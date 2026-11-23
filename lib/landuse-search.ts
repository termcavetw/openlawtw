// Search over the Taoyuan 土管要點 archive. Small and dependency-free so the main search can use it
// without pulling the 土管 reader into the initial shell.
import type {LanduseItem,MinutesPage} from './law-types.ts';
import {strip} from './minutes-search.ts';
export type LanduseHit={item:LanduseItem;page:MinutesPage;score:number;spread:boolean};
export function searchLanduse(items:LanduseItem[],words:string[]):LanduseHit[]{
 const hits:LanduseHit[]=[];if(!words.length)return hits;
 for(const item of items){
  const head=strip(item.title+item.area);
  const per=item.pages.map(p=>{const t=strip(p.text);return words.map(w=>t.includes(w)||head.includes(w));});
  let best=-1,bestScore=0;
  per.forEach((f,i)=>{const score=f.filter(Boolean).length;if(score>bestScore){bestScore=score;best=i;}});
  if(bestScore===words.length)hits.push({item,page:item.pages[best],score:bestScore,spread:false});
  else if(words.every((_,j)=>per.some(f=>f[j])))hits.push({item,page:item.pages[best],score:0,spread:true});
 }
 return hits.sort((a,b)=>b.score-a.score||b.item.date.localeCompare(a.item.date)||b.item.id.localeCompare(a.item.id));
}
// 2026-03-13 -> 民國115年3月13日 (the city site's own date, only reformatted).
export const rocDate=(iso:string)=>{const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);return m?`民國${Number(m[1])-1911}年${Number(m[2])}月${Number(m[3])}日`:'';};
export const landuseHash=(id:string,page=1)=>'#landuse='+encodeURIComponent(id)+(page>1?'&page='+page:'');
export function readLanduseHash(hash:string):{id:string;page:number}|null{
 const p=new URLSearchParams(hash.replace(/^#/,''));const id=p.get('landuse');if(!id)return null;
 const page=Number(p.get('page'));return {id,page:Number.isInteger(page)&&page>0?page:1};
}
