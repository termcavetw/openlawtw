import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {buildUniverse,lawFamily,scopedUniverse,universeFocus} from '../lib/universe.ts';
const root=new URL('../',import.meta.url),read=async p=>JSON.parse(await readFile(new URL(p,root),'utf8'));
const catalog=await read('data/runtime-catalog.json'),archive=await read('public/data/rulings.json'),manifest=await read('data/runtime-manifest.json');
async function shard(file){const bytes=await readFile(new URL('public'+file.url,root));assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256);return JSON.parse(file.encoding==='gzip'?gunzipSync(bytes):bytes);}
const layout=await shard(manifest.universe),rulings=await shard(manifest.universeRulings);
const graph=buildUniverse(catalog.laws,catalog.relations,layout.points,rulings.items);
assert.equal(graph.nodes.length,catalog.laws.length+archive.items.length);assert.equal(graph.edges.filter(e=>e.kind==='basis').length,catalog.relations.length);
assert(graph.nodes.every(n=>Number.isFinite(n.x)&&Number.isFinite(n.y)));assert.equal(graph.byId.size,graph.nodes.length);assert(graph.edges.every(e=>graph.byId.has(e.from)&&graph.byId.has(e.to)));
const originals=new Map(archive.items.map(r=>[r.id,r]));
for(const edge of graph.edges){if(edge.kind==='citation')assert(originals.get(edge.from.slice(2)).citations.includes(edge.to.slice(2)));if(edge.kind==='reference')assert(originals.get(edge.from.slice(2)).refs.some(r=>r.law===edge.to.slice(2)));}
const cycle=[{parent:'a',child:'b'},{parent:'b',child:'c'},{parent:'c',child:'a'}];assert.deepEqual([...lawFamily('a',cycle).descendants],['b','c']);
const family=lawFamily('D0070109',catalog.relations);for(const e of catalog.relations.filter(r=>r.parent==='D0070109'))assert(family.descendants.has(e.child));assert(!family.descendants.has('D0070109'));
const focus=universeFocus('l:D0070109',graph,catalog.relations);assert(focus.has('l:D0070109'));for(const id of family.descendants)assert(focus.has('l:'+id));
const tp=scopedUniverse(graph,'臺北市');assert(tp.nodes.filter(n=>n.kind==='law').every(n=>['中央','臺北市'].includes(n.region)));assert(tp.edges.every(e=>tp.byId.has(e.from)&&tp.byId.has(e.to)));
const noRulings=buildUniverse(catalog.laws,catalog.relations,layout.points);assert(!noRulings.nodes.some(n=>n.kind==='ruling'));assert(noRulings.edges.every(e=>e.kind==='basis'));
const worker=await readFile(new URL('dist/sw.js',root),'utf8'),precache=JSON.parse(worker.match(/const PRECACHE=(\[.*?\]),MANIFEST=/s)[1]);assert(!precache.some(f=>[manifest.universe.url,manifest.universeRulings.url].includes(f.url)),'Universe data is loaded only on demand');
const html=await readFile(new URL('openlawtw.html',root),'utf8'),payload=JSON.parse(gunzipSync(Buffer.from(html.match(/const packed=Uint8Array.from\(atob\("([^"]+)"\)/)[1],'base64')));assert(payload[manifest.universe.url]);assert(payload[manifest.universeRulings.url]);
console.log(JSON.stringify({universeLaws:catalog.laws.length,universeRulings:rulings.items.length,legalBasis:catalog.relations.length,rulingCrossLinks:graph.edges.filter(e=>e.kind==='citation').length,lawReferenceLinks:graph.edges.filter(e=>e.kind==='reference').length,buildingLawDescendants:family.descendants.size,layoutBytes:manifest.universe.bytes,rulingGraphBytes:manifest.universeRulings.bytes,sourceIntegrity:'passed',cycles:'passed',regionFilter:'passed',portable:'passed',precache:'on-demand'}));
