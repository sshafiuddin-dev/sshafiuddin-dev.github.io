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

// Their files are not always strict JSON. Inside strings this escapes raw line breaks and tabs and drops a backslash that
// escapes nothing; outside strings it drops a trailing comma. The text itself is unchanged. Anything else still fails,
// and the error then shows where, so a broken file can be told apart from a change in the format.
const ESCAPABLE = '"\\/bfnrtu';
export function repairJson(text) {
  const chars = [...text];
  let out = '', inStr = false;
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (inStr) {
      if (ch === '\\') { if (ESCAPABLE.includes(chars[i + 1] ?? '')) out += ch + chars[++i]; continue; }
      if (ch < ' ') { out += ch === '\n' ? '\\n' : ch === '\r' ? '\\r' : ch === '\t' ? '\\t' : '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0'); continue; }
      if (ch === '"') inStr = false;
      out += ch;
    } else {
      if (ch === '"') inStr = true;
      if (ch === ',') { let j = i + 1; while (/\s/.test(chars[j] ?? '')) j++; if (chars[j] === ']' || chars[j] === '}') continue; }
      out += ch;
    }
  }
  return out;
}
export function parseLoose(text) {
  const clean = String(text).replace(/^\uFEFF/, '');
  try { return JSON.parse(clean); } catch (strict) {
    const fixed = repairJson(clean);
    try { return JSON.parse(fixed); } catch (second) {
      const at = +(/position (\d+)/.exec(second.message)?.[1] ?? -1);
      const near = at >= 0 ? ` near ${JSON.stringify(fixed.slice(Math.max(0, at - 40), at + 40))}` : '';
      throw new Error(`${second.message}${near} (strict: ${strict.message})`);
    }
  }
}

// A chapter file is { "<title>": [ ...duas ] }. Chapter 126 has lost the closing quote on its title, so everything after it
// reads as part of the title. The title is not used, so when the file cannot be read whole, read the list inside it.
export function parseChapterJson(text) {
  try { return parseLoose(text); } catch (whole) {
    const from = text.indexOf('['), to = text.lastIndexOf(']');
    if (from < 0 || to < from) throw whole;
    try { return { items: parseLoose(text.slice(from, to + 1)) }; } catch { throw whole; }
  }
}

async function get(url, parse = parseLoose, tries = 3) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (iqama-times updater; +https://sshafiuddin-dev.github.io/iqama/)' } });
      if (!res.ok) throw new Error(`${url} answered ${res.status}`);
      return parse(await res.text());
    } catch (e) {
      if (i >= tries) throw new Error(`${url}: ${e.message}`);
      await new Promise(r => setTimeout(r, 1500 * i));
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const index = await get(toHttps(INDEX));
  const cats = Object.values(index).find(Array.isArray) || [];
  const chapters = {}, skipped = [];
  for (const c of cats) {
    try { chapters[c.ID] = { items: normalizeChapter(await get(toHttps(c.TEXT), parseChapterJson)) }; } catch (e) {
      skipped.push(c.ID);
      console.log(`::warning title=Hisn al-Muslim chapter ${c.ID} skipped::${e.message}`.slice(0, 900));
    }
    await new Promise(r => setTimeout(r, 150));
  }
  if (skipped.length > 5) throw new Error(`Too many chapters could not be read (${skipped.join(', ')}), so nothing was saved.`);
  const stats = check(chapters, process.env.HISN_MIN ? JSON.parse(process.env.HISN_MIN) : undefined);
  console.log('Hisn al-Muslim text:', JSON.stringify({ ...stats, skipped }));
  const body = JSON.stringify({ source: INDEX, chapters }, null, 1) + '\n';
  if (existsSync(OUT) && readFileSync(OUT, 'utf8') === body) console.log('Text unchanged.');
  else { writeFileSync(OUT, body); console.log('Wrote', OUT); }
}
