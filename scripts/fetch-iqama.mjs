// Copies today's iqama times from iscj.org into iqama/iqama.json. Run daily by .github/workflows/iqama.yml.
// Exits non-zero (leaving the file untouched) if the page no longer looks as expected, so a bad scrape never ships.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from '../functions/_lib/parse.js';

const SOURCE = 'https://iscj.org/';
const FILE = fileURLToPath(new URL('../iqama/iqama.json', import.meta.url));
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
