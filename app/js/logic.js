/* Kept logic: pure functions for dates, schedules, stats and streaks. No DOM and no storage, so node --test can load it. */

/* ---------- dates (local time; never toISOString, which converts to UTC and shifts days) ---------- */
export const sod=d=>new Date(d.getFullYear(),d.getMonth(),d.getDate());
const pad=n=>String(n).padStart(2,'0');
export const key=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
export const parse=k=>{const[y,m,d]=k.split('-').map(Number);return new Date(y,m-1,d)};
export const addDays=(d,n)=>new Date(d.getFullYear(),d.getMonth(),d.getDate()+n);
export const dow=d=>(d.getDay()+6)%7; // Monday = 0 … Sunday = 6
export const isWeekend=d=>dow(d)>=5;
export const isRest=isWeekend; // Saturday and Sunday are rest days unless they were open that day (restOn, with the data, knows)
export const weekStart=d=>addDays(sod(d),-dow(d));
export const TODAY=()=>sod(new Date());
export const maxD=(a,b)=>a>b?a:b, minD=(a,b)=>a<b?a:b;
const isKey=k=>typeof k==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(k);
export const RULE_MAX=255; // the longest a rule can be, in characters

/* ---------- data ---------- */
/* the demo's routine colors, mapped to the Apple system colors the app uses now */
const DEMO_COLORS={'#1F9D74':'#34C759','#2E7DD7':'#007AFF','#7B5CD6':'#AF52DE','#3A9FB0':'#30B0C7','#D9822B':'#FF9500','#C2417A':'#FF2D55'};
const byFrom=(a,b)=>a.from<b.from?-1:a.from>b.from?1:0;
/* one schedule entry, made valid. 'off' marks a stretch when tracking was stopped; 'weekend' is due on Saturday and/or Sunday
   (days 5 and 6) while weekends are open */
function cleanSched(s){
  if(s.type==='weekend'){
    const days=[...new Set((Array.isArray(s.days)?s.days:[]).map(Number))].filter(i=>i===5||i===6).sort();
    return {from:s.from,type:'weekend',days:days.length?days:[5,6]};
  }
  if(s.type==='days'){
    const days=[...new Set((Array.isArray(s.days)?s.days:[]).map(Number))].filter(i=>Number.isInteger(i)&&i>=0&&i<5).sort();
    return days.length?{from:s.from,type:'days',days}:{from:s.from,type:'daily'}; // weekend days are never allowed
  }
  if(s.type==='weekly') return {from:s.from,type:'weekly',target:Math.min(5,Math.max(1,(s.target|0)||1))};
  if(s.type==='off') return {from:s.from,type:'off'};
  return {from:s.from,type:'daily'};
}
/* runs on load and on import: keeps the data consistent with the rules, and migrates the demo's shape (a single `sched`).
   Returns a new object, or null when this is not Kept data at all. */
