/* Kept UI: rendering and events. Rules and stats live in logic.js, storage in store.js. */
import {key,parse,addDays,dow,isRest,weekStart,TODAY,minD,normalize,schedOn,isDue,changeSchedule,stopRoutine,resumeRoutine,isDone,toggle,rangeStats,dayRatio,level,weekDone,streaks} from './logic.js';
import {load,save} from './store.js';
import {startWater,blowDandelion,slowDandelion} from './scene.js';

/* Apple system colors: green, blue, purple, teal, orange, pink */
const COLORS=['#34C759','#007AFF','#AF52DE','#30B0C7','#FF9500','#FF2D55'];
const EMOJI=['🥗','🏋️','📖','💧','📞','🧘','🛏️','🚶','✍️','🎸','🧹','☀️','🍎','📵','🧠','🌱'];
const DAYS=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const DAYS1=['M','T','W','T','F','S','S'];
const DAYS_FULL=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];

const empty=()=>({schema:1,routines:[],checks:{}});
const loaded=load();
let S=loaded.data||empty();
if(!loaded.data&&!loaded.error) navigator.storage?.persist?.().catch(()=>{}); // first run: ask the browser to keep the data; the answer does not matter
let view='today', viewDate=TODAY(), statMode='week', weekRef=weekStart(TODAY()), monthRef=new Date(TODAY().getFullYear(),TODAY().getMonth(),1);
let edit=null, confirmDel=false, confirmClear=false, sheetOpening=false;
let ringFrac=null, popId=null; // the ring animates from its last value; popId is the routine that was just checked off
let quietDandelion=null; // the slow dandelion of the "No routines yet" screen, made once per start and moved into each re-render

const short=k=>{const d=parse(k);return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0,3)}`};
const commit=()=>{if(!save(S))toast("Couldn't save. Your iPhone storage may be full.")};

function schedText(r,d){
  const s=schedOn(r,d||TODAY());
  if(s.type==='daily'||s.type==='off') return 'Mon – Fri';
  if(s.type==='days') return s.days.length>=5?'Mon – Fri':s.days.slice().sort().map(i=>DAYS[i]).join(' · ');
  return d?`${weekDone(S,r,d)} of ${s.target} this week`:`${s.target}× per week`;
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

function renderToday(){
  const t=TODAY(),d=viewDate,k=key(d),isToday=+d===+t,past=d<t,rest=isRest(d),yest=+d===+addDays(t,-1);
  const due=S.routines.filter(r=>isDue(r,d));
  const done=due.filter(r=>isDone(S,r,k)).length;
  const title=isToday?'Today':yest?'Yesterday':DAYS_FULL[dow(d)];
  const date=`${isToday||yest?DAYS_FULL[dow(d)]+' ':''}${d.getDate()} ${MONTHS[d.getMonth()]}${d.getFullYear()!==t.getFullYear()?' '+d.getFullYear():''}`;
  let html=`<header class="head"><div class="titles"><div class="eyebrow">${date}</div><h1>${title}</h1></div>${rest?`<div class="restbadge" aria-hidden="true">${MOON}</div>`:ring(done,due.length)}</header>
    <div class="daynav"><div class="ggroup glass"><button class="gbtn" data-act="prevDay" aria-label="Previous day">${CHEV_L}</button><button class="gbtn" data-act="nextDay" aria-label="Next day" ${isToday?'disabled':''}>${CHEV_R}</button></div>
    ${isToday?'':'<button class="gpill glass" data-act="goToday">Back to today</button>'}</div>`;
  if(rest){
    html+=`<div class="restcard">${MOON}<h3>Rest day</h3><p>Saturdays and Sundays are for resting, so there is nothing to check off.${isToday?' Your routines start again on Monday.':''}</p></div>`;
  } else if(!S.routines.length){
    html+=`<div class="empty"><div class="dslot"></div><h3>No routines yet</h3><p>Add your first one, like “Eat healthy”, and tick it off each day.</p><button class="primary" data-act="new">Add a routine</button></div>`;
  } else if(!due.length){
    html+=`<div class="empty"><h3>Nothing scheduled</h3><p>No routines are due on this day.</p></div>`;
  } else {
    if(past) html+=`<div class="lockline">${LOCK}Past day, view only. You can only check off today.</div>`;
    html+='<div class="group tiles">'+due.map(r=>{const dn=isDone(S,r,k),weekly=schedOn(r,d).type==='weekly';
      const hint=past?(dn?'Completed':(weekly?'Not done':'Missed')):schedText(r,d);
      const ctl=past?`<div class="status" role="img" aria-label="${dn?'Completed':'Not completed'}">${dn?CHECK:''}</div>`
        :`<button class="check" data-act="toggle" data-id="${r.id}" aria-pressed="${dn}" aria-label="Mark ${esc(r.name)} done"><span class="ci">${CHECK}</span></button>`;
      return `<div class="row item${dn?' done':''}${past?' locked':''}${past&&!dn&&!weekly?' missed':''}${r.id===popId?' pop':''}" style="--c:${r.color}">
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
  if(active.length) html+='<div class="group tiles">'+active.map(r=>`<button class="row" style="--c:${r.color}" data-act="edit" data-id="${r.id}">
    <div class="tile">${r.emoji}</div><div class="body"><div class="name">${esc(r.name)}</div><div class="hint">${schedText(r)}</div></div>${DISC}</button>`).join('')+'</div>';
  html+=`<div class="group tiles"><button class="row link" data-act="new"><span class="addicon">${PLUS}</span>New routine</button></div>`;
  if(stopped.length) html+=`<div class="gh">Stopped</div><div class="group tiles">${stopped.map(r=>`<div class="row stopped" style="--c:${r.color}">
    <button class="rowbtn" data-act="edit" data-id="${r.id}"><div class="tile">${r.emoji}</div><div class="body"><div class="name">${esc(r.name)}</div><div class="hint">Stopped ${short(r.stopped)}</div></div></button>
    <button class="pill" data-act="resume" data-id="${r.id}">Resume</button></div>`).join('')}</div>
    <p class="gf">Stopped routines keep their history. Resume one to track it again from today.</p>`;
  $app.innerHTML=html;
}

