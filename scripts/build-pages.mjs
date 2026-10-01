import {fileURLToPath} from 'node:url';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from './paths.mjs';
import {lawHref} from '../lib/routes.ts';
import {SITE_URL,HOME_TITLE,HOME_DESCRIPTION,lawMetadata} from '../lib/page-meta.ts';
import {createCitationMatcher} from '../lib/citations.ts';
import {escapeHTML as esc,safeJSON,articleHTML,staticStyles} from './static-html.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),dist=join(root,'dist');
const read=p=>readFile(join(root,p),'utf8').then(JSON.parse);
const manifest=await read('data/runtime-manifest.json'),catalog=await read('data/runtime-catalog.json'),targets=await read('data/runtime-citations.json');
const template=await readFile(join(dist,'index.html'),'utf8');
const findReferences=createCitationMatcher(catalog.laws,targets,await read('data/runtime-citation-context.json'));
const nav=`<nav><a class="static-brand" href="/">openlawtw</a><a href="/laws/index.html">全台法規目錄</a></nav>`;
const footer='<footer class="static-footer">openlawtw · 本庫收錄快照不代表完整或現行適用範圍。請核對官方原文及附件。</footer>';
function page(meta,content,law=null,interactive=true){
 let html=template.replace(/<title>[^<]*<\/title>/,()=>`<title>${esc(meta.title)}</title>`)
 .replace(/<meta name="description" content="[^"]*"\s*\/>/,()=>`<meta name="description" content="${esc(meta.description)}"/>`)
 .replace(/<meta property="og:title" content="[^"]*"\s*\/>/,()=>`<meta property="og:title" content="${esc(meta.title)}"/>`)
 .replace(/<meta property="og:description" content="[^"]*"\s*\/>/,()=>`<meta property="og:description" content="${esc(meta.description)}"/>`)
 .replace(/<meta property="og:url" content="[^"]*"\s*\/>/,()=>`<meta property="og:url" content="${esc(meta.url)}"/>`)
 .replace(/<link rel="canonical" href="[^"]*"\s*\/>/,()=>`<link rel="canonical" href="${esc(meta.url)}"/>`)
 .replace('<div id="root"></div>',()=>`<div id="root"><main class="static-page">${nav}${content}${footer}</main></div>`)
 .replace(/<noscript>[\s\S]*?<\/noscript>/,'');
 const schema={'@context':'https://schema.org','@type':'WebPage',name:meta.title,url:meta.url,description:meta.description,inLanguage:'zh-Hant-TW',...(law?{isBasedOn:law.url}:{})};
 html=html.replace('</head>',()=>`<style>${staticStyles}.source-document{overflow:auto;line-height:1.8}.source-document table{border-collapse:collapse}.source-document td,.source-document th{border:1px solid #aaa;padding:8px;min-width:65px}</style><script type="application/ld+json" id="openlawtw-page-metadata">${safeJSON(schema)}</script></head>`);
 if(law)html=html.replace('</body>',()=>`<script type="application/json" id="openlawtw-law-snapshot">${safeJSON(law)}</script></body>`);
 if(!interactive)html=html.replace(/<script\b[^>]*type="module"[^>]*>[\s\S]*?<\/script>/g,'').replace(/<link\b[^>]*rel="modulepreload"[^>]*>/g,'');
 return html;
}
await mkdir(join(dist,'laws'),{recursive:true});
for(const [id,file] of Object.entries(manifest.laws)){
 const law=await read('public'+file.url),meta=lawMetadata(law);let chapter='';
 let sourceContent='';
 if(law.document){const source=await read('public'+manifest.documents[id].url);sourceContent=source.format==='html'?`<section id="document-page-1" class="source-document">${source.html}</section>`:`<p>${esc(law.document.versionNote)}</p>`+(source.searchPages||source.pages).map(p=>`<p id="document-page-${p.page}"><a href="${esc(law.document.source+'#page='+p.page)}" target="_blank" rel="noreferrer">開啟官方 PDF 第 ${p.page} 頁 ↗</a></p>`).join('');}
 const text=law.articles.map(article=>{const next=article.path.join(' / '),heading=next&&next!==chapter?`<p class="static-chapter">${esc(next)}</p>`:'';chapter=next;return heading+articleHTML(article,law,findReferences);}).join('');
 const content=`<header><div class="static-kicker">${esc(law.region)} · ${esc(law.kind)} · ${law.document?'官方原文文件':law.coverage==='full'?'全文快照':'官方連結'}</div><h1>${esc(law.name)}</h1><div class="static-facts"><span>${law.articles.length} 條已收錄原文</span><span>來源修正日期：${esc(law.modified||'待核對')}</span></div><p class="static-source"><a href="${esc(law.url)}" target="_blank" rel="noreferrer">官方原文、歷史版本與附件 ↗</a></p><p class="static-note">${law.coverage==='full'?'下方為本庫收錄的官方文字。搜尋、函釋並讀與離線管理需啟用 JavaScript。':law.document?'已收錄官方文件。PDF 頁內查找與全站搜尋需啟用 JavaScript。':'本庫僅建立官方來源索引，尚未收錄全文。'}</p>${law.effectiveNote?`<p class="static-note">版本與生效說明：${esc(law.effectiveNote)}</p>`:''}</header>${law.preamble?`<div class="static-preamble" style="white-space:pre-wrap">${esc(law.preamble)}</div>`:''}${text}${sourceContent}`;
 await writeFile(join(dist,'laws',id+'.html'),page(meta,content,law));
}
const regions=['中央',...catalog.regions.map(r=>r.name)];
const list=regions.map(region=>{const laws=catalog.laws.filter(l=>l.region===region);return `<details><summary>${esc(region)} · ${laws.length} 部索引</summary><ul>${laws.map(l=>`<li><a href="${esc(lawHref(l.id))}">${esc(l.name)}</a><small>${l.document?'原文文件':l.coverage==='full'?'全文':'官方連結'}</small></li>`).join('')}</ul></details>`;}).join('');
await writeFile(join(dist,'laws/index.html'),page({title:'全台建築相關法規目錄｜openlawtw',description:HOME_DESCRIPTION,url:SITE_URL+'/laws/index.html'},`<header><div class="static-kicker">OPEN LEGAL LIBRARY · TAIWAN</div><h1>全台法規目錄</h1><p>${catalog.laws.length} 部索引 · ${catalog.laws.filter(l=>l.coverage==='full').length} 部全文快照</p><a href="/">開啟搜尋與函釋並讀 →</a></header>${list}`,null,false));
await writeFile(join(dist,'index.html'),page({title:HOME_TITLE,description:HOME_DESCRIPTION,url:SITE_URL+'/'},`<header><div class="static-kicker">OPEN LEGAL LIBRARY · TAIWAN</div><h1>臺灣建築法規，從條文開始。</h1><p>依縣市閱讀已收錄法規，連結官方來源與解釋函令。</p><noscript><p>啟用 JavaScript 可使用搜尋、函釋並讀與離線管理，也可直接開啟下方法規閱讀原文。</p></noscript></header>${list}`));
const urls=[SITE_URL+'/',SITE_URL+'/laws/index.html',...catalog.laws.map(l=>SITE_URL+lawHref(l.id))];
await writeFile(join(dist,'sitemap.xml'),'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+urls.map(url=>'<url><loc>'+esc(url)+'</loc></url>').join('')+'</urlset>\n');
await writeFile(join(dist,'robots.txt'),`User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`);
console.log(JSON.stringify({staticLawPages:catalog.laws.length,sitemapURLs:urls.length}));
