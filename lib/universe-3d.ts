import type {UniverseNode} from './universe.ts';

export type Point3D={x:number;y:number;z:number};
export type UniverseCamera={x:number;y:number;k:number;yaw:number;pitch:number;target?:Point3D};
export type UniverseProjection={x:number;y:number;z:number;scale:number;visible:boolean};
export type UniverseSpace={points:Map<string,Point3D>;extent:number;distance:number};
export const defaultUniverseAngles={yaw:-.28,pitch:.34};
export function stableFraction(value:string){let h=2166136261;for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0)/4294967295;}

/** The existing relationship layout supplies x/y; depth is visual only, never a legal ranking. */
export function universeSpace(nodes:UniverseNode[]):UniverseSpace{
 let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
 for(const n of nodes){minX=Math.min(minX,n.x);maxX=Math.max(maxX,n.x);minY=Math.min(minY,n.y);maxY=Math.max(maxY,n.y);}
 const cx=nodes.length?(minX+maxX)/2:0,cy=nodes.length?(minY+maxY)/2:0;
 const extent=nodes.length?Math.max(200,maxX-minX,maxY-minY):1000;
 const points=new Map<string,Point3D>();
 for(const n of nodes){const x=n.x-cx,y=n.y-cy;
  // Two broad ribbons and deterministic depth scatter make the spatial structure legible.
  const z=extent*(.18*Math.sin(x/extent*5.2)+.12*Math.cos(y/extent*5.8)+(stableFraction(n.id)-.5)*.31);
  points.set(n.id,{x,y,z});
 }
 return {points,extent,distance:extent*2.2};
}
export function rotateUniversePoint(p:Point3D,yaw:number,pitch:number):Point3D{
 const sy=Math.sin(yaw),cy=Math.cos(yaw),sp=Math.sin(pitch),cp=Math.cos(pitch);
 const x=p.x*cy+p.z*sy,z=-p.x*sy+p.z*cy;
 return {x,y:p.y*cp-z*sp,z:p.y*sp+z*cp};
}
export function projectUniversePoint(p:Point3D,camera:UniverseCamera,distance:number,mode:'3d'|'2d'='3d'):UniverseProjection{
 const t=camera.target??{x:0,y:0,z:0},relative={x:p.x-t.x,y:p.y-t.y,z:p.z-t.z};
 const r=mode==='3d'?rotateUniversePoint(relative,camera.yaw,camera.pitch):{x:relative.x,y:relative.y,z:0};
 const visible=distance-r.z>distance*.08;
 const scale=mode==='3d'?distance/Math.max(distance*.08,distance-r.z):1;
 return {x:camera.x+r.x*camera.k*scale,y:camera.y+r.y*camera.k*scale,z:r.z,scale,visible};
}
export function orbitUniverseCamera(camera:UniverseCamera,yaw:number,pitch:number):UniverseCamera{
 const circle=Math.PI*2;
 return {...camera,yaw:(((camera.yaw+yaw+Math.PI)%circle)+circle)%circle-Math.PI,pitch:Math.max(-1.22,Math.min(1.22,camera.pitch+pitch))};
}
export type UniverseHit={id:string;x:number;y:number;z:number;radius:number;kind:'law'|'ruling';visible:boolean};
/** Screen-space picking prefers a front node when its visible disc overlaps another. */
export function pickUniverseNode(points:UniverseHit[],x:number,y:number):string|null{
 let best:UniverseHit|null=null,disc:UniverseHit|null=null,score=Infinity;
 for(const p of points){if(!p.visible)continue;const d=Math.hypot(x-p.x,y-p.y),radius=Math.max(p.kind==='law'?8:4,p.radius+3);if(d>radius)continue;
  if(d<=p.radius&&(!disc||p.z>disc.z||(p.z===disc.z&&d<Math.hypot(x-disc.x,y-disc.y))))disc=p;
  const next=d/radius+(p.kind==='ruling'?.18:0);
  if(next<score||(next===score&&p.z>(best?.z??-Infinity))){best=p;score=next;}
 }
 return disc?.id??best?.id??null;
}