const rangeHead=(x,label,isCur)=>`<div class="rangehead"><button class="gbtn glass" data-act="prev${x}" aria-label="Previous ${x==='W'?'week':'month'}">${CHEV_L}</button>
  <div class="lbl">${label}</div><button class="gbtn glass" data-act="next${x}" aria-label="Next ${x==='W'?'week':'month'}" ${isCur?'disabled':''}>${CHEV_R}</button></div>`;
const kpi=(pct,cap)=>`<div class="kpi"><div class="cap">${cap}</div><div class="v">${Math.round(pct*100)}<small>%</small></div></div>`;

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
    +`<div class="card">${kpi(st.pct,'Completed')}
    <div class="bars">${[...Array(7)].map((_,i)=>{const d=addDays(a,i),td=+d===+t?' today':'';
      if(isRest(d)) return `<div class="bar rest${td}"><span class="p"></span><div class="cw"><div class="col" style="height:100%"><span>Rest</span></div></div><span class="d">${DAYS1[i]}</span></div>`;
      const fut=d>t,v=fut?null:dayRatio(S,d),h=v==null?0:Math.round(v*100);
      return `<div class="bar${fut?' future':h?'':' zero'}${td}"><span class="p">${fut||v==null?'':h+'%'}</span><div class="cw"><div class="col" style="height:${h}%"></div></div><span class="d">${DAYS1[i]}</span></div>`}).join('')}</div></div>
    <h2 class="sh">By routine</h2><div class="group tiles">${st.per.map(({r,e,d})=>`<div class="rstat" style="--c:${r.color}">
      <div class="tile">${r.emoji}</div><div class="nm">${esc(r.name)}</div><div class="pc">${d}/${e}</div>
      <div class="dots">${[...Array(7)].map((_,i)=>{const dd=addDays(a,i);if(isRest(dd))return '<i class="rest"></i>';if(dd>t||!isDue(r,dd))return '<i class="off"></i>';return `<i class="${isDone(S,r,key(dd))?'on':''}"></i>`}).join('')}</div></div>`).join('')}</div>`;
  } else {
    const a=monthRef,b=new Date(a.getFullYear(),a.getMonth()+1,0),bEff=minD(b,t);
    const st=rangeStats(S,a,bEff);
    const isCur=a.getFullYear()===t.getFullYear()&&a.getMonth()===t.getMonth();
    let cells=DAYS1.map(x=>`<span class="h">${x}</span>`).join('')+'<span class="day blank"></span>'.repeat(dow(a));
    for(let d=a;d<=b;d=addDays(d,1)){const td=+d===+t?' today':'';
      if(isRest(d)){cells+=`<span class="day rest${td}" role="img" aria-label="${d.getDate()} ${MONTHS[d.getMonth()]}, rest day">${d.getDate()}</span>`;continue}
      const fut=d>t,lv=fut?0:level(dayRatio(S,d));
      cells+=`<button class="day l${lv}${fut?' future':''}${td}" ${fut?'disabled':`data-act="openDay" data-k="${key(d)}"`} aria-label="${d.getDate()} ${MONTHS[d.getMonth()]}">${d.getDate()}</button>`}
    html+=rangeHead('M',`${MONTHS[a.getMonth()]} ${a.getFullYear()}`,isCur)
    +`<div class="card">${kpi(st.pct,'Completed this month')}
    <div class="heat">${cells}</div>
    <div class="legend">Less<i class="day l0"></i><i class="day l1"></i><i class="day l2"></i><i class="day l3"></i><i class="day l4"></i>More<i class="day rest gapl"></i>Rest</div>
    <p class="foot">Tap a day to see what you did. Black days are rest days.</p></div>
    <h2 class="sh">By routine</h2><div class="group tiles">${st.per.map(({r,e,d,pct})=>{const s=streaks(S,r,t);return `<div class="rstat" style="--c:${r.color}">
      <div class="tile">${r.emoji}</div><div class="nm">${esc(r.name)}</div><div class="pc">${Math.round(pct*100)}%</div>
      <div class="track"><span style="width:${Math.round(pct*100)}%"></span></div>
      <div class="meta"><span class="num">${d}</span> of <span class="num">${e}</span> · streak <span class="num">${s.cur}${s.unit}</span> · best <span class="num">${s.best}${s.unit}</span></div></div>`}).join('')}</div>`;
  }
  $app.innerHTML=html;
}

