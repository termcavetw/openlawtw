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
