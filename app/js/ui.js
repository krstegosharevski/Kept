/* Kept UI: rendering and events. Rules and stats live in logic.js, storage in store.js. */
import {key,parse,addDays,dow,isRest,weekStart,TODAY,minD,normalize,isDue,isDone,toggle,rangeStats,dayRatio,level,weekDone,streaks} from './logic.js';
import {load,save} from './store.js';

const COLORS=['#1F9D74','#2E7DD7','#7B5CD6','#3A9FB0','#D9822B','#C2417A'];
const EMOJI=['🥗','🏋️','📖','💧','📞','🧘','🛏️','🚶','✍️','🎸','🧹','☀️','🍎','📵','🧠','🌱'];
const DAYS=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const DAYS1=['M','T','W','T','F','S','S'];
const DAYS_FULL=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];

const empty=()=>({schema:1,routines:[],checks:{}});
let S=load()||empty();
let view='today', viewDate=TODAY(), statMode='week', weekRef=weekStart(TODAY()), monthRef=new Date(TODAY().getFullYear(),TODAY().getMonth(),1);
let edit=null, confirmDel=false, confirmClear=false;

function schedText(r,d){
  const s=r.sched;
  if(s.type==='daily') return 'Mon – Fri';
  if(s.type==='days') return s.days.length>=5?'Mon – Fri':s.days.slice().sort().map(i=>DAYS[i]).join(' · ');
  return d?`${weekDone(S,r,d)} of ${s.target} this week`:`${s.target}× per week`;
}

/* ---------- render ---------- */
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const CHECK='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';
const MOON='<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>';
const LOCK='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
const $app=document.getElementById('app');

function ring(done,total){
  const r=24,c=2*Math.PI*r,f=total?done/total:0;
  return `<svg class="ring" width="64" height="64" viewBox="0 0 64 64" role="img" aria-label="${done} of ${total} done">
  <circle cx="32" cy="32" r="${r}" fill="none" stroke="var(--heat-empty)" stroke-width="7"/>
  <circle cx="32" cy="32" r="${r}" fill="none" stroke="var(--accent)" stroke-width="7" stroke-linecap="round"
    stroke-dasharray="${c}" stroke-dashoffset="${c*(1-f)}" transform="rotate(-90 32 32)" style="transition:stroke-dashoffset .4s"/>
  <text x="32" y="37" text-anchor="middle" font-size="14">${done}/${total}</text></svg>`;
}

function renderToday(){
  const t=TODAY(),d=viewDate,k=key(d),isToday=+d===+t,past=d<t,rest=isRest(d);
  const due=S.routines.filter(r=>isDue(r,d));
  const done=due.filter(r=>isDone(S,r,k)).length;
  const label=isToday?'Today':(+d===+addDays(t,-1)?'Yesterday':DAYS_FULL[dow(d)]);
  let html=`<header class="top"><div class="titles"><div class="eyebrow">${label}</div><h1>${d.getDate()} ${MONTHS[d.getMonth()]}</h1>
    <div class="datenav" style="margin-top:8px"><button class="iconbtn" data-act="prevDay" aria-label="Previous day">‹</button>
    <button class="iconbtn" data-act="nextDay" aria-label="Next day" ${isToday?'disabled':''}>›</button>
    ${isToday?'':'<button class="edit" data-act="goToday">Back to today</button>'}</div></div>${rest?`<div class="restbadge" aria-hidden="true">${MOON}</div>`:ring(done,due.length)}</header>`;
  if(rest){
    html+=`<div class="restcard">${MOON}<h3>Rest day</h3><p>Saturdays and Sundays are for resting, so there is nothing to check off.${isToday?' Your routines start again on Monday.':''}</p></div>`;
  } else if(!S.routines.length){
    html+=`<div class="empty"><h3>No routines yet</h3><p>Add your first one, like “Eat healthy”, and tick it off each day.</p><button class="primary" data-act="new">Add a routine</button></div>`;
  } else if(!due.length){
    html+=`<div class="empty"><h3>Nothing scheduled</h3><p>No routines are due on this day.</p></div>`;
  } else {
    if(past) html+=`<div class="lockline">${LOCK}Past day, view only. You can only check off today.</div>`;
    html+='<div class="list">'+due.map(r=>{const dn=isDone(S,r,k);
      const hint=past?(dn?'Completed':(r.sched.type==='weekly'?'Not done':'Missed')):schedText(r,d);
      const ctl=past?`<div class="status" role="img" aria-label="${dn?'Completed':'Not completed'}">${dn?CHECK:''}</div>`
        :`<button class="check" data-act="toggle" data-id="${r.id}" aria-pressed="${dn}" aria-label="Mark ${esc(r.name)} done">${CHECK}</button>`;
      return `<div class="item${dn?' done':''}${past?' locked':''}${past&&!dn&&r.sched.type!=='weekly'?' missed':''}" style="--c:${r.color}">
      <div class="tile">${r.emoji}</div><div class="body"><div class="name">${esc(r.name)}</div><div class="hint">${hint}</div></div>${ctl}</div>`}).join('')+'</div>';
    if(done===due.length) html+=`<p class="muted" style="text-align:center;margin-top:18px">${isToday?'All done for today. Nice work.':'Everything was done on this day.'}</p>`;
  }
  $app.innerHTML=html;
}

