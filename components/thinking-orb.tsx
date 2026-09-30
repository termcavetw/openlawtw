/*!
Thinking Orbs working preset, React adaptation.
Source: https://github.com/RareFormLabs/thinking-orbs
Upstream: e09bfa600c9196e0e8979f5ba59bcda45cbe1fa7
MIT License

Copyright (c) 2026 Jakub Antalik

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
import {useEffect,useRef} from 'react';

type ModeDraw=(ctx:CanvasRenderingContext2D,size:number,t:number,dark:boolean,o:Record<string,number|undefined>)=>void;
// Shared primitives for the dotted 3D thought-orbs. Ported from inkform
// (PlotterLab's HalftoneSphere lineage): honestly 3D — rotated,
// depth-shaded, z-sorted. Depth is carried by dot size and ink weight
// alone. Plain 2D canvas fills only: no ctx.filter, no SVG filters, so
// every mode renders identically in Chrome, Safari and Firefox.

export interface Dot {
  x: number;
  y: number;
  z: number;
  r: number;
  /** Ink value: 0 = darkest ink on paper. Mirrored on dark themes. */
  white: number;
  a?: number;
}

export type Projector = (x: number, y: number, z: number) => [number, number, number];

/** Deterministic hash in [0, 1). */
export function hashD(a: number, b: number): number {
  const h = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return h - Math.floor(h);
}

/** Stable directions on a unit sphere (Fibonacci lattice). */
export function fibDir(i: number, n: number): [number, number, number] {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const y = 1 - (2 * (i + 0.5)) / n;
  const rad = Math.sqrt(1 - y * y);
  const a = i * golden;
  return [rad * Math.cos(a), y, rad * Math.sin(a)];
}

