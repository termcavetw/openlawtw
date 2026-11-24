// Reading layout for page text of the Taoyuan minutes and 土管要點 (OCR or PDF text layer).
// Display only: the stored text, search and snippets keep the raw page text.
// - joins lines the scan wrapped mid-sentence back into paragraphs
// - starts a new paragraph at list markers (壹、 一、 （一） 1. (1)) and form labels (主旨：…)
// - turns runs of rows whose cells OCR joined with " | " into a table
// - drops binding-margin marks (裝／訂／線, leading dots) and the English letterhead line
export type OcrBlock=
 {kind:'p';text:string;level:number;head:boolean;marker:boolean}|
 {kind:'table';rows:string[][];cols:number;warn:boolean;merged:number}|
 {kind:'raw';lines:string[]}|
 {kind:'meta';text:string};

const MARKERS:[RegExp,number][]=[
 [/^[壹貳參肆伍陸柒捌玖拾]+、/,0],[/^第[一二三四五六七八九十百零〇\d]+[章節條點](?=\s|[^\s])/,0],[/^【[^】]{1,12}】/,0],
 [/^[一二三四五六七八九十百]+、/,1],[/^[（(][一二三四五六七八九十百]+[)）]/,2],
 [/^\d{1,2}[.．、](?!\d)/,3],[/^[（(]\d{1,2}[)）]/,4],[/^[A-Za-z][.．、]/,4],
];
const LABEL=/^(?:主旨|說明|決議|結論|案由|辦法|附件|正本|副本|受文者|發文日期|發文字號|速別|密等及解密條件或保密期限|地址|承辦人|電話|傳真|電子信箱|檔號|保存年限|會議名稱|會議時間|會議地點|開會時間|開會地點|主席|主持人|記錄|出列席人員|出席人員|列席人員|提案單位|提案人|公會建議|審查意見|決議事項|散會)[^：:]{0,6}[：:]/;
const END=/[。！？；：」』）)】]$/;
const FOOTER=/第\s*\d+\s*頁[，,]?\s*共\s*\d+\s*頁|^\d+\s*\/\s*\d+$/;
const JUNK=/^(?:[裝訂線|.．·。、:：\-—_]\s*){1,3}$/;
const LETTERHEAD_EN=/^[A-Za-z]{2,}\s+of\s+B\w+\s+Administration/i;

const width=(s:string)=>[...s].reduce((n,ch)=>n+(/[\x00-\x7f]/.test(ch)?.5:1),0);
// A marker followed by a closing quote or punctuation is the tail of a wrapped line (「…會議\n(67)」會議紀錄」), not a list item.
export const markerLevel=(s:string)=>{for(const [re,level] of MARKERS){const m=re.exec(s);if(m&&!/^[」』）)，。、.．]/.test(s.slice(m[0].length)))return level;}return -1;};

// A label cell: short text with no figures (第一種, 住宅區, 高中（職）).
const isLabel=(s:string)=>width(s)<=12&&!/\d/.test(s);
// Column count of a table: the most common count among rows with two or more cells (ties: the larger).
function headerCols(rows:string[][]){
 const n=new Map<number,number>();for(const r of rows)if(r.length>1)n.set(r.length,(n.get(r.length)||0)+1);
 let best=0,seen=0;for(const [k,v] of n)if(v>seen||(v===seen&&k>best)){best=k;seen=v;}
 return best;
}
/** Rows OCR read from a table. A name that wraps over two lines (第一種 / 住宅區) leaves its figures on a row
 * one cell short between two one-cell rows; those three rows are merged back (第一種住宅區 | 50 | 120 | …).
 * A table that still has rows with a different number of cells cannot be aligned safely and is shown as
 * its raw lines; one with only full-width text rows left is drawn with a warning. */
const figure=(s:string)=>/\d/.test(s.replace(/[（(][^）)]*[）)]/g,''));
const numericHead=(s:string)=>/率|%|％|面積|高度|樓層|公尺|m²|㎡/.test(s);
/** Header lines above the first row of figures, stacked into one header row. Column labels OCR split over lines
 * (土地使 / 用分區, 建蔽率 / (%)) are joined cell by cell; a header cell read on its own line is put where the
 * numeric headers (率, %) line up with the numeric data columns. Null when that cannot be decided. */
