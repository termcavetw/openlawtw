import type {ReactNode} from 'react';
import {splitLegalText,legalCharacterWidth,type LegalTextBlock} from '@/lib/legal-tables';

function FixedSource({text}:{text:string}){
 return <pre className="legal-table-raw">{[...text].map((character,index)=>character==='\n'?'\n':<span key={index} style={{width:`${legalCharacterWidth(character)/2}em`}}>{character}</span>)}</pre>;
}
export function LegalTable({block,label,renderText=(text:string)=>text}:{block:LegalTextBlock;label:string;renderText?:(text:string)=>ReactNode}){
 if(block.kind!=='table')return null;
 const table=block.table;
 return <figure className="legal-table-block" data-source-start={block.start} data-source-end={block.end}>
  <figcaption>{label} · {table?'表格':'原文圖表'}<span>寬表可左右捲動</span></figcaption>
  {table?<><div className="legal-table-scroll" role="region" aria-label={label+'表格，可左右捲動'} tabIndex={0}><table className="legal-data-table"><caption className="legal-table-caption">{label}官方條文表格</caption><tbody>{table.rows.map((row,index)=><tr key={index}>{row.map(cell=><td key={cell.column} rowSpan={cell.rowSpan} colSpan={cell.colSpan}>{renderText(cell.text)}</td>)}</tr>)}</tbody></table></div><details className="legal-table-source"><summary>核對原始文字表格</summary><div className="legal-table-scroll" role="region" aria-label={label+'原始文字表格'} tabIndex={0}><FixedSource text={block.text}/></div></details></>:<div className="legal-table-scroll" role="region" aria-label={label+'原始文字表格，可左右捲動'} tabIndex={0}><FixedSource text={block.text}/></div>}
 </figure>;
}
export function LegalTextWithTables({text,label,renderText}:{text:string;label:string;renderText:(text:string)=>ReactNode}){
 return <>{splitLegalText(text).map(block=>block.kind==='table'?<LegalTable key={block.start} block={block} label={label} renderText={renderText}/>:<span key={block.start}>{renderText(block.text)}</span>)}</>;
}
