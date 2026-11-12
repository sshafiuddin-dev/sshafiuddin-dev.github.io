// Copies the Hisn al-Muslim text (Arabic, transliteration, English, repeat counts, audio links) from hisnmuslim.com
// into iqama/hisn-text.json. Run by .github/workflows/hisn.yml, or by hand: node scripts/fetch-hisn.mjs
// The text is copied as it comes, never retyped. Exits non-zero, leaving the file untouched, if the data does not look
// as expected, so a bad download never ships.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const INDEX = process.env.HISN_INDEX || 'https://www.hisnmuslim.com/api/en/husn_en.json';
const OUT = process.env.HISN_OUT || fileURLToPath(new URL('../iqama/hisn-text.json', import.meta.url));
const toHttps = (u) => String(u || '').trim().replace(/^http:\/\/(www\.)?hisnmuslim\.com/i, 'https://www.hisnmuslim.com');

// One dua entry from a chapter file. Field names are matched by meaning, so a small rename at the source still works.
export function normalizeItem(raw) {
  const keys = Object.keys(raw || {});
  const find = (...tests) => { for (const t of tests) { const k = keys.find(x => t.test(x)); if (k) return k; } return null; };
  const kAr = find(/^ARABIC_TEXT$/i, /^ARABIC$/i, /^(?!.*(TRANSLAT|TRANSLIT)).*ARABIC.*$/i);
  const kTr = find(/^LANGUAGE_ARABIC_TRANSLATED_TEXT$/i, /TRANSLIT/i, /ARABIC.*TRANSLATED/i);
  const kEn = find(/^TRANSLATED_TEXT$/i, /^(?!.*ARABIC).*(TRANSLATED|TRANSLATION).*$/i);
  const kN = find(/REPEAT/i);
  const kAu = find(/AUDIO/i);
  const text = (k) => (k && raw[k] != null ? String(raw[k]).replace(/\r\n/g, '\n').trim() : '');
  const n = kN ? parseInt(raw[kN], 10) : NaN;
  const item = { ar: text(kAr), tr: text(kTr), en: text(kEn) };
  if (n >= 0) item.n = n;
  const audio = toHttps(text(kAu));
  if (audio) item.audio = audio;
  return item;
}

// A chapter file is an object whose first array value holds the entries; the key (the chapter title) does not matter.
export function normalizeChapter(json) {
  const list = Object.values(json || {}).find(Array.isArray) || [];
  return list.map(normalizeItem).filter(i => i.ar || i.en);
}

export function check(chapters, min = { chapters: 100, duas: 200 }) {
  const items = Object.values(chapters).flatMap(c => c.items);
  const withAr = items.filter(i => i.ar).length;
  if (Object.keys(chapters).length < min.chapters || items.length < min.duas || withAr / items.length < 0.9) {
    throw new Error(`The data does not look as expected: ${Object.keys(chapters).length} chapters, ${items.length} duas, ${withAr} with Arabic.`);
  }
  return { chapters: Object.keys(chapters).length, duas: items.length, withAr, withTr: items.filter(i => i.tr).length, withEn: items.filter(i => i.en).length, withAudio: items.filter(i => i.audio).length };
}

// Their files sometimes hold a raw line break or tab inside a text value, which strict JSON refuses. This escapes those
// inside strings only, so the text itself is unchanged. Anything else wrong with the file still fails.
export function parseLoose(text) {
  const clean = String(text).replace(/^\uFEFF/, '');
  try { return JSON.parse(clean); } catch (strict) {
    let out = '', inStr = false, esc = false;
    for (const ch of clean) {
      if (inStr && !esc && ch < ' ') out += ch === '\n' ? '\\n' : ch === '\r' ? '\\r' : ch === '\t' ? '\\t' : '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0');
      else out += ch;
      if (esc) esc = false;
      else if (ch === '\\' && inStr) esc = true;
      else if (ch === '"') inStr = !inStr;
    }
    try { return JSON.parse(out); } catch { throw strict; }
  }
}

async function get(url, tries = 3) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (iqama-times updater; +https://sshafiuddin-dev.github.io/iqama/)' } });
      if (!res.ok) throw new Error(`${url} answered ${res.status}`);
      return parseLoose(await res.text());
    } catch (e) {
      if (i >= tries) throw new Error(`${url}: ${e.message}`);
      await new Promise(r => setTimeout(r, 1500 * i));
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const index = await get(toHttps(INDEX));
  const cats = Object.values(index).find(Array.isArray) || [];
  const chapters = {};
  for (const c of cats) {
    chapters[c.ID] = { items: normalizeChapter(await get(toHttps(c.TEXT))) };
    await new Promise(r => setTimeout(r, 150));
  }
  const stats = check(chapters, process.env.HISN_MIN ? JSON.parse(process.env.HISN_MIN) : undefined);
  console.log('Hisn al-Muslim text:', JSON.stringify(stats));
  const body = JSON.stringify({ source: INDEX, chapters }, null, 1) + '\n';
  if (existsSync(OUT) && readFileSync(OUT, 'utf8') === body) console.log('Text unchanged.');
  else { writeFileSync(OUT, body); console.log('Wrote', OUT); }
}
