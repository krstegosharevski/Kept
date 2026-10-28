/* Kept scenery, ported from the owner's Krtse XO website (E:\krste-xo\krste-website-xo, WaterField.jsx and
   DandelionIntro.jsx): Lake Prespa with Golem Grad and pelicans along the bottom of the screen, and the
   dandelion that blows away when everything for today is done. Decoration only, never in the way of a tap. */

const rand=(min,max)=>min+Math.random()*(max-min);
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- the lake ---------- */
const FRAME_MS=1000/30, MAX_DPR=2, STEP=10, INTENSITY=.7;
const TOP=.34, SPREAD=.52; // where the four bands sit, as a fraction of the canvas height; the rest is under the tab bar
/* four bands, each the sum of three sines with different wavelengths, periods and phases */
const BANDS=[
  {amp:10,wavelengths:[.9,.45,.28],periods:[13,10,17],phases:[0,1.7,3.4]},
  {amp:14,wavelengths:[1.1,.5,.33],periods:[17,13,21],phases:[.8,2.6,4.9]},
  {amp:19,wavelengths:[1.3,.6,.37],periods:[22,17,27],phases:[1.9,3.9,.6]},
  {amp:24,wavelengths:[1.6,.72,.44],periods:[27,21,33],phases:[3.1,1.2,5.5]},
];
const WEIGHTS=[.5,.3,.2];
const CREST_ALPHA=6, CREST_WIDTH=1.25; // a visible line along each band's surface, so the water reads as moving
const RIPPLE_DURATION=4.5, RIPPLE_GAP=[16,36], RIPPLE_MAX_RADIUS=170;
const BIRD_DURATION=18, BIRD_GAP=[60,120], BIRD_OPACITY=.32;
const FISH_DURATION=[1.6,2.2], FISH_HEIGHT=[40,70], FISH_DISTANCE=[50,90], FISH_GAP=[7,15], FISH_FIRST_GAP=[3,6], FISH_OPACITY=.5;

/* Golem Grad, traced from a photo taken from the lake: x 0–1 across the island, y 0 at the top of the crown to 1 at the waterline */
const ISLAND_CANOPY=[[.03,.5],[.05,.36],[.08,.26],[.12,.18],[.19,.11],[.26,.07],[.33,.05],[.42,.07],[.48,.12],[.55,.17],[.62,.22],[.71,.3],[.8,.39],[.87,.5],[.94,.64],[.985,.82]];
const ISLAND_ROCKS=[
  [[.012,.9],[.016,.62],[.04,.53],[.07,.49],[.1,.52],[.14,.45],[.19,.43],[.24,.46],[.29,.41],[.35,.43],[.4,.4],[.45,.44],[.5,.42],[.54,.47],[.555,.6],[.585,.88]],
  [[.605,.88],[.635,.63],[.67,.57],[.71,.6],[.75,.56],[.775,.63],[.8,.88]],
  [[0,.88],[.8,.87],[.9,.94],[.92,1],[0,1]],
];
const ISLAND_HILLS=[
  [[-.4,1],[-.3,.62],[-.2,.4],[-.11,.36],[-.03,.48],[.06,1]],
  [[.9,1],[.99,.6],[1.1,.4],[1.24,.3],[1.42,.38],[1.7,.58],[2.1,.8],[2.6,1]],
];
const ISLAND_ASPECT=.15, ISLAND_MAX_WIDTH=520;
const ISLAND_WIDE={width:.32,left:.6}, ISLAND_NARROW={width:.68,left:.14}, WIDE_FROM=1024;
const SCENE_FADE=1.6, PELICAN_FADE_DELAY=.6;
/* pelicans floating on the water, each riding one band and drifting slowly sideways */
const PELICANS=[
  {band:2,x:.56,direction:-1,speed:5,scale:1.05},
  {band:2,x:.62,direction:-1,speed:5,scale:.92},
  {band:1,x:.86,direction:1,speed:3.5,scale:.78},
];
const PELICAN_OPACITY=.55, PELICAN_SCALE_NARROW=.85;

