// Pure time logic for Iqama Times. A time of day is minutes after local midnight at the prayer location.
export const PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
export const NAMES = { fajr: 'Fajr', sunrise: 'Sunrise', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' };

export function parseHM(s) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  return m && +m[1] < 24 && +m[2] < 60 ? m[1] * 60 + +m[2] : null;
}

// An iqama rule is "HH:MM" (fixed clock time) or "+N" (minutes after adhan). Anything else means not set.
export function iqamaAt(rule, adhan) {
  if (typeof rule !== 'string') return null;
  if (/^\+\d{1,3}$/.test(rule)) return adhan + +rule;
  return parseHM(rule);
}

export function fmt(min) {
  min = ((Math.round(min) % 1440) + 1440) % 1440;
  const h = Math.floor(min / 60);
  return `${(h + 11) % 12 + 1}:${String(min % 60).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

export function fmtSpan(sec) {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60, two = (n) => String(n).padStart(2, '0');
  return h ? `${h}h ${two(m)}m` : `${m}m ${two(s)}s`;
}

// What to count down to: the next adhan or iqama today, else tomorrow's Fajr adhan.
// sunrise (optional) is counted down to after Fajr, as an event of its own with no kind.
export function nextEvent(rows, tomorrowFajrAdhan, nowMin, sunrise) {
  for (const r of rows) {
    if (nowMin < r.adhan) return { key: r.key, kind: 'adhan', at: r.adhan };
    if (r.iqama != null && nowMin < r.iqama) return { key: r.key, kind: 'iqama', at: r.iqama };
    if (r.key === 'fajr' && sunrise != null && nowMin < sunrise) return { key: 'sunrise', kind: '', at: sunrise };
  }
  return { key: 'fajr', kind: 'adhan', at: tomorrowFajrAdhan + 1440 };
}

// Which extra card the small full screen shows: 'morning' from sunrise to the Dhuhr adhan, 'evening' from the Maghrib adhan to the Isha adhan, else null.
// rows: today's Fajr to Isha rows.
export function cardWindow(nowMin, rows, sunrise) {
  const [, dhuhr, , maghrib, isha] = rows;
  if (nowMin >= sunrise && nowMin < dhuhr.adhan) return 'morning';
  if (nowMin >= maghrib.adhan && nowMin < isha.adhan) return 'evening';
  return null;
}

// Great-circle distance in km between two { lat, lng } points.
export function km(a, b) {
  const r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

// Alert moments that fall in (fromSec, toSec]; anything over 90 s late is dropped.
// cfg[key] = { on, adhan: type, before: { type, min }, iqama: { type, min } }; type 'off' or a missing part is silent.
export function alertsBetween(rows, cfg, fromSec, toSec) {
  const out = [];
  const add = (min, kind, key, type, mins) => {
    const s = min * 60;
    if (type && type !== 'off' && fromSec < s && s <= toSec && toSec - s < 90) out.push({ kind, key, type, min: mins });
  };
  for (const r of rows) {
    const c = cfg[r.key];
    if (!c || !c.on) continue;
    add(r.adhan, 'adhan', r.key, c.adhan);
    if (c.before) add(r.adhan - c.before.min, 'before', r.key, c.before.type, c.before.min);
    if (c.iqama && r.iqama != null) add(r.iqama - c.iqama.min, 'iqama', r.key, c.iqama.type, c.iqama.min);
  }
  return out;
}

export const uvLevel = (u) => u < 3 ? 'low' : u < 6 ? 'moderate' : u < 8 ? 'high' : u < 11 ? 'very high' : 'extreme';
export const aqiLevel = (a) => a <= 50 ? 'good' : a <= 100 ? 'moderate' : a <= 150 ? 'unhealthy for sensitive groups' : a <= 200 ? 'unhealthy' : a <= 300 ? 'very unhealthy' : 'hazardous';
const POINTS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
export const compass = (deg) => POINTS[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];

// Open-Meteo weather code (WMO) to a backdrop kind and a label.
const WEATHER = [
  [[0], 'clear', 'Clear'], [[1], 'clear', 'Mostly clear'], [[2], 'cloudy', 'Partly cloudy'], [[3], 'overcast', 'Overcast'],
  [[45, 48], 'fog', 'Fog'], [[51, 53, 55, 56, 57], 'rain', 'Drizzle'], [[61, 63, 65, 66, 67, 80, 81, 82], 'rain', 'Rain'],
  [[71, 73, 75, 77, 85, 86], 'snow', 'Snow'], [[95, 96, 99], 'storm', 'Thunderstorm'],
];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const dayName = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(typeof iso === 'string' ? iso : '');
  return m ? DAY_NAMES[new Date(Date.UTC(+m[1], m[2] - 1, +m[3])).getUTCDay()] : '';
};

// One line about the two days after today. days: [{ date, max, min, pop, kind }] with today first.
// Temperature is a trend against today's high (5 degrees F or 3 C), else a plain word; rain or snow is named when its chance is 50% or more.
export function outlook(days, units) {
  const [t, a, b] = days || [];
  if (!t || !a || !b || [t.max, a.max, b.max].some(v => v == null)) return '';
  const F = units === 'F', diff = (a.max + b.max) / 2 - t.max, step = F ? 5 : 3;
  const avg = (a.max + b.max) / 2, c = F ? (avg - 32) / 1.8 : avg;
  const word = c <= 4 ? 'cold' : c <= 13 ? 'cool' : c <= 24 ? 'mild' : c <= 31 ? 'warm' : 'hot';
  const temp = diff <= -step ? 'turning colder' : diff >= step ? 'turning warmer' : `staying ${word}`;
  const wet = [[a, 'tomorrow'], [b, dayName(b.date) || 'the day after']].filter(([d]) => d.pop != null && d.pop >= 50 || d.kind === 'snow' && d.pop == null);
  const kind = wet.some(([d]) => d.kind === 'snow') ? 'snow' : wet.some(([d]) => d.kind === 'storm') ? 'storms' : 'rain';
  return `Next two days: ${temp}, ${wet.length ? `${kind} ${wet.map(([, n]) => n).join(' and ')}` : 'mostly dry'}.`;
}

// Open-Meteo's daily code is the most severe condition of the day, so a few snowy hours on a rainy day read as "snow".
// Keep snow only when its water content (about a tenth of the snowfall depth, in cm or inches) is at least the rain that falls.
export function dayKind(code, snowfall, rain) {
  const base = weatherKind(code);
  if (base.kind !== 'snow' || snowfall == null || rain == null) return base;
  return snowfall / 10 >= rain ? base : weatherKind(63);
}

export function weatherKind(code) {
  const hit = WEATHER.find(([codes]) => codes.includes(code));
  return hit ? { kind: hit[1], label: hit[2] } : { kind: 'plain', label: '' };
}
