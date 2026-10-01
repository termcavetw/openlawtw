import {DropdownMenu} from 'radix-ui';
import {LawPrintDialog} from './law-print-dialog';
import {officialArticleSource} from '@/lib/official-source';
import type {PrintScope} from '@/lib/law-print';
import {ThinkingOrb} from './thinking-orb';
import {useRulingWidth} from '@/lib/use-ruling-width';
import {useReadingPosition} from '@/lib/use-reading-position';
import {DocumentReader} from '@/components/document-reader';
import {VersionEvidence} from '@/components/version-evidence';
import {LawHistory} from '@/components/law-history';
import {ALL_CHAPTERS,articleRange,lawPathRanges,chapterForArticle,initialLawChapter,lawChapters,visibleLawArticles} from '@/lib/law-chapters';
import './law-reading.css';
import {AddEvidenceButton} from '@/components/casebook';
import {ReferenceShareButton} from './reference-share';
import {makeArticleEvidence,makeDocumentEvidence} from '@/lib/casebook';
import {loadFile,manifest} from '@/lib/data-client';
import {useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {BookOpen,ChevronLeft,ChevronRight,ChevronDown,ExternalLink,Copy,Bookmark,Link2,Search,X,CircleHelp,ArrowUpRight,GitBranch,Printer,MoreHorizontal} from 'lucide-react';
import {Tabs,TabsList,TabsTrigger,TabsContent} from '@/components/ui/tabs';
import {RulingCard,ArticleRulings} from '@/components/rulings';
import {ArticleText} from '@/components/article-text';
import {RulingPanel} from '@/components/ruling-panel';
import {Sheet,SheetContent,SheetTitle,SheetDescription} from '@/components/ui/sheet';
import {data,lawById} from '@/lib/catalog';
import {normalize,searchRulings} from '@/lib/search';
import {lawHref,articleAddress} from '@/lib/routes';
import {shareURL} from '@/lib/portable';
import {useLawRulings} from '@/lib/use-law-rulings';
import type {Article,Law,Ruling} from '@/lib/law-types';
async function captureDocumentPage(law:Law,page:number){
  const textFile=manifest.documentTexts?.[law.id];
  let found=textFile?(await loadFile<{pages:{page:number;text:string}[]}>(textFile)).pages.find(item=>item.page===page):undefined;
  // Search text may cover only this law's pages in a larger official gazette.
  // Prefer those scoped excerpts; fall back to the complete original payload
  // when a visible page has not been included in the search index.
  if(!found){const file=manifest.documents?.[law.id];if(!file)throw Error('此份原文文件尚未收錄。');const original=await loadFile<{sha256:string;pages:{page:number;text:string}[]}>(file);if(original.sha256!==law.document?.sha256)throw Error('原文文件版本不一致，請重新載入。');found=original.pages.find(item=>item.page===page);}
  if(!found)throw Error('此頁尚無可保存的文字，請核對官方原檔。');
  return makeDocumentEvidence(law,found);
}
export function Reader({summary,law:loadedLaw,loading,error,retry,activeArticle,activeDocumentPage,activeUnit,navigationKey,onChoose,onCopy,open,saved,onSave,mobile,onPairChange,savedRulings,onSaveRuling}:{summary:Law;law:Law|null;loading:boolean;error:boolean;retry:()=>void;activeArticle:string;activeDocumentPage:number;activeUnit:string;navigationKey:number;onChoose:(id:string,article?:string,unit?:string,documentPage?:number)=>void;onCopy:(s:string)=>void;open:boolean;saved:boolean;onSave:()=>void;mobile:boolean;onPairChange:(open:boolean)=>void;savedRulings:string[];onSaveRuling:(id:string)=>void}){
  // Selection changes before its asynchronous detail effect clears the previous
  // law. Never send that stale body's fields to this selection's readers/tools.
  const law=loadedLaw?.id===summary.id?loadedLaw:null;
  const evidenceLaw=law?{...law,retrieved:summary.retrieved,snapshot:summary.snapshot}:summary;
  const documentViewKey=JSON.stringify([summary.id,activeDocumentPage]);
  const [displayedDocumentPage,setDisplayedDocumentPage]=useState<{key:string;page:number}|null>(null);
  const onVisibleDocumentPage=useCallback((page:number)=>setDisplayedDocumentPage(previous=>previous?.key===documentViewKey&&previous.page===page?previous:{key:documentViewKey,page}),[documentViewKey]);
  const visibleDocumentPage=displayedDocumentPage?.key===documentViewKey?displayedDocumentPage.page:0;
  const documentPage=summary.document?.format==='html'?1:Math.min(summary.document?.pages||1,Math.max(1,visibleDocumentPage||activeDocumentPage||summary.document?.startPage||1));
  const [fontSize,setFontSize]=useState(18),[requestedFor,setRequestedFor]=useState('');
  const [printRequest,setPrintRequest]=useState<{lawId:string;scope:PrintScope}|null>(null),printTrigger=useRef<HTMLElement|null>(null);
  function requestPrint(article?:string){
    printTrigger.current=document.activeElement as HTMLElement;
    const pane=scroll.current,top=pane?.getBoundingClientRect().top||0;
    const visible=pane?Array.from(pane.querySelectorAll<HTMLElement>('[data-article]')).find(el=>el.getBoundingClientRect().bottom>top)?.dataset.article:undefined;
    const current=article||visible||activeArticle||law?.articles[0]?.no||'';
    const scope:PrintScope=article?{kind:'article',article}:selectedChapter?{kind:'chapter',chapter:selectedChapter.id}:current?{kind:'article',article:current}:{kind:'law'};
    setPrintRequest({lawId:summary.id,scope});
  }
  useEffect(()=>setPrintRequest(null),[summary.id]);
  const [pair,setPair]=useState<{article:Article|null;initial?:Ruling}|null>(null);
  const trigger=useRef<HTMLElement|null>(null),readingAnchor=useRef<{no:string;offset:number}|null>(null),panelRef=useRef<HTMLElement>(null);
  function capturePosition(){const pane=scroll.current;if(!pane)return;const top=pane.getBoundingClientRect().top;const section=Array.from(pane.querySelectorAll<HTMLElement>('[data-article]')).find(el=>el.getBoundingClientRect().bottom>top);if(section)readingAnchor.current={no:section.dataset.article||'',offset:section.getBoundingClientRect().top-top};}
  const split=useRulingWidth(!!pair&&!mobile,capturePosition);
  useLayoutEffect(()=>{const anchor=readingAnchor.current,pane=scroll.current;if(anchor&&pane){const section=Array.from(pane.querySelectorAll<HTMLElement>('[data-article]')).find(el=>el.dataset.article===anchor.no);if(section)pane.scrollTop+=section.getBoundingClientRect().top-pane.getBoundingClientRect().top-anchor.offset;readingAnchor.current=null;}},[split.width]);
  function closePair(restoreFocus=true){capturePosition();setPair(null);onPairChange(false);if(restoreFocus)requestAnimationFrame(()=>trigger.current?.focus({preventScroll:true}));}
  function openPair(article:Article|null,initial?:Ruling){setRequestedFor(summary.id);capturePosition();trigger.current=document.activeElement as HTMLElement;setPair({article,initial});onPairChange(true);}
  function openRelated(r:Ruling){openPair(null,r);}
  useLayoutEffect(()=>{const anchor=readingAnchor.current,pane=scroll.current;if(anchor&&pane){const section=Array.from(pane.querySelectorAll<HTMLElement>('[data-article]')).find(el=>el.dataset.article===anchor.no);if(section)pane.scrollTop+=section.getBoundingClientRect().top-pane.getBoundingClientRect().top-anchor.offset;readingAnchor.current=null;}if(pair&&!mobile)panelRef.current?.focus({preventScroll:true});},[!!pair,mobile]);
  useEffect(()=>{setPair(null);onPairChange(false);},[summary.id,activeArticle,activeDocumentPage,activeUnit,navigationKey]);
  useEffect(()=>{if(!open){setPair(null);onPairChange(false);}},[open]);
  const [tab,setTab]=useState('full');const [within,setWithin]=useState('');const scroll=useRef<HTMLDivElement>(null);
  const targetNavigation=useRef({key:'',interrupted:false,aligned:false,awaitingCounts:false});
  const chapterNavigationKey=JSON.stringify([summary.id,activeArticle,activeDocumentPage,activeUnit,navigationKey]);
  const chapters=useMemo(()=>lawChapters(law?.articles||[]),[law]);
  const pathRanges=useMemo(()=>lawPathRanges(law?.articles||[]),[law]);
  const [chapterChoice,setChapterChoice]=useState<{key:string;chapter:string}|null>(null);
  const initialChapter=useMemo(()=>{
    let savedArticle='';try{savedArticle=JSON.parse(localStorage.getItem('openlawtw-position:'+summary.id)||'null')?.article||'';}catch{}
    return initialLawChapter(chapters,activeArticle,savedArticle);
  },[chapters,summary.id,activeArticle,chapterNavigationKey]);
  const chosenChapter=chapterChoice?.key===chapterNavigationKey?chapterChoice.chapter:initialChapter;
  const chapterIndex=chapters.findIndex(chapter=>chapter.id===chosenChapter);
  const selectedChapter=chapters[chapterIndex];
  function chooseChapter(chapter:string){
    targetNavigation.current.interrupted=true;
    if(pair)closePair(false);
    setWithin('');setChapterChoice({key:chapterNavigationKey,chapter});
    if(scroll.current)scroll.current.scrollTop=0;
  }
  const {counts,countsLoading,countsError,items:rulings,loading:rulingsLoading,error:rulingsError,retry:retryRulings}=useLawRulings(summary.id,open&&requestedFor===summary.id&&(!!pair||tab==='rulings'));
  useEffect(()=>{setTab('full');setWithin('');if(scroll.current)scroll.current.scrollTop=0;},[summary.id,activeArticle,activeDocumentPage,activeUnit,navigationKey]);
  useEffect(()=>{
    const key=JSON.stringify([summary.id,activeArticle,activeDocumentPage,activeUnit,navigationKey,tab]);
    const newNavigation=targetNavigation.current.key!==key;
    if(newNavigation)targetNavigation.current={key,interrupted:false,aligned:false,awaitingCounts:false};
    const navigation=targetNavigation.current,pane=scroll.current;
    // A result click changes the route one render before its effect clears the
    // previous search. That stale query is not a user interruption of the link.
    if(within&&!newNavigation)navigation.interrupted=true;
    if(!activeArticle||!law||law.id!==summary.id||tab!=='full'||!pane||within)return;
    // Loading count chips occupy rows in the article heading. When the counts
    // arrive, missing chips collapse those rows above the explicit target.
    // Correct that first layout change, unless the reader has taken control.
    const interrupt=()=>{navigation.interrupted=true;};
    const keydown=(event:KeyboardEvent)=>{if(['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(event.key))interrupt();};
    pane.addEventListener('wheel',interrupt,{passive:true});pane.addEventListener('touchstart',interrupt,{passive:true});pane.addEventListener('pointerdown',interrupt,{passive:true});pane.addEventListener('keydown',keydown);
    let frame=0;
    if(!navigation.interrupted&&(!navigation.aligned||(navigation.awaitingCounts&&!countsLoading)))frame=requestAnimationFrame(()=>{
      if(navigation.interrupted)return;
      const article=Array.from(pane.querySelectorAll('[data-article]')).find(element=>articleAddress(element.getAttribute('data-article')||'')===articleAddress(activeArticle));
      const unit=activeUnit?Array.from(article?.querySelectorAll('[data-unit]')||[]).find(element=>element.getAttribute('data-unit')===activeUnit):undefined;
      const target=unit||article;if(!target)return;
      target.scrollIntoView({block:'start',behavior:'instant'});navigation.aligned=true;navigation.awaitingCounts=countsLoading;
    });
    return()=>{cancelAnimationFrame(frame);pane.removeEventListener('wheel',interrupt);pane.removeEventListener('touchstart',interrupt);pane.removeEventListener('pointerdown',interrupt);pane.removeEventListener('keydown',keydown);};
  },[law,summary.id,activeArticle,activeDocumentPage,activeUnit,navigationKey,tab,countsLoading,within,chosenChapter]);
  useEffect(()=>{if(scroll.current)scroll.current.scrollTop=0;},[within]);
  useReadingPosition(scroll,summary.id,open&&!loading&&!!law&&law.id===summary.id&&tab==='full'&&!within,chapterChoice?.key===chapterNavigationKey?'':activeArticle,navigationKey,chosenChapter);
  const articles=useMemo(()=>visibleLawArticles(law?.articles||[],chapters,chosenChapter,within),[law,chapters,chosenChapter,within]);
  const parents=data.relations.filter(r=>r.child===summary.id);
  const children=data.relations.filter(r=>r.parent===summary.id);
  const relatedRulings=useMemo(()=>rulings.filter(r=>r.refs.some(x=>x.law===summary.id)),[rulings,summary.id]);
  const perArticle=useMemo(()=>{const m=new Map<string,Ruling[]>();for(const r of relatedRulings)for(const ref of r.refs)if(ref.law===summary.id&&ref.article){const key=normalize(ref.article);if(!m.get(key)?.some(item=>item.id===r.id))m.set(key,[...(m.get(key)||[]),r]);}return m;},[relatedRulings,summary.id]);
  const [relatedLimit,setRelatedLimit]=useState(30),[relatedQuery,setRelatedQuery]=useState('');
  useEffect(()=>{setRelatedLimit(30);setRelatedQuery('');},[summary.id]);
  const filteredRelated=useMemo(()=>relatedQuery.trim()?searchRulings(relatedRulings,relatedQuery):relatedRulings,[relatedRulings,relatedQuery]);
  const panel=pair?<RulingPanel key={summary.id+':'+(pair.article?.no||'law')+':'+(pair.initial?.id||'')} law={summary} article={pair.article} items={pair.article?perArticle.get(normalize(pair.article.no))||[]:relatedRulings} initial={pair.initial} count={pair.article?counts?.articles[normalize(pair.article.no)]:counts?.total} summariesLoading={rulingsLoading} summariesError={!!rulingsError} onRetry={retryRulings} onClose={()=>closePair()} onChoose={(id,no,unit)=>{closePair();onChoose(id,no,unit);}} onCopy={onCopy} saved={savedRulings} onSave={onSaveRuling}/>:null;
  return <div ref={split.container} className={'reader-comparison '+(pair&&!mobile?'is-open ':'')+(split.dragging?'is-resizing':'')} style={pair&&!mobile?{gridTemplateColumns:`${split.width}px 10px minmax(0,1fr)`}:undefined}><div className="reader" style={{height:'100%'}}>
    <div className="reader-top"><div className="reader-headingline"><div className="reader-breadcrumb"><BookOpen size={13}/>{summary.region}<ChevronRight size={11}/>{summary.category}</div><div className="law-badges"><span className="badge">{summary.kind}</span><span className={'badge '+(summary.coverage==='full'?'red':'gold')}>{summary.document?(summary.document.format==='html'?'官方原文文件':'圖文 PDF'):summary.coverage==='full'?'全文快照':'官方連結'}</span></div></div><h2>{summary.name}</h2><div className="reader-information"><div className="law-meta"><span>{summary.modified?'修正 '+summary.modified:'修正日期待核對'}</span><span>{(summary.articleCount||0)?(summary.articleCount||0)+' 條原文':summary.document?(summary.document.format==='html'?'正文與表格快照':summary.document.pages+' 頁官方 PDF'):'全文待收錄'}</span></div><div className="reader-actions"><a href={summary.url} target="_blank" rel="noreferrer" title="開啟官方全文與歷史版本"><ExternalLink size={13}/>官方原文</a><button disabled={loading||error||!law} onClick={()=>requestPrint()}><Printer size={13}/>列印</button><button className={saved?'is-saved':''} onClick={onSave} aria-pressed={saved}><Bookmark size={14} fill={saved?'currentColor':'none'}/>{saved?'已收藏':'收藏'}</button><DropdownMenu.Root><DropdownMenu.Trigger asChild><button aria-label="更多法規操作"><MoreHorizontal size={15}/>更多</button></DropdownMenu.Trigger><DropdownMenu.Portal><DropdownMenu.Content className="reader-tools-menu" align="end" sideOffset={6} collisionPadding={12}><DropdownMenu.Item className="reader-tools-item" onSelect={()=>onCopy(summary.name+'\n'+summary.url)}><Copy size={14}/>複製引用</DropdownMenu.Item><DropdownMenu.Item className="reader-tools-item" onSelect={()=>onCopy(shareURL()+lawHref(summary.id,chapterChoice?.key===chapterNavigationKey?(selectedChapter?.articles[0]?.no||''):activeArticle,chapterChoice?.key===chapterNavigationKey?'':activeUnit,summary.document?documentPage:0))}><Link2 size={14}/>複製連結</DropdownMenu.Item><DropdownMenu.Separator/><DropdownMenu.Item className="reader-tools-item" onSelect={()=>setTab('source')}><ExternalLink size={14}/>版本與官方附件</DropdownMenu.Item></DropdownMenu.Content></DropdownMenu.Portal></DropdownMenu.Root></div></div></div>
    {loading&&<div className="loading-line"/>}
    <Tabs value={tab} onValueChange={value=>{if(pair)closePair(false);if(value==='rulings')setRequestedFor(summary.id);setTab(value);}} className="reader-tabroot"><div className="reader-tabbar"><TabsList aria-label="法規內容"><TabsTrigger value="full">{summary.document?'原文文件':'條文'}</TabsTrigger><TabsTrigger value="rulings">解釋函令 <span className="tab-count">{counts?.total??(countsLoading?'…':'')}</span></TabsTrigger><TabsTrigger value="relations">法源</TabsTrigger><TabsTrigger value="source">版本・附件</TabsTrigger></TabsList>{tab==='full'&&summary.coverage==='full'&&<div className="article-search"><Search size={14}/><input value={within} onChange={e=>{if(pair)closePair(false);setWithin(e.target.value);}} aria-label="在此法規搜尋" placeholder="本法規內搜尋／條號" enterKeyHint="search"/>{within&&<button className="icon-btn" onClick={()=>{if(pair)closePair(false);setWithin('');}} aria-label="清除此法規搜尋"><X size={13}/></button>}<div className="font-controls"><button aria-label="縮小條文字級" disabled={fontSize<=16} onClick={()=>setFontSize(n=>n-2)}>A−</button><button aria-label="放大條文字級" disabled={fontSize>=22} onClick={()=>setFontSize(n=>n+2)}>A+</button></div></div>}</div>
      <TabsContent value="full" className="reader-scroll" ref={scroll}><div className="reading-column">
        {loading?<div className="empty-state"><ThinkingOrb/>正在載入官方條文快照…</div>:error?<div className="empty-state"><CircleHelp size={28}/><strong>全文暫時無法載入</strong><button className="plain-button" onClick={retry}>重試</button><br/><a href={summary.url} target="_blank" rel="noreferrer">開啟官方原文<ExternalLink size={14}/></a></div>:summary.document?<><div className="document-actions"><AddEvidenceButton key={summary.id+':'+documentPage} label={summary.document.format==='html'?'將原文加入案件':'將 PDF 第 '+documentPage+' 頁加入案件'} makeEvidence={()=>captureDocumentPage(evidenceLaw,documentPage)}/></div><DocumentReader key={summary.id} law={law||summary} mobile={mobile} initialPage={activeDocumentPage} navigationKey={navigationKey} onPage={page=>onChoose(summary.id,'','',page)} onVisiblePage={onVisibleDocumentPage}/></>:summary.coverage==='link'?<div className="empty-state"><Link2 size={28}/><strong>已建立官方連結</strong>這部法規尚未完成全文收錄。<br/>請由官方頁面核對現行條文。<a href={summary.url} target="_blank" rel="noreferrer">前往官方網站<ArrowUpRight size={15}/></a></div>:<>

          {((law?.attachments||summary.attachments).length>0||children.length>0)&&<nav className="law-resource-strip" aria-label="本法規資源"><span>本法規資源</span>{(law?.attachments||summary.attachments).length>0&&<button onClick={()=>setTab('source')}>官方附件 {(law?.attachments||summary.attachments).length}<ArrowUpRight size={12}/></button>}{children.length>0&&<button onClick={()=>setTab('relations')}>已收錄子法 {children.length}<ArrowUpRight size={12}/></button>}</nav>}
          {chapters.length>1&&<nav className="law-chapter-nav" aria-label="法規章節"><label>章節閱讀<select aria-label="選擇法規章節" value={chosenChapter} onChange={event=>chooseChapter(event.target.value)}><option value={ALL_CHAPTERS}>全文 · {law?.articles.length} 條</option>{chapters.map(chapter=><option key={chapter.id} value={chapter.id}>{chapter.title} · {articleRange(chapter.articles)}</option>)}</select></label><div className="law-chapter-meta"><span>{within.trim()?'搜尋範圍：本法規所有章節':selectedChapter?selectedChapter.articles[0].no+' — '+selectedChapter.articles.at(-1)!.no:'依官方順序閱讀全部條文'}</span><div className="law-chapter-paging"><button disabled={!!within.trim()||chapterIndex<=0} onClick={()=>chooseChapter(chapters[chapterIndex-1].id)} aria-label="上一章"><ChevronLeft size={13}/>上一章</button><button disabled={!!within.trim()||chapterIndex<0||chapterIndex>=chapters.length-1} onClick={()=>chooseChapter(chapters[chapterIndex+1].id)} aria-label="下一章">下一章<ChevronRight size={13}/></button></div></div></nav>}
          {within.trim()&&<div className="law-chapter-search-status" role="status"><span>全法規找到 {articles.length} 條{chapters.length>1?' · 涵蓋 '+new Set(articles.map(article=>chapterForArticle(chapters,article.no)?.id)).size+' 章':''}</span><button onClick={()=>setWithin('')}>返回閱讀</button></div>}
          {law?.effectiveNote&&<div className="status-line">生效說明：{law.effectiveNote}</div>}
          {law?.preamble&&!within.trim()&&(chosenChapter===ALL_CHAPTERS||chapterIndex===0)&&<div className="law-preamble" style={{whiteSpace:'pre-wrap',fontSize,lineHeight:1.9,marginBottom:24}}>{law.preamble}</div>}
          {articles.map((a,i)=><div key={a.no}>{a.path.length&&(i===0||a.path.join('/')!==articles[i-1].path.join('/'))?<div className="chapter-heading">{a.path.map((title,depth)=><span key={depth}>{depth>0&&' / '}{title}<small className="chapter-range">{pathRanges.get(JSON.stringify(a.path.slice(0,depth+1)))}</small></span>)}</div>:null}<section id={a.anchor} data-article={a.no} className={'article-section '+(!!activeArticle&&articleAddress(activeArticle)===articleAddress(a.no)?'target':'')+(pair?.article?.no===a.no?' comparing':'')}><div className="article-heading"><h3 className="article-no">{a.no}</h3><ArticleRulings article={a.no} count={counts?.articles[normalize(a.no)]??0} active={pair?.article?.no===a.no} loading={countsLoading} error={countsError} onOpen={()=>countsError?retryRulings():pair?.article?.no===a.no?closePair():openPair(a)}/>{children.some(r=>r.article&&articleAddress(r.article)===articleAddress(a.no))&&<details className="article-resources"><summary>子法 {children.filter(r=>r.article&&articleAddress(r.article)===articleAddress(a.no)).length}</summary><div>{children.filter(r=>r.article&&articleAddress(r.article)===articleAddress(a.no)).map(r=><button className="related-provision-link" key={r.child} onClick={()=>onChoose(r.child)}>{lawById.get(r.child)?.name}<ArrowUpRight size={11}/></button>)}</div></details>}<AddEvidenceButton key={summary.id+':'+a.no} title={'將'+summary.name+' '+a.no+'加入案件'} makeEvidence={()=>makeArticleEvidence(evidenceLaw,a)}/><ReferenceShareButton title={"分享或嵌入"+summary.name+" "+a.no} makeEvidence={()=>makeArticleEvidence(evidenceLaw,a)}/><button className="article-copy" aria-label={'複製'+a.no} onClick={()=>onCopy(summary.name+' '+a.no+'\n'+a.text+'\n'+summary.url)}><Copy size={13}/></button><div className="article-source-tools">{(()=>{const source=officialArticleSource(summary,a.no);return source?<a href={source.url} target="_blank" rel="noreferrer" aria-label={a.no+(source.exact?'官方原文':'官方全文（此來源未提供已核實的逐條定位）')} title={source.exact?'開啟本條官方原文':'此來源尚無已核實的逐條連結，開啟官方全文'}><ExternalLink size={12}/>{source.exact?'官方原文':'官方全文'}</a>:null;})()}<button aria-label={'列印'+a.no} onClick={()=>requestPrint(a.no)}><Printer size={12}/>列印</button></div></div><ArticleText article={a} law={evidenceLaw} query={within} fontSize={fontSize} onCopy={onCopy} onChoose={onChoose} activeUnit={activeUnit}/>{within.trim()&&chapters.length>1&&<button className="law-chapter-result-link" onClick={()=>onChoose(summary.id,a.no)}>在所屬章節閱讀<ChevronRight size={13}/></button>}</section></div>)}
          {!articles.length&&<div className="empty-state">此法規內沒有符合的條文。</div>}
          <div className="coverage-note">條文保留官方文字。圖表、公式與附表請至「版本・附件」開啟原檔。來源快照日期：{summary.snapshot||'來源頁面逐筆擷取'}。</div>
        </>}
      </div></TabsContent>
      <TabsContent value="relations" className="reader-scroll">
        <h3 className="reader-subtitle">{summary.kind==='法律'&&!parents.length?'法規層級':'訂定依據'}</h3>{parents.map(r=><div className="relation-link" key={r.parent}><button onClick={()=>onChoose(r.parent,r.article)}><GitBranch size={16}/>{lawById.get(r.parent)?.name} {r.article}</button><p>{r.evidence}</p><a className="plain-button" style={{fontSize:12}} href={r.source} target="_blank" rel="noreferrer">核對依據原文<ExternalLink size={12}/></a></div>)}{!parents.length&&<p style={{fontSize:13,color:'#8492a3'}}>{summary.kind==='法律'?'本法屬法律層級；法規沿革請見「版本・附件」。':'目前尚未建立可核對的訂定依據，請查閱官方原文。'}</p>}
        {children.length>0&&<><h3 className="reader-subtitle">依本法規訂定的已收錄規定</h3>{children.map(r=><div className="relation-link" key={r.child}><button onClick={()=>onChoose(r.child)}>{lawById.get(r.child)?.name}<ChevronRight size={14}/></button><p>{r.article}</p></div>)}</>}
      </TabsContent>
      <TabsContent value="rulings" className="reader-scroll"><div className="law-rulings-head"><div><h3>這部法規的解釋函令 <span>{counts?.total??relatedRulings.length}</span></h3><p>依原文明示名稱與條號連結；收錄不代表現時有效。</p></div><label className="ruling-search"><Search size={15}/><input aria-label="搜尋本法規相關函釋" placeholder="搜尋相關函釋，或輸入條號" value={relatedQuery} onChange={e=>{setRelatedQuery(e.target.value);setRelatedLimit(30);}}/>{relatedQuery&&<button aria-label="清除相關函釋搜尋" onClick={()=>setRelatedQuery('')}><X size={14}/></button>}</label></div>
      {rulingsError?<div className="coverage-note" role="alert">相關函釋摘要尚未下載，請連線後重試。<button className="plain-button" onClick={retryRulings}>重新載入函釋</button></div>:rulingsLoading?<p>正在載入函釋…</p>:<><div className="ruling-result-count">{filteredRelated.length} 筆</div>{filteredRelated.slice(0,relatedLimit).map(r=><RulingCard key={r.id} ruling={r} onClick={()=>openRelated(r)}/>)}{filteredRelated.length>relatedLimit&&<button className="load-more" onClick={()=>setRelatedLimit(n=>n+30)}>更多函釋<ChevronDown size={15}/></button>}{!filteredRelated.length&&<div className="empty-state">目前沒有相符的已收錄函釋。</div>}</>}
      </TabsContent>
      <TabsContent value="source" className="reader-scroll"><div className="reading-column source-reading-column">
        <VersionEvidence law={law||summary} summary={summary} batchDate={data.collected}/><h3 className="reader-subtitle">官方附件 · {(law?.attachments||summary.attachments).length}</h3><div className="link-list">{(law?.attachments||summary.attachments).map(a=><a href={a.url} key={a.url} target="_blank" rel="noreferrer"><ExternalLink size={14}/><span>{a.title}</span></a>)}</div>{!(law?.attachments||summary.attachments).length&&<p className="source-empty">目前資料未列附件。</p>}
        {law?.history&&<><h3 className="reader-subtitle">法規沿革</h3><LawHistory history={law.history}/></>}
        </div>
      </TabsContent>
    </Tabs>
  </div>{pair&&!mobile&&<div className="ruling-resizer" {...split.separator}><span/></div>}{pair&&!mobile&&<aside className="ruling-side-panel" ref={panelRef} tabIndex={-1} aria-label="條文旁函釋閱讀區" onKeyDown={e=>{if(e.key==='Escape')closePair();}}>{panel}</aside>}
  <Sheet open={!!pair&&mobile} onOpenChange={v=>{if(!v)closePair();}}><SheetContent side="bottom" className="ruling-bottom-sheet" showCloseButton={false} onCloseAutoFocus={e=>{e.preventDefault();trigger.current?.focus({preventScroll:true});}}><SheetTitle className="sr-only">{pair?.article?.no||'本法規'}解釋令</SheetTitle><SheetDescription className="sr-only">閱讀相關函釋，關閉後回到原條文。</SheetDescription>{mobile&&panel}</SheetContent></Sheet>
  {printRequest?.lawId===summary.id&&law&&<LawPrintDialog key={summary.id} law={evidenceLaw} initial={printRequest.scope} onClose={()=>setPrintRequest(null)} onRestoreFocus={()=>printTrigger.current?.focus({preventScroll:true})}/>}
  </div>;
}
