/**
 * engine.js — محرك التوليد العكسي لنماذج عبء العمل
 * منطق حسابي خالص بلا DOM: يعمل في المتصفح (window.WorkloadEngine) وفي Node (require).
 * إعداد: AHMAD ZYAD
 */
(function(root, factory){
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.WorkloadEngine = api;
})(typeof self !== 'undefined' ? self : this, function(){
'use strict';

const CAP = 1023;
const LEVELS = [
  {name:'يومي',     F:240, dmin:5,   dmax:60,   cap:2.0, tShare:.35, hShare:.72},
  {name:'أسبوعي',   F:48,  dmin:30,  dmax:180,  cap:1.5, tShare:.25, hShare:.14},
  {name:'شهري',     F:12,  dmin:60,  dmax:480,  cap:1.5, tShare:.20, hShare:.07},
  {name:'ربع سنوي', F:4,   dmin:120, dmax:960,  cap:1.0, tShare:.10, hShare:.04},
  {name:'نصف سنوي', F:2,   dmin:240, dmax:1440, cap:1.0, tShare:.05, hShare:.015},
  {name:'سنوي',     F:1,   dmin:480, dmax:2400, cap:1.0, tShare:.05, hShare:.015},
];
const SCENARIOS = 240;

function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;}}
const r5 = x=>Math.round(x/5)*5;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));

// task count starts at M tasks per employee (user picks M, default 2); search goes up to +15%
const MULTS = [2,4,6];
function baseN(E,M=2){return M*E;}

// largest-remainder allocation with min 1 per level
function allocate(N, shares){
  const s = shares.reduce((a,b)=>a+b,0);
  const raw = shares.map(x=>x/s*(N-shares.length));
  const out = raw.map(x=>1+Math.floor(x));
  let left = N - out.reduce((a,b)=>a+b,0);
  const order = raw.map((x,i)=>[x-Math.floor(x),i]).sort((a,b)=>b[0]-a[0]);
  for(let k=0;left>0;k++,left--) out[order[k%order.length][1]]++;
  return out;
}

function buildScenario(E, T, N, rnd){
  const jit = ()=>1+(rnd()*0.4-0.2);
  const tS = LEVELS.map(l=>l.tShare*jit());
  const hS = LEVELS.map(l=>l.hShare*jit());
  const hSum = hS.reduce((a,b)=>a+b,0);
  const counts = allocate(N,tS);
  const tasks=[];
  LEVELS.forEach((L,li)=>{
    const H = T*hS[li]/hSum;
    const w = Array.from({length:counts[li]},()=>0.6+rnd());
    const ws = w.reduce((a,b)=>a+b,0);
    const capAbs = Math.max(1,Math.floor(L.cap*E));
    w.forEach(wi=>{
      const h = H*wi/ws;
      let d = r5(L.dmin + rnd()*(L.dmax-L.dmin));
      d = clamp(d,L.dmin,L.dmax);
      let r = Math.round(h*60/(L.F*d));
      r = clamp(r,1,capAbs);
      d = clamp(r5(h*60/(L.F*r)),L.dmin,L.dmax);
      tasks.push({li,F:L.F,r,d,capAbs});
    });
  });
  closeGap(tasks,T);
  return tasks;
}

const hoursOf = t=>t.F*t.r*t.d/60;
function total(tasks){return tasks.reduce((a,t)=>a+hoursOf(t),0);}

function closeGap(tasks,T){
  let gap = T-total(tasks);
  for(let it=0; it<3000; it++){
    if(Math.abs(gap) < 0.17) break;
    let best=null, bestAbs=Math.abs(gap);
    for(const t of tasks){
      const L=LEVELS[t.li];
      const dir = gap>0?1:-1;
      // duration move
      const nd=t.d+5*dir;
      if(nd>=L.dmin && nd<=L.dmax){
        const c=t.F*t.r*5/60*dir, a=Math.abs(gap-c);
        if(a<bestAbs-1e-9){bestAbs=a;best=[t,'d',nd,c];}
      }
      // repetition move (secondary)
      const nr=t.r+dir;
      if(nr>=1 && nr<=t.capAbs){
        const c=t.F*t.d/60*dir, a=Math.abs(gap-c);
        if(a<bestAbs-1e-9 && Math.abs(c)>t.F*t.r*5/60*1.5){bestAbs=a;best=[t,'r',nr,c];}
      }
    }
    if(!best) break;
    best[0][best[1]]=best[2]; gap-=best[3];
  }
}

