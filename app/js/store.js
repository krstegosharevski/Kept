/* Kept storage: load and save the data in localStorage, and backup files. Every read and write is wrapped, since storage can be full or blocked. */
import {normalize,key} from './logic.js';

const KEY='kept-data-v1', META='kept-meta-v1';

/* {data} with the saved data (null on first run), or {data:null,error:true} when it cannot be read.
   Unreadable data is set aside under KEY-unreadable first, so starting fresh never overwrites it. */
export function load(){
  let s;
  try{s=localStorage.getItem(KEY)}catch(e){return {data:null,error:true}}
  if(s==null) return {data:null};
  try{const d=normalize(JSON.parse(s));if(d)return {data:d}}catch(e){}
  try{localStorage.setItem(KEY+'-unreadable',s)}catch(e){}
  return {data:null,error:true};
}
export function save(data){try{localStorage.setItem(KEY,JSON.stringify(data));return true}catch(e){return false}}

/* backup bookkeeping: when the last backup was made, and the day the reminder was put off */
export function loadMeta(){
  try{const m=JSON.parse(localStorage.getItem(META)||'{}');return {lastBackupAt:m.lastBackupAt??null,reminderDismissedOn:m.reminderDismissedOn??null}}
  catch(e){return {lastBackupAt:null,reminderDismissedOn:null}}
}
export function saveMeta(meta){try{localStorage.setItem(META,JSON.stringify(meta));return true}catch(e){return false}}
export function eraseAll(){try{localStorage.removeItem(KEY);localStorage.removeItem(META);return true}catch(e){return false}}

/* kept-backup-YYYY-MM-DD.json */
export function backupFile(data,now=new Date()){
  const body={app:'kept',schema:1,exportedAt:now.toISOString(),routines:data.routines,checks:data.checks};
  return new File([JSON.stringify(body,null,1)],`kept-backup-${key(now)}.json`,{type:'application/json'});
}
/* the data in a backup file, normalized, or null when it is not one */
export function readBackup(text){try{return normalize(JSON.parse(text))}catch(e){return null}}
