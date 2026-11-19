/* Kept UI: rendering and events. Rules and stats live in logic.js, storage in store.js. */
import {key,parse,addDays,dow,isRest,weekStart,TODAY,minD,schedOn,isDue,changeSchedule,stopRoutine,resumeRoutine,isDone,toggle,rangeStats,dayRatio,level,weekDone,streaks,RANKS,pct1,rankFrom,monthStart,monthResult,rankMonths,WILDCARDS_PER_MONTH,wildcardsLeft,wildcardOpen,weekMissed,useWildcard,makeUp,isMadeUp,
  VACATION_DAYS,isVacation,isOff,half,bookUntil,vacationsLeft,weekTarget,canBook,bookVacation,cancelVacation,nextWorkday,RULE_MAX,neonUnlocked} from './logic.js';
import {load,save,loadMeta,saveMeta,eraseAll,backupFile,readBackup} from './store.js';
import {startWater,doneDandelion,slowDandelion,flyingPelican} from './scene.js';
import {emblem,badgeMarks} from './art.js';

/* routine colours: Apple green, blue, purple, teal and orange (the red was taken out on 19 Nov 2026),
   then two on trial, neon green and neon blue: wherever they show, they have a ring and they move (the "fx" class, styles.css) */
const COLORS=['#34C759','#007AFF','#AF52DE','#30B0C7','#FF9500','#39FF14','#1F51FF','#BC13FE','#00F5D4','#FF5F1F']; // the picker shows them in two rows: each neon under its plain colour
const COLOR_NAMES={'#34C759':'Green','#007AFF':'Blue','#AF52DE':'Purple','#30B0C7':'Teal','#FF9500':'Orange','#39FF14':'Neon green','#1F51FF':'Neon blue','#BC13FE':'Neon purple','#00F5D4':'Neon teal','#FF5F1F':'Neon orange'};
const FX_COLORS=new Set(['#39FF14','#1F51FF','#BC13FE','#00F5D4','#FF5F1F']);
/* the neon colours are unlocked while this month's rank so far is Iron Will or higher (logic.js neonUnlocked).
   fxOn is worked out at the start of each render. While they are locked, routines in them show plain green or blue
   (nothing in the data changes), and the picker shows them dimmed with a lock. */
let fxOn=false;
const fxRefresh=()=>{fxOn=neonUnlocked(S,TODAY())};
const FX_PLAIN={'#39FF14':'#34C759','#1F51FF':'#007AFF','#BC13FE':'#AF52DE','#00F5D4':'#30B0C7','#FF5F1F':'#FF9500'};
const shown=c=>{const u=String(c).toUpperCase();return FX_COLORS.has(u)&&!fxOn?FX_PLAIN[u]:c};
const fx=c=>fxOn&&FX_COLORS.has(String(c).toUpperCase())?' fx':'';
const fxLocked=c=>FX_COLORS.has(c)&&!fxOn;
let colPop=null; // the colour just tapped in the picker: it pops once
/* the done check mark is white, except on very light colours (the neon), where it turns black so it stays readable */
const lum=hex=>{const v=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);return .2126*v[0]+.7152*v[1]+.0722*v[2]};
const inkCls=c=>/^#[0-9A-F]{6}$/i.test(c)&&lum(c)>.6?' lc':'';
const EMOJI=['🥗','🏋️','📖','💧','📞','🧘','🛏️','🚶','✍️','🎸','🧹','☀️','🍎','📵','🧠','🌱','🚀','💰','💊'];
const DAYS=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const DAYS1=['M','T','W','T','F','S','S'];
const DAYS_FULL=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];

const VERSION='1.0.0';
const empty=()=>({schema:1,routines:[],checks:{},wildcards:{},madeUp:{},vacations:{},rules:[]});
let meta=loadMeta(), pendingRestore=null; // a backup file read and waiting for the owner to confirm
const loaded=load();
let S=loaded.data||empty();
if(!loaded.data&&!loaded.error) navigator.storage?.persist?.().catch(()=>{}); // first run: ask the browser to keep the data; the answer does not matter
let view='today', viewDate=TODAY(), statMode='week', weekRef=weekStart(TODAY()), monthRef=monthStart(TODAY());
let edit=null, confirmDel=false, confirmClear=false, sheetOpening=false;
let ringFrac=null, popId=null; // the ring animates from its last value; popId is the routine that was just checked off
let quietDandelion=null; // the slow dandelion of the "No routines yet" screen, made once per start and moved into each re-render

const short=k=>{const d=parse(k);return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0,3)}`};
const commit=()=>{if(!save(S))toast("Couldn't save. Your iPhone storage may be full.")};
const setMeta=m=>{meta={...meta,...m};saveMeta(meta)};
/* appearance: Settings → Dark mode sets meta.theme to 'light' or 'dark'; null follows the device */
const systemDark=matchMedia('(prefers-color-scheme: dark)');
const isDark=()=>meta.theme?meta.theme==='dark':systemDark.matches;
function applyTheme(){
  const r=document.documentElement; if(meta.theme) r.setAttribute('data-theme',meta.theme); else r.removeAttribute('data-theme');
  /* the status bar colour: both tags show the chosen colour, or each its own when following the device */
  document.querySelectorAll('meta[name="theme-color"]').forEach(m=>{m.content=(meta.theme?meta.theme==='dark':m.media.includes('dark'))?'#000000':'#F2F2F7'});
  dispatchEvent(new Event('kept-theme')); // the lake repaints in the new colours
}
/* due when there is at least one check-in and no backup in the last 7 days, unless put off until tomorrow */
const reminderDue=()=>Object.keys(S.checks).length>0&&meta.reminderDismissedOn!==key(TODAY())&&(!meta.lastBackupAt||Date.now()-Date.parse(meta.lastBackupAt)>7*864e5);
function ago(iso){
  if(!iso) return 'Never';
  const days=Math.round((TODAY()-new Date(new Date(iso).toDateString()))/864e5);
  return days<=0?'Today':days===1?'Yesterday':`${days} days ago`;
}

function schedText(r,d){
  const s=schedOn(r,d||TODAY());
  if(s.type==='daily'||s.type==='off') return 'Mon – Fri';
  if(s.type==='days') return s.days.length>=5?'Mon – Fri':s.days.slice().sort().map(i=>DAYS[i]).join(' · ');
  return d?`${weekDone(S,r,d)} of ${weekTarget(S,s.target,weekStart(d))} this week`:`${s.target}× per week`; // fewer in a week with vacation days
}

/* ---------- icons, drawn in the style of Apple's SF Symbols ---------- */
const CHECK='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';
const MOON='<svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>';
const LOCK='<svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2.4"/><rect x="5" y="10.5" width="14" height="11" rx="2.5" fill="currentColor"/></svg>';
const chev=d=>`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
const CHEV_L=chev('M14.5 5 7.5 12l7 7'), CHEV_R=chev('m9.5 5 7 7-7 7');
const DISC='<svg class="disc" width="9" height="15" viewBox="0 0 9 15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m1.5 1.5 6 6-6 6"/></svg>';
const XMARK='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
const TICK='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';
const WILD=(sz=34)=>`<svg width="${sz}" height="${sz}" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="2.5" width="14" height="19" rx="3" fill="currentColor" opacity=".16"/><rect x="5" y="2.5" width="14" height="19" rx="3" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 7.2l1.35 2.75 3.03.44-2.19 2.14.52 3.02L12 14.12l-2.71 1.43.52-3.02-2.19-2.14 3.03-.44z" fill="currentColor"/></svg>`;
const PLUS='<svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="currentColor"/><path d="M12 7v10M7 12h10" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg>';

/* ---------- render ---------- */
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $app=document.getElementById('app');

function ring(done,total){
  const r=26,c=2*Math.PI*r,f=total?done/total:0,from=ringFrac??f; ringFrac=f;
  return `<svg class="ring" width="68" height="68" viewBox="0 0 68 68" role="img" aria-label="${done} of ${total} done">
  <circle class="trk" cx="34" cy="34" r="${r}" fill="none" stroke-width="9"/>
  <circle class="prog" cx="34" cy="34" r="${r}" fill="none" stroke-width="9" stroke-linecap="round" stroke-dasharray="${c}"
    style="stroke-dashoffset:${c*(1-from)}" data-to="${c*(1-f)}" transform="rotate(-90 34 34)"/>
  <text class="t" x="34" y="39" text-anchor="middle" font-size="15">${done}/${total}</text></svg>`;
}

/* the Today title on a glass card in the style of this month's rank banner: the rank's colours, a soft glow,
   the banner's seven dashes lit up to the rank, and the rank's badge on the right (it opens Ranks) */
function rankFrame(i,inner){
  return `<div class="titles rf rk${i} rf${i}"><div class="rf-text">${inner}<span class="rf-pips" aria-hidden="true">${RANKS.map((_,k)=>`<i${k<=i?' class="on"':''}></i>`).join('')}</span></div>
    <button class="rf-badge" data-act="openRanks" aria-label="Rank: ${RANKS[i].name}. Show all ranks">${art('badge',i)}</button></div>`;
}

