/* Kept storage: load and save the data in localStorage. */
import {normalize} from './logic.js';

const KEY='kept-data-v1';

export function load(){try{const s=localStorage.getItem(KEY);return s?normalize(JSON.parse(s)):null}catch(e){return null}}
export function save(data){try{localStorage.setItem(KEY,JSON.stringify(data));return true}catch(e){return false}}
