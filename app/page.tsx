import {CasebookProvider,CasebookPanel} from '@/components/casebook';
import '@/components/workspace-tools.css';
import {resolveCaseEvidence} from '@/lib/casebook-current';
import type {CaseEvidence} from '@/lib/casebook';
import {LawUniverse} from '@/components/law-universe';
import {lastLaw,rememberLaw} from '@/lib/reading-session';
import {LawPortal} from '@/components/law-portal';
import {groupSearchHits} from '@/lib/search-groups';
import {SearchGroupCard} from '@/components/search-results';
'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Network, GitBranch, BookOpen, FileText, ExternalLink, Search, ChevronDown, ChevronRight, MapPin, Building2, Layers3, ArrowUpRight, ArrowLeft, Copy, X, Download, Info, LibraryBig, CircleHelp, Scale, Link2, LoaderCircle, ListTree, Bookmark, Maximize2, Minimize2, ArrowRight, RotateCcw, SlidersHorizontal, FolderOpen } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import {data,lawById} from '@/lib/catalog';
import {SearchGuidance} from '@/components/search-guidance';
import {DataSources} from '@/components/data-sources';
import {Reader} from '@/components/law-reader';
import {Picker,Highlight,LawChapters} from '@/components/law-navigation';
import {indexedSearch,loadHeads,loadRuling,type IndexedResults,manifest,loadFile,mapLimit} from '@/lib/data-client';
import {RulingCard,RulingExplorer,RulingReader} from '@/components/rulings';
import type { Catalog, Law, Article, Ruling, RulingArchive } from '@/lib/law-types';

import { normalize, searchLaws, searchRulings, matchesArticle, type SearchDoc, type ResultType } from '@/lib/search';
import {readRoute,lawHref,legacyLawHash} from '@/lib/routes';
import {applyPageMetadata} from '@/lib/page-meta';
import { PwaStatus } from '@/components/pwa-status';
import { loadJSON, downloadCatalog, copyText, shareURL, isPortable } from '@/lib/portable';
const dateText = (s: string) => s ? s.split('T')[0] : '未提供';
const number = (n: number) => n.toLocaleString('zh-TW');
const tasks: Record<string, string[]> = {
  '全部主題': [], '建照與設計': ['建築與設計', '都市計畫與土地', '消防與公共安全'],
  '變更使用': ['使用與室內裝修', '建築與設計', '消防與公共安全', '目的事業與設立標準'],
  '室內裝修': ['使用與室內裝修', '消防與公共安全'], '目的事業設立': ['目的事業與設立標準', '使用與室內裝修', '消防與公共安全'], '農業設施': ['農業與山坡地', '都市計畫與土地', '建築與設計'],
  '都更與危老': ['都市更新與危老', '都市計畫與土地', '建築與設計'],
};
const initialOpen = new Set<string>();

export default function Home(){return <CasebookProvider><Workspace/></CasebookProvider>;}

