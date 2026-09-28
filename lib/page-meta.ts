import type {Law} from './law-types.ts';
import {lawHref} from './routes.ts';
export const SITE_URL='https://openlawtw.vercel.app';
export const HOME_TITLE='openlawtw｜臺灣建築法規庫';
export const HOME_DESCRIPTION='依縣市查找臺灣建築相關中央法規、自治條例、法源關係與官方函釋，支援全文搜尋及離線閱讀。';
export function lawMetadata(law:Law){
 const count=law.articleCount??law.articles.length;
 return {title:law.name+'｜openlawtw',description:`${law.region}・${law.kind}。《${law.name}》${law.document?`收錄 ${law.document.pages} 頁官方圖文 PDF（未拆為項款）`:law.coverage==='full'?`收錄 ${count} 條原文快照`:'官方來源索引，全文尚未收錄'}。${law.modified?'來源修正日期：'+law.modified+'。':''}查閱條文、相關函釋與官方來源。`,url:SITE_URL+lawHref(law.id)};
}
export function applyPageMetadata(law?:Law){
 const meta=law?lawMetadata(law):{title:HOME_TITLE,description:HOME_DESCRIPTION,url:SITE_URL+'/'};
 document.title=meta.title;
 for(const [selector,value] of [['meta[name="description"]',meta.description],['meta[property="og:title"]',meta.title],['meta[property="og:description"]',meta.description],['meta[property="og:url"]',meta.url]])document.querySelector(selector)?.setAttribute('content',value);
 document.querySelector('link[rel="canonical"]')?.setAttribute('href',meta.url);
 const structured=document.getElementById('openlawtw-page-metadata');
 if(structured)structured.textContent=JSON.stringify({'@context':'https://schema.org','@type':'WebPage',name:meta.title,url:meta.url,description:meta.description,inLanguage:'zh-Hant-TW',...(law?{isBasedOn:law.url}:{})});
}
