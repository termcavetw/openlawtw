import {rm} from 'node:fs/promises';

// Generated output only. A release must not inherit an earlier bundle or page.
await rm(new URL('../dist/',import.meta.url),{recursive:true,force:true});
