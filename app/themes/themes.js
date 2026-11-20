/* Kept themes: extra looks the owner can switch on in Settings → Theme.
   Each theme lives in its own folder, app/themes/<id>/theme.css, and every rule in it is scoped to [data-skin="<id>"]
   (set on <html> by ui.js applyTheme, and by index.html before the first paint), so it changes nothing while it is off.
   A theme can recolour the app through the colour tokens (--bg, --surface, --tint …, in light and dark mode), recolour the lake
   (--water-rgb, --water-alpha, --island-rgb, --island-alpha, and the colour of #water for the pelicans), and dress the scenery
   slots in index.html (#skin behind the lake and #skin-front in front of it, each with four <i> children, hidden unless a theme
   shows them).

   Only themes with visible:true appear in Settings. To add one: make its folder, add a line here, and add its file to the
   list in sw.js (so it works offline). To retire one: set visible:false (anyone using it goes back to the standard look),
   then delete its folder, its line here and its line in sw.js. */
export const THEMES=[
  {id:'vice-city',name:'Vice City',hint:'For a limited time, to celebrate the release of Grand Theft Auto VI: a neon Vice City sunset over the lake, with palm trees swaying on the beach.',visible:true,
    color:{light:'#FFE4EE',dark:'#12061F'}}, // the status bar colour in each mode
  {id:'dig-a-hole',name:'Dig a Hole',hint:'Airbrushed pearl and chrome: a pearl moon over the lake, a freshly dug hole and pink goo.',visible:true,
    color:{light:'#D4D3DC',dark:'#142119'}},
];
export const visibleThemes=()=>THEMES.filter(t=>t.visible);
export const themeById=id=>THEMES.find(t=>t.id===id)||null;
export const themeHref=id=>`themes/${id}/theme.css`;
