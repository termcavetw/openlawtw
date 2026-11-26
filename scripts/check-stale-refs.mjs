// Letters older than the article they discuss (prepare-data `stale`): every warning names a linked article, its date
// comes after the letter's, and known cases hold — 消防法第 11 條 was amended 112.06.21 (and 112 is after most letters).
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const manifest=read('public/data/manifest.json'),laws=read('public/data/laws.json');
const out={};
for(const key of ['agriRefs','landRefs','nfaRefs','centralRefs','taipeiRefs']){
 if(!manifest[key])continue;const refs=read('public'+manifest[key].url);assert(refs.stale&&typeof refs.stale==='object',key+' has stale');
 let n=0;for(const [id,list] of Object.entries(refs.stale)){const head=refs.heads[id];assert(head,key+' '+id+' is a letter');
  for(const [law,no,date,name] of list){assert(refs.laws[law]?.articles[no]?.map(String).includes(id),key+' '+id+' links '+law+' '+no);assert(/^\d{4}-\d{2}-\d{2}$/.test(date)&&head[0]<date,key+' '+id+' older than '+date);assert.equal(name,laws[law].name);n++;}}
 out[key]=n;
}
const nfa=read('public'+manifest.nfaRefs.url);
const byDoc=no=>Object.keys(nfa.heads).find(id=>nfa.heads[id][1].includes(no));
const older=byDoc('1110502767'),newer=byDoc('1120825476');
assert.deepEqual(nfa.stale[older]?.find(s=>s[0]==='D0120001'&&s[1]==='第11條')?.slice(0,3),['D0120001','第11條','2023-06-21'],'111 letter is older than 消防法第11條 (112.06.21)');
assert(!nfa.stale[newer]?.some(s=>s[0]==='D0120001'&&s[1]==='第11條'),'112.08 letter is not');
console.log(JSON.stringify({staleWarnings:out}));
