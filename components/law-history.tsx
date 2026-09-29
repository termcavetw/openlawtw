import {lawHistoryEntries} from '@/lib/law-history';

export function LawHistory({history}:{history:string}){
 const entries=lawHistoryEntries(history);
 return <section className="law-history" aria-label="法規沿革">
  <div className="law-history-entries">{entries.map((entry,index)=><p key={index}>{entry.text}</p>)}</div>
  <details className="law-history-original"><summary>顯示官方原始換行</summary><div>{history}</div></details>
 </section>;
}
