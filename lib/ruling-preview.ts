import type {Ruling} from './law-types.ts';

/** A contiguous source excerpt, never a generated summary or the subject again. */
export function rulingPreviewText(ruling:Pick<Ruling,'title'|'body'>,limit=220):string{
 const tidy=(value:string)=>value.replace(/\s+/gu,' ').trim();
 let text=tidy(ruling.body),title=tidy(ruling.title);
 if(title){
  const withoutSubjectLabel=text.replace(/^主旨\s*[:：]\s*/u,'');
  if(withoutSubjectLabel===title)text='';
  else if(withoutSubjectLabel.startsWith(title+' '))text=withoutSubjectLabel.slice(title.length).trim();
 }
 const characters=Array.from(text),length=Math.max(1,Math.floor(limit));
 return characters.length>length?characters.slice(0,length).join('')+'…':text;
}
