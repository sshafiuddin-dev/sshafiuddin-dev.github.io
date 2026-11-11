// Run with: node scripts/selfcheck.mjs
import assert from 'node:assert/strict';
import { parse } from '../functions/_lib/parse.js';
import { handle } from '../functions/api/iqama.js';
import { PRAYERS, cardWindow, outlook, dayName, parseHM, iqamaAt, fmt, fmtSpan, nextEvent, km, alertsBetween, weatherKind, uvLevel, aqiLevel, compass } from '../iqama/logic.js';

// Page parser, against markup shaped like iscj.org's prayer times block
const page = `<nav>Fajr Institute</nav><style>.x{}</style><div><span>Fajr</span><b>5:12 AM</b><i>Iqama</i> 5:45</div>
  <div>Sunrise 6:41 AM</div><div>Dhuhr 1:10 PM <i>Iqama</i>&nbsp;12:30</div><div>Asr 4:50 PM Iqama 2:45</div>
  <div>Maghrib 7:58 PM Iqama <em>On Time</em></div><div>Isha 9:24 PM Iqama 8:00</div>
  <h3>Jumu'ah Khutbahs</h3><p>12:00 PM</p><p>1:10 PM</p>`;
assert.deepEqual(parse(page), { iqama: { fajr: '05:45', dhuhr: '12:30', asr: '14:45', maghrib: '+0', isha: '20:00' }, jumuah: ['12:00', '13:10'] });
// Live function: 5 minute cache, Sync now at most once a minute, last good copy when iscj.org fails
{
  const store = new Map(), cache = { match: async (r) => (store.has(r.url) ? new Response(store.get(r.url)) : undefined), put: async (r, res) => { store.set(r.url, await res.text()); } };
  let calls = 0, ok = true;
  const get = async () => { calls++; return ok ? new Response(page) : new Response('no', { status: 503 }); };
  const at = (q, t) => handle('https://x.test/api/iqama' + q, cache, get, t).then(async r => [r.status, await r.json()]);
  const [s1, b1] = await at('', 1e6);
  assert.deepEqual([s1, calls, b1.iqama.fajr, b1.fetched], [200, 1, '05:45', 1e6]);
  await at('', 1e6 + 299e3); assert.equal(calls, 1, 'cached for 5 minutes');
  await at('?fresh=1', 1e6 + 30e3); assert.equal(calls, 1, 'Sync now is held to once a minute');
  await at('?fresh=1', 1e6 + 90e3); assert.equal(calls, 2, 'Sync now reads iscj.org again');
  await at('', 1e6 + 90e3 + 301e3); assert.equal(calls, 3, 'refetched after 5 minutes');
  ok = false;
  const [s2, b2] = await at('', 1e6 + 90e3 + 700e3);
  assert.deepEqual([s2, b2.stale, b2.iqama.fajr], [200, true, '05:45'], 'last good copy when iscj.org fails');
  const [s3] = await handle('https://x.test/api/iqama', { match: async () => undefined, put: async () => {} }, get, 1e6).then(async r => [r.status]);
  assert.equal(s3, 502, 'no copy and no iscj.org is an error');
}
for (const q of ['&#8217;', '&rsquo;', '&#039;']) assert.deepEqual(parse(page.replace("Jumu'ah", `Jumu${q}ah`)).jumuah, ['12:00', '13:10'], `apostrophe written as ${q}`);
assert.deepEqual(parse(`<a>Jumu'ah</a><p>Friday Jumu&rsquo;ah prayer with a weekly khutbah</p>` + page).jumuah, ['12:00', '13:10'], 'menu mentions of Jumuah come first');
assert.equal(parse(page.replace('Iqama</i>&nbsp;12:30', 'Iqama</i> 11:45')).iqama.dhuhr, '11:45');
assert.throws(() => parse(page.replace('Iqama 8:00', '')), /isha/);
assert.throws(() => parse(page.replace('Iqama</i> 5:45', 'Iqama</i> 9:45')), /Implausible fajr/);

