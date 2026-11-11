// The six clock styles. Each takes the same snapshot of the day and returns its markup; app.js redraws every second.
// d = { sec, now (minutes, fractional), rows: [{ key, adhan, iqama }], sunrise, next: { key, kind, at }, jumuah: [minutes], date }
import { NAMES, fmt, fmtSpan } from './logic.js';

export const CLOCKS = { board: 'Masjid board', dial: '24-hour dial', analog: 'Analog clock face', sun: 'Sun path', timeline: 'Day timeline', bedside: 'Bedside, low glare' };

const hm = (min) => fmt(min).replace(/ [AP]M$/, '');
const ampm = (min) => fmt(min).slice(-2);
const f1 = (n) => n.toFixed(1);
const untilNext = (d) => fmtSpan(d.next.at * 60 - d.sec);
const nextAt = (d) => `at ${fmt(d.next.at)}${d.next.at >= 1440 ? ' tomorrow' : ''}`;
const nextName = (d) => `${NAMES[d.next.key]} ${d.next.kind}`.trim();
// the countdown blinks (soft, once a second) in its last 15 minutes
const soon = (d) => (d.next.at * 60 - d.sec < 900 ? ' ck-blink' : '');
const stack = (cls, d) => `<div class="${cls}"><p>${nextName(d)} in</p><p class="ck-count${soon(d)}">${untilNext(d)}</p><p>${nextAt(d)}</p></div>`;

function dial(d) {
  const C = 180, R = 122;
  const xy = (v, r = R) => { const a = v / 1440 * 2 * Math.PI; return [f1(C - r * Math.sin(a)), f1(C + r * Math.cos(a))]; };
  const at = (v, r) => xy(v, r).join(',');
  const arc = (a, b) => `M${at(a)} A${R} ${R} 0 ${b - a > 720 ? 1 : 0} 1 ${at(b)}`;
  let s = `<circle class="ck-ring" cx="${C}" cy="${C}" r="${R}"/><path class="ck-day" d="${arc(d.sunrise, d.rows[3].adhan)}"/>`;
  for (const r of d.rows) {
    if (r.iqama > r.adhan) s += `<path class="ck-iqama" d="${arc(r.adhan, r.iqama)}"/>`;
    const [tx, ty] = xy(r.adhan, R + 32);
    s += `<path class="ck-tick" d="M${at(r.adhan, R - 11)} L${at(r.adhan, R + 11)}"/><text x="${tx}" y="${ty}">${NAMES[r.key]}</text>`;
  }
  const [hx, hy] = xy(d.now);
  return `<div class="ck-dial"><svg viewBox="0 0 360 360" aria-hidden="true">${s}<circle class="ck-now" cx="${hx}" cy="${hy}" r="8"/></svg>${stack('ck-center', d)}</div>`;
}

function analog(d) {
  const pos = (deg, r) => { const a = deg * Math.PI / 180; return [f1(180 + r * Math.sin(a)), f1(180 - r * Math.cos(a))]; };
  const pt = (deg, r) => pos(deg, r).join(',');
  let ticks = '';
  for (let i = 0; i < 12; i++) ticks += `M${pt(i * 30, 150)} L${pt(i * 30, i % 3 ? 141 : 132)} `;
  let marks = '';
  for (const r of d.rows) {
    if ((r.adhan - d.now + 1440) % 1440 >= 720) continue; // only the next 12 hours, so morning and evening prayers never share a spot
    const deg = (r.adhan % 720) / 2, [x, y] = pos(deg, 150), [tx, ty] = pos(deg, 116);
    marks += `<circle class="ck-mark" cx="${x}" cy="${y}" r="7"/><text class="ck-strong" x="${tx}" y="${ty}">${NAMES[r.key]} ${hm(r.adhan)}</text>`;
  }
  const start = (d.now % 720) / 2, sweep = Math.min(359, (d.next.at - d.now) / 2);
  const wedge = `M180 180 L${pt(start, 150)} A150 150 0 ${sweep > 180 ? 1 : 0} 1 ${pt(start + sweep, 150)} Z`;
  const hand = (cls, deg, r) => { const [x, y] = pos(deg, r); return `<line class="${cls}" x1="180" y1="180" x2="${x}" y2="${y}"/>`; };
  const s = d.sec;
  return `<div class="ck-analog"><svg viewBox="0 0 360 360" aria-hidden="true"><circle class="ck-face" cx="180" cy="180" r="158"/><path class="ck-wedge" d="${wedge}"/><path class="ck-ticks" d="${ticks}"/>${marks}`
    + `${hand('ck-h', (s / 3600 % 12) * 30, 82)}${hand('ck-m', (s / 60 % 60) * 6, 120)}${hand('ck-s', (s % 60) * 6, 132)}<circle class="ck-pin" cx="180" cy="180" r="6"/></svg>${stack('ck-below', d)}</div>`;
}

