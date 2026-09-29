import {join as nativeJoin} from 'node:path';
// Filesystem paths also become URLs and ZIP entry names; use portable separators.
export const join=(...parts)=>nativeJoin(...parts).replaceAll('\\','/');