function renderSettings(){
  $app.innerHTML=`<header class="head"><div class="titles"><h1>Settings</h1></div></header>
  <div class="group"><div class="row appcard"><div class="body"><div class="appname">Kept</div><div class="hint">Your data lives only on this device.</div></div></div></div>
  <div class="gh">Backup</div>
  <div class="group"><button class="row link" data-act="showBackup">Show backup code</button>
    <textarea id="backupText" readonly hidden aria-label="Backup code"></textarea>
    <button class="row link" id="copyBackup" data-act="copyBackup" hidden>Copy</button></div>
  <p class="gf">Copy the backup code and keep it somewhere safe.</p>
  <div class="gh">Restore</div>
  <div class="group"><textarea id="restoreText" placeholder="Paste a backup code" aria-label="Backup code to restore"></textarea>
    <button class="row link" data-act="restore">Restore from code</button></div>
  <div class="gh">Data</div>
  <div class="group"><button class="row danger" data-act="clear">${confirmClear?'Tap again to erase everything':'Erase all data'}</button></div>
  <p class="credit">Powered by <b>Krtse XO</b></p>`;
}

function render(){
  document.querySelectorAll('#tabs button').forEach(b=>b.setAttribute('aria-current',b.dataset.tab===view?'page':'false'));
  ({today:renderToday,routines:renderRoutines,stats:renderStats,settings:renderSettings})[view]();
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
  if(!edit){$sheet.innerHTML='';return}
  const s=edit.sched, top=$sheet.querySelector('.sheet')?.scrollTop||0;
  $sheet.innerHTML=`<div class="overlay${sheetOpening?' opening':''}" data-act="closeBg"><div class="sheet" role="dialog" aria-modal="true" aria-label="${edit.id?'Edit routine':'New routine'}">
    <div class="grabber" aria-hidden="true"></div>
    <div class="sheethead"><button class="gbtn glass" data-act="close" aria-label="Cancel">${XMARK}</button><h2>${edit.id?'Edit routine':'New routine'}</h2><button class="gbtn prominent" data-act="saveR" aria-label="Save">${TICK}</button></div>
    <div class="gh"><label for="rname">Name</label></div>
    <div class="group"><input type="text" class="row inp" id="rname" maxlength="40" placeholder="e.g. Eat healthy" value="${esc(edit.name)}"></div>
    <div class="gh">Icon</div>
    <div class="group pad"><div class="picks">${EMOJI.map(e=>`<button class="emo" data-act="emo" data-v="${e}" aria-pressed="${edit.emoji===e}">${e}</button>`).join('')}</div></div>
    <div class="gh">Color</div>
    <div class="group pad"><div class="picks colors">${COLORS.map(c=>`<button class="sw" style="--c:${c}" data-act="col" data-v="${c}" aria-pressed="${edit.color===c}" aria-label="Color ${c}"></button>`).join('')}</div></div>
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
let tt; function toast(m){const t=document.getElementById('toast');t.textContent=m;t.hidden=false;clearTimeout(tt);tt=setTimeout(()=>t.hidden=true,1800)}

/* ---------- events ---------- */
document.addEventListener('click',e=>{
  const tab=e.target.closest('[data-tab]'); if(tab){view=tab.dataset.tab;confirmClear=false;if(view==='today')viewDate=TODAY();render();window.scrollTo(0,0);return}
  const el=e.target.closest('[data-act]'); if(!el)return;
  const a=el.dataset.act;
  if(a==='closeBg'&&e.target!==el)return;
  switch(a){
    case 'toggle': { if(+viewDate!==+TODAY()||isRest(viewDate)){toast('Only today can be checked off');render();break}
      const id=el.dataset.id,k=key(viewDate); toggle(S,id,k); commit();
      if(isDone(S,{id},k)){popId=id; if(S.routines.filter(r=>isDue(r,viewDate)).every(r=>isDone(S,r,k)))blowDandelion()} // the last one for today
      render(); break; }
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
      if(edit.id){const r=S.routines.find(x=>x.id===edit.id);Object.assign(r,{name,emoji:edit.emoji,color:edit.color});if(!r.stopped)changeSchedule(r,sched,TODAY());toast('Routine saved')}
      else{const k=key(TODAY());S.routines.push({id:'r_'+Date.now().toString(36),name,emoji:edit.emoji,color:edit.color,created:k,stopped:null,schedules:[{from:k,...sched}]});toast('Routine added')}
      commit(); edit=null; renderSheet(); render(); break;
    }
    case 'stopR': { const r=S.routines.find(x=>x.id===el.dataset.id); stopRoutine(r,TODAY()); commit(); edit=null; renderSheet(); render(); toast('Stopped. Its history is kept.'); break; }
    case 'resume': { const r=S.routines.find(x=>x.id===el.dataset.id); resumeRoutine(r,TODAY()); commit(); edit=null; renderSheet(); render(); toast('Tracking again from today'); break; }
    case 'delR':
      if(!confirmDel){confirmDel=true;syncName();renderSheet();break}
      S.routines=S.routines.filter(r=>r.id!==edit.id);
      for(const k in S.checks){S.checks[k]=S.checks[k].filter(id=>id!==edit.id);if(!S.checks[k].length)delete S.checks[k]}
      commit(); edit=null; renderSheet(); render(); toast('Routine deleted'); break;
    case 'showBackup': { const ta=document.getElementById('backupText'); ta.value=JSON.stringify(S); ta.hidden=false; document.getElementById('copyBackup').hidden=false; break; }
    case 'copyBackup': { const ta=document.getElementById('backupText');
      navigator.clipboard?.writeText(ta.value).then(()=>toast('Backup copied'),()=>{ta.select();toast('Select all and copy')}) ?? (ta.select(),toast('Select all and copy')); break; }
    case 'restore': try{ const d=normalize(JSON.parse(document.getElementById('restoreText').value));
        if(!d)throw 0; S=d; commit(); toast('Backup restored'); view='today'; viewDate=TODAY(); render();
      }catch(err){toast('That code is not a valid backup')} break;
    case 'clear': if(!confirmClear){confirmClear=true;render();break}
      S=empty(); commit(); confirmClear=false; toast('All data erased'); render(); break;
  }
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&edit){edit=null;renderSheet()}});
/* the top bar turns to glass once content scrolls under it, like iOS */
addEventListener('scroll',()=>document.body.classList.toggle('scrolled',scrollY>2),{passive:true});
/* when the app is reopened on a new day, move to the new today (yesterday becomes locked) */
let lastDay=key(TODAY());
document.addEventListener('visibilitychange',()=>{if(document.hidden)return;const k=key(TODAY());if(k!==lastDay){if(key(viewDate)===lastDay)viewDate=TODAY();lastDay=k;render()}});
render();
if(loaded.error) toast("Couldn't read your saved data. A copy was set aside.");
startWater(document.getElementById('water'));
if(S.routines.length) blowDandelion(); // the intro, as on the owner's website; with no routines the slow one plays instead
