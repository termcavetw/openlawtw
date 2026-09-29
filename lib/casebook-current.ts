import {lawById,data} from './catalog';
import {loadFile,loadLaw,loadRuling,manifest} from './data-client';
import {normalize} from './search';
import {loadPracticeDocument} from './practice-packs';
import {currentEvidenceVersion,makeArticleEvidence,makeDocumentEvidence,makeRulingEvidence,makeSourceEvidence,type CaseEvidence,type EvidenceVersion} from './casebook';

/** Compare against this release; never silently replace a saved quotation. */
export async function resolveCaseEvidence(entry:CaseEvidence):Promise<EvidenceVersion|null>{
 const locator=entry.locator;
 if(entry.kind==='ruling'&&locator.rulingId)return currentEvidenceVersion(await makeRulingEvidence(await loadRuling(locator.rulingId),{region:'中央',observedAt:data.rulingStats.retrieved}));
 if(entry.kind==='source'&&locator.sourceId){const form=await loadPracticeDocument(locator.sourceId);return currentEvidenceVersion(await makeSourceEvidence({id:form.id,title:form.title,region:form.region,url:form.source,sourcePageURL:form.sourcePage,text:form.text,sourceHash:form.sha256,observedAt:form.retrieved}));}
 const summary=lawById.get(locator.lawId||'');if(!summary)return null;
 const full=await loadLaw(summary.id);const law={...full,retrieved:summary.retrieved};
 if(entry.kind==='article'){
  const article=law.articles.find(a=>normalize(a.no)===normalize(locator.articleNo||''));if(!article)return null;
  return currentEvidenceVersion(await makeArticleEvidence(law,article,{unitId:locator.unitId,unitLabel:locator.unitLabel}));
 }
 if(entry.kind==='document'&&locator.page){
  const textFile=manifest.documentTexts?.[law.id];if(!textFile)return null;
  let page=(await loadFile<{pages:{page:number;text:string}[]}>(textFile)).pages.find(p=>p.page===locator.page);
  if(!page&&manifest.documents?.[law.id])page=(await loadFile<{pages:{page:number;text:string}[]}>(manifest.documents[law.id])).pages.find(p=>p.page===locator.page);
  if(!page)return null;
  return currentEvidenceVersion(await makeDocumentEvidence(law,page));
 }
 return null;
}
