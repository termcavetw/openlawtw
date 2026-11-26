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
// 停止適用: the 112.08.24 letter revokes the 109.05.06 PVC letter (主旨), and its 說明 「爰旨揭函停止適用」 only points
// back — it must not be read as revoking the 87.06.11 letter cited in that same sentence.
const nfaItems=read('public/data/nfa-rulings.json').items,byNo=no=>nfaItems.find(x=>x.docNo.includes(no)).id;
assert.equal(nfa.revoked[byNo('1090822257')]?.[0],byNo('1120825476'),'109 PVC letter revoked by the 112 letter');
assert(!nfa.revoked[byNo('8774409')],'87 letter cited in the reasons is not revoked');
const agriRefs=read('public'+manifest.agriRefs.url),agriItems=read('public/data/agri-rulings.json').items,agriNo=no=>agriItems.find(x=>x.docNo.includes(no)).id;
assert(!agriRefs.revoked[agriNo('1031865030')],'103 令 that revoked others is not itself revoked');
let revoked=0;for(const key of ['agriRefs','landRefs','nfaRefs','centralRefs','taipeiRefs'])if(manifest[key]){const r=read('public'+manifest[key].url);for(const [id,[by,date]] of Object.entries(r.revoked)){assert(id!==by&&/^\d{4}-\d{2}-\d{2}$/.test(date));revoked++;}}
// 消防法 84.08.11 「修正公布」 (no article list) was a full revision: older letters link to the law, not to article numbers.
assert(!Object.values(nfa.laws.D0120001.articles).flat().some(id=>nfa.heads[id][0]<'1995-08-11'),'no article links before 消防法 84.08.11');
console.log(JSON.stringify({staleWarnings:out,revoked}));
