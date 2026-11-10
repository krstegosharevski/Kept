/* Kept logic tests. Run with: node --test */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {key,parse,isDue,isRest,normalize,doneCount,expected,streaks,changeSchedule,stopRoutine,resumeRoutine,rangeStats,RANKS,pct1,rankIndex,rankFrom,monthResult,rankMonths} from '../app/js/logic.js';

const D=parse;
/* week used throughout: Mon 2026-10-19 … Sun 2026-10-25, and Mon 2026-10-26 … Sun 2026-11-01 */
const routine=(sched,extra={})=>({id:'a',name:'Test',emoji:'🌱',color:'#34C759',created:'2026-10-01',stopped:null,schedules:[{from:'2026-10-01',...sched}],...extra});

test('date keys are local and never shift, even late in the evening', ()=>{
  assert.equal(key(new Date(2026,9,28,23,59,59)),'2026-10-28');
  assert.equal(key(new Date(2026,0,1,0,0,1)),'2026-01-01');
  assert.equal(key(D('2026-10-28')),'2026-10-28');
});

test('Saturday and Sunday are never due, for any schedule type', ()=>{
  assert.ok(isRest(D('2026-10-31'))&&isRest(D('2026-11-01'))&&!isRest(D('2026-10-30')));
  for(const s of [{type:'daily'},{type:'days',days:[0,1,2,3,4]},{type:'weekly',target:5}]){
    const r=routine(s);
    assert.equal(isDue(r,D('2026-10-31')),false,s.type);
    assert.equal(isDue(r,D('2026-11-01')),false,s.type);
    assert.equal(isDue(r,D('2026-10-30')),true,s.type);
  }
});

test('normalize removes weekend check-ins, unknown routines and weekend days', ()=>{
  const d=normalize({routines:[routine({type:'days',days:[0,5,6]})],checks:{'2026-10-31':['a'],'2026-10-30':['a','gone']}});
  assert.equal(d.checks['2026-10-31'],undefined);
  assert.deepEqual(d.checks['2026-10-30'],['a']);
  assert.deepEqual(d.routines[0].schedules[0].days,[0]);
  const empty=normalize({routines:[routine({type:'days',days:[5,6]})],checks:{}});
  assert.equal(empty.routines[0].schedules[0].type,'daily'); // an empty list becomes daily
  assert.equal(normalize({routines:[routine({type:'weekly',target:9})],checks:{}}).routines[0].schedules[0].target,5);
  assert.equal(normalize({hello:1}),null);
});

test('done counts ignore days that are not due', ()=>{
  const r=routine({type:'days',days:[0]}); // Mondays only
  const data={checks:{'2026-10-26':['a'],'2026-10-27':['a'],'2026-10-31':['a']}};
  assert.equal(doneCount(data,r,D('2026-10-26'),D('2026-11-01')),1);
});

test('weekly expected equals the target for a full week, and prorates partial weeks by weekdays', ()=>{
  const r=routine({type:'weekly',target:3});
  assert.equal(expected(r,D('2026-10-19'),D('2026-10-25')),3);
  assert.equal(expected(r,D('2026-10-26'),D('2026-10-28')),2); // round(3 × 3/5)
  assert.equal(expected(r,D('2026-10-26'),D('2026-10-26')),1); // never below 1 with a weekday in range
  assert.equal(expected(r,D('2026-10-31'),D('2026-11-01')),0); // a weekend only
});

test('a streak continues across a weekend, today not done does not break it, a missed weekday does', ()=>{
  const r=routine({type:'daily'});
  const data={routines:[r],checks:{'2026-10-22':['a'],'2026-10-23':['a'],'2026-10-26':['a'],'2026-10-27':['a']}};
  const today=D('2026-10-28'); // Wednesday, not done yet
  assert.deepEqual(streaks(data,r,today),{cur:4,best:4,unit:'d'});
  data.checks['2026-10-28']=['a'];
  assert.equal(streaks(data,r,today).cur,5);
  delete data.checks['2026-10-26']; // missed Monday
  assert.equal(streaks(data,r,today).cur,2);
  assert.equal(streaks(data,r,today).best,2);
});

test('weekly streaks count weeks that met the target; the current week only once met', ()=>{
  const r=routine({type:'weekly',target:2});
  const data={routines:[r],checks:{'2026-10-13':['a'],'2026-10-15':['a'],'2026-10-20':['a'],'2026-10-22':['a'],'2026-10-27':['a']}};
  assert.deepEqual(streaks(data,r,D('2026-10-28')),{cur:2,best:2,unit:'wk'});
  data.checks['2026-10-28']=['a'];
  assert.equal(streaks(data,r,D('2026-10-28')).cur,3);
});

test('a schedule change from today leaves past expected counts unchanged', ()=>{
  const r=routine({type:'daily'}), today=D('2026-10-28');
  const before=expected(r,D('2026-10-19'),D('2026-10-27'));
  changeSchedule(r,{type:'days',days:[0]},today);
  assert.equal(expected(r,D('2026-10-19'),D('2026-10-27')),before);
  assert.equal(isDue(r,D('2026-10-27')),true);  // Tuesday, before the change
  assert.equal(isDue(r,D('2026-10-29')),false); // Thursday, after it
  changeSchedule(r,{type:'daily'},today); // changed back the same day: no leftover entry
  assert.equal(r.schedules.length,1);
});