export function normalize(d){
  if(!d||typeof d!=='object'||!Array.isArray(d.routines)||!d.checks||typeof d.checks!=='object'||Array.isArray(d.checks)) return null;
  const firstCheck=id=>Object.keys(d.checks).filter(k=>isKey(k)&&Array.isArray(d.checks[k])&&d.checks[k].includes(id)).sort()[0];
  const routines=[], ids=new Set();
  for(const x of d.routines){
    if(!x||typeof x!=='object'||x.id==null||ids.has(String(x.id))) continue;
    const id=String(x.id), created=isKey(x.created)?x.created:firstCheck(x.id)||key(TODAY());
    let schedules=Array.isArray(x.schedules)?x.schedules:x.sched&&typeof x.sched==='object'?[{from:created,...x.sched}]:[];
    schedules=schedules.filter(s=>s&&typeof s==='object'&&isKey(s.from)).map(cleanSched).sort(byFrom)
      .filter((s,i,all)=>!(all[i+1]&&all[i+1].from===s.from)); // two entries for one day: the later one wins
    if(!schedules.length) schedules=[{from:created,type:'daily'}];
    const color=String(x.color).toUpperCase();
    ids.add(id);
    routines.push({id,name:String(x.name??'').trim().slice(0,40)||'Routine',emoji:typeof x.emoji==='string'&&x.emoji?x.emoji:'🌱',
      color:DEMO_COLORS[color]||(/^#[0-9A-F]{6}$/.test(color)?color:'#34C759'),created,stopped:isKey(x.stopped)?x.stopped:null,schedules});
  }
  /* Open weekends: a history [{from, open}], sorted; one entry per day (the later one wins) */
  const weekends=(Array.isArray(d.weekends)?d.weekends:[]).filter(w=>w&&isKey(w.from)&&typeof w.open==='boolean')
    .map(w=>({from:w.from,open:w.open})).sort(byFrom).filter((w,i,all)=>!(all[i+1]&&all[i+1].from===w.from));
  const W={weekends};
  const checks={};
  for(const[k,list]of Object.entries(d.checks)){
    if(!isKey(k)||restOn(W,parse(k))||!Array.isArray(list)) continue; // no check-ins on rest days
    const kept=[...new Set(list.map(String))].filter(id=>ids.has(id)); // nor for routines that no longer exist
    if(kept.length) checks[k]=kept;
  }
  /* Wildcards: { Monday key: the Saturday or Sunday it was used }. Make-ups: { weekday key: [ids] }, only where the check-in exists. */
  const wildcards={}, madeUp={};
  for(const[w,on]of Object.entries(d.wildcards&&typeof d.wildcards==='object'?d.wildcards:{})){
    if(!isKey(w)||!isKey(on)||dow(parse(w))!==0) continue;
    const gap=(parse(on)-parse(w))/864e5; if(Math.round(gap)===5||Math.round(gap)===6) wildcards[w]=on;
  }
  for(const[k,list]of Object.entries(d.madeUp&&typeof d.madeUp==='object'?d.madeUp:{})){
    if(!isKey(k)||!checks[k]||!Array.isArray(list)) continue;
    const kept=[...new Set(list.map(String))].filter(id=>checks[k].includes(id));
    if(kept.length) madeUp[k]=kept;
  }
  /* Vacation days: { day key: the day it was booked }. Weekdays and open weekend days only, never a day with check-ins, at most 10 per half-year (the earliest days are kept). */
  const vacations={}, perHalf={};
  for(const k of Object.keys(d.vacations&&typeof d.vacations==='object'?d.vacations:{}).sort()){
    const on=d.vacations[k];
    if(!isKey(k)||key(parse(k))!==k||!isKey(on)||restOn(W,parse(k))||checks[k]) continue;
    const h=halfOf(k); perHalf[h]=(perHalf[h]||0)+1;
    if(perHalf[h]<=VACATION_DAYS) vacations[k]=on;
  }
  /* Rules: your own notes on how a routine counts, [{id, routine, text, created}]. Up to 255 characters, only for routines that exist. */
  const rules=[], ruleIds=new Set();
  for(const x of Array.isArray(d.rules)?d.rules:[]){
    if(!x||typeof x!=='object'||x.id==null||ruleIds.has(String(x.id))) continue;
    const text=String(x.text??'').trim().slice(0,RULE_MAX), routine=String(x.routine);
    if(!text||!ids.has(routine)) continue;
    ruleIds.add(String(x.id)); rules.push({id:String(x.id),routine,text,created:isKey(x.created)?x.created:key(TODAY())});
  }
  /* Shop purchases: [{id, price, at}], one per theme (the first wins), a whole number of coins from 0 up */
  const purchases=[], bought=new Set();
  for(const x of Array.isArray(d.purchases)?d.purchases:[]){
    if(!x||typeof x!=='object'||typeof x.id!=='string'||!/^[a-z0-9-]+$/.test(x.id)||bought.has(x.id)) continue;
    const price=Number(x.price); if(!Number.isInteger(price)||price<0) continue;
    bought.add(x.id); purchases.push({id:x.id,price,at:isKey(x.at)?x.at:key(TODAY())});
  }
  return {schema:1,routines,checks,wildcards,madeUp,vacations,rules,weekends,purchases};
}

/* ---------- schedules ---------- */
/* the schedule in effect on day d: the last entry that starts on or before d */
export function schedOn(r,d){
  const k=key(d); let s=r.schedules[0];
  for(const x of r.schedules){if(x.from<=k)s=x;else break}
  return s;
}
/* between the day it was created and the day it was stopped */
export const isTracked=(r,d)=>{const k=key(d);return k>=r.created&&!(r.stopped&&k>=r.stopped)};
/* pass the data so vacation days count as days off too; without it only weekends do */
export function isDue(r,d,data){
  if(isOff(data,d)||!isTracked(r,d)) return false;
  const s=schedOn(r,d);
  if(s.type==='weekend') return isWeekend(d)&&s.days.includes(dow(d)); // only open weekends get this far
  if(isWeekend(d)) return false; // every other schedule is Monday to Friday
  if(s.type==='days') return s.days.includes(dow(d));
  return s.type!=='off'; // daily, and weekly routines are due on every weekday
}
/* did the routine exist at all between a and b */
export const existsIn=(r,a,b)=>r.created<=key(b)&&!(r.stopped&&r.stopped<=key(a));
const sameSched=(a,b)=>a.type===b.type&&(a.type!=='days'&&a.type!=='weekend'||a.days.join()===b.days.join())&&(a.type!=='weekly'||a.target===b.target);
/* the schedule from day k on; an entry that already starts on k is replaced */
function setSchedule(r,k,{from,...s}){r.schedules=r.schedules.filter(x=>x.from<k).concat({from:k,...s})}
/* a schedule change applies from today; past days keep the schedule they had */
export function changeSchedule(r,s,today){
  if(sameSched(schedOn(r,today),s)) return;
  setSchedule(r,key(today),s);
  const n=r.schedules.length; if(n>1&&sameSched(r.schedules[n-2],s)) r.schedules.pop(); // changed back on the same day
}
export function stopRoutine(r,today){r.stopped=key(today)}
/* tracking starts again today with the schedule it had; the stopped stretch stays not due, so the past is unchanged */
export function resumeRoutine(r,today){
  if(!r.stopped) return;
  const k=key(today), s=r.schedules.filter(x=>x.from<=r.stopped&&x.type!=='off').pop()||{type:'daily'};
  if(r.stopped<k) setSchedule(r,r.stopped,{type:'off'});
  setSchedule(r,k,s);
  r.stopped=null;
}

/* ---------- check-ins ---------- */
export const isDone=(data,r,k)=>(data.checks[k]||[]).includes(r.id);
export function toggle(data,id,k){
  const a=data.checks[k]||[]; const i=a.indexOf(id);
  if(i>=0)a.splice(i,1);else a.push(id);
  if(a.length)data.checks[k]=a;else delete data.checks[k];
}

/* ---------- stats ---------- */
/* check-ins on due days only */
export function doneCount(data,r,a,b){let n=0;for(let d=a;d<=b;d=addDays(d,1))if(isDue(r,d,data)&&isDone(data,r,key(d)))n++;return n}
/* daily and days routines: the due days. Weekly routines: max(1, round(target × working days / 5)) for each stretch with the same weekly schedule.
   Working days are weekdays that are not vacation days. */
export function expected(r,a,b,data){
  let n=0,seg=null,wd=0;
  const flush=()=>{if(wd)n+=Math.max(1,Math.round(seg.target*wd/5));seg=null;wd=0};
  for(let d=a;d<=b;d=addDays(d,1)){
    if(!isTracked(r,d)) continue;
    const s=schedOn(r,d);
    if(s.type==='weekly'){if(s!==seg){if(seg)flush();seg=s} if(!isWeekend(d)&&!isVacation(data,d))wd++} // weekly targets count Monday to Friday
    else{if(seg)flush(); if(isDue(r,d,data))n++}
  }
  if(seg)flush();
  return n;
}
/* range % = Σ min(done, expected) / Σ expected, over the routines that existed in the range */
export function rangeStats(data,a,b){
  let got=0,exp=0; const per=data.routines.filter(r=>existsIn(r,a,b)).map(r=>{const e=expected(r,a,b,data),d=doneCount(data,r,a,b);got+=Math.min(d,e);exp+=e;return{r,e,d,pct:e?Math.min(1,d/e):0}});
  return {pct:exp?got/exp:0,per,exp};
}
const dueDaily=(r,d,data)=>isDue(r,d,data)&&schedOn(r,d).type!=='weekly';
/* share of non-weekly routines done on day d; null when none are due */
export function dayRatio(data,d){
  const due=data.routines.filter(r=>dueDaily(r,d,data));
  if(!due.length) return null;
  const k=key(d); return due.filter(r=>isDone(data,r,k)).length/due.length;
}
export const level=v=>v==null||v===0?0:v<.34?1:v<.67?2:v<1?3:4;
/* the month calendar's colour for a day (the traffic light): 'miss' (red) when something was due on a past day and nothing
   was done, else 'l0' (grey: nothing due, or today while it is still open) to 'l4' (green: all done) */
export const heatClass=(v,past)=>v===0&&past?'miss':'l'+level(v);
export function weekDone(data,r,d){const a=weekStart(d);return doneCount(data,r,a,addDays(a,6))}
/* current and best streak as of day t (or the day before a stop): due days for daily/days routines, weeks that met the target for weekly ones */
export function streaks(data,r,t){
  const c=parse(r.created), end=r.stopped?minD(t,addDays(parse(r.stopped),-1)):t;
  const weekly=schedOn(r,maxD(c,end)).type==='weekly';
  if(end<c) return {cur:0,best:0,unit:weekly?'wk':'d'};
  if(weekly){
    /* each week's target is prorated by its vacation days; a week that is all vacation (target 0) is skipped: it neither counts nor breaks the streak */
    const need=w=>{const s=schedOn(r,minD(addDays(w,4),end));return s.type==='weekly'?weekTarget(data,s.target,w):-1};
    const met=w=>{const n=need(w);return n>0&&doneCount(data,r,w,addDays(w,6))>=n}, skip=w=>need(w)===0;
    const last=weekStart(end);
    let cur=0,w=last; if(!met(w)) w=addDays(w,-7); // the current week counts only once its target is met
    for(;w>=weekStart(c);w=addDays(w,-7)){ if(skip(w)) continue; if(!met(w)) break; cur++; }
    let best=0,run=0; for(let w2=weekStart(c);w2<=last;w2=addDays(w2,7)){ if(skip(w2)) continue; if(met(w2)){run++;best=Math.max(best,run)} else if(+w2!==+last) run=0 }
    return {cur,best,unit:'wk'};
  }
  /* rest days and days that are not due are skipped; today not done yet does not break it */
  let cur=0; for(let d=end;d>=c;d=addDays(d,-1)){ if(!dueDaily(r,d,data))continue; if(isDone(data,r,key(d)))cur++; else if(+d===+t)continue; else break; }
  let best=0,run=0; for(let d=c;d<=end;d=addDays(d,1)){ if(!dueDaily(r,d,data))continue; if(isDone(data,r,key(d))){run++;best=Math.max(best,run)} else if(+d!==+t) run=0 }
  return {cur,best,unit:'d'};
}

/* ---------- ranks ---------- */
/* a month's rank comes from its completion %, to one decimal: up to 50 Comfort Zone, 50.1–60 Starter, … 95.1 and up Focused ("The Chosen").
   Each rank's artwork is app/ranks/banner-<id>.svg and badge-<id>.svg. */
export const RANKS=[{id:'comfort-zone',name:'Comfort Zone',max:50},{id:'starter',name:'Starter',max:60},{id:'student',name:'Student',max:70},{id:'builder',name:'Builder',max:78},
  {id:'iron-will',name:'Iron Will',max:85},{id:'stoic',name:'Stoic',max:95},{id:'focused',name:'Focused',title:'The Chosen',max:100}];
export const pct1=v=>Math.round(v*1000)/10; // 0.7834 → 78.3
export function rankIndex(v){const p=pct1(v),i=RANKS.findIndex(r=>p<=r.max);return i<0?RANKS.length-1:i}
/* the lowest % that earns rank i */
export const rankFrom=i=>i?Math.round(RANKS[i-1].max*10+1)/10:0;
export const monthStart=d=>new Date(d.getFullYear(),d.getMonth(),1);
/* a month's result as of day t: the stats of its days up to t, the rank they earn (null when nothing was expected yet), and whether the month is over */
export function monthResult(data,first,t){
  const last=new Date(first.getFullYear(),first.getMonth()+1,0), end=minD(last,t);
  const st=end<first?{pct:0,per:[],exp:0}:rangeStats(data,first,end);
  return {...st,first,rank:st.exp?rankIndex(st.pct):null,final:last<t};
}
/* the two neon routine colours (neon green, neon blue) are unlocked while this month's rank so far, as the Today card shows it,
   is Iron Will or higher */
export const NEON_RANK=RANKS.findIndex(r=>r.id==='iron-will');
export const neonUnlocked=(data,t)=>(monthResult(data,monthStart(t),t).rank??-1)>=NEON_RANK;
/* the months to rank, oldest first: from the month the first routine was created to the month of day t */
export function rankMonths(data,t){
  const c=data.routines.map(r=>r.created).sort()[0], out=[];
  if(c) for(let d=monthStart(parse(c));d<=t;d=new Date(d.getFullYear(),d.getMonth()+1,1)) out.push(d);
  return out;
}

/* ---------- Wildcards ---------- */
/* On Saturday or Sunday the user can spend a Wildcard to open that weekend and finish what was missed Monday to Friday.
   A make-up is written as a check-in on the missed weekday, so that day, the week, the month, the rank and the streaks all count it.
   Two per calendar month, counted by the day each was used; only for the current week. */
export const WILDCARDS_PER_MONTH=2;
const wc=data=>data.wildcards||(data.wildcards={}), mu=data=>data.madeUp||(data.madeUp={});
export function wildcardsLeft(data,today){
  const m=key(today).slice(0,7);
  return Math.max(0,WILDCARDS_PER_MONTH-Object.values(data.wildcards||{}).filter(on=>on.slice(0,7)===m).length);
}
export const wildcardOpen=(data,today)=>isWeekend(today)&&!!(data.wildcards||{})[key(weekStart(today))]; // on any weekend, open or not
export const isMadeUp=(data,id,k)=>((data.madeUp||{})[k]||[]).includes(id);
/* what was missed this week, Monday to Friday, as [{r, k}] (k = the weekday it belongs to).
   Daily and "some days" routines: each due day not done. Weekly routines: one entry per check-in short of the target,
   each on the earliest weekday without one. Made-up entries are included (done:true) so they can be shown and undone. */
export function weekMissed(data,today){
  const mon=weekStart(today), out=[];
  for(const r of data.routines){
    if(!existsIn(r,mon,addDays(mon,4))) continue;
    const days=[0,1,2,3,4].map(i=>addDays(mon,i)).filter(d=>d<=today&&isTracked(r,d));
    const weekly=days.length&&schedOn(r,days[days.length-1]).type==='weekly';
    if(weekly){
      const s=schedOn(r,days[days.length-1]), made=days.filter(d=>isMadeUp(data,r.id,key(d)));
      let short=weekTarget(data,s.target,mon)-(weekDone(data,r,mon)-made.length);
      for(const d of made){out.push({r,k:key(d),done:true});short--}
      for(const d of days){ if(short<=0) break; if(!isDone(data,r,key(d))&&isDue(r,d,data)){out.push({r,k:key(d),done:false});short--} }
    } else for(const d of days){ const k=key(d);
      if(isDue(r,d,data)&&(!isDone(data,r,k)||isMadeUp(data,r.id,k))) out.push({r,k,done:isDone(data,r,k)}); }
  }
  return out.sort((a,b)=>a.k<b.k?-1:a.k>b.k?1:0);
}
/* spends a Wildcard on this weekend; false when it isn't allowed */
export function useWildcard(data,today){
  if(!isWeekend(today)||wildcardOpen(data,today)||!wildcardsLeft(data,today)||!weekMissed(data,today).some(x=>!x.done)) return false;
  wc(data)[key(weekStart(today))]=key(today); return true;
}
/* ticks off (or, if made up already, unticks) a missed routine for weekday k; only while this weekend is open */
export function makeUp(data,id,k,today){
  if(!wildcardOpen(data,today)) return false;
  const item=weekMissed(data,today).find(x=>x.r.id===id&&x.k===k); if(!item) return false;
  const m=mu(data);
  if(item.done){ toggle(data,id,k); m[k]=(m[k]||[]).filter(x=>x!==id); if(!m[k].length) delete m[k]; }
  else { toggle(data,id,k); (m[k]||(m[k]=[])).push(id); }
  return true;
}

/* ---------- Vacation days ---------- */
/* A vacation day is a weekday that counts like a weekend: nothing is due, it is left out of every %, and it never breaks a streak.
   10 per half-year (January–June and July–December), counted by the half the day falls in. Unused days expire with the half.
   Only today (while nothing is checked off yet) and future weekdays up to the end of the next half can be booked; past ones are locked. */
export const VACATION_DAYS=10;
export const isVacation=(data,d)=>!!(data&&data.vacations&&data.vacations[key(d)]);
export const isOff=(data,d)=>restOn(data,d)||isVacation(data,d);
/* '2026b' for July–December 2026 */
function halfOf(k){return k.slice(0,4)+(+k.slice(5,7)<=6?'a':'b')}
/* the half-year around day d: 1 January – 30 June, or 1 July – 31 December */
export function half(d){const y=d.getFullYear(),h=d.getMonth()<6?0:6;return {start:new Date(y,h,1),end:new Date(y,h+6,0)}}
/* the last day that can be booked: the end of the half after today's */
export const bookUntil=today=>half(addDays(half(today).end,1)).end;
export function vacationsLeft(data,d){
  const h=halfOf(key(d));
  return Math.max(0,VACATION_DAYS-Object.keys(data.vacations||{}).filter(k=>halfOf(k)===h).length);
}
/* the weekly target for the week of Monday w, prorated by its vacation days: max(1, round(target × working days / 5)), or 0 when the whole week is vacation */
export function weekTarget(data,target,w){
  const wd=[0,1,2,3,4].filter(i=>!isVacation(data,addDays(w,i))).length;
  return wd?Math.max(1,Math.round(target*wd/5)):0;
}
/* '' when day k can be booked, else why not: 'weekend', 'past', 'far', 'booked', 'checked' (today, with something already ticked) or 'full' */
export function canBook(data,k,today){
  const d=parse(k), t=key(today);
  if(restOn(data,d)) return 'weekend'; // a weekend rest day has nothing to take off; an open one can be booked
  if(k<t) return 'past';
  if(d>bookUntil(today)) return 'far';
  if(isVacation(data,d)) return 'booked';
  if(k===t&&(data.checks[k]||[]).length) return 'checked';
  if(!vacationsLeft(data,d)) return 'full';
  return '';
}
export function bookVacation(data,k,today){
  if(canBook(data,k,today)) return false;
  (data.vacations||(data.vacations={}))[k]=key(today); return true;
}
/* today's and future vacation days can be cancelled, and go back to the allowance */
export function cancelVacation(data,k,today){
  if(k<key(today)||!(data.vacations||{})[k]) return false;
  delete data.vacations[k]; return true;
}
/* the first day after d that is neither a rest day nor a vacation day */
export function nextWorkday(data,d){let x=addDays(d,1);while(isOff(data,x))x=addDays(x,1);return x}

/* ---------- Open weekends ---------- */
/* Saturday and Sunday are rest days unless the owner opened them in Settings. data.weekends keeps the history, so the past never
   changes: [{from:'2026-11-21', open:true}, {from:'2026-12-14', open:false}] opens weekends from 21 Nov and closes them from 14 Dec.
   A weekend day is open when the last entry on or before it says so; with no entries weekends are rest days. */
function openOn(data,k){let o=false;for(const w of (data&&data.weekends)||[]){if(w.from<=k)o=w.open;else break}return o}
export const weekendOpen=(data,d)=>isWeekend(d)&&openOn(data,key(d));
export const restOn=(data,d)=>isWeekend(d)&&!openOn(data,key(d));
/* whether weekends are open as of day t (the Settings switch), and since when */
export const weekendsOpenOn=(data,t)=>openOn(data,key(t));
export function weekendsOpenSince(data,t){const k=key(t),l=(data.weekends||[]).filter(w=>w.from<=k);return l.length&&l[l.length-1].open?l[l.length-1].from:null}
/* opens or closes weekends from today; an entry already from today is replaced, and nothing is added when nothing changes */
function setWeekends(data,open,today){
  const k=key(today), list=(data.weekends||[]).filter(w=>w.from<k), was=list.length?list[list.length-1].open:false;
  data.weekends=was===open?list:list.concat({from:k,open});
}
export function openWeekends(data,today){setWeekends(data,true,today)}
/* the routines made for weekends that are still active: closing weekends stops them */
export const weekendRoutines=(data,today)=>data.routines.filter(r=>!r.stopped&&r.created<=key(today)&&schedOn(r,today).type==='weekend');
/* closes weekends from today: weekend routines are stopped (their history stays), today's check-ins on them go if today is a weekend,
   and vacation days booked on weekends from today on go back to the allowance. Returns the routines it stopped. */
export function closeWeekends(data,today){
  const k=key(today), gone=weekendRoutines(data,today);
  for(const r of gone){
    stopRoutine(r,today);
    if(data.checks[k]){data.checks[k]=data.checks[k].filter(id=>id!==r.id);if(!data.checks[k].length)delete data.checks[k]}
  }
  for(const v of Object.keys(data.vacations||{})) if(v>=k&&isWeekend(parse(v))) delete data.vacations[v];
  setWeekends(data,false,today);
  return gone;
}
/* a stopped weekend routine can only come back while weekends are open */
export function canResume(data,r,today){
  if(!r.stopped) return false;
  const s=r.schedules.filter(x=>x.from<=r.stopped&&x.type!=='off').pop();
  return !(s&&s.type==='weekend')||weekendsOpenOn(data,today);
}

/* ---------- Shop: Pelican Coins and themes ---------- */
/* Everyone starts with COINS_START Pelican Coins. Each purchase is kept in data.purchases as {id, price, at} (at: the day it was bought),
   so it goes into backups; the balance is the start minus what was spent. A theme once bought is owned for good, even after the Shop
   stops selling it (themes.js available:false); one that was never bought can only be bought while it is available. */
export const COINS_START=100;
export const coinsLeft=data=>COINS_START-(data.purchases||[]).reduce((n,p)=>n+p.price,0);
export const ownsTheme=(data,id)=>(data.purchases||[]).some(p=>p.id===id);
/* why a theme can't be bought now ('owned', 'unavailable' or 'coins'), or null when it can */
export function cantBuy(data,theme){
  if(ownsTheme(data,theme.id)) return 'owned';
  if(!theme.available) return 'unavailable';
  if(coinsLeft(data)<theme.price) return 'coins';
  return null;
}
export function buyTheme(data,theme,today){
  if(cantBuy(data,theme)) return false;
  data.purchases=(data.purchases||[]).concat({id:theme.id,price:theme.price,at:key(today)});
  return true;
}
/* a theme given for free (price 0): someone already using a theme when the Shop arrived keeps it */
export function grantTheme(data,id,today){
  if(ownsTheme(data,id)) return false;
  data.purchases=(data.purchases||[]).concat({id,price:0,at:key(today)});
  return true;
}
