export type ArticleFigure={title:string;source:string;sourcePage:string;sha256:string;retrieved:string;versionNote:string;pdf:string;images:{src:string;width:number;height:number;page:number;alt:string;sha256:string;sourceRect:number[]}[]};
export type LegalUnit = {id:string;kind:'paragraph'|'item'|'subitem';number:number;start:number;end:number;children:LegalUnit[]};
export type Article = { figures?:ArticleFigure[]; no: string; text: string; path: string[];id?:string;anchor?:string;contentHash?:string;structure?:{status:'parsed'|'unparsed';method:string;units:LegalUnit[];reason?:string};officialAmendedAt?:string|null };
export type Attachment = { title: string; url: string };
export type Law = {
  id: string; name: string; region: string; category: string; kind: string;
  url: string; source: string; coverage: 'full' | 'link';
  modified: string; effective: string; effectiveNote: string; snapshot: string; retrieved: string;
  status: string; preamble?: string; articleCount?: number; articles: Article[]; history: string; attachments: Attachment[];
  document?:{format?:'pdf'|'html';startPage?:number;endPage?:number;pages:number;source:string;sourcePage:string;sha256:string;versionNote:string;retrieved:string};keywords: string[]; note?: string;schemaVersion?:number;contentHash?:string;sourceRecordId?:string;version?:{observedAt:string;previousContentHash:string|null;officialModified:string;effectiveDate:string};
};
export type Relation = { parent: string; child: string; article: string; evidence: string; source: string; label: string };
export type Ruling = { id: string; title: string; number: string; numberKey: string; date: string; published: string; modified: string; body: string; url: string; unit: string; topic: string; refs: {law: string; article: string; evidence: string}[]; status: 'mentioned' | 'unchecked'; attachments: Attachment[]; citations: string[];summaryOnly?:boolean };
export type LawRulingCounts={total:number;articles:Record<string,number>};
export type RulingCounts=Record<string,LawRulingCounts>;
export type RulingStats = { count: number; retrieved: string; source: string; feed: string; sha256: string; dated: number; numbered: number; articleLinks: number; crossLinks: number; attachmentLinks: number; statusMentions: number; bodyCount: number; headerOnlyCount: number; uniqueNumbers: number; units: Record<string,number> };
export type RulingArchive = { stats: RulingStats; items: Ruling[] };
export type Region = { name: string; url: string; kind: string };
export type Resource = { title: string; description: string; region: string; category: string; url: string };
export type SyncOutcome = {id:string;name:string;status:'updated'|'unchanged'|'retained'|'unavailable'|'not-attempted';attemptedAt:string|null;lastSuccessfulFetch:string|null;reason?:string};
export type SyncStatus = {attemptedAt:string;summary:Record<string,unknown>;outcomes:SyncOutcome[]};
export type Catalog = { syncStatus?:SyncStatus; version: string; collected: string; snapshot: string; laws: Law[]; regions: Region[]; categories: string[]; relations: Relation[]; rulingStats: RulingStats; resources: Resource[]; notes: string[] };
export type DataFile={url:string;sha256:string;bytes:number;encoding?:'gzip'};
export type MinutesPage={n:number;ocr:boolean;text:string};
// A table rebuilt by the table model: it stands for page text lines from..to-1; a cell is [text] or [text,colspan,rowspan].
export type PageTable={from:number;to:number;rows:([string]|[string,number,number])[][]};
export type MinutesItem={id:string;title:string;url:string;year:number|null;sortDate:string;docNo:string;docDate:string;issuer:string;manual?:boolean;sha256:string|null;pages:MinutesPage[]};
export type MinutesArchive={source:string;sourceUrl:string;note:string;region:string;fetchedAt:string;stats:{listed:number;items:number;manual:number;pages:number;ocrPages:number};items:MinutesItem[]};
export type MinutesFile=DataFile&{region:string;fetchedAt:string;items:number;pages:number;ocrPages:number};
export type LanduseItem={id:string;caseId:number;area:string;areaId:string;title:string;kind:string;type:string;docNo:string;date:string;year:number|null;url:string;files:{name:string;url:string}[];sha256:string;pages:(MinutesPage&{tables?:PageTable[]})[]};
export type LanduseArchive={source:string;sourceUrl:string;note:string;region:string;fetchedAt:string;stats:{listed:number;items:number;areas:number;pages:number;ocrPages:number;deferred:number};items:LanduseItem[]};
export type LanduseFile=DataFile&{region:string;fetchedAt:string;items:number;areas:number;pages:number;ocrPages:number};
export type AgriItem={id:number;cls:string;date:string;docNo:string;issuer:string;title:string;body:string;laws:string[];url:string};
export type AgriArchive={source:string;sourceUrl:string;note:string;issuer:string;fetchedAt:string;stats:{listed:number;items:number;failed:number;interpretationOrders:number;laws:{name:string;items:number}[]};items:AgriItem[]};
export type AgriFile=DataFile&{fetchedAt:string;items:number};
// 農業部 letters per central law: ids newest first, per normalized article no; heads[id]=[date, docNo, title].
export type AgriRefs={laws:Record<string,{ids:number[];articles:Record<string,number[]>}>;heads:Record<string,[string,string,string]>};
// 臺北市解釋令函 (laws.gov.taipei): refs are the city's own related-law filing.
export type TaipeiRef={scope:string;law:string;version:string;articles:string[]};
export type TaipeiItem={id:string;category:string;date:string;docNo:string;issuer:string;summary:string;body:string;refs:TaipeiRef[];url:string};
export type TaipeiArchive={source:string;sourceUrl:string;note:string;region:string;fetchedAt:string;stats:{listed:number;items:number;failed:number;withRefs:number;categories:{name:string;items:number}[]};items:TaipeiItem[]};
// 新北市政府工務局 建照業務工作手冊: one PDF edition parsed into cases.
export type NtpcCase={no:string;prev:string;chapter:string;basis:string;question:string;rule:string;note:string;page:string;pdfPage:number};
export type NtpcManual={source:string;sourceUrl:string;note:string;region:string;edition:string;sha256:string;fetchedAt:string;stats:{cases:number;chapters:{name:string;cases:number}[]};cases:NtpcCase[]};
// 內政部地政司 地政法令彙編 解釋函 (a preserved export): refs are the compilation's own law-article filing.
export type LandItem={id:string;date:string;docNo:string;issuer:string;summary:string;body:string;refs:{law:string;article:string}[]};
export type LandArchive={source:string;sourceUrl:string;note:string;issuer:string;fetchedAt:string;stats:{items:number;sections:number;undated:number;laws:{name:string;items:number}[]};items:LandItem[]};
// Central agencies' letters filed under central laws in laws.gov.taipei (消防、經濟部、農業部 等).
export type CentralItem={id:string;date:string;docNo:string;issuer:string;summary:string;body:string;filed:{law:string;article:string}[];refs:TaipeiRef[];url:string};
export type CentralArchive={source:string;sourceUrl:string;note:string;fetchedAt:string;laws:{id:string;name:string;topic:string}[];stats:{listed:number;items:number;failed:number;topics:{name:string;items:number}[];issuers:{name:string;items:number}[]};items:CentralItem[]};
// 內政部消防署 消防法令查詢系統 法令解釋／執法疑義 (a preserved export collected in the user's browser).
export type NfaRef={law:string;articles:string[];version:string;historical:boolean};
export type NfaItem={id:string;kind:string;category:string;date:string;docNo:string;issuer:string;summary:string;body:string;refs:NfaRef[];origin:string;abolished:boolean};
export type NfaArchive={source:string;sourceUrl:string;note:string;issuer:string;fetchedAt:string;stats:{items:number;kinds:Record<string,number>;summaryOnly:number;abolished:number;laws:{name:string;items:number}[]};items:NfaItem[]};
export type TaipeiRefs={laws:Record<string,{ids:string[];articles:Record<string,string[]>}>;heads:Record<string,[string,string,string]>};
export type DataManifest={minutes?:MinutesFile;landuse?:LanduseFile;agri?:AgriFile;agriRefs?:DataFile&{laws:string[]};taipei?:AgriFile;nfa?:AgriFile;nfaRefs?:DataFile&{laws:string[]};central?:AgriFile;centralRefs?:DataFile&{laws:string[]};land?:AgriFile;landRefs?:DataFile&{laws:string[]};ntpcManual?:DataFile&{fetchedAt:string;edition:string;cases:number};taipeiRefs?:DataFile&{laws:string[]};syncStatus?:DataFile;schemaVersion:2;release:string;collected:string;universe?:DataFile;universeRulings?:DataFile;documents?:Record<string,DataFile>;documentTexts?:Record<string,DataFile>;documentReaders?:Record<string,DataFile>;laws:Record<string,DataFile>;related:Record<string,DataFile>;rulings:Record<string,DataFile>;rulingHeads:DataFile;rulingCounts:DataFile;indexes:{kind:'laws'|'rulings';region:string;file:DataFile}[];packs:{id:string;label:string;lawCount:number;files:DataFile[];bytes:number}[];provenance:DataFile;history:DataFile;files:DataFile[]};

