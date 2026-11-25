/* Kept themes: extra looks, bought in the Shop with Pelican Coins and switched on in Shop → Owned.
   Each theme lives in its own folder, app/themes/<id>/theme.css, and every rule in it is scoped to [data-skin="<id>"]
   (set on <html> by ui.js applyTheme, and by index.html before the first paint), so it changes nothing while it is off.
   A theme can recolour the app through the colour tokens (--bg, --surface, --tint …, in light and dark mode), recolour the lake
   (--water-rgb, --water-alpha, --island-rgb, --island-alpha, and the colour of #water for the pelicans), and dress the scenery
   slots in index.html (#skin behind the lake and #skin-front in front of it, each with six <i> children, .s1–.s6 and .f1–.f6,
   hidden unless a theme shows them).

   The Shop: available:true puts a theme on sale for price coins. Set available:false to take it off sale: it leaves the Shop
   until it is set back to true, but everyone who bought it keeps it and can still use it. Each theme also has, for its Shop card:
   tag (a small label above the picture, '' for none), short (one line), shop-light.jpg and shop-dark.jpg in its folder (the
   scenery, phone-shaped, 390 × 844 at 2×), swatch (the light and dark dots) and tint (its accent colour, in light and dark mode).

   To add one: make its folder, add a line here, and add its files to the list in sw.js (so it works offline).
   Never delete a theme someone may have bought: take it off sale instead. */
export const THEMES=[
  {id:'vice-city',name:'Vice City',hint:'For a limited time, to celebrate the release of Grand Theft Auto VI: a neon Vice City sunset over the lake, with palm trees swaying on the beach.',
    short:'Neon sunset and swaying palms.',tag:'Limited time',available:true,price:10,
    color:{light:'#FFE4EE',dark:'#12061F'}, // the status bar colour in each mode
    swatch:{light:'#FF9EC4',dark:'#3A1250'},tint:{light:'#E0187A',dark:'#FF4FB3'}},
  {id:'dig-a-hole',name:'Dig a Hole',hint:'Airbrushed pearl and chrome: a pearl moon over the lake, a freshly dug hole and pink goo.',
    short:'Pearl moon, a hole and pink goo.',tag:'New',available:true,price:10,
    color:{light:'#D4D3DC',dark:'#142119'},
    swatch:{light:'#A9C6E8',dark:'#1E3A2A'},tint:{light:'#4A5DB0',dark:'#E25D9E'}},
  {id:'surreal-christmas',name:'Let it be Christmas',hint:'For the holidays: a Christmas tree, snow puffs hopping over the lake, giant baubles on the water and a moon in a Santa hat.',
    short:'A tree, snow puffs and a Santa moon.',tag:'Holiday',available:true,price:10,
    color:{light:'#9DBDE3',dark:'#050B1A'},
    swatch:{light:'#9DBDE3',dark:'#0B1830'},tint:{light:'#D7263D',dark:'#FF4D5E'}},
  {id:'barcelona-nights',name:'Barcelona Fan Edition',hint:'Blue and garnet under the floodlights: a stadium on the lake in place of the island, confetti and fireworks, the stands lit up and a football bouncing across the water.',
    short:'Floodlights, confetti and a bouncing ball.',tag:'New',available:true,price:10,
    color:{light:'#F4F8FF',dark:'#020714'},
    swatch:{light:'#3D7CC9',dark:'#A50044'},tint:{light:'#A50044',dark:'#FF4F86'}},
];
export const themeById=id=>THEMES.find(t=>t.id===id)||null;
export const themeHref=id=>`themes/${id}/theme.css`;
export const shopImage=(id,mode)=>`themes/${id}/shop-${mode==='dark'?'dark':'light'}.jpg`;
