// lib/reflow.ts only moves line breaks: for every letter of every source the characters (ignoring whitespace) stay the
// same, and known wrapped paragraphs come back whole.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {reflow} from '../lib/reflow.ts';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const ink=s=>s.replace(/\s+/g,'').replace(/^(主|說|辦|附|正|副)(旨|明|法|件|本)/gmu,'$1$2');
let n=0,paras=0;
for(const f of ['nfa','agri','land','taipei','central','moea-factory'])for(const x of read(`public/data/${f}-rulings.json`).items){
 const text=x.body||x.summary||'';if(!text)continue;const out=reflow(text);
 assert.equal(ink(out.join('')),ink(text),`${f} ${x.id} keeps every character`);n++;paras+=out.length;}
const moea=read('public/data/moea-factory-rulings.json').items.find(x=>x.body.includes('號書函說明\n五、有關但書'));
const p=reflow(moea.body);
assert(p[0].startsWith('主旨：')&&p[0].endsWith('請查照。'),'主旨 is one paragraph');
assert(p.some(s=>s.startsWith('二、依本辦公室')&&s.includes('說明五、有關但書')),'「說明\\n五、」 is a citation, not a new item');
console.log(JSON.stringify({letters:n,paragraphs:paras}));
