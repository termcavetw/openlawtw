import {type Flags,revokedLine,roc,staleLine} from '@/lib/stale';
// ⚠ for letters dated before an article they discuss was last amended, ⛔ for letters a later one declared 停止適用 (lib/stale.ts).
export function StaleBadge({id,flags}:{id:string|number;flags?:Flags|null}){
 const revoked=flags?.revoked[id],stale=flags?.stale[id]?.length;
 return <>{revoked&&<span className="ruling-revoked" title={revokedLine(revoked)}>⛔ {revoked[3]?'部分停止適用':'已停止適用'}</span>}{!!stale&&<span className="ruling-stale" title="所涉條文在本函釋後修正">⚠ 早於條文修正</span>}</>;
}
export function StaleList({id,date,flags,onOpen}:{id:string|number;date:string;flags?:Flags|null;onOpen?:(id:string)=>void}){
 const old=flags?.stale[id]||[],revoked=flags?.revoked[id];if(!old.length&&!revoked)return null;
 return <>{revoked&&<div className="stale-list revoked" role="note"><strong>⛔ {revokedLine(revoked)}</strong><span>依後來函釋的文字自動判斷，引用前請開原文確認{revoked[3]?'哪些部分不再適用':''}。</span>{onOpen&&<button className="plain-link" onClick={()=>onOpen(revoked[0])}>開啟停止適用的函釋 →</button>}</div>}
 {old.length>0&&<div className="stale-list" role="note"><strong>⚠ 這則函釋（{roc(date)}）早於所涉條文的修正，引用前請對照現行條文：</strong>{old.map(s=><span key={s[0]+s[1]}>{staleLine(s)}</span>)}</div>}</>;
}
