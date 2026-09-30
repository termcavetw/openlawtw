import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
import postcss from 'postcss';
import {structure} from './schema.mjs';

const root=new URL('../',import.meta.url),read=path=>readFileSync(new URL(path,root),'utf8');
const styles=['app/globals.css','app/openlawtw.css','app/rulings.css','app/v08.css','app/v09.css','app/v11.css','app/v12.css','app/universe.css','app/premium.css'];
// Resolve the exact reader selector through the shipped cascade at desktop and
// phone widths. This is a stylesheet contract, not a substitute for browser QA.
function declaration(selector,property,width){
 let result;
 for(const path of styles)postcss.parse(read(path)).walkRules(rule=>{
  if(!rule.selectors.includes(selector))return;
  for(let parent=rule.parent;parent;parent=parent.parent){
   if(parent.type!=='atrule')continue;
   if(parent.name!=='media')return;
   if([...parent.params.matchAll(/(min|max)-width:\s*(\d+)px/g)].some(([,kind,size])=>kind==='min'?width<Number(size):width>Number(size)))return;
   if(!/width:/.test(parent.params))return;
  }
  rule.walkDecls(property,decl=>{result=decl.value;});
 });
 return result;
}
for(const width of [320,390,768,899,900,1440]){
 assert.equal(declaration('.reader-first .article-text','line-height',width),'1.7',`Compact law text at ${width}px`);
 assert.equal(declaration('.article-text .legal-unit--paragraph','margin-block',width),'0 .45em','Paragraphs remain more distinct than list items');
 for(const kind of ['item','subitem'])assert.equal(declaration('.article-text .legal-unit--'+kind,'margin-block',width),'.15em','List spacing stays compact');
 assert.equal(declaration('.article-text .legal-unit--paragraph','white-space',width),'pre-line','Source paragraph line breaks remain visible');
}

// Render the real ArticleText component with its unrelated interactive controls
// stubbed; verify nested units, source whitespace, targets and font preferences.
const require=createRequire(import.meta.url),exports={};
const code=ts.transpileModule(read('components/article-text.tsx'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const empty=()=>null;
const dependencies={
 'lucide-react':{Copy:empty,Link2:empty,ChevronDown:empty},
 './legal-table':{LegalTextWithTables:({text,renderText})=>renderText(text)},
 './law-navigation':{Highlight:({text})=>text},
 './legal-reference-text':{LegalReferenceText:({text,renderText})=>renderText(text)},
 '@/lib/routes':{unitAnchor:id=>'unit-'+id,lawHref:()=>''},
 '@/lib/portable':{shareURL:()=>''},
 './casebook':{AddEvidenceButton:empty},
 './reference-share':{ReferenceShareButton:empty},
 '@/lib/casebook':{makeArticleEvidence:empty},
};
Function('require','exports',code)(specifier=>dependencies[specifier]??require(specifier),exports);
const text='本條適用下列事項：\n一、第一款原文。\n（一）第一目原文。\n二、第二款原文。\n第二項原文。';
const article={no:'第 1 條',text,path:[],structure:structure(text,'spacing/a:1',true)};
assert.equal(article.structure.status,'parsed');
const original=JSON.stringify(article),law={id:'spacing',name:'測試法規',url:'https://example.test/official'};
let cases=0;
for(const value of [article,{...article,text:'保留來源段落。\n\n  縮排續行。',structure:undefined}]){
 for(const fontSize of [16,18,20,22]){
  const html=renderToStaticMarkup(createElement(exports.ArticleText,{article:value,law,query:'',fontSize,onCopy:empty,onChoose:empty,activeUnit:'spacing/a:1/p:1/i:1'}));
  assert(html.includes(`style="font-size:${fontSize}px"`),'Existing user font control remains independent');
  assert.equal(html.split('<details')[0].replace(/<[^>]*>/g,''),value.text,'Every source character and newline is retained');
  if(value.structure){assert(html.includes('legal-unit--subitem'));assert(html.includes('unit-target'));assert(html.includes('data-unit="spacing/a:1/p:2"'));}
  cases++;
 }
}
assert.equal(JSON.stringify(article),original,'Rendering never rewrites source structure');
const preview=read('components/ruling-preview.css');
assert(preview.includes('-webkit-line-clamp:3')&&preview.includes('line-height:1.75'),'Ruling previews retain their independent three-line typography');
console.log(JSON.stringify({responsiveWidths:6,articleRenderCases:cases,lawLineHeight:1.7,paragraphGap:'.45em',listGap:'.15em',sourceText:'preserved',fontControls:'preserved',rulingPreview:'unchanged',browserVerification:'separate'}));
