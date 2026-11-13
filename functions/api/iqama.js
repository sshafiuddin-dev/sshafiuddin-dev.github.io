// Live iqama times: GET /api/iqama?m=<masjid id> reads that masjid's source (see iqama/masjids.js; ISCJ when m is left out),
// keeps the answer 5 minutes at Cloudflare's edge and a last good copy for a day, so a slow or blocked site never leaves the
// app empty. ?fresh=1 (the Sync now button) skips the 5 minutes, at most once a minute per masjid.
// Only the sources on the list are ever fetched; any other id gets a 404, so this can't be used to fetch other sites.
import { readSource, sourceUrl, dateAt, USER_AGENT } from '../_lib/parse.js';
import { masjidById, DEFAULT_MASJID } from '../../iqama/masjids.js';

const FRESH_MS = 5 * 60e3, MIN_GAP_MS = 60e3, KEEP_S = 86400, MAX_BYTES = 2e6;
const json = (body, status, extra = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*', ...extra } });

// cache: a Cache-like (match/put); get: fetch. Both are passed in so the self-check can run this without a network.
export async function handle(url, cache, get, now = Date.now()) {
  const q = new URL(url).searchParams, id = q.get('m') || DEFAULT_MASJID, masjid = masjidById(id);
  if (!masjid) return json({ error: 'Unknown masjid.' }, 404, { 'cache-control': 'no-store' });
  const date = dateAt(masjid.zone, now);
  const key = new Request(new URL(`/api/iqama?m=${id}`, url));
  const hit = await cache.match(key);
  const saved = hit ? await hit.json() : null;
  // a saved copy is only fresh if it is for the masjid's today; an older one is kept for when the source fails
  const age = saved && saved.date === date ? now - saved.fetched : Infinity;
  if (saved && (q.has('fresh') ? age < MIN_GAP_MS : age < FRESH_MS)) return json(saved, 200, { 'cache-control': 'public, max-age=60' });
  const src = sourceUrl(masjid.source, date);
  try {
    const res = await get(src, { headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/json' }, signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error(`${new URL(src).host} answered ${res.status}`);
    const body = await res.text();
    if (body.length > MAX_BYTES) throw new Error('reply too large');
    const fresh = { masjid: id, name: masjid.name, source: masjid.site, date, fetched: now, ...readSource(masjid.source, body, date) };
    await cache.put(key, new Response(JSON.stringify(fresh), { headers: { 'cache-control': `max-age=${KEEP_S}` } }));
    return json(fresh, 200, { 'cache-control': 'public, max-age=60' });
  } catch (e) {
    if (saved) return json({ ...saved, stale: true }, 200, { 'cache-control': 'no-store' });
    console.error(`iqama ${id}: no copy and the source failed:`, e); // the detail goes to the Worker log, not to visitors
    return json({ error: `${masjid.name} iqama times are not available right now.` }, 502, { 'cache-control': 'no-store' });
  }
}

export const onRequestGet = ({ request }) => handle(request.url, caches.default, fetch);