function renderRoutines(){
  let html=`<header class="top"><div class="titles"><div class="eyebrow">${S.routines.length} active · weekends off</div><h1>Routines</h1></div></header>`;
  html+='<div class="list">'+S.routines.map(r=>`<button class="item" style="--c:${r.color}" data-act="edit" data-id="${r.id}">
    <div class="tile">${r.emoji}</div><div class="body"><div class="name">${esc(r.name)}</div><div class="hint">${schedText(r)}</div></div>
    <span class="edit">Edit</span></button>`).join('')+'</div>';
  html+=`<div class="section"><button class="primary" data-act="new">+ New routine</button></div>`;
  $app.innerHTML=html;
}

function renderStats(){
  const t=TODAY();
  let html=`<header class="top"><div class="titles"><div class="eyebrow">Progress</div><h1>Statistics</h1></div></header>
  <div class="seg" role="group"><button data-act="mode" data-m="week" aria-pressed="${statMode==='week'}">Week</button><button data-act="mode" data-m="month" aria-pressed="${statMode==='month'}">Month</button></div>`;
  if(!S.routines.length){$app.innerHTML=html+'<div class="empty"><h3>No data yet</h3><p>Add routines and check them off to see stats here.</p></div>';return}
  if(statMode==='week'){
    const a=weekRef,b=addDays(a,6),bEff=minD(b,t);
    const st=rangeStats(S,a,bEff);
    const isCur=+a===+weekStart(t);
    html+=`<div class="rangehead"><button class="iconbtn" data-act="prevW" aria-label="Previous week">‹</button>
      <div class="lbl">${isCur?'This week':`${a.getDate()} ${MONTHS[a.getMonth()].slice(0,3)} – ${b.getDate()} ${MONTHS[b.getMonth()].slice(0,3)}`}</div>
      <button class="iconbtn" data-act="nextW" aria-label="Next week" ${isCur?'disabled':''}>›</button></div>
    <div class="card"><div class="bigpct"><span class="v">${Math.round(st.pct*100)}%</span><span class="muted">completed</span></div>
    <div class="bars">${[...Array(7)].map((_,i)=>{const d=addDays(a,i),td=+d===+t?' today':'';
      if(isRest(d)) return `<div class="bar rest${td}"><span class="p"></span><div class="cw"><div class="col" style="height:100%"><span>Rest</span></div></div><span class="d">${DAYS1[i]}</span></div>`;
      const fut=d>t,v=fut?null:dayRatio(S,d),h=v==null?0:Math.round(v*100);
      return `<div class="bar${fut?' future':''}${td}"><span class="p num">${fut||v==null?'':h+'%'}</span><div class="cw"><div class="col" style="height:${fut?4:Math.max(3,h)}%"></div></div><span class="d">${DAYS1[i]}</span></div>`}).join('')}</div></div>
    <div class="section"><h2>By routine</h2><div class="card list" style="gap:16px">${st.per.map(({r,e,d})=>`<div class="rstat" style="--c:${r.color}">
      <div class="tile">${r.emoji}</div><div class="nm">${esc(r.name)}</div><div class="pc">${d}/${r.sched.type==='weekly'?r.sched.target:e}</div>
      <div class="dots">${[...Array(7)].map((_,i)=>{const dd=addDays(a,i);if(isRest(dd))return '<i class="rest"></i>';if(dd>t||!isDue(r,dd))return '<i class="off"></i>';return `<i class="${isDone(S,r,key(dd))?'on':''}"></i>`}).join('')}</div></div>`).join('')}</div></div>`;
  } else {
    const a=monthRef,b=new Date(a.getFullYear(),a.getMonth()+1,0),bEff=minD(b,t);
    const st=rangeStats(S,a,bEff);
    const isCur=a.getFullYear()===t.getFullYear()&&a.getMonth()===t.getMonth();
    const off=dow(a);
    let cells=DAYS1.map(x=>`<span class="h">${x}</span>`).join('')+'<span class="cell blank"></span>'.repeat(off);
    for(let d=a;d<=b;d=addDays(d,1)){const td=+d===+t?' today':'';
      if(isRest(d)){cells+=`<span class="cell rest${td}" role="img" aria-label="${d.getDate()} ${MONTHS[d.getMonth()]}, rest day">${d.getDate()}</span>`;continue}
      const fut=d>t,lv=fut?0:level(dayRatio(S,d));
      cells+=`<button class="cell l${lv}${fut?' future':''}${td}" ${fut?'disabled':`data-act="openDay" data-k="${key(d)}"`} aria-label="${d.getDate()} ${MONTHS[d.getMonth()]}">${d.getDate()}</button>`}
    html+=`<div class="rangehead"><button class="iconbtn" data-act="prevM" aria-label="Previous month">‹</button>
      <div class="lbl">${MONTHS[a.getMonth()]} ${a.getFullYear()}</div>
      <button class="iconbtn" data-act="nextM" aria-label="Next month" ${isCur?'disabled':''}>›</button></div>
    <div class="card"><div class="bigpct"><span class="v">${Math.round(st.pct*100)}%</span><span class="muted">completed this month</span></div>
    <div class="heat">${cells}</div>
    <div class="legend">Less <i style="background:var(--heat-empty)"></i><i class="cell l1" style="width:12px;height:12px;border-radius:3px"></i><i class="cell l2" style="width:12px;height:12px;border-radius:3px"></i><i class="cell l3" style="width:12px;height:12px;border-radius:3px"></i><i style="background:var(--accent)"></i> More<i style="background:var(--rest);margin-left:12px"></i> Rest</div>
    <p class="muted" style="font-size:13px;margin:8px 0 0">Tap a day to see what you did. Black days are rest days.</p></div>
    <div class="section"><h2>By routine</h2><div class="card list" style="gap:16px">${st.per.map(({r,e,d,pct})=>{const s=streaks(S,r,t);return `<div class="rstat" style="--c:${r.color}">
      <div class="tile">${r.emoji}</div><div class="nm">${esc(r.name)}</div><div class="pc">${Math.round(pct*100)}%</div>
      <div class="track"><span style="width:${Math.round(pct*100)}%"></span></div>
      <div class="meta"><span class="num">${d}</span> of <span class="num">${e}</span> · streak <span class="num">${s.cur}${s.unit}</span> · best <span class="num">${s.best}${s.unit}</span></div></div>`}).join('')}</div></div>`;
  }
  $app.innerHTML=html;
}

