import {useState} from 'react';
import {CoverageChecklist} from './coverage-checklist';
import {Download,ArrowUpRight,ExternalLink} from 'lucide-react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Table,TableHeader,TableHead,TableBody,TableRow,TableCell} from '@/components/ui/table';
import {data} from '@/lib/catalog';
import {manifest,mapLimit,loadFile} from '@/lib/data-client';
import {isPortable,downloadCatalog} from '@/lib/portable';
import type {Ruling} from '@/lib/law-types';
import {toast} from 'sonner';
const number=(n:number)=>n.toLocaleString('zh-TW'),dateText=(s:string)=>s?s.split('T')[0]:'未提供';
export function DataSources({open,onOpenChange,region,onChoose}:{open:boolean;onOpenChange:(v:boolean)=>void;region:string;onChoose:(id:string)=>void}){const [tab,setTab]=useState('coverage');return (
<Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="docdialog coverage-dialog"><DialogTitle>收錄範圍與資料來源</DialogTitle><DialogDescription>openlawtw 建築法規庫 · v{data.version} · 官方資料快照</DialogDescription>
      <div className="source-tabs" role="group" aria-label="資料檢視"><button aria-pressed={tab==='coverage'} onClick={()=>setTab('coverage')}>收錄清單</button><button aria-pressed={tab==='sources'} onClick={()=>setTab('sources')}>來源與下載</button></div>
      {tab==='coverage'?<CoverageChecklist key={region} region={region} onChoose={id=>{onOpenChange(false);onChoose(id);}}/>:<section className="source-details">
      <div className="source-stats"><div><strong>{data.laws.filter(l=>l.coverage==='full').length}</strong><span>部法規全文</span></div><div><strong>{number(data.laws.reduce((s,l)=>s+(l.articleCount||0),0))}</strong><span>條原文</span></div><div><strong>22</strong><span>縣市官方入口</span></div><div><strong>{number(data.rulingStats.count)}</strong><span>筆官方函釋原文</span></div></div>
      <p>中央法規取自法務部開放資料，官方快照：{data.snapshot}。地方全文逐筆擷取官方頁面。擷取日期：{dateText(data.collected)}。本次為資料快照；原始碼已附每週同步與差異審核流程，須在部署儲存庫啟用。</p>
      <p>分類樹是編輯分類；法源圖保留條文明示依據。圖表、公式與附件請開啟官方檔案。尚未完整收錄各縣市法規、全部函釋及歷史版本，查無結果不代表沒有規定。</p>
      <Table className="source-table"><TableHeader><TableRow><TableHead>地區</TableHead><TableHead>條文全文</TableHead><TableHead>原文文件</TableHead><TableHead>僅連結</TableHead><TableHead>官方入口</TableHead></TableRow></TableHeader><TableBody>{['中央',...data.regions.map(r=>r.name)].map(r=><TableRow key={r}><TableCell>{r}</TableCell><TableCell>{data.laws.filter(l=>l.region===r&&l.coverage==='full').length}</TableCell><TableCell>{data.laws.filter(l=>l.region===r&&l.document).length}</TableCell><TableCell>{data.laws.filter(l=>l.region===r&&l.coverage==='link'&&!l.document).length}</TableCell><TableCell><a href={r==='中央'?'https://law.moj.gov.tw/':data.regions.find(x=>x.name===r)!.url} target="_blank" rel="noreferrer" style={{color:'#315a85'}}>查詢 ↗</a></TableCell></TableRow>)}</TableBody></Table>
      <p>函釋包含 {number(data.rulingStats.bodyCount)} 筆本文及 {data.rulingStats.headerOnlyCount} 筆僅列主旨、字號的項目；官方同字號不同條目保留個別來源。函釋取自國土署公開目錄，擷取日期 {data.rulingStats.retrieved}。含 {number(data.rulingStats.articleLinks)} 筆明示條號關聯、{number(data.rulingStats.crossLinks)} 筆函釋引用關聯；自動比對不表示法規效力判斷。部分字號或發文日期待核對。</p><p>原創程式採 MIT 授權。法規內容保留官方來源與原資料授權；程式授權不覆蓋第三方素材或法規資料。原始碼包含資料整理腳本、收錄清單及貢獻說明。</p>
      <div><a className="download-link" href={isPortable()?'https://openlawtw.vercel.app/openlawtw-source.zip':'/openlawtw-source.zip'} download><Download size={16}/>下載原始碼</a><a className="plain-button" href="/data/catalog.json" download onClick={e=>{if(isPortable()){e.preventDefault();downloadCatalog(data);}}}>下載索引 JSON<ArrowUpRight size={15}/></a><button className="plain-button" onClick={async()=>{toast.loading('正在準備完整函釋資料…',{id:'export'});try{const results=await mapLimit(Object.values(manifest.rulings),f=>loadFile<Ruling[]>(f));if(results.some(r=>r.status==='rejected'))throw Error();const items=results.flatMap(r=>r.status==='fulfilled'?r.value:[]);downloadCatalog({stats:data.rulingStats,items},'openlawtw-rulings-v'+data.version+'.json');}catch{toast.error('部分資料尚未下載，請連線後再匯出。');}finally{toast.dismiss('export');}}}>下載函釋與字號對照 JSON<ArrowUpRight size={15}/></button></div>
      <div className="link-list"><a href="https://data.gov.tw/dataset/18289" target="_blank" rel="noreferrer"><ExternalLink size={14}/>中央法律資料集</a><a href="https://data.gov.tw/dataset/18290" target="_blank" rel="noreferrer"><ExternalLink size={14}/>中央命令資料集</a></div>
    </section>}
    </DialogContent></Dialog>);}