function sun(d) {
  const rise = d.sunrise, set = d.rows[3].adhan, nightLen = 1440 - set + rise;
  const day = (v) => { const t = Math.PI * (1 - (v - rise) / (set - rise)); return [f1(200 + 160 * Math.cos(t)), f1(180 - 140 * Math.sin(t))]; };
  const night = (v) => { const t = Math.PI * (((v - set) % 1440 + 1440) % 1440) / nightLen; return [f1(200 + 160 * Math.cos(t)), f1(180 + 90 * Math.sin(t))]; };
  const [fajr, dhuhr, asr, , isha] = d.rows;
  const dot = ([x, y]) => `<circle class="ck-mark-ink" cx="${x}" cy="${y}" r="5"/>`;
  const label = ([x, y], text, cls, dy) => `<text class="ck-strong ${cls}" x="${x}" y="${f1(+y + dy)}">${text}</text>`;
  const isDay = d.now >= rise && d.now < set, [bx, by] = isDay ? day(d.now) : night(d.now);
  return `<div class="ck-sun"><svg viewBox="0 0 400 300" aria-hidden="true">`
    + `<defs><linearGradient id="ck-skyfill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="ck-sky-top"/><stop offset="1" class="ck-sky-bottom"/></linearGradient></defs>`
    + `<rect x="0" y="0" width="400" height="180" rx="10" fill="url(#ck-skyfill)"/><rect class="ck-ground" x="0" y="180" width="400" height="120" rx="10"/>`
    + `<path class="ck-arc" d="M40 180 A160 140 0 0 1 360 180"/><path class="ck-arc ck-dash" d="M360 180 A160 90 0 0 1 40 180"/><line class="ck-horizon" x1="0" y1="180" x2="400" y2="180"/>`
    + `${dot(day(dhuhr.adhan))}${dot(day(asr.adhan))}${dot(['360', '180'])}${dot(['40', '180'])}${dot(night(isha.adhan))}${dot(night(fajr.adhan))}`
    + `${label(day(dhuhr.adhan), `Dhuhr ${hm(dhuhr.adhan)}`, '', -14)}${label(day(asr.adhan), `Asr ${hm(asr.adhan)}`, '', -14)}`
    + `<text class="ck-strong ck-end" x="356" y="166">Maghrib ${hm(set)}</text><text class="ck-strong ck-start" x="44" y="166">Sunrise ${hm(rise)}</text>`
    + `${label(night(isha.adhan), `Isha ${hm(isha.adhan)}`, 'ck-end', 24)}${label(night(fajr.adhan), `Fajr ${hm(fajr.adhan)}`, 'ck-start', 24)}`
    + `<circle class="${isDay ? 'ck-sunball' : 'ck-moon'}" cx="${bx}" cy="${by}" r="13"/></svg>${stack('ck-below', d)}</div>`;
}