// Time logic
assert.equal(parseHM('05:45'), 345);
assert.equal(parseHM('25:00'), null);
assert.equal(iqamaAt('+10', 300), 310);
assert.equal(iqamaAt('14:45', 800), 885);
assert.equal(iqamaAt(undefined, 800), null);
assert.equal(iqamaAt('<b>', 800), null);
assert.deepEqual([0, 345, 720, 885, 1439].map(fmt), ['12:00 AM', '5:45 AM', '12:00 PM', '2:45 PM', '11:59 PM']);
assert.deepEqual([4805, 65].map(fmtSpan), ['1h 20m', '1m 05s']);
const rows = [{ key: 'fajr', adhan: 312, iqama: 345 }, { key: 'isha', adhan: 1090, iqama: null }];
assert.deepEqual(nextEvent(rows, 313, 300), { key: 'fajr', kind: 'adhan', at: 312 });
assert.deepEqual(nextEvent(rows, 313, 320), { key: 'fajr', kind: 'iqama', at: 345 });
assert.deepEqual(nextEvent(rows, 313, 400), { key: 'isha', kind: 'adhan', at: 1090 });
const dy = (date, max, pop, kind = 'clear') => ({ date, max, pop, kind });
assert.equal(dayName('2026-11-12'), 'Thursday');
assert.equal(outlook([dy('2026-11-11', 55, 10), dy('2026-11-12', 48, 70, 'rain'), dy('2026-11-13', 46, 20)], 'F'), 'Next two days: turning colder, rain tomorrow.');
assert.equal(outlook([dy('2026-11-11', 55, 10), dy('2026-11-12', 56, 10), dy('2026-11-13', 58, 60, 'rain')], 'F'), 'Next two days: staying mild, rain Friday.');
assert.equal(outlook([dy('2026-11-11', 20, 0), dy('2026-11-12', 24, 0), dy('2026-11-13', 25, 0)], 'C'), 'Next two days: turning warmer, mostly dry.');
assert.equal(outlook([dy('2026-11-11', 20, 0)], 'C'), '');
const five = [312, 700, 860, 1000, 1090].map((adhan, i) => ({ key: PRAYERS[i], adhan, iqama: adhan + 20 }));
assert.deepEqual([399, 400, 699, 700, 999, 1000, 1089, 1090].map(n => cardWindow(n, five, 400)), [null, 'morning', 'morning', null, null, 'evening', 'evening', null]);
const { renderTimes } = await import('../iqama/clocks.js');
const tm = (now, sec) => renderTimes({ sec, now, rows: five, sunrise: 400, next: nextEvent(five, 313, now, 400), tomorrowFajr: five[0], card: null });
assert.ok(tm(340, 340 * 60).includes('Sunrise in'), 'sunrise countdown after the Fajr iqama');
assert.ok(tm(390, 390 * 60).includes('ck-blink') && !tm(340, 340 * 60).includes('ck-blink'), 'countdown blinks only in the last 15 minutes');
assert.deepEqual(nextEvent(rows, 313, 350, 400), { key: 'sunrise', kind: '', at: 400 });
assert.deepEqual(nextEvent(rows, 313, 320, 400), { key: 'fajr', kind: 'iqama', at: 345 });
assert.deepEqual(nextEvent(rows, 313, 400, 400), { key: 'isha', kind: 'adhan', at: 1090 });
assert.deepEqual(nextEvent(rows, 313, 1100), { key: 'fajr', kind: 'adhan', at: 1753 });

// Distance rule for showing ISCJ iqama times (40 km)
const iscj = { lat: 40.384, lng: -74.563 };
assert.ok(km(iscj, { lat: 40.518, lng: -74.412 }) < 40, 'Edison is near ISCJ');
assert.ok(km(iscj, { lat: 40.713, lng: -74.006 }) > 40, 'Manhattan is not near ISCJ');
assert.ok(Math.abs(km({ lat: 0, lng: 0 }, { lat: 0, lng: 1 }) - 111.2) < 0.5);