function cv(arr){const m=arr.reduce((a,b)=>a+b,0)/arr.length; if(!m) return 0; const v=arr.reduce((a,b)=>a+(b-m)**2,0)/arr.length; return Math.sqrt(v)/m;}

function evaluate(tasks,E,T){
  const H = total(tasks);
  const devPct = (H-T)/T*100;
  const sDev = Math.max(0,1-Math.abs(devPct)/3);
  // gradient: mean duration per level rising
  const means = LEVELS.map((_,li)=>{const ds=tasks.filter(t=>t.li===li).map(t=>t.d);return ds.reduce((a,b)=>a+b,0)/ds.length;});
  let up=0; for(let i=1;i<means.length;i++) if(means[i]>means[i-1]) up++;
  const sGrad = up/(means.length-1);
  // diversity: CV of durations within each multi-task level, target 0.15–0.6, plus distinct (r,d) pairs
  const parts=[];
  LEVELS.forEach((_,li)=>{
    const ds=tasks.filter(t=>t.li===li).map(t=>t.d);
    if(ds.length<2) return;
    const c=cv(ds);
    parts.push(c<0.15? c/0.15 : c>0.6? Math.max(0,1-(c-0.6)/0.6) : 1);
  });
  const uniq = new Set(tasks.map(t=>t.li+'-'+t.r+'-'+t.d)).size/tasks.length;
  const sDiv = (parts.length? parts.reduce((a,b)=>a+b,0)/parts.length:1)*0.7 + uniq*0.3;
  // inflation: repetitions per employee vs half the level cap
  const sInf = tasks.reduce((a,t)=>{const soft=LEVELS[t.li].cap/2, x=t.r/E; return a+Math.min(1, soft/Math.max(x,1e-9));},0)/tasks.length;
  const score = 0.4*sDev+0.2*sGrad+0.2*sDiv+0.2*sInf;
  return {H,devPct,sDev,sGrad,sDiv,sInf,score,means};
}

function gradeOf(ev){
  const a=Math.abs(ev.devPct);
  if(a<=1 && ev.score>=0.85) return ['ممتاز','g1'];
  if(a<=2 && ev.score>=0.75) return ['جيد جدًا','g2'];
  if(a<=3 && ev.score>=0.6)  return ['جيد','g3'];
  return ['يحتاج مراجعة','g4'];
}

function run(E,seed,M=2){
  const T=E*CAP, N0=baseN(E,M), rnd=mulberry32(seed);
  const lo=Math.max(LEVELS.length+2,N0), hi=Math.max(lo,Math.round(N0*1.15));
  let best=null; const byN={};
  for(let s=0;s<SCENARIOS;s++){
    const N = lo + Math.floor(rnd()*(hi-lo+1));
    const tasks = buildScenario(E,T,N,rnd);
    const ev = evaluate(tasks,E,T);
    const cand={N,tasks,ev};
    if(!best || ev.score>best.ev.score) best=cand;
    if(!byN[N] || ev.score>byN[N].ev.score) byN[N]=cand;
  }
  // order tasks: by level, then duration ascending
  best.tasks.sort((a,b)=>a.li-b.li || a.d-b.d || a.r-b.r);
  best.tasks.forEach((t,i)=>{t.no=i+1; t.h=hoursOf(t);});
  return {E,T,seed,M,N0,best,byN:Object.values(byN).sort((a,b)=>a.N-b.N)};
}


function counts(tasks){return LEVELS.map((_,li)=>tasks.filter(t=>t.li===li).length);}

return {CAP, LEVELS, SCENARIOS, MULTS, baseN, allocate, buildScenario, closeGap, hoursOf, total, evaluate, gradeOf, run, counts, mulberry32};
});
