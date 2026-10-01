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
export type Catalog = { version: string; collected: string; snapshot: string; laws: Law[]; regions: Region[]; categories: string[]; relations: Relation[]; rulingStats: RulingStats; resources: Resource[]; notes: string[] };
export type DataFile={url:string;sha256:string;bytes:number;encoding?:'gzip'};
export type DataManifest={schemaVersion:2;release:string;collected:string;universe?:DataFile;universeRulings?:DataFile;documents?:Record<string,DataFile>;documentTexts?:Record<string,DataFile>;documentReaders?:Record<string,DataFile>;laws:Record<string,DataFile>;related:Record<string,DataFile>;rulings:Record<string,DataFile>;rulingHeads:DataFile;rulingCounts:DataFile;indexes:{kind:'laws'|'rulings';region:string;file:DataFile}[];packs:{id:string;label:string;lawCount:number;files:DataFile[];bytes:number}[];provenance:DataFile;history:DataFile;files:DataFile[]};

