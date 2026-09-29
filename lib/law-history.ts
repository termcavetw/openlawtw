export type LawHistoryEntry={source:string;text:string};

/** Split only unindented official record numbers, never numbered subitems. */
export function lawHistoryEntries(history:string):LawHistoryEntry[]{
 if(!history.trim())return [];
 const starts=[...history.matchAll(/^(?:\d+|[０-９]+)[.．、](?=\S)/gm)].map(match=>match.index!);
 const offsets=[0,...starts.filter(start=>start>0),history.length];
 return offsets.slice(0,-1).map((start,index)=>{
  const source=history.slice(start,offsets[index+1]);
  // Central law exports hard-wrap long sentences with two-space indentation.
  // Keep new date statements and blank paragraphs on separate lines.
  const text=source.replace(/\r\n/g,'\n').replace(/([^\n])\n[ \t]{2,}(?![ \t]|中華民國|(?:原名稱|新名稱)[:：])/g,'$1').trim();
  return {source,text};
 });
}
