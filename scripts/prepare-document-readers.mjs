import {readFile} from 'node:fs/promises';
import {dirname,resolve,sep,extname} from 'node:path';
import {createHash} from 'node:crypto';

/** Images are kept in per-chapter shards: browsing a law never downloads every diagram. */
export async function prepareDocumentReaders(root,sources,emit){
 const catalog=JSON.parse(await readFile(resolve(root,'data/documents/readers/catalog.json'),'utf8'));
 const indices={},files={};
 for(const [id,path] of Object.entries(catalog)){
  const base=resolve(root,'data/documents/readers'),readerPath=resolve(base,path);
  if(!readerPath.startsWith(base+sep))throw Error('Reader path outside source directory');
  const reader=JSON.parse(await readFile(readerPath,'utf8'));
  if(reader.schemaVersion!==1||reader.lawId!==id||reader.sourceSha256!==sources[id]?.sha256||reader.pages!==sources[id]?.pages)throw Error('Illustrated reader source mismatch: '+id);
  const chapters=[];files[id]=[];
  for(const chapter of reader.chapters){
   const sections=[];
   for(const section of chapter.sections){
    const blocks=[];
    for(const block of section.blocks){
     if(block.type==='text'){blocks.push(block);continue;}
     if(block.type!=='image')throw Error('Unsupported reader block');
     const imagePath=resolve(dirname(readerPath),block.file);
     if(!imagePath.startsWith(dirname(readerPath)+sep))throw Error('Reader image outside source directory');
     const mime={'.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg'}[extname(imagePath)];
     if(!mime)throw Error('Unsupported reader image');
     const bytes=await readFile(imagePath);
     if(createHash('sha256').update(bytes).digest('hex')!==block.sha256)throw Error('Reader image checksum mismatch: '+block.file);
     const {file,...image}=block;
     blocks.push({...image,src:'data:'+mime+';base64,'+bytes.toString('base64')});
    }
    sections.push({id:section.id,title:section.title,startPage:section.startPage,endPage:section.endPage,blocks});
   }
   const payload={...chapter,sourceSha256:reader.sourceSha256,sections};
   const file=await emit('document-chapter',payload);files[id].push(file);
   chapters.push({id:chapter.id,title:chapter.title,startPage:chapter.startPage,endPage:chapter.endPage,file,sections:sections.map(({blocks,...section},i)=>({...section,text:chapter.sections[i].searchText||blocks.map(b=>b.type==='text'?b.text:b.caption||b.alt).join('\n'),anchors:blocks.map((b,index)=>({index,page:b.page,...(b.id?{id:b.id}:{}),text:b.type==='text'?b.text:b.caption||b.alt}))}))});
  }
  indices[id]=await emit('document-reader',{schemaVersion:1,lawId:id,sourceSha256:reader.sourceSha256,pages:reader.pages,chapters});
  files[id].push(indices[id]);
 }
 return {indices,files};
}