function renderToday(){
  const t=TODAY(),d=viewDate,k=key(d),isToday=+d===+t,past=d<t,rest=isRest(d),away=!rest&&isVacation(S,d),yest=+d===+addDays(t,-1);
  const due=S.routines.filter(r=>isDue(r,d,S));
  const done=due.filter(r=>isDone(S,r,k)).length;
  const title=isToday?'Today':yest?'Yesterday':DAYS_FULL[dow(d)];
  const rk=S.routines.length?monthResult(S,monthStart(d),t):null; // the rank of the shown day's month, on every day, so the header never changes shape
  const date=`${isToday||yest?DAYS_FULL[dow(d)]+' ':''}${d.getDate()} ${MONTHS[d.getMonth()]}${d.getFullYear()!==t.getFullYear()?' '+d.getFullYear():''}`;
  let html=`<header class="head">${rk?.rank!=null?rankFrame(rk.rank,`<div class="eyebrow">${date}</div><h1>${title}</h1>`):`<div class="titles"><div class="eyebrow">${date}</div><h1>${title}</h1></div>`}${rest?`<div class="restbadge" aria-hidden="true">${MOON}</div>`:away?`<div class="restbadge vacbadge" aria-hidden="true">${flyingPelican()}</div>`:ring(done,due.length)}</header>
    <div class="daynav"><span></span><div class="ggroup glass"><button class="gbtn" data-act="prevDay" aria-label="Previous day">${CHEV_L}</button><button class="gbtn" data-act="nextDay" aria-label="Next day" ${isToday?'disabled':''}>${CHEV_R}</button></div>
    ${isToday?'<span></span>':'<button class="gpill glass" data-act="goToday" aria-label="Back to today">Today</button>'}</div>`;
  if(isToday&&reminderDue()) html+=`<div class="group reminder"><div class="row"><div class="body"><div class="name">Time for a backup</div>
    <div class="hint">Last backup: ${ago(meta.lastBackupAt)}. Save one to Files or iCloud Drive.</div></div></div>
    <div class="row actions"><button class="pill" data-act="saveBackup">Save backup</button><button class="pill quiet" data-act="later">Later</button></div></div>`;
  if(rest){
    html+=isToday&&wildcardOpen(S,t)
      ?`<div class="restcard">${MOON}<h3>Rest day</h3><p>You used a Wildcard: this weekend you can finish what you missed this week. It counts for the day you missed it.</p></div>`
      :`<div class="restcard">${MOON}<h3>Rest day</h3><p>Saturdays and Sundays are for resting, so there is nothing to check off.${isToday?' Your routines start again on Monday.':''}</p></div>`;
    if(isToday) html+=wildcardSection(t); // the Wildcard, if something was missed this week
  } else if(away){
    html+=vacationDay(d,isToday);
  } else if(!S.routines.length){
    html+=`<div class="empty"><div class="dslot"></div><h3>No routines yet</h3><p>Add your first one, like “Eat healthy”, and tick it off each day.</p><button class="primary" data-act="new">Add a routine</button></div>`;
  } else if(!due.length){
    html+=`<div class="empty"><h3>Nothing scheduled</h3><p>No routines are due on this day.</p></div>`;
  } else {
    if(past) html+=`<div class="lockline">${LOCK}Past day, view only. You can only check off today.</div>`;
    html+='<div class="group tiles">'+due.map(r=>{const dn=isDone(S,r,k),weekly=schedOn(r,d).type==='weekly';
      const hint=past?(dn?(isMadeUp(S,r.id,k)?'Made up with a Wildcard':'Completed'):(weekly?'Not done':'Missed')):schedText(r,d);
      const ctl=past?`<div class="status" role="img" aria-label="${dn?'Completed':'Not completed'}">${dn?CHECK:''}</div>`
        :`<button class="check" data-act="toggle" data-id="${r.id}" aria-pressed="${dn}" aria-label="Mark ${esc(r.name)} done"><span class="ci">${CHECK}</span></button>`;
      return `<div class="row item${inkCls(shown(r.color))}${fx(r.color)}${dn?' done':''}${past?' locked':''}${past&&!dn&&!weekly?' missed':''}${r.id===popId?' pop':''}" style="--c:${shown(r.color)}">
      <div class="tile">${r.emoji}</div><div class="body"><div class="name">${esc(r.name)}</div><div class="hint">${hint}</div></div>${ctl}</div>`}).join('')+'</div>';
    if(done===due.length) html+=`<p class="note">${isToday?'All done for today. Nice work.':'Everything was done on this day.'}</p>`;
  }
  $app.innerHTML=html; popId=null;
  const slot=$app.querySelector('.dslot');
  if(slot){quietDandelion??=slowDandelion(); if(!quietDandelion.dataset.done) slot.append(quietDandelion)}
  const p=$app.querySelector('.ring .prog'); if(p){p.getBoundingClientRect();p.style.strokeDashoffset=p.dataset.to}
}

function renderRoutines(){
  const active=S.routines.filter(r=>!r.stopped), stopped=S.routines.filter(r=>r.stopped);
  let html=`<header class="head"><div class="titles"><div class="eyebrow">${active.length} active · weekends off</div><h1>Routines</h1></div></header>`;
  html+=`<div class="group tiles"><button class="row link newroutine" data-act="new"><span class="addicon">${PLUS}</span>New routine</button></div>`;
  if(active.length) html+='<div class="group tiles">'+active.map(r=>`<button class="row${fx(r.color)}" style="--c:${shown(r.color)}" data-act="edit" data-id="${r.id}">
    <div class="tile">${r.emoji}</div><div class="body"><div class="name">${esc(r.name)}</div><div class="hint">${schedText(r)}</div></div>${DISC}</button>`).join('')+'</div>';
  if(stopped.length) html+=`<div class="gh">Stopped</div><div class="group tiles">${stopped.map(r=>`<div class="row stopped${fx(r.color)}" style="--c:${shown(r.color)}">
    <button class="rowbtn" data-act="edit" data-id="${r.id}"><div class="tile">${r.emoji}</div><div class="body"><div class="name">${esc(r.name)}</div><div class="hint">Stopped ${short(r.stopped)}</div></div></button>
    <button class="pill" data-act="resume" data-id="${r.id}">Resume</button></div>`).join('')}</div>
    <p class="gf">Stopped routines keep their history. Resume one to track it again from today.</p>`;
  $app.innerHTML=html;
}

const rangeHead=(x,label,isCur)=>`<div class="rangehead"><button class="gbtn glass" data-act="prev${x}" aria-label="Previous ${x==='W'?'week':'month'}">${CHEV_L}</button>
  <div class="lbl">${label}</div><button class="gbtn glass" data-act="next${x}" aria-label="Next ${x==='W'?'week':'month'}" ${isCur?'disabled':''}>${CHEV_R}</button></div>`;
