import {normalize} from './search.ts';
import type {Law} from './law-types.ts';

export type OfficialArticleSource={url:string;exact:boolean};
/** Only observed official routes are synthesized. Other sources retain their full-page URL. */
export function officialArticleSource(law:Pick<Law,'url'>,article:string):OfficialArticleSource|null {
 let url:URL;try{url=new URL(law.url);}catch{return null;}
 if(!['https:','http:'].includes(url.protocol)||url.username||url.password)return null;
 const fallback={url:url.href,exact:false};
 const match=/^第(\d+(?:-\d+)?)條$/.exec(normalize(article));
 if(!match)return fallback;
 if(url.hostname==='law.moj.gov.tw'&&/^\/LawClass\/Law(?:All|Single)\.aspx$/i.test(url.pathname)){
  const code=url.searchParams.get('pcode');if(!code||!/^[A-Z]\d{7}$/.test(code))return fallback;
  return {url:`https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=${code}&flno=${match[1]}`,exact:true};
 }
 if(url.hostname==='web.law.ntpc.gov.tw'&&/^\/Scripts\/FLAWDAT0202\.aspx$/i.test(url.pathname)){
  const code=url.searchParams.get('fcode');if(!code||!/^[A-Z]\d{7}$/.test(code))return fallback;
  return {url:`https://web.law.ntpc.gov.tw/Scripts/FLAWDOC01.aspx?fcode=${code}&flno=${match[1]}`,exact:true};
 }
 return fallback;
}
