#!/usr/bin/env node
// Restyles the SVG made by abozanona/pacman-contribution-graph into a neon arcade cabinet:
//  - pixel-art HUD (drawn as shapes, so it never depends on installed fonts)
//  - a live score that counts up as Pac-Man eats your real contribution pellets
//  - round glowing pellets, neon maze, light-sweep frame, starfield, scanlines
// Usage: node neonize.js <input.svg> <output.svg>
const fs = require('fs');

const [, , input, output] = process.argv;
if (!input || !output) {
  console.error('usage: neonize.js <input.svg> <output.svg>');
  process.exit(2);
}

const src = fs.readFileSync(input, 'utf8');
const head = src.match(/<svg\b[^>]*\bwidth="(\d+(?:\.\d+)?)"[^>]*\bheight="(\d+(?:\.\d+)?)"[^>]*>/);
if (!head || !src.includes('id="pacman"') || !src.trimEnd().endsWith('</svg>')) {
  console.error('Input does not look like a pacman-contribution-graph SVG; leaving it untouched.');
  process.exit(1);
}
const W = Number(head[1]);
const H = Number(head[2]);
const durMatch = src.match(/\bdur="(\d+)ms"/);
const DUR = durMatch ? Number(durMatch[1]) : 0;

// ---------------------------------------------------------------- pellets eaten over time
// Every contribution cell flips from a level colour to the empty colour at the moment
// Pac-Man eats it. Read those moments from the original, before any recolouring.
const EMPTY = '#161b22';
const eatTimes = [];
for (const m of src.matchAll(/<rect id="c-\d+-\d+"[^>]*>\s*<animate[^>]*?values="([^"]*)"[^>]*?keyTimes="([^"]*)"/g)) {
  const vals = m[1].split(';').map((v) => v.trim().toLowerCase());
  const kts = m[2].split(';').map(Number);
  if (vals.length !== kts.length || vals.length < 2) continue;
  for (let i = 1; i < vals.length; i++) {
    if (vals[i] === EMPTY && vals[i - 1] !== EMPTY) { eatTimes.push(kts[i]); break; }
  }
}
eatTimes.sort((a, b) => a - b);
const POINTS = 10; // score per pellet, like the arcade original

// ---------------------------------------------------------------- pixel font (5x7)
const FONT = {
  '0': '01110 10001 10011 10101 11001 10001 01110', '1': '00100 01100 00100 00100 00100 00100 01110',
  '2': '01110 10001 00001 00010 00100 01000 11111', '3': '11110 00001 00001 01110 00001 00001 11110',
  '4': '00010 00110 01010 10010 11111 00010 00010', '5': '11111 10000 11110 00001 00001 10001 01110',
  '6': '00110 01000 10000 11110 10001 10001 01110', '7': '11111 00001 00010 00100 01000 01000 01000',
  '8': '01110 10001 10001 01110 10001 10001 01110', '9': '01110 10001 10001 01111 00001 00010 01100',
  A: '01110 10001 10001 11111 10001 10001 10001', C: '01110 10001 10000 10000 10000 10001 01110',
  D: '11110 10001 10001 10001 10001 10001 11110', E: '11111 10000 10000 11110 10000 10000 11111',
  G: '01110 10001 10000 10111 10001 10001 01111', H: '10001 10001 10001 11111 10001 10001 10001',
  I: '01110 00100 00100 00100 00100 00100 01110', L: '10000 10000 10000 10000 10000 10000 11111',
  O: '01110 10001 10001 10001 10001 10001 01110', P: '11110 10001 10001 11110 10000 10000 10000',
  R: '11110 10001 10001 11110 10100 10010 10001', S: '01111 10000 10000 01110 00001 00001 11110',
  T: '11111 00100 00100 00100 00100 00100 00100', U: '10001 10001 10001 10001 10001 10001 01110',
  V: '10001 10001 10001 10001 10001 01010 00100', Y: '10001 10001 01010 00100 00100 00100 00100',
  '!': '00100 00100 00100 00100 00100 00000 00100', ' ': '00000 00000 00000 00000 00000 00000 00000',
};

// Path data for a string at (0,0); returns { d, w }.
function pixelPath(text, s) {
  let d = '';
  let x0 = 0;
  for (const ch of text) {
    const rows = (FONT[ch] || FONT[' ']).split(' ');
    rows.forEach((row, y) => {
      for (let x = 0; x < 5; x++) {
        if (row[x] !== '1') continue;
        let run = 1;
        while (row[x + run] === '1') run++;
        d += `M${x0 + x * s} ${y * s}h${run * s}v${s}h${-run * s}z`;
        x += run - 1;
      }
    });
    x0 += 6 * s;
  }
  return { d, w: x0 - s };
}

function pixelText(text, x, y, s, fill, anchor = 'start', extra = '') {
  const { d, w } = pixelPath(text, s);
  const ox = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x;
  return `<path transform="translate(${ox},${y})" d="${d}" fill="${fill}" shape-rendering="crispEdges"${extra}/>`;
}

