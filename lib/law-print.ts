import type {Article,Law} from './law-types.ts';
import {articleAddress} from './routes.ts';
import {lawChapters,type LawChapter} from './law-chapters.ts';
import {splitLegalText,legalCharacterWidth} from './legal-tables.ts';
import {officialArticleSource} from './official-source.ts';
export type PrintScope={kind:'article';article:string}|{kind:'chapter';chapter:string}|{kind:'law'};
export type PrintOrientation='portrait'|'landscape';
const escape=(value:unknown)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function printSelection(law:Law,scope:PrintScope):{articles:Article[];label:string;chapter?:LawChapter}{
 if(law.document||law.coverage!=='full')throw Error('請開啟官方原始文件列印。');
 if(scope.kind==='law')return {articles:law.articles,label:'整部法規'};
 if(scope.kind==='chapter'){
  const chapter=lawChapters(law.articles).find(c=>c.id===scope.chapter);
  if(!chapter)throw Error('找不到選擇的章節，請重新選取。');
  return {articles:chapter.articles,label:chapter.title,chapter};
 }
 const article=law.articles.find(a=>articleAddress(a.no)===articleAddress(scope.article));
 if(!article)throw Error('找不到選擇的法條，請重新選取。');
 return {articles:[article],label:article.no};
}
export function printArticleBody(article:Article):string {
 return splitLegalText(article.text).map(block=>{
  if(block.kind==='text')return `<div class="print-prose">${escape(block.text)}</div>`;
  if(block.table)return `<table class="print-table"><caption>${escape(article.no)} · 原文表格</caption><tbody>${block.table.rows.map(row=>'<tr>'+row.map(cell=>`<td rowspan="${cell.rowSpan}" colspan="${cell.colSpan}">${escape(cell.text)}</td>`).join('')+'</tr>').join('')}</tbody></table>`;
  return `<div class="print-raw-wrap"><pre class="print-raw">${[...block.text].map(c=>c==='\n'?'\n':`<span style="width:${legalCharacterWidth(c)/2}em">${escape(c)}</span>`).join('')}</pre></div>`;
 }).join('');
}
export function lawPrintHTML(law:Law,scope:PrintScope,orientation:PrintOrientation='portrait'):string {
 const {articles,label}=printSelection(law,scope);
 if(!articles.length)throw Error('沒有可列印的條文。');
 const landscape=orientation==='landscape',width=landscape?'267mm':'180mm';
 const source=officialArticleSource(law,'');
 return `<!doctype html><html lang="zh-Hant"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(law.name+' · '+label)}</title><style>
@page{size:A4 ${landscape?'landscape':'portrait'};margin:15mm}
*{box-sizing:border-box}html{color-scheme:light;background:#fff;color:#111}body{margin:0;font:12pt/1.7 system-ui,"Noto Sans TC",sans-serif}main{width:${width};max-width:none;margin:20px auto;padding:0}h1{font-size:22pt;line-height:1.5;margin:0 0 12px}h2{font-size:13pt;margin:0 0 7px;break-after:avoid}h3{font-size:12pt;line-height:1.6;margin:22px 0 8px;break-after:avoid}.print-meta,.print-note,.print-source{font-size:9pt;color:#444;overflow-wrap:anywhere}.print-meta{display:flex;flex-wrap:wrap;gap:4px 20px}.print-article{border-top:1px solid #ccc;padding-top:16px;margin-top:20px}.print-prose{white-space:pre-wrap;overflow-wrap:anywhere;orphans:3;widows:3}.print-table{width:100%;table-layout:fixed;border-collapse:collapse;font-size:10pt;line-height:1.6;margin:12px 0;overflow-wrap:anywhere}.print-table caption{text-align:left;font-size:9pt;margin-bottom:5px}.print-table td{border:1px solid #777;padding:6px;vertical-align:top;white-space:pre-wrap}.print-table tr{break-inside:avoid}.print-raw-wrap{width:100%;margin:12px 0}.print-raw{width:max-content;max-width:none;font-family:monospace;font-size:11pt;line-height:1.3;white-space:pre;margin:0;letter-spacing:0;tab-size:4}.print-raw span{display:inline-block;text-align:center;white-space:pre;vertical-align:top}.print-source{margin-top:6px}a{color:inherit;text-underline-offset:3px}.print-toolbar{position:sticky;top:0;padding:12px 16px;border-bottom:1px solid #ddd;background:#f8f8f8;display:flex;flex-wrap:wrap;gap:12px;align-items:center;font:14px/1.5 system-ui}.print-toolbar button{border:1px solid #333;border-radius:6px;background:#222;color:#fff;padding:9px 16px;cursor:pointer;font:inherit}.print-toolbar span{color:#555}.print-footer{border-top:1px solid #bbb;margin-top:24px;padding-top:10px}.print-attachments{font-size:9pt;overflow-wrap:anywhere}.print-attachments li{margin-top:5px}
@media screen and (max-width:760px){.print-toolbar span{width:100%}main{margin:20px 16px}}
@media print{body{background:#fff}main{width:100%;margin:0}.print-toolbar{display:none!important}.print-source a{text-decoration:none}h1,h2,h3{color:#111}a{color:#111}}
</style></head><body><div class="print-toolbar"><button id="print-law" type="button">列印／儲存為 PDF</button><span>A4 ${landscape?'橫式':'直式'} · ${escape(label)} · ${articles.length} 條原文</span><span>原文圖表會縮至紙張寬度；需要較大字體可返回選擇橫式。</span></div><main><header><h1>${escape(law.name)}</h1><div class="print-meta"><span>列印範圍：${escape(label)}</span><span>修正日期：${escape(law.modified||'來源未列')}</span><span>來源快照：${escape(law.snapshot||law.retrieved||'日期未列')}</span></div><p class="print-note">本庫收錄快照，不代表官方目前版本；適用範圍及附件請核對官方來源。</p>${source?`<p class="print-source">官方來源：<a href="${escape(source.url)}">${escape(source.url)}</a></p>`:''}</header>${law.effectiveNote?`<p class="print-note print-prose">生效說明：${escape(law.effectiveNote)}</p>`:''}${scope.kind==='law'&&law.preamble?`<div class="print-prose">${escape(law.preamble)}</div>`:''}${articles.map((a,i)=>{
 const official=officialArticleSource(law,a.no);
 return `${a.path.length&&(i===0||a.path.join('/')!==articles[i-1].path.join('/'))?`<h3>${escape(a.path.join(' / '))}</h3>`:''}<section class="print-article" data-article="${escape(a.no)}"><h2>${escape(a.no)}</h2>${printArticleBody(a)}${official?.exact?`<p class="print-source">本條官方原文：<a href="${escape(official.url)}">${escape(official.url)}</a></p>`:''}</section>`;
 }).join('')}<footer class="print-footer"><p class="print-note">openlawtw · 依本庫快照排版，請核對官方目前版本。</p>${law.attachments.length?(scope.kind!=='law'?`<p class="print-note">本法規另有 ${law.attachments.length} 份附件，附件內容未併入本次列印；請由上方官方來源核對與另開列印。</p>`:`<p class="print-note">官方附件（附件內容未併入本次列印）：</p><ul class="print-attachments">${law.attachments.flatMap(a=>{const link=officialArticleSource({url:a.url},'');return link?[`<li>${escape(a.title)}<br><a href="${escape(link.url)}">${escape(link.url)}</a></li>`]:[];}).join('')}</ul>`):''}</footer></main></body></html>`;
}
/** User-initiated preview stays open after printing/canceling and makes no network requests. */
export function openLawPrint(law:Law,scope:PrintScope,orientation:PrintOrientation):boolean {
 const html=lawPrintHTML(law,scope,orientation);
 const popup=window.open('','_blank');if(!popup)return false;
 popup.opener=null;
 popup.document.open();popup.document.write(html);popup.document.close();
 const fit=()=>{for(const pre of popup.document.querySelectorAll<HTMLElement>('.print-raw')){
  pre.style.fontSize='11pt';const width=pre.getBoundingClientRect().width,available=pre.parentElement!.getBoundingClientRect().width;
  if(width>available&&available>0)pre.style.fontSize=(11*available/width)+'pt';
 }};
 const button=popup.document.getElementById('print-law') as HTMLButtonElement;
 button.disabled=true;
 Promise.resolve(popup.document.fonts?.ready).then(()=>{if(!popup.closed){fit();button.disabled=false;}});
 button.addEventListener('click',()=>{fit();popup.focus();popup.print();});
 popup.addEventListener('beforeprint',fit);
 return true;
}
