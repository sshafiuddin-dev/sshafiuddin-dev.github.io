// Live iqama times: GET /api/iqama reads iscj.org, keeps the answer 5 minutes at Cloudflare's edge and a last good copy for a day,
// so a slow or blocked iscj.org never leaves the app empty. ?fresh=1 (the Sync now button) skips the 5 minutes, at most once a minute.
import { parse } from '../_lib/parse.js';

const SOURCE = 'https://iscj.org/';
const FRESH_MS = 5 * 60e3, MIN_GAP_MS = 60e3, KEEP_S = 86400;
const json = (body, status, extra = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*', ...extra } });

// cache: a Cache-like (match/put); get: fetch. Both are passed in so the self-check can run this without a network.
export async function handle(url, cache, get, now = Date.now()) {
  const key = new Request(new URL('/api/iqama', url));
  const hit = await cache.match(key);
  const saved = hit ? await hit.json() : null;
  const age = saved ? now - saved.fetched : Infinity;
  const wantFresh = new URL(url).searchParams.has('fresh');
  if (saved && (wantFresh ? age < MIN_GAP_MS : age < FRESH_MS)) return json(saved, 200, { 'cache-control': 'public, max-age=60' });
  try {
    const res = await get(SOURCE, { headers: { 'user-agent': 'Mozilla/5.0 (iqama-times; +https://sshafiuddin-dev.github.io/iqama/)' }, signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error(`iscj.org answered ${res.status}`);
    const fresh = { source: SOURCE, fetched: now, ...parse(await res.text()) };
    await cache.put(key, new Response(JSON.stringify(fresh), { headers: { 'cache-control': `max-age=${KEEP_S}` } }));
    return json(fresh, 200, { 'cache-control': 'public, max-age=60' });
  } catch (e) {
    if (saved) return json({ ...saved, stale: true }, 200, { 'cache-control': 'no-store' });
    return json({ error: String(e.message || e) }, 502, { 'cache-control': 'no-store' });
  }
}

export const onRequestGet = ({ request }) => handle(request.url, caches.default, fetch);
