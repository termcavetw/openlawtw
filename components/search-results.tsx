import {useState} from 'react';
import {ArrowUpRight,ChevronDown} from 'lucide-react';
import {Highlight} from './law-navigation';
import type {SearchGroup} from '../lib/search-groups';
export function SearchGroupCard({group,selected,activeArticle,query,onChoose}:{group:SearchGroup;selected:string;activeArticle:string;query:string;onChoose:(id:string,article?:string)=>void}){
 const [limit,setLimit]=useState(2);
 const {law,articles,nameMatch}=group;
 return <article className={'search-group '+(selected===law.id?'selected':'')}>
  <div className="search-group-meta"><span>{law.region}</span><span>{law.kind}</span><span className="match-reason">{nameMatch?'名稱／關鍵詞符合':'條文符合'}</span></div>
  <button className="search-group-title" onClick={()=>onChoose(law.id,nameMatch?'':articles[0]?.article)}><h3><Highlight text={law.name} query={query}/></h3><ArrowUpRight size={16}/></button>
  <div className="search-group-detail">{law.coverage==='full'?`${law.articleCount||0} 條原文`:law.document?`${law.document.pages} 頁圖文 PDF`:'官方連結'}{articles.length>0&&<span> · {articles.length} 條相關結果</span>}</div>
  {articles.slice(0,limit).map(hit=><button className={'search-article-hit '+(selected===law.id&&activeArticle===hit.article?'active':'')} key={hit.article} onClick={()=>onChoose(law.id,hit.article)}><strong>{hit.article}<span>閱讀條文 ↗</span></strong><p><Highlight text={hit.excerpt||''} query={query}/></p></button>)}
  {articles.length>2&&<button className="search-group-more" aria-expanded={limit>2} onClick={()=>setLimit(limit>=articles.length?2:limit+8)}><ChevronDown size={13}/>{limit>=articles.length?'收合相關條文':`另有 ${articles.length-limit} 條相關結果`}</button>}
  <div className="search-group-date">{law.modified?'修正 '+law.modified:'修正日期待核對'}</div>
 </article>;
}
