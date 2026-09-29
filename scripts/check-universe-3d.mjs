import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {buildUniverse,scopedUniverse} from '../lib/universe.ts';
import {stableFraction,universeSpace,rotateUniversePoint,projectUniversePoint,orbitUniverseCamera,pickUniverseNode} from '../lib/universe-3d.ts';

const root=new URL('../',import.meta.url);
const read=async path=>JSON.parse(await readFile(new URL(path,root),'utf8'));
const passed=[],failed=[];
function check(name,run){try{run();passed.push(name);}catch(error){failed.push({name,error:error.message});}}
function near(actual,expected,message){assert(Math.abs(actual-expected)<1e-9,`${message}: ${actual} ≠ ${expected}`);}
const camera={x:195,y:280,k:.5,yaw:0,pitch:0};
const length=p=>Math.hypot(p.x,p.y,p.z);
const permutations=items=>items.length<=1?[items]:items.flatMap((item,i)=>permutations(items.filter((_,j)=>j!==i)).map(rest=>[item,...rest]));
const hit=(id,x,y,z,radius=8,kind='law',visible=true)=>({id,x,y,z,radius,kind,visible});

check('rotation preserves distance and cardinal directions',()=>{
 const point={x:14,y:-32,z:71};
 for(const yaw of [-Math.PI,-.8,0,.6,Math.PI])for(const pitch of [-1.22,0,.3,1.22])near(length(rotateUniversePoint(point,yaw,pitch)),length(point),'Rotation length');
 const yaw=rotateUniversePoint({x:1,y:0,z:0},Math.PI/2,0);
 near(yaw.x,0,'Quarter-turn x');near(yaw.z,-1,'Quarter-turn z');
 const pitch=rotateUniversePoint({x:0,y:1,z:0},0,Math.PI/2);
 near(pitch.y,0,'Quarter-turn y');near(pitch.z,1,'Quarter-turn z');
});
check('perspective enlarges nearer points and clips the near plane',()=>{
 const origin=projectUniversePoint({x:0,y:0,z:0},camera,100);
 assert.deepEqual(origin,{x:195,y:280,z:0,scale:1,visible:true});
 const far=projectUniversePoint({x:20,y:10,z:-50},camera,100);
 const nearPoint=projectUniversePoint({x:20,y:10,z:50},camera,100);
 assert(nearPoint.scale>far.scale);assert(nearPoint.x>far.x);assert(nearPoint.y>far.y);
 assert(projectUniversePoint({x:20,y:10,z:91},camera,100).visible);
 for(const z of [93,99,100,101,200]){
  const point=projectUniversePoint({x:20,y:10,z},camera,100);
  assert.equal(point.visible,false);assert([point.x,point.y,point.z,point.scale].every(Number.isFinite));
 }
});
check('2D ignores depth and orbit angles',()=>{
 const expected={x:205,y:275,z:0,scale:1,visible:true};
 for(const z of [-1e6,-100,0,100,1e6])for(const yaw of [-Math.PI,0,Math.PI]){
  assert.deepEqual(projectUniversePoint({x:20,y:-10,z},{...camera,yaw,pitch:1.1},100,'2d'),expected);
 }
});
check('focused target stays at the camera center throughout orbit',()=>{
 const target={x:223,y:-511,z:102};
 const centered=projection=>{
  near(projection.x,camera.x,'Target screen x');near(projection.y,camera.y,'Target screen y');near(projection.z,0,'Target relative depth');
  near(projection.scale,1,'Target scale');assert.equal(projection.visible,true);
 };
 for(const mode of ['3d','2d'])for(const yaw of [-Math.PI,-.7,0,Math.PI/2])for(const pitch of [-1.22,0,1.22]){
  const view={...camera,target,yaw,pitch};
  centered(projectUniversePoint(target,view,2000,mode));
  const orbited=orbitUniverseCamera(view,.9,-.3);
  assert.deepEqual(orbited.target,target,'Orbit must retain the selected family target');
  centered(projectUniversePoint(target,orbited,2000,mode));
 }
});
check('focused projection is equivalent to translating the world origin',()=>{
 const target={x:223,y:-511,z:102},point={x:76,y:120,z:-220};
 const relative={x:point.x-target.x,y:point.y-target.y,z:point.z-target.z};
 const before=JSON.stringify({target,point});
 for(const mode of ['3d','2d'])for(const yaw of [-Math.PI,-.7,0,Math.PI/2])for(const pitch of [-1.22,0,1.22]){
  const view={...camera,yaw,pitch};
  assert.deepEqual(projectUniversePoint(point,{...view,target},2000,mode),projectUniversePoint(relative,view,2000,mode));
 }
 assert.equal(JSON.stringify({target,point}),before,'Projection must not mutate its point or target');
});
check('camera pitch clamps and yaw wraps in both directions',()=>{
 for(const delta of [-100*Math.PI,-10*Math.PI,-3*Math.PI,-.1,0,.1,3*Math.PI,10*Math.PI,100*Math.PI]){
  const next=orbitUniverseCamera(camera,delta,20);
  assert(next.yaw>=-Math.PI&&next.yaw<Math.PI,`Yaw must remain within one turn: ${next.yaw}`);
  near(next.pitch,1.22,'Upper pitch clamp');
  near(Math.sin(next.yaw),Math.sin(delta),'Wrapped sine');near(Math.cos(next.yaw),Math.cos(delta),'Wrapped cosine');
  near(orbitUniverseCamera(camera,delta,-20).pitch,-1.22,'Lower pitch clamp');
  assert.equal(next.x,camera.x);assert.equal(next.y,camera.y);assert.equal(next.k,camera.k);
 }
});
check('picking selects the front visible disc independently of array order',()=>{
 const points=[hit('front',7,0,50),hit('back',0,0,0),hit('halo',2,0,100,1)];
 for(const order of permutations(points))assert.equal(pickUniverseNode(order,0,0),'front',`Order: ${order.map(p=>p.id).join(',')}`);
 const invisible=hit('clipped',0,0,1000,20,'law',false);
 for(const order of permutations([points[0],points[1],invisible]))assert.equal(pickUniverseNode(order,0,0),'front');
});
check('picking retains small-node tolerance without selecting empty space',()=>{
 assert.equal(pickUniverseNode([hit('small',0,0,0,1)],6,0),'small');
 assert.equal(pickUniverseNode([hit('small',0,0,0,1,'ruling')],3,0),'small');
 assert.equal(pickUniverseNode([hit('small',0,0,0,1)],20,20),null);
 assert.equal(pickUniverseNode([],0,0),null);
});
check('empty space remains finite',()=>{
 const empty=universeSpace([]);assert.equal(empty.points.size,0);assert(empty.extent>0&&empty.distance>0);
 const point=projectUniversePoint({x:0,y:0,z:0},camera,empty.distance);
 assert([point.x,point.y,point.z,point.scale].every(Number.isFinite));
});

