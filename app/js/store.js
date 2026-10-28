/* Kept storage: load and save the data in localStorage. Every read and write is wrapped, since storage can be full or blocked. */
import {normalize} from './logic.js';

const KEY='kept-data-v1';

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
