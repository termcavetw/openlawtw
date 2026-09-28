import guides from '../data/search-guides.json' with {type:'json'};
import {normalize} from './search.ts';
export function searchGuides(query:string){
 const q=normalize(query);
 return guides.filter(g=>g.all.every(group=>group.some(word=>q.includes(normalize(word)))));
}
export function queryRegion(query:string,regions:string[]){const q=normalize(query);const full=regions.filter(r=>q.includes(normalize(r)));if(full.length===1)return full[0];const short=regions.filter(r=>q.includes(normalize(r.replace(/[縣市]$/,''))));return short.length===1?short[0]:null;}
