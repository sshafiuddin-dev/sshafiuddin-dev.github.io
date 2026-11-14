// Builds the Iqama Times guide: node scripts/guide/build.mjs
// Each chapter's text is in scripts/guide/chapters/<slug>.html; this wraps it in the shared page (top bar, contents,
// previous and next) and writes iqama/guide/<slug>.html, plus the guide's front page iqama/guide/index.html.
// The output is committed, so the site still needs no build step, like daisy.css.
//
// Shorthand the chapter files can use:
//   <shot src="today-top.jpg" alt="…" pins="1@79,7 2@25,12">Caption</shot>
//     a screenshot from iqama/guide/img with numbered pins at x%,y% of the picture; the numbers match the steps under it
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '../../iqama/guide');

export const CHAPTERS = [
  { slug: 'setup', title: 'Set up your tablet', blurb: 'Android, Fire or iPad: add the app, keep the screen on, allow sound.' },
  { slug: 'location', title: 'Your location and times', blurb: 'ISCJ times or your own city, calculation method, Hijri date.' },
  { slug: 'today', title: 'Reading the Today screen', blurb: 'The clock, the five prayers, iqama, the countdown and the dua.' },
  { slug: 'iqama', title: 'Iqama times', blurb: 'Follow ISCJ, set a fixed time, or minutes after the adhan.' },
  { slug: 'alerts', title: 'Adhan and alerts', blurb: 'Adhan at prayer time, reminders before adhan and iqama.' },
  { slug: 'display', title: 'Display and night mode', blurb: 'Clock styles, looks, brightness, dimming after Isha.' },
  { slug: 'quran', title: 'Quran', blurb: 'Reciters, surahs, favourites and playlists.' },
  { slug: 'adhkar', title: 'Adhkar and Month', blurb: 'Hisn al-Muslim chapters and the monthly timetable.' },
  { slug: 'weather', title: 'Weather', blurb: 'Today, the week ahead, and the weather at each prayer.' },
  { slug: 'help', title: 'Help and questions', blurb: 'No sound, wrong times, the screen went dark, and more.' },
];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const BRAND = '<svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="6" class="brand-bg"/><path d="M8 29V15C8 9.5 12.5 6.5 16 3.5C19.5 6.5 24 9.5 24 15V29Z" class="brand-sq"/><rect x="11" y="16.5" width="10" height="2.6" class="brand-accent"/><rect x="11" y="22" width="10" height="2.2" class="brand-bg"/></svg>';

// Screenshots are 800×469. crop="x0,y0,x1,y1" (pixels) shows only that part, so it reads larger on a phone;
// pins="1@x,y 2@x,y" are pixel positions on the full screenshot.
const SW = 800, SH = 469;
const pct = (v) => +(v * 100).toFixed(2);
function shots(html) {
  return html.replace(/<shot\s+([^>]*)>([\s\S]*?)<\/shot>/g, (_, attrs, cap) => {
    const a = Object.fromEntries([...attrs.matchAll(/(\w+)="([^"]*)"/g)].map(m => [m[1], m[2]]));
    const [x0, y0, x1, y1] = (a.crop || `0,0,${SW},${SH}`).split(',').map(Number), cw = x1 - x0, ch = y1 - y0;
    const marks = (a.pins || '').trim() ? a.pins.trim().split(/\s+/).map(p => {
      const [n, at] = p.split('@'), [x, y] = at.split(',').map(Number);
      return `<span class="g-pin" style="--x:${pct((x - x0) / cw)}%;--y:${pct((y - y0) / ch)}%" aria-hidden="true">${n}</span>`;
    }).join('') : '';
    const cropped = a.crop ? ` style="aspect-ratio:${cw}/${ch}"` : '';
    const imgStyle = a.crop ? ` style="position:absolute;max-width:none;width:${pct(SW / cw)}%;left:${pct(-x0 / cw)}%;top:${pct(-y0 / ch)}%"` : '';
    return `<figure class="g-shot"><a class="g-shot-frame${a.crop ? ' g-crop' : ''}" href="img/${a.src}"${cropped}><img src="img/${a.src}" alt="${a.alt}" width="${SW}" height="${SH}" loading="lazy" decoding="async"${imgStyle}>${marks}</a>`
      + `<figcaption>${cap.trim()} <span class="g-zoom">(tap to see the whole screen)</span></figcaption></figure>`;
  });
}

// <device title="Display" path="Settings › Display" rows="Brightness|Screen timeout=Never*|Font size">Caption</device>
// A plain drawing of a settings screen, not any maker's real one. "Label=Value" puts the value on the right,
// "=on" draws a switch, and a trailing * marks the row to tap.
function devices(html) {
  return html.replace(/<device\s+title="([^"]+)"\s+path="([^"]*)"\s+rows="([^"]+)"\s*>([\s\S]*?)<\/device>/g, (_, title, path, rows, cap) => {
    const list = rows.split('|');
    const h = 96 + list.length * 40, W = 420;
    const parts = list.map((r, i) => {
      const hi = r.endsWith('*'), [label, value = ''] = r.replace(/\*$/, '').split('='), y = 78 + i * 40;
      const val = value === 'on'
        ? `<rect x="${W - 86}" y="${y + 11}" width="34" height="18" rx="9" class="dv-on"/><circle cx="${W - 61}" cy="${y + 20}" r="7" class="dv-knob"/>`
        : value ? `<text x="${W - 50}" y="${y + 25}" text-anchor="end" class="dv-muted">${esc(value)} ›</text>` : `<text x="${W - 50}" y="${y + 25}" text-anchor="end" class="dv-muted">›</text>`;
      return `<rect x="44" y="${y}" width="${W - 88}" height="38" rx="3" class="${hi ? 'dv-hi' : 'dv-row'}"/><text x="58" y="${y + 24}" class="dv-text">${esc(label)}</text>${val}`;
    }).join('');
    return `<figure class="g-device"><svg viewBox="0 0 ${W} ${h}" role="img" aria-label="${esc(path)}"><rect x="10" y="10" width="${W - 20}" height="${h - 20}" rx="18" class="dv-body"/><rect x="28" y="26" width="${W - 56}" height="${h - 52}" rx="4" class="dv-screen"/>`
      + `<text x="44" y="52" class="dv-title">${esc(title)}</text><text x="${W - 44}" y="52" text-anchor="end" class="dv-muted">${esc(path)}</text>${parts}</svg>`
      + `<figcaption>${cap.trim()}</figcaption></figure>`;
  });
}

