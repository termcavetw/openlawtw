import type {SearchHit} from './search.ts';
export type SearchGroup={law:SearchHit['law'];nameMatch:boolean;articles:SearchHit[]};
/** Preserve ranked law order and every unique article; supplementary hits never introduce new laws. */
export function groupSearchHits(hits:SearchHit[],supplementary:SearchHit[]=[]):SearchGroup[]{
 const groups=new Map<string,SearchGroup>();
 const seen=new Map<string,Set<string>>();
 function append(hit:SearchHit){const group=groups.get(hit.law.id);if(!group)return;if(hit.type==='laws')group.nameMatch=true;const key=hit.documentPage!==undefined?'document:'+hit.documentPage:hit.article;if(key&&!seen.get(hit.law.id)!.has(key)){group.articles.push(hit);seen.get(hit.law.id)!.add(key);}}
 for(const hit of hits){if(!groups.has(hit.law.id)){groups.set(hit.law.id,{law:hit.law,nameMatch:false,articles:[]});seen.set(hit.law.id,new Set());}append(hit);}
 for(const hit of supplementary)append(hit);
 return [...groups.values()];
}
