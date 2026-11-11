/* Kept rank artwork: marks up a banner so CSS can animate it. Pure string work (no DOM), so the ranks demo generator can use it too. */

/* in a banner, the medallion is everything between the glow behind it and the first line of text (x 68 or 72).
   It goes into <g class="emblem">, the glow gets class "aura", the small gems on the ring get class "gem", and two comets
   (a bright head with a fading tail) are laid on the ring, so CSS can bring the rank you hold to life. The picture itself never moves. */
export function emblem(svg){
  const g=svg.search(/<rect [^>]*-glow\)"[^>]*\/>/), t=svg.search(/<text x="(68|72)"/);
  if(g<0||t<g) return svg;
  const e=svg.indexOf('/>',g)+2;
  let inner=svg.slice(e,t);
  /* the ring: the biggest unfilled circle, or else the biggest circle (Comfort Zone has no separate ring) */
  const circles=[...inner.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)" fill="([^"]+)"(?: fill-opacity="[^"]*")? stroke="(#[0-9A-Fa-f]{6})" stroke-width="([\d.]+)"/g)]
    .map(m=>({cx:+m[1],cy:+m[2],r:+m[3],none:m[4]==='none',color:m[5],w:+m[6]}));
  const big=circles.filter(c=>c.r>=100), ring=big.filter(c=>c.none).sort((a,b)=>b.r-a.r)[0]||big.sort((a,b)=>b.r-a.r)[0];
  if(ring){
    let n=0;
    inner=inner.replace(/<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"/g,(m,x,y,r)=>
      +r<20&&Math.abs(Math.hypot(x-ring.cx,y-ring.cy)-ring.r)<20?`<circle class="gem" style="animation-delay:${-0.7*n++}s" cx="${x}" cy="${y}" r="${r}"`:m);
    const T=4, w=Math.max(ring.w,6);
    /* each comet is three arcs on the ring: a short bright head and two longer, fainter tails, lagged so their front edges meet */
    const comet=k=>[[2,1,1.9],[7,.5,1.4],[16,.18,1.1]].map(([len,op,sw])=>
      `<circle class="comet" style="animation-delay:${(((len-2)/100-k/2)*T).toFixed(2)}s" cx="${ring.cx}" cy="${ring.cy}" r="${ring.r}" fill="none" stroke="#FFFFFF" stroke-opacity="${op}"
        stroke-width="${(w*sw).toFixed(1)}" stroke-linecap="round" pathLength="100" stroke-dasharray="${len} ${100-len}"/>`).join('');
    inner+=`<g class="comets">${comet(0)}${comet(1)}</g>`;
  }
  return svg.slice(0,g)+svg.slice(g,e).replace('<rect ','<rect class="aura" ')+'<g class="emblem">'+inner+'</g>'+svg.slice(t);
}