function readPalette(canvas){
  const s=getComputedStyle(canvas), ink=s.color.match(/-?\d+(\.\d+)?/g);
  return {rgb:s.getPropertyValue('--water-rgb').trim()||'31, 94, 255',alpha:parseFloat(s.getPropertyValue('--water-alpha'))||.07,inkRgb:ink?ink.slice(0,3).join(', '):'0, 0, 0'};
}
function surfaceOffset(band,x,width,time){
  let o=0;
  for(let i=0;i<3;i++) o+=Math.sin(x/(band.wavelengths[i]*width)*Math.PI*2+time/band.periods[i]*Math.PI*2+band.phases[i])*band.amp*WEIGHTS[i];
  return o;
}
function drawBird(ctx,x,y,scale,flap){
  const span=9*scale, lift=Math.sin(flap*Math.PI*2)*4*scale;
  ctx.beginPath(); ctx.moveTo(x-span,y);
  ctx.quadraticCurveTo(x-span*.5,y-lift,x,y); ctx.quadraticCurveTo(x+span*.5,y-lift,x+span,y); ctx.stroke();
}
/* nose at +x; facing left mirrors first, so the fish never turns upside down */
function drawFish(ctx,x,y,pitch,facing,scale){
  const L=10*scale;
  ctx.save(); ctx.translate(x,y); if(facing===-1)ctx.scale(-1,1); ctx.rotate(pitch);
  ctx.beginPath(); ctx.moveTo(L,0); ctx.quadraticCurveTo(L*.3,-L*.45,-L*.5,0); ctx.quadraticCurveTo(L*.3,L*.45,L,0); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-L*.5,0); ctx.lineTo(-L*.95,-L*.35); ctx.lineTo(-L*.95,L*.35); ctx.closePath(); ctx.fill();
  ctx.restore();
}
function canopyAt(fx){
  const p=ISLAND_CANOPY;
  if(fx<=p[0][0]) return p[0][1];
  for(let i=1;i<p.length;i++) if(fx<=p[i][0]){const[x0,y0]=p[i-1],[x1,y1]=p[i];return y0+(fx-x0)/(x1-x0)*(y1-y0)}
  return p[p.length-1][1];
}
/* Golem Grad, back to front: the hills behind, a squashed reflection, the wooded crown, the pale rock, a crest line.
   Every irregularity comes from the loop index, so the island is the same shape on every frame. */
