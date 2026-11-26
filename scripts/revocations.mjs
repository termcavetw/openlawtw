// Letters that a later letter of the same source declares 停止適用／不再援用／不再適用 — the rule the skill uses
// for 國土署, plus: a clause that only points back (「爰旨揭函停止適用」) names no new target, so it is skipped
// rather than read as revoking whatever other letter that sentence happens to cite.
const CN='零〇○一二三四五六七八九';
const digit=ch=>{const i=CN.indexOf(ch);return i<3?0:i-2;};
export const plain=s=>(s||'').normalize('NFKC').replace(/\s+/g,'').replace(/[零〇○一二三四五六七八九]{3,}/g,m=>[...m].map(digit).join(''));
const NUM=/第([0-9A-Za-z]{5,12})號/g;
export const numberKey=docNo=>{const t=plain(docNo);const m=/第([0-9A-Za-z]{5,12})號/.exec(t)||/字第?([0-9A-Za-z]{5,12})/.exec(t);return m?m[1]:'';};
const BACK=/(旨揭|前揭|上揭|上開|前開|前述|上述|該|本)(號)?(函|令|函釋|規定|解釋|函示|決議|會議紀錄)?(之?規定)?(內容)?(自即日起?|自即日|即日起|應|爰|，|、)*$/u;
// items: [{id, date, docNo, text}] → Map(oldId → {by, partial})
export function revocations(items){
 const byKey=new Map();for(const x of items){const k=numberKey(x.docNo);if(k&&!byKey.has(k))byKey.set(k,x);}
 const out=new Map();
 for(const r of items){
  const text=plain(r.text);
  for(const m of text.matchAll(/([^。；]{0,200}?)(停止適用|不再援用|不再適用)/gu)){
   let seg=m[1];
   if(/(無|未|非|不|免|是否|得否|應否)[廢止或]{0,3}$/u.test(seg))continue;
   if(BACK.test(seg.slice(-14))&&!/第[0-9A-Za-z]{5,12}號[^第]{0,12}$/.test(seg))continue;
   let by=r;const k=seg.lastIndexOf('經');
   if(k>=0){const after=[...seg.slice(k).matchAll(NUM)].map(x=>x[1]);if(after.length){const b=byKey.get(after.at(-1));if(b)by=b;seg=seg.slice(0,k);}}
   const nums=[...seg.matchAll(NUM)].map(x=>x[1]);if(!nums.length)continue;
   const targets=/等\d*[函則件]/u.test(seg)?nums:[nums.at(-1)];
   const partial=/部分|說明[一二三四五六七八九十0-9]|第[0-9一二三四五六七八九十]+[點項款]/u.test(seg.slice(seg.lastIndexOf(targets.at(-1))));
   // The cited letter is the means or the base, not the object: 「爰於100年…號函停止適用…」「前以96年…號函確定原則，旨揭各函…停止適用」
   // 「103年…號令核釋有案，與前開意旨未符之相關函釋已停止適用」.
   const gap=seg.slice(seg.lastIndexOf(targets.at(-1))+targets.at(-1).length+1).replace(/^(書函|函釋|函|令)/u,"");
   if(/旨揭|前揭|上揭|各函|相關函|其他函|等函|函釋/u.test(gap))continue;
   const before=seg.slice(Math.max(0,seg.lastIndexOf(targets.at(-1))-30),seg.lastIndexOf(targets.at(-1)));
   if(targets.length===1&&/(於|以)\d{2,3}年/u.test(before))continue;
   for(const n of targets){const old=byKey.get(n);
    if(!old||old.id===by.id||!old.date||!by.date||old.date>=by.date)continue;
    const prev=out.get(old.id);if(!prev||prev.by.date<by.date)out.set(old.id,{by,partial});}
  }
 }
 return out;
}
