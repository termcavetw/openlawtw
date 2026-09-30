import {useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {HoverCard} from 'radix-ui';
import {ArrowLeft,ArrowUpRight,Bookmark,ChevronDown,ChevronRight,Copy,ExternalLink,FileText,Link2,Search,X} from 'lucide-react';
import type {Law,Ruling} from '@/lib/law-types';
import {normalize,searchRulings} from '@/lib/search';
import {LegalReferenceText} from './legal-reference-text';
import type {ChooseLaw} from '@/lib/routes';
import {loadJSON,shareURL} from '@/lib/portable';
import {indexedRulings,loadRuling} from '@/lib/data-client';
import {AddEvidenceButton} from './casebook';
import {ReferenceShareButton} from './reference-share';
import {makeRulingEvidence} from '@/lib/casebook';
import {data} from '@/lib/catalog';
import {RulingCard} from './ruling-card';
export {RulingCard};

export function RulingExplorer({items,loading,error,retry,onOpen,selected,saved,onSavedOnly}:{items:Ruling[];loading:boolean;error:boolean;retry:()=>void;onOpen:(r:Ruling)=>void;selected:string;saved:string[];onSavedOnly?:boolean}){
 const [composing,setComposing]=useState(false);
 const [q,setQ]=useState(''),[query,setQuery]=useState(''),[topic,setTopic]=useState('全部主題'),[status,setStatus]=useState('all'),[limit,setLimit]=useState(30),[order,setOrder]=useState('new');
 useEffect(()=>{if(composing)return;const timer=setTimeout(()=>setQuery(q),160);return()=>clearTimeout(timer);},[q,composing]);
 useEffect(()=>setLimit(30),[query,topic,status,order,onSavedOnly]);
 const [matched,setMatched]=useState<Ruling[]>([]),[searching,setSearching]=useState(false),[incomplete,setIncomplete]=useState(false);
 useEffect(()=>{if(!query.trim()){setMatched([]);setSearching(false);setIncomplete(false);return;}const controller=new AbortController();setSearching(true);setIncomplete(false);indexedRulings(query,controller.signal).then(result=>{setMatched(result.items);setIncomplete(result.missing>0);}).catch(e=>{if(e.name!=='AbortError')setIncomplete(true);}).finally(()=>{if(!controller.signal.aborted)setSearching(false);});return()=>controller.abort();},[query]);
 const topics=useMemo(()=>Array.from(new Set(items.map(r=>r.topic))),[items]);
 const found=useMemo(()=>{
   const pool=(query.trim()?matched:items).filter(r=>(!onSavedOnly||saved.includes(r.id))&&(topic==='全部主題'||r.topic===topic)&&(status==='all'||r.status==='mentioned'));
   const result=pool;
   return order==='old'?[...result].sort((a,b)=>(a.date||a.published).localeCompare(b.date||b.published)):result;
 },[items,matched,query,topic,status,saved,onSavedOnly,order]);
 return <div className="ruling-explorer"><div className="section-top"><div><div className="eyebrow">INTERPRETATIONS</div><h2>{onSavedOnly?'收藏的函釋':'解釋函令'}</h2><p>從字號、議題，或引用條文開始。</p></div></div>
  <div className="ruling-overview"><strong>{items.length.toLocaleString()}</strong><span>筆官方原文<br/><small>國土署公開目錄快照</small></span></div>
  <label className="ruling-search"><Search size={16}/><input value={q} onCompositionStart={()=>setComposing(true)} onCompositionEnd={e=>{setComposing(false);setQ(e.currentTarget.value);}} onChange={e=>setQ(e.target.value)} placeholder="如：建技90、室內裝修、字號" aria-label="搜尋解釋函令"/>{q&&<button aria-label="清除函釋搜尋" onClick={()=>setQ('')}><X size={14}/></button>}</label>
  <div className="ruling-filters"><select value={topic} onChange={e=>setTopic(e.target.value)} aria-label="函釋主題"><option>全部主題</option>{topics.map(t=><option key={t}>{t}</option>)}</select><select value={order} onChange={e=>setOrder(e.target.value)} aria-label="函釋排序"><option value="new">新到舊</option><option value="old">舊到新</option></select></div>
  <label className="ruling-status-filter"><input type="checkbox" checked={status==='mentioned'} onChange={e=>setStatus(e.target.checked?'mentioned':'all')}/>內文含效力異動註記</label>
  <div className="ruling-result-count" role="status">{loading||searching?'正在搜尋官方函釋…':error||incomplete?'部分函釋尚未下載，結果不完整':`${found.length.toLocaleString()} 筆${onSavedOnly?'收藏':''}結果`}</div>
  {error&&<button className="plain-button" onClick={retry}>重新載入函釋</button>}
  {found.slice(0,limit).map(r=><RulingCard key={r.id} ruling={r} selected={selected===r.id} onClick={()=>onOpen(r)}/>)}
  {!loading&&!searching&&!incomplete&&!error&&!found.length&&<div className="empty-state"><FileText size={26}/><strong>沒有符合條件的函釋</strong><span>試試較短的字詞，或調整主題。</span></div>}
  {found.length>limit&&<button className="load-more" onClick={()=>setLimit(n=>n+30)}>更多函釋<small>{limit} / {found.length}</small><ChevronDown size={14}/></button>}
  <p className="coverage-note">國土署中央函釋包含建管、都市計畫、都更與住宅等業務；不隨地方法規篩選。收錄不等於現時有效，請核對官方原函及後續規定。</p>
  <a className="plain-button" href="https://www.nlma.gov.tw/ch/sglarticle/buildinterp" target="_blank" rel="noreferrer">官方年度彙編與援引原則<ArrowUpRight size={14}/></a>
 </div>;
}

export function ArticleRulings({count,onOpen,article,active=false,loading=false,error=false}:{count:number;onOpen:()=>void;article:string;active?:boolean;loading?:boolean;error?:boolean}){
 if(!count&&!loading&&!error)return null;
 return <button type="button" className="article-rulings-trigger" data-state={active?'open':'closed'} aria-expanded={active} aria-controls="article-ruling-panel" aria-label={`${article}解釋令（${loading?'載入中':error?'尚未載入':count+' 筆'}）`} disabled={loading} onClick={onOpen}><FileText size={14}/><span className="ruling-trigger-label">函釋</span><b>{loading?'…':error?'?':count}</b><ChevronRight size={12}/></button>;
}

function Citation({ruling,children,onOpen}:{ruling:Ruling;children:ReactNode;onOpen:(r:Ruling)=>void}){
 const [body,setBody]=useState(ruling.body),[failed,setFailed]=useState(false);
 return <HoverCard.Root onOpenChange={open=>{if(open&&ruling.summaryOnly&&!body){setFailed(false);loadRuling(ruling.id).then(r=>setBody(r.body||'官方僅提供主旨與字號。')).catch(()=>setFailed(true));}}} openDelay={280} closeDelay={160}><HoverCard.Trigger asChild><button className="inline-citation" onClick={()=>onOpen(ruling)} aria-label={'閱讀函釋 '+ruling.number}>{children}</button></HoverCard.Trigger><HoverCard.Portal><HoverCard.Content className="ruling-hover" sideOffset={8} collisionPadding={16}><div className="eyebrow">引用函釋 · 官方原文</div><strong>{ruling.title}</strong><small>{ruling.number}</small><div>{body||(failed?'此函釋全文尚未下載，請連線後重試。':'正在載入原文…')}</div><p>現時適用狀態待核對。點選字號可開啟閱讀。</p><HoverCard.Arrow className="ruling-hover-arrow"/></HoverCard.Content></HoverCard.Portal></HoverCard.Root>;
}

function RulingText({ruling,byId,onOpen,onChoose,evidence=[]}:{ruling:Ruling;byId:Map<string,Ruling>;onOpen:(r:Ruling)=>void;onChoose:ChooseLaw;evidence?:string[]}){
 const parts:ReactNode[]=[];const keys=new Map<string,Ruling>();
 const markOnly=(text:string)=>{const needles=evidence.filter(e=>e&&text.includes(e)).sort((a,b)=>b.length-a.length);if(!needles.length)return text;const escaped=needles.map(e=>e.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));const re=new RegExp('('+escaped.join('|')+')','g');return text.split(re).map((part,i)=>needles.includes(part)?<mark className="ruling-evidence-mark" key={i}>{part}</mark>:part);};
 const markEvidence=(text:string)=><LegalReferenceText text={text} onChoose={onChoose} renderText={markOnly}/>;
 for(const id of ruling.citations){const r=byId.get(id);if(r?.numberKey)keys.set(r.numberKey,r);}
 // Match the written digits, preserving every source character in the display.
 const digitMap:Record<string,string>={零:'0',〇:'0','○':'0',一:'1',二:'2',三:'3',四:'4',五:'5',六:'6',七:'7',八:'8',九:'9'};
 const regex=/[0-9０-９一二三四五六七八九零〇○]{7,}\s*號/g;let start=0;
 for(const match of ruling.body.matchAll(regex)){
   const digits=match[0].normalize('NFKC').replace(/[號\s]/g,'').replace(/[零〇○一二三四五六七八九]/g,c=>digitMap[c]);
   const linked=keys.get(digits);if(!linked)continue;
   parts.push(markEvidence(ruling.body.slice(start,match.index)),<Citation key={match.index} ruling={linked} onOpen={onOpen}>{match[0]}</Citation>);start=match.index+match[0].length;
 }
 parts.push(markEvidence(ruling.body.slice(start)));return <>{parts}</>;
}