function Workspace() {
  const [casesOpen,setCasesOpen]=useState(false);
  async function chooseEvidence(entry:CaseEvidence){setCasesOpen(false);const l=entry.locator;if(l.lawId)chooseLaw(l.lawId,l.articleNo||'',l.unitId||'',l.page||0);else if(l.rulingId){try{setWelcome(false);setLanding(false);await openRuling(await loadRuling(l.rulingId));}catch{toast.error('目前無法載入此函釋，案件中的引用仍已保留。');}}}
  const [universeOpen,setUniverseOpen]=useState(()=>new URLSearchParams(location.hash.slice(1)).get('view')==='universe');
  const universeReturn=useRef('');
  function openUniverse(){universeReturn.current=isPortable()?location.hash:location.pathname+location.search+location.hash;setUniverseOpen(true);setNavigationOpen(false);window.history.pushState(null,'',(isPortable()?'':'/')+'#view=universe');}
  function closeUniverse(){setUniverseOpen(false);window.history.replaceState(null,'',universeReturn.current||(isPortable()?'#workspace':'/#workspace'));}

  const [landing,setLanding]=useState(()=>new URLSearchParams(location.hash.slice(1)).get('view')==='about');
  const [welcome,setWelcome]=useState(()=>{const r=readRoute(location.pathname,location.hash);return !r.law&&!r.ruling&&!lawById.has(lastLaw());});
  const [region,setRegion] = useState('全台');
  const [task,setTask] = useState('全部主題');
  const [query,setQuery] = useState('');
  const [debounced,setDebounced] = useState('');
  const [composing,setComposing] = useState(false);
  const [view,setView] = useState('tree');
  const [compact,setCompact] = useState(false);
  const [pairOpen,setPairOpen]=useState(false);
  const navigationScroll=useRef(0);
  useEffect(()=>{if(!pairOpen)requestAnimationFrame(()=>{const pane=document.querySelector<HTMLElement>('.explorer .pane[data-state=active]');if(pane)pane.scrollTop=navigationScroll.current;});},[pairOpen]);
  function changePair(open:boolean){if(open){const pane=document.querySelector<HTMLElement>('.explorer .pane[data-state=active]');navigationScroll.current=pane?.scrollTop||0;}setPairOpen(open);}
  const [jurisdiction,setJurisdiction] = useState('both');
  const [coverage,setCoverage] = useState('all');
  const [resultType,setResultType] = useState<ResultType>('all');
  const [sort,setSort] = useState('relevance');
  const [limit,setLimit] = useState(40);
  const [favorites,setFavorites] = useState<string[]>([]);
  const [recent,setRecent] = useState<string[]>([]);
  const [filtersOpen,setFiltersOpen] = useState(false);
  const [expanded,setExpanded] = useState(initialOpen);
  const [selected,setSelected] = useState(()=>{const id=readRoute(location.pathname,location.hash).law;return lawById.has(id)?id:lawById.has(lastLaw())?lastLaw():'D0070109';});
  const [activeDocumentPage,setActiveDocumentPage]=useState(()=>readRoute(location.pathname,location.hash).documentPage);
  const [activeArticle,setActiveArticle] = useState(()=>readRoute(location.pathname,location.hash).article);
  const [activeUnit,setActiveUnit]=useState(()=>readRoute(location.pathname,location.hash).unit),[navigationKey,setNavigationKey]=useState(0);
  const [detail,setDetail] = useState<Law|null>(null);
  const [detailError,setDetailError] = useState(false);
  const [detailLoading,setDetailLoading] = useState(true);
  const [retry,setRetry] = useState(0);
  const [searchResults,setSearchResults]=useState<IndexedResults>({base:[],articles:[],rulings:[],missing:0,candidates:0});
  const [searchLoading,setSearchLoading] = useState(false);
  const [searchError,setSearchError] = useState(false);
  const [searchRetry,setSearchRetry]=useState(0);
  const [sourceOpen,setSourceOpen] = useState(false);
  const [ruling,setRuling] = useState<Ruling|null>(null);
  const [rulings,setRulings]=useState<Ruling[]>([]);
  const [rulingsLoading,setRulingsLoading]=useState(false);
  const rulingRequest=useRef(0),rulingReturnURL=useRef('');
  const [rulingsError,setRulingsError]=useState(false);
  const [rulingsRetry,setRulingsRetry]=useState(0);
  const [rulingHistory,setRulingHistory]=useState<string[]>([]);
  const [savedRulings,setSavedRulings]=useState<string[]>([]);
  const [savedView,setSavedView]=useState('laws');
  useEffect(()=>{if(view!=='rulings'&&!(view==='saved'&&savedView==='rulings')&&!ruling)return;let live=true;setRulingsLoading(true);setRulingsError(false);loadHeads().then(items=>{if(live)setRulings(items);}).catch(()=>{if(live)setRulingsError(true);}).finally(()=>{if(live)setRulingsLoading(false);});return()=>{live=false;};},[view,savedView,!!ruling,rulingsRetry]);
  useEffect(()=>{try{const stored=JSON.parse(localStorage.getItem('openlawtw-ruling-favorites')||'[]');if(Array.isArray(stored))setSavedRulings(stored.filter(x=>typeof x==='string'));}catch{}
    let firstLocation=true;const reloaded=(performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming|undefined)?.type==='reload';
    const readLocation=()=>{const route=readRoute(location.pathname,location.hash);const token=++rulingRequest.current;const params=new URLSearchParams(location.hash.slice(1));setUniverseOpen(params.get('view')==='universe');if(params.get('view')==='universe')return;const requestedRegion=params.get('region');if(requestedRegion&&(requestedRegion==='全台'||data.regions.some(r=>r.name===requestedRegion)))setRegion(requestedRegion);setLanding(params.get('view')==='about');setWelcome(!route.law&&!route.ruling&&!lawById.has(lastLaw()));setNavigationOpen(false);if(params.get('view')==='search'){setQuery(params.get('q')||'');setView('tree');if(window.matchMedia('(max-width:899px)').matches)setNavigationOpen(true);}
      if(route.ruling){applyPageMetadata();loadRuling(route.ruling).then(r=>{if(token===rulingRequest.current){setRuling(r);setRulingHistory([]);}}).catch(()=>{if(token===rulingRequest.current)toast.error('此函釋尚未下載，請連線後再開啟。');});return;}
      if(route.law&&!lawById.has(route.law)){toast.error('本庫未收錄此法規網址。');return;}
      setRuling(null);setRulingHistory([]);const next=route.law||(lawById.has(lastLaw())?lastLaw():'D0070109');setSelected(next);if(route.law)rememberLaw(route.law);setActiveDocumentPage(route.documentPage);setActiveArticle(firstLocation&&reloaded?'':route.article);setActiveUnit(firstLocation&&reloaded?'':route.unit);firstLocation=false;setNavigationKey(n=>n+1);const resumed=!route.law&&lawById.has(lastLaw())&&params.get('view')!=='about'&&params.get('view')!=='search';if(resumed)window.history.replaceState(null,'',isPortable()?legacyLawHash(next):lawHref(next));applyPageMetadata(route.law||resumed?lawById.get(next):undefined);
    };readLocation();window.addEventListener('hashchange',readLocation);window.addEventListener('popstate',readLocation);return()=>{window.removeEventListener('hashchange',readLocation);window.removeEventListener('popstate',readLocation);};
  },[]);
  function toggleRulingFavorite(id:string){setSavedRulings(prev=>{const next=prev.includes(id)?prev.filter(x=>x!==id):[id,...prev];try{localStorage.setItem('openlawtw-ruling-favorites',JSON.stringify(next));}catch{}return next;});}
  async function openRuling(r:Ruling){if(!ruling)rulingReturnURL.current=isPortable()?location.hash:location.pathname+location.search+location.hash;const token=++rulingRequest.current;toast.loading('正在載入函釋…',{id:'ruling-load'});try{const full=r.summaryOnly?await loadRuling(r.id):r;if(token!==rulingRequest.current)return;remember(query);if(ruling&&ruling.id!==r.id)setRulingHistory(prev=>[...prev,ruling.id]);setRuling(full);if(drawerNavigation)setNavigationOpen(false);window.history.replaceState(null,'',(isPortable()?'':'/')+'#ruling='+r.id);applyPageMetadata();}catch{if(token===rulingRequest.current)toast.error('此函釋全文尚未下載，請連線後重試。');}finally{if(token===rulingRequest.current)toast.dismiss('ruling-load');}}
  async function backFromRuling(){const token=++rulingRequest.current;const previous=rulingHistory.at(-1);if(previous){try{const full=await loadRuling(previous);if(token!==rulingRequest.current)return;setRulingHistory(prev=>prev.slice(0,-1));setRuling(full);window.history.replaceState(null,'',(isPortable()?'':'/')+'#ruling='+previous);}catch{toast.error('上一筆函釋未能載入。');}}else{setRuling(null);window.history.replaceState(null,'',rulingReturnURL.current||(isPortable()?legacyLawHash(selected,activeArticle,activeUnit,activeDocumentPage):lawHref(selected,activeArticle,activeUnit,activeDocumentPage)));const route=readRoute(location.pathname,location.hash);applyPageMetadata(route.law?lawById.get(route.law):undefined);}}


  const [graphParent,setGraphParent] = useState('D0070109');
  const [mobile,setMobile] = useState(false);
  const [navigationOpen,setNavigationOpen] = useState(false);
  const drawerNavigation=mobile||pairOpen;
  const drawerNavigationRef=useRef(drawerNavigation);drawerNavigationRef.current=drawerNavigation;
  const searchRef = useRef<HTMLInputElement>(null);
  const docCache = useRef(new Map<string, Law>());
  const currentSummary = lawById.get(selected)!;

  useEffect(()=>{
    const mq=window.matchMedia('(max-width:899px)');const update=()=>setMobile(mq.matches);update();mq.addEventListener('change',update);
    try {const r=localStorage.getItem('openlawtw-region');if(!new URLSearchParams(location.hash.slice(1)).has('region')&&r&&(r==='全台'||data.regions.some(x=>x.name===r))){setRegion(r);setExpanded(new Set());}}catch{}
    try {const saved=JSON.parse(localStorage.getItem('openlawtw-favorites')||'[]');if(Array.isArray(saved))setFavorites(saved.filter((id:unknown)=>typeof id==='string'&&lawById.has(id)));const recent=JSON.parse(localStorage.getItem('openlawtw-recent')||'[]');if(Array.isArray(recent))setRecent(recent.filter((q:unknown)=>typeof q==='string').slice(0,5));}catch{}
    const keys=(e:KeyboardEvent)=>{if((e.metaKey||e.ctrlKey)&&e.key==='k'){e.preventDefault();const homeSearch=document.querySelector<HTMLInputElement>('[aria-label="首頁搜尋法規"]');if(homeSearch){homeSearch.focus();return;}setCompact(false);if(mq.matches||drawerNavigationRef.current)setNavigationOpen(true);requestAnimationFrame(()=>requestAnimationFrame(()=>searchRef.current?.focus()));}};window.addEventListener('keydown',keys);
    return ()=>{mq.removeEventListener('change',update);window.removeEventListener('keydown',keys);};
  },[]);
  useEffect(()=>{if(composing)return;const timer=setTimeout(()=>setDebounced(query),160);return ()=>clearTimeout(timer);},[query,composing]);
  useEffect(()=>{
    if(landing||welcome)return;const cached=docCache.current.get(selected);if(cached){setDetail(cached);setDetailLoading(false);setDetailError(false);return;}
    const summary=lawById.get(selected)!;if(summary.coverage==='link'&&!summary.document){setDetail(summary);setDetailLoading(false);setDetailError(false);return;}
    const controller=new AbortController();setDetailLoading(true);setDetailError(false);setDetail(null);
    loadJSON<Law>('/data/laws/'+encodeURIComponent(selected)+'.json',controller.signal).then((doc:Law)=>{docCache.current.set(selected,doc);setDetail(doc);}).catch(e=>{if(e.name!=='AbortError')setDetailError(true);}).finally(()=>{if(!controller.signal.aborted)setDetailLoading(false);});
    return ()=>controller.abort();
  },[selected,retry,landing,welcome]);

  const inScope = (l: Law) => (region==='全台'||l.region==='中央'||l.region===region) && (!tasks[task].length||tasks[task].includes(l.category)) && (jurisdiction==='both'||(jurisdiction==='central'?l.region==='中央':l.region!=='中央')) && (coverage==='all'||(coverage==='document'?!!l.document:coverage==='link'?l.coverage==='link'&&!l.document:l.coverage===coverage));
  const visibleLaws = useMemo(()=>data.laws.filter(inScope),[region,task,jurisdiction,coverage]);
  const scopeLabel=jurisdiction==='central'?'中央':region==='全台'?(jurisdiction==='local'?'全台地方':'全台（中央＋地方）'):(jurisdiction==='local'?region:region+'＋中央');
  const fullCount = visibleLaws.filter(l=>l.coverage==='full').length;
  const quickPriority=(l:Law)=>/建築管理自治條例|建築管理規則/.test(l.name)?0:/^都市計畫法/.test(l.name)?1:/畸零地使用/.test(l.name)?2:/免.*變更使用/.test(l.name)?3:/室內裝修/.test(l.name)?4:5;
  const scopedRegions = (region==='全台' ? ['中央',...data.regions.map(r=>r.name)] : ['中央',region]).filter(r=>jurisdiction==='both'||(jurisdiction==='central'?r==='中央':r!=='中央'));
  useEffect(()=>{const controller=new AbortController();setSearchError(false);setSearchResults({base:searchLaws(visibleLaws,[],debounced),articles:[],rulings:[],missing:0,candidates:0});if(!debounced.trim()){setSearchLoading(false);return;}setSearchLoading(true);
    indexedSearch(visibleLaws,debounced,jurisdiction!=='local',controller.signal).then(result=>{setSearchResults(result);setSearchError(result.missing>0);}).catch(e=>{if(e.name!=='AbortError')setSearchError(true);}).finally(()=>{if(!controller.signal.aborted)setSearchLoading(false);});return()=>controller.abort();
  },[visibleLaws,debounced,jurisdiction,searchRetry]);
  const baseHits=searchResults.base,articleHits=searchResults.articles;
  const rulingHits=useMemo(()=>sort==='recent'?[...searchResults.rulings].sort((a,b)=>dateValue(b.date)-dateValue(a.date)):searchResults.rulings,[searchResults.rulings,sort]);
  const hits=useMemo(()=>{
    const items=resultType==='rulings'?[]:resultType==='articles'?articleHits:resultType==='laws'?baseHits.filter(h=>h.type==='laws'):baseHits;
    return sort==='recent'?[...items].sort((a,b)=>dateValue(b.law.modified)-dateValue(a.law.modified)):items;
  },[baseHits,articleHits,resultType,sort]);
  const groupedHits=useMemo(()=>groupSearchHits(hits,resultType==='all'?articleHits:[]),[hits,articleHits,resultType]);
  const totalHits=groupedHits.length+((resultType==='all'||resultType==='rulings')?rulingHits.length:0);
  useEffect(()=>setLimit(40),[debounced,region,task,resultType,jurisdiction,coverage,sort]);
  function remember(q:string){if(!q.trim())return;setRecent(prev=>{const next=[q.trim(),...prev.filter(x=>x!==q.trim())].slice(0,5);try{localStorage.setItem('openlawtw-recent',JSON.stringify(next));}catch{}return next;});}
  function runSearch(q:string){setLanding(false);setQuery(q);setView('tree');setResultType('all');remember(q);}
  function toggleFavorite(id:string){setFavorites(prev=>{const next=prev.includes(id)?prev.filter(x=>x!==id):[id,...prev];try{localStorage.setItem('openlawtw-favorites',JSON.stringify(next));}catch{}return next;});}
  function resetFilters(){setTask('全部主題');setJurisdiction('both');setCoverage('all');setResultType('all');}

  function changeRegion(r:string){setRegion(r);setExpanded(new Set());try{localStorage.setItem('openlawtw-region',r);}catch{};}
  function chooseLaw(id:string,article='',unit='',documentPage=0){if(!lawById.has(id))return;setLanding(false);setWelcome(false);rememberLaw(id);rulingRequest.current++;toast.dismiss('ruling-load');setRuling(null);setRulingHistory([]);remember(query);setSelected(id);setActiveDocumentPage(documentPage);setActiveArticle(article);setActiveUnit(unit);setNavigationKey(n=>n+1);if(drawerNavigation)setNavigationOpen(false);const href=isPortable()?legacyLawHash(id,article,unit,documentPage):lawHref(id,article,unit,documentPage);if((isPortable()?location.hash:location.pathname+location.hash)!==href)window.history.pushState(null,'',href);applyPageMetadata(lawById.get(id));}

  function returnWorkspace(){setLanding(false);setActiveArticle('');setActiveUnit('');const id=lawById.has(lastLaw())?lastLaw():'';setWelcome(!id);if(id)setSelected(id);window.history.pushState(null,'',id?(isPortable()?legacyLawHash(id):lawHref(id)):(isPortable()?'#workspace':'/#workspace'));applyPageMetadata(id?lawById.get(id):undefined);}
  function focusSearch(){if(landing)returnWorkspace();setCompact(false);if(drawerNavigation)setNavigationOpen(true);requestAnimationFrame(()=>requestAnimationFrame(()=>searchRef.current?.focus()));}
  function showHome(r:string){rulingRequest.current++;setRuling(null);setPairOpen(false);setNavigationOpen(false);setLanding(true);setRegion(r);setCompact(false);try{localStorage.setItem('openlawtw-region',r);}catch{}window.history.pushState(null,'',(isPortable()?'':'/')+'#view=about&region='+encodeURIComponent(r));applyPageMetadata();}
  function portalSearch(q:string){setCompact(false);resetFilters();runSearch(q);if(mobile)setNavigationOpen(true);window.history.pushState(null,'',(isPortable()?'':'/')+'#'+new URLSearchParams({view:'search',region,q}));}
  function toggle(id:string){setExpanded(prev=>{const next=new Set(prev);if(next.has(id))next.delete(id);else next.add(id);return next;});}
  function expandGroups(){setExpanded(new Set(scopedRegions.flatMap(r=>[r,...data.categories.map(c=>r+':'+c)])));}
  function copy(text:string){copyText(text).then(()=>toast.success('已複製')).catch(()=>toast.error('無法複製，請選取文字後手動複製'));}
  const navItems=[{id:'tree',label:'索引',icon:ListTree},{id:'graph',label:'法源',icon:GitBranch},{id:'rulings',label:'函釋',icon:FileText},{id:'resources',label:'資源',icon:Link2},{id:'saved',label:'收藏',icon:Bookmark}];

  useEffect(()=>{
    const ctx=(document as unknown as {modelContext?:{registerTool:(tool:unknown,opts:unknown)=>void|Promise<void>}}).modelContext;
    if(!ctx?.registerTool)return;const lifecycle=new AbortController();
    const t={name:'search_openlawtw_laws',title:'搜尋 openlawtw 法規',description:'按縣市搜尋已收錄的法規名稱，更新頁面的縣市與搜尋欄；回傳官方來源與全文收錄狀態。',inputSchema:{type:'object',properties:{query:{type:'string'},region:{type:'string',enum:['全台',...data.regions.map(r=>r.name)]}},required:['query'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},execute:async(input:unknown)=>{
      const v=input as {query?:unknown;region?:unknown};if(!v||typeof v.query!=='string'||(v.region!==undefined&&(typeof v.region!=='string'||!['全台',...data.regions.map(r=>r.name)].includes(v.region))))throw Error('請提供文字 query 與有效縣市。');
      const r=typeof v.region==='string'?v.region:'全台';setRegion(r);setTask('全部主題');setJurisdiction('both');setCoverage('all');setResultType('all');setLanding(false);setCompact(false);if(drawerNavigationRef.current)setNavigationOpen(true);setQuery(v.query);setView('tree');
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      return {scope:r,results:data.laws.filter(l=>(r==='全台'||l.region==='中央'||l.region===r)&&normalize(l.name).includes(normalize(v.query as string))).slice(0,30).map(l=>({id:l.id,name:l.name,url:l.url,coverage:l.coverage})),coverage:'只搜尋已收錄資料，不代表案件全部適用法規。'};
    }};
    try{Promise.resolve(ctx.registerTool(t,{signal:lifecycle.signal})).catch(()=>{});}catch{}
    return ()=>lifecycle.abort();
  },[]);

  const reader=<Reader summary={currentSummary} law={detail} loading={detailLoading} error={detailError} retry={()=>{setRetry(n=>n+1);setRulingsRetry(n=>n+1);}} activeArticle={activeArticle} activeDocumentPage={activeDocumentPage} activeUnit={activeUnit} navigationKey={navigationKey} onChoose={chooseLaw} mobile={mobile} onPairChange={changePair} savedRulings={savedRulings} onSaveRuling={toggleRulingFavorite} onCopy={copy} open={!ruling&&!landing&&!welcome} saved={favorites.includes(selected)} onSave={()=>toggleFavorite(selected)}/>;
  const navigator = <section className="explorer" aria-label="法規導覽"><div className="navigator-head"><div className="navigator-title"><h1>查找法規</h1><span>全庫 {number(data.laws.length)} 部索引</span></div><form className="searchbox" role="search" onSubmit={e=>{e.preventDefault();if(composing)return;setDebounced(query);remember(query);searchRef.current?.blur();}}><Search size={17}/><input ref={searchRef} onCompositionStart={()=>setComposing(true)} onCompositionEnd={e=>{setComposing(false);setQuery(e.currentTarget.value);}} value={query} onChange={e=>{setQuery(e.target.value);setView('tree');}} autoComplete="off" autoCapitalize="none" spellCheck={false} enterKeyHint="search" aria-label="搜尋法規、條號、內文或函釋字號" placeholder="名稱、內文、條號或字號"/>{query?<button type="button" className="icon-btn" onClick={()=>setQuery('')} aria-label="清除搜尋"><X size={16}/></button>:<kbd>⌘ K</kbd>}</form></div>    <div className="toolbar">
      <div className="filter-field"><MapPin size={16}/><Picker value={region} onChange={changeRegion} label="選擇縣市"><SelectItem value="全台">全台縣市</SelectItem>{data.regions.map(r=><SelectItem key={r.name} value={r.name}>{r.name}</SelectItem>)}</Picker></div>
      <button className={'filter-toggle '+(filtersOpen?'active':'')} onClick={()=>setFiltersOpen(v=>!v)} aria-expanded={filtersOpen}><SlidersHorizontal size={16}/><span>進階篩選</span>{(coverage!=='all'||task!=='全部主題'||jurisdiction!=='both')&&<b>{Number(coverage!=='all')+Number(task!=='全部主題')+Number(jurisdiction!=='both')}</b>}</button>
      <span className="scope-count">{fullCount} 部全文 <span>/</span> {visibleLaws.length} 部索引</span>
    </div>
    {filtersOpen&&<div className="advanced-filters">      <div className="filter-field"><Layers3 size={16}/><Picker value={task} onChange={setTask} label="選擇工作主題" className="taskpicker">{Object.keys(tasks).map(t=><SelectItem value={t} key={t}>{t}</SelectItem>)}</Picker></div>
      <div className="jurisdiction-toggle" role="group" aria-label="法規地區範圍">{[['both','中央＋地方'],['central','僅中央'],['local','僅地方']].map(([v,l])=><button key={v} aria-pressed={jurisdiction===v} onClick={()=>setJurisdiction(v)}>{l}</button>)}</div>
<span>收錄內容</span><div role="group" aria-label="收錄內容">{[['all','全部資料'],['full','條文全文'],['document','原文文件'],['link','僅官方連結']].map(([v,l])=><button key={v} aria-pressed={coverage===v} onClick={()=>setCoverage(v)}>{l}</button>)}</div><button className="plain-button" onClick={resetFilters}><RotateCcw size={13}/>重設篩選</button></div>}

        <Tabs value={view} onValueChange={setView} className="explorer-tabs">
          <div className="viewbar"><TabsList className="view-tabs" aria-label="瀏覽方式">{navItems.map(n=><TabsTrigger key={n.id} value={n.id}><n.icon size={16}/>{n.label}</TabsTrigger>)}</TabsList></div>
          <TabsContent value="tree" className="pane canvas">
            <div className="section-top"><div><h2>{query.trim()?'搜尋結果':'分類目錄'}</h2><p>{query.trim()?`${region} · ${jurisdiction==='both'?'中央＋地方':jurisdiction==='central'?'中央法規':'地方法規'} · ${task}`:'需要時，展開地區與章節。'}</p></div>{!query.trim()&&<div className="small-actions"><button onClick={expandGroups}>展開分類</button><button onClick={()=>setExpanded(new Set())}>收合</button></div>}</div>
            {task!=='全部主題'&&<div className="active-filter">主題篩選：{task}。這是查找分類，仍須按案件條件核對適用規定。</div>}
            {query.trim()?<>
              <SearchGuidance query={debounced} region={region} onRegion={r=>{changeRegion(r);resetFilters();}} onSearch={runSearch} onChoose={chooseLaw}/>
              <div className="search-guidance">名稱、條號或多個關鍵字皆可查找。<button onClick={()=>{changeRegion('全台');resetFilters();}}>查找全台</button></div><div className="result-facets" role="group" aria-label="搜尋結果類型">{([['all','全部'],['laws','法規'],['articles','條文／文件'],['rulings','函釋']] as const).map(([v,l])=><button key={v} aria-pressed={resultType===v} onClick={()=>setResultType(v)}>{l}<span>{v==='all'?groupSearchHits(baseHits).length+rulingHits.length:v==='laws'?baseHits.filter(h=>h.type==='laws').length:v==='articles'?articleHits.length:rulingHits.length}</span></button>)}</div>
              <div className="result-toolbar"><p className="result-count" role="status">{searchLoading||debounced!==query?'正在搜尋…':`${number(groupedHits.length)} 部法規${(resultType==='all'||resultType==='rulings')?' · '+number(rulingHits.length)+' 筆函釋':''}`}{searchError&&' · 部分資料尚未下載，結果不完整'}</p><Picker value={sort} onChange={setSort} label="搜尋結果排序"><SelectItem value="relevance">依關聯程度</SelectItem><SelectItem value="recent">依修正日期</SelectItem></Picker></div>
              {groupedHits.slice(0,limit).map(group=><SearchGroupCard key={group.law.id+':'+debounced+':'+resultType} group={group} selected={selected} activeArticle={activeArticle} activeDocumentPage={activeDocumentPage} query={debounced} onChoose={chooseLaw}/>)}
              {(resultType==='all'||resultType==='rulings')&&rulingHits.slice(0,limit).map(r=><RulingCard key={r.id} ruling={r} onClick={()=>openRuling(r)}/>)}
              {!totalHits&&!searchLoading&&!searchError&&debounced===query&&<div className="empty-state"><Search size={30}/><strong>目前條件下，尚無相符資料</strong>可以用空格分開關鍵字，或查找全台已收錄資料。<div className="empty-actions"><button onClick={()=>{changeRegion('全台');resetFilters();}}>搜尋全台</button><button onClick={resetFilters}>清除篩選</button></div><small>查無結果不代表沒有相關規定。</small></div>}
              {searchError&&<button className="plain-button" onClick={()=>setSearchRetry(n=>n+1)}>重新載入全文索引</button>}
              {Math.max(groupedHits.length,(resultType==='all'||resultType==='rulings')?rulingHits.length:0)>limit&&<button className="load-more" onClick={()=>setLimit(n=>n+40)}>顯示更多結果 <span>{limit} / {Math.max(groupedHits.length,(resultType==='all'||resultType==='rulings')?rulingHits.length:0)}</span><ChevronDown size={16}/></button>}
            </>:<>
              
              <div className="search-examples"><span>試試</span>{['建技90','樓梯 寬度','室內裝修'].map(q=><button key={q} onClick={()=>runSearch(q)}>{q}</button>)}</div><div className="map-trunk">{scopedRegions.map(r=>{
                const regionLaws=visibleLaws.filter(l=>l.region===r);
                return <section key={r}><button className="root-button" onClick={()=>toggle(r)} aria-expanded={expanded.has(r)}>{expanded.has(r)?<ChevronDown size={14}/>:<ChevronRight size={14}/>}<span className={'root-icon '+(r==='中央'?'':'local')}>{r==='中央'?<Building2 size={16}/>:<MapPin size={16}/>}</span><strong>{r==='中央'?'中央法規':r}</strong><small>{regionLaws.length} 部</small></button>
                  {expanded.has(r)&&<ul className="tree-children">{data.categories.map(c=>{
                    const list=regionLaws.filter(l=>l.category===c);const key=r+':'+c;if(!list.length)return null;
                    return <li key={c}><button className="category-button" onClick={()=>toggle(key)} aria-expanded={expanded.has(key)}>{expanded.has(key)?<ChevronDown size={12}/>:<ChevronRight size={12}/>}<strong>{c}</strong><small>{list.length}</small></button>
                      {expanded.has(key)&&<div className="category-list">{list.map(l=><div className="law-item" key={l.id}><div className={'law-row '+(selected===l.id?'selected':'')}><button className="law-toggle" onClick={()=>toggle(l.id)} disabled={!(l.articleCount||0)} aria-label={'展開'+l.name+'章節'} aria-expanded={expanded.has(l.id)}>{expanded.has(l.id)?<ChevronDown size={13}/>:<ChevronRight size={13}/>}</button><button className="law-title" onClick={()=>chooseLaw(l.id)}><FileText size={15}/><span>{l.name}</span>{l.coverage==='full'?<small className="article-count">{(l.articleCount||0)} 條</small>:<small className="link-chip">{l.document?(l.document.format==='html'?'原文文件':'PDF'):'連結'}</small>}</button></div>{expanded.has(l.id)&&<LawChapters id={l.id} active={selected===l.id?activeArticle:''} onArticle={no=>chooseLaw(l.id,no)}/>}</div>)}</div>}
                    </li>;
                  })}{!regionLaws.length&&<li><div className="portal-empty">此地區尚待補齊建築法規索引。<a href={data.regions.find(x=>x.name===r)?.url} target="_blank" rel="noreferrer">前往官方法規系統<ExternalLink size={13}/></a></div></li>}</ul>}
                </section>;
              })}</div>
              <div className="quick-laws"><h3>常用法規<span>快速開啟</span></h3>{['D0070109','D0070115','D0070116','D0070117','D0070001',...visibleLaws.filter(l=>l.region===region).sort((a,b)=>quickPriority(a)-quickPriority(b)).slice(0,5).map(l=>l.id)].map(id=>lawById.get(id)!).filter(l=>l&&visibleLaws.some(v=>v.id===l.id)).map(l=><button className={selected===l.id?'active':''} key={l.id} onClick={()=>chooseLaw(l.id)}><FileText size={15}/><span>{l.name}<small>{l.region} · {l.coverage==='full'?(l.articleCount||0)+' 條':l.document?'原文文件':'官方連結'}</small></span><ChevronRight size={13}/></button>)}</div><div className="coverage-note">分類目錄供瀏覽；法律依據請見「法源」。尚未完整收錄，查無結果不代表沒有規定。</div>
            </>}
          </TabsContent>
          <TabsContent value="graph" className="pane canvas"><button className="universe-entry" onClick={openUniverse}><Network size={17}/><span>探索法規宇宙</span><ArrowUpRight size={15}/></button>
            <div className="section-top"><div><div className="eyebrow">LEGAL FOUNDATIONS</div><h2>法源關係圖</h2><p>每一條連線，都能回到原文。</p></div><Scale size={25} color="#8a9aaf"/></div>
            <Picker value={graphParent} onChange={setGraphParent} label="選擇法源根節點">{[...new Set(data.relations.map(r=>r.parent))].map(id=><SelectItem value={id} key={id}>{lawById.get(id)?.name}</SelectItem>)}</Picker>
            <div className="relation-note">呈現條文明載的訂定依據。地方自治規定與中央法規可能共同適用；本圖不將地方法規一概視為中央法規的下位規範。</div>
            <button className="graph-parent" onClick={()=>chooseLaw(graphParent)}><small>{lawById.get(graphParent)?.kind} · 法源</small><strong>{lawById.get(graphParent)?.name}</strong></button><div className="graph-stem"/>
            <div className="graph-children">{data.relations.filter(r=>r.parent===graphParent&&visibleLaws.some(l=>l.id===r.child)).map(r=>{const child=lawById.get(r.child)!;return <button className={'graph-child '+(selected===r.child?'active':'')} key={r.child} onClick={()=>chooseLaw(r.child)}><small>{r.article} 授權／依據</small><strong>{child.name}</strong><span>{child.region} · {child.kind}</span></button>;})}</div>
            {!data.relations.some(r=>r.parent===graphParent&&visibleLaws.some(l=>l.id===r.child))&&<div className="empty-state">目前地區／主題沒有已收錄的關係，請調整篩選。</div>}
            <div className="coverage-note">點選節點後，在「法源」查看關係證據。只收錄已明示的連結；未連線不代表無關。建築技術規則各編的共同依據請見總則編。</div>
          </TabsContent>
          <TabsContent value="rulings" className="pane">
            <RulingExplorer items={rulings} loading={rulingsLoading} error={rulingsError} retry={()=>setRulingsRetry(n=>n+1)} onOpen={openRuling} selected={ruling?.id||''} saved={savedRulings}/>
          </TabsContent>
          <TabsContent value="resources" className="pane">
            <div className="section-top"><div><div className="eyebrow">OFFICIAL RESOURCES</div><h2>官方資源</h2><p>{region==='全台'?'中央與各縣市':region+'與中央'}的查詢入口。</p></div><LibraryBig size={25} color="#8a9aaf"/></div>
            {['法規查詢','函釋','都市計畫','申辦資源'].map(c=>{const list=data.resources.filter(r=>r.category===c&&(region==='全台'||r.region==='中央'||r.region===region));return list.length?<div className="resource-group" key={c}><h3>{c}</h3>{list.map(r=><a className="resource-card" href={r.url} key={r.url} target="_blank" rel="noreferrer"><div><h4>{r.title}</h4><p>{r.description}</p></div><ArrowUpRight size={17}/></a>)}</div>:null;})}
            <div className="coverage-note">地方都市計畫、審查表單與窗口持續補錄；目前以桃園資料優先。選縣市後仍需確認基地所屬計畫及分區。</div>
          </TabsContent>
          <TabsContent value="saved" className="pane canvas"><div className="section-top"><div><div className="eyebrow">YOUR REFERENCE SHELF</div><h2>我的收藏</h2><p>儲存在這台裝置，方便下次接著查。</p></div><Bookmark size={23}/></div><div className="saved-tabs"><button aria-pressed={savedView==='laws'} onClick={()=>setSavedView('laws')}>法規 {favorites.length}</button><button aria-pressed={savedView==='rulings'} onClick={()=>setSavedView('rulings')}>函釋 {savedRulings.length}</button></div>{savedView==='rulings'?<RulingExplorer items={rulings} loading={rulingsLoading} error={rulingsError} retry={()=>setRulingsRetry(n=>n+1)} onOpen={openRuling} selected={ruling?.id||''} saved={savedRulings} onSavedOnly/>:<>{favorites.map(id=>{const l=lawById.get(id)!;return <div className="saved-row" key={id}><button onClick={()=>chooseLaw(id)}><small>{l.region} · {l.kind}</small><strong>{l.name}</strong><span>{(l.articleCount||0)?(l.articleCount||0)+' 條原文':l.document?(l.document.format==='html'?'官方原文文件':'官方 PDF'):'官方連結'}<ArrowUpRight size={14}/></span></button><button className="icon-btn" onClick={()=>toggleFavorite(id)} aria-label={'取消收藏'+l.name}><Bookmark size={17} fill="currentColor"/></button></div>;})}{!favorites.length&&<div className="empty-state"><Bookmark size={30}/><strong>把常查的法規留在手邊</strong>打開一部法規，按「收藏」即可加入。</div>}</>}</TabsContent>
        </Tabs>
        <footer className="explorer-footer"><div className="scope-summary"><span>目前篩選 · {scopeLabel}</span><span>{fullCount} 部全文 / {visibleLaws.length} 部索引</span></div><button className="plain-button" style={{fontSize:12,padding:0}} onClick={()=>setSourceOpen(true)}>收錄範圍<ChevronRight size={11}/></button></footer>
</section>;
  return <main className={"app reader-first "+(landing?"portal-mode ":"")+(compact||pairOpen?"focus-mode":"")}>
    <header className="topbar">
      <div className="brand-group"><button className={"navigation-toggle "+(mobile?"mobile-search-button":"icon-btn")} aria-label={drawerNavigation?"開啟法規搜尋":compact?"顯示側欄":"收合側欄"} aria-expanded={drawerNavigation?navigationOpen:!compact} onClick={()=>drawerNavigation?setNavigationOpen(true):setCompact(v=>!v)}><>{mobile?<><Search size={17}/><span>搜尋</span></>:<ListTree size={20}/>}</></button><a className="brand" href="#" onClick={e=>{e.preventDefault();focusSearch();}} aria-label="openlawtw 搜尋"><span className="brandmark" aria-hidden="true"><BookOpen size={20} strokeWidth={1.6}/></span><span className="wordmark">openlaw<span>tw</span></span><span className="branddesc">臺灣建築法規庫</span><span className="release-badge">v{data.version}</span></a></div>
      <div className="topright"><button className="workspace-tools-button" onClick={()=>setCasesOpen(true)} aria-label="開啟案件資料夾"><FolderOpen size={17}/><span>案件資料夾</span></button><button className="universe-top-button" onClick={openUniverse} aria-label="開啟法規宇宙"><Network size={17}/><span>法規宇宙</span></button><button className="home-button" onClick={()=>landing?returnWorkspace():showHome(region)}>{landing?'返回閱讀':'關於'}</button><PwaStatus region={region}/><button className="plain-button data-button" onClick={()=>setSourceOpen(true)} aria-label="資料與開源"><Info size={16}/><span>資料與開源</span></button></div>
    </header>
    <>{landing?<LawPortal region={region} onRegion={showHome} onSearch={portalSearch} onChoose={chooseLaw} onCoverage={()=>setSourceOpen(true)}/>:<div className="workspace">{!drawerNavigation&&!compact&&navigator}<section className="reading-workspace" aria-label="法規閱讀區"><div className="law-reader-container" style={{display:ruling?'none':'contents'}}>{welcome?<div className="workspace-welcome"><span className="portal-kicker">OPENLAWTW · 工作區</span><h1>今天要查什麼？</h1><p>搜尋法規、條號或函釋。選擇縣市後，可同時查中央與地方規定。</p><form onSubmit={e=>{e.preventDefault();focusSearch();}}><Search size={19}/><input aria-label="工作區搜尋" value={query} onChange={e=>runSearch(e.target.value)} placeholder="例如：台北畸零地、建技90"/><button>搜尋</button></form><div className="workspace-actions"><button onClick={()=>setCasesOpen(true)}><FolderOpen size={17}/>案件資料夾</button></div><h2>常用法規</h2>{['D0070109','D0070115','內政部-GL000734'].map(id=><button className="welcome-law" key={id} onClick={()=>chooseLaw(id)}>{lawById.get(id)?.name}<ArrowUpRight size={16}/></button>)}{favorites.length>0&&<><h2>已收藏</h2>{favorites.map(id=><button className="welcome-law" key={id} onClick={()=>chooseLaw(id)}>{lawById.get(id)?.name}<ArrowUpRight size={16}/></button>)}</>}</div>:reader}</div>{ruling&&<RulingReader ruling={ruling} items={rulings} lawById={lawById} onBack={backFromRuling} backLabel={rulingHistory.length?'上一則函釋':currentSummary.name} onOpen={openRuling} onChoose={chooseLaw} onCopy={copy} saved={savedRulings.includes(ruling.id)} onSave={()=>toggleRulingFavorite(ruling.id)}/>}</section></div>}</>
    <Sheet open={drawerNavigation&&navigationOpen} onOpenChange={setNavigationOpen}><SheetContent side="left" className="mobile-navigator" onOpenAutoFocus={e=>{e.preventDefault();searchRef.current?.focus();}}><SheetTitle className="sr-only">查找法規</SheetTitle><SheetDescription className="sr-only">搜尋、縣市篩選與法規目錄</SheetDescription>{drawerNavigation&&navigator}</SheetContent></Sheet>
    <Dialog open={casesOpen} onOpenChange={setCasesOpen}><DialogContent className="work-tools-dialog"><DialogTitle>案件資料夾</DialogTitle><DialogDescription>保存查核依據、案件筆記及待確認事項。</DialogDescription><CasebookPanel onChoose={entry=>void chooseEvidence(entry)} resolveCurrent={resolveCaseEvidence}/></DialogContent></Dialog>
    <DataSources open={sourceOpen} onOpenChange={setSourceOpen} region={region} onChoose={chooseLaw}/>
    <LawUniverse open={universeOpen} onClose={closeUniverse} onChoose={(id,article)=>{setUniverseOpen(false);chooseLaw(id,article);}} onRuling={r=>{setUniverseOpen(false);setLanding(false);openRuling(r);}}/>
    <Toaster position="bottom-center"/>
  </main>;
}

function dateValue(value:string){const roc=value.match(/民國\s*(\d+)\s*年\s*(\d+)\s*月\s*(\d+)\s*日/);return roc?Date.UTC(Number(roc[1])+1911,Number(roc[2])-1,Number(roc[3])):(Date.parse(value)||0);}
