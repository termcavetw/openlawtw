import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import postcss from 'postcss';

const root=new URL('../',import.meta.url),read=path=>readFileSync(new URL(path,root),'utf8');
const styles=['app/globals.css','app/openlawtw.css','app/rulings.css','app/v08.css','app/v09.css','app/v11.css','app/v12.css','app/universe.css','app/premium.css','components/law-reading.css','components/legal-table.css'];
// Exact-selector responsive stylesheet contracts, not a browser layout engine.
// Actual scrollWidth, table gestures and pinch zoom need separate browser QA.
function declaration(selector,property,width){
 let result,important=false;
 for(const path of styles)postcss.parse(read(path)).walkRules(rule=>{
  if(!rule.selectors.includes(selector))return;
  for(let parent=rule.parent;parent;parent=parent.parent){
   if(parent.type!=='atrule')continue;
   if(parent.name!=='media'||!/width:/.test(parent.params))return;
   if([...parent.params.matchAll(/(min|max)-width:\s*(\d+)px/g)].some(([,kind,size])=>kind==='min'?width<Number(size):width>Number(size)))return;
  }
  rule.walkDecls(property,decl=>{
   if(important&&!decl.important)return;
   result=decl.value;important=!!decl.important;
  });
 });
 return result;
}
for(const width of [320,375,390,430]){
 for(const selector of ['#root','.app','.reader-first .workspace','.reader-first .reader-tabroot','.reader-first .reader-scroll']){
  assert.equal(declaration(selector,'min-width',width),'0',`${selector} shrinks at ${width}px`);
  assert.equal(declaration(selector,'max-width',width),'100%',`${selector} stays bounded at ${width}px`);
 }
 assert.equal(declaration('.reading-column','min-width',width),'0');
 assert.equal(declaration('.reader-first .reader-scroll','overscroll-behavior-x',width),'none','Horizontal elastic movement stays inside the reader');
 assert.equal(declaration('.reading-column','max-width',width),'820px','Preserve the existing desktop reading measure');
 assert.equal(declaration('.reader-first .reader-scroll','overflow-x',width),'hidden','Reader cannot pan sideways outside a table');
 assert.equal(declaration('.reader-first .reader-scroll','overflow-y',width),'auto','Vertical reading remains scrollable');
 assert.equal(declaration('.legal-table-block','contain',width),'inline-size','Wide intrinsic table sizes stay local');
 assert.equal(declaration('.legal-table-scroll','width',width),'100%');
 assert.equal(declaration('.reader-first .reader-tabbar [data-slot=tabs-trigger] .tab-count','white-space',width),'nowrap');
 assert.equal(declaration('.reader-first .reader-tabbar [role=tablist]','overflow-x',width),'hidden','The non-table tab strip must not pan sideways either');
 assert.equal(declaration('.reader-first .reader-tabbar [data-slot=tabs-list]','gap',width),'clamp(6px,2vw,14px)');
 assert.equal(declaration('.reader-first .reader-tabbar [data-slot=tabs-trigger]','white-space',width),'normal');
 assert.equal(declaration('.reader-first .reader-tabbar [data-slot=tabs-trigger]','min-width',width),'0');
 assert.equal(declaration('.reader-first .reader-headingline','flex-wrap',width),'wrap');
 assert.equal(declaration('.chapter-heading>span','max-width',width),'100%');
 assert.equal(declaration('.chapter-heading .chapter-range','white-space',width),'normal');
 assert.equal(declaration('.chapter-heading','overflow-wrap',width),'anywhere');
 assert.equal(declaration('.law-chapter-meta','flex-wrap',width),'wrap');
 assert.equal(declaration('.law-chapter-nav select','max-width',width),'100%');
 for(const selector of ['.legal-table-scroll','.source-document-scroll']){
  assert.equal(declaration(selector,'overflow-x',width),'auto','Tables retain local horizontal scrolling');
  assert.equal(declaration(selector,'overscroll-behavior-x',width),'contain','Table edges do not chain into the page');
 }
 assert.equal(declaration('.legal-data-table','min-width',width),'34em','Never squeeze table columns to fit the phone');
}
const patch=read('app/premium.css').split('/* Let nested flex/grid readers')[1]+read('components/law-reading.css').split('/* Chapter paths/ranges')[1];
assert(!/touch-action\s*:|overflow-y\s*:\s*(?:hidden|clip)/.test(patch),'Do not disable table gestures, pinch zoom or vertical reading');
assert(read('scripts/static-html.mjs').includes('overflow-x:hidden;overflow-y:auto;overscroll-behavior-x:none'),'Static fallback is also vertical-only');
assert(!/user-scalable\s*=\s*(?:no|0)|maximum-scale\s*=\s*1(?:[,"\s]|$)/.test(read('index.html')),'Pinch zoom is not disabled');
console.log(JSON.stringify({widths:[320,375,390,430],readerShrink:'passed',tabAndChapterWrapping:'passed',localTableOverflow:'preserved',touchAndZoom:'unchanged',browserGeometry:'requires separate QA'}));
