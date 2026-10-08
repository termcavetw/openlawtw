import {fileURLToPath} from 'node:url';
import {gzipSync,gunzipSync} from 'node:zlib';
import {readFile,writeFile,readdir,mkdir,copyFile,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from './paths.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const dist=join(root,'dist');
// Canonical bundles are authoring inputs. Deploy only content-addressed data.
for(const name of ['laws','laws.json','search.json','rulings.json'])await rm(join(dist,'data',name),{recursive:true,force:true});
await import('./build-pages.mjs');
await import('./build-embed.mjs');
const manifest=JSON.parse(await readFile(join(root,'data/runtime-manifest.json'),'utf8'));
async function walk(dir){const entries=await readdir(dir,{withFileTypes:true});return (await Promise.all(entries.map(e=>e.isDirectory()?walk(join(dir,e.name)):[join(dir,e.name)]))).flat();}
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const files=(await walk(dist)).filter(p=>!p.endsWith('/sw.js')&&!p.endsWith('/update.html')&&!p.endsWith('/LICENSE')&&!p.endsWith('.zip')&&!p.endsWith('/openlawtw.html')&&!p.endsWith('/vercel.json')&&!p.endsWith('.md')).sort();
// The runtime bundle and worker already embed the manifest; do not download a duplicate at install.
// The social preview image is crawler metadata, not an offline UI asset. Keep it
// deployed for link previews without charging every PWA installation for it.
// The Apple touch icon is installation metadata; manifest icons remain cached
// for the offline PWA. Keep this duplicate out of the tight 3 MiB shell budget.
// /laws/index.html uses the same offline app shell as /; do not cache its duplicate catalogue HTML.
const precache=await Promise.all(files.filter(p=>!p.endsWith('/icons/social.png')&&!p.endsWith('/icons/apple-touch-icon.png')&&!p.endsWith('/embed.html')&&!p.includes('/assets/embed-')&&!p.includes('/assets/analytics-client-')&&!p.includes('/laws/')&&!p.endsWith('/sitemap.xml')&&!p.endsWith('/robots.txt')&&!p.includes('/data/')&&!p.includes('/documents/article-supplements/')).map(async p=>({url:encodeURI('/'+p.slice(dist.length+1)),sha256:sha(await readFile(p))})));
let worker=await readFile(join(root,'scripts/sw-template.js'),'utf8');
// Worker-only changes also need their own cache, so a failed install cannot
// remove the currently active release's storage.
const version='v'+JSON.parse(await readFile(join(root,'package.json'),'utf8')).version+'-'+sha(JSON.stringify(precache)+worker).slice(0,12);
worker=worker.replace('__VERSION__',version).replace('__PRECACHE__',JSON.stringify(precache)).replace('__MANIFEST__',JSON.stringify(manifest));
await writeFile(join(dist,'sw.js'),worker);
const config=JSON.parse(await readFile(join(root,'vercel.json'),'utf8'));
config.framework=null;config.buildCommand='';config.installCommand='';config.outputDirectory='.';
await writeFile(join(dist,'vercel.json'),JSON.stringify(config,null,2));
// A real standalone HTML: all CSS, JavaScript, law documents and search data inline.
let html=await readFile(join(dist,'index.html'),'utf8');
const script=html.match(/<script\b[^>]*src="([^"]+)"[^>]*><\/script>/);if(!script)throw new Error('Missing bundled script');
const js=await readFile(join(dist,script[1]),'utf8');
const styles=[...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/g)];
for(const match of styles){const path=match[0].match(/href="([^"]+)"/)[1];const css=await readFile(join(dist,path),'utf8');html=html.replace(match[0],()=>'<style>'+ css.replace(/<\/style/gi,'<\\/style')+'</style>');}
const payload={};for(const path of files.filter(p=>(p.endsWith('.json')||p.endsWith('.bin'))&&(p.includes('/data/v2/')||p.includes('/data/article-supplements/')))){const bytes=await readFile(path);payload['/'+path.slice(dist.length+1)]=JSON.parse((path.endsWith('.bin')?gunzipSync(bytes):bytes).toString());}
const data=gzipSync(Buffer.from(JSON.stringify(payload))).toString('base64');
html=html.replace(script[0],'');
html=html.replace(/<link\b[^>]*rel="(?:manifest|modulepreload|apple-touch-icon|icon)"[^>]*>/g,'');
const icon=await readFile(join(dist,'icons/icon-192.png'));
html=html.replace('</head>',()=>'<link rel="icon" href="data:image/png;base64,'+icon.toString('base64')+'"/></head>');
html=html.replace('</body>',()=>'<script type="module">const packed=Uint8Array.from(atob("'+data+'"),c=>c.charCodeAt(0));window.OPENLAWTW_OFFLINE=JSON.parse(await new Response(new Blob([packed]).stream().pipeThrough(new DecompressionStream("gzip"))).text());'+js.replace(/<\/script/gi,'<\\/script')+'</script></body>');
await writeFile(join(root,'openlawtw.html'),html);
for(const name of ['LICENSE','DATA_LICENSE.md','THIRD_PARTY_NOTICES.md','DEPLOY.md','SCHEMA.md','CITING.md','CONTRIBUTING.md','GITHUB_SETUP.md','WATCH-SHARE-EMBED.md']){await copyFile(join(root,name),join(dist,name));}
await mkdir(join(dist,'vendor'),{recursive:true});
await copyFile(join(root,'vendor/qrcode-generator.LICENSE.txt'),join(dist,'vendor/qrcode-generator.LICENSE.txt'));
console.log(JSON.stringify({version,precache:precache.length,offlineHTMLBytes:Buffer.byteLength(html),snapshot:'2026-09-18'}));

await import("./package-source.mjs");