test('a stopped routine is not due on or after its stop date, and its history is kept', ()=>{
  const r=routine({type:'daily'});
  const data={routines:[r],checks:{'2026-10-19':['a'],'2026-10-20':['a']}};
  stopRoutine(r,D('2026-10-21'));
  assert.equal(isDue(r,D('2026-10-20')),true);
  assert.equal(isDue(r,D('2026-10-21')),false);
  assert.equal(isDue(r,D('2026-10-28')),false);
  assert.equal(doneCount(data,r,D('2026-10-19'),D('2026-10-25')),2);
  assert.equal(expected(r,D('2026-10-19'),D('2026-10-25')),2);
  resumeRoutine(r,D('2026-10-28')); // the stopped stretch stays not due
  assert.equal(isDue(r,D('2026-10-23')),false);
  assert.equal(isDue(r,D('2026-10-28')),true);
  assert.equal(r.stopped,null);
});

test("demo-shaped data (a single sched) migrates to schedules", ()=>{
  const d=normalize({routines:[{id:'r1',name:'Workout',emoji:'🏋️',color:'#2E7DD7',created:'2026-09-01',sched:{type:'days',days:[0,2,4]}}],checks:{'2026-09-02':['r1']},demo:true});
  assert.deepEqual(d.routines[0].schedules,[{from:'2026-09-01',type:'days',days:[0,2,4]}]);
  assert.equal(d.routines[0].stopped,null);
  assert.equal(d.routines[0].color,'#007AFF'); // demo colors map to the Apple palette
  assert.equal(d.demo,undefined);
});

test('range stats leave out routines that did not exist in the range', ()=>{
  const later=routine({type:'daily'},{id:'b',created:'2026-11-02',schedules:[{from:'2026-11-02',type:'daily'}]});
  const st=rangeStats({routines:[routine({type:'daily'}),later],checks:{'2026-10-19':['a']}},D('2026-10-19'),D('2026-10-25'));
  assert.equal(st.per.length,1);
  assert.equal(st.exp,5);
  assert.equal(st.pct,1/5);
});

test('ranks follow the month %: the edges of every rank', ()=>{
  const name=p=>RANKS[rankIndex(p/100)].name;
  assert.deepEqual([0,50,50.1,60,60.1,70,70.1,78,78.1,85,85.1,95,95.1,100].map(name),
    ['Comfort Zone','Comfort Zone','Starter','Starter','Student','Student','Builder','Builder','Iron Will','Iron Will','Stoic','Stoic','Focused (Chosen)','Focused (Chosen)']);
  assert.equal(name(78.04),'Builder'); // rounds to 78.0
  assert.equal(name(78.05),'Iron Will'); // rounds to 78.1
  assert.deepEqual(RANKS.map((_,i)=>rankFrom(i)),[0,50.1,60.1,70.1,78.1,85.1,95.1]);
});

test('a month gets the rank of its %, counts only the days so far, and has no rank when nothing was expected', ()=>{
  const r=routine({type:'daily'}); // October 2026 has 22 weekdays
  const checks={}; for(let d=1;d<=31;d++){const k=`2026-10-${String(d).padStart(2,'0')}`; if(!isRest(D(k))&&d>7) checks[k]=['a']} // misses 1, 2, 5, 6 and 7 October
  const data={routines:[r],checks};
  const oct=monthResult(data,D('2026-10-01'),D('2026-11-10'));
  assert.equal(oct.final,true);
  assert.equal(pct1(oct.pct),77.3); // 17 of 22
  assert.equal(RANKS[oct.rank].name,'Builder');
  const mid=monthResult(data,D('2026-10-01'),D('2026-10-09')); // 2 of 7 so far
  assert.equal(mid.final,false);
  assert.equal(RANKS[mid.rank].name,'Comfort Zone');
  assert.equal(monthResult(data,D('2026-10-01'),D('2026-10-31')).final,false); // the last day is still running
  assert.equal(monthResult(data,D('2026-09-01'),D('2026-11-10')).rank,null); // before the routine existed
  assert.equal(monthResult(data,D('2026-11-01'),D('2026-11-01')).rank,null); // only a Sunday so far
  assert.equal(monthResult(data,D('2026-12-01'),D('2026-11-10')).rank,null); // a future month
});

test('the months to rank run from the first routine to this month', ()=>{
  const data={routines:[routine({type:'daily'},{created:'2026-11-03'}),routine({type:'daily'},{id:'b',created:'2026-08-20'})],checks:{}};
  assert.deepEqual(rankMonths(data,D('2026-11-10')).map(key),['2026-08-01','2026-09-01','2026-10-01','2026-11-01']);
  assert.deepEqual(rankMonths({routines:[],checks:{}},D('2026-11-10')),[]);
});
