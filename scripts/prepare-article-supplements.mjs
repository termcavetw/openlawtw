import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {join} from './paths.mjs';

/** Keep full evidence in source control, but only the small view model in the app shell. */
export async function prepareArticleSupplements(root){
 const source=JSON.parse(await readFile(join(root,'data/documents/article-supplements/catalog.json'),'utf8'));
 const records=source.records.map(({id,lawId,article,articleNo,title,source,sourcePage,retrieved,versionNote,versionSource,pages,alternatives,supplementalFiles})=>({
  id,lawId,article,articleNo,title,source,sourcePage,retrieved:retrieved.slice(0,10),versionNote,versionSource,
  pages:pages.map(({page,src,width,height})=>({page,src,width,height})),
  alternatives:alternatives.map(({title,url})=>({title,url})),
  supplementalFiles:supplementalFiles.map(({title,url,src,width,height})=>({title,url,src,width,height}))
 }));
 const bytes=JSON.stringify({records}),hash=createHash('sha256').update(bytes).digest('hex'),url='/data/article-supplements/view-'+hash+'.json';
 await rm(join(root,'public/data/article-supplements'),{recursive:true,force:true});
 await mkdir(join(root,'public/data/article-supplements'),{recursive:true});
 await writeFile(join(root,'public'+url),bytes);
 // Compact only the generated index; verify every title and zero-padded FileId round-trips.
 const suffixes=[...new Set(source.records.flatMap(record=>record.alternatives.map(file=>file.title.slice((record.articleNo+'補充圖例').length))))];
 const index={suffixes,lawId:source.lawId,file:{url,sha256:hash,bytes:Buffer.byteLength(bytes)},records:source.records.map(record=>[record.article,record.alternatives.map(file=>{const match=file.url.match(/^https:\/\/law\.moj\.gov\.tw\/LawClass\/LawGetFile\.ashx\?FileId=(\d{10})$/);if(!match||!file.title.startsWith(record.articleNo+'補充圖例'))throw Error('Unverified supplement link');const suffix=file.title.slice((record.articleNo+'補充圖例').length),id=Number(match[1]);if(String(id).padStart(10,'0')!==match[1])throw Error('Invalid supplement FileId');return [suffixes.indexOf(suffix),id];})])};
 await writeFile(join(root,'data/runtime-article-supplement-index.json'),JSON.stringify(index));
 await writeFile(join(root,'data/runtime-article-supplements.json'),JSON.stringify({records}));
}
