import type {DataFile} from './law-types.ts';
import {normalize} from './search.ts';

export type DocumentTextBlock={type:'text';text:string;page:number;endPage?:number;id?:string};
export type DocumentImageBlock={type:'image';src:string;alt:string;page:number;width:number;height:number;caption?:string};
export type DocumentSection={id:string;title:string;startPage:number;endPage:number;blocks:(DocumentTextBlock|DocumentImageBlock)[]};
export type DocumentChapter={id:string;title:string;startPage:number;endPage:number;sections:DocumentSection[];sourceSha256:string};
export type DocumentSectionIndex=Omit<DocumentSection,'blocks'>&{text:string;anchors:{index:number;id?:string;page:number;text:string}[]};
export type DocumentChapterIndex=Omit<DocumentChapter,'sections'|'sourceSha256'>&{sections:DocumentSectionIndex[];file:DataFile};
export type DocumentReaderIndex={schemaVersion:1;lawId:string;sourceSha256:string;pages:number;chapters:DocumentChapterIndex[]};

/** Physical PDF pages remain the canonical locator, including cover and appendices. */
export function documentChapterAtPage(index:DocumentReaderIndex,page:number){
 const chapter=index.chapters.find(c=>page>=c.startPage&&page<=c.endPage)||index.chapters[0];
 const sections=chapter?.sections.filter(s=>page>=s.startPage&&page<=s.endPage)||[];
 return {chapter,sections};
}
export function searchDocumentSections(index:DocumentReaderIndex,query:string){
 const needle=normalize(query);
 if(!needle)return [];
 return index.chapters.flatMap(chapter=>chapter.sections.filter(section=>normalize(section.title+' '+section.text).includes(needle)).map(section=>{
  const anchor=section.anchors.find(a=>a.id&&normalize(a.id)===needle)||section.anchors.find(a=>normalize(a.text).includes(needle));
  return {chapter,section,anchor};
 }));
}
