import {forwardRef,useEffect,useImperativeHandle,useMemo,useRef,useState} from 'react';
import type {UniverseGraph,UniverseNode} from '@/lib/universe';
import {defaultUniverseAngles,orbitUniverseCamera,pickUniverseNode,projectUniversePoint,universeSpace,type UniverseCamera,type UniverseHit,type UniverseProjection} from '@/lib/universe-3d';

export type UniverseCanvasHandle={fit:(ids?:Set<string>,animate?:boolean)=>void;zoom:(factor:number)=>void;rotate:(yaw:number,pitch:number)=>void;reset:()=>void;exportPNG:()=>void};
// Preserve the original topic colors; shape still distinguishes legal-source type.
const palette=['#62d9f7','#7de4c8','#ecbd7e','#b69bfa','#f5d98b','#8cd0b4','#8ca9eb','#ef9cb6'];
const categories=['建築與設計','使用與室內裝修','都市計畫與土地','都市更新與危老','消防與公共安全','農業與山坡地','環境與其他規範','目的事業與設立標準'];
export const universeColor=(n:UniverseNode)=>n.kind==='ruling'?'#f2c997':palette[Math.max(0,categories.indexOf(n.category))];
type ProjectedNode=UniverseHit&UniverseProjection&{node:UniverseNode;active:boolean;tier:number};
type Gesture={startX:number;startY:number;lastX:number;lastY:number;moved:boolean;distance:number;pan:boolean};
type Props={graph:UniverseGraph;focus:Set<string>|null;selected:string;mode?:'3d'|'2d';autoRotate?:boolean;onSelect:(id:string)=>void;onInteract:()=>void;onZoom:(percent:number)=>void};
const font='"Noto Sans TC",system-ui,sans-serif';
const tau=Math.PI*2;

