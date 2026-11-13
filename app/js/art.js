/* Kept rank artwork: marks up the banners and badges so CSS can animate them. Pure string work (no DOM), so the ranks demo generator can use it too. */

const NUM='-?[\\d.]+';
/* the ring is the biggest unfilled circle, or else the biggest circle (Comfort Zone has no separate ring). The small gems sitting on it
   get class "gem", and two comets (a bright head with a fading tail) are made to run on it. Returns the text with the gems marked, and the comets. */
function ringMarks(part){
  const circles=[...part.matchAll(new RegExp(`<circle cx="(${NUM})" cy="(${NUM})" r="(${NUM})" fill="([^"]+)"(?: fill-opacity="[^"]*")? stroke="(#[0-9A-Fa-f]{6})"(?: stroke-opacity="[^"]*")? stroke-width="([\\d.]+)"`,'g'))]
    .map(m=>({cx:+m[1],cy:+m[2],r:+m[3],none:m[4]==='none',color:m[5],w:+m[6]}));
  const big=circles.filter(c=>c.r>=100), ring=big.filter(c=>c.none).sort((a,b)=>b.r-a.r)[0]||big.sort((a,b)=>b.r-a.r)[0];
  if(!ring) return {part,comets:''};
  let n=0;
  part=part.replace(new RegExp(`<circle cx="(${NUM})" cy="(${NUM})" r="(${NUM})"`,'g'),(m,x,y,r)=>
    +r<20&&Math.abs(Math.hypot(x-ring.cx,y-ring.cy)-ring.r)<20?`<circle class="gem" style="animation-delay:${-0.7*n++}s" cx="${x}" cy="${y}" r="${r}"`:m);
  const T=4, w=Math.max(ring.w,6);
  /* each comet is three arcs on the ring: a short bright head and two longer, fainter tails, lagged so their front edges meet */
  const comet=k=>[[2,1,1.9],[7,.5,1.4],[16,.18,1.1]].map(([len,op,sw])=>
    `<circle class="comet" style="animation-delay:${(((len-2)/100-k/2)*T).toFixed(2)}s" cx="${ring.cx}" cy="${ring.cy}" r="${ring.r}" fill="none" stroke="#FFFFFF" stroke-opacity="${op}"
      stroke-width="${(w*sw).toFixed(1)}" stroke-linecap="round" pathLength="100" stroke-dasharray="${len} ${100-len}"/>`).join('');
  return {part,comets:`<g class="comets">${comet(0)}${comet(1)}</g>`};
}

/* in a banner, the medallion is everything between the glow behind it and the first line of text (x 68 or 72).
   It goes into <g class="emblem">, the glow gets class "aura", and the ring gets its gems and comets, so CSS can bring
   the rank you hold to life. The picture itself never moves. */
export function emblem(svg){
  const g=svg.search(/<rect [^>]*-glow\)"[^>]*\/>/), t=svg.search(/<text x="(68|72)"/);
  if(g<0||t<g) return svg;
  const e=svg.indexOf('/>',g)+2;
  const {part,comets}=ringMarks(svg.slice(e,t));
  return svg.slice(0,g)+svg.slice(g,e).replace('<rect ','<rect class="aura" ')+'<g class="emblem">'+part+comets+'</g>'+svg.slice(t);
}

/* a badge is all medallion: its ring gets the same gems and comets, drawn on top. CSS animates them only where a badge is meant to move. */
export function badgeMarks(svg){
  const end=svg.lastIndexOf('</svg>'); if(end<0) return svg;
  const {part,comets}=ringMarks(svg.slice(0,end));
  return part+comets+svg.slice(end);
}