function renderSettings(){
  $app.innerHTML=`<header class="top"><div class="titles"><div class="eyebrow">App</div><h1>Settings</h1></div></header>
  <div class="section"><h2>Backup</h2><p class="muted" style="margin:0">Your data lives only on this device. Copy the backup code and keep it somewhere safe.</p>
    <button class="ghost" data-act="showBackup">Show backup code</button>
    <div id="backupBox" hidden class="field"><textarea id="backupText" readonly></textarea><button class="ghost" data-act="copyBackup">Copy</button></div></div>
  <div class="section"><h2>Restore</h2><div class="field"><label for="restoreText">Paste a backup code</label><textarea id="restoreText" placeholder='{"routines":[...]}'></textarea></div>
    <button class="ghost" data-act="restore">Restore from code</button></div>
  <div class="section"><h2>Data</h2>
    <button class="ghost danger" data-act="clear">${confirmClear?'Tap again to erase everything':'Erase all data'}</button></div>
  <p class="muted" style="font-size:13px;margin-top:24px">Kept</p>`;
}

function render(){
  document.querySelectorAll('#tabs button').forEach(b=>b.setAttribute('aria-current',b.dataset.tab===view?'page':'false'));
  ({today:renderToday,routines:renderRoutines,stats:renderStats,settings:renderSettings})[view]();
}

