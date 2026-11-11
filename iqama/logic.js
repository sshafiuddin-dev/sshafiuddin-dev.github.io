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
export function weatherKind(code) {
  const hit = WEATHER.find(([codes]) => codes.includes(code));
  return hit ? { kind: hit[1], label: hit[2] } : { kind: 'plain', label: '' };
}
