// Reads iqama times out of iscj.org's home page. Shared by the live /api/iqama function and the daily GitHub job.
// Throws if the page no longer looks as expected, so a bad scrape never ships.
// [key, name on the page, afternoon?, earliest and latest plausible iqama in minutes after midnight]
const PRAYERS = [
  ['fajr', 'Fajr', false, 180, 480],
  ['dhuhr', '(?:Dhuhr|Zuhr|Duhr|Dhuhur|Zuhur)', true, 690, 900],
  ['asr', 'Asr', true, 780, 1200],
  ['maghrib', '(?:Maghrib|Magrib|Maghreb)', true, 960, 1320],
  ['isha', '(?:Isha|Ishaa)', true, 1020, 1439],
];
const two = (n) => String(n).padStart(2, '0');
export const SOURCE = 'https://iscj.org/';
// how this site's fetches introduce themselves to iscj.org and hisnmuslim.com
export const USER_AGENT = 'Mozilla/5.0 (iqama-times; +https://sshafiuddin.pages.dev/iqama/)';

export function parse(html) {
  const text = html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&(?:rsquo|lsquo|apos|#8217|#8216|#0*39|#x27);/gi, "'").replace(/\s+/g, ' ');
  const iqama = {};
  for (const [key, name, afternoon, min, max] of PRAYERS) {
    // the page reads "<prayer> <start time> Iqama <time>", with "On Time" for Maghrib
    const m = new RegExp(`\\b${name}\\b.{0,60}?\\bIqamah?\\b\\W{0,10}(On Time|(\\d{1,2}):(\\d{2}))(?:\\s*([AP])M\\b)?`, 'i').exec(text);
    if (!m) throw new Error(`No iqama time found for ${key}`);
    if (!m[2]) { iqama[key] = '+0'; continue; }
    const pm = m[4] ? /p/i.test(m[4]) : afternoon && !(key === 'dhuhr' && +m[2] === 11);
    const at = (+m[2] % 12 + (pm ? 12 : 0)) * 60 + +m[3];
    if (+m[2] > 12 || +m[3] > 59 || at < min || at > max) throw new Error(`Implausible ${key} iqama "${m[1]}"`);
    iqama[key] = `${two(Math.floor(at / 60))}:${two(at % 60)}`;
  }
  // the page also says "Jumu'ah" in its menu and program list, so look for the khutbah heading first
  const j = /Jumu.{0,4}ah\s*Khutbahs?.{0,200}/i.exec(text) || /Jumu.{0,4}ah.{0,200}/i.exec(text);
  const jumuah = [...(j ? j[0] : '').matchAll(/(\d{1,2}):(\d{2})\s*([AP])M/gi)]
    .map(([, h, mi, ap]) => `${two(+h % 12 + (/p/i.test(ap) ? 12 : 0))}:${mi}`).slice(0, 4);
  return { iqama, jumuah };
}

// ---- Other masjids (see iqama/masjids.js). Each reader returns { iqama, jumuah } like parse() above, or throws. ----

const textOf = (html) => html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;(amp;)?/g, '&').replace(/&(?:rsquo|lsquo|apos|#8217|#8216|#0*39|#x27);/gi, "'").replace(/\s+/g, ' ');

// One iqama time: "5:45", "1:15 PM", "13:15" or "On Time" (kept as "+0"). Without AM/PM, afternoon prayers are taken as PM
// (a Dhuhr of 11:xx stays morning). Checked against the same plausible ranges as ISCJ's.
export function iqamaTime(key, raw) {
  const s = String(raw ?? '').trim();
  if (/^on\s*time$/i.test(s)) return '+0';
  const m = /^(\d{1,2}):(\d{2})\s*([AP])?\.?M?\.?$/i.exec(s);
  if (!m) throw new Error(`No iqama time for ${key}`);
  const [, , , min, max] = PRAYERS.find(p => p[0] === key), afternoon = key !== 'fajr', h = +m[1], mi = +m[2];
  // with AM/PM: the usual 12-hour reading; without: 12:xx is noon, 13 and up is a 24-hour time, else afternoon prayers add 12 hours
  const at = m[3] ? (h % 12 + (/p/i.test(m[3]) ? 12 : 0)) * 60 + mi
    : h === 12 ? 720 + mi : h > 12 ? h * 60 + mi : (h + (afternoon && !(key === 'dhuhr' && h === 11) ? 12 : 0)) * 60 + mi;
  if (h > 23 || mi > 59 || at < min || at > max) throw new Error(`Implausible ${key} iqama "${s}"`);
  return `${two(Math.floor(at / 60))}:${two(at % 60)}`;
}
// A Jumu'ah time: "12:40", "1:40", "1:15 PM". Without AM/PM, 1 to 7 o'clock are afternoon. Must fall between 11:00 and 16:00.
export function jumuahTime(raw) {
  const m = /^(\d{1,2}):(\d{2})\s*([AP])?\.?M?\.?$/i.exec(String(raw ?? '').trim());
  if (!m) return null;
  const h = +m[1], mi = +m[2];
  const at = m[3] ? (h % 12 + (/p/i.test(m[3]) ? 12 : 0)) * 60 + mi : (h >= 1 && h <= 7 ? h + 12 : h) * 60 + mi;
  return at >= 660 && at <= 960 ? `${two(Math.floor(at / 60))}:${two(at % 60)}` : null;
}
const KEYS = PRAYERS.map(p => p[0]);

// table: one time after each prayer name, optionally labelled Iqama/Iqamah/Jamaat, e.g. NBIC's
// <td><span>Fajr</span>6:00</td> ... <td><span>Maghrib</span>On Time</td>, and "Juma Times 12:40 & 1:40"
export function parseTable(html) {
  const text = textOf(html), iqama = {};
  for (const [key, name] of PRAYERS) {
    const m = new RegExp(`\\b${name}\\b(?:\\s*(?:Iqamah?|Jama'?at))?\\W{0,6}(On Time|\\d{1,2}:\\d{2}(?:\\s*[AP]\\.?M\\b\\.?)?)`, 'i').exec(text);
    if (!m) throw new Error(`No iqama time found for ${key}`);
    iqama[key] = iqamaTime(key, m[1]);
  }
  const j = /\bJum(?:u|m)?'?(?:ah|a|ua)\b.{0,100}/i.exec(text);
  const jumuah = [...(j ? j[0] : '').matchAll(/\b(\d{1,2}:\d{2}(?:\s*[AP]M\b)?)/gi)].map(x => jumuahTime(x[1])).filter(Boolean).slice(0, 4);
  return { iqama, jumuah };
}

// labelled: each prayer's adhan then its iqamah, labelled, e.g. ICEB's "Fajr 5:23 AM Iqamah: 5:45 AM ... Magrib 4:42 PM Iqamah: 4:47 PM".
// Jumu'ah: the "Khutbah: 12:25 pm" times when the page gives them, else the times after "Jummah" / "Jumu'ah".
export function parseLabelled(html) {
  const text = textOf(html), iqama = {};
  for (const [key, name] of PRAYERS) {
    const m = new RegExp(`\\b${name}\\b.{0,60}?\\bIqamah?\\b\\W{0,10}(On Time|\\d{1,2}:\\d{2}(?:\\s*[AP]\\.?M\\b\\.?)?)`, 'i').exec(text);
    if (!m) throw new Error(`No iqama time found for ${key}`);
    iqama[key] = iqamaTime(key, m[1]);
  }
  const times = (re) => [...text.matchAll(re)].map(x => jumuahTime(x[1])).filter(Boolean);
  let jumuah = times(/\bKhutbah\s*:?\s*(\d{1,2}:\d{2}\s*[AP]M)\b/gi);
  if (!jumuah.length) {
    const j = /\bJum(?:u|m)?'?(?:ah|a|ua)\b.{0,100}/i.exec(text);
    // only the times before the next "Iqamah" label: those are when each Jumu'ah starts
    jumuah = j ? [...j[0].split(/\bIqamah?\b/i)[0].matchAll(/(\d{1,2}:\d{2}(?:\s*[AP]M\b)?)/gi)].map(x => jumuahTime(x[1])).filter(Boolean) : [];
  }
  return { iqama, jumuah: [...new Set(jumuah)].slice(0, 4) };
}

// masjidal: the Athan+ monthly widget. Each day is a row of 13 cells:
// day, Hijri day, weekday, Fajr athan, Fajr iqamah, sunrise, Dhuhr athan, Dhuhr iqamah, Asr athan, Asr iqamah, Maghrib, Isha athan, Isha iqamah.
// The widget lists no Maghrib iqamah, so Maghrib is left unset for the visitor to choose. Jumu'ahs are <td class="jumuah">12:00 PM</td>.
export const masjidalUrl = (id) => `https://timing.athanplus.com/masjid/widgets/monthly?theme=2&masjid_id=${encodeURIComponent(id)}`;
export function parseMasjidal(html, date) {
  const day = +String(date).slice(8, 10);
  const rows = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map(r => [...r[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(c => textOf(c[1]).trim()))
    .filter(c => c.length === 13 && /^\d{1,2}$/.test(c[0]));
  const row = rows.find(c => +c[0] === day);
  if (!row) throw new Error(`No row for day ${day} in the Masjidal timetable`);
  const at = { fajr: 4, dhuhr: 7, asr: 9, isha: 12 }, iqama = {};
  for (const k of KEYS) if (at[k]) iqama[k] = iqamaTime(k, row[at[k]]);
  const jumuah = [...html.matchAll(/<td\b[^>]*class="jumuah"[^>]*>([^<]*)<\/td>/gi)].map(m => jumuahTime(m[1])).filter(Boolean).slice(0, 4);
  return { iqama, jumuah };
}

// mcmc: { days: [{ date: 'YYYY-MM-DD', prayers: [{ name: 'Fajr', salah: '5:23 AM', iqamah: '6:00 AM' }, ...],
// jumuah: [{ label, time: '12:00 PM', iqamah, imam }] }] }. The Jumu'ah list is the next Friday's, on every day.
export function parseMcmc(json, date) {
  const data = typeof json === 'string' ? JSON.parse(json) : json;
  const days = Array.isArray(data?.days) ? data.days : [];
  const d = days.find(x => x && x.date === date) || (data?.selectedDay?.date === date ? data.selectedDay : null);
  if (!d || !Array.isArray(d.prayers)) throw new Error(`No MCMC times for ${date}`);
  const iqama = {};
  for (const [key, name] of PRAYERS) {
    const p = d.prayers.find(x => x && new RegExp(`^${name}$`, 'i').test(String(x.name).trim()));
    if (!p) throw new Error(`No iqama time found for ${key}`);
    iqama[key] = iqamaTime(key, p.iqamah);
  }
  const jumuah = (Array.isArray(d.jumuah) ? d.jumuah : []).map(x => jumuahTime(x && x.time)).filter(Boolean).slice(0, 4);
  return { iqama, jumuah };
}

// Where to fetch a masjid's times for a date, and how to read the reply
export function sourceUrl(source, date) {
  if (source.kind === 'masjidal') return masjidalUrl(source.id);
  if (source.kind === 'mcmc') return `${source.url}?date=${date}`;
  return source.url;
}
export function readSource(source, body, date) {
  if (source.kind === 'iscj') return parse(body);
  if (source.kind === 'table') return parseTable(body);
  if (source.kind === 'labelled') return parseLabelled(body);
  if (source.kind === 'masjidal') return parseMasjidal(body, date);
  if (source.kind === 'mcmc') return parseMcmc(body, date);
  throw new Error(`Unknown source kind ${source.kind}`);
}
// Today's date (YYYY-MM-DD) where the masjid is
export const dateAt = (zone, now = Date.now()) => new Intl.DateTimeFormat('en-CA', { timeZone: zone }).format(new Date(now));
