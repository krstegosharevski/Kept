/* Kept logic: pure functions for dates, schedules, stats and streaks. No DOM and no storage, so node --test can load it. */

/* ---------- dates (local time; never toISOString, which converts to UTC and shifts days) ---------- */
export const sod=d=>new Date(d.getFullYear(),d.getMonth(),d.getDate());
const pad=n=>String(n).padStart(2,'0');
export const key=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
export const parse=k=>{const[y,m,d]=k.split('-').map(Number);return new Date(y,m-1,d)};
export const addDays=(d,n)=>new Date(d.getFullYear(),d.getMonth(),d.getDate()+n);
export const dow=d=>(d.getDay()+6)%7; // Monday = 0 … Sunday = 6
export const isRest=d=>dow(d)>=5; // Saturday and Sunday are fixed rest days
export const weekStart=d=>addDays(sod(d),-dow(d));
export const TODAY=()=>sod(new Date());
export const maxD=(a,b)=>a>b?a:b, minD=(a,b)=>a<b?a:b;

/* ---------- data ---------- */
/* the demo's routine colors, mapped to the Apple system colors the app uses now */
const DEMO_COLORS={'#1F9D74':'#34C759','#2E7DD7':'#007AFF','#7B5CD6':'#AF52DE','#3A9FB0':'#30B0C7','#D9822B':'#FF9500','#C2417A':'#FF2D55'};
/* keeps stored data consistent with the rules: no check-ins on rest days, no weekend days in schedules */
export function normalize(d){
  if(!d||!Array.isArray(d.routines)||!d.checks||typeof d.checks!=='object') return null;
  for(const k of Object.keys(d.checks)) if(isRest(parse(k))) delete d.checks[k];
  for(const r of d.routines){
    r.color=DEMO_COLORS[String(r.color).toUpperCase()]||r.color;
    if(r.sched.type==='days'){r.sched.days=r.sched.days.filter(i=>i<5);if(!r.sched.days.length)r.sched={type:'daily'}}
    if(r.sched.type==='weekly') r.sched.target=Math.min(5,Math.max(1,r.sched.target|0));
  }
  return d;
}

/* ---------- schedules and check-ins ---------- */
export function isDue(r,d){
  if(isRest(d)||key(d)<r.created) return false;
  if(r.sched.type==='days') return r.sched.days.includes(dow(d));
  return true;
}
export const isDone=(data,r,k)=>(data.checks[k]||[]).includes(r.id);
export function toggle(data,id,k){
  const a=data.checks[k]||[]; const i=a.indexOf(id);
  if(i>=0)a.splice(i,1);else a.push(id);
  if(a.length)data.checks[k]=a;else delete data.checks[k];
}

/* ---------- stats ---------- */
export function doneCount(data,r,a,b){let n=0;for(let d=a;d<=b;d=addDays(d,1))if(isDue(r,d)&&isDone(data,r,key(d)))n++;return n}
export function expected(r,a,b){
  const s=maxD(a,parse(r.created)); if(s>b) return 0;
  if(r.sched.type==='weekly'){let wd=0;for(let d=s;d<=b;d=addDays(d,1))if(!isRest(d))wd++;return wd?Math.max(1,Math.round(r.sched.target*wd/5)):0}
  let n=0;for(let d=s;d<=b;d=addDays(d,1))if(isDue(r,d))n++;return n;
}
export function rangeStats(data,a,b){
  let got=0,exp=0; const per=data.routines.map(r=>{const e=expected(r,a,b),d=doneCount(data,r,a,b);got+=Math.min(d,e);exp+=e;return{r,e,d,pct:e?Math.min(1,d/e):0}});
  return {pct:exp?got/exp:0,per,exp};
}
/* share of non-weekly routines done on day d; null when none are due */
export function dayRatio(data,d){
  const due=data.routines.filter(r=>r.sched.type!=='weekly'&&isDue(r,d));
  if(!due.length) return null;
  const k=key(d); return due.filter(r=>isDone(data,r,k)).length/due.length;
}
export const level=v=>v==null||v===0?0:v<.34?1:v<.67?2:v<1?3:4;
export function weekDone(data,r,d){const a=weekStart(d);return doneCount(data,r,a,addDays(a,6))}
/* current and best streak as of day t: due days for daily/days routines, weeks that met the target for weekly ones */
export function streaks(data,r,t){
  const c=parse(r.created);
  if(r.sched.type==='weekly'){
    const met=w=>doneCount(data,r,w,addDays(w,6))>=r.sched.target;
    let cur=0,w=weekStart(t); if(!met(w)) w=addDays(w,-7);
    while(w>=weekStart(c)&&met(w)){cur++;w=addDays(w,-7)}
    let best=0,run=0; for(let w2=weekStart(c);w2<=weekStart(t);w2=addDays(w2,7)){ if(met(w2)){run++;best=Math.max(best,run)} else if(+w2!==+weekStart(t)) run=0 }
    return {cur,best,unit:'wk'};
  }
  let cur=0; for(let d=t;d>=c;d=addDays(d,-1)){ if(!isDue(r,d))continue; if(isDone(data,r,key(d)))cur++; else if(+d===+t)continue; else break; }
  let best=0,run=0; for(let d=c;d<=t;d=addDays(d,1)){ if(!isDue(r,d))continue; if(isDone(data,r,key(d))){run++;best=Math.max(best,run)} else if(+d!==+t) run=0 }
  return {cur,best,unit:'d'};
}
