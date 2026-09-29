import qrcode from 'qrcode-generator';
import {safeEvidenceURL,type CaseEvidence} from './casebook';
import {validateExcerpt,type CardFormat} from './reference-card';

export function wrapCardText(ctx:CanvasRenderingContext2D,text:string,width:number){
 const result:string[]=[];
 for(const paragraph of text.replace(/\r\n/g,'\n').split('\n')){let line='';for(const char of paragraph){if(line&&ctx.measureText(line+char).width>width){result.push(line);line=char;}else line+=char;}result.push(line);}
 return result;
}
export async function renderReferenceImage(e:CaseEvidence,quote:string,format:CardFormat):Promise<Blob>{
 const problem=validateExcerpt(e.quote,quote,format);if(problem)throw Error(problem);
 const official=safeEvidenceURL(e.sourceURL);if(!official)throw Error('官方來源網址無法產生 QR Code。');
 await document.fonts.ready;
 const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=format==='portrait'?1350:1080;
 const ctx=canvas.getContext('2d');if(!ctx)throw Error('此瀏覽器無法建立分享圖片。');
 const h=canvas.height,pad=76,width=928;
 ctx.fillStyle='#f5f3ec';ctx.fillRect(0,0,1080,h);
 ctx.fillStyle='#183f37';ctx.fillRect(0,0,1080,16);
 ctx.strokeStyle='#d7ddd2';ctx.lineWidth=2;ctx.strokeRect(36,36,1008,h-72);
 ctx.fillStyle='#183f37';ctx.font='600 36px "Microsoft JhengHei", sans-serif';ctx.fillText('openlawtw',pad,110);
 ctx.font='22px "Microsoft JhengHei", sans-serif';ctx.fillStyle='#64766d';ctx.fillText(e.kind==='ruling'?'函釋 · 原文節錄':'法規 · 原文節錄',pad,154);
 ctx.fillStyle='#193d35';ctx.font='600 43px "Microsoft JhengHei", sans-serif';
 const titleLines=wrapCardText(ctx,e.title,width);titleLines.slice(0,3).forEach((line,i)=>ctx.fillText(i===2&&titleLines.length>3?line.slice(0,-1)+'…':line,pad,224+i*58));
 const top=250+Math.min(titleLines.length,3)*58,bottom=h-300;
 let font=42,lines:string[]=[];
 for(;font>=28;font-=2){ctx.font=`${font}px "Microsoft JhengHei", sans-serif`;lines=wrapCardText(ctx,quote,width);if(lines.length*font*1.55<=bottom-top)break;}
 if(font<28)throw Error('這段文字在此版面放不下，請縮短節錄或改用 4:5。');
 ctx.fillStyle='#253c36';lines.forEach((line,i)=>ctx.fillText(line,pad,top+i*font*1.55));
 ctx.strokeStyle='#b6c3b8';ctx.beginPath();ctx.moveTo(pad,h-266);ctx.lineTo(1004,h-266);ctx.stroke();
 const qr=qrcode(0,'M');qr.addData(new URL(official).href,'Byte');qr.make();
 const modules=qr.getModuleCount(),cell=Math.floor(198/(modules+8)),size=(modules+8)*cell,x=1004-size,y=h-236;
 ctx.fillStyle='#fff';ctx.fillRect(x,y,size,size);ctx.fillStyle='#163c32';
 for(let row=0;row<modules;row++)for(let col=0;col<modules;col++)if(qr.isDark(row,col))ctx.fillRect(x+(col+4)*cell,y+(row+4)*cell,cell,cell);
 ctx.fillStyle='#38544a';ctx.font='23px "Microsoft JhengHei", sans-serif';
 const date=(s:string|null)=>s?.split('T')[0]||'未提供';
 const facts=[`來源修正／發布：${date(e.officialModifiedAt)}`,`資料擷取：${date(e.observedAt)}`,new URL(official).hostname,'掃碼核對完整官方原文'];
 facts.forEach((line,i)=>ctx.fillText(line,pad,h-222+i*36,x-pad-24));
 ctx.font='21px "Microsoft JhengHei", sans-serif';ctx.fillStyle='#6b746c';ctx.fillText('本庫資料快照・節錄不代表完整規定或個案適用判斷',pad,h-56);
 return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('圖片匯出失敗。')),'image/png'));
}
