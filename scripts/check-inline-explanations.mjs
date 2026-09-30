import assert from 'node:assert/strict';
import fs from 'node:fs';
import {lawDefinitions,definitionOccurrences} from '../lib/legal-definitions.ts';
import {createCitationMatcher} from '../lib/citations.ts';
const laws=Object.values(JSON.parse(fs.readFileSync('public/data/laws.json','utf8')));
const targets=JSON.parse(fs.readFileSync('data/runtime-citations.json','utf8'));
const find=createCitationMatcher(laws,targets),building=laws.find(l=>l.id==='D0070109'),design=laws.find(l=>l.id==='D0070115');
let count=0,lawCount=0,markedArticles=0;
for(const law of laws){
 const ds=lawDefinitions(law);count+=ds.length;if(ds.length)lawCount++;
 assert.equal(new Set(ds.map(d=>d.term)).size,ds.length);
 for(const d of ds){const a=law.articles.find(a=>a.no===d.article);assert(a);assert.equal(d.text,a.text.slice(d.start,d.end));assert(d.text.includes(d.term));}
 for(const a of law.articles){const marks=definitionOccurrences(law,a,find(a.text,law,a));if(marks.length)markedArticles++;
  assert(marks.length<=6);assert.equal(new Set(marks.map(m=>m.definition.term)).size,marks.length);
  let at=0,reassembled='';for(const mark of marks){assert.equal(a.text.slice(mark.start,mark.end),mark.definition.term);assert.notEqual(mark.definition.article,a.no);assert(mark.start>=at);reassembled+=a.text.slice(at,mark.start)+a.text.slice(mark.start,mark.end);at=mark.end;}
  assert.equal(reassembled+a.text.slice(at),a.text,'wrapping must retain every source character');
 }
}
assert(count>400&&lawCount>80&&markedArticles>1000);
const definitions=lawDefinitions(design),road=definitions.find(d=>d.term==='私設通路');assert(road);assert.equal(road.article,'第 1 條');assert(road.text.includes('三十八、私設通路：'));
assert(!definitions.find(d=>d.term==='退縮建築深度').text.includes('四十二、'),'single-character next label still ends previous definition');
assert(!definitions.some(d=>d.term==='隔音性能'),'section-only definition must not leak across whole law');
assert(lawDefinitions(building).some(d=>d.term==='建築物'&&d.article==='第 4 條'));
const mock={...design,articles:[{no:'第 1 條',path:[],text:'本編用語定義如下：\n一、測試名詞：完整正式定義。\n二、另一名詞：另一段。'},{no:'第 2 條',path:[],text:'測試名詞與測試名詞；另一名詞。'}]};
assert.deepEqual(definitionOccurrences(mock,mock.articles[1]).map(m=>m.definition.term),['測試名詞','另一名詞']);
assert.equal(definitionOccurrences(mock,mock.articles[0]).length,0);
const duplicate={...mock,articles:[...mock.articles,{no:'第 3 條',path:[],text:'本編用語定義如下：\n一、測試名詞：不同定義。'}]};assert(!lawDefinitions(duplicate).some(d=>d.term==='測試名詞'));
const foreign={...mock,name:'範例辦法',kind:'命令',articles:[{no:'第 1 條',path:[],text:'本法所稱測試名詞，指正式定義。'}]};assert.equal(lawDefinitions(foreign).length,0);
assert.equal(find('未收錄特別建築法第73條',building).length,0);
assert.equal(find('日本法第73條',building).length,0);
assert.equal(find('依未收錄法第73條辦理',building).length,0);
assert.deepEqual(find('依建築法第73條、第74條及第75條',design).map(r=>r.law.id+':'+r.article),['D0070109:第 73 條','D0070109:第 74 條','D0070109:第 75 條']);
assert.equal(find('本編第2條',design)[0]?.law.id,design.id);
assert.equal(find('本法第73條',design)[0].law.id,building.id);
assert.equal(find('本條第2項',building,building.articles.find(a=>a.no==='第 73 條'))[0].unit,'D0070109/a:73/p:2');
assert.equal(find('本條第2項',building).length,0);
const aliasLaw={...design,articles:[{no:'第 1 條',path:[],text:'依建築法（以下簡稱本法）第七十三條訂定。'}]};assert.equal(find('依本法第73條',aliasLaw)[0].law.id,building.id);
assert.equal(find('建法第73條',design).length,0,'Undeclared abbreviations stay plain text');
assert.equal(find('依建築法第73條、第999999條').length,1);
assert.equal(find('本條例第73條',building,building.articles[0]).length,0);
const unknownAlias={...aliasLaw,articles:[{no:'第 1 條',text:'依未收錄建築法（以下簡稱本法）訂定。',path:[]}]};assert.equal(find('本法第73條',unknownAlias).length,0);
console.log(JSON.stringify({lawCount,officialDefinitions:count,markedArticles,definitionSourceFidelity:'passed',sameLawScope:'passed',densityAndFirstMention:'passed',citationAmbiguityAndSequences:'passed'}));

