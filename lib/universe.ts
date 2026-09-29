import type {Law,Relation} from './law-types.ts';

export type UniversePoint={id:string;x:number;y:number;degree:number};
export type UniverseRuling={id:string;title:string;number:string;date:string;url:string;topic:string;laws:string[];cites:string[];x:number;y:number};
export type UniverseLawData={schema:1;points:UniversePoint[]};
export type UniverseRulingData={schema:1;items:UniverseRuling[]};
export type UniverseNode={id:string;sourceId:string;label:string;kind:'law'|'ruling';region:string;category:string;x:number;y:number;radius:number;degree:number};
export type UniverseEdge={from:string;to:string;kind:'basis'|'reference'|'citation';evidence?:Relation};
export type UniverseGraph={nodes:UniverseNode[];edges:UniverseEdge[];byId:Map<string,UniverseNode>};
export function buildUniverse(laws:Law[],relations:Relation[],points:UniversePoint[],rulings:UniverseRuling[]=[]):UniverseGraph{
 const positions=new Map(points.map(p=>[p.id,p]));
 const nodes:UniverseNode[]=laws.map(l=>{const p=positions.get(l.id);return {id:'l:'+l.id,sourceId:l.id,label:l.name,kind:'law',region:l.region,category:l.category,x:p?.x??0,y:p?.y??0,radius:4.5+Math.min(15,Math.sqrt(p?.degree??0)*1.8),degree:p?.degree??0};});
 const byId=new Map(nodes.map(n=>[n.id,n]));
 for(const r of rulings){const node:UniverseNode={id:'r:'+r.id,sourceId:r.id,label:r.number||r.title,kind:'ruling',region:'函釋',category:r.topic,x:r.x,y:r.y,radius:2.6,degree:r.cites.length};nodes.push(node);byId.set(node.id,node);}
 const edges:UniverseEdge[]=relations.filter(r=>byId.has('l:'+r.parent)&&byId.has('l:'+r.child)).map(evidence=>({from:'l:'+evidence.parent,to:'l:'+evidence.child,kind:'basis',evidence}));
 for(const r of rulings){for(const law of new Set(r.laws))if(byId.has('l:'+law))edges.push({from:'r:'+r.id,to:'l:'+law,kind:'reference'});for(const cite of new Set(r.cites))if(cite!==r.id&&byId.has('r:'+cite))edges.push({from:'r:'+r.id,to:'r:'+cite,kind:'citation'});}
 return {nodes,edges,byId};
}
export function lawFamily(id:string,relations:Relation[]){
 const descendants=new Set<string>(),parents=new Set(relations.filter(r=>r.child===id).map(r=>r.parent));
 const children=new Map<string,string[]>();for(const r of relations){const list=children.get(r.parent)??[];list.push(r.child);children.set(r.parent,list);}
 const queue=[id],visited=new Set([id]);for(let i=0;i<queue.length;i++)for(const child of children.get(queue[i])??[]){if(visited.has(child))continue;visited.add(child);descendants.add(child);queue.push(child);}
 return {descendants,parents};
}
export function universeFocus(id:string,graph:UniverseGraph,relations:Relation[]){
 const found=new Set<string>([id]);
 if(id.startsWith('l:')){const {descendants,parents}=lawFamily(id.slice(2),relations);for(const law of [...descendants,...parents])found.add('l:'+law);const family=new Set(found);for(const e of graph.edges)if(e.kind==='reference'&&family.has(e.to))found.add(e.from);}
 else for(const e of graph.edges)if(e.from===id||e.to===id){found.add(e.from);found.add(e.to);}
 return found;
}
export function scopedUniverse(graph:UniverseGraph,region:string){
 if(region==='全台')return graph;
 const ids=new Set(graph.nodes.filter(n=>n.kind==='law'&&(n.region==='中央'||n.region===region)).map(n=>n.id));
 for(const e of graph.edges)if(e.kind==='reference'&&ids.has(e.to))ids.add(e.from);
 const nodes=graph.nodes.filter(n=>ids.has(n.id));return {nodes,edges:graph.edges.filter(e=>ids.has(e.from)&&ids.has(e.to)),byId:new Map(nodes.map(n=>[n.id,n]))};
}
