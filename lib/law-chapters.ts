import type {Article} from './law-types.ts';
import {articleAddress} from './routes.ts';
import {matchesArticle} from './search.ts';

export type LawChapter={id:string;title:string;path:string[];articles:Article[]};
export const ALL_CHAPTERS='all';

/** Keep the official order and ancestry; sections belong to their nearest chapter. */
export function lawChapters(articles:Article[]):LawChapter[]{
 const groups:LawChapter[]=[];
 for(const article of articles){
  const chapterIndex=article.path.findIndex(part=>/^第[^章]*章/.test(part));
  const path=chapterIndex>=0?article.path.slice(0,chapterIndex+1):article.path.slice(0,1);
  const title=path.join(' / ')||'未分章條文',key=JSON.stringify(path);
  let group=groups.at(-1);
  if(!group||JSON.stringify(group.path)!==key){group={id:'chapter-'+groups.length,title,path,articles:[]};groups.push(group);}
  group.articles.push(article);
 }
 return groups;
}

export function chapterForArticle(chapters:LawChapter[],article:string){
 if(!article)return undefined;
 const address=articleAddress(article);
 return chapters.find(chapter=>chapter.articles.some(item=>articleAddress(item.no)===address));
}

export function initialLawChapter(chapters:LawChapter[],explicitArticle:string,savedArticle:string){
 return chapterForArticle(chapters,explicitArticle)?.id||chapterForArticle(chapters,savedArticle)?.id||chapters[0]?.id||ALL_CHAPTERS;
}

/** In-law search intentionally spans every chapter, regardless of the selected view. */
export function visibleLawArticles(articles:Article[],chapters:LawChapter[],chapter:string,query:string){
 if(query.trim())return articles.filter(article=>matchesArticle(article,query));
 if(chapter===ALL_CHAPTERS)return articles;
 return chapters.find(item=>item.id===chapter)?.articles||articles;
}

/** Display the actual first/last records, never an arithmetic article count. */
export function articleRange(articles:Article[]):string{
 if(!articles.length)return '';
 const first=articles[0].no.replace(/\s+/g,''),last=articles.at(-1)!.no.replace(/\s+/g,'');
 if(first===last)return first;
 const a=/^第([0-9一二三四五六七八九十百千零〇兩]+)(條|點)$/.exec(first),b=/^第([0-9一二三四五六七八九十百千零〇兩]+)(條|點)$/.exec(last);
 return a&&b&&a[2]===b[2]?`第${a[1]}–${b[1]}${a[2]}`:`${first}–${last}`;
}
/** Full ancestry avoids merging identically named sections in different chapters. */
export function lawPathRanges(articles:Article[]):Map<string,string>{
 const groups=new Map<string,Article[]>();
 for(const a of articles)for(let depth=1;depth<=a.path.length;depth++){const key=JSON.stringify(a.path.slice(0,depth));groups.set(key,[...(groups.get(key)||[]),a]);}
 return new Map([...groups].map(([key,list])=>[key,articleRange(list)]));
}
