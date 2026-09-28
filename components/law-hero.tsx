import type { ReactNode } from 'react';
import { ArrowUpRight, ArrowRight } from 'lucide-react';
export function LawHero({compact,children,fullCount,articles,onSearch}:{compact:boolean;children:ReactNode;fullCount:number;articles:number;onSearch:(q:string)=>void}) {
return <section className={'law-hero '+(compact?'compact':'')} aria-label="法規查找">
{!compact&&<div className="hero-intro"><div className="hero-copy"><div className="hero-kicker"><span/> AN OPEN ATLAS OF TAIWAN BUILDING LAW</div><h1>讓每一條法規，<span>有跡可循。</span></h1><p>從你的縣市出發，串起條文、法源與解釋函。</p></div><div className="hero-index"><div className="index-overline">常用查找 <span>QUICK ACCESS</span></div><button onClick={()=>onSearch('建築法 第97條')}><span className="index-no">01</span><b>建築法</b><span className="index-detail">第 97 條</span><ArrowUpRight size={16}/></button><button onClick={()=>onSearch('建技 第90條')}><span className="index-no">02</span><b>建築技術規則</b><span className="index-detail">第 90 條</span><ArrowUpRight size={16}/></button><div className="hero-counts"><span><strong>{fullCount}</strong> 部全文</span><span><strong>{articles.toLocaleString('zh-TW')}</strong> 條原文</span><ArrowRight size={16}/></div></div></div>}
<div className="hero-search-area">{children}</div></section>;
}
