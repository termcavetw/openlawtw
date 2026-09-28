import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
export default defineConfig({plugins:[react()],resolve:{alias:{'@':fileURLToPath(new URL('.',import.meta.url))}},server:{allowedHosts:['terminal.local']},preview:{allowedHosts:['terminal.local']},build:{emptyOutDir:true,cssCodeSplit:false,chunkSizeWarningLimit:2000}});