// Per-prayer alerts: Dhuhr adhan 11:40, iqama 12:00; adhan recording, beep 10 min before adhan, message 5 min before iqama
const dhuhr = [{ key: 'dhuhr', adhan: 700, iqama: 720 }];
const cfg = { dhuhr: { on: true, adhan: 'adhan', before: { type: 'beep', min: 10 }, iqama: { type: 'message', min: 5 } } };
const tick = (rows, c, min) => alertsBetween(rows, c, min * 60 - 1, min * 60);
assert.deepEqual(tick(dhuhr, cfg, 690), [{ kind: 'before', key: 'dhuhr', type: 'beep', min: 10 }]);
assert.deepEqual(tick(dhuhr, cfg, 700), [{ kind: 'adhan', key: 'dhuhr', type: 'adhan', min: undefined }]);
assert.deepEqual(tick(dhuhr, cfg, 715), [{ kind: 'iqama', key: 'dhuhr', type: 'message', min: 5 }]);
assert.deepEqual(alertsBetween(dhuhr, cfg, 0, 700 * 60 + 100), [], 'stale alerts are dropped');
assert.deepEqual(tick(dhuhr, { dhuhr: { ...cfg.dhuhr, on: false } }, 700), [], 'prayer switched off');
assert.deepEqual(tick(dhuhr, { dhuhr: { ...cfg.dhuhr, adhan: 'off' } }, 700), [], 'alert type off');
assert.deepEqual(tick([{ key: 'isha', adhan: 1100, iqama: null }], { isha: cfg.dhuhr }, 1095), [], 'no iqama alert without an iqama time');
assert.deepEqual(tick(dhuhr, {}, 690), [], 'no settings for the prayer');
// Jumu'ah: only a "before" alert, keyed like any other row
assert.deepEqual(tick([{ key: 'jumuah', adhan: 720, iqama: null }], { jumuah: { on: true, before: { type: 'message', min: 15 } } }, 705), [{ kind: 'before', key: 'jumuah', type: 'message', min: 15 }]);

// Weather labels
assert.deepEqual([0, 2.9, 3, 7.9, 10, 11].map(uvLevel), ['low', 'low', 'moderate', 'high', 'very high', 'extreme']);
assert.deepEqual([42, 51, 101, 151, 201, 301].map(aqiLevel), ['good', 'moderate', 'unhealthy for sensitive groups', 'unhealthy', 'very unhealthy', 'hazardous']);
assert.deepEqual([0, 44, 90, 200, 315, 359, -45].map(compass), ['N', 'NE', 'E', 'SSW', 'NW', 'N', 'NW']);

// Weather codes
assert.deepEqual(weatherKind(63), { kind: 'rain', label: 'Rain' });
assert.equal(weatherKind(75).kind, 'snow');
assert.equal(weatherKind(999).kind, 'plain');
// Adhkar set for the time of day (ISCJ, Nov 10): Fajr 5:21/5:45, sunrise 6:39, Dhuhr 11:42/12:30, Asr 2:24/2:45, Maghrib 4:45, Isha 6:03/8:00
const { SETS, pickSet } = await import('../iqama/adhkar.js');
const day = [{ adhan: 321, iqama: 345 }, { adhan: 702, iqama: 750 }, { adhan: 864, iqama: 885 }, { adhan: 1005, iqama: 1005 }, { adhan: 1083, iqama: 1200 }];
const at = (h, m, wd = 'Tue') => pickSet(h * 60 + m, day, 399, wd).key;
assert.equal(at(5, 30), 'adhan', 'between Fajr adhan and iqama');
assert.equal(at(5, 50), 'prayer', 'just after Fajr iqama');
assert.equal(at(6, 10), 'morning');
assert.equal(at(9, 0), 'general');
assert.equal(at(9, 0, 'Fri'), 'friday');
assert.equal(at(14, 30), 'adhan', 'between Asr adhan and iqama');
assert.equal(at(15, 30), 'evening');
assert.equal(at(16, 50), 'prayer', 'Maghrib iqama is on time');
assert.equal(at(18, 30), 'adhan', 'between Isha adhan and iqama');
assert.equal(at(21, 0), 'sleep');
assert.equal(at(3, 0), 'sleep');
assert.equal(pickSet(600, day.map(r => ({ ...r, iqama: null })), 399, 'Tue').key, 'general', 'no iqama times set');
for (const [k, s] of Object.entries(SETS)) for (const it of s.items) assert.ok(it.en && it.src && Number.isInteger(it.n), `adhkar entry in ${k} is complete`);
console.log('selfcheck ok');
