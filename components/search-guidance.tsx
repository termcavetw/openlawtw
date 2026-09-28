import {ArrowUpRight,MapPin} from 'lucide-react';
import {searchGuides,queryRegion} from '../lib/search-guidance';
import {data,lawById} from '../lib/catalog';
export function SearchGuidance({query,region,onRegion,onSearch,onChoose}:{query:string;region:string;onRegion:(r:string)=>void;onSearch:(q:string)=>void;onChoose:(id:string,article?:string)=>void}){
 const mentioned=queryRegion(query,data.regions.map(r=>r.name)),guides=searchGuides(query);
 return <>{mentioned&&region!=='全台'&&region!==mentioned&&<div className="query-region-hint"><MapPin size={14}/><span>你搜尋了{mentioned}，目前範圍是{region}。</span><button onClick={()=>onRegion(mentioned)}>改查{mentioned}</button></div>}{guides.map(g=><div className="query-guide" key={g.id}><strong>{g.label}</strong><small>編輯查找提示 · 不列入精確搜尋結果</small><div className="query-guide-terms">{g.queries.map(q=><button key={q} onClick={()=>onSearch(q)}>{q}</button>)}</div>{g.refs.map(ref=>{const law=lawById.get(ref.law);return law?<button className="query-guide-ref" key={ref.law+ref.article} onClick={()=>onChoose(ref.law,ref.article)}><span>{ref.label}<small>{law.region} · {ref.article||'全文待收錄'}</small></span><ArrowUpRight size={13}/></button>:null;})}</div>)}</>;
}
