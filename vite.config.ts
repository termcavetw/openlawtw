import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import {readFileSync} from 'node:fs';
// Keep the adapted Canvas preset's MIT notice in every distributed JS entry.
const orbNotice=readFileSync(new URL('./components/thinking-orb.tsx',import.meta.url),'utf8').match(/^\/\*![\s\S]*?\*\//)?.[0]||'';
import { fileURLToPath, URL } from 'node:url';
export default defineConfig({plugins:[react()],resolve:{alias:{'@':fileURLToPath(new URL('.',import.meta.url))}},server:{allowedHosts:['terminal.local']},preview:{allowedHosts:['terminal.local']},build:{emptyOutDir:true,cssCodeSplit:false,chunkSizeWarningLimit:2000,rolldownOptions:{output:{banner:orbNotice,comments:{legal:true,annotation:false,jsdoc:false}}}}});
