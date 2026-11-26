import {useEffect,useState} from 'react';
import type {DataFile} from './law-types';
import {loadFile} from './data-client';

// Warnings on other sources' letters, from each refs file (prepare-data):
// stale[letterId] = [[lawId, articleKey, amendedOn (ISO), lawName], ...] — dated before an article it discusses was amended;
// revoked[letterId] = [byId, byDate (ISO), byIssuerAndDocNo, partial 0|1] — a later letter declared it 停止適用.
export type StaleEntry=[string,string,string,string];
export type Stale=Record<string,StaleEntry[]>;
export type Revoked=Record<string,[string,string,string,number]>;
export type Flags={stale:Stale;revoked:Revoked};

const cache=new Map<string,Promise<Flags>>();
export function loadFlags(file:DataFile):Promise<Flags>{
 let p=cache.get(file.url);
 if(!p){p=loadFile<{stale?:Stale;revoked?:Revoked}>(file).then(r=>({stale:r.stale||{},revoked:r.revoked||{}}));cache.set(file.url,p);p.catch(()=>cache.delete(file.url));}
 return p;
}
export function useFlags(file:DataFile|undefined):Flags|null{
 const [flags,setFlags]=useState<Flags|null>(null);
 useEffect(()=>{if(!file)return;let live=true;loadFlags(file).then(s=>{if(live)setFlags(s);},()=>{});return()=>{live=false;};},[file]);
 return flags;
}
export const roc=(iso:string)=>{const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);return m?`${Number(m[1])-1911}.${m[2]}.${m[3]}`:iso;};
const article=(key:string)=>key.replace(/^第?\s*/,'第 ').replace(/\s*條$/,' 條');
export const staleLine=([,no,date,name]:StaleEntry,withLaw=true)=>`${withLaw?name:'本條'}${withLaw?article(no):''}於 ${roc(date)} 修正，晚於本函釋`;
export const revokedLine=([,date,doc,partial]:Revoked[string])=>`${partial?'部分內容':'本函釋'}已由 ${doc}（${roc(date)}）停止適用`;