function ReferencePreview({law,article,onChoose}:{law:Law;article:string;onChoose:(id:string,article?:string,unit?:string)=>void}){
 const [opened,setOpened]=useState(false),[text,setText]=useState(''),[error,setError]=useState(false);
 useEffect(()=>{if(!opened||text||!article)return;let live=true;loadJSON<Law>('/data/laws/'+encodeURIComponent(law.id)+'.json').then(doc=>{if(live)setText(doc.articles.find(a=>normalize(a.no)===normalize(article))?.text||'本庫快照未找到此條文。');}).catch(()=>{if(live)setError(true);});return()=>{live=false;};},[opened,law.id,article,text]);
 return <details className="ruling-law-ref" onToggle={e=>setOpened(e.currentTarget.open)}><summary><ChevronRight size={13}/><span>{law.name} <b>{article||'法規名稱引用'}</b></span></summary>{opened&&<div>{article?<p>{error?'條文未能載入，請開啟官方來源核對。':text||'正在載入條文…'}</p>:<p>原文提到這部法規，未建立特定條號關聯。</p>}<button onClick={()=>onChoose(law.id,article)}>閱讀本庫法規快照<ArrowUpRight size={13}/></button></div>}</details>;
}

export function RulingReader({ruling,items,lawById,onBack,backLabel,onOpen,onChoose,onCopy,saved,onSave,reference}:{ruling:Ruling;items:Ruling[];lawById:Map<string,Law>;onBack:()=>void;backLabel:string;onOpen:(r:Ruling)=>void;onChoose:(id:string,article?:string,unit?:string)=>void;onCopy:(s:string)=>void;saved:boolean;onSave:()=>void;reference?:{law:string;article:string}}){
 const [font,setFont]=useState(reference?16:18),[showRefs,setShowRefs]=useState(false),[backLimit,setBackLimit]=useState(10),[fullTitle,setFullTitle]=useState(false);const scroll=useRef<HTMLDivElement>(null);
 const byId=useMemo(()=>new Map(items.map(r=>[r.id,r])),[items]);
 const backlinks=useMemo(()=>items.filter(r=>r.citations.includes(ruling.id)),[items,ruling.id]);
 const evidence=useMemo(()=>[...new Set(ruling.refs.filter(r=>reference&&r.law===reference.law&&(!reference.article||normalize(r.article)===normalize(reference.article))).map(r=>r.evidence).filter(Boolean))],[ruling,reference?.law,reference?.article]);
 useEffect(()=>{if(scroll.current)scroll.current.scrollTop=0;setShowRefs(false);setBackLimit(10);setFullTitle(false);},[ruling.id]);
 return <div className="ruling-reader"><div className="ruling-reader-top"><button className="ruling-back" onClick={onBack}><ArrowLeft size={15}/><span>返回 {backLabel}</span></button><div className="ruling-document-meta"><span>解釋函令</span><span>{ruling.unit}</span><span>{ruling.date?'發文 '+ruling.date:'發文日期待核對'}</span></div><h2 className={fullTitle?'expanded-title':''}>{ruling.title}</h2>{ruling.title.length>60&&<button className="ruling-title-toggle" aria-expanded={fullTitle} onClick={()=>setFullTitle(v=>!v)}>{fullTitle?'收合主旨':'展開完整主旨'}<ChevronDown size={12}/></button>}<div className="ruling-number">{ruling.number||'此筆字號尚待核對'}</div><div className="ruling-actions"><a href={ruling.url} target="_blank" rel="noreferrer"><ExternalLink size={14}/>官方原文</a><button onClick={()=>onCopy(ruling.number+'\n'+ruling.title+'\n'+ruling.body+'\n'+ruling.url)}><Copy size={14}/>複製引用</button><button onClick={()=>onCopy(shareURL()+'/#ruling='+ruling.id)}><Link2 size={14}/>連結</button><AddEvidenceButton key={ruling.id} title={'將函釋 '+(ruling.number||ruling.title)+'加入案件'} makeEvidence={async()=>makeRulingEvidence(ruling.summaryOnly?await loadRuling(ruling.id):ruling,{region:'中央',observedAt:data.rulingStats.retrieved})}/><ReferenceShareButton title={"分享或嵌入函釋 "+(ruling.number||ruling.title)} makeEvidence={async()=>makeRulingEvidence(ruling.summaryOnly?await loadRuling(ruling.id):ruling,{region:"中央",observedAt:data.rulingStats.retrieved})}/><button onClick={onSave} aria-pressed={saved}><Bookmark size={14} fill={saved?'currentColor':'none'}/>{saved?'已收藏':'收藏'}</button><div className="font-controls"><button onClick={()=>setFont(n=>n-2)} disabled={font<=16} aria-label="縮小函釋字級">A−</button><button onClick={()=>setFont(n=>n+2)} disabled={font>=22} aria-label="放大函釋字級">A+</button></div></div></div>
  <div className="ruling-reader-tabs" role="group" aria-label="函釋閱讀內容"><button aria-pressed={!showRefs} onClick={()=>setShowRefs(false)}>函釋原文</button><button aria-pressed={showRefs} onClick={()=>setShowRefs(true)}>引用與後續函釋 <span>{ruling.refs.length+ruling.citations.length+backlinks.length}</span></button></div>
  <div className="ruling-reader-scroll" ref={scroll}><div className="ruling-reading-column">
  {!showRefs?<><div className={'ruling-context '+(ruling.status==='mentioned'?'attention':'')}><FileText size={15}/><p>{ruling.status==='mentioned'?'內文含「停止適用／廢止」等註記，可能指其他函令；請詳閱原文及後續函釋。':'官方原文快照；收錄不代表目前仍可援引。'}<small>引用條文連至本庫快照，非發文當時版本。</small></p></div>{evidence.length>0&&<div className="ruling-evidence"><small>原文明示引用</small>{evidence.map(e=><p key={e}>{e}</p>)}</div>}<div className="ruling-fulltext" style={{fontSize:font}}>{!ruling.body&&<p className="ruling-no-body">官方此項僅列主旨與字號，未提供其他本文。請由官方原文或年度彙編核對完整函令。</p>}<RulingText ruling={ruling} byId={byId} onOpen={onOpen} onChoose={onChoose} evidence={evidence}/></div>
    {!!ruling.attachments.length&&<div className="ruling-attachment-block"><h3>原文附件與連結 <span>{ruling.attachments.length}</span></h3>{ruling.attachments.map((a,i)=><a key={a.url+i} href={a.url} target="_blank" rel="noreferrer"><ExternalLink size={14}/>{a.title}</a>)}</div>}
    {!!(ruling.refs.length+ruling.citations.length+backlinks.length)&&<button className="ruling-related-jump" onClick={()=>{setShowRefs(true);if(scroll.current)scroll.current.scrollTop=0;}}>對照引用條文與後續函釋<ChevronRight size={15}/></button>}
    <div className="coverage-note">來源：國土管理署公開目錄 · 網站發布 {ruling.published||'待核對'} · 文字、表格以純文字收錄，圖片與附件請開啟官方原檔。發文日期與網站發布日期可能不同。</div>
  </>:<><h3 className="reader-subtitle">引用法規 · {ruling.refs.length}</h3><p className="reference-method">依原文明示法規名稱、條號建立。可展開對照本庫條文；未連結不代表沒有其他依據。</p>{ruling.refs.map(ref=>{const law=lawById.get(ref.law);return law?<ReferencePreview key={ref.law+ref.article} law={law} article={ref.article} onChoose={onChoose}/>:null;})}
    <h3 className="reader-subtitle">本函引用的已收錄函釋 · {ruling.citations.length}</h3>{ruling.citations.map(id=>byId.get(id)).filter((r):r is Ruling=>!!r).map(r=><RulingCard key={r.id} ruling={r} onClick={()=>onOpen(r)}/>)}
    <h3 className="reader-subtitle">引用本函的其他函釋 · {backlinks.length}</h3><p className="reference-method">由字號或官方連結比對，並不代表變更或取代本函。</p>{backlinks.slice(0,backLimit).map(r=><RulingCard key={r.id} ruling={r} onClick={()=>onOpen(r)}/>)}{backlinks.length>backLimit&&<button className="load-more" onClick={()=>setBackLimit(n=>n+20)}>更多引用函釋<ChevronDown size={14}/></button>}
    {!ruling.refs.length&&!ruling.citations.length&&!backlinks.length&&<p className="coverage-note">此筆尚未建立已收錄資料間的關聯，請核對官方原文。</p>}
  </>}
  </div></div>
 </div>;
}