const catalog=await read('data/runtime-catalog.json'),manifest=await read('data/runtime-manifest.json');
async function shard(file){
 const bytes=await readFile(new URL('public'+file.url,root));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256,'Universe source shard integrity');
 return JSON.parse(file.encoding==='gzip'?gunzipSync(bytes):bytes);
}
const layout=await shard(manifest.universe),rulings=await shard(manifest.universeRulings);
const graph=buildUniverse(catalog.laws,catalog.relations,layout.points,rulings.items);
const space=universeSpace(graph.nodes),before=JSON.stringify(graph.nodes);
check('depth is deterministic and independent of input order',()=>{
 const reversed=universeSpace([...graph.nodes].reverse());
 assert.equal(space.points.size,graph.nodes.length);
 assert.equal(reversed.extent,space.extent);assert.equal(reversed.distance,space.distance);
 for(const node of graph.nodes){
  const point=space.points.get(node.id);assert.deepEqual(reversed.points.get(node.id),point);
  assert([point.x,point.y,point.z].every(Number.isFinite));
  const hash=stableFraction(node.id);assert(hash>=0&&hash<=1);assert.equal(hash,stableFraction(node.id));
 }
 assert.equal(JSON.stringify(graph.nodes),before,'Projection preparation must not change legal graph nodes');
});
let projected=0;
const projectionStart=performance.now();
check('full graph and regional graph project finitely across mobile and desktop views',()=>{
 for(const nodes of [graph.nodes,scopedUniverse(graph,'臺北市').nodes]){
  const current=universeSpace(nodes);
  for(const [width,height] of [[390,640],[1440,900]])for(const yaw of [-Math.PI,-Math.PI/2,0,Math.PI/2])for(const pitch of [-1.22,0,1.22]){
   const view={x:width/2,y:height/2,k:.3,yaw,pitch};
   for(const node of nodes){
    const point=projectUniversePoint(current.points.get(node.id),view,current.distance);
    assert([point.x,point.y,point.z,point.scale].every(Number.isFinite),node.id);
    assert(point.scale>0);assert(point.visible,`Valid scene geometry must stay in front of the near plane: ${node.id}`);
    projected++;
   }
  }
 }
});
console.log(JSON.stringify({checks:passed.length,passed,failed,nodes:graph.nodes.length,edges:graph.edges.length,projections:projected,projectionMs:Math.round(performance.now()-projectionStart)}));
if(failed.length)process.exitCode=1;
