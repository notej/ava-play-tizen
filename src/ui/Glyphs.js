/**
 * Line icons for groups, drawn on a 24 x 24 grid in a colour of their own (the set GroupIcons.kt draws on Android).
 */
const G = {
  bolt: ['#ff9f43', ['M13 2.5L5 13.5h6l-1 8l8-11h-6z']],
  laugh: ['#ffc857', ['M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0z', 'M7.5 13.5c1 2.5 2.7 3.7 4.5 3.7s3.5-1.2 4.5-3.7z', 'M8 9.8c.6-.9 1.6-.9 2.2 0', 'M13.8 9.8c.6-.9 1.6-.9 2.2 0']],
  mask: ['#a78bfa', ['M5 4.5c2.3.9 4.6 1.3 7 1.3s4.7-.4 7-1.3v7.5a7 7 0 0 1-14 0z', 'M8.3 10.2h2.2', 'M13.5 10.2h2.2', 'M9.3 15.8c.7-1.1 4.7-1.1 5.4 0']],
  ghost: ['#ff6b6b', ['M5.5 21V10.5a6.5 6.5 0 0 1 13 0V21l-2.2-1.8l-2.1 1.8l-2.2-1.8l-2.2 1.8l-2.1-1.8z', 'M9.7 10v1', 'M14.3 10v1']],
  planet: ['#38bdf8', ['M6.8 12a5.2 5.2 0 1 0 10.4 0a5.2 5.2 0 1 0 -10.4 0z', 'M16.64 7.61A10.2 3.1 -20 0 1 21.58 8.51A10.2 3.1 -20 0 1 2.42 15.49A10.2 3.1 -20 0 1 5.62 11.62']],
  heart: ['#f472b6', ['M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78l1.06-1.06a5.5 5.5 0 0 0 0-7.78z']],
  wand: ['#818cf8', ['M4 20L14.5 9.5', 'M17 3l.9 2.6l2.6.9l-2.6.9L17 10l-.9-2.6l-2.6-.9l2.6-.9z', 'M7 4v3M5.5 5.5h3', 'M19.5 14.5v3M18 16h3']],
  crown: ['#ffc857', ['M3 8l4.5 4.5L12 5l4.5 7.5L21 8l-1.8 10.5H4.8z', 'M8 15.3h8']],
  sparkles: ['#2dd4bf', ['M10.5 3l1.9 5.6L18 10.5l-5.6 1.9L10.5 18l-1.9-5.6L3 10.5l5.6-1.9z', 'M18.5 14.5l.8 2.2l2.2.8l-2.2.8l-.8 2.2l-.8-2.2l-2.2-.8l2.2-.8z']],
  flame: ['#ff9f43', ['M12 21c3.9 0 6.5-2.6 6.5-6.2c0-3-1.8-4.8-3-6.8c-.4 1.5-1.2 2.3-2.2 2.8c.3-3-1-5.8-3.8-7.8c.2 3-1.2 4.8-2.5 6.6c-1 1.4-1.5 3-1.5 4.7C5.5 18.4 8.1 21 12 21z']],
  reel: ['#a8b3c4', ['M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0z', 'M10.9 12a1.1 1.1 0 1 0 2.2 0a1.1 1.1 0 1 0 -2.2 0z', 'M10.4 7.4a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0 -3.2 0z', 'M10.4 16.6a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0 -3.2 0z', 'M5.8 12a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0 -3.2 0z', 'M15 12a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0 -3.2 0z']],
  compass: ['#2dd4bf', ['M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0z', 'M15.8 8.2l-2.2 5.4l-5.4 2.2l2.2-5.4z']],
  torii: ['#fb7185', ['M3 5.5c3 1.3 15 1.3 18 0', 'M5 10h14', 'M7.5 6.5V21', 'M16.5 6.5V21', 'M12 6.8V10']],
  teddy: ['#a3e635', ['M5 13.5a7 7 0 1 0 14 0a7 7 0 1 0 -14 0z', 'M6.25 9.5A2.9 2.9 0 1 1 9.05 7.15', 'M14.95 7.15A2.9 2.9 0 1 1 17.75 9.5', 'M9.3 12v1', 'M14.7 12v1', 'M12 15v1.3', 'M10.6 16.8c.8.8 2 .8 2.8 0']],
  layers: ['#818cf8', ['M12 2.5L3 7.5l9 5l9-5z', 'M3 12l9 5l9-5', 'M3 16.5l9 5l9-5']],
  trophy: ['#4ade80', ['M7.5 3.5h9v6a4.5 4.5 0 0 1-9 0z', 'M7.5 5.5H4.5c0 3 1.2 4.7 3.2 5', 'M16.5 5.5h3c0 3-1.2 4.7-3.2 5', 'M12 14v3.5', 'M9.5 17.5h5l.8 3H8.7z']],
  note: ['#a78bfa', ['M9 18V5.5l11-2V16', 'M4 18a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0z', 'M15 16a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0z']],
  news: ['#60a5fa', ['M4 4.5h12V19a2 2 0 0 0 4 0V9h-4', 'M4 4.5V19a2 2 0 0 0 2 2h12', 'M7 8.5h6', 'M7 12h6', 'M7 15.5h3.5']],
  clapper: ['#ff6b6b', ['M5.5 5h13a2 2 0 0 1 2 2v11a2 2 0 0 1 -2 2h-13a2 2 0 0 1 -2 -2v-11a2 2 0 0 1 2 -2z', 'M3.5 10h17', 'M8.5 5l-2 5', 'M13.5 5l-2 5', 'M18.5 5l-2 5']],
  star: ['#ffc857', ['M12 3.5l2.6 5.4l5.9.8l-4.3 4.1l1 5.8L12 16.8l-5.2 2.8l1-5.8L3.5 9.7l5.9-.8z']],
  grid: ['#a8b3c4', ['M4 4h6.5v6.5H4z', 'M13.5 4H20v6.5h-6.5z', 'M4 13.5h6.5V20H4z', 'M13.5 13.5H20V20h-6.5z']]
};

