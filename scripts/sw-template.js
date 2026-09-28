/* Generated release shell; immutable data survives app updates. */
const VERSION='__VERSION__',CACHE='openlawtw-shell-'+VERSION;
const DATA='openlawtw-data-v2',META='openlawtw-packs-v2',STATE='/__openlawtw_packs__';
const PRECACHE=__PRECACHE__,MANIFEST=__MANIFEST__;
const PATHS=new Set(PRECACHE.map(f=>new URL(f.url,self.location.origin).pathname));
const FILES=new Map(MANIFEST.files.map(f=>[new URL(f.url,self.location.origin).pathname,f]));
const unique=files=>[...new Map(files.map(f=>[f.url,f])).values()];
const selectedFiles=ids=>unique(MANIFEST.packs.filter(p=>ids.includes(p.id)).flatMap(p=>p.files));
async function broadcast(data){for(const c of await self.clients.matchAll({includeUncontrolled:true,type:'window'}))c.postMessage(data);}
async function state(){const cache=await caches.open(META),r=await cache.match(STATE);if(r)return await r.json();for(const key of await caches.keys())if(/^openlawtw-v0\.[4-6]/.test(key)){const legacy=await caches.open(key);if(await legacy.match('/data/laws.json')&&await legacy.match('/data/rulings.json'))return {selected:MANIFEST.packs.map(p=>p.id),release:'legacy',files:[]};}return {selected:[],release:'',files:[]};}
async function saveState(value){await (await caches.open(META)).put(STATE,new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}}));}
async function verified(file){const r=await fetch(new Request(file.url,{cache:'no-cache'}));if(!r.ok)throw Error('Download failed: '+file.url);const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await r.clone().arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');if(hash!==file.sha256)throw Error('Integrity mismatch: '+file.url);return r;}
async function download(cache,files,type,packId){let cursor=0,done=0;const results=await Promise.allSettled(Array.from({length:6},async()=>{while(cursor<files.length){const f=files[cursor++];if(!await cache.match(f.url))await cache.put(f.url,await verified(f));done++;await broadcast({type,packId,done,total:files.length,version:VERSION});}}));const failed=results.find(r=>r.status==='rejected');if(failed)throw failed.reason;}
async function packStatus(){const current=await state(),cache=await caches.open(DATA),packs=[];for(const p of MANIFEST.packs){const selected=current.selected.includes(p.id);let complete=selected;if(selected)for(const f of p.files)if(!await cache.match(f.url)){complete=false;break;}packs.push({id:p.id,selected,complete});}return {type:'PACK_STATUS',packs,release:MANIFEST.release};}
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 try{await download(cache,PRECACHE,'PRECACHE_PROGRESS');const old=await state(),selected=old.selected.filter(id=>MANIFEST.packs.some(p=>p.id===id));const files=selectedFiles(selected);
  // Commit selected packs only after the new shell and all changed shards succeed.
  await download(await caches.open(DATA),files,'PACK_PROGRESS','update');
  await cache.put(STATE,new Response(JSON.stringify({selected,release:MANIFEST.release,files:files.map(f=>f.url)})));
  await self.skipWaiting();
 }catch(error){await caches.delete(CACHE);await broadcast({type:'UPDATE_FAILED',version:VERSION});throw error;}
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE),receipt=await cache.match(STATE);if(receipt)await saveState(await receipt.json());
 for(const key of await caches.keys())if((key.startsWith('openlawtw-shell-')||/^openlawtw-v\d/.test(key))&&key!==CACHE)await caches.delete(key);
 const data=await caches.open(DATA);for(const req of await data.keys())if(!FILES.has(new URL(req.url,self.location.origin).pathname))await data.delete(req);
 await self.clients.claim();await broadcast({type:'OFFLINE_READY',version:VERSION});await broadcast(await packStatus());
})()));
let queue=Promise.resolve();
self.addEventListener('message',event=>{
 const message=event.data||{};
 if(message.type==='SKIP_WAITING')event.waitUntil(self.skipWaiting());
 if(message.type==='STATUS')event.waitUntil((async()=>{event.source?.postMessage({type:'OFFLINE_READY',version:VERSION});event.source?.postMessage(await packStatus());})());
 if(['PACK_DOWNLOAD','PACK_REMOVE'].includes(message.type)){
  const task=queue.then(async()=>{const pack=MANIFEST.packs.find(p=>p.id===message.packId);if(!pack)return;const current=await state();
   try{const cache=await caches.open(DATA);let selected=current.selected;
    if(message.type==='PACK_DOWNLOAD'){await download(cache,pack.files,'PACK_PROGRESS',pack.id);selected=[...new Set([...selected,pack.id])];}
    else selected=selected.filter(id=>id!==pack.id);
    const files=selectedFiles(selected);await saveState({selected,release:MANIFEST.release,files:files.map(f=>f.url)});
    if(message.type==='PACK_REMOVE'){const keep=new Set(files.map(f=>f.url));for(const f of pack.files)if(!keep.has(f.url))await cache.delete(f.url);}
    await broadcast({type:'PACK_READY',packId:pack.id});await broadcast(await packStatus());
   }catch(error){await broadcast({type:'PACK_FAILED',packId:pack.id,message:'下載未完成；原有離線資料已保留。'});}
  });queue=task.catch(()=>{});event.waitUntil(task);
 }
});
self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url);if(req.method!=='GET'||url.origin!==self.location.origin)return;
 let lawId='';try{lawId=decodeURIComponent(url.pathname.match(/^\/laws\/([^/]+)\.html$/)?.[1]||'');}catch{}
 if(req.mode==='navigate'&&(url.pathname==='/'||url.pathname==='/index.html'||Object.prototype.hasOwnProperty.call(MANIFEST.laws,lawId))){event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match('/index.html'))||fetch(req)));return;}
 if(PATHS.has(url.pathname)){event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(url.pathname))||fetch(req)));return;}
 const file=FILES.get(url.pathname);if(file)event.respondWith((async()=>{const cache=await caches.open(DATA),saved=await cache.match(file.url);if(saved)return saved;const r=await verified(file);try{await cache.put(file.url,r.clone());}catch{/* Pack installation reports quota failures; online reading can continue. */}return r;})());
});
