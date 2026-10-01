import assert from 'node:assert/strict';
import fs from 'node:fs';
import {officialArticleSource} from '../lib/official-source.ts';
import {printSelection,printArticleBody,lawPrintHTML,openLawPrint} from '../lib/law-print.ts';
import {lawChapters} from '../lib/law-chapters.ts';
import {splitLegalText} from '../lib/legal-tables.ts';
const laws=JSON.parse(fs.readFileSync(new URL('../public/data/laws.json',import.meta.url)));
const building=laws.D0070115;
const article=building.articles.find(a=>a.no==='第 116-3 條');
const route=(url,no)=>officialArticleSource({url},no);
const evidence=JSON.parse(fs.readFileSync(new URL('./tests/fixtures/official-article-links.json',import.meta.url)));
for(const record of evidence){
 assert.ok(record.observedLinks.length,'Official routing needs a saved observed link');
 for(const link of record.observedLinks){
  const observed=new URL(link.href,record.source);observed.searchParams.delete('media');
  const no='第'+observed.searchParams.get('flno')+'條';
  assert.equal(route(record.source,no).url,observed.href);
 }
}

assert.deepEqual(route(building.url,article.no),{url:'https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=D0070115&flno=116-3',exact:true});
for(const no of ['第九十二條','第 ９２ 條','第92條'])assert.equal(route(building.url,no).url,'https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=D0070115&flno=92');
assert.deepEqual(route('https://web.law.ntpc.gov.tw/Scripts/FLAWDAT0202.aspx?fcode=C0170005','第 3 條'),{url:'https://web.law.ntpc.gov.tw/Scripts/FLAWDOC01.aspx?fcode=C0170005&flno=3',exact:true});
for(const url of ['https://laws.gov.taipei/Law/LawSearch/LawArticleContent/FL038035','https://law.taichung.gov.tw/LawContent.aspx?id=GL002020','https://law.moj.gov.tw.evil.test/LawClass/LawAll.aspx?pcode=D0070115','https://law.moj.gov.tw/unknown?pcode=D0070115','https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=not-a-law'])assert.equal(route(url,'第1條').exact,false);
for(const url of ['javascript:alert(1)','data:text/html,hello','not a url','https://user:secret@example.test/law'])assert.equal(route(url,'第1條'),null);
assert.equal(route(building.url,'第1點').exact,false);
assert.equal(route(building.url,'不明條號').exact,false);
assert.deepEqual(printSelection(building,{kind:'article',article:'第116-3條'}).articles,[article]);
for(const chapter of lawChapters(building.articles))assert.deepEqual(printSelection(building,{kind:'chapter',chapter:chapter.id}).articles,chapter.articles);
assert.deepEqual(printSelection(building,{kind:'law'}).articles,building.articles);
for(const scope of [{kind:'article',article:'第999999條'},{kind:'chapter',chapter:'missing'}])assert.throws(()=>printSelection(building,scope));
assert.throws(()=>printSelection({...building,coverage:'link'},{kind:'law'}));
assert.throws(()=>printSelection({...building,document:{source:'https://example.test/original.pdf'}},{kind:'law'}));
assert.throws(()=>lawPrintHTML({...building,articles:[]},{kind:'law'}));
const decode=s=>s.replace(/<[^>]*>/g,'').replace(/&(amp|lt|gt|quot|#39);/g,(_,n)=>({amp:'&',lt:'<',gt:'>',quot:'"','#39':"'"}[n]));
const content=s=>s.replace(/[\u2500-\u257f\s]/gu,'');
let articleCount=0,semanticCount=0,rawCount=0;
for(const law of Object.values(laws))for(const a of law.articles){
 const before=JSON.stringify(a),html=printArticleBody(a);
 const printed=decode(html.replace(/<caption>.*?<\/caption>/gs,'').replaceAll('</td>','\n'));
 if(html.includes('<table'))assert.equal([...content(printed)].sort().join(''),[...content(a.text)].sort().join(''),'All non-border characters must survive semantic table printing (cells read vertically)');
 else assert.equal(printed,a.text,'Prose and raw diagrams must preserve exact source characters and line breaks');
 assert.equal(JSON.stringify(a),before,'Printing must not modify stored source');
 articleCount++;
 for(const block of splitLegalText(a.text))if(block.kind==='table'){if(block.table)semanticCount++;else rawCount++;}
}
const sample={...building,name:'<img src=x onerror=alert(1)>',preamble:'前言 <script> &',attachments:[{title:'附件 <x>',url:'https://example.test/file?a=1&b=2'},{title:'bad',url:'javascript:alert(1)'}],articles:[{...article,path:['第一章 <x>'],text:'原文 <script>alert("x")</script> &\n完整後文。'}]};
const printed=lawPrintHTML(sample,{kind:'law'},'landscape');
assert.ok(!printed.includes('<script>')&&!printed.includes('<img')&&!printed.includes('javascript:'));
assert.ok(printed.includes('&lt;script&gt;')&&printed.includes('A4 landscape')&&printed.includes('完整後文。'));
assert.ok(printed.includes('附件內容未併入')&&printed.includes('a=1&amp;b=2'));
assert.equal((lawPrintHTML(building,{kind:'article',article:article.no}).match(/class="print-article"/g)||[]).length,1);
assert.equal((lawPrintHTML(building,{kind:'law'}).match(/class="print-article"/g)||[]).length,building.articles.length);
const single=lawPrintHTML(sample,{kind:'article',article:article.no});
assert.ok(single.includes('附件內容未併入')&&!single.includes('class="print-attachments"'),'Scoped prints link back to the official attachment list without appending unrelated attachments');
const merged=printArticleBody(building.articles.find(a=>a.no==='第 92 條'));
assert.match(merged,/rowspan="2"/);assert.match(merged,/colspan="2"/);
globalThis.window={open:()=>null};
assert.equal(openLawPrint(building,{kind:'article',article:article.no},'portrait'),false,'Blocked popup returns an actionable failure');
delete globalThis.window;
console.log(`Print/source checks passed: ${articleCount} original articles, ${semanticCount} semantic tables, ${rawCount} raw diagrams; scopes, official routes, escaping and blocked popup.`);