/* ---------- editor sheet ---------- */
const $sheet=document.getElementById('sheetRoot');
function openEditor(id){
  const r=S.routines.find(x=>x.id===id);
  edit=r?JSON.parse(JSON.stringify(r)):{id:null,name:'',emoji:EMOJI[0],color:COLORS[0],sched:{type:'daily'}};
  if(!edit.sched.days)edit.sched.days=[0,2,4];
  if(!edit.sched.target)edit.sched.target=3;
  confirmDel=false; renderSheet(); setTimeout(()=>{const i=document.getElementById('rname');if(i&&!edit.id)i.focus()},50);
}
function renderSheet(){
  if(!edit){$sheet.innerHTML='';return}
  const s=edit.sched;
  $sheet.innerHTML=`<div class="overlay" data-act="closeBg"><div class="sheet" role="dialog" aria-modal="true" aria-label="${edit.id?'Edit routine':'New routine'}">
    <div class="row"><button class="edit" data-act="close">Cancel</button><h2>${edit.id?'Edit routine':'New routine'}</h2><button class="edit" data-act="saveR" style="color:var(--accent)">Save</button></div>
    <div class="field"><label for="rname">Name</label><input type="text" id="rname" maxlength="40" placeholder="e.g. Eat healthy" value="${esc(edit.name)}"></div>
    <div class="field"><span class="lab">Icon</span><div class="picks">${EMOJI.map(e=>`<button class="emo" data-act="emo" data-v="${e}" aria-pressed="${edit.emoji===e}">${e}</button>`).join('')}</div></div>
    <div class="field"><span class="lab">Color</span><div class="picks">${COLORS.map(c=>`<button class="sw" style="--c:${c}" data-act="col" data-v="${c}" aria-pressed="${edit.color===c}" aria-label="Color ${c}"></button>`).join('')}</div></div>
    <div class="field"><span class="lab">How often</span><div class="seg">
      <button data-act="stype" data-v="daily" aria-pressed="${s.type==='daily'}">Mon – Fri</button>
      <button data-act="stype" data-v="days" aria-pressed="${s.type==='days'}">Some days</button>
      <button data-act="stype" data-v="weekly" aria-pressed="${s.type==='weekly'}">× per week</button></div>
      ${s.type==='days'?`<div class="picks" style="justify-content:space-between;margin-top:8px">${DAYS1.map((d,i)=>i>=5?`<span class="dayc rest" role="img" aria-label="${DAYS[i]}, rest day">${d}</span>`:`<button class="dayc" data-act="day" data-v="${i}" aria-pressed="${s.days.includes(i)}" aria-label="${DAYS[i]}">${d}</button>`).join('')}</div>`:''}
      ${s.type==='weekly'?`<div class="stepper" style="margin-top:8px"><button class="iconbtn" data-act="tgt" data-v="-1" aria-label="Fewer">−</button><span class="v">${s.target}</span><button class="iconbtn" data-act="tgt" data-v="1" aria-label="More">+</button><span class="muted">times per week</span></div>`:''}
      <p class="muted" style="font-size:13px;margin:4px 0 0">Saturday and Sunday are always rest days.</p>
    </div>
    <button class="primary" data-act="saveR">${edit.id?'Save changes':'Add routine'}</button>
    ${edit.id?`<button class="ghost danger" data-act="delR">${confirmDel?'Tap again to delete with its history':'Delete routine'}</button>`:''}
  </div></div>`;
}
function syncName(){const i=document.getElementById('rname');if(i&&edit)edit.name=i.value}

/* ---------- toast ---------- */
let tt; function toast(m){const t=document.getElementById('toast');t.textContent=m;t.hidden=false;clearTimeout(tt);tt=setTimeout(()=>t.hidden=true,1800)}