// How full the bar is: from the previous adhan, iqama or sunrise to the next event, in percent.
function barPct(d) {
  const marks = [...d.rows.flatMap(r => (r.iqama == null ? [r.adhan] : [r.adhan, r.iqama])), ...(d.sunrise == null ? [] : [d.sunrise])].sort((a, b) => a - b);
  const prev = [...marks].reverse().find(v => v <= d.now) ?? marks[marks.length - 1] - 1440;
  return Math.max(0, Math.min(100, (d.now - prev) / (d.next.at - prev) * 100));
}

function board(d) {
  const m = Math.floor(d.now);
  const pct = barPct(d);
  const tiles = d.rows.map(r => `<li${r.key === d.next.key ? ' class="is-next"' : ''}><span>${NAMES[r.key]}</span><strong>${hm(r.adhan)}</strong><small>Iqama</small><em>${r.iqama == null ? 'Not set' : hm(r.iqama)}</em></li>`).join('');
  const jum = d.jumuah.length ? `<span>Jumu’ah ${d.jumuah.map(fmt).join(' and ')}</span>` : '';
  return `<div class="ck-board"><p class="ck-board-time"><span class="ck-board-hm">${hm(m)}</span><span class="ck-board-side"><span>:${String(Math.floor(d.sec % 60)).padStart(2, '0')}</span><span>${ampm(m)}</span></span></p>`
    + `<p class="ck-board-date">${d.date}</p><ol class="ck-tiles">${tiles}</ol>`
    + `<div class="ck-board-next"><span>${nextName(d)} in</span><strong class="${soon(d).trim()}">${untilNext(d)}</strong></div><div class="ck-bar"><span style="width:${pct.toFixed(1)}%"></span></div>`
    + `<p class="ck-board-foot"><span>Sunrise ${fmt(d.sunrise)}</span>${jum}</p></div>`;
}

function timeline(d) {
  const E = [{ key: 'fajr', at: d.rows[0].adhan, iq: d.rows[0].iqama }, { key: 'sunrise', at: d.sunrise }, ...d.rows.slice(1).map(r => ({ key: r.key, at: r.adhan, iq: r.iqama }))];
  // rows are evenly spaced; the marker moves between row centres in proportion to the time between them
  const H = 56, c = (i) => i * H + H / 2, m = d.now;
  let y;
  if (m < E[0].at) y = c(0) * m / E[0].at;
  else if (m >= E[5].at) y = c(5) + (m - E[5].at) / (1440 - E[5].at) * (H / 2);
  else { const i = E.findIndex((e, k) => m >= e.at && m < E[k + 1].at); y = c(i) + (m - E[i].at) / (E[i + 1].at - E[i].at) * H; }
  const rows = E.map(e => {
    const iq = !('iq' in e) ? '' : e.iq == null ? 'Iqama not set' : e.iq === e.at ? 'Iqama on time' : `Iqama ${fmt(e.iq)}`;
    const cls = [m >= (e.iq ?? e.at) ? 'is-done' : '', m >= e.at ? 'is-reached' : ''].filter(Boolean).join(' ');
    return `<li${cls ? ` class="${cls}"` : ''}><span class="ck-node"></span><strong>${NAMES[e.key]}</strong><span class="ck-tl-times"><b>${fmt(e.at)}</b><span>${iq}</span></span></li>`;
  }).join('');
  const jum = d.jumuah.length ? `<p class="ck-tl-foot">Jumu’ah khutbah ${d.jumuah.map(fmt).join(' and ')}</p>` : '';
  return `<div class="ck-timeline"><div class="ck-tl-head"><p>${nextName(d)} ${nextAt(d)}, in</p><p class="ck-count${soon(d)}">${untilNext(d)}</p></div>`
    + `<div class="ck-rail"><span class="ck-rail-fill" style="height:${f1(y)}px"></span><span class="ck-rail-dot" style="top:${f1(y - 9)}px"></span><ol>${rows}</ol></div>${jum}</div>`;
}

