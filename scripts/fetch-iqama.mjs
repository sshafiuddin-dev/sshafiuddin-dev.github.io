// Copies today's iqama times from iscj.org into iqama/iqama.json. Run daily by .github/workflows/iqama.yml.
// Exits non-zero (leaving the file untouched) if the page no longer looks as expected, so a bad scrape never ships.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SOURCE = 'https://iscj.org/';
const FILE = fileURLToPath(new URL('../iqama/iqama.json', import.meta.url));
// [key, name on the page, afternoon?, earliest and latest plausible iqama in minutes after midnight]
const PRAYERS = [
  ['fajr', 'Fajr', false, 180, 480],
  ['dhuhr', '(?:Dhuhr|Zuhr|Duhr)', true, 690, 900],
  ['asr', 'Asr', true, 780, 1200],
  ['maghrib', 'Maghrib', true, 960, 1320],
  ['isha', 'Isha', true, 1020, 1439],
];
const two = (n) => String(n).padStart(2, '0');

export function parse(html) {
  const text = html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/\s+/g, ' ');
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
  const j = /Jumu.{0,4}ah.{0,200}/i.exec(text);
  const jumuah = [...(j ? j[0] : '').matchAll(/(\d{1,2}):(\d{2})\s*([AP])M/gi)]
    .map(([, h, mi, ap]) => `${two(+h % 12 + (/p/i.test(ap) ? 12 : 0))}:${mi}`).slice(0, 4);
  return { iqama, jumuah };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const res = await fetch(SOURCE, { headers: { 'user-agent': 'Mozilla/5.0 (iqama-times updater; +https://sshafiuddin-dev.github.io/iqama/)' } });
  if (!res.ok) throw new Error(`${SOURCE} answered ${res.status}`);
  const fresh = parse(await res.text());
  const old = JSON.parse(readFileSync(FILE, 'utf8'));
  if (JSON.stringify(fresh) === JSON.stringify({ iqama: old.iqama, jumuah: old.jumuah })) {
    console.log('Iqama times unchanged.');
  } else {
    const updated = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
    writeFileSync(FILE, JSON.stringify({ source: SOURCE, updated, ...fresh }, null, 2) + '\n');
    console.log('Iqama times updated:', JSON.stringify(fresh));
  }
}
