import {build} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
import {join} from './paths.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
// A separate bundle keeps third-party embeds independent of personal workspace state
// and preserves the main app's single-bundle portable HTML build.
await build({configFile:false,root,publicDir:false,plugins:[react()],resolve:{alias:{'@':root}},build:{outDir:join(root,'dist'),emptyOutDir:false,cssCodeSplit:false,rollupOptions:{input:join(root,'embed.html'),output:{entryFileNames:'assets/embed-[hash].js',assetFileNames:'assets/embed-[hash][extname]',inlineDynamicImports:true}}}});