function bedside(d) {
  const m = Math.floor(d.now), left = Math.max(0, Math.round((d.next.at * 60 - d.sec) / 60)), h = Math.floor(left / 60);
  const dots = d.rows.map(r => {
    const cls = r.key === d.next.key ? 'is-next' : d.now >= r.adhan && d.next.at < 1440 ? 'is-done' : '';
    return `<li${cls ? ` class="${cls}"` : ''}><span></span>${NAMES[r.key]}</li>`;
  }).join('');
  return `<div class="ck-bedside"><p class="ck-bed-time"><span>${hm(m)}</span><small>${ampm(m)}</small></p><p class="ck-bed-date">${d.date}</p>`
    + `<div><p class="ck-bed-next">${nextName(d)} ${fmt(d.next.at)}</p><p class="ck-bed-in${soon(d)}">in ${h ? `${h} hr ` : ''}${left % 60} min</p></div><ol class="ck-bed-dots">${dots}</ol></div>`;
}

const STYLES = { board, dial, analog, sun, timeline, bedside };
export const renderClock = (style, d) => (STYLES[style] || board)(d);

// Full screen on small screens: only the time, the current prayer and what is counted down to.
// d also carries tomorrowFajr (a row) for the countdown after the last iqama of the day.
export function renderTimes(d) {
  const m = Math.floor(d.now);
  // shortcut: before Fajr the current prayer is last night's Isha, shown with today's times (they differ by a minute or two)
  const cur = [...d.rows].reverse().find(r => r.adhan <= d.now) ?? d.rows[d.rows.length - 1];
  const pct = barPct(d);
  const row = d.next.at >= 1440 ? d.tomorrowFajr : d.rows.find(r => r.key === d.next.key);
  const sub = d.next.kind === 'adhan' ? `<p class="tm-sub">${NAMES[row.key]} ${fmt(row.adhan)}, iqama ${row.iqama == null ? 'not set' : fmt(row.iqama)}</p>`
    : d.next.kind === 'iqama' ? `<p class="tm-sub">Iqama at ${fmt(d.next.at)}</p>` : '';
  const k = d.card, left = d.rows.filter(r => r.adhan > d.now);
  const jum = d.friday && d.jumuah?.length ? `<p class="tm-sub">Jumu’ah ${d.jumuah.map(fmt).join(' and ')}</p>` : '';
  const card = !k
    ? `<p class="tm-label">Current prayer</p><p class="tm-name">${NAMES[cur.key]}</p><p class="tm-pt"><span><span class="tm-k">Adhan</span><b>${fmt(cur.adhan)}</b></span><span><span class="tm-k">Iqama</span><b class="${d.next.kind === 'iqama' ? 'tm-hl' : ''}">${cur.iqama == null ? 'Not set' : fmt(cur.iqama)}</b></span></p>`
    : k.kind === 'dua'
      ? `<p class="tm-label tm-lh"><span>${k.title}</span><span>${k.pos}</span></p><p class="tm-ar" lang="ar" dir="rtl">${k.item.ar}</p><p class="tm-en">${k.item.en}</p><p class="tm-src">${k.item.src} · tap: next</p>`
      : `<p class="tm-label">Rest of today</p><ul class="tm-rest"><li class="tm-rh"><span></span><span>Adhan</span><span>Iqama</span></li>${left.map(r => `<li><span>${NAMES[r.key]}</span><span>${fmt(r.adhan)}</span><span>${r.iqama == null ? '–' : fmt(r.iqama)}</span></li>`).join('')}</ul>${jum}`;
  return `<div class="tm"><div class="tm-left"><p class="tm-time"><span class="tm-hm">${hm(m)}</span><span class="tm-side"><span>:${String(Math.floor(d.sec % 60)).padStart(2, '0')}</span><span>${ampm(m)}</span></span></p>${d.wx || ''}</div>`
    + `<div class="tm-right"><div class="tm-card"${k?.kind === 'dua' ? ' data-dua' : ''}>${card}</div>`
    + `<div><p class="tm-label">${nextName(d)} in</p><p class="tm-cnt${soon(d)}">${untilNext(d)}</p>${sub}</div>`
    + `<div class="tm-bar"><span style="width:${pct.toFixed(1)}%"></span></div></div></div>`;
}
