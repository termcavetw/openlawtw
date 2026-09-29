import {fileURLToPath} from 'node:url';
import {makeZip,walk} from './zip.mjs';
import {join} from './paths.mjs';
import {stat} from 'node:fs/promises';
const root=fileURLToPath(new URL('../',import.meta.url));
const roots=['app','components','lib','data','vendor','scripts','public/data','public/icons','.github'];
const files=(await Promise.all(roots.map(p=>walk(join(root,p))))).flat().filter(path=>!path.startsWith(join(root,'public/data/laws')+'/')&&!path.startsWith(join(root,'public/data/v2')+'/')&&!path.startsWith(join(root,'public/data/versions')+'/')&&!['runtime-catalog.json','runtime-manifest.json','runtime-citations.json'].includes(path.split('/').at(-1))&&!['manifest.json','aliases.json','yinxian-laws.js'].some(n=>path===join(root,'public/data',n))&&!path.includes('/__pycache__/')&&!path.endsWith('.pyc'));
for(const p of ['index.html','main.tsx','package.json','package-lock.json','vite.config.ts','tsconfig.json','postcss.config.mjs','vercel.json','public/manifest.webmanifest','public/update.html','README.md','DEPLOY.md','LOCAL-LAWS.md','LOCAL-LAWS-2026-09-29.md','LOCAL-LAWS-ROUND2-2026-09-29.md','DOCUMENT-SEARCH-2026-09-29.md','WORKSPACE-2026-09-29.md','PDF-CHAPTERS-2026-09-29.md','UNIVERSE-3D-2026-09-29.md','REMOVE-PRACTICE-2026-09-29.md','CLEANUP-LAWS-2026-09-29.md','LICENSE','DATA_LICENSE.md','THIRD_PARTY_NOTICES.md','CONTRIBUTING.md','VALIDATION.md','SCHEMA.md','.gitignore','requirements.txt']){try{await stat(join(root,p));files.push(join(root,p));}catch{}}
// GitHub Desktop / git has no web-upload file-count limit.
await makeZip(join(root,'dist/openlawtw-source.zip'),files.sort().map(path=>({path,name:path.slice(root.length)})));
console.log('Packaged openlawtw-source.zip: '+files.length+' source files');
