import {useEffect,useState} from 'react';
import type {DataFile} from './law-types';
import {loadFile} from './data-client';

// Letters dated before an article they discuss was last amended (prepare-data, from each law's history):
// stale[letterId] = [[lawId, articleKey, amendedOn (ISO), lawName], ...].
export type StaleEntry=[string,string,string,string];
export type Stale=Record<string,StaleEntry[]>;

const cache=new Map<string,Promise<Stale>>();
export function loadStale(file:DataFile):Promise<Stale>{
 let p=cache.get(file.url);
 if(!p){p=loadFile<{stale?:Stale}>(file).then(r=>r.stale||{});cache.set(file.url,p);p.catch(()=>cache.delete(file.url));}
 return p;
}
export function useStale(file:DataFile|undefined):Stale|null{
 const [stale,setStale]=useState<Stale|null>(null);
 useEffect(()=>{if(!file)return;let live=true;loadStale(file).then(s=>{if(live)setStale(s);},()=>{});return()=>{live=false;};},[file]);
 return stale;
}
const roc=(iso:string)=>{const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);return m?`${Number(m[1])-1911}.${m[2]}.${m[3]}`:iso;};
const article=(key:string)=>key.replace(/^第?\s*/,'第 ').replace(/\s*條$/,' 條');
export const staleLine=([,no,date,name]:StaleEntry,withLaw=true)=>`${withLaw?name:'本條'}${withLaw?article(no):''}於 ${roc(date)} 修正，晚於本函釋`;
