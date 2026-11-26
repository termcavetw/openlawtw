import {type Stale,staleLine} from '@/lib/stale';
const rocDay=(iso:string)=>{const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);return m?`${Number(m[1])-1911}.${m[2]}.${m[3]}`:iso;};
// ⚠ for letters dated before an article they discuss was last amended (see lib/stale.ts).
export function StaleBadge({id,stale}:{id:string|number;stale?:Stale|null}){
 return stale?.[id]?.length?<span className="ruling-stale" title="所涉條文在本函釋後修正">⚠ 早於條文修正</span>:null;
}
export function StaleList({id,date,stale}:{id:string|number;date:string;stale?:Stale|null}){
 const old=stale?.[id]||[];if(!old.length)return null;
 return <div className="stale-list" role="note"><strong>⚠ 這則函釋（{rocDay(date)}）早於所涉條文的修正，引用前請對照現行條文：</strong>{old.map(s=><span key={s[0]+s[1]}>{staleLine(s)}</span>)}</div>;
}
