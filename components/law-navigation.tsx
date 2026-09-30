import {useEffect,useState,type ReactNode} from 'react';
import {ChevronRight} from 'lucide-react';
import {Select,SelectTrigger,SelectValue,SelectContent} from '@/components/ui/select';
import type {Article,Law} from '@/lib/law-types';
import {normalize,highlightTerms} from '@/lib/search';
import {articleRange} from '@/lib/law-chapters';
import {loadLaw} from '@/lib/data-client';
export function Picker({ value, onChange, label, children, className = '' }: {value: string; onChange: (v: string) => void; label: string; children: ReactNode; className?: string}) {
  return <Select value={value} onValueChange={onChange}><SelectTrigger className={'picker ' + className} aria-label={label}><SelectValue /></SelectTrigger><SelectContent position="popper">{children}</SelectContent></Select>;
}
export function Highlight({ text, query }: {text: string; query: string}) {
  const pieces = highlightTerms(query);
  if (!pieces.length) return <>{text}</>;
  const escaped = pieces.map(t=>[...t].map(c=>c==='臺'?'[台臺]':c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s*')).join('|');
  const regex = new RegExp('(' + escaped + ')', 'gi');
  return <>{text.split(regex).map((p,i) => pieces.some(t=>normalize(t)===normalize(p)) ? <mark key={i}>{p}</mark> : p)}</>;
}
export function ChapterNodes({ articles, depth=0, active, onArticle }: {articles: Article[]; depth?: number; active: string; onArticle: (s:string)=>void}) {
  const groups = new Map<string, Article[]>();
  articles.forEach(a=>{const g=a.path[depth] || '';groups.set(g,[...(groups.get(g)||[]),a]);});
  return <div className="chapter-tree">{[...groups].map(([title, list]) => title ? <details key={title}><summary><ChevronRight size={12}/>{title}<small className="chapter-range">{articleRange(list)}</small></summary><ChapterNodes articles={list} depth={depth+1} active={active} onArticle={onArticle}/></details> : <div key="articles">{list.map(a=><button key={a.no} className={'article-node ' + (active===a.no?'active':'')} onClick={()=>onArticle(a.no)}>{a.no}</button>)}</div>)}</div>;
}

export function LawChapters({id,active,onArticle}:{id:string;active:string;onArticle:(s:string)=>void}){const [law,setLaw]=useState<Law|null>(null),[error,setError]=useState(false);useEffect(()=>{const controller=new AbortController();setLaw(null);setError(false);loadLaw(id,controller.signal).then(setLaw).catch(e=>{if(e.name!=='AbortError')setError(true);});return()=>controller.abort();},[id]);return law?<ChapterNodes articles={law.articles} active={active} onArticle={onArticle}/>:<p className="coverage-note">{error?'章節未下載，請連線後重試。':'載入章節…'}</p>;}
