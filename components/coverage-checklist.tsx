import {useMemo,useState} from 'react';
import {ArrowUpRight,BookOpen,ChevronRight,ExternalLink,Link2,ListChecks,Search} from 'lucide-react';
import {data} from '../lib/catalog';
import {captureDate,regionCoverage} from '../lib/coverage';
import type {Law} from '../lib/law-types';

export function CoverageChecklist({region,onChoose}:{region:string;onChoose:(id:string)=>void}){
 const [area,setArea]=useState(region==='全台'?'中央':region),[mode,setMode]=useState('all'),[query,setQuery]=useState('');
 const summary=useMemo(()=>regionCoverage(data.laws,area),[area]);
 const portal=area==='中央'?'https://law.moj.gov.tw/':data.regions.find(r=>r.name===area)?.url;
 const dates=summary.full.map(captureDate).filter(Boolean).sort();
 const topics=summary.topics.filter(t=>mode==='gaps'?!t.laws.length:mode==='full'?t.laws.some(l=>l.coverage==='full'):mode==='document'?t.laws.some(l=>!!l.document):mode==='link'?t.laws.some(l=>l.coverage==='link'&&!l.document):true);
 const match=(l:Law)=>!query.trim()||l.name.replace(/台/g,'臺').includes(query.trim().replace(/台/g,'臺'));
 const row=(law:Law)=><div className="coverage-law" key={law.id}><button onClick={()=>onChoose(law.id)}><span>{law.name}</span><small>{law.document?(law.document.format==='html'?'官方原文文件':'官方 PDF 原文'):law.coverage==='full'?'已收錄全文':'僅官方連結'} · {(law.document?.retrieved||captureDate(law))?'擷取 '+(law.document?.retrieved||captureDate(law)).split('T')[0]:'擷取日期待核對'}</small></button><a href={law.url} target="_blank" rel="noreferrer" aria-label={'官方原文：'+law.name}><ExternalLink size={14}/></a></div>;
 return <div className="coverage-checklist">
  <div className="coverage-toolbar"><label>選擇地區<select aria-label="收錄清單地區" value={area} onChange={e=>{setArea(e.target.value);setQuery('');}}>{['中央',...data.regions.map(r=>r.name)].map(r=><option key={r}>{r}</option>)}</select></label><a href={portal} target="_blank" rel="noreferrer">官方法規入口<ArrowUpRight size={14}/></a></div>
  <div className="coverage-metrics"><div><BookOpen size={17}/><strong>{summary.full.length}</strong><span>部已收錄全文</span></div><div><BookOpen size={17}/><strong>{summary.documents.length}</strong><span>份原文文件</span></div><div><Link2 size={17}/><strong>{summary.links.length}</strong><span>部僅官方連結</span></div><div><ListChecks size={17}/><strong>{summary.topics.filter(t=>!t.laws.length).length}<small> / {summary.topics.length}</small></strong><span>個議題待補查</span></div></div>
  <p className="coverage-date">{dates.length?`此地區已收錄全文的擷取日期：${dates[0]}${dates.at(-1)!==dates[0]?' 至 '+dates.at(-1):''}。`:'此地區尚無已收錄全文。'}每部法規的日期列於下方。</p>
  <div className="coverage-mode" role="group" aria-label="收錄清單狀態">{[['all','全部議題'],['full','已有全文'],['document','含原文文件'],['link','含僅連結'],['gaps','待補查']].map(([id,label])=><button key={id} aria-pressed={mode===id} onClick={()=>setMode(id)}>{label}</button>)}</div>
  <div className="coverage-topic-list">{topics.map(topic=><details className={'coverage-topic '+(!topic.laws.length?'is-gap':'')} key={area+topic.id}><summary><ChevronRight size={14}/><span><strong>{topic.name}</strong><small>{topic.description}</small></span><em>{topic.laws.length?`${topic.laws.filter(l=>l.coverage==='full').length} 全文 · ${topic.laws.filter(l=>!!l.document).length} 文件 · ${topic.laws.filter(l=>l.coverage==='link'&&!l.document).length} 連結`:'待補查'}</em></summary><div>{topic.laws.length?topic.laws.map(row):<p>本庫尚未收錄名稱符合此議題的{area==='中央'?'中央':'地方'}規定。請至<a href={portal} target="_blank" rel="noreferrer">官方法規系統</a>查核；不表示當地沒有相關規定。</p>}</div></details>)}{!topics.length&&<p className="coverage-no-match">此篩選沒有符合的議題。</p>}</div>
  <div className="coverage-all-head"><h3>{area}全部已索引法規 <span>{summary.records.length}</span></h3><label><Search size={14}/><input aria-label="篩選收錄法規名稱" value={query} onChange={e=>setQuery(e.target.value)} placeholder="法規名稱"/></label></div>
  <div className="coverage-all-list">{summary.records.filter(match).map(row)}{!summary.records.filter(match).length&&<p className="coverage-no-match">沒有相符的已索引法規。</p>}</div>
  <p className="coverage-method">議題依法規名稱整理，可重複歸類；數量只反映本庫收錄，尚未建立各地官方完整清單。全文擷取日期與修正、施行日期分開記錄。</p>
 </div>;
}
