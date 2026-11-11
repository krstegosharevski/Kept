/* Makes ranks-demo.html: all seven ranks as they look in Kept, each animated as if you held it, with its badge as on the Today screen.
   One self-contained file (artwork, fonts and styles inside), so it opens with a double-click. Never deployed.
   Run again after changing the artwork:  node tools/ranks-demo.mjs */
import {readFileSync,writeFileSync} from 'node:fs';
import {RANKS,rankFrom} from '../app/js/logic.js';
import {emblem} from '../app/js/art.js';

const app=new URL('../app/',import.meta.url), read=(p,enc='utf8')=>readFileSync(new URL(p,app),enc);

/* the rank styles from the app, with the fonts built in */
const css=read('styles.css'), a=css.indexOf('/* ranks: the artwork'), b=css.indexOf('/* settings */');
if(a<0||b<a) throw new Error('rank styles not found in styles.css');
const rankCss=css.slice(a,b).replace(/url\(fonts\/([\w.-]+)\)/g,(m,f)=>`url(data:font/woff2;base64,${read('fonts/'+f,null).toString('base64')})`);

/* each copy gets its own ids, as in the app */
let n=0;
const art=(kind,i)=>{
  const raw=read(`ranks/${kind}-${RANKS[i].id}.svg`), svg=kind==='banner'?emblem(raw):raw, vb=svg.match(/viewBox="[-\d.]+ [-\d.]+ ([\d.]+) ([\d.]+)"/);
  return `<span class="art ${kind} rk${i}" style="aspect-ratio:${vb[1]}/${vb[2]}"${kind==='badge'?' aria-hidden="true"':''}>${svg.replace(/(["#])kept-/g,`$1kept${++n}-`)}</span>`;
};

const DISC='<svg class="disc" width="9" height="15" viewBox="0 0 9 15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m1.5 1.5 6 6-6 6"/></svg>';
const sections=RANKS.map((r,i)=>{
  const range=i===RANKS.length-1?`${rankFrom(i)}% and up`:`${rankFrom(i)} – ${r.max}%`, pct=Math.min(r.max,Math.round((rankFrom(i)+r.max)/2*10)/10);
  return `<section>
  <h2>${i+1}. ${r.name}${r.title?` <small>${r.title}</small>`:''}</h2><p class="range">${range}</p>
  <div class="ycap">Your rank this month</div><div class="hero" data-rk="${i}">${art('banner',i)}</div>
  <div class="label">On the Today screen</div>
  <div class="group"><div class="row"><span class="slot">${art('badge',i)}</span><div class="body"><div class="name">${r.name}</div><div class="hint">Your rank this month · ${pct}%</div></div>${DISC}</div></div>
</section>`;}).join('\n');

const html=`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark"><title>Kept ranks</title>
<style>
:root{--bg:#F2F2F7;--surface:#FFFFFF;--ink:#000000;--muted:rgba(60,60,67,.6);--line:rgba(60,60,67,.29);--tint:#007AFF;--ring-off:rgba(60,60,67,.36)}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#000000;--surface:#1C1C1E;--ink:#FFFFFF;--muted:rgba(235,235,245,.6);--line:rgba(84,84,88,.65);--tint:#0A84FF;--ring-off:rgba(235,235,245,.34)}}
:root[data-theme="dark"]{--bg:#000000;--surface:#1C1C1E;--ink:#FFFFFF;--muted:rgba(235,235,245,.6);--line:rgba(84,84,88,.65);--tint:#0A84FF;--ring-off:rgba(235,235,245,.34)}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:17px/1.3 -apple-system,BlinkMacSystemFont,system-ui,"Segoe UI",Roboto,sans-serif;letter-spacing:-.022em;-webkit-font-smoothing:antialiased}
main{max-width:480px;margin:0 auto;padding:24px 16px 64px}
header{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-bottom:8px}
h1{font-size:34px;margin:0;letter-spacing:.011em}
.intro{color:var(--muted);font-size:15px;margin:6px 0 0}
.theme{flex:none;white-space:nowrap;border:0;border-radius:999px;padding:8px 14px;background:var(--surface);color:var(--tint);font:inherit;font-size:15px;font-weight:600;cursor:pointer}
section{margin-top:40px}
h2{font-size:22px;margin:0;letter-spacing:-.012em}
h2 small{font-size:15px;font-weight:600;color:var(--muted);margin-left:4px}
.range{margin:2px 0 14px;color:var(--muted);font-size:15px;font-variant-numeric:tabular-nums}
.label{font-size:13px;text-transform:uppercase;color:var(--muted);padding:22px 4px 7px;letter-spacing:-.006em}
.group{background:var(--surface);border-radius:22px;overflow:hidden}
.row{display:flex;align-items:center;gap:12px;padding:6px 12px;min-height:48px}
.row .body{flex:1;min-width:0}
.row .hint{font-size:15px;color:var(--muted);letter-spacing:-.016em}
.disc{flex:none;color:var(--muted);opacity:.6}
${rankCss}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}}
</style></head>
<body><main>
<header><div><h1>Kept ranks</h1><p class="intro">All seven ranks as they look in the app, each one moving as if it were yours this month.</p></div>
<button class="theme" type="button" onclick="const r=document.documentElement,d=r.dataset.theme==='dark'||(!r.dataset.theme&&matchMedia('(prefers-color-scheme: dark)').matches);r.dataset.theme=d?'light':'dark'">Light / Dark</button></header>
${sections}
</main></body></html>
`;
writeFileSync(new URL('../ranks-demo.html',import.meta.url),html);
console.log(`ranks-demo.html written (${Math.round(html.length/1024)} KB)`);