// Render the real inline component: wrappers must not alter selectable/copyable
// legal text, including punctuation and repeated terms. Preview stays unmounted.
const {createRequire}=await import('node:module'),require=createRequire(import.meta.url);
const {createElement}=await import('react'),{renderToStaticMarkup}=await import('react-dom/server');
const ts=(await import('typescript')).default;
const exports={};
const moduleCode=ts.transpileModule(fs.readFileSync('components/legal-reference-text.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const deps={
 '@/lib/catalog':{data:{laws}},'@/lib/citations':{createCitationMatcher},
 '@/data/runtime-citations.json':{default:targets},'@/data/runtime-citation-context.json':{default:{}},'@/lib/routes':{lawHref:(id,no)=>'/laws/'+id+'#'+no,legacyLawHash:()=>''},
 '@/lib/portable':{isPortable:()=>false},'./legal-inline-preview.css':{},'./legal-inline-preview':{default:()=>null},
};
Function('require','exports',moduleCode)(name=>deps[name]??require(name),exports);
const sample={no:'第 999 條',path:[],text:'私設通路；私設通路。依建築法第73條第2項辦理。\n道路 & <原文>。'};
const refs=find(sample.text,design,sample),defs=definitionOccurrences(design,sample,refs);
const html=renderToStaticMarkup(createElement(exports.LegalReferenceText,{text:sample.text,law:design,onChoose:()=>{},definitions:defs,references:refs}));
const decode=s=>s.replace(/&(amp|lt|gt|quot|#x27);/g,(_,key)=>({amp:'&',lt:'<',gt:'>',quot:'"','#x27':"'"}[key]));
assert.equal(decode(html.replace(/<[^>]*>/g,'')),sample.text);
assert.equal((html.match(/aria-label="私設通路：/g)||[]).length,1);
assert(html.includes('class="legal-reference"'));assert(!html.includes('legal-preview-body'));

assert(!fs.readdirSync('dist/assets').some(name=>/^legal-inline-preview.*\.js$/.test(name)),'Standalone HTML must not depend on a split preview module');

// Exercise the actual preview's loading/error/ready rendering with deterministic
// hook state. Focus trapping and viewport behavior require separate browser QA.
const previewSource=fs.readFileSync('components/legal-inline-preview.tsx','utf8');
const previewCode=ts.transpileModule(previewSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
function previewState(states,reference=find('建築法第73條')[0]){let cursor=0;const result={};const box=({children})=>createElement('div',null,children);
 const dependencies={'./thinking-orb':{ThinkingOrb:()=>null},react:{Fragment:Symbol.for('react.fragment'),useMemo:fn=>fn(),useEffect:()=>{},useState:initial=>[states[cursor++]??initial,()=>{}]},'radix-ui':{Dialog:{Root:box,Portal:box,Overlay:()=>null,Content:box,Title:box,Description:box,Close:box}},'lucide-react':{X:()=>null,ExternalLink:()=>null,ArrowUpRight:()=>null,Pin:()=>null},'../lib/data-client':{loadLaw:()=>{throw Error('No render-time load');}},'../lib/routes':{lawHref:()=>'/verified-target',legacyLawHash:()=>''},'../lib/portable':{isPortable:()=>false},'../lib/catalog':{lawById:new Map(laws.map(l=>[l.id,l]))},'../lib/legal-tables':{splitLegalText:text=>[{kind:'text',text,start:0,end:text.length}]},'./legal-table':{LegalTable:()=>null},'./legal-inline-preview.css':{}};
 Function('require','exports',previewCode)(name=>dependencies[name]??require(name),result);
 return renderToStaticMarkup(createElement(result.default,{selection:reference.kind==='definition'?reference:{kind:'citation',reference,trigger:{}},onClose:()=>{},onChoose:()=>{}}));
}
assert(previewState([]).includes('正在載入官方原文'));
const failure=previewState([null,true]);assert(failure.includes('原文暫時無法載入')&&failure.includes('重試')&&failure.includes('官方來源'));
const ready=previewState([building,false]);assert(ready.includes('閱讀完整法條')&&ready.includes('快照：'));
assert(previewSource.includes('controller.abort()')&&previewSource.includes("e.name!=='AbortError'"));
assert(previewSource.includes('focus({preventScroll:true})'));
// A prior paragraph's named foreign law never becomes the default scope of the
// next paragraph. Use a synthetic fixture; these records are not added to data.
const procedure={...building,id:'procedure-test',name:'刑事訴訟法',articles:[{no:'第 253-1 條',path:[],text:''},{no:'第 323 條',path:[],text:''}]};
const criminal={...building,id:'criminal-test',name:'刑法',articles:[{no:'第 83 條',path:[],text:''},{no:'第 323 條',path:[],text:''}]};
const scoped=createCitationMatcher([procedure,criminal],{'procedure-test':{'253-1':['第 253-1 條',[[],[],[],[]]],'323':['第 323 條',[[]]]},'criminal-test':{'83':['第 83 條',[[],[],[]]],'323':['第 323 條',[[]]]}});
const paragraphs='依刑法第83條第3項辦理。\n第323條第1項但書。';
assert.deepEqual(scoped(paragraphs,procedure,procedure.articles[0]).map(r=>r.law.id),['criminal-test','procedure-test'],'Bare next-paragraph reference resets to the verified source law');
const explicitLocal='依刑法第83條第3項辦理。\n依第323條第1項但書辦理。';
assert.deepEqual(scoped(explicitLocal,procedure,procedure.articles[0]).map(r=>r.law.id),['criminal-test','procedure-test'],'Verified local context resets at the paragraph boundary');

const manifest=JSON.parse(fs.readFileSync('public/data/manifest.json','utf8'));
const fullDesign=JSON.parse(fs.readFileSync('public'+manifest.laws.D0070115.url,'utf8'));
const subRef=find('本編第16條第1項第1款',design,design.articles[1])[0];
const highlighted=previewState([fullDesign,false],subRef);assert(highlighted.includes('legal-preview-target'));assert(highlighted.includes('三、前二款範圍外之基地'),'An exact subunit highlights without discarding the rest of the article');assert(!highlighted.includes('9999-12-31'),'Undetermined official dates remain hidden');

const localDefinition=previewState([null,true],{kind:'definition',definition:road,law:design,trigger:{}});assert(localDefinition.includes('三十八、私設通路'));assert(!localDefinition.includes('原文暫時無法載入'),'A prior citation failure cannot poison a local definition');
