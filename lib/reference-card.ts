import {safeEvidenceURL,type CaseEvidence} from './casebook.ts';
import {lawHref} from './routes.ts';
export type CardFormat='portrait'|'square';
export const cardLimit=(format:CardFormat)=>format==='portrait'?420:240;
export function validateExcerpt(original:string,quote:string,format:CardFormat){
 if(!quote.trim())return '請選擇一段原文。';
 if(!original.includes(quote))return '節錄必須是原文中連續的一段，請勿改寫文字。';
 if([...quote].length>cardLimit(format))return `這個版面最多 ${cardLimit(format)} 字，請縮短節錄。`;
 return '';
}
export function referenceHref(e:CaseEvidence){const l=e.locator;return e.kind==='article'&&l.lawId?lawHref(l.lawId,l.articleNo,l.unitId):e.kind==='ruling'&&l.rulingId?'/#ruling='+encodeURIComponent(l.rulingId):'';}
export type EmbedSelector={kind:'article'|'ruling';lawId?:string;articleNo?:string;unitId?:string;rulingId?:string;expected:string};
export function parseEmbedSelector(search:string):EmbedSelector{
 const p=new URLSearchParams(search),expected=p.get('expected')||'';
 if(expected&&!/^[a-f0-9]{64}$/.test(expected))throw Error('引用版本識別碼格式不正確。');
 const lawId=p.get('law'),articleNo=p.get('article'),unitId=p.get('unit')||undefined,rulingId=p.get('ruling');
 if(rulingId){if(lawId||articleNo||unitId||!/^\d{1,10}$/.test(rulingId))throw Error('函釋引用參數不正確。');return {kind:'ruling',rulingId,expected};}
 if(!lawId||lawId.length>160||/[\s/\\<>"']/.test(lawId)||!articleNo||articleNo.length>80||unitId&&unitId.length>250)throw Error('請提供有效的法規及條號。');
 return {kind:'article',lawId,articleNo,unitId,expected};
}
export function embedURL(e:CaseEvidence,base:string){
 if(!safeEvidenceURL(base))throw Error('引用卡需使用 HTTP 或 HTTPS 網址。');
 const l=e.locator,p=new URLSearchParams();
 if(e.kind==='article'&&l.lawId&&l.articleNo){p.set('law',l.lawId);p.set('article',l.articleNo);if(l.unitId)p.set('unit',l.unitId);}
 else if(e.kind==='ruling'&&l.rulingId)p.set('ruling',l.rulingId);
 else throw Error('目前可嵌入條文、項款與函釋。');
 p.set('expected',e.contentHash);parseEmbedSelector(p.toString());
 return new URL('/embed.html?'+p.toString(),base).href;
}
const attribute=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function embedCode(e:CaseEvidence,base:string){return `<iframe src="${attribute(embedURL(e,base))}" title="${attribute(e.title)}｜openlawtw 引用卡" width="100%" height="540" loading="lazy" referrerpolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox" style="border:1px solid #d8e1da;border-radius:12px;max-width:760px"></iframe>`;}
