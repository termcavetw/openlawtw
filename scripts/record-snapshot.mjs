import {readFile,writeFile} from 'node:fs/promises';
import {canonicalLaw,sha} from './schema.mjs';
const root=new URL('../',import.meta.url);const read=p=>readFile(new URL(p,root),'utf8').then(JSON.parse);
const laws=await read('public/data/laws.json'),catalog=await read('data/catalog.json');
let ledger;try{ledger=await read('data/history.json');}catch{ledger={schemaVersion:2,note:'觀測紀錄不是官方修法日期；基準之前的歷史尚未收錄。',laws:{},changes:[]};}
let changes=0;
for(const law of Object.values(laws)){const hash=sha(canonicalLaw(law)),old=ledger.laws[law.id];if(old?.contentHash===hash)continue;const articles=Object.fromEntries(law.articles.map(a=>[a.no,sha(a.text)]));const changed=old?[...new Set([...Object.keys(old.articles),...Object.keys(articles)])].filter(no=>old.articles[no]!==articles[no]):[];const observedAt=catalog.collected;
 ledger.laws[law.id]={contentHash:hash,observedAt,previousContentHash:old?.contentHash||null,articles};
 if(old)ledger.changes.push({law:law.id,name:law.name,observedAt,previousContentHash:old.contentHash,contentHash:hash,changedArticles:changed});changes++;}
await writeFile(new URL('data/history.json',root),JSON.stringify(ledger));console.log('Recorded '+changes+' initial/changed law snapshots.');