/* ---------- events ---------- */
document.addEventListener('click',e=>{
  const tab=e.target.closest('[data-tab]'); if(tab){view=tab.dataset.tab;confirmClear=false;if(view==='today')viewDate=TODAY();render();window.scrollTo(0,0);return}
  const el=e.target.closest('[data-act]'); if(!el)return;
  const a=el.dataset.act;
  if(a==='closeBg'&&e.target!==el)return;
  switch(a){
    case 'toggle': if(+viewDate!==+TODAY()||isRest(viewDate)){toast('Only today can be checked off');render();break}
      toggle(S,el.dataset.id,key(viewDate)); save(S); render(); break;
    case 'prevDay': viewDate=addDays(viewDate,-1); render(); break;
    case 'nextDay': if(viewDate<TODAY())viewDate=addDays(viewDate,1); render(); break;
    case 'goToday': viewDate=TODAY(); render(); break;
    case 'openDay': viewDate=parse(el.dataset.k); view='today'; render(); window.scrollTo(0,0); break;
    case 'mode': statMode=el.dataset.m; render(); break;
    case 'prevW': weekRef=addDays(weekRef,-7); render(); break;
    case 'nextW': weekRef=addDays(weekRef,7); render(); break;
    case 'prevM': monthRef=new Date(monthRef.getFullYear(),monthRef.getMonth()-1,1); render(); break;
    case 'nextM': monthRef=new Date(monthRef.getFullYear(),monthRef.getMonth()+1,1); render(); break;
    case 'new': openEditor(null); break;
    case 'edit': openEditor(el.dataset.id); break;
    case 'close': case 'closeBg': edit=null; renderSheet(); break;
    case 'emo': syncName(); edit.emoji=el.dataset.v; renderSheet(); break;
    case 'col': syncName(); edit.color=el.dataset.v; renderSheet(); break;
    case 'stype': syncName(); edit.sched.type=el.dataset.v; renderSheet(); break;
    case 'day': { syncName(); const i=+el.dataset.v, d=edit.sched.days; if(i>=5) break; const p=d.indexOf(i); if(p>=0){if(d.length>1)d.splice(p,1)}else d.push(i); renderSheet(); break; }
    case 'tgt': syncName(); edit.sched.target=Math.min(5,Math.max(1,edit.sched.target+ +el.dataset.v)); renderSheet(); break;
    case 'saveR': {
      syncName(); const name=edit.name.trim();
      if(!name){toast('Give the routine a name');document.getElementById('rname').focus();break}
      const s=edit.sched, sched=s.type==='days'?{type:'days',days:s.days.slice().sort()}:s.type==='weekly'?{type:'weekly',target:s.target}:{type:'daily'};
      if(edit.id){const r=S.routines.find(x=>x.id===edit.id);Object.assign(r,{name,emoji:edit.emoji,color:edit.color,sched});toast('Routine saved')}
      else{S.routines.push({id:'r_'+Date.now().toString(36),name,emoji:edit.emoji,color:edit.color,sched,created:key(TODAY())});toast('Routine added')}
      save(S); edit=null; renderSheet(); render(); break;
    }
    case 'delR':
      if(!confirmDel){confirmDel=true;syncName();renderSheet();break}
      S.routines=S.routines.filter(r=>r.id!==edit.id);
      for(const k in S.checks){S.checks[k]=S.checks[k].filter(id=>id!==edit.id);if(!S.checks[k].length)delete S.checks[k]}
      save(S); edit=null; renderSheet(); render(); toast('Routine deleted'); break;
    case 'showBackup': { const b=document.getElementById('backupBox'); b.hidden=false; document.getElementById('backupText').value=JSON.stringify(S); break; }
    case 'copyBackup': { const ta=document.getElementById('backupText');
      navigator.clipboard?.writeText(ta.value).then(()=>toast('Backup copied'),()=>{ta.select();toast('Select all and copy')}) ?? (ta.select(),toast('Select all and copy')); break; }
    case 'restore': try{ const d=normalize(JSON.parse(document.getElementById('restoreText').value));
        if(!d)throw 0; S={schema:1,routines:d.routines,checks:d.checks}; save(S); toast('Backup restored'); view='today'; viewDate=TODAY(); render();
      }catch(err){toast('That code is not a valid backup')} break;
    case 'clear': if(!confirmClear){confirmClear=true;render();break}
      S=empty(); save(S); confirmClear=false; toast('All data erased'); render(); break;
  }
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&edit){edit=null;renderSheet()}});
/* when the app is reopened on a new day, move to the new today (yesterday becomes locked) */
let lastDay=key(TODAY());
document.addEventListener('visibilitychange',()=>{if(document.hidden)return;const k=key(TODAY());if(k!==lastDay){if(key(viewDate)===lastDay)viewDate=TODAY();lastDay=k;render()}});
render();