// What a group's name says it holds, first match wins
const RULES = [
  [/4k|uhd|2160/i, 'mono:4K', '#ffc857'],
  [/top|best|award|oscar|winner/i, 'crown'],
  [/new|latest|recent|release/i, 'sparkles'],
  [/sport|football|soccer|nba|ufc|boxing/i, 'trophy'],
  [/kid|family|cartoon|child|disney/i, 'teddy'],
  [/anime|asia|japan|korea/i, 'torii'],
  [/comed|funny/i, 'laugh'],
  [/horror|scary/i, 'ghost'],
  [/thriller|crime|myster/i, 'mask'],
  [/action|adventure|war/i, 'bolt'],
  [/sci-?fi|space/i, 'planet'],
  [/romanc|love/i, 'heart'],
  [/fantas|magic/i, 'wand'],
  [/music|concert/i, 'note'],
  [/document|nature|histor/i, 'compass'],
  [/news/i, 'news'],
  [/drama/i, 'layers']
];

export function glyphFor(name) {
  for (const [re, glyph] of RULES) if (re.test(name || '')) return glyph;
  return 'clapper';
}

export function glyphHtml(name) {
  if (name.startsWith('mono:')) {
    const text = name.slice(5);
    return `<i class="mv-glyph-mono" style="--tint:#ffc857">${text}</i>`;
  }
  const entry = G[name] || G.clapper;
  const [tint, paths] = entry;
  return `<svg viewBox="0 0 24 24" fill="none" stroke="${tint}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths.map((d) => `<path d="${d}"/>`).join('')}</svg>`;
}

/** A country's flag, shipped with the app (flag-icons, MIT); if the file is missing the country's code is shown instead */
export function flagHtml(code, cls = '') {
  const c = String(code || '').toLowerCase();
  return `<i class="flagbox ${cls}"><img src="./flags/${c}.svg" alt="" onerror="this.parentNode.classList.add('nofile')"><b>${String(code || '').toUpperCase()}</b></i>`;
}
