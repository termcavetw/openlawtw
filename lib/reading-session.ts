export function lastLaw():string{try{return localStorage.getItem('openlawtw-last-law')||'';}catch{return '';}}
export function rememberLaw(id:string){try{localStorage.setItem('openlawtw-last-law',id);}catch{}}
