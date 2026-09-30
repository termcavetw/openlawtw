import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
import {articleHTML} from './static-html.mjs';
import {structure} from './schema.mjs';
import { splitLegalText, legalCharacterWidth } from '../lib/legal-tables.ts';

const laws=JSON.parse(fs.readFileSync(new URL('../public/data/laws.json',import.meta.url),'utf8'));
const content = text => text.replace(/[\u2500-\u257f\s]/gu,'');
function verify(text) {
  const blocks=splitLegalText(text);
  assert.equal(blocks.map(b=>b.text).join(''),text,'splitting must conserve the complete source');
  let offset=0;
  for (const block of blocks) {
    assert.equal(block.start,offset);
    assert.equal(block.text,text.slice(block.start,block.end));
    offset=block.end;
    if (block.kind!=='table' || !block.table) continue;
    const {rows,columnCount}=block.table;
    const occupied=Array.from({length:rows.length},()=>Array(columnCount).fill(false));
    const fragments=[];
    for (const [r,row] of rows.entries()) for (const cell of row) {
      assert.equal(cell.row,r);
      assert.ok(cell.rowSpan>0 && cell.colSpan>0);
      assert.equal(cell.text,cell.fragments.map(f=>f.text).join('\n'));
      for (const fragment of cell.fragments) {
        assert.equal(fragment.text,text.slice(fragment.start,fragment.end));
        assert.ok(fragment.start>=block.start && fragment.end<=block.end);
        fragments.push(fragment);
      }
      for (let y=r;y<r+cell.rowSpan;y++) for (let x=cell.column;x<cell.column+cell.colSpan;x++) {
        assert.ok(y<rows.length && x<columnCount,'span out of bounds');
        assert.equal(occupied[y][x],false,'overlapping cells');
        occupied[y][x]=true;
      }
    }
    assert.ok(occupied.every(row=>row.every(Boolean)),'every grid position must be covered');
    fragments.sort((a,b)=>a.start-b.start);
    for (let i=1;i<fragments.length;i++) assert.ok(fragments[i].start>=fragments[i-1].end,'overlapping source fragments');
    assert.equal(content(fragments.map(f=>f.text).join('')),content(block.text),'semantic conversion must retain every non-border source character in order');
  }
  assert.equal(offset,text.length);
  return blocks.filter(b=>b.kind==='table');
}
let tableArticles=0, candidates=0, parsed=0;
for (const law of Object.values(laws)) for (const article of law.articles??[]) {
  if (!/[\u2500-\u257f]/u.test(article.text)) continue;
  tableArticles++;
  const blocks=verify(article.text);
  candidates+=blocks.length;
  parsed+=blocks.filter(b=>b.table).length;
}
const article92=laws.D0070115.articles.find(a=>a.no==='第 92 條').text;
const table92=verify(article92)[0].table;
assert.ok(table92);
assert.equal(table92.columnCount,3);
assert.equal(table92.rows.length,5);
assert.equal(table92.rows[3][0].rowSpan,2);
assert.ok(table92.rows[3][0].text.includes('上）。'));
assert.ok(table92.rows[3][0].text.includes('（二）'));
assert.equal(table92.rows[4].length,1);
assert.equal(table92.rows[4][0].colSpan,2);
assert.equal(table92.rows[4][0].column,1);
assert.equal(table92.rows[4][0].text.trim(),'一‧二○公尺以上');
assert.equal(table92.rows[1][1].text.trim(),'二‧四○公尺以上');
assert.equal(table92.rows[1][2].text.trim(),'一‧八○公尺以上');
const basic='┌─┬─┐\n│甲│乙│\n├─┼─┤\n│丙│丁│\n└─┴─┘';
assert.ok(verify(basic)[0].table);
assert.ok(verify('前文\r\n'+basic.replaceAll('\n','\r\n')+'\r\n後文')[0].table);
assert.equal(verify(basic+'\n'+basic).length,2);
assert.equal(verify(basic.replace('甲','AB'))[0].table.rows[0][0].text,'AB');
assert.ok(verify(basic.replaceAll('\n','\n\n'))[0].table);
for (const broken of [basic.replace('┘',''),basic.replace('│乙│','│乙'),basic.replace('┼',' '),basic.replace('甲','甲甲'),basic.replace('─','═'),basic.replace('甲','\t')]) {
  assert.equal(verify(broken)[0].table,null,'damaged or unsupported borders must use lossless fallback');
}
const columnMerge='┌─┬─┐\n│甲│乙│\n├─┴─┤\n│丙丁  │\n└───┘';
assert.equal(verify(columnMerge)[0].table.rows[1][0].colSpan,2);
const rowMerge='┌─┬─┐\n│甲│乙│\n│丙├─┤\n│丁│戊│\n└─┴─┘';
assert.equal(verify(rowMerge)[0].table.rows[0][0].rowSpan,2);
assert.equal(verify(rowMerge)[0].table.rows[0][0].text,'甲\n丙\n丁');
for (const sample of ['', '沒有表格。\n', '─', '\n\n', '前文\n│破損\n\n續文', '前文\n┌──\n│值\n後文']) verify(sample);
assert.equal(legalCharacterWidth('─'),2);
assert.equal(legalCharacterWidth('中'),2);
assert.equal(legalCharacterWidth('A'),1);
assert.equal(legalCharacterWidth('\u00a0'),1);
const fraction='前文。\n            Ａf\n     Ａv=────\n          250√h\n    其中Ａv ：排風管。';
const fractionBlock=verify(fraction)[0];
assert.equal(fractionBlock.table,null);
assert.equal(fractionBlock.text,'            Ａf\n     Ａv=────\n          250√h\n');
const diagram='說明：\n  │  │\n─┼─┼─\n  3 (9) 1\n  │  │\n下一段。';
assert.equal(verify(diagram).length,1);
assert.ok(verify(diagram)[0].text.includes('3 (9) 1'));
console.log(`Legal table checks passed: ${tableArticles} articles; ${parsed}/${candidates} semantic tables; ${candidates-parsed} lossless fallbacks.`);

