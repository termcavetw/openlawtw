import {data,lawById} from './catalog';
import {loadLaw,loadRuling} from './data-client';
import {hashEvidenceText,makeRulingEvidence,type Casebook} from './casebook';
import {resolveCaseSnapshot} from './casebook-current';
import {evidenceWatchSnapshot,WATCH_QUOTE_LIMIT,type WatchSnapshot,type WatchTarget} from './watchlist';
import {lawHref} from './routes';

export function watchTargets(laws:string[],rulings:string[],book:Casebook):WatchTarget[]{
 return [
  ...[...new Set(laws)].map(id=>({key:'law:'+id,label:'收藏法規',resolve:async():Promise<WatchSnapshot|null>=>{
   const summary=lawById.get(id);if(!summary)return null;
   const law=await loadLaw(id);
   if(law.coverage!=='full'&&!law.document)return null;
   const text=[law.preamble||'',...law.articles.map(a=>a.no+'\n'+a.text)].filter(Boolean).join('\n\n');
   return {title:law.name,quote:text.slice(0,WATCH_QUOTE_LIMIT),truncated:text.length>WATCH_QUOTE_LIMIT,contentHash:await hashEvidenceText(text),sourceHash:law.document?.sha256||null,observedAt:summary.retrieved||null,officialDate:law.modified||null,sourceURL:law.url,href:lawHref(id)};
  }})),
  ...[...new Set(rulings)].map(id=>({key:'ruling:'+id,label:'收藏函釋',resolve:async()=>evidenceWatchSnapshot(await makeRulingEvidence(await loadRuling(id),{region:'中央',observedAt:data.rulingStats.retrieved}))})),
  ...book.folders.flatMap(folder=>folder.entries.map(entry=>({key:'case:'+folder.id+':'+entry.id,label:'案件：'+folder.name,baseline:evidenceWatchSnapshot(entry),resolve:async()=>{const current=await resolveCaseSnapshot(entry);return current?evidenceWatchSnapshot(current):null;}}))),
 ];
}
