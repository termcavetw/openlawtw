// Deterministic visual layout only. Coordinates are not legal rank or geography.
export function makeUniverseData(catalog,archive){
 const laws=[...catalog.laws].sort((a,b)=>a.id.localeCompare(b.id)),byId=new Map(),degree=new Map();
 for(const r of catalog.relations){degree.set(r.parent,(degree.get(r.parent)||0)+1);degree.set(r.child,(degree.get(r.child)||0)+1);}
 const categories=catalog.categories;
 const hash=s=>{let n=2166136261;for(const c of s)n=Math.imul(n^c.charCodeAt(0),16777619);return (n>>>0)/4294967296;};
 const nodes=laws.map(l=>{const cat=categories.indexOf(l.category),a=cat/categories.length*Math.PI*2-Math.PI/2;const d=degree.get(l.id)||0;const r=100+hash(l.id)*190,b=hash(l.id+'angle')*Math.PI*2;const node={id:l.id,x:Math.cos(a)*520+Math.cos(b)*r,y:Math.sin(a)*450+Math.sin(b)*r,degree:d,vx:0,vy:0,ax:Math.cos(a)*520,ay:Math.sin(a)*450};byId.set(l.id,node);return node;});
 const links=catalog.relations.map(r=>[byId.get(r.parent),byId.get(r.child)]).filter(e=>e.every(Boolean));
 for(let step=0;step<190;step++){
  const cool=1-step/230;
  for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){const a=nodes[i],b=nodes[j];let dx=b.x-a.x,dy=b.y-a.y,d2=dx*dx+dy*dy;if(d2<.01){dx=.1;dy=.1;d2=.02;}const d=Math.sqrt(d2),f=Math.min(6,540/d2)*cool;const min=18+Math.sqrt(a.degree+b.degree)*2;const force=f+(d<min?(min-d)*.13:0);a.vx-=dx/d*force;a.vy-=dy/d*force;b.vx+=dx/d*force;b.vy+=dy/d*force;}
  for(const [a,b] of links){const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1,f=(d-65-Math.sqrt(a.degree)*9)*.012*cool;a.vx+=dx/d*f;a.vy+=dy/d*f;b.vx-=dx/d*f;b.vy-=dy/d*f;}
  for(const n of nodes){n.vx+=(n.ax-n.x)*.0015*cool;n.vy+=(n.ay-n.y)*.0015*cool;n.vx*=.62;n.vy*=.62;n.x+=n.vx;n.y+=n.vy;}
 }
 const points=nodes.map(({id,x,y,degree})=>({id,x:+x.toFixed(2),y:+y.toFixed(2),degree}));
 const items=archive.items.map(r=>{const ids=[...new Set(r.refs.map(ref=>ref.law))].filter(id=>byId.has(id));const anchors=ids.map(id=>byId.get(id));const a=hash(r.id)*Math.PI*2,spread=50+hash(r.id+'r')*185;let x,y;if(anchors.length){x=anchors.reduce((s,p)=>s+p.x,0)/anchors.length+Math.cos(a)*spread;y=anchors.reduce((s,p)=>s+p.y,0)/anchors.length+Math.sin(a)*spread;}else{const ring=1000+hash(r.id+'ring')*300;x=Math.cos(a)*ring;y=Math.sin(a)*ring*.8;}return {id:r.id,title:r.title,number:r.number,date:r.date,url:r.url,topic:r.topic,laws:ids,cites:r.citations,x:+x.toFixed(2),y:+y.toFixed(2)};});
 return {laws:{schema:1,points},rulings:{schema:1,items}};
}