/** Shortest signed angular distance, wrapped to (-π, π]. */
export function angleDelta(a: number, b: number): number {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

/** Shared spin + tilt + orthographic projection. */
export function makeProj(yaw: number, tilt: number, cx: number, cy: number, scale: number): Projector {
  const st = Math.sin(tilt);
  const ct = Math.cos(tilt);
  const sy = Math.sin(yaw);
  const cyw = Math.cos(yaw);
  return (x, y, z) => {
    const x1 = x * cyw + z * sy;
    const z1 = -x * sy + z * cyw;
    const y1 = y * ct - z1 * st;
    const z2 = y * st + z1 * ct;
    return [cx + x1 * scale, cy - y1 * scale, z2];
  };
}

/**
 * Painter: z-sort far→near, matte grayscale dots. On dark substrates the
 * ink value is mirrored (1 - white) so near dots read bright — the same
 * depth language on an inverted substrate.
 */
export function paint(ctx: CanvasRenderingContext2D, dots: Dot[], dark: boolean, rMin = 0.3): void {
  dots.sort((a, b) => a.z - b.z);
  for (const d of dots) {
    const alpha = d.a ?? 1;
    if (alpha < 0.02) continue;
    const w = Math.min(1, Math.max(0, d.white));
    const g = Math.round((dark ? 1 - w : w) * 255);
    ctx.fillStyle = `rgba(${g},${g},${g},${alpha})`;
    ctx.beginPath();
    ctx.arc(d.x, d.y, Math.max(rMin, d.r), 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Dot radii were tuned for a 300pt frame; sub-linear scaling keeps small
 * spinners legible. Lower pow = radii shrink less with size.
 */
export function radiusScale(size: number, pow: number): number {
  return (size / 300) ** pow;
}

// Orbits: particles on tilted orbits — the "working" state. No nucleus
// (the tuned preset runs coreless): just ghost paths and the particles
// doing the work.


export const drawOrbits: ModeDraw = (ctx, size, t, dark, o) => {
  const cx = size / 2;
  const cy = size / 2;
  const R = (size / 2) * 0.82;
  const pt = makeProj(t * 0.12, 0.3, cx, cy, 1);
  const rs = radiusScale(size, o.rsPow ?? 0.6);

  const dots: Dot[] = [];
  const orbitN = o.orbitN ?? 12;
  const ghostN = o.ghostN ?? 40;
  const particles = o.particles ?? 3;

  // orbits: each a tilted circle — a ghost path + running particles
  for (let orb = 0; orb < orbitN; orb++) {
    const h1 = hashD(orb, 1.7);
    const h2 = hashD(orb, 5.2);
    const h3 = hashD(orb, 8.9);
    const ro = R * (0.45 + 0.52 * h1);
    const th = h1 * 2 * Math.PI;
    const phi = Math.acos(2 * h2 - 1);
    // orbit plane basis (u, v ⟂ normal n)
    const nx = Math.sin(phi) * Math.cos(th);
    const ny = Math.cos(phi);
    const nz = Math.sin(phi) * Math.sin(th);
    let ux = -ny;
    let uy = nx;
    const uz = 0;
    const ul = Math.max(1e-6, Math.sqrt(ux * ux + uy * uy));
    ux /= ul;
    uy /= ul;
    const vx = ny * uz - nz * uy;
    const vy = nz * ux - nx * uz;
    const vz = nx * uy - ny * ux;
    const speed = (0.25 + 0.55 * h3) * (h3 > 0.5 ? 1 : -1);

    // ghost path
    for (let k = 0; k < ghostN; k++) {
      const a = (k / ghostN) * 2 * Math.PI;
      const [px, py, z] = pt(
        (ux * Math.cos(a) + vx * Math.sin(a)) * ro,
        (uy * Math.cos(a) + vy * Math.sin(a)) * ro,
        (uz * Math.cos(a) + vz * Math.sin(a)) * ro
      );
      const depth = (z / ro + 1) / 2;
      dots.push({
        x: px,
        y: py,
        z,
        r: (o.ghostR ?? 0.9) * rs,
        white: 0.72,
        a: (o.ghostA ?? 0.5) * (0.4 + 0.6 * depth)
      });
    }
    // the particles doing the work
    for (let m = 0; m < particles; m++) {
      const a = t * speed + (m / particles) * 2 * Math.PI + h2 * 6;
      const [px, py, z] = pt(
        (ux * Math.cos(a) + vx * Math.sin(a)) * ro,
        (uy * Math.cos(a) + vy * Math.sin(a)) * ro,
        (uz * Math.cos(a) + vz * Math.sin(a)) * ro
      );
      const depth = (z / ro + 1) / 2;
      dots.push({
        x: px,
        y: py,
        z,
        r: ((o.partR ?? 1.2) + (o.partRDepth ?? 1.6) * depth) * rs,
        white: 0.3 - 0.22 * depth
      });
    }
  }
  paint(ctx, dots, dark, o.rMin);
};

// Exact upstream 20px working preset: scaled fine counts/radii, speed 3.9.
const OPTIONS={orbitN:3,ghostN:10,ghostR:2.16,ghostA:0.5,particles:3,partR:2.88,partRDepth:3.84,rsPow:0.6,rMin:0.3};
export function mountThinkingOrb(canvas:HTMLCanvasElement):()=>void {
 const ctx=canvas.getContext('2d');if(!ctx)return()=>{};
 const dpr=Math.min(2,window.devicePixelRatio||1),size=20;
 canvas.width=Math.round(size*dpr);canvas.height=Math.round(size*dpr);
 const motion=window.matchMedia('(prefers-reduced-motion: reduce)'),scheme=window.matchMedia('(prefers-color-scheme: dark)');
 let inkIsLight=false;let raf=0,alive=true,visible=typeof IntersectionObserver==='undefined';
 const dark=()=>{const rgb=getComputedStyle(canvas).color.match(/[\d.]+/g)?.slice(0,3).map(Number);return !!rgb&&rgb.length===3&&(rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722)>150;};
 const frame=(t:number)=>{ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,size,size);drawOrbits(ctx,size,t,inkIsLight,OPTIONS);};
 const stop=()=>{if(raf)cancelAnimationFrame(raf);raf=0;};
 const loop=()=>{raf=0;if(!alive||!visible||document.visibilityState==='hidden'||motion.matches)return;frame(performance.now()/1000*3.9);raf=requestAnimationFrame(loop);};
 const update=()=>{stop();if(!alive)return;inkIsLight=dark();frame(motion.matches ? 0.6 : performance.now()/1000*3.9);if(!motion.matches&&visible&&document.visibilityState!=='hidden')raf=requestAnimationFrame(loop);};
 const io=typeof IntersectionObserver==='undefined'?null:new IntersectionObserver(entries=>{visible=!!entries[0]?.isIntersecting;update();});
 io?.observe(canvas);
 // Track actual surrounding ink, including theme classes, rather than assume
 // the app background follows the operating system's preferred color scheme.
 const theme=typeof MutationObserver==='undefined'?null:new MutationObserver(update);
 for(let el:HTMLElement|null=canvas.parentElement;el;el=el.parentElement)theme?.observe(el,{attributes:true,attributeFilter:['class','style','data-theme']});
 motion.addEventListener('change',update);scheme.addEventListener('change',update);document.addEventListener('visibilitychange',update);update();
 return()=>{alive=false;stop();io?.disconnect();theme?.disconnect();motion.removeEventListener('change',update);scheme.removeEventListener('change',update);document.removeEventListener('visibilitychange',update);};
}
/** Decorative companion to existing status/progress text, never a fake delay. */
export function ThinkingOrb(){
 const ref=useRef<HTMLCanvasElement>(null);
 useEffect(()=>ref.current?mountThinkingOrb(ref.current):undefined,[]);
 return <canvas ref={ref} className="thinking-orb" width={20} height={20} aria-hidden="true" style={{display:'inline-block',width:20,height:20,flexShrink:0,verticalAlign:'middle'}}/>;
}