// ---------------------------------------------------------------- restyle the original
let inner = src.slice(head.index + head[0].length, src.lastIndexOf('</svg>'));
inner = inner.replace(/<rect width="100%" height="100%" fill="#[0-9a-fA-F]{6}"\s*\/>/, '');

// Round pellets instead of square blocks (20px cell -> 14px dot).
inner = inner.replace(
  /<rect id="(c-\d+-\d+)" x="(-?[\d.]+)" y="(-?[\d.]+)" width="20" height="20" rx="5"/g,
  (_, id, x, y) => `<rect id="${id}" x="${Number(x) + 3}" y="${Number(y) + 3}" width="14" height="14" rx="7"`,
);

const COLORS = {
  '#161b22': '#171355', // empty
  '#0e4429': '#2a33b8', // level 1
  '#006d32': '#3f5bff', // level 2
  '#26a641': '#00c2ff', // level 3
  '#39d353': '#9bf9ff', // level 4
  '#8b949e': '#8f95ff', // month labels
  '#ffffff': '#7d96ff', // maze walls
};
inner = inner.replace(/#[0-9a-fA-F]{6}\b/g, (c) => COLORS[c.toLowerCase()] || c);

// One glow filter over the whole maze (a single group is far cheaper than per-wall filters).
const wallRe = /<rect id="w[hv]-[^>]*><\/rect>/g;
const walls = [...inner.matchAll(wallRe)];
if (walls.length) {
  const a = walls[0].index;
  const last = walls[walls.length - 1];
  const b = last.index + last[0].length;
  if (inner.slice(a, b).replace(wallRe, '').replace(/\s+/g, '') === '') {
    inner = `${inner.slice(0, a)}<g filter="url(#neonBlue)">${inner.slice(a, b)}</g>${inner.slice(b)}`;
  }
}
inner = inner.replace('<path id="pacman"', '<path id="pacman" filter="url(#glowYellow)"');
inner = inner.replace(/<text /g, '<text font-family="ui-monospace,Menlo,Consolas,monospace" ');

// ---------------------------------------------------------------- layout
const PX = 24, TOP = 70, BOT = 50;
const NW = W + PX * 2;
const NH = H + TOP + BOT;
const blink = '<animate attributeName="opacity" values="1;0" keyTimes="0;0.5" dur="1.2s" calcMode="discrete" repeatCount="indefinite"/>';

// ---------------------------------------------------------------- live score
const DIGITS = 6;
const S = 3; // pixel size for the score
const ADV = 6 * S;
const scoreW = DIGITS * ADV - S;
const total = eatTimes.length * POINTS;
const pad = (n) => String(n).padStart(DIGITS, '0');

// Cumulative score at each distinct eat time.
const steps = []; // [time, score]
{
  let score = 0;
  for (const t of eatTimes) {
    score += POINTS;
    if (steps.length && steps[steps.length - 1][0] === t) steps[steps.length - 1][1] = score;
    else steps.push([t, score]);
  }
}
const startScore = steps.length && steps[0][0] <= 0 ? steps.shift()[1] : 0;

const fmt = (t) => Number(t.toFixed(6)).toString();
function scoreDigits(x, y, fill) {
  let out = '';
  for (let p = 0; p < DIGITS; p++) {
    const px = x + p * ADV;
    const timeline = [[0, pad(startScore)[p]]];
    for (const [t, sc] of steps) {
      const dgt = pad(sc)[p];
      if (dgt !== timeline[timeline.length - 1][1]) timeline.push([t, dgt]);
    }
    if (timeline.length === 1 || !DUR) {
      out += `<use href="#g${timeline[0][1]}" x="${px}" y="${y}" fill="${fill}"/>`;
      continue;
    }
    for (let d = 0; d <= 9; d++) {
      const ds = String(d);
      if (!timeline.some(([, v]) => v === ds)) continue;
      const kt = timeline.map(([t]) => fmt(t)).join(';');
      const vals = timeline.map(([, v]) => (v === ds ? 'visible' : 'hidden')).join(';');
      out += `<use href="#g${d}" x="${px}" y="${y}" fill="${fill}" visibility="${timeline[0][1] === ds ? 'visible' : 'hidden'}">`
        + `<animate attributeName="visibility" dur="${DUR}ms" repeatCount="indefinite" calcMode="discrete" keyTimes="${kt}" values="${vals}"/></use>`;
    }
  }
  return out;
}
const glyphDefs = Array.from({ length: 10 }, (_, d) => `<path id="g${d}" d="${pixelPath(String(d), S).d}" shape-rendering="crispEdges"/>`).join('');

// ---------------------------------------------------------------- starfield (deterministic)
let seed = 7;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
let stars = '';
for (let i = 0; i < 46; i++) {
  const inTop = i % 2 === 0;
  const x = 14 + rnd() * (NW - 28);
  const y = inTop ? 8 + rnd() * (TOP - 14) : NH - BOT + 4 + rnd() * (BOT - 12);
  const r = (0.5 + rnd() * 0.8).toFixed(2);
  const dur = (2 + rnd() * 3).toFixed(1);
  const col = rnd() > 0.7 ? '#ff9bf0' : '#9bd8ff';
  stars += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="${col}" opacity="0.5">`
    + `<animate attributeName="opacity" values="0.15;0.85;0.15" dur="${dur}s" begin="-${(rnd() * 4).toFixed(1)}s" repeatCount="indefinite"/></circle>`;
}

// ---------------------------------------------------------------- lives icons
const R = 7;
const c30 = (R * Math.cos(Math.PI / 6)).toFixed(2);
const s30 = (R * Math.sin(Math.PI / 6)).toFixed(2);
const life = (cx, cy) => `<path d="M${cx} ${cy}L${cx + Number(c30)} ${cy + Number(s30)}A${R} ${R} 0 1 1 ${cx + Number(c30)} ${cy - Number(s30)}Z" fill="#ffe600"/>`;
const botY = H + TOP + BOT / 2 - 1;

const out = `<svg xmlns="http://www.w3.org/2000/svg" width="${NW}" height="${NH}" viewBox="0 0 ${NW} ${NH}">
<title>Pac-Man eating my GitHub contributions</title>
<defs>
  ${glyphDefs}
  <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#0b0730"/><stop offset="0.55" stop-color="#05021a"/><stop offset="1" stop-color="#03010d"/>
  </linearGradient>
  <radialGradient id="aura" cx="50%" cy="52%" r="60%">
    <stop offset="0" stop-color="#3a1f9e" stop-opacity="0.38"/><stop offset="1" stop-color="#3a1f9e" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="vig" cx="50%" cy="50%" r="75%">
    <stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.55"/>
  </radialGradient>
  <linearGradient id="sweep" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${NW}" y2="0" spreadMethod="repeat">
    <stop offset="0" stop-color="#00e5ff"/><stop offset="0.5" stop-color="#b13cff"/><stop offset="1" stop-color="#00e5ff"/>
    <animateTransform attributeName="gradientTransform" type="translate" from="0 0" to="${NW} 0" dur="7s" repeatCount="indefinite"/>
  </linearGradient>
  <pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse">
    <rect width="4" height="1" y="3" fill="#000" opacity="0.30"/>
  </pattern>
  <filter id="neonBlue" x="-3%" y="-15%" width="106%" height="130%">
    <feGaussianBlur in="SourceGraphic" stdDeviation="2.6" result="b"/>
    <feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <filter id="glowYellow" x="-60%" y="-60%" width="220%" height="220%">
    <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="b"/>
    <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <filter id="glowText" x="-20%" y="-60%" width="140%" height="220%">
    <feGaussianBlur in="SourceGraphic" stdDeviation="1.4" result="b"/>
    <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
</defs>
<rect width="${NW}" height="${NH}" rx="20" fill="url(#bg)"/>
<rect width="${NW}" height="${NH}" rx="20" fill="url(#aura)"/>
${stars}
<rect x="2" y="2" width="${NW - 4}" height="${NH - 4}" rx="18" fill="none" stroke="url(#sweep)" stroke-width="2.5" filter="url(#neonBlue)"/>
<rect x="10" y="10" width="${NW - 20}" height="${NH - 20}" rx="12" fill="none" stroke="#2a33b8" stroke-width="1" opacity="0.7"/>
<g filter="url(#glowText)">
  <g>${pixelText('1UP', PX, 14, 2, '#ff3b3b')}<animate attributeName="opacity" values="1;0" keyTimes="0;0.5" dur="1.2s" calcMode="discrete" repeatCount="indefinite"/></g>
  ${pixelText('HIGH SCORE', NW / 2, 14, 2, '#ffffff', 'middle')}
  ${pixelText('CREDIT 01', NW - PX, 14, 2, '#8f95ff', 'end')}
  ${scoreDigits(PX, 38, '#ffffff')}
  ${pixelText(pad(total), NW / 2 - scoreW / 2, 38, S, '#ffe600')}
</g>
<rect x="${PX - 8}" y="${TOP - 8}" width="${W + 16}" height="${H + 16}" rx="12" fill="#04011a" fill-opacity="0.6" stroke="#2a33b8" stroke-opacity="0.55"/>
<g transform="translate(${PX},${TOP})">${inner}</g>
${life(PX + 8, botY)}${life(PX + 28, botY)}${life(PX + 48, botY)}
<g filter="url(#glowText)">
  <g>${pixelText('READY!', NW / 2, botY - 10, 3, '#ffe600', 'middle')}${blink}</g>
  ${pixelText('LEVEL 01', NW - PX, botY - 7, 2, '#8f95ff', 'end')}
</g>
<rect width="${NW}" height="${NH}" rx="20" fill="url(#scan)" pointer-events="none"/>
<rect width="${NW}" height="${NH}" rx="20" fill="url(#vig)" pointer-events="none"/>
</svg>
`;

fs.writeFileSync(output, out);
console.log(`neon SVG written: ${output} (${NW}x${NH}, ${(out.length / 1024).toFixed(0)} KB, ${eatTimes.length} pellets, final score ${total})`);
