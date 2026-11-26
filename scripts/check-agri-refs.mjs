// 農業部 letters linked to central laws (prepare-data): every link points at a real letter, law and article.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalize} from '../lib/search.ts';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const manifest=read('public/data/manifest.json'),laws=read('public/data/laws.json'),agri=read('public/data/agri-rulings.json');
assert(manifest.agriRefs,'manifest lists agriRefs');
const refs=read('public'+manifest.agriRefs.url),letters=new Map(agri.items.map(x=>[x.id,x]));
assert.deepEqual(Object.keys(refs.laws).sort(),manifest.agriRefs.laws);
let links=0;
for(const [id,r] of Object.entries(refs.laws)){
 const law=laws[id];assert(law&&law.region==='中央',id+' is a central law');
 const nos=new Set(law.articles.map(a=>normalize(a.no)));
 for(const x of r.ids){assert(letters.has(x)&&refs.heads[x],id+' letter '+x+' exists');}
 for(const [no,ids] of Object.entries(r.articles)){assert(nos.has(no),id+' '+no+' is an article of '+law.name);for(const x of ids){assert(r.ids.includes(x));const t=letters.get(x);assert((t.title+t.body).includes(law.name)||law.name==='農業發展條例'&&(t.title+t.body).includes('農發條例'),x+' names '+law.name);links++;}}
 assert.deepEqual(r.ids,[...r.ids].sort((a,b)=>refs.heads[b][0].localeCompare(refs.heads[a][0])||b-a),id+' newest first');
}
assert(refs.laws.M0110013?.articles['第12條']?.length>0,'農舍辦法第12條 has letters');
console.log(JSON.stringify({agriRefLaws:Object.keys(refs.laws).length,letters:Object.keys(refs.heads).length,articleLinks:links}));