function toc(current) {
  const items = CHAPTERS.map(c => `<li><a href="${c.slug}.html"${c.slug === current ? ' aria-current="page"' : ''}>${esc(c.title)}</a></li>`).join('');
  const where = current ? `Chapter ${CHAPTERS.findIndex(c => c.slug === current) + 1} of ${CHAPTERS.length}` : 'Guide';
  return `<nav aria-label="Chapters"><details class="g-toc"><summary>${where}</summary><ol><li class="g-home"><a href="./"${current ? '' : ' aria-current="page"'}>Start here</a></li>${items}</ol></details></nav>`;
}

function page({ slug, title, description, body }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<script src="../boot.js"></script>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="theme-color" content="#F3EDE1">
<link rel="icon" href="../icons/favicon.svg" type="image/svg+xml">
<link rel="icon" href="../favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="../apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&family=Newsreader:ital,opsz,wght@0,6..72,400..600;1,6..72,400&display=swap">
<link rel="stylesheet" href="../look.css">
<link rel="stylesheet" href="guide.css">
<script src="guide.js" defer></script>
</head>
<body class="g">
<header class="g-top"><a class="g-brand" href="./">${BRAND}<span>Iqama Times <em>guide</em></span></a><a class="g-btn g-btn-ink" href="../">Open the app</a></header>
<div class="g-wrap">
${toc(slug)}
<main class="g-main" id="main">
${body}
</main>
</div>
<footer class="g-foot">Iqama Times keeps your settings on this device. <a href="../#settings">Settings</a> · <a href="help.html">Help and questions</a> · <a href="/">Shafiuddin Syed</a></footer>
</body>
</html>
`;
}

for (const [i, c] of CHAPTERS.entries()) {
  const src = join(here, 'chapters', `${c.slug}.html`);
  if (!existsSync(src)) { console.log(`skip ${c.slug} (no text yet)`); continue; }
  const prev = CHAPTERS[i - 1], next = CHAPTERS[i + 1];
  const pager = `<nav class="g-pager" aria-label="Previous and next chapter">`
    + (prev ? `<a class="g-prev" href="${prev.slug}.html" rel="prev"><small>Previous</small><span>${esc(prev.title)}</span></a>` : `<a class="g-prev" href="./" rel="prev"><small>Back to</small><span>Start here</span></a>`)
    + (next ? `<a class="g-next" href="${next.slug}.html" rel="next"><small>Next · ${i + 2}</small><span>${esc(next.title)}</span></a>` : `<a class="g-next" href="../"><small>Done</small><span>Open the app</span></a>`)
    + `</nav>`;
  const body = `<p class="g-kicker">Chapter ${i + 1}</p>\n<h1>${esc(c.title)}</h1>\n${devices(shots(readFileSync(src, 'utf8'))).trim()}\n${pager}`;
  writeFileSync(join(out, `${c.slug}.html`), page({ slug: c.slug, title: `${c.title} · Iqama Times guide`, description: c.blurb, body }));
  console.log(`wrote ${c.slug}.html`);
}

const cards = CHAPTERS.map((c, i) => `<li><a href="${c.slug}.html"><b>Chapter ${i + 1}</b><strong>${esc(c.title)}</strong><span>${esc(c.blurb)}</span></a></li>`).join('\n');
const home = readFileSync(join(here, 'chapters', '_home.html'), 'utf8').replace('<!-- chapters -->', `<ol class="g-cards">\n${cards}\n</ol>`);
writeFileSync(join(out, 'index.html'), page({ slug: null, title: 'Iqama Times guide', description: 'How to turn a spare tablet into a home prayer hub with Iqama Times, and how to use every screen.', body: shots(home).trim() }));
console.log('wrote index.html');
