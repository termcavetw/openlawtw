import {normalize} from './search.ts';
export type ChooseLaw=(id:string,article?:string,unit?:string)=>void;
export type LawRoute={law:string;article:string;unit:string;ruling:string};
export const articleAddress=(no:string)=>normalize(no).replace(/^第/,'').replace(/[條點]$/,'');
export const unitAnchor=(id:string)=>id.slice(id.indexOf('/a:')+1).replace(/[/:]/g,'-');
export function lawHref(id:string,article='',unit=''){
 const anchor=unit?unitAnchor(unit):article?'a-'+articleAddress(article):'';
 return '/laws/'+encodeURIComponent(id)+'.html'+(anchor?'#'+anchor:'');
}
export function legacyLawHash(id:string,article='',unit=''){
 return '#'+new URLSearchParams({law:id,...(article?{article}:{}),...(unit?{unit}:{})});
}
export function readRoute(pathname:string,hash:string):LawRoute{
 const params=new URLSearchParams(hash.slice(1));
 if(params.has('ruling'))return {law:'',article:'',unit:'',ruling:params.get('ruling')||''};
 if(params.has('law'))return {law:params.get('law')||'',article:params.get('article')||'',unit:params.get('unit')||'',ruling:''};
 const path=pathname.match(/^\/laws\/([^/]+)\.html$/);let law='';
 try{law=path?decodeURIComponent(path[1]):'';}catch{}
 const target=hash.match(/^#a-(\d+(?:-\d+)?)(?:-p-(\d+))?(?:-i-(\d+))?(?:-s-(\d+))?$/);
 const article=target?'第 '+target[1]+' 條':'';
 const unit=law&&target?.[2]?law+'/a:'+target[1]+'/p:'+target[2]+(target[3]?'/i:'+target[3]:'')+(target[3]&&target[4]?'/s:'+target[4]:''):'';
 return {law,article,unit,ruling:''};
}