// Exercise the actual React renderer, not an independently reimplemented fixture.
const require=createRequire(import.meta.url);
function component(path,dependencies={}) {
  const exports={};
  const code=ts.transpileModule(fs.readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  Function('require','exports',code)(specifier=>dependencies[specifier]??require(specifier),exports);
  return exports;
}
const legal=component('../components/legal-table.tsx',{'@/lib/legal-tables':{splitLegalText,legalCharacterWidth}});
const empty=()=>null;
const reader=component('../components/article-text.tsx',{
  'lucide-react':{Copy:empty,Link2:empty,ChevronDown:empty},
  './legal-table':legal,
  '@/lib/legal-tables':{splitLegalText},
  '@/lib/legal-definitions':{definitionOccurrences:()=>[]},
  './law-navigation':{Highlight:({text})=>text},
  './legal-reference-text':{findLegalReferences:()=>[],LegalReferenceText:({text,renderText})=>renderText(text)},
  '@/lib/routes':{unitAnchor:id=>'unit-'+id,lawHref:()=>''},
  '@/lib/portable':{shareURL:()=>''},
  './casebook':{AddEvidenceButton:empty},
  './reference-share':{ReferenceShareButton:empty},
  '@/lib/casebook':{makeArticleEvidence:empty},
});
function plain(html) {
  return html.replace(/<[^>]*>/g,'').replace(/&#x([0-9a-f]+);|&#(\d+);|&(amp|lt|gt|quot|apos);/gi,(all,hex,decimal,name)=>hex?String.fromCodePoint(parseInt(hex,16)):decimal?String.fromCodePoint(Number(decimal)):({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"})[name.toLowerCase()]);
}
function recover(html) {
  return plain(html.replace(/<figure\b[^>]*>[\s\S]*?<\/figure>/g,figure=>{
    const raw=figure.match(/<pre\b[^>]*class="legal-table-raw"[^>]*>([\s\S]*?)<\/pre>/);
    assert.ok(raw,'every semantic or fallback table retains exact source');
    return raw[1];
  }).replace(/<details class="unit-tools"[\s\S]*?<\/details>/g,''));
}
const law={id:'table-test',name:'測試法規',url:'https://example.test/official'};
const cases=[article92,fraction,diagram,basic,basic.replace('┘',''), '前文 <script>alert("x")</script> & 後文\n'+basic.replace('甲','<>')];
let renderCases=0;
for(const text of cases) for(const structured of [false,true]) {
  const article={no:'第 92 條',anchor:'article-92',text,path:[],...(structured?{structure:structure(text,'tables/a:92',true)}:{})};
  const before=JSON.stringify(article);
  const react=renderToStaticMarkup(createElement(reader.ArticleText,{article,law,query:'',fontSize:18,onCopy:empty,onChoose:empty,activeUnit:''}));
  const stat=articleHTML(article,law,()=>[]);
  const staticBody=stat.match(/<div class="static-text">([\s\S]*)<\/div><\/section>$/)[1];
  assert.equal(recover(react),text,'React table and prose recover exact original source');
  assert.equal(recover(staticBody),text,'static table and prose recover exact original source');
  assert.equal(JSON.stringify(article),before,'rendering does not change the source article');
  for(const html of [react,stat]) {
    assert.ok(!html.includes('<script>'),'source markup cannot inject HTML');
    assert.match(html,/role="region"/);
    assert.match(html,/tabindex="0"/i,'overflow region must be keyboard focusable');
    assert.match(html,/aria-label="[^"]+"/);
    if(text===article92) {
      assert.match(html,/<table\b/);
      assert.match(html,/<caption\b[^>]*>[^<]+<\/caption>/,'semantic table needs a caption');
      assert.match(html,/rowspan="2"/i);
      assert.match(html,/colspan="2"/i);
      assert.match(html,/二‧四○公尺以上/);
      assert.match(html,/一‧八○公尺以上/);
    }
  }
  assert.equal((react.match(/<table\b/g)??[]).length,(stat.match(/<table\b/g)??[]).length,'React/static semantic table count matches');
  renderCases++;
}
console.log(`Legal table render checks passed: ${renderCases} React/static source-preserving cases, accessible overflow, spans, captions and escaping.`);
