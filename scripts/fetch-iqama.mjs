// Copies today's iqama times for every masjid in iqama/masjids.js into iqama/iqama.json, the app's fallback when /api/iqama
// can't be reached. Run daily by .github/workflows/iqama.yml.
// A masjid whose page no longer reads keeps its last good entry and is reported as a warning, so one broken site never
// blocks the others or ships a bad scrape. ISCJ's times also stay at the top level, where older copies of the app read them.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readSource, sourceUrl, dateAt, USER_AGENT } from '../functions/_lib/parse.js';
import { MASJIDS } from '../iqama/masjids.js';

const FILE = fileURLToPath(new URL('../iqama/iqama.json', import.meta.url));

// old: the file as it is; results: { id: { iqama, jumuah } | Error }; date: today in New York. Returns the new file, or null if nothing changed.
export function merge(old, results, date) {
  const masjids = { ...(old.masjids || {}) };
  let changed = false;
  for (const [id, r] of Object.entries(results)) {
    if (r instanceof Error) continue;
    const prev = masjids[id];
    if (!prev || JSON.stringify({ iqama: prev.iqama, jumuah: prev.jumuah }) !== JSON.stringify(r)) {
      masjids[id] = { updated: date, ...r };
      changed = true;
    }
  }
  if (!changed) return null;
  const iscj = masjids.iscj || { updated: old.updated, iqama: old.iqama, jumuah: old.jumuah };
  return { source: 'https://iscj.org/', updated: iscj.updated, iqama: iscj.iqama, jumuah: iscj.jumuah, masjids };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const results = {};
  for (const m of MASJIDS) {
    const date = dateAt(m.zone), src = sourceUrl(m.source, date);
    try {
      const res = await fetch(src, { headers: { 'user-agent': USER_AGENT }, signal: AbortSignal.timeout(15000) });
      if (!res.ok) throw new Error(`${new URL(src).host} answered ${res.status}`);
      results[m.id] = readSource(m.source, await res.text(), date);
      console.log(`${m.name}:`, JSON.stringify(results[m.id]));
    } catch (e) {
      results[m.id] = e instanceof Error ? e : new Error(String(e));
      console.log(`::warning::${m.name} iqama times could not be read: ${results[m.id].message}`); // shows on the GitHub run
    }
  }
  const next = merge(JSON.parse(readFileSync(FILE, 'utf8')), results, dateAt('America/New_York'));
  if (next) { writeFileSync(FILE, JSON.stringify(next, null, 2) + '\n'); console.log('Iqama times updated.'); }
  else console.log('Iqama times unchanged.');
  if (Object.values(results).every(r => r instanceof Error)) process.exit(1); // nothing at all could be read: fail the run
}