function stackHeader(head:string[][],data:string[][],cols:number):string[]|null{
 const multi=head.filter(r=>r.length>1),single=head.filter(r=>r.length===1).map(r=>r[0]);
 if(!multi.length||multi.some(r=>r.length!==multi[0].length))return null;
 const joined=multi[0].map((_,j)=>multi.map(r=>r[j]).join(''));
 if(joined.length===cols&&!single.length)return joined;
 if(joined.length!==cols-1||single.length!==1)return null;
 const full=data.filter(r=>r.length===cols);if(!full.length)return null;
 const numericCol=[...Array(cols)].map((_,j)=>full.filter(r=>figure(r[j])).length*2>full.length);
 const fits=[...Array(cols)].map((_,at)=>{const h=[...joined.slice(0,at),single[0],...joined.slice(at)];return h.filter((c,j)=>numericHead(c)===numericCol[j]).length;});
 const best=Math.max(...fits);if(best<cols||fits.filter(f=>f===best).length>1)return null;
 const at=fits.indexOf(best);return [...joined.slice(0,at),single[0],...joined.slice(at)];
}
export function tableBlock(lines:string[]):OcrBlock{
 const parsed=lines.map(l=>l.split(/\s*\|\s*/).filter(Boolean));
 // The header width is either the widest row or the most common one (when most data rows lost their name cell
 // the common count is one short); use whichever leaves every multi-cell row aligned.
 const lengths=parsed.filter(r=>r.length>1).map(r=>r.length);
 const candidates=[...new Set([Math.max(0,...lengths),headerCols(parsed)])];
 for(const cols of candidates){
  if(cols<2)continue;
  let rows=parsed.map(r=>[...r]);let merged=0,rebuilt=false;
  const firstData=rows.findIndex(r=>r.some(figure));
  // The first name of a wrapped row (第一種 over 50 | 120 | …) belongs to the data, not the header.
  let headEnd=firstData;
  if(headEnd>0&&rows[headEnd].length===cols-1&&rows[headEnd-1].length===1&&isLabel(rows[headEnd-1][0]))headEnd--;
  if(headEnd>0&&rows.slice(0,headEnd).some(r=>r.length>1&&r.length!==cols||r.length===1)){
   const header=stackHeader(rows.slice(0,headEnd),rows.slice(firstData),cols);
   if(header){rows=[header,...rows.slice(headEnd)];rebuilt=true;}
  }
  if(cols>=3)for(let k=1;k<rows.length-1;k++){
   const [up,mid,down]=[rows[k-1],rows[k],rows[k+1]];
   if(mid.length===cols-1&&up.length===1&&down.length===1&&isLabel(up[0])&&isLabel(down[0])&&!isLabel(mid[0])){
    rows.splice(k-1,3,[up[0]+down[0],...mid]);merged++;
   }
  }
  if(rows.some(r=>r.length>1&&r.length!==cols))continue;
  return {kind:'table',rows,cols,warn:rebuilt||merged>0||rows.some(r=>r.length!==cols),merged};
 }
 return {kind:'raw',lines};
}

export function layoutPage(text:string):OcrBlock[]{
 const lines=text.split('\n')
  .map(l=>l.replace(/^\s*[.．·]\s+/,'').replace(/^\s*[裝訂線]\s{2,}/,'').replace(/\s{2,}/g,' ').trim())
  .filter(l=>l&&!JUNK.test(l)&&!LETTERHEAD_EN.test(l));
 const plain=lines.filter(l=>!l.includes(' | ')).map(width).sort((a,b)=>b-a);
 // The scan's full line width: the 80th-percentile long line, so one long title does not set it.
 const full=plain.length?plain[Math.min(plain.length-1,Math.floor(plain.length*.2))]:0;
 const blocks:OcrBlock[]=[];
 let i=0;
 while(i<lines.length){
  const line=lines[i];
  if(FOOTER.test(line)&&width(line)<40){blocks.push({kind:'meta',text:line.replace(/\s*\|\s*/g,'　')});i++;continue;}
  if(line.includes(' | ')){
   // A table runs while rows have cells; up to two rows OCR read as one run of text stay inside it as full-width rows.
   const isRow=(k:number)=>k<lines.length&&lines[k].includes(' | ')&&!(FOOTER.test(lines[k])&&width(lines[k])<40);
   let j=i;while(isRow(j)||(j>i&&!FOOTER.test(lines[j]||'')&&(isRow(j+1)||(!isRow(j+1)&&isRow(j+2)&&!FOOTER.test(lines[j+1]||'')))))j++;
   if(j-i>=2){blocks.push(tableBlock(lines.slice(i,j)));i=j;continue;}
   // A single row of cells (主席：… | 記錄：…) reads as one line with wide gaps.
   blocks.push({kind:'p',text:line.split(/\s*\|\s*/).filter(Boolean).join('　　'),level:Math.max(0,markerLevel(line)),head:false,marker:markerLevel(line)>=0});i++;continue;
  }
  let text=line;const level=markerLevel(line);
  // Join following lines while this one runs to the full width without ending a sentence.
  while(i+1<lines.length){
   const next=lines[i+1];
   const last=text.split('\n').pop()||'';
   const wrapped=full>=16&&width(last)>=full*.82&&!END.test(last);
   if(!wrapped||next.includes(' | ')||markerLevel(next)>=0||LABEL.test(next)||FOOTER.test(next))break;
   text+=/[A-Za-z0-9]$/.test(text)&&/^[A-Za-z0-9]/.test(next)?' '+next:next;i++;
  }
  const head=/^【[^】]{1,12}】$/.test(text)||(level===0&&width(text)<=26&&!/[。；，、]$/.test(text));
  blocks.push({kind:'p',text,level:Math.max(0,level),head,marker:level>=0});i++;
 }
 return blocks;
}