function drawIsland(ctx,left,waterline,w,h,rgb,alpha){
  const X=fx=>left+fx*w, Y=fy=>waterline-h+fy*h, tint=a=>`rgba(${rgb}, ${Math.min(a,.7)})`;
  const silhouette=()=>{
    ctx.moveTo(X(0),Y(1)); ctx.lineTo(X(0),Y(.9)); ctx.lineTo(X(.012),Y(.86)); ctx.lineTo(X(.016),Y(.62)); ctx.lineTo(X(ISLAND_CANOPY[0][0]),Y(ISLAND_CANOPY[0][1]));
    const end=ISLAND_CANOPY[ISLAND_CANOPY.length-1][0];
    for(let fx=ISLAND_CANOPY[0][0],i=0;fx<end;i++){
      const next=Math.min(fx+.016+((i*7)%5)*.004,end), bump=h*(.035+((i*3)%4)*.014+((i*5)%3)*.008), ya=Y(canopyAt(fx)), yb=Y(canopyAt(next));
      ctx.quadraticCurveTo(X((fx+next)/2),Math.min(ya,yb)-bump*2,X(next),yb); fx=next;
    }
    ctx.lineTo(X(1),Y(.96)); ctx.lineTo(X(1),Y(1));
  };
  const rocks=()=>{for(const poly of ISLAND_ROCKS){ctx.moveTo(X(poly[0][0]),Y(poly[0][1]));for(let i=1;i<poly.length;i++)ctx.lineTo(X(poly[i][0]),Y(poly[i][1]));ctx.closePath()}};

  // hills behind, with the island cut out of them
  ctx.save(); ctx.beginPath(); ctx.rect(X(-3),Y(-1),w*7,h*2); silhouette(); ctx.closePath(); ctx.clip('evenodd');
  ctx.beginPath();
  for(const ridge of ISLAND_HILLS){
    const pts=ridge.map(([x,y])=>[X(x),Y(y)]);
    ctx.moveTo(pts[0][0],pts[0][1]);
    for(let i=1;i<pts.length-1;i++) ctx.quadraticCurveTo(pts[i][0],pts[i][1],(pts[i][0]+pts[i+1][0])/2,(pts[i][1]+pts[i+1][1])/2);
    ctx.lineTo(pts[pts.length-1][0],pts[pts.length-1][1]); ctx.closePath();
  }
  ctx.fillStyle=tint(alpha*.3); ctx.fill(); ctx.restore();

  // reflection, mirrored about the waterline and squashed
  ctx.save(); ctx.beginPath(); ctx.rect(X(-.1),waterline,w*1.2,h); ctx.clip();
  ctx.translate(0,waterline); ctx.scale(1,-.45); ctx.translate(0,-waterline);
  ctx.beginPath(); silhouette(); ctx.closePath(); ctx.fillStyle=tint(alpha*.25); ctx.fill(); ctx.restore();

  // the wooded crown, with rows of smaller crowns inside it
  ctx.beginPath(); silhouette(); ctx.closePath(); ctx.fillStyle=tint(alpha); ctx.fill();
  ctx.save(); ctx.beginPath(); silhouette(); ctx.closePath(); ctx.clip();
  ctx.strokeStyle=tint(alpha*.9); ctx.lineWidth=1;
  for(let row=1;row<=2;row++) for(let fx=.06+row*.02,i=0;fx<.95;fx+=.05+((i*5)%3)*.02,i++){
    const fy=canopyAt(fx)+row*.12; if(fy>.84) continue;
    const half=w*(.008+(i%2)*.003);
    ctx.beginPath(); ctx.moveTo(X(fx)-half,Y(fy)); ctx.quadraticCurveTo(X(fx),Y(fy)-h*.07,X(fx)+half,Y(fy)); ctx.stroke();
  }
  ctx.restore();

  // the rock replaces the trees where it shows: erase them there, then fill with the paler tone, streaked
  ctx.save(); ctx.beginPath(); silhouette(); ctx.closePath(); ctx.clip();
  ctx.beginPath(); rocks();
  ctx.globalCompositeOperation='destination-out'; ctx.fillStyle='#000'; ctx.fill();
  ctx.globalCompositeOperation='source-over'; ctx.fillStyle=tint(alpha*.42); ctx.fill();
  ctx.clip(); ctx.strokeStyle=tint(alpha*1.1); ctx.lineWidth=1;
  for(let fx=.025,i=0;fx<.8;fx+=.011+((i*7)%4)*.006,i++){
    const top=Y(.4+((i*3)%5)*.06), bottom=Y(.86-(i%3)*.08); if(bottom<=top) continue;
    ctx.beginPath(); ctx.moveTo(X(fx),top); ctx.lineTo(X(fx+.003),bottom); ctx.stroke();
  }
  ctx.fillStyle=tint(alpha*1.1); // boulders along the shore
  for(let fx=.02,i=0;fx<.8;fx+=.03+((i*3)%4)*.012,i++){ctx.beginPath();ctx.ellipse(X(fx),Y(.95),w*(.005+(i%3)*.002),h*.04,0,Math.PI,0);ctx.fill()}
  ctx.restore();

  // the top edges of the two cliff faces, and the crest line along the top
  ctx.strokeStyle=tint(alpha*1.6); ctx.lineWidth=1;
  for(const poly of ISLAND_ROCKS.slice(0,2)){ctx.beginPath();ctx.moveTo(X(poly[1][0]),Y(poly[1][1]));for(let i=2;i<poly.length-1;i++)ctx.lineTo(X(poly[i][0]),Y(poly[i][1]));ctx.stroke()}
  ctx.beginPath(); silhouette(); ctx.strokeStyle=tint(alpha*2.4); ctx.lineWidth=CREST_WIDTH; ctx.stroke();
}
/* a pelican floating on the water: bulky body, short neck curved back, and the long bill with its pouch */
function drawPelican(ctx,x,y,scale,facing,tilt){
  ctx.save(); ctx.translate(x,y); if(facing===-1)ctx.scale(-1,1); ctx.rotate(tilt); ctx.scale(scale,scale);
  ctx.beginPath(); ctx.moveTo(-17,0); ctx.quadraticCurveTo(-21,-8,-12,-11); ctx.quadraticCurveTo(0,-15,9,-11); ctx.quadraticCurveTo(15,-8,15,-2); ctx.quadraticCurveTo(15,0,11,0); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(9,-10); ctx.bezierCurveTo(6,-16,3,-21,7,-25); ctx.lineWidth=4.5; ctx.lineCap='round'; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(8,-26,3.6,3,0,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(10,-27.5); ctx.lineTo(27,-18); ctx.lineTo(25.5,-16.5); ctx.quadraticCurveTo(16,-17,10,-22.5); ctx.closePath(); ctx.fill();
  ctx.restore();
}

/* the lake along the bottom of the screen: 30fps, paused while the app is in the background, one still frame under reduced motion */
export function startWater(canvas){
  const ctx=canvas.getContext('2d'); if(!ctx) return;
  const still=reduced();
  let width=0,height=0,wide=false,palette=readPalette(canvas);
  let elapsed=0,lastFrame=0,frame=0,running=false;
  let ripples=[],nextRippleAt=rand(...RIPPLE_GAP),bird=null,nextBirdAt=rand(...BIRD_GAP),fish=[],nextFishAt=rand(...FISH_FIRST_GAP);
  const bandY=b=>height*(TOP+SPREAD*((b+.5)/BANDS.length));

  function resize(){
    const r=canvas.getBoundingClientRect(), dpr=Math.min(devicePixelRatio||1,MAX_DPR);
    width=r.width; height=r.height;
    canvas.width=Math.max(1,Math.round(width*dpr)); canvas.height=Math.max(1,Math.round(height*dpr));
    ctx.setTransform(dpr,0,0,dpr,0,0);
    palette=readPalette(canvas); wide=width>=WIDE_FROM;
  }
  function draw(){
    ctx.clearRect(0,0,width,height);
    if(!width||!height) return;
    const ease=t=>1-(1-Math.min(Math.max(t,0),1))**3;
    const islandFade=still?1:ease(elapsed/SCENE_FADE), pelicanFade=still?1:ease((elapsed-PELICAN_FADE_DELAY)/SCENE_FADE);
    // the island goes down first, so the waves wash over its base
    const place=wide?ISLAND_WIDE:ISLAND_NARROW, islandW=Math.min(width*place.width,ISLAND_MAX_WIDTH);
    drawIsland(ctx,width*place.left,height*(TOP+SPREAD*(.5/BANDS.length))+4,islandW,islandW*ISLAND_ASPECT,palette.rgb,palette.alpha*INTENSITY*2.6*islandFade);
    for(let b=0;b<BANDS.length;b++){
      const band=BANDS[b], baseY=bandY(b), surface=x=>baseY+surfaceOffset(band,x,width,elapsed)*INTENSITY;
      const pts=[]; for(let x=0;x<=width;x+=STEP) pts.push([x,surface(x)]);
      if(pts[pts.length-1][0]!==width) pts.push([width,surface(width)]);
      const line=()=>{ctx.beginPath();ctx.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i][0],pts[i][1])};
      const a=palette.alpha*INTENSITY*(.72+b*.12);
      line(); ctx.lineTo(width,height); ctx.lineTo(0,height); ctx.closePath(); ctx.fillStyle=`rgba(${palette.rgb}, ${a})`; ctx.fill();
      line(); ctx.strokeStyle=`rgba(${palette.rgb}, ${a*CREST_ALPHA})`; ctx.lineWidth=CREST_WIDTH; ctx.stroke();
      // pelicans riding this band, drawn now so nearer bands pass in front of farther birds
      ctx.fillStyle=ctx.strokeStyle=`rgba(${palette.inkRgb}, ${PELICAN_OPACITY*INTENSITY*pelicanFade})`;
      if(pelicanFade>0) for(const p of PELICANS){
        if(p.band!==b) continue;
        const span=width+80; let x=(p.x*width+40+p.direction*p.speed*elapsed)%span; if(x<0)x+=span; x-=40;
        drawPelican(ctx,x,surface(x)+1,p.scale*(wide?1:PELICAN_SCALE_NARROW),p.direction,Math.atan2(surface(x+6)-surface(x-6),12));
      }
    }
    for(let i=ripples.length-1;i>=0;i--){
      const r=ripples[i], age=(elapsed-r.born)/RIPPLE_DURATION;
      if(age>=1){ripples.splice(i,1);continue}
      const radius=RIPPLE_MAX_RADIUS*age;
      ctx.beginPath(); ctx.ellipse(r.x,r.y,radius,radius*.26,0,0,Math.PI*2);
      ctx.strokeStyle=`rgba(${palette.rgb}, ${palette.alpha*INTENSITY*2.6*(1-age)})`; ctx.lineWidth=1.8; ctx.stroke();
    }
    if(bird){
      const age=(elapsed-bird.born)/BIRD_DURATION;
      if(age>=1) bird=null;
      else{
        const travel=bird.direction===1?age:1-age;
        ctx.strokeStyle=`rgba(${palette.inkRgb}, ${BIRD_OPACITY*INTENSITY})`; ctx.lineWidth=1.2; ctx.lineCap='round';
        drawBird(ctx,-40+travel*(width+80),bird.y-Math.sin(age*Math.PI)*10,bird.scale,age*26);
      }
    }
    ctx.fillStyle=`rgba(${palette.inkRgb}, ${FISH_OPACITY*INTENSITY})`;
    for(let i=fish.length-1;i>=0;i--){
      const f=fish[i], t=(elapsed-f.born)/f.duration;
      if(t>=1){ripples.push({x:f.x0+f.dx,y:f.baseY,born:elapsed});fish.splice(i,1);continue} // splash where it lands
      const vy=-4*f.h*(1-2*t);
      drawFish(ctx,f.x0+f.dx*t,f.baseY-4*f.h*t*(1-t),Math.atan2(vy,Math.abs(f.dx)||1),f.dx<0?-1:1,f.scale);
    }
  }
  function schedule(){
    if(elapsed>=nextRippleAt){
      ripples.push({x:rand(width*.15,width*.85),y:bandY(Math.floor(Math.random()*BANDS.length)),born:elapsed});
      nextRippleAt=elapsed+rand(...RIPPLE_GAP);
    }
    if(elapsed>=nextBirdAt){
      bird={born:elapsed,y:height*rand(.12,.3),direction:Math.random()<.5?1:-1,scale:rand(.8,1.25)};
      nextBirdAt=elapsed+rand(...BIRD_GAP);
    }
    if(elapsed>=nextFishAt){ // bands 1–3; a fish out of the faintest band would be an odd sight
      const baseY=bandY(1+Math.floor(Math.random()*3)), x0=rand(width*.2,width*.8);
      fish.push({born:elapsed,duration:rand(...FISH_DURATION),x0,dx:(Math.random()<.5?1:-1)*rand(...FISH_DISTANCE),baseY,h:rand(...FISH_HEIGHT),scale:rand(.8,1.3)});
      ripples.push({x:x0,y:baseY,born:elapsed}); // splash where it leaves
      nextFishAt=elapsed+rand(...FISH_GAP);
    }
  }
  function tick(now){
    frame=requestAnimationFrame(tick);
    const delta=now-lastFrame; if(delta<FRAME_MS) return;
    lastFrame=now; elapsed+=Math.min(delta,250)/1000; // capped, so coming back to the app does not fast-forward the water
    schedule(); draw();
  }
  const sync=()=>{
    if(!document.hidden&&!running){running=true;lastFrame=performance.now()-FRAME_MS;frame=requestAnimationFrame(tick)}
    else if(document.hidden&&running){running=false;cancelAnimationFrame(frame)}
  };

  resize(); draw();
  let timer; new ResizeObserver(()=>{clearTimeout(timer);timer=setTimeout(()=>{resize();if(!running)draw()},150)}).observe(canvas);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{palette=readPalette(canvas);if(!running)draw()});
  if(still) return;
  document.addEventListener('visibilitychange',sync); sync();
}

