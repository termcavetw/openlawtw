// Official letters copied from PDFs and fixed-width pages keep the source's line breaks: every line ends where the
// printed line ended, with hanging indents. reflow() joins those wrapped lines back into paragraphs, starting a new one
// only at a heading (主旨、說明、決議…), a numbered item (一、（一）1.) or a blank line. The words are unchanged.
const HEAD=/^(主旨|說明|辦法|決議|結論|案由|附件|正本|副本|受文者|發文日期|發文字號|速別|密等|檔號|保存年限|會議時間|時間|地點|主持人|出席|列席|紀錄|討論事項|提案|【)/u;
const ITEM=/^([一二三四五六七八九十]+、|（[一二三四五六七八九十]+）|\([一二三四五六七八九十]+\)|[0-9０-９]{1,2}[\.．、](?![0-9])|\([0-9]{1,2}\)|（[0-9]{1,2}）|[甲乙丙丁戊己]、)/u;
const CJK=/[　-〿㐀-鿿＀-￯「」『』（）]/u;
const tidy=(s:string)=>s.replace(/^(主|說|辦|附|正|副)[ 　]+(旨|明|法|件|本)/u,'$1$2').replace(/[ 　]{2,}/g,' ').trim();
export function reflow(text:string):string[]{
 const out:string[]=[];let cur='';
 const flush=()=>{if(cur.trim())out.push(cur.trim());cur='';};
 for(const raw of text.replace(/\r/g,'').split('\n')){
  let line=tidy(raw);
  if(!line){flush();continue;}
  // 「說明：一、…」: the heading on its own line, the first item after it.
  const m=/^(說明|辦法|決議)[:：]\s*(?=[一二三四五六七八九十]+、|（[一二三四五六七八九十]+）)/u.exec(line);
  if(m){flush();out.push(m[1]+'：');line=line.slice(m[0].length);}
  // A numbered item starts a paragraph, unless the line before ends 「…說明」「…第」 and the number is a citation.
  const starts=HEAD.test(line)||(ITEM.test(line)&&!/(說明|附件|第|及|、|項|款)$/u.test(cur));
  if(starts)flush();
  if(!cur){cur=line;continue;}
  const a=cur.slice(-1),b=line[0];
  cur+=(CJK.test(a)||CJK.test(b)||/[，。；：、]/u.test(a))?line:' '+line;
 }
 flush();
 return out;
}
