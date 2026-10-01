import type {Article} from './law-types.ts';
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
/** Static/print markup uses the exact embedded official image, never a reconstruction. */
export function articleFiguresHTML(article:Article,printing=false):string{
 return (article.figures||[]).map(figure=>{
  const images=figure.images.filter(i=>/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(i.src));
  if(!images.length)return '';
  const official=/^https?:\/\//.test(figure.source)?`<a href="${escape(figure.source)}" target="_blank" rel="noreferrer">官方 PDF${printing?'：'+escape(figure.source):''}</a>`:'';
  const pdf=!printing&&/^data:application\/pdf;base64,[A-Za-z0-9+/]+=*$/.test(figure.pdf)?`<a href="${escape(figure.pdf)}" download="official-article.pdf">下載本庫原檔</a>`:'';
  return `<figure class="${printing?'print-official-figure':'official-article-figure'}"><figcaption>${escape(figure.title)} · 官方附件</figcaption>${images.map(i=>`${printing?'':`<div class="official-figure-scroll" role="region" tabindex="0" aria-label="${escape(figure.title)}，可左右捲動">`}<img src="${escape(i.src)}" width="${i.width}" height="${i.height}" alt="${escape(i.alt)}">${printing?'':'</div>'}`).join('')}<div class="official-figure-links">${official}${pdf}<span>原檔第 ${images.map(i=>i.page).join('、')} 頁 · 擷取 ${escape(figure.retrieved.slice(0,10))}</span></div></figure>`;
 }).join('');
}