/* ---------- the dandelion ---------- */
const WIND_DEG=-25, SEED_COUNT=42, STAY_COUNT=3, CX=150, CY=130; // a few seeds stubbornly stay on the stem
/* timelines in ms: the flower holds, gusts sweep through, the seeds release (the side the wind heads toward first) and drift away, then it fades.
   QUICK is the website's intro; SLOW lets the flower live about a minute. */
const QUICK={windStart:760,gusts:1,gustEvery:0,scatter:1220,release:780,jitter:120,flight:[1000,1500],settle:2500,fadeStart:2250,fadeDuration:750};
const SLOW={windStart:1500,gusts:4,gustEvery:15000,scatter:3000,release:42000,jitter:6000,flight:[5000,8000],settle:8000,fadeStart:56000,fadeDuration:4000};
const n=v=>Number(v.toFixed(1));

/* the flower's shape, randomised every time so no two are the same */
function buildDandelion(){
  const wr=WIND_DEG*Math.PI/180, wind={x:Math.cos(wr),y:Math.sin(wr)}, perp={x:-wind.y,y:wind.x};
  const stay=new Set(); while(stay.size<STAY_COUNT) stay.add(Math.floor(Math.random()*SEED_COUNT));
  const seeds=[];
  for(let i=0;i<SEED_COUNT;i++){
    const rad=((360/SEED_COUNT)*i+rand(-4.5,4.5))*Math.PI/180, outerR=rand(55,77);
    const tipX=CX+Math.cos(rad)*outerR, tipY=CY+Math.sin(rad)*outerR, baseX=CX+Math.cos(rad)*13, baseY=CY+Math.sin(rad)*13;
    const midX=(baseX+tipX)/2+rand(-2.5,2.5), midY=(baseY+tipY)/2+rand(-2.5,2.5);
    const tuftCount=Math.floor(rand(5,8)), tufts=[];
    for(let j=0;j<tuftCount;j++){
      const a=rad+(j/(tuftCount-1)-.5)*2.2+rand(-.05,.05), len=rand(5,9);
      tufts.push(`<line x1="${n(tipX)}" y1="${n(tipY)}" x2="${n(tipX+Math.cos(a)*len)}" y2="${n(tipY+Math.sin(a)*len)}" stroke-width=".6"/>`);
    }
    const distance=rand(230,400), wobble=rand(8,20);
    seeds.push({
      stays:stay.has(i),
      svg:`<g class="seed"><path d="M${n(baseX)},${n(baseY)} Q${n(midX)},${n(midY)} ${n(tipX)},${n(tipY)}" stroke-width="${rand(.7,1).toFixed(2)}" fill="none"/>${tufts.join('')}</g>`,
      order:(1-(Math.cos(rad)*wind.x+Math.sin(rad)*wind.y))/2, jitter:Math.random(), flight:Math.random(), rotation:rand(-30,60),
      midX:n(wind.x*distance*.42+perp.x*rand(-wobble/2,wobble/2)), midY:n(wind.y*distance*.42+perp.y*rand(-wobble/2,wobble/2)),
      endX:n(wind.x*distance), endY:n(wind.y*distance), settleX:n(rand(-.8,.8)), settleY:n(rand(0,1)),
    });
  }
  const winds=[];
  for(let i=0;i<4;i++){
    const sx=rand(-10,20), sy=rand(30,260), len=rand(65,120), ex=sx-wind.x*len, ey=sy-wind.y*len;
    winds.push({d:`M${n(ex)},${n(ey)} L${n(sx)},${n(sy)}`,length:Math.hypot(sx-ex,sy-ey),delay:i*100,duration:rand(760,960)});
  }
  return {seeds,winds};
}
function dandelionEl(className,{seeds,winds}){
  const el=document.createElement('div');
  el.className=className; el.setAttribute('aria-hidden','true');
  el.innerHTML=`<svg viewBox="0 0 300 320" stroke="currentColor" stroke-linecap="round">
    ${winds.map(w=>`<path class="wind" d="${w.d}" fill="none" stroke-width="1" style="stroke:var(--tint);stroke-dasharray:${w.length};stroke-dashoffset:${w.length};opacity:0"/>`).join('')}
    <path d="M150,300 C138,255 168,195 150,130" stroke-width="1.3" fill="none"/>
    <path d="M150,222 C166,219 180,202 174,187 C159,193 148,209 150,222 Z" stroke-width="1" fill="none"/>
    <circle cx="150" cy="130" r="4.5" stroke-width="1" fill="none"/>
    ${seeds.map(s=>s.svg).join('')}</svg>`;
  return el;
}
/* runs the timeline T on a flower; resolves when it has faded out */
function play(el,{seeds,winds},T){
  el.querySelectorAll('.wind').forEach((p,i)=>{const w=winds[i], every=T.gustEvery||w.duration, L=w.length;
    p.animate([{strokeDashoffset:L,opacity:0,offset:0},{strokeDashoffset:0,opacity:.6,offset:w.duration/2/every},{strokeDashoffset:-L*.3,opacity:0,offset:w.duration/every},{strokeDashoffset:-L*.3,opacity:0,offset:1}],
      {duration:every,iterations:T.gusts,delay:T.windStart+w.delay,easing:'ease-in-out',fill:'forwards'})});
  el.querySelectorAll('.seed').forEach((g,i)=>{const s=seeds[i];
    if(s.stays) g.animate([{transform:'translate(0px, 0px)'},{transform:`translate(${s.settleX}px, ${s.settleY}px)`}],
      {duration:T.settle,delay:T.scatter-260+rand(40,360),easing:'ease-out',fill:'forwards'});
    else g.animate([
      {transform:'translate(0px, 0px) rotate(0deg)',opacity:1},
      {transform:`translate(${s.midX}px, ${s.midY}px) rotate(${(s.rotation*.5).toFixed(0)}deg)`,opacity:1,offset:.5},
      {transform:`translate(${s.endX}px, ${s.endY}px) rotate(${s.rotation.toFixed(0)}deg)`,opacity:0}],
      {duration:T.flight[0]+s.flight*(T.flight[1]-T.flight[0]),delay:T.scatter+s.order*T.release+s.jitter*T.jitter,easing:'cubic-bezier(0.5, 0, 0.85, 1)',fill:'forwards'});
  });
  return el.animate([{opacity:1},{opacity:0}],{duration:T.fadeDuration,delay:T.fadeStart,easing:'cubic-bezier(0.25, 1, 0.5, 1)',fill:'forwards'}).finished;
}

/* blows once, quickly, over the lower middle of the screen, like the website's intro; skipped under reduced motion */
export function blowDandelion(){
  if(reduced()||document.querySelector('.dandelion')) return;
  const geom=buildDandelion(), el=dandelionEl('dandelion',geom);
  document.body.append(el);
  el.animate([{opacity:0},{opacity:1}],{duration:300,easing:'ease-out'});
  play(el,geom,QUICK).then(()=>el.remove(),()=>el.remove());
}
/* a flower to place in the page, whose seeds leave slowly until it is gone after about a minute.
   Under reduced motion it simply stays. Animations keep running when the element is moved, so the caller can re-insert it after a re-render. */
export function slowDandelion(){
  const geom=buildDandelion(), el=dandelionEl('dandelion-slow',geom);
  if(!reduced()) play(el,geom,SLOW).then(()=>{el.dataset.done='1';el.remove()},()=>{});
  return el;
}
