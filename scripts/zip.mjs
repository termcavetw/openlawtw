import {deflateRawSync} from 'node:zlib';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
const table=Uint32Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
const crc32=bytes=>{let n=0xffffffff;for(const b of bytes)n=table[(n^b)&255]^(n>>>8);return (n^0xffffffff)>>>0;};
export async function walk(dir){return (await Promise.all((await readdir(dir,{withFileTypes:true})).map(e=>e.isDirectory()?walk(join(dir,e.name)):[join(dir,e.name)]))).flat();}
export async function makeZip(output,entries){
 const local=[],central=[];let offset=0;
 for(const entry of entries){const name=Buffer.from(entry.name);const bytes=await readFile(entry.path);const zipped=deflateRawSync(bytes,{level:9});const crc=crc32(bytes);const header=Buffer.alloc(30);header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt16LE(0x800,6);header.writeUInt16LE(8,8);header.writeUInt16LE(0x5d3c,12);header.writeUInt32LE(crc,14);header.writeUInt32LE(zipped.length,18);header.writeUInt32LE(bytes.length,22);header.writeUInt16LE(name.length,26);local.push(header,name,zipped);
 const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50);c.writeUInt16LE(20,4);header.copy(c,6,4,30);c.writeUInt32LE(offset,42);central.push(c,name);offset+=header.length+name.length+zipped.length;
 }
 const cd=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(cd.length,12);end.writeUInt32LE(offset,16);await writeFile(output,Buffer.concat([...local,cd,end]));
}
