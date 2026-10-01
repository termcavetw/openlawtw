import raw from '../data/runtime-article-supplement-index.json' with {type:'json'};
import type {Attachment} from './law-types.ts';
import {articleAddress} from './routes.ts';

export type SupplementPage={page:number;src:string;width:number;height:number};
export type SupplementFile=Attachment&{src?:string;width?:number;height?:number};
export type ArticleSupplement={id:string;lawId:string;article:string;articleNo:string;title:string;source:string;sourcePage:string;retrieved:string;versionNote:string;versionSource?:string;pages:SupplementPage[];alternatives:Attachment[];supplementalFiles:SupplementFile[]};
export type ArticleSupplementIndex=Pick<ArticleSupplement,'id'|'lawId'|'article'|'articleNo'|'alternatives'>;
export const supplementViewFile=raw.file;
export const articleSupplements:ArticleSupplementIndex[]=(raw.records as [string,[number,number][]][]).map(([article,files])=>({id:raw.lawId+'-'+article,lawId:raw.lawId,article,articleNo:'第 '+article+' 條',alternatives:files.map(([suffix,fileId])=>({title:'第 '+article+' 條補充圖例'+raw.suffixes[suffix],url:'https://law.moj.gov.tw/LawClass/LawGetFile.ashx?FileId='+String(fileId).padStart(10,'0')}))}));
const byArticle=new Map(articleSupplements.map(record=>[record.lawId+'/'+record.article,record]));

/** Only a reviewed record whose exact original attachment links still match is shown. */
export function articleSupplement(lawId:string,article:string,attachments:Attachment[]):ArticleSupplementIndex|undefined{
 const record=byArticle.get(lawId+'/'+articleAddress(article));
 if(!record||!record.alternatives.length)return;
 if(!record.alternatives.every(source=>attachments.some(a=>a.title===source.title&&a.url===source.url)))return;
 return record;
}

/** A standalone HTML keeps these optional page images online instead of embedding megabytes. */
export function supplementAssetURL(src:string,protocol:string,origin:string):string{
 if(!/^\/documents\/article-supplements\/[A-Za-z0-9/_-]+\.(?:webp|png|jpe?g)$/.test(src))return '';
 return protocol==='file:'?'https://openlawtw.vercel.app'+src:origin+src;
}