export const UniverseCanvas=forwardRef<UniverseCanvasHandle,Props>(function UniverseCanvas({graph,focus,selected,mode='3d',autoRotate=false,onSelect,onInteract,onZoom},ref){
 const canvas=useRef<HTMLCanvasElement>(null),host=useRef<HTMLDivElement>(null),size=useRef({w:800,h:600,dpr:1,mobile:false});
 const camera=useRef<UniverseCamera>({x:400,y:300,k:.5,...defaultUniverseAngles}),frame=useRef(0),animation=useRef(0),drawRef=useRef(()=>{}),initialized=useRef(false),lastZoom=useRef(-1);
 const space=useMemo(()=>universeSpace(graph.nodes),[graph]);
 const callbacks=useRef({onSelect,onInteract,onZoom});callbacks.current={onSelect,onInteract,onZoom};
 const data=useRef({graph,focus,selected,mode,space});data.current={graph,focus,selected,mode,space};
 const pointers=useRef(new Map<number,{x:number;y:number}>()),gesture=useRef<Gesture|null>(null);
 const labelHits=useRef<{id:string;x:number;y:number;w:number;h:number}[]>([]);
 const projected=useRef<ProjectedNode[]>([]),glows=useRef(new Map<string,HTMLCanvasElement>()),measurements=useRef(new Map<string,number>());
 const [hover,setHover]=useState<{node:UniverseNode;x:number;y:number}|null>(null);
 const reduced=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 function schedule(){if(!frame.current)frame.current=requestAnimationFrame(()=>{frame.current=0;drawRef.current();});}
 function change(next:UniverseCamera){camera.current=next;const percent=Math.round(next.k*100);if(percent!==lastZoom.current){lastZoom.current=percent;callbacks.current.onZoom(percent);}schedule();}
 function stopAnimation(){cancelAnimationFrame(animation.current);animation.current=0;}
 function moveTo(next:UniverseCamera,animate=false){stopAnimation();if(!animate||reduced()){change(next);return;}const from={...camera.current},start=performance.now();const tick=(now:number)=>{const t=Math.min(1,(now-start)/340),e=1-Math.pow(1-t,3);const a=from.target??{x:0,y:0,z:0},b=next.target??{x:0,y:0,z:0};change({...next,x:from.x+(next.x-from.x)*e,y:from.y+(next.y-from.y)*e,k:from.k+(next.k-from.k)*e,target:{x:a.x+(b.x-a.x)*e,y:a.y+(b.y-a.y)*e,z:a.z+(b.z-a.z)*e}});if(t<1)animation.current=requestAnimationFrame(tick);else animation.current=0;};animation.current=requestAnimationFrame(tick);}
 function fit(ids?:Set<string>,animate=false){
  const {graph:g,space:s,mode:m}=data.current,target={x:0,y:0,z:0};
  if(ids){let count=0;for(const id of ids){const p=s.points.get(id);if(p){target.x+=p.x;target.y+=p.y;target.z+=p.z;count++;}}if(count){target.x/=count;target.y/=count;target.z/=count;}}
  const c={...camera.current,x:0,y:0,k:1,target};
  let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity,count=0;
  for(const n of g.nodes){if(ids&&!ids.has(n.id))continue;const point=s.points.get(n.id);if(!point)continue;const p=projectUniversePoint(point,c,s.distance,m);if(!p.visible)continue;left=Math.min(left,p.x-n.radius-35);right=Math.max(right,p.x+n.radius+35);top=Math.min(top,p.y-n.radius-35);bottom=Math.max(bottom,p.y+n.radius+35);count++;}
  if(!count)return;const {w,h,mobile}=size.current,paddingTop=mobile?112:130,paddingBottom=mobile&&ids?Math.max(106,h*.44):mobile?106:86;
  const k=Math.min(2.3,Math.max(.065,Math.min(Math.max(100,w-76)/(right-left),Math.max(90,h-paddingTop-paddingBottom)/(bottom-top))));
  moveTo({...camera.current,x:w/2-(left+right)/2*k,y:(paddingTop+h-paddingBottom)/2-(top+bottom)/2*k,k,target},animate);
 }
 function zoomAt(factor:number,x=size.current.w/2,y=size.current.h/2){stopAnimation();const c=camera.current,k=Math.max(.045,Math.min(8,c.k*factor)),ratio=k/c.k;change({...c,x:x-(x-c.x)*ratio,y:y-(y-c.y)*ratio,k});}
 function rotate(yaw:number,pitch:number){stopAnimation();setHover(null);change(orbitUniverseCamera(camera.current,yaw,pitch));}
 function reset(){stopAnimation();camera.current={...camera.current,...defaultUniverseAngles};fit();}
 function pick(x:number,y:number){const label=labelHits.current.find(b=>x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h);const id=label?.id??pickUniverseNode(projected.current,x,y);return id?data.current.graph.byId.get(id)??null:null;}
 function glow(color:string){let sprite=glows.current.get(color);if(sprite)return sprite;sprite=document.createElement('canvas');sprite.width=sprite.height=96;const ctx=sprite.getContext('2d');if(ctx){const g=ctx.createRadialGradient(48,48,1,48,48,48);g.addColorStop(0,color+'bb');g.addColorStop(.14,color+'78');g.addColorStop(.4,color+'26');g.addColorStop(1,color+'00');ctx.fillStyle=g;ctx.fillRect(0,0,96,96);}glows.current.set(color,sprite);return sprite;}
 function backdrop(ctx:CanvasRenderingContext2D,w:number,h:number,_dpr:number){
  // Only evidence-backed nodes and relationships appear on this quiet field.
  // No decorative stars, nebula gradients or orbital paths compete with them.
  ctx.fillStyle='#080809';ctx.fillRect(0,0,w,h);
 }
 function draw(){
  const el=canvas.current,ctx=el?.getContext('2d');if(!ctx)return;
  const {w,h,dpr}=size.current,c=camera.current,{graph:g,focus:f,selected:s,mode:m,space:sp}=data.current;
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.globalAlpha=1;ctx.clearRect(0,0,w,h);backdrop(ctx,w,h,dpr);
  const points:ProjectedNode[]=[],byId=new Map<string,ProjectedNode>();
  for(const n of g.nodes){const point=sp.points.get(n.id);if(!point)continue;const p=projectUniversePoint(point,c,sp.distance,m),radius=Math.max(n.kind==='law'?1.9:.72,n.radius*c.k*p.scale);
   const out:ProjectedNode={...p,id:n.id,kind:n.kind,node:n,radius,active:!f||f.has(n.id),tier:m==='2d'?3:Math.max(0,Math.min(5,Math.floor((p.z/sp.extent+.8)*3.75)))};points.push(out);byId.set(n.id,out);
  }
  projected.current=points;
  // Batch each relationship style/depth into one path, including the optional 9,000+ ruling layer.
  const edgeGroups=Array.from({length:18},()=>[] as {a:ProjectedNode;b:ProjectedNode}[]);
  for(const e of g.edges){const a=byId.get(e.from),b=byId.get(e.to);if(!a||!b||!a.visible||!b.visible)continue;if((a.x<-30&&b.x<-30)||(a.x>w+30&&b.x>w+30)||(a.y<-30&&b.y<-30)||(a.y>h+30&&b.y>h+30))continue;
   const active=a.active&&b.active,index=e.kind==='basis'?0:e.kind==='reference'?1:2,depth=m==='2d'?2:Math.max(0,Math.min(2,Math.floor((a.tier+b.tier)/4)));
   edgeGroups[(active?9:0)+index*3+depth].push({a,b});
  }
  for(let group=0;group<edgeGroups.length;group++){if(!edgeGroups[group].length)continue;const active=group>=9,kind=Math.floor(group%9/3),depth=group%3;
   ctx.globalAlpha=active?(f?.32+depth*.12:kind===0?.14+depth*.09:.045+depth*.018):.018;
   ctx.strokeStyle=kind===0?'#b8b8c0':kind===1?'#96969f':'#b0b0b9';ctx.lineWidth=active&&f&&kind===0?1.1:kind===0?.75:.5;ctx.setLineDash(kind===2?[3,5]:[]);ctx.beginPath();
   for(const {a,b} of edgeGroups[group]){ctx.moveTo(a.x,a.y);if(kind===0){const bend=m==='3d'?.036:.02;ctx.quadraticCurveTo((a.x+b.x)/2+(a.y-b.y)*bend,(a.y+b.y)/2+(b.x-a.x)*bend,b.x,b.y);}else ctx.lineTo(b.x,b.y);}ctx.stroke();
  }
  ctx.setLineDash([]);
  if(f&&c.k>.22){ctx.globalAlpha=.7;ctx.fillStyle='#dedee3';ctx.beginPath();for(const e of g.edges){if(e.kind!=='basis')continue;const a=byId.get(e.from),b=byId.get(e.to);if(!a?.active||!b?.active||!a.visible||!b.visible||b.x<0||b.x>w||b.y<0||b.y>h)continue;const angle=Math.atan2(b.y-a.y,b.x-a.x),r=b.radius+4,x=b.x-Math.cos(angle)*r,y=b.y-Math.sin(angle)*r;ctx.moveTo(x,y);ctx.lineTo(x-Math.cos(angle-.4)*5,y-Math.sin(angle-.4)*5);ctx.lineTo(x-Math.cos(angle+.4)*5,y-Math.sin(angle+.4)*5);ctx.closePath();}ctx.fill();}
  const visible=points.filter(p=>p.visible&&p.x>-64&&p.x<w+64&&p.y>-64&&p.y<h+64);
  // Six depth layers avoid thousands of sorts/gradients while still drawing front objects last.
  for(let tier=0;tier<6;tier++){
   const layer=visible.filter(p=>p.tier===tier);
   for(const p of layer){if(p.id!==s||!p.active)continue;const color='#ffffff',r=Math.max(12,p.radius*3);ctx.globalAlpha=.24;ctx.drawImage(glow(color),p.x-r,p.y-r,r*2,r*2);}
   const groups=new Map<string,ProjectedNode[]>();for(const p of layer){const key=(p.active?'a':'b')+(p.node.kind==='ruling'?'r':p.node.region==='中央'?'c':'l')+universeColor(p.node);const list=groups.get(key)??[];list.push(p);groups.set(key,list);}
   for(const [key,list] of groups){const active=key[0]==='a',kind=key[1],color=key.slice(2);ctx.globalAlpha=active?(kind==='r'?.22+tier*.07:.46+tier*.105):kind==='r'?.05:.10;ctx.fillStyle=color;ctx.strokeStyle=color;ctx.lineWidth=kind==='l'?Math.max(.9,Math.min(1.8,c.k*2)):1;ctx.beginPath();
    for(const p of list){ctx.moveTo(p.x+p.radius,p.y);ctx.arc(p.x,p.y,p.radius,0,tau);}if(kind==='l'){ctx.stroke();}else ctx.fill();
   }
   ctx.globalAlpha=.78;ctx.fillStyle='#fafafa';ctx.beginPath();for(const p of layer){if(!p.active||p.node.kind!=='law'||p.node.region!=='中央'||p.radius<3.2)continue;ctx.moveTo(p.x+p.radius*.24,p.y);ctx.arc(p.x,p.y,p.radius*.24,0,tau);}ctx.fill();
  }
  const chosen=byId.get(s);
  if(chosen?.visible&&chosen.x>-80&&chosen.x<w+80&&chosen.y>-80&&chosen.y<h+80){const p=chosen,r=Math.max(p.radius+7,13);ctx.globalAlpha=1;ctx.strokeStyle='#ffffff';ctx.lineWidth=1.4;ctx.beginPath();ctx.arc(p.x,p.y,r,0,tau);ctx.stroke();}
  labelHits.current=[];
  const boxes:{x:number;y:number;w:number;h:number}[]=[],labels=visible.filter(p=>p.id===s||(p.node.kind==='law'&&p.active&&(p.node.degree>5||c.k>1.25||(!!f&&c.k>.6)))).sort((a,b)=>Number(b.id===s)-Number(a.id===s)||b.node.degree-a.node.degree||b.z-a.z);
  for(const p of labels){const isSelected=p.id===s;if(boxes.length>(f?52:30)&&!isSelected)break;if(p.x<12||p.x>w-12||p.y<98||p.y>h-68)continue;
   const maxChars=w<600?18:25,text=p.node.label.length>maxChars?p.node.label.slice(0,maxChars-1)+'…':p.node.label;ctx.font=(isSelected?'600 13px':'12px')+' '+font;
   const key=(isSelected?'s':'n')+text;let tw=measurements.current.get(key);if(tw===undefined){tw=ctx.measureText(text).width;measurements.current.set(key,tw);}
   const b={x:Math.max(8,Math.min(w-tw-20,p.x-tw/2-6)),y:p.y+p.radius+7,w:tw+12,h:22};if(b.y+b.h>h-54||(!isSelected&&boxes.some(a=>a.x<b.x+b.w+7&&a.x+a.w+7>b.x&&a.y<b.y+b.h+5&&a.y+a.h+5>b.y)))continue;
   boxes.push(b);labelHits.current.push({...b,id:p.id});ctx.globalAlpha=isSelected?.95:.83;ctx.fillStyle=isSelected?'#f1f1f3':'#131315';ctx.beginPath();ctx.roundRect(b.x,b.y,b.w,b.h,4);ctx.fill();if(isSelected){ctx.globalAlpha=.55;ctx.strokeStyle='#f1f1f3';ctx.lineWidth=.6;ctx.stroke();}ctx.globalAlpha=isSelected?1:.8;ctx.fillStyle=isSelected?'#151517':'#c1c1c8';ctx.textAlign='left';ctx.fillText(text,b.x+6,b.y+15);
  }
  ctx.globalAlpha=1;
 }
 drawRef.current=draw;
 function exportPNG(){
  draw();const source=canvas.current;if(!source)return;const {w,h}=size.current,dpr=Math.min(size.current.dpr,2),out=document.createElement('canvas'),mobile=w<550,header=mobile?130:108,footer=mobile?82:58;out.width=Math.round(w*dpr);out.height=Math.round((h+header+footer)*dpr);const ctx=out.getContext('2d');if(!ctx)return;ctx.scale(dpr,dpr);ctx.fillStyle='#080809';ctx.fillRect(0,0,w,h+header+footer);ctx.drawImage(source,0,header,w,h);ctx.fillStyle='#f1f1f3';ctx.font='600 23px '+font;ctx.fillText('openlawtw / 法規宇宙',24,40);ctx.fillStyle='#a8a8b0';ctx.font='12px '+font;
  const {graph:g,selected:s,mode:m}=data.current,lawCount=g.nodes.filter(n=>n.kind==='law').length.toLocaleString('zh-TW'),edgeCount=g.edges.filter(e=>e.kind==='basis').length.toLocaleString('zh-TW'),heading=`${m==='3d'?'3D 空間':'2D 關係'} · ${lawCount} 部法規`;
  ctx.fillText(mobile?heading:heading+` · ${edgeCount} 筆法源關係`,24,65);if(mobile)ctx.fillText(`${edgeCount} 筆法源關係`,24,84);
  const name=g.byId.get(s)?.label;let label=name?'聚焦 '+name:'沿著法源與引用，探索法規之間的關係。';while(ctx.measureText(label).width>w-48&&label.length>2)label=label.slice(0,-2)+'…';ctx.fillStyle='#c3c3ca';ctx.fillText(label,24,mobile?106:87);
  const legend=mobile?['實心：中央　空心：地方　細點：函釋','實線：法源／引法　虛線：互引','顏色依主題；位置不代表位階或適用性。']:['實心：中央　空心：地方　細點：函釋　實線：法源／引法　虛線：互引','顏色依主題；位置與距離不代表位階或適用性；未連線不代表無關。'];ctx.fillStyle='#a8a8b0';ctx.font='11px '+font;legend.forEach((line,i)=>ctx.fillText(line,24,h+header+25+i*19));
  out.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='openlawtw-universe-'+m+'.png';a.hidden=true;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);});
 }
 useImperativeHandle(ref,()=>({fit,zoom:(factor)=>zoomAt(factor),rotate,reset,exportPNG}));
 useEffect(()=>{const el=host.current;if(!el)return;const observer=new ResizeObserver(()=>{const {width:w,height:h}=el.getBoundingClientRect();if(!w||!h)return;const mobile=window.matchMedia('(max-width: 700px)').matches,dpr=Math.min(devicePixelRatio||1,w<700?1.6:2);if(size.current.w===w&&size.current.h===h&&size.current.mobile===mobile&&initialized.current)return;const previous=size.current;size.current={w,h,dpr,mobile};if(canvas.current){canvas.current.width=Math.round(w*dpr);canvas.current.height=Math.round(h*dpr);}if(!initialized.current||(previous.mobile!==mobile&&data.current.focus))fit(data.current.focus??undefined,false);else change({...camera.current,x:camera.current.x+(w-previous.w)/2,y:camera.current.y+(h-previous.h)/2});initialized.current=true;});observer.observe(el);return()=>{observer.disconnect();cancelAnimationFrame(frame.current);frame.current=0;stopAnimation();};},[]);
 useEffect(()=>{if(initialized.current)fit(data.current.focus??undefined,false);setHover(null);schedule();},[graph,mode]);
 useEffect(()=>{setHover(null);schedule();},[focus,selected]);
 useEffect(()=>{
  if(!autoRotate||mode!=='3d')return;const mq=window.matchMedia('(prefers-reduced-motion: reduce)');let raf=0,last=0,disposed=false;
  const tick=(now:number)=>{if(disposed||document.hidden||mq.matches){raf=0;return;}if(last&&now-last>=32){camera.current=orbitUniverseCamera(camera.current,Math.min(now-last,80)*.000045,0);last=now;schedule();}else if(!last)last=now;raf=requestAnimationFrame(tick);};
  const update=()=>{cancelAnimationFrame(raf);raf=0;last=0;if(!disposed&&!document.hidden&&!mq.matches)raf=requestAnimationFrame(tick);};update();document.addEventListener('visibilitychange',update);mq.addEventListener('change',update);return()=>{disposed=true;cancelAnimationFrame(raf);document.removeEventListener('visibilitychange',update);mq.removeEventListener('change',update);};
 },[autoRotate,mode]);
 useEffect(()=>{const el=canvas.current;if(!el)return;const wheel=(e:WheelEvent)=>{e.preventDefault();callbacks.current.onInteract();const r=el.getBoundingClientRect();zoomAt(Math.exp(-Math.max(-120,Math.min(120,e.deltaY))*.003),e.clientX-r.left,e.clientY-r.top);setHover(null);};el.addEventListener('wheel',wheel,{passive:false});return()=>el.removeEventListener('wheel',wheel);},[]);
 return <div className="universe-canvas-host" ref={host}><canvas ref={canvas} aria-label={mode==='3d'?'3D 法規關係互動圖。拖曳或方向鍵旋轉；按住 Shift 拖曳或方向鍵平移。滾輪、雙指或加減鍵縮放，Home 顯示全圖。也可使用搜尋與右側清單選取節點。':'2D 法規關係互動圖。拖曳或方向鍵平移，滾輪、雙指或加減鍵縮放，Home 顯示全圖。也可使用搜尋與右側清單選取節點。'} tabIndex={0}
 onContextMenu={e=>e.preventDefault()}
 onKeyDown={e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','Home'].includes(e.key))return;e.preventDefault();onInteract();stopAnimation();setHover(null);const c=camera.current;if(e.key==='Home')reset();else if(e.key==='+'||e.key==='=')zoomAt(1.25);else if(e.key==='-')zoomAt(.8);else if(mode==='3d'&&!e.shiftKey)rotate(e.key==='ArrowLeft'?-.13:e.key==='ArrowRight'?.13:0,e.key==='ArrowUp'?-.1:e.key==='ArrowDown'?.1:0);else change({...c,x:c.x+(e.key==='ArrowLeft'?60:e.key==='ArrowRight'?-60:0),y:c.y+(e.key==='ArrowUp'?60:e.key==='ArrowDown'?-60:0)});}}
 onPointerDown={e=>{if(e.button!==0&&e.button!==2)return;onInteract();stopAnimation();setHover(null);e.currentTarget.setPointerCapture(e.pointerId);const r=e.currentTarget.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;pointers.current.set(e.pointerId,{x,y});if(pointers.current.size===1)gesture.current={startX:x,startY:y,lastX:x,lastY:y,moved:false,distance:0,pan:mode==='2d'||e.shiftKey||e.button===2};else{const [a,b]=[...pointers.current.values()];if(gesture.current){gesture.current.moved=true;gesture.current.distance=Math.hypot(a.x-b.x,a.y-b.y);gesture.current.lastX=(a.x+b.x)/2;gesture.current.lastY=(a.y+b.y)/2;}}e.currentTarget.style.cursor='grabbing';}}
 onPointerMove={e=>{const r=e.currentTarget.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top,g=gesture.current;if(!pointers.current.has(e.pointerId)||!g){if(e.pointerType==='mouse'){const node=pick(x,y);setHover(node?{node,x,y}:null);e.currentTarget.style.cursor=node?'pointer':'grab';}return;}pointers.current.set(e.pointerId,{x,y});if(pointers.current.size>1){const [a,b]=[...pointers.current.values()],dist=Math.hypot(a.x-b.x,a.y-b.y),mx=(a.x+b.x)/2,my=(a.y+b.y)/2;if(g.distance>0)zoomAt(dist/g.distance,mx,my);change({...camera.current,x:camera.current.x+mx-g.lastX,y:camera.current.y+my-g.lastY});g.distance=dist;g.lastX=mx;g.lastY=my;g.moved=true;}else{if(Math.hypot(x-g.startX,y-g.startY)>5)g.moved=true;if(g.moved){if(g.pan||e.shiftKey)change({...camera.current,x:camera.current.x+x-g.lastX,y:camera.current.y+y-g.lastY});else rotate((x-g.lastX)*.005,(y-g.lastY)*.004);}g.lastX=x;g.lastY=y;}}}
 onPointerUp={e=>{const g=gesture.current;if(!g||!pointers.current.has(e.pointerId))return;const r=e.currentTarget.getBoundingClientRect();if(!g.moved&&pointers.current.size===1&&e.button===0){const node=pick(e.clientX-r.left,e.clientY-r.top);if(node)onSelect(node.id);}pointers.current.delete(e.pointerId);if(pointers.current.size===0)gesture.current=null;else{const a=[...pointers.current.values()][0];g.lastX=a.x;g.lastY=a.y;g.moved=true;g.distance=0;}if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);e.currentTarget.style.cursor='grab';}}
 onLostPointerCapture={e=>{if(pointers.current.has(e.pointerId)){pointers.current.clear();gesture.current=null;}}} onPointerCancel={()=>{pointers.current.clear();gesture.current=null;}} onPointerLeave={()=>setHover(null)} onDoubleClick={e=>{onInteract();const r=e.currentTarget.getBoundingClientRect();zoomAt(1.5,e.clientX-r.left,e.clientY-r.top);}}/>
 {hover&&<div className="universe-tooltip" style={{left:Math.max(12,Math.min(size.current.w-272,hover.x+16)),top:Math.max(12,Math.min(size.current.h-100,hover.y+14))}}><small>{hover.node.kind==='law'?hover.node.region+' · '+hover.node.category:'官方函釋'}</small><strong>{hover.node.label}</strong><span>點選查看關係</span></div>}</div>;
});