const kpi=(n,cap)=>`<div class="kpi"><div class="cap">${cap}</div><div class="v">${n}<small>%</small></div></div>`;
const monthName=d=>`${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

/* ---------- rank artwork (app/ranks/): a banner for the Ranks page and a badge for Stats → Month ---------- */
/* It goes into the page as inline SVG, so its text can use the two fonts in styles.css (an <img> could not).
   Until it has loaded, or if it can't load, a block in the rank's colors holds its place at the same size. */
const ART={};
const artRatio=(kind,i)=>kind==='banner'?`1200/${[440,460,480,500,520,540,620][i]}`:i===6?'640/595':'560/430';
let artN=0;
async function loadArt(){
  document.fonts?.load("800 16px 'Bricolage Grotesque'").catch(()=>{}); // load the fonts now, so the text doesn't change font as it appears
  document.fonts?.load("500 16px 'Figtree'").catch(()=>{});
  await Promise.all(RANKS.flatMap((r,i)=>['banner','badge'].map(async kind=>{
    try{
      const res=await fetch(new URL(`../ranks/${kind}-${r.id}.svg`,import.meta.url)), raw=res.ok?await res.text():'', svg=kind==='banner'?emblem(raw):badgeMarks(raw);
      const vb=svg.match(/viewBox="[-\d.]+ [-\d.]+ ([\d.]+) ([\d.]+)"/);
      if(vb) ART[`${kind}-${i}`]={svg,ratio:`${vb[1]}/${vb[2]}`};
    }catch(e){}
  })));
  if(view==='ranks'||view==='stats'||view==='today') render();
}
/* each copy gets its own ids (kept-… becomes kept7-…), so one artwork can appear twice on a page. Badges sit next to text that names the rank, so screen readers skip them. */
function art(kind,i){
  const a=ART[`${kind}-${i}`], n=++artN;
  return `<span class="art ${kind} rk${i}${a?'':' ph'}" style="aspect-ratio:${a?a.ratio:artRatio(kind,i)}"${kind==='badge'?' aria-hidden="true"':''}>${
    a?a.svg.replace(/(["#])kept-/g,`$1kept${n}-`):kind==='banner'?`<span>${RANKS[i].name}</span>`:''}</span>`;
}

function renderStats(){
  const t=TODAY();
  let html=`<header class="head"><div class="titles"><h1>Statistics</h1></div></header>
  <div class="seg" role="group" aria-label="Period"><button data-act="mode" data-m="week" aria-pressed="${statMode==='week'}">Week</button><button data-act="mode" data-m="month" aria-pressed="${statMode==='month'}">Month</button></div>`;
  if(!S.routines.length){$app.innerHTML=html+'<div class="empty"><h3>No data yet</h3><p>Add routines and check them off to see stats here.</p></div>';return}
  if(statMode==='week'){
    const a=weekRef,b=addDays(a,6),bEff=minD(b,t);
    const st=rangeStats(S,a,bEff);
    const isCur=+a===+weekStart(t);
    html+=rangeHead('W',isCur?'This week':`${a.getDate()} ${MONTHS[a.getMonth()].slice(0,3)} – ${b.getDate()} ${MONTHS[b.getMonth()].slice(0,3)}`,isCur)
    +`<div class="card">${kpi(Math.round(st.pct*100),'Completed')}
    <div class="bars">${[...Array(7)].map((_,i)=>{const d=addDays(a,i),td=+d===+t?' today':'';
      if(isRest(d)) return `<div class="bar rest${td}"><span class="p"></span><div class="cw"><div class="col" style="height:100%"><span>Rest</span></div></div><span class="d">${DAYS1[i]}</span></div>`;
      if(isVacation(S,d)) return `<div class="bar vac${td}"><span class="p"></span><div class="cw"><div class="col" style="height:100%"><span>Away</span></div></div><span class="d">${DAYS1[i]}</span></div>`;
      const fut=d>t,v=fut?null:dayRatio(S,d),h=v==null?0:Math.round(v*100);
      return `<div class="bar${fut?' future':h?'':' zero'}${td}"><span class="p">${fut||v==null?'':h+'%'}</span><div class="cw"><div class="col" style="height:${h}%"></div></div><span class="d">${DAYS1[i]}</span></div>`}).join('')}</div></div>
    <h2 class="sh">By routine</h2><div class="group tiles">${st.per.map(({r,e,d})=>`<div class="rstat${fx(r.color)}" style="--c:${shown(r.color)}">
      <div class="tile">${r.emoji}</div><div class="nm">${esc(r.name)}</div><div class="pc">${d}/${e}</div>
      <div class="dots">${[...Array(7)].map((_,i)=>{const dd=addDays(a,i);if(isRest(dd))return '<i class="rest"></i>';if(isVacation(S,dd))return '<i class="vac"></i>';if(dd>t||!isDue(r,dd,S))return '<i class="off"></i>';return `<i class="${isDone(S,r,key(dd))?(isMadeUp(S,r.id,key(dd))?'on mu':'on'):''}"></i>`}).join('')}</div></div>`).join('')}</div>`;
  } else {
    const a=monthRef,b=new Date(a.getFullYear(),a.getMonth()+1,0);
    const st=monthResult(S,a,t);
    const isCur=a.getFullYear()===t.getFullYear()&&a.getMonth()===t.getMonth();
    let cells=DAYS1.map(x=>`<span class="h">${x}</span>`).join('')+'<span class="day blank"></span>'.repeat(dow(a));
    for(let d=a;d<=b;d=addDays(d,1)){const td=+d===+t?' today':'';
      if(isRest(d)){cells+=`<span class="day rest${td}" role="img" aria-label="${d.getDate()} ${MONTHS[d.getMonth()]}, rest day">${d.getDate()}</span>`;continue}
      const fut=d>t;
      if(isVacation(S,d)){cells+=`<span class="day vac${td}" role="img" aria-label="${d.getDate()} ${MONTHS[d.getMonth()]}, vacation day">${d.getDate()}</span>`;continue}
      const lv=fut?0:level(dayRatio(S,d));
      cells+=`<button class="day l${lv}${fut?' future':''}${td}${(S.madeUp||{})[key(d)]?' mu':''}" ${fut?'disabled':`data-act="openDay" data-k="${key(d)}"`} aria-label="${d.getDate()} ${MONTHS[d.getMonth()]}">${d.getDate()}</button>`}
    /* the month's rank next to its %: final (locked) once the month is over, live until then */
    const rk=st.rank==null?'':`<div class="ycap${st.final?' final':''}">${st.final?LOCK+'Final rank':'Rank so far'}</div>
      <button class="hero" data-rk="${st.rank}" data-act="openRanks" aria-label="${st.final?'Final rank':'Rank so far'}: ${RANKS[st.rank].name}. Show all ranks">${art('banner',st.rank)}</button>`;
    html+=rangeHead('M',monthName(a),isCur)+rk
    +`<div class="card">${kpi(pct1(st.pct),st.final?'Completed':'Completed this month')}
    <div class="heat">${cells}</div>
    <div class="legend"><span class="lg">Less<i class="day l0"></i><i class="day l1"></i><i class="day l2"></i><i class="day l3"></i><i class="day l4"></i>More</span><span class="lg"><i class="day rest"></i>Rest</span><span class="lg"><i class="day vac"></i>Vacation</span><span class="lg"><i class="mul"></i>Made up</span></div>
    <p class="foot">Tap a day to see what you did. Black days are rest days, blue days vacation.</p></div>
    <h2 class="sh">By routine</h2><div class="group tiles">${st.per.map(({r,e,d,pct})=>{const s=streaks(S,r,t);return `<div class="rstat${fx(r.color)}" style="--c:${shown(r.color)}">
      <div class="tile">${r.emoji}</div><div class="nm">${esc(r.name)}</div><div class="pc">${Math.round(pct*100)}%</div>
      <div class="track"><span style="width:${Math.round(pct*100)}%"></span></div>
      <div class="meta"><span class="num">${d}</span> of <span class="num">${e}</span> · streak <span class="num">${s.cur}${s.unit}</span> · best <span class="num">${s.best}${s.unit}</span></div></div>`}).join('')}</div>`;
  }
  html+=vacationCard(t); // at the bottom of Stats, in both Week and Month: days left this half-year, the next trip, and the button
  $app.innerHTML=html;
}

/* this month's rank at the top, then all seven banners from the lowest up; the ranks above this month's are grayed out */
function renderRanks(){
  const t=TODAY(), cur=monthResult(S,monthStart(t),t), now=cur.rank;
  let html=`<header class="head"><div class="titles"><div class="eyebrow">${monthName(t)}</div><h1>Ranks</h1></div></header>`;
  if(!S.routines.length) html+='<p class="gf first ranknote">Add routines and check them off. Every month earns a rank.</p>';
  else if(now==null) html+='<p class="gf first ranknote">No rank yet this month. It appears after the first day with something to do.</p>';
  else{
    const p=pct1(cur.pct), next=RANKS[now+1];
    html+=`<div class="ycap">Your rank this month</div><div class="hero" data-rk="${now}">${art('banner',now)}</div>
      <p class="goal"><b class="num">${p}%</b> completed${next?` · <b class="num">${Math.round((rankFrom(now+1)-p)*10)/10}%</b> to ${next.name}`:''}</p>`;
  }
  html+=`${now==null?'':'<h2 class="sh">All ranks</h2>'}<div class="ladder">${RANKS.map((r,i)=>`<div class="rung${now==null||i>now?' unreached':''}">${art('banner',i)}</div>`).join('')}</div>`;
  html+=`<p class="gf">Your rank follows this month's completed %. It is final when the month ends. Iron Will and higher unlock five neon colours for your routines.</p>`;
  if(S.routines.length){
    const past=rankMonths(S,t).map(m=>monthResult(S,m,t)).filter(m=>m.final).reverse();
    html+='<h2 class="sh">Past months</h2>'+(past.length?`<div class="group months">${past.map(m=>`<button class="row" data-act="openMonth" data-k="${key(m.first)}">
      <span class="slot">${m.rank==null?'<span class="art badge none" aria-hidden="true"></span>':art('badge',m.rank)}</span>
      <div class="body"><div class="name">${monthName(m.first)}</div><div class="hint">${m.rank==null?'No rank · nothing was scheduled':`${RANKS[m.rank].name} · <span class="num">${pct1(m.pct)}%</span>`}</div></div>${DISC}</button>`).join('')}</div>`
      :'<p class="gf first">Each finished month is kept here with the rank you ended on.</p>');
  }
  $app.innerHTML=html;
}

function renderSettings(){
  $app.innerHTML=`<header class="head"><div class="titles"><h1>Settings</h1></div></header>
  <div class="group"><div class="row appcard"><div class="body"><div class="appname">Kept</div><div class="hint">Your data lives only on this device.</div></div></div></div>
  <div class="gh">Appearance</div>
  <div class="group"><div class="row"><div class="body">Dark mode</div><button class="switch" role="switch" aria-checked="${isDark()}" aria-label="Dark mode" data-act="theme"><span></span></button></div>
    ${meta.theme?'<button class="row link" data-act="themeAuto">Use device setting</button>':''}</div>
  <p class="gf">${meta.theme?`Kept stays ${meta.theme} whatever your device is set to.`:'Kept follows your device\'s light or dark setting until you change it here.'}</p>
  <div class="group"><button class="row" data-act="openRules"><div class="body">Rules</div>${(S.rules||[]).length?`<span class="hint num">${S.rules.length}</span>`:''}${DISC}</button></div>
  <p class="gf">Your own rules for your routines, like what counts as done.</p>
  <div class="gh">Backup</div>
  <div class="group"><button class="row link" data-act="saveBackup">Save backup</button></div>
  <p class="gf">Last backup: ${ago(meta.lastBackupAt)}. On iPhone, choose Save to Files or iCloud Drive.</p>
  <div class="gh">Restore</div>
  ${pendingRestore?`<div class="group"><div class="row"><div class="body"><div class="name">Replace your current data with this backup?</div>
      <div class="hint">${pendingRestore.routines.length} routine${pendingRestore.routines.length===1?'':'s'}, ${Object.values(pendingRestore.checks).flat().length} check-ins</div></div></div>
    <button class="row danger" data-act="confirmRestore">Replace my data</button><button class="row link" data-act="cancelRestore">Cancel</button></div>`
  :`<div class="group"><label class="row link filepick">Restore from file<input type="file" id="restoreFile" accept=".json,application/json"></label></div>`}
  <div class="gh">Data</div>
  <div class="group"><button class="row danger" data-act="clear">${confirmClear?'Tap again to erase everything':'Erase all data'}</button></div>
  <div class="gh">About</div>
  <div class="group"><div class="row"><div class="body">Version</div><span class="hint">${VERSION}</span></div>
    <div class="row"><div class="body"><div class="name">Install on iPhone</div><div class="hint">Open Kept in Safari, tap Share, then Add to Home Screen. Open it once while online; after that it works offline.</div></div></div></div>
  <p class="credit">Powered by <b>Krtse XO</b></p>`;
}

/* ---------- Rules (Settings → Rules): your own rules, each for one routine, up to 255 characters ---------- */
/* grouped by routine, in the order of the routines; tap one to edit it */
function renderRules(){
  const rules=S.rules||[], byRoutine=S.routines.map(r=>({r,list:rules.filter(x=>x.routine===r.id)})).filter(g=>g.list.length);
  let html=`<div class="backrow"><button class="gpill glass back" data-act="rulesBack" aria-label="Back to Settings">${CHEV_L}<span>Settings</span></button></div>
    <header class="head"><div class="titles"><h1>Rules</h1></div></header>`;
  if(!S.routines.length){
    $app.innerHTML=html+`<div class="empty"><h3>No routines yet</h3><p>Rules belong to a routine. Add a routine first, then write its rules here.</p><button class="primary" data-act="new">Add a routine</button></div>`;
    return;
  }
  html+=`<div class="group tiles"><button class="row link newroutine" data-act="newRule"><span class="addicon">${PLUS}</span>New rule</button></div>`;
  if(!rules.length) html+='<p class="gf">Write down how each routine counts, like “Eat healthy: no sugar after 6 pm”. Each rule belongs to one routine.</p>';
  html+=byRoutine.map(({r,list})=>`<div class="gh rulegh"><span aria-hidden="true">${r.emoji}</span>${esc(r.name)}</div>
    <div class="group tiles">${list.map(x=>`<button class="row rule${fx(r.color)}" style="--c:${shown(r.color)}" data-act="editRule" data-id="${x.id}">
      <span class="rbar" aria-hidden="true"></span><div class="body"><div class="name">${esc(x.text)}</div></div>${DISC}</button>`).join('')}</div>`).join('');
  $app.innerHTML=html;
}
let rule=null, confirmRuleDel=false; // the rule being written in the sheet: {id (null when new), routine, text}
function openRule(id){
  const x=(S.rules||[]).find(y=>y.id===id), first=S.routines.find(r=>!r.stopped)||S.routines[0];
  rule={id:x?.id??null,routine:x?.routine??first?.id,text:x?.text??''}; confirmRuleDel=false; sheetOpening=true; renderSheet();
  if(!x) setTimeout(()=>document.getElementById('rtext')?.focus(),50);
}
function syncRule(){const t=document.getElementById('rtext');if(t&&rule)rule.text=t.value}
function renderRuleSheet(){
  const top=$sheet.querySelector('.sheet')?.scrollTop||0, n=rule.text.length;
  /* active routines first, then stopped ones */
  const list=[...S.routines.filter(r=>!r.stopped),...S.routines.filter(r=>r.stopped)];
  $sheet.innerHTML=`<div class="overlay${sheetOpening?' opening':''}" data-act="closeBg"><div class="sheet" role="dialog" aria-modal="true" aria-label="${rule.id?'Edit rule':'New rule'}">
    <div class="grabber" aria-hidden="true"></div>
    <div class="sheethead"><button class="gbtn glass" data-act="close" aria-label="Cancel">${XMARK}</button><h2>${rule.id?'Edit rule':'New rule'}</h2><button class="gbtn prominent" data-act="saveRule" aria-label="Save">${TICK}</button></div>
    <div class="gh">Routine</div>
    <div class="group tiles" role="radiogroup" aria-label="Routine">${list.map(r=>`<button class="row pickr${r.stopped?' stopped':''}${fx(r.color)}" style="--c:${shown(r.color)}" role="radio" aria-checked="${rule.routine===r.id}" data-act="ruleRoutine" data-id="${r.id}">
      <div class="tile">${r.emoji}</div><div class="body"><div class="name">${esc(r.name)}</div>${r.stopped?'<div class="hint">Stopped</div>':''}</div><span class="pickmark" aria-hidden="true">${TICK}</span></button>`).join('')}</div>
    <div class="gh"><label for="rtext">Rule</label></div>
    <div class="group"><textarea class="rta" id="rtext" maxlength="${RULE_MAX}" rows="4" placeholder="e.g. No sugar after 6 pm. A cheat meal on Friday still counts.">${esc(rule.text)}</textarea></div>
    <p class="gf rcount"><span class="num" id="rcount">${n}</span> / ${RULE_MAX}</p>
    <button class="primary" data-act="saveRule">${rule.id?'Save changes':'Add rule'}</button>
    ${rule.id?`<div class="group"><button class="row danger center" data-act="delRule">${confirmRuleDel?'Tap again to delete this rule':'Delete rule'}</button></div>`:''}
  </div></div>`;
  $sheet.querySelector('.sheet').scrollTop=top; sheetOpening=false;
}
function saveRule(){
  syncRule(); const text=rule.text.trim().slice(0,RULE_MAX);
  if(!S.routines.some(r=>r.id===rule.routine)){toast('Choose a routine');return}
  if(!text){toast('Write the rule first');document.getElementById('rtext')?.focus();return}
  S.rules??=[];
  const x=S.rules.find(y=>y.id===rule.id);
  if(x) Object.assign(x,{routine:rule.routine,text});
  else S.rules.push({id:'u_'+Date.now().toString(36),routine:rule.routine,text,created:key(TODAY())});
  commit(); toast(x?'Rule saved':'Rule added'); rule=null; renderSheet(); render();
}

function render(){
  fxRefresh();
  const tabOn=view==='rules'?'settings':view; // Rules is a page inside Settings
  document.querySelectorAll('#tabs button').forEach(b=>b.setAttribute('aria-current',b.dataset.tab===tabOn?'page':'false'));
  ({today:renderToday,routines:renderRoutines,stats:renderStats,ranks:renderRanks,settings:renderSettings,rules:renderRules})[view]();
}

/* ---------- editor sheet ---------- */
const $sheet=document.getElementById('sheetRoot');
function openEditor(id){
  const r=S.routines.find(x=>x.id===id), {from,...s}=r?schedOn(r,TODAY()):{type:'daily'};
  edit={id:r?.id??null,name:r?.name??'',emoji:r?.emoji??EMOJI[0],color:r?.color??COLORS[0],stopped:r?.stopped??null,
    sched:{days:[0,2,4],target:3,...(s.type==='off'?{type:'daily'}:JSON.parse(JSON.stringify(s)))}};
  confirmDel=false; sheetOpening=true; renderSheet(); setTimeout(()=>{const i=document.getElementById('rname');if(i&&!edit.id)i.focus()},50);
}
/* re-rendered on every change: slide in only when opening, and keep the scroll position */
function renderSheet(){
  fxRefresh();
  if(!edit){if(vac)renderVacSheet();else if(rule)renderRuleSheet();else $sheet.innerHTML='';return}
  const s=edit.sched, top=$sheet.querySelector('.sheet')?.scrollTop||0;
  $sheet.innerHTML=`<div class="overlay${sheetOpening?' opening':''}" data-act="closeBg"><div class="sheet" role="dialog" aria-modal="true" aria-label="${edit.id?'Edit routine':'New routine'}">
    <div class="grabber" aria-hidden="true"></div>
    <div class="sheethead"><button class="gbtn glass" data-act="close" aria-label="Cancel">${XMARK}</button><h2>${edit.id?'Edit routine':'New routine'}</h2><button class="gbtn prominent" data-act="saveR" aria-label="Save">${TICK}</button></div>
    <div class="gh"><label for="rname">Name</label></div>
    <div class="group"><input type="text" class="row inp" id="rname" maxlength="40" placeholder="e.g. Eat healthy" value="${esc(edit.name)}"></div>
    <div class="gh">Icon</div>
    <div class="group pad"><div class="picks">${EMOJI.map(e=>`<button class="emo" data-act="emo" data-v="${e}" aria-pressed="${edit.emoji===e}">${e}</button>`).join('')}</div></div>
    <div class="gh">Color</div>
    <div class="group pad"><div class="picks colors">${COLORS.map(c=>{const lk=fxLocked(c);return `<button class="sw${fx(c)}${lk?' locked':''}${fx(c)&&c===colPop?' pop':''}" style="--c:${c}" data-act="col" data-v="${c}" aria-pressed="${edit.color===c}" aria-label="${COLOR_NAMES[c]}${lk?', locked until Iron Will':''}">${lk?LOCK:''}</button>`}).join('')}</div></div>
    <p class="gf">${fxOn?'The neon colours are unlocked: your rank this month is Iron Will or higher.':'The neon colours unlock at Iron Will. Reach it this month to use them.'}</p>
    ${edit.stopped?`<div class="gh">How often</div><p class="gf first">Stopped ${short(edit.stopped)}. Resume tracking to change how often.</p>`:`<div class="gh">How often</div>
    <div class="group pad"><div class="seg" role="group" aria-label="How often">
      <button data-act="stype" data-v="daily" aria-pressed="${s.type==='daily'}">Mon – Fri</button>
      <button data-act="stype" data-v="days" aria-pressed="${s.type==='days'}">Some days</button>
      <button data-act="stype" data-v="weekly" aria-pressed="${s.type==='weekly'}">× per week</button></div>
      ${s.type==='days'?`<div class="daysrow">${DAYS1.map((d,i)=>i>=5?`<span class="dayc rest" role="img" aria-label="${DAYS[i]}, rest day">${d}</span>`:`<button class="dayc" data-act="day" data-v="${i}" aria-pressed="${s.days.includes(i)}" aria-label="${DAYS[i]}">${d}</button>`).join('')}</div>`:''}
      ${s.type==='weekly'?`<div class="stepper"><span><b class="num">${s.target}</b> ${s.target===1?'time':'times'} per week</span><span class="ctl"><button data-act="tgt" data-v="-1" aria-label="Fewer" ${s.target<=1?'disabled':''}>−</button><button data-act="tgt" data-v="1" aria-label="More" ${s.target>=5?'disabled':''}>+</button></span></div>`:''}
    </div>
    <p class="gf">Saturday and Sunday are always rest days.${edit.id?' Schedule changes apply from today. Past days keep their old schedule.':''}</p>`}
    <button class="primary" data-act="saveR">${edit.id?'Save changes':'Add routine'}</button>
    ${edit.id?`<div class="group"><button class="row link center" data-act="${edit.stopped?'resume':'stopR'}" data-id="${edit.id}">${edit.stopped?'Resume tracking':'Stop tracking'}</button></div>
    ${edit.stopped?'':'<p class="gf">Stopping keeps its history. You can resume it later.</p>'}
    <div class="group"><button class="row danger center" data-act="delR">${confirmDel?'Delete routine and all its history':'Delete routine'}</button></div>
    ${confirmDel?'<p class="gf">Tap again to delete it for good. This cannot be undone.</p>':''}`:''}
  </div></div>`;
  $sheet.querySelector('.sheet').scrollTop=top; sheetOpening=false;
}
function syncName(){const i=document.getElementById('rname');if(i&&edit)edit.name=i.value}

/* ---------- toast ---------- */
/* ---------- Wildcard: on Saturday or Sunday, finish what was missed this week ---------- */
/* closed: a card with the button (only if something was missed and a Wildcard is left). Open: the missed routines by day, each with a check button.
   A make-up counts for the day it was missed (logic.js makeUp). */
function wildcardSection(t){
  const miss=weekMissed(S,t), todo=miss.filter(x=>!x.done).length, left=wildcardsLeft(S,t);
  if(wildcardOpen(S,t)){
    const byDay={}; miss.forEach(x=>(byDay[x.k]??=[]).push(x));
    let h=`<div class="gh wch">${WILD(16)}Wildcard · this week</div>`;
    if(!miss.length) h+='<p class="gf first">Nothing to make up.</p>';
    h+=Object.entries(byDay).map(([k,items])=>{const day=DAYS_FULL[dow(parse(k))];return `<div class="gh">${day}</div><div class="group tiles">${items.map(({r,done})=>
      `<div class="row item${inkCls(shown(r.color))}${fx(r.color)}${done?' done':''}${popId===r.id+'@'+k?' pop':''}" style="--c:${shown(r.color)}"><div class="tile">${r.emoji}</div>
      <div class="body"><div class="name">${esc(r.name)}</div><div class="hint">${done?'Made up':'Missed on '+day}</div></div>
      <button class="check" data-act="makeup" data-id="${r.id}" data-k="${k}" aria-pressed="${done}" aria-label="Make up ${esc(r.name)} for ${day}"><span class="ci">${CHECK}</span></button></div>`).join('')}</div>`}).join('');
    if(miss.length&&!todo) h+='<p class="note">Week made up. Enjoy the rest of your weekend.</p>';
    return h;
  }
  if(!todo) return '';
  if(!left) return '<p class="gf wcnone">You missed some routines this week, but there are no Wildcards left this month. They come back on the 1st.</p>';
  return `<div class="wcard"><div class="wtop">${WILD(36)}<div><div class="wtitle">Wildcard</div>
    <div class="hint">You missed <span class="num">${todo}</span> routine${todo===1?'':'s'} this week. Use a Wildcard to finish ${todo===1?'it':'them'} this weekend. ${todo===1?'It counts':'They count'} for the day you missed ${todo===1?'it':'them'}.</div></div></div>
    <button class="primary" data-act="wildAsk">Use a Wildcard</button><p class="wleft"><span class="num">${left}</span> of <span class="num">${WILDCARDS_PER_MONTH}</span> left this month</p></div>`;
}
function askWildcard(){
  const t=TODAY(), todo=weekMissed(S,t).filter(x=>!x.done).length, left=wildcardsLeft(S,t);
  $done.innerHTML=`<div class="overlay center" data-act="doneBg"><div class="donecard" role="dialog" aria-modal="true" aria-labelledby="wcTitle" tabindex="-1">
    <div class="wicon">${WILD(56)}</div><h2 id="wcTitle">Use a Wildcard?</h2>
    <p>This unlocks the weekend so you can finish the <span class="num">${todo}</span> routine${todo===1?'':'s'} you missed this week. You have <span class="num">${left}</span> of <span class="num">${WILDCARDS_PER_MONTH}</span> left this month.</p>
    <button class="primary" data-act="wildUse">Use Wildcard</button><button class="row link center wcancel" data-act="done">Cancel</button></div></div>`;
  $done.querySelector('.donecard').focus({preventScroll:true});
}

/* ---------- Vacation: weekdays taken off, 10 per half-year (logic.js) ---------- */
const MON3=m=>MONTHS[m].slice(0,3);
const dm=d=>`${d.getDate()} ${MON3(d.getMonth())}`;
const halfEnd=d=>dm(half(d).end); // "30 Jun" or "31 Dec"
const newDaysOn=d=>`1 ${MONTHS[half(d).end.getMonth()+1]??'January'}`; // when the next 10 days come
/* days grouped into stretches; a weekend inside a stretch doesn't split it (Fri 25 – Mon 28 Dec is one stretch) */
function stretches(keys){
  const out=[];
  for(const k of [...keys].sort()){
    const d=parse(k), last=out[out.length-1];
    let n=last&&addDays(last.b,1); while(n&&isRest(n)) n=addDays(n,1);
    if(last&&+n===+d) last.b=d; else out.push({a:d,b:d});
  }
  return out;
}
const stretchText=({a,b},wd)=>{const f=d=>(wd?DAYS[dow(d)]+' ':'')+dm(d);
  return +a===+b?f(a):!wd&&a.getMonth()===b.getMonth()?`${a.getDate()}–${dm(b)}`:`${f(a)} – ${f(b)}`};
const andList=p=>p.length<2?p.join(''):p.slice(0,-1).join(', ')+' and '+p[p.length-1];
const daysText=keys=>andList(stretches(keys).map(s=>stretchText(s)));
/* the sky strip with the pelican gliding across it, on the card and on a vacation day */
const sky=()=>`<div class="vsky" aria-hidden="true"><span class="vfly">${flyingPelican()}</span>
  <svg class="vwave" viewBox="0 0 200 10" preserveAspectRatio="none"><path d="M0 6Q12.5 1 25 6T50 6T75 6T100 6T125 6T150 6T175 6T200 6"/></svg></div>`;

/* on weekdays, below the routines: days left this half, the next trip, and the button */
function vacationCard(t){
  const left=vacationsLeft(S,t), next=stretches(Object.keys(S.vacations||{}).filter(k=>k>key(t)))[0];
  return `<div class="vcard">${sky()}<div class="vtitle">Vacation</div>
    <div class="hint">${left?`<span class="num">${left}</span> of <span class="num">${VACATION_DAYS}</span> days left until ${halfEnd(t)}.`:`No vacation days left. ${VACATION_DAYS} new days on ${newDaysOn(t)}.`}${next?` Next: ${stretchText(next,true)}.`:''}</div>
    <button class="primary vbtn" data-act="vacOpen">Plan a vacation</button></div>`;
}
function vacationDay(d,isToday){
  const nw=nextWorkday(S,d), back=+nw===+addDays(d,1)?'tomorrow':`on ${DAYS_FULL[dow(nw)]} ${nw.getDate()} ${MONTHS[nw.getMonth()]}`;
  return `<div class="restcard vaccard">${sky()}<h3>Vacation day</h3>
    <p>${isToday?`Enjoy the break: there is nothing to check off. Your routines start again ${back}.`:'Nothing was due on this day.'}</p>
    ${isToday?`<button class="pill vcancel" data-act="vacCancelToday">Cancel today's vacation</button>`:''}</div>`;
}

/* the booking sheet: a month calendar from this month to the end of the next half-year. Tap free weekdays to pick them,
   tap a booked (blue) day to cancel it; nothing changes until Save and the confirm. */
let vac=null; // {m: the month shown, add: days picked, del: booked days to cancel, shake: a day tapped with none left}
function openVacation(){vac={m:monthStart(TODAY()),add:new Set(),del:new Set(),shake:null};sheetOpening=true;renderSheet()}
const sameHalf=(k,d)=>+half(parse(k)).start===+half(d).start;
/* what would be left in d's half after the picks and cancels */
const leftAfter=d=>vacationsLeft(S,d)-[...vac.add].filter(k=>sameHalf(k,d)).length+[...vac.del].filter(k=>sameHalf(k,d)).length;
function renderVacSheet(){
  const t=TODAY(), a=vac.m, b=new Date(a.getFullYear(),a.getMonth()+1,0), until=bookUntil(t), top=$sheet.querySelector('.sheet')?.scrollTop||0;
  let cells=DAYS1.map(x=>`<span class="h">${x}</span>`).join('')+'<span class="day blank"></span>'.repeat(dow(a));
  for(let d=a;d<=b;d=addDays(d,1)){
    const k=key(d), td=+d===+t?' today':'', lbl=`${d.getDate()} ${MONTHS[d.getMonth()]}`, n=d.getDate(), booked=isVacation(S,d);
    if(isRest(d)){cells+=`<span class="day rest${td}" role="img" aria-label="${lbl}, rest day">${n}</span>`;continue}
    if(d<t||d>until){cells+=`<span class="day future${booked?' vac':''}${td}" role="img" aria-label="${lbl}${booked?', vacation day':''}">${n}</span>`;continue}
    if(booked){const x=vac.del.has(k);
      cells+=`<button class="day vac${x?' vdel':''}${td}" data-act="vacPick" data-k="${k}" aria-pressed="${x}" aria-label="${lbl}, vacation day${x?', will be cancelled':''}">${n}</button>`;continue}
    if(canBook(S,k,t)==='checked'){cells+=`<span class="day future${td}" role="img" aria-label="${lbl}, already checked off">${n}</span>`;continue}
    const sel=vac.add.has(k);
    cells+=`<button class="day vopen${sel?' vsel':''}${vac.shake===k?' shake':''}${td}" data-act="vacPick" data-k="${k}" aria-pressed="${sel}" aria-label="${lbl}">${n}</button>`;
  }
  vac.shake=null;
  /* what is left in this half, and in any other half with changes */
  const halves=new Map([[+half(t).start,t]]); for(const k of [...vac.add,...vac.del]) halves.set(+half(parse(k)).start,parse(k));
  const counts=[...halves.values()].sort((x,y)=>x-y).map(d=>`<span class="num">${leftAfter(d)}</span> of <span class="num">${VACATION_DAYS}</span> left until ${halfEnd(d)}`).join(' · ');
  const na=vac.add.size, nd=vac.del.size, any=na||nd;
  const btn=na&&nd?'Save changes':na?`Take ${na} vacation day${na===1?'':'s'}`:nd?`Cancel ${nd} vacation day${nd===1?'':'s'}`:'Pick your days';
  const picked=[na?`<span class="num">${na}</span> picked`:'',nd?`<span class="num">${nd}</span> to cancel`:''].filter(Boolean).join(' · ');
  $sheet.innerHTML=`<div class="overlay${sheetOpening?' opening':''}" data-act="closeBg"><div class="sheet vsheet" role="dialog" aria-modal="true" aria-label="Plan a vacation">
    <div class="grabber" aria-hidden="true"></div>
    <div class="sheethead"><button class="gbtn glass" data-act="close" aria-label="Close">${XMARK}</button><h2>Vacation</h2><button class="gbtn prominent" data-act="vacSave" aria-label="Save" ${any?'':'disabled'}>${TICK}</button></div>
    <p class="gf first">Pick the weekdays you'll be away. They count like weekends: nothing is due, and your %, rank and streaks are safe.</p>
    <div class="rangehead"><button class="gbtn glass" data-act="vacPrevM" aria-label="Previous month" ${+a===+monthStart(t)?'disabled':''}>${CHEV_L}</button>
      <div class="lbl">${monthName(a)}</div><button class="gbtn glass" data-act="vacNextM" aria-label="Next month" ${+a===+monthStart(until)?'disabled':''}>${CHEV_R}</button></div>
    <div class="card"><div class="heat">${cells}</div>
      <div class="legend"><span class="lg"><i class="day vsel"></i>Picked</span><span class="lg"><i class="day vac"></i>Vacation</span><span class="lg"><i class="day rest"></i>Rest</span></div></div>
    <p class="vcount">${picked?picked+' · ':''}${counts}</p>
    <button class="primary" data-act="vacSave" ${any?'':'disabled'}>${btn}</button>
    <p class="gf">You get ${VACATION_DAYS} vacation days from January to June and ${VACATION_DAYS} from July to December. Days you don't use don't carry over. Tap a blue day to cancel it.</p>
  </div></div>`;
  $sheet.querySelector('.sheet').scrollTop=top; sheetOpening=false;
}
function pickVacation(k){
  const d=parse(k);
  if(isVacation(S,d)) vac.del.has(k)?vac.del.delete(k):vac.del.add(k);
  else if(vac.add.has(k)) vac.add.delete(k);
  else if(leftAfter(d)<=0){vac.shake=k;toast(`No days left until ${newDaysOn(d)}`)}
  else vac.add.add(k);
  renderSheet();
}
function askVacation(){
  const na=vac.add.size, nd=vac.del.size; if(!na&&!nd) return;
  const title=na&&nd?'Save changes?':na?`Take ${na} vacation day${na===1?'':'s'}?`:`Cancel ${nd} vacation day${nd===1?'':'s'}?`;
  const halves=new Map(); for(const k of [...vac.add,...vac.del]) halves.set(+half(parse(k)).start,parse(k));
  const after=andList([...halves.values()].sort((x,y)=>x-y).map((d,i)=>`<span class="num">${leftAfter(d)}</span> of <span class="num">${VACATION_DAYS}</span> ${i?'':'left '}until ${halfEnd(d)}`));
  $done.innerHTML=`<div class="overlay center" data-act="doneBg"><div class="donecard" role="dialog" aria-modal="true" aria-labelledby="vcTitle" tabindex="-1">
    <div class="vicon">${flyingPelican()}</div><h2 id="vcTitle">${title}</h2>
    <p>${na?`${daysText(vac.add)}.`:''}${na&&nd?' ':''}${nd?`Cancel ${daysText(vac.del)}.`:''} You'll have ${after}.</p>
    <button class="primary" data-act="vacConfirm">${na&&nd?'Save':na?'Take vacation':'Cancel vacation'}</button><button class="row link center wcancel" data-act="done">${nd&&!na?'Keep':'Not now'}</button></div></div>`;
  $done.querySelector('.donecard').focus({preventScroll:true});
}
function saveVacation(){
  const t=TODAY(), want=vac.add.size; let cancelled=0; const booked=[];
  for(const k of vac.del) if(cancelVacation(S,k,t)) cancelled++; // cancels first, so their days can be booked again
  for(const k of [...vac.add].sort()) if(bookVacation(S,k,t)) booked.push(k);
  commit(); closeDone(); vac=null; renderSheet(); render();
  if(booked.length) flyPelican(booked[0]);
  toast(booked.length<want?"Some days couldn't be booked":booked.length?'Vacation booked':`Vacation day${cancelled===1?'':'s'} cancelled`);
}
/* after booking: the card's pelican takes off and flies across the screen with the first day hanging from its bill. It never catches taps. */
function flyPelican(k){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const d=parse(k), el=document.createElement('div');
  el.className='vflight'; el.setAttribute('aria-hidden','true');
  el.innerHTML=`<div class="vf-path"><div class="vf-bird">${flyingPelican()}</div><span class="vf-tile"><i>${MON3(d.getMonth())}</i><b>${d.getDate()}</b></span></div>`;
  const from=$app.querySelector('.vcard .vfly')?.getBoundingClientRect(), W=innerWidth, H=innerHeight;
  const x0=from?.width?from.left:-150, y0=from?.width?from.top:H*.7;
  document.body.append(el); document.body.classList.add('vflying');
  const end=()=>{el.remove();document.body.classList.remove('vflying')};
  el.firstChild.animate([
    {transform:`translate(${x0}px,${y0}px) scale(.46) rotate(-4deg)`},
    {transform:`translate(${x0+W*.2}px,${y0-H*.14}px) scale(.85) rotate(-12deg)`,offset:.3},
    {transform:`translate(${W*.55}px,${H*.24}px) scale(1) rotate(3deg)`,offset:.68},
    {transform:`translate(${W+40}px,${H*.08}px) scale(1) rotate(-8deg)`}],
    {duration:2600,easing:'cubic-bezier(.45,0,.55,1)',fill:'forwards'}).finished.then(end,end);
}

/* ---------- Rank change: a full-screen animation whenever a tap moves this month's rank up or down ---------- */
/* The rank before and after each tick (or untick) are compared, so only a tap can set it off: opening the app, a new month,
   or the morning dip (today's routines count until they are ticked) never show it. */
const rankNow=()=>{const t=TODAY();return monthResult(S,monthStart(t),t).rank??-1};
/* {from, to} when the rank moved, else null */
const rankMove=(from,to)=>from!==to&&to>=0&&!(from<0&&to===0)?{from,to}:null;
let ruAt=0; // when the screen opened: taps in its first moments are ignored, so a double tap can't dismiss it unseen
/* Up: the old badge charges up and bursts, the screen flashes, the new badge slams in with shockwaves, sparks and turning rays.
   Down: the old badge cracks, loses its colour and falls, shards drop, the lower badge lands heavily.
   Then the name and the button. Under Reduce Motion it simply shows the new rank. */
function showRank({from,to},allDone){
  const down=from>=0&&to<from, t=TODAY(), r=RANKS[to], pct=pct1(monthResult(S,monthStart(t),t).pct), rnd=(a,b)=>a+Math.random()*(b-a);
  const sparks=[...Array(down?22:[24,24,26,30,40,40,56][to])].map((_,i)=>{const a=down?rnd(.35,2.8):rnd(0,6.283),d=down?rnd(120,320):rnd(110,to>=4?380:300);
    return `<i${i%4===0||down?' class="d"':''} style="--x:${(Math.cos(a)*d).toFixed(0)}px;--y:${(Math.sin(a)*d).toFixed(0)}px;--s:${rnd(3,9).toFixed(1)}px;--t:${rnd(.7,1.5).toFixed(2)}s;--dl:${rnd(0,.18).toFixed(2)}s${i%3===0&&!down?';--c:#fff':''}"></i>`}).join('');
  const embers=down?'':[...Array([0,0,0,10,18,18,30][to])].map((_,i)=>`<i style="--l:${rnd(2,98).toFixed(0)}%;--s:${rnd(2,to===6?6:5).toFixed(1)}px;--t:${rnd(4,8).toFixed(1)}s;--dl:${rnd(1.2,6).toFixed(1)}s;--dx:${rnd(-40,40).toFixed(0)}px${to===6&&i%2?';--c:#FFC24A':''}"></i>`).join('');
  const fx=down?{}:rankFx(to,rnd);
  $done.innerHTML=`<div class="rankup${down?' down':' up'} rk${to} ru${to}" data-act="rankBg" role="dialog" aria-modal="true" aria-labelledby="ruName" tabindex="-1">
    <i class="ru-flash"></i><span class="ru-embers" aria-hidden="true">${embers}</span><span class="ru-fx" aria-hidden="true">${fx.screen||''}</span>
    <div class="ru-stage">
      <div class="ru-emblem" aria-hidden="true"><i class="ru-rays"></i><i class="ru-halo"></i><i class="ru-ring"></i>${down?'':'<i class="ru-ring two"></i>'}${!down&&to>=4?'<i class="ru-ring three"></i>':''}${fx.back||''}
        ${from>=0?`<span class="ru-old">${art('badge',from)}</span>`:''}<span class="ru-new">${art('badge',to)}</span><span class="ru-sparks">${sparks}</span>${fx.front||''}</div>
      <div class="ru-kicker"><i></i>${down?'Rank down':'Rank up'}<i></i></div>
      ${r.title?`<div class="ru-title">${r.title}</div>`:''}<h2 class="ru-name" id="ruName">${r.name}</h2>
      <p class="ru-sub">${from>=0?`${RANKS[from].name} → ${r.name} · `:''}<span class="num">${pct}%</span> this month${down?'<br>Tick off your routines to climb back.':allDone?'<br>And all done for today.':''}</p>
      <button class="primary ru-btn" data-act="rankDone">Continue</button>
    </div></div>`;
  ruAt=Date.now();
  $done.firstChild.focus({preventScroll:true});
  try{setTimeout(()=>navigator.vibrate?.(down?[180]:[[60,40,140],[60,40,140],[60,40,140],[60,40,140],[50,30,50,30,220],[160],[80,40,80,40,320]][to]),900)}catch(e){}
}
/* each rank's own show on the way up, the higher the bigger. back: behind the badge, front: over it, screen: across the whole screen.
   Starter: dandelion seeds blow off the badge and drift by. Student: pages fly out, letters rise. Builder: a blueprint grid scans in, frame corners snap on.
   Iron Will: three forge strikes, a fountain of sparks, a steel glint. Stoic: aurora, a mandala draws itself, ripples like still water.
   The Chosen: light gathers into the badge, a red flash, a pillar of light comes down, lightning, gold rays, an orbit of diamonds. */
const SEED=`<svg viewBox="-10 -10 20 30"><path d="M0 0V19" stroke="currentColor" stroke-width="1"/><path d="${[...Array(9)].map((_,i)=>{const a=(-160+i*17.5)*Math.PI/180;return `M0 0L${(Math.cos(a)*8).toFixed(1)} ${(Math.sin(a)*8).toFixed(1)}`}).join('')}" stroke="currentColor" stroke-width=".7"/></svg>`;
const BOLT='<svg viewBox="0 0 46 96"><path d="M30 0L6 52h16L12 96 42 36H25L36 0z" fill="currentColor"/></svg>';
const MANDALA=`<svg viewBox="-100 -100 200 200"><circle r="96" pathLength="1"/><circle r="78" pathLength="1"/><path d="M0-78L67.5 39H-67.5Z" pathLength="1"/><path d="M0 78L67.5-39H-67.5Z" pathLength="1"/>
  <path d="${[...Array(24)].map((_,i)=>{const a=i*Math.PI/12,c=Math.cos(a),s=Math.sin(a);return `M${(c*83).toFixed(1)} ${(s*83).toFixed(1)}L${(c*91).toFixed(1)} ${(s*91).toFixed(1)}`}).join('')}" pathLength="1"/></svg>`;
function rankFx(to,rnd){
  const n=(k,f)=>[...Array(k)].map((_,i)=>f(i)).join(''), px=v=>v.toFixed(0)+'px';
  if(to===1) return {
    back:n(22,()=>`<i class="fx-seed" style="--x:${px(rnd(-60,280))};--y:${px(rnd(-330,-50))};--r:${rnd(-220,220).toFixed(0)}deg;--t:${rnd(2.4,4.4).toFixed(1)}s;--dl:${rnd(.92,1.3).toFixed(2)}s">${SEED}</i>`),
    screen:n(9,()=>`<i class="fx-drift" style="--top:${rnd(4,70).toFixed(0)}%;--dy:${px(rnd(-140,60))};--t:${rnd(7,12).toFixed(1)}s;--dl:${rnd(1.6,8).toFixed(1)}s">${SEED}</i>`)};
  if(to===2){ const G='AΣπΩ∞√λ∂ƒ★∑abc';
    return {back:n(10,()=>{const a=rnd(0,6.283),d=rnd(150,270);return `<i class="fx-page" style="--x:${px(Math.cos(a)*d)};--y:${px(Math.sin(a)*d)};--r:${rnd(-70,70).toFixed(0)}deg;--dl:${rnd(.9,1.05).toFixed(2)}s"></i>`}),
      screen:n(18,()=>`<i class="fx-glyph" style="--l:${rnd(4,96).toFixed(0)}%;--s:${px(rnd(14,28))};--t:${rnd(5,9).toFixed(1)}s;--dl:${rnd(1.2,7).toFixed(1)}s">${G[Math.floor(rnd(0,G.length))]}</i>`)}; }
  if(to===3) return {screen:'<i class="fx-grid"></i><i class="fx-scan"></i>',back:n(4,i=>`<i class="fx-corner c${i}"></i>`)};
  if(to===4) return {
    back:n(3,i=>`<i class="fx-strike" style="--dl:${[.28,.52,.76][i]}s"></i>`)+n(40,()=>`<i class="fx-molten" style="--x:${px(rnd(-190,190))};--h:${px(rnd(-340,-140))};--s:${rnd(2,5).toFixed(1)}px;--t:${rnd(1.2,2.1).toFixed(2)}s;--dl:${rnd(.92,4).toFixed(2)}s"></i>`),
    screen:'<i class="fx-glint"></i>'};
  if(to===5) return {screen:n(3,i=>`<i class="fx-aurora a${i}"></i>`),back:`<span class="fx-mandala">${MANDALA}</span>`+n(4,i=>`<i class="fx-ripple" style="--dl:${(.95+i*.9).toFixed(2)}s"></i>`)};
  if(to===6) return {
    screen:'<i class="fx-redflash"></i>',
    back:n(36,()=>{const a=rnd(0,6.283),d=rnd(260,520);return `<i class="fx-conv" style="--x:${px(Math.cos(a)*d)};--y:${px(Math.sin(a)*d)};--s:${rnd(2,5).toFixed(1)}px;--dl:${rnd(0,.2).toFixed(2)}s"></i>`})
      +'<i class="fx-pillar"></i><i class="fx-rays2"></i>'+`<span class="fx-orbit">${n(8,i=>`<i style="--a:${i*45}deg;--d:${(i*.2).toFixed(1)}s"></i>`)}</span>`,
    front:n(3,i=>`<i class="fx-bolt b${i}">${BOLT}</i>`)};
  return {};
}
/* on a local preview only: lets the demo panel play any rank's screen */
if(/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) window.keptRankDemo=(from,to)=>showRank({from,to},false);

/* ---------- "All done" pop-up, when the last routine for today is checked off ---------- */
/* the dandelion blows inside the card, then how many routines were kept; Done closes it, and so do a tap outside and Escape */
const $done=document.getElementById('doneRoot');
function showDone(count){
  $done.innerHTML=`<div class="overlay center" data-act="doneBg"><div class="donecard" role="dialog" aria-modal="true" aria-labelledby="doneTitle" tabindex="-1">
    <div class="dslot"></div><h2 id="doneTitle">All done for today</h2>
    <p>You kept ${count===1?'your routine':`all <span class="num">${count}</span> routines`}. See you tomorrow.</p>
    <button class="primary" data-act="done">Done</button></div></div>`;
  $done.querySelector('.dslot').append(doneDandelion());
  $done.querySelector('.donecard').focus({preventScroll:true}); // into the dialog, without outlining the button
}
function closeDone(){$done.innerHTML=''}

let tt; function toast(m){const t=document.getElementById('toast');t.textContent=m;t.hidden=false;clearTimeout(tt);tt=setTimeout(()=>t.hidden=true,1800)}

/* ---------- events ---------- */
document.addEventListener('click',e=>{
  const tab=e.target.closest('[data-tab]'); if(tab){view=tab.dataset.tab;confirmClear=false;if(view==='today')viewDate=TODAY();render();window.scrollTo(0,0);return}
  const el=e.target.closest('[data-act]'); if(!el)return;
  const a=el.dataset.act;
  if((a==='closeBg'||a==='doneBg'||a==='rankBg')&&e.target!==el)return;
  switch(a){
    case 'toggle': { if(+viewDate!==+TODAY()||isOff(S,viewDate)){toast(isVacation(S,viewDate)?'This is a vacation day':'Only today can be checked off');render();break}
      const id=el.dataset.id,k=key(viewDate),before=rankNow(); toggle(S,id,k); commit();
      const ticked=isDone(S,{id},k), move=rankMove(before,rankNow());
      if(ticked) popId=id;
      render();
      const due=S.routines.filter(r=>isDue(r,viewDate,S)), allDone=ticked&&due.every(r=>isDone(S,r,k));
      if(move) showRank(move,allDone); else if(allDone) showDone(due.length); // a rank change comes first; else, if that was the last one for today, "All done"
      break; }
    case 'prevDay': viewDate=addDays(viewDate,-1); ringFrac=null; render(); break;
    case 'nextDay': if(viewDate<TODAY())viewDate=addDays(viewDate,1); ringFrac=null; render(); break;
    case 'goToday': viewDate=TODAY(); ringFrac=null; render(); break;
    case 'openDay': viewDate=parse(el.dataset.k); view='today'; ringFrac=null; render(); window.scrollTo(0,0); break;
    case 'mode': statMode=el.dataset.m; render(); break;
    case 'openRanks': view='ranks'; render(); window.scrollTo(0,0); break;    case 'openMonth': monthRef=parse(el.dataset.k); statMode='month'; view='stats'; render(); window.scrollTo(0,0); break;
    case 'prevW': weekRef=addDays(weekRef,-7); render(); break;
    case 'nextW': weekRef=addDays(weekRef,7); render(); break;
    case 'prevM': monthRef=new Date(monthRef.getFullYear(),monthRef.getMonth()-1,1); render(); break;
    case 'nextM': monthRef=new Date(monthRef.getFullYear(),monthRef.getMonth()+1,1); render(); break;
    case 'new': openEditor(null); break;
    case 'edit': openEditor(el.dataset.id); break;
    case 'close': case 'closeBg': edit=null; vac=null; rule=null; renderSheet(); break;
    case 'openRules': view='rules'; render(); window.scrollTo(0,0); break;
    case 'rulesBack': view='settings'; render(); window.scrollTo(0,0); break;
    case 'newRule': openRule(null); break;
    case 'editRule': openRule(el.dataset.id); break;
    case 'ruleRoutine': syncRule(); rule.routine=el.dataset.id; renderSheet(); break;
    case 'saveRule': saveRule(); break;
    case 'delRule': if(!confirmRuleDel){confirmRuleDel=true;syncRule();renderSheet();break}
      S.rules=(S.rules||[]).filter(x=>x.id!==rule.id); commit(); rule=null; renderSheet(); render(); toast('Rule deleted'); break;
    case 'done': case 'doneBg': closeDone(); break;
    case 'rankDone': case 'rankBg': if(Date.now()-ruAt>1600) closeDone(); break;
    case 'wildAsk': askWildcard(); break;
    case 'vacOpen': openVacation(); break;
    case 'vacPick': pickVacation(el.dataset.k); break;
    case 'vacPrevM': vac.m=new Date(vac.m.getFullYear(),vac.m.getMonth()-1,1); renderSheet(); break;
    case 'vacNextM': vac.m=new Date(vac.m.getFullYear(),vac.m.getMonth()+1,1); renderSheet(); break;
    case 'vacSave': askVacation(); break;
    case 'vacConfirm': saveVacation(); break;
    case 'vacCancelToday': { const t=TODAY(); if(cancelVacation(S,key(t),t)){commit();toast('Vacation day cancelled')} ringFrac=null; render(); break; }
    case 'wildUse': { const ok=useWildcard(S,TODAY()); closeDone(); if(ok){commit();toast('Weekend unlocked')} else toast("A Wildcard can't be used now"); render(); break; }
    case 'makeup': { const id=el.dataset.id,k=el.dataset.k,t=TODAY(),before=rankNow();
      if(!makeUp(S,id,k,t)){toast('This weekend is not unlocked');render();break}
      commit(); if(isMadeUp(S,id,k)) popId=id+'@'+k; render();
      if(weekMissed(S,t).every(x=>x.done)) toast('Week made up');
      const move=rankMove(before,rankNow()); if(move) showRank(move,false); break; }
    case 'emo': syncName(); edit.emoji=el.dataset.v; renderSheet(); break;
    case 'col': { const c=el.dataset.v; if(fxLocked(c)){toast('Reach Iron Will this month to unlock this colour');break}
      syncName(); edit.color=c; colPop=c; renderSheet(); colPop=null; break; }
    case 'stype': syncName(); edit.sched.type=el.dataset.v; renderSheet(); break;
    case 'day': { syncName(); const i=+el.dataset.v, d=edit.sched.days; if(i>=5) break; const p=d.indexOf(i); if(p>=0){if(d.length>1)d.splice(p,1)}else d.push(i); renderSheet(); break; }
    case 'tgt': syncName(); edit.sched.target=Math.min(5,Math.max(1,edit.sched.target+ +el.dataset.v)); renderSheet(); break;
    case 'saveR': {
      syncName(); const name=edit.name.trim();
      if(!name){toast('Give the routine a name');document.getElementById('rname').focus();break}
      const s=edit.sched, sched=s.type==='days'?{type:'days',days:s.days.slice().sort()}:s.type==='weekly'?{type:'weekly',target:s.target}:{type:'daily'};
      if(edit.id){const r=S.routines.find(x=>x.id===edit.id);Object.assign(r,{name,emoji:edit.emoji,color:edit.color});if(!r.stopped)changeSchedule(r,sched,TODAY());toast('Routine saved')}
      else{const k=key(TODAY());S.routines.push({id:'r_'+Date.now().toString(36),name,emoji:edit.emoji,color:edit.color,created:k,stopped:null,schedules:[{from:k,...sched}]});toast('Routine added')}
      commit(); edit=null; renderSheet(); render(); break;
    }
    case 'stopR': { const r=S.routines.find(x=>x.id===el.dataset.id); stopRoutine(r,TODAY()); commit(); edit=null; renderSheet(); render(); toast('Stopped. Its history is kept.'); break; }
    case 'resume': { const r=S.routines.find(x=>x.id===el.dataset.id); resumeRoutine(r,TODAY()); commit(); edit=null; renderSheet(); render(); toast('Tracking again from today'); break; }
    case 'delR':
      if(!confirmDel){confirmDel=true;syncName();renderSheet();break}
      S.routines=S.routines.filter(r=>r.id!==edit.id); S.rules=(S.rules||[]).filter(x=>x.routine!==edit.id); // its rules go with it
      for(const k in S.checks){S.checks[k]=S.checks[k].filter(id=>id!==edit.id);if(!S.checks[k].length)delete S.checks[k]}
      commit(); edit=null; renderSheet(); render(); toast('Routine deleted'); break;
    case 'theme': { const dark=!isDark(); el.setAttribute('aria-checked',dark); setMeta({theme:dark?'dark':'light'}); applyTheme(); setTimeout(render,220); break; } // let the switch slide first
    case 'themeAuto': setMeta({theme:null}); applyTheme(); render(); break;
    case 'saveBackup': saveBackup(); break;
    case 'later': setMeta({reminderDismissedOn:key(TODAY())}); render(); break;
    case 'confirmRestore': S=pendingRestore; pendingRestore=null; commit(); toast('Backup restored'); view='today'; viewDate=TODAY(); render(); window.scrollTo(0,0); break;
    case 'cancelRestore': pendingRestore=null; render(); break;
    case 'clear': if(!confirmClear){confirmClear=true;render();break}
      eraseAll(); S=empty(); meta=loadMeta(); applyTheme(); confirmClear=false; toast('All data erased'); render(); break;
  }
});
document.addEventListener('keydown',e=>{if(e.key!=='Escape')return; if($done.firstChild)closeDone(); else if(edit||vac||rule){edit=null;vac=null;rule=null;renderSheet()}});

/* ---------- backup and restore ---------- */
/* the share sheet on iPhone (Save to Files or iCloud Drive), a download elsewhere. Only a finished share or download counts as a backup. */
async function saveBackup(){
  const file=backupFile(S);
  if(navigator.canShare?.({files:[file]})){
    try{await navigator.share({files:[file]})}catch(e){return} // cancelled: not a backup
  } else {
    const a=document.createElement('a'); a.href=URL.createObjectURL(file); a.download=file.name; a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  }
  setMeta({lastBackupAt:new Date().toISOString()}); toast('Backup saved'); render();
}
/* the rule's character count, live as you type */
document.addEventListener('input',e=>{if(e.target.id!=='rtext')return;const c=document.getElementById('rcount');if(c)c.textContent=e.target.value.length;if(rule)rule.text=e.target.value});
document.addEventListener('change',async e=>{
  if(e.target.id!=='restoreFile'||!e.target.files[0]) return;
  const d=readBackup(await e.target.files[0].text());
  if(!d){toast("That file isn't a Kept backup");e.target.value='';return}
  pendingRestore=d; render();
});
/* the top bar turns to glass once content scrolls under it, like iOS */
addEventListener('scroll',()=>document.body.classList.toggle('scrolled',scrollY>2),{passive:true});
/* when the app is reopened on a new day, move to the new today (yesterday becomes locked) */
let lastDay=key(TODAY());
document.addEventListener('visibilitychange',()=>{if(document.hidden)return;const k=key(TODAY());if(k!==lastDay){if(key(viewDate)===lastDay)viewDate=TODAY();lastDay=k;render()}});
applyTheme();
systemDark.addEventListener('change',()=>{applyTheme();if(view==='settings')render()}); // the device switched while Kept follows it
render();
loadArt();
if(loaded.error) toast("Couldn't read your saved data. A copy was set aside.");
startWater(document.getElementById('water'),{pelicanSky:()=>isVacation(S,TODAY())}); // on a vacation day a pelican crosses the sky
/* offline support; the service worker also brings updates in the next time the app opens online */
if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});