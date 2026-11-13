// Run with: node scripts/selfcheck.mjs
import assert from 'node:assert/strict';
import { parse } from '../functions/_lib/parse.js';
import { handle } from '../functions/api/iqama.js';
import { normalizeItem, normalizeChapter, check, parseLoose, repairJson, parseChapterJson } from './fetch-hisn.mjs';
import { PRAYERS, cardWindow, fridayRows, outlook, dayName, parseHM, iqamaAt, fmt, fmtSpan, nextEvent, km, alertsBetween, cleanStep, weatherKind, dayKind, uvLevel, aqiLevel, compass, clock, esc, beepWav, alertLogText } from '../iqama/logic.js';

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
// UTC offset feeds every prayer time: New York is -5 in winter and -4 in summer, India keeps its half hour
assert.equal(clock(new Date(Date.UTC(2026, 0, 15, 17)), 'America/New_York').offset, -5);
assert.equal(clock(new Date(Date.UTC(2026, 6, 15, 17)), 'America/New_York').offset, -4);
assert.equal(clock(new Date(Date.UTC(2026, 0, 15, 17)), 'Asia/Kolkata').offset, 5.5);
assert.deepEqual((({ y, m, d, weekday, sec }) => ({ y, m, d, weekday, sec }))(clock(new Date(Date.UTC(2026, 0, 15, 4, 30, 5)), 'America/New_York')),
  { y: 2026, m: 1, d: 14, weekday: 'Wed', sec: 23 * 3600 + 30 * 60 + 5 }, 'a time just before midnight UTC-5 is still the day before');
{
  // the generated beep is a valid WAV: right header and length, never clips, fades to silence
  const w = beepWav(), v = new DataView(w.buffer), tag = (at) => String.fromCharCode(...w.slice(at, at + 4));
  assert.deepEqual([tag(0), tag(8), tag(36), v.getUint32(24, true), v.getUint32(40, true)], ['RIFF', 'WAVE', 'data', 22050, w.length - 44]);
  const samples = Array.from({ length: (w.length - 44) / 2 }, (_, i) => v.getInt16(44 + i * 2, true));
  assert.ok(Math.max(...samples.map(Math.abs)) < 0.36 * 32767 && Math.abs(samples.at(-1)) < 0.05 * 32767, 'beep stays soft and ends quietly');
}
assert.equal(esc(`<a href="x">'&'</a>`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
// The log under Settings that explains a missed alert
assert.equal(alertLogText(null, ''), 'No alert has gone off on this device yet.');
assert.equal(
  alertLogText({ last: { what: 'Fajr adhan', when: 'Nov 13, 5:24 AM', result: 'message shown, sound played' }, gaps: [{ from: 'Nov 12, 11:12 PM', to: 'Nov 13, 6:40 AM' }] }, 'Nov 13, 7:05 AM'),
  'Last alert: Fajr adhan, Nov 13, 5:24 AM: message shown, sound played.\nThis page’s clock stopped, so alerts in between were skipped: Nov 12, 11:12 PM to Nov 13, 6:40 AM.\nThis page started Nov 13, 7:05 AM.');
assert.equal(alertLogText({ last: 5, gaps: 'x' }, ''), 'No alert has gone off on this device yet.', 'a damaged save is ignored');
assert.ok(alertLogText({ gaps: [{}, 1, null, { from: 'a', to: 'b' }, { from: 'c', to: 'd' }, { from: 'e', to: 'f' }, { from: 'g', to: 'h' }] }, '').includes('a to b; c to d; e to f.'), 'at most three stopped periods');
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

// Each alert step has its own switch and sound; saves from before that are read as they behaved
{
  const steps = { dhuhr: { on: true, adhan: { on: true, type: 'makkah' }, before: { on: false, type: 'beep', min: 10 }, iqama: { on: true, type: 'aqsa', min: 5 } } };
  assert.deepEqual(tick(dhuhr, steps, 700), [{ kind: 'adhan', key: 'dhuhr', type: 'makkah', min: undefined }], 'a named recording at adhan');
  assert.deepEqual(tick(dhuhr, steps, 690), [], 'a step switched off keeps its sound but does not fire');
  assert.deepEqual(tick(dhuhr, steps, 715), [{ kind: 'iqama', key: 'dhuhr', type: 'aqsa', min: 5 }]);
  const sounds = ['message', 'beep', 'adhan', 'makkah'], def = { on: false, type: 'beep', min: 10 };
  assert.deepEqual(cleanStep('adhan', { on: true, type: 'message' }, sounds, false), { on: true, type: 'adhan' }, 'old adhan setting: a bare type');
  assert.deepEqual(cleanStep('off', { on: true, type: 'message' }, sounds, false), { on: false, type: 'message' }, 'old adhan setting: off');
  assert.deepEqual(cleanStep({ type: 'off', min: 20 }, def, sounds, true), { on: false, type: 'beep', min: 20 }, 'old step: off keeps its minutes');
  assert.deepEqual(cleanStep({ type: 'message', min: 7 }, def, sounds, true), { on: true, type: 'message', min: 7 }, 'old step: a type meant on');
  assert.deepEqual(cleanStep({ on: false, type: 'makkah', min: 3 }, def, sounds, true), { on: false, type: 'makkah', min: 3 });
  assert.deepEqual(cleanStep({ on: true, type: 'nonsense', min: 99 }, def, sounds, true), { on: true, type: 'beep', min: 10 }, 'unknown sound and minutes fall back');
  assert.deepEqual(cleanStep(null, def, sounds, true), def);
}

// Quran player: catalogue, search, queue, saved state and playlists
{
  const Q = await import('../iqama/quran-logic.js');
  const suwar = { suwar: [{ id: 1, name: 'Al-Fatihah ', makkia: 1 }, { id: 2, name: 'Al-Baqarah ', makkia: 0 }, { id: 18, name: 'Al-Kahf', makkia: 1 }, { id: 114, name: 'An-Nas', makkia: 1 }] };
  const reciters = { reciters: [
    { id: 102, name: 'Maher Al Meaqli', letter: 'M', moshaf: [
      { id: 102, name: "Rewayat Hafs A'n Assem - Murattal", rewaya_id: 1, server: 'https://cdn.example/maher/r1/', surah_list: '1,2,18,114' },
      { id: 133, name: "Rewayat Hafs A'n Assem - Almusshaf Al Mojawwad", rewaya_id: 1, server: 'http://cdn.example/maher/r3', surah_list: '18,1,1,999,x' }] },
    { id: 5, name: "Abdul'aziz Al-Ahmad", letter: 'A', moshaf: [{ id: 50, name: "Rewayat Warsh A'n Nafi' - Murattal", rewaya_id: 2, server: 'https://cdn.example/aziz/', surah_list: '2,114' }] },
    { id: 9, name: 'Nobody', letter: 'N', moshaf: [{ id: 90, name: 'Empty', rewaya_id: 1, server: '', surah_list: '1' }] }] };
  const riwayat = { riwayat: [{ id: 1, name: "Rewayat Hafs A'n Assem" }, { id: 2, name: "Rewayat Warsh A'n Nafi'" }, { id: 3, name: 'Rewayat Khalaf' }] };
  const cat = Q.buildCatalog(suwar, reciters, riwayat);
  assert.deepEqual(cat.reciters.map(r => r.name), ["Abdul'aziz Al-Ahmad", 'Maher Al Meaqli'], 'sorted by name; a reciter with nothing playable is left out');
  assert.deepEqual(cat.riwayat, [{ id: 1, name: "Hafs A'n Assem", count: 2 }, { id: 2, name: "Warsh A'n Nafi'", count: 1 }], 'only riwayat that have a recitation');
  assert.deepEqual(cat.moshaf.get(133).surahs, [1, 18], 'surah list is cleaned and sorted');
  assert.equal(cat.moshaf.get(133).server, 'https://cdn.example/maher/r3/', 'https and a closing slash');
  assert.equal(cat.moshaf.get(102).style, "Hafs A'n Assem · Murattal");
  assert.equal(cat.surahs.get(1).name, 'Al-Fatihah');
  assert.deepEqual(Q.trackInfo(cat, '102:18'), { id: '102:18', n: 18, title: 'Al-Kahf', reciter: 'Maher Al Meaqli', style: "Hafs A'n Assem · Murattal", url: 'https://cdn.example/maher/r1/018.mp3' });
  assert.equal(Q.trackInfo(cat, '133:2'), null, 'a surah the recitation does not have');
  assert.equal(Q.trackInfo(cat, '7:1'), null);
  assert.deepEqual(Q.recitersFor(cat, 2).map(r => r.id), [5], 'riwayah filter');
  assert.deepEqual(Q.moshafOf(cat, cat.reciters[1], 1).map(m => m.id), [102, 133]);
  assert.deepEqual(Q.search(cat, 'abdulaziz').reciters.map(r => r.id), [5], 'search ignores apostrophes');
  assert.deepEqual(Q.search(cat, 'al fatiha').surahs.map(s => s.n), [1], 'search ignores hyphens and case');
  assert.deepEqual(Q.search(cat, '18').surahs.map(s => s.n), [18], 'search by surah number');
  assert.deepEqual(Q.search(cat, 'maher', 2).reciters, [], 'search respects the riwayah filter');
  assert.deepEqual(Q.search(cat, '  '), { reciters: [], surahs: [] });
  assert.deepEqual([0, 59.9, 61, 3600, 3725, NaN].map(Q.fmtTime), ['0:00', '0:59', '1:01', '1:00:00', '1:02:05', '0:00']);

  const ids = ['102:1', '102:2', '102:18', '102:114'];
  let q = Q.makeQueue(ids, 2);
  assert.equal(Q.current(q), '102:18');
  assert.deepEqual([Q.stepPos(q, 1, 'off'), Q.stepPos(q, -1, 'off')], [3, 1]);
  q.pos = 3;
  assert.deepEqual([Q.stepPos(q, 1, 'off'), Q.stepPos(q, 1, 'one'), Q.stepPos(q, 1, 'all')], [-1, -1, 0], 'Next stops at the end unless the list repeats');
  assert.deepEqual([Q.afterEnd(q, 'off'), Q.afterEnd(q, 'one'), Q.afterEnd(q, 'all')], [-1, 'again', 0]);
  q.pos = 0;
  assert.deepEqual([Q.stepPos(q, -1, 'off'), Q.stepPos(q, -1, 'all')], [-1, 3]);
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const sh = Q.makeQueue(ids, 2, true, rnd);
  assert.equal(Q.current(sh), '102:18', 'shuffle starts on the chosen surah');
  assert.deepEqual([...sh.order].sort(), [0, 1, 2, 3], 'shuffle plays every surah once');
  sh.pos = 2;
  const un = Q.reshuffle(sh, false);
  assert.deepEqual([un.order, Q.current(un)], [[0, 1, 2, 3], Q.current(sh)], 'turning shuffle off keeps the surah that is playing');
  assert.equal(Q.current(Q.makeQueue([], 0)), null);

  const blank = Q.cleanStore(null);
  assert.deepEqual(blank, { v: 2, last: null, riwaya: 'all', favR: [], favT: [], lists: [], repeat: 'off', shuffle: false, vol: 1, rate: 1 });
  const old = Q.cleanStore({ reciter: "Maher Al Meaqli (Rewayat Hafs A'n Assem - Almusshaf Al Mojawwad)", surah: 18 });
  assert.deepEqual(old.legacy, { reciter: "Maher Al Meaqli (Rewayat Hafs A'n Assem - Almusshaf Al Mojawwad)", surah: 18 }, 'the old player\'s save is kept for carrying over');
  assert.equal(Q.legacyTrack(cat, old.legacy), '133:18');
  assert.equal(Q.legacyTrack(cat, { reciter: "Abdul'aziz Al-Ahmad", surah: 2 }), '50:2');
  assert.equal(Q.legacyTrack(cat, { reciter: 'Gone', surah: 2 }), null);
  const dirty = Q.cleanStore({ last: { id: '102:18', t: 93.5, title: 'x', sub: 'y', url: 'javascript:alert(1)', queue: ['102:1', 'bad', '102:1'] }, riwaya: 2, favR: [102, '5', 102], favT: ['102:18', 7, '102:18'],
    lists: [{ id: 'a', name: '  Morning   set ', tracks: ['102:1', 'nope'] }, { id: 'b', name: '   ' }, null], repeat: 'forever', shuffle: 'yes', vol: 4, rate: 9 });
  assert.deepEqual(dirty, { v: 2, last: { id: '102:18', t: 93.5, title: 'x', sub: 'y', queue: ['102:1'], url: '' }, riwaya: 2, favR: [102], favT: ['102:18'],
    lists: [{ id: 'a', name: 'Morning set', tracks: ['102:1'] }], repeat: 'off', shuffle: false, vol: 1, rate: 1 }, 'anything malformed falls back');
  assert.equal(Q.cleanStore({ last: { id: '102:18', url: 'https://cdn.example/maher/r1/018.mp3' } }).last.url, 'https://cdn.example/maher/r1/018.mp3');
  assert.deepEqual([Q.nextRepeat('off'), Q.nextRepeat('all'), Q.nextRepeat('one')], ['all', 'one', 'off']);
  assert.deepEqual([Q.toggle([1, 2], 2), Q.toggle([1], 2)], [[1], [1, 2]]);

  let lists = Q.addList([], '  Friday  ', 'p1');
  assert.deepEqual(lists, [{ id: 'p1', name: 'Friday', tracks: [] }]);
  assert.equal(Q.addList(lists, '   '), lists, 'a playlist needs a name');
  lists = Q.addToList(Q.addToList(Q.addToList(lists, 'p1', '102:18'), 'p1', '102:1'), 'p1', '102:18');
  assert.deepEqual(lists[0].tracks, ['102:18', '102:1'], 'no surah twice in one playlist');
  lists = Q.addToList(lists, 'p1', '50:114');
  assert.deepEqual(Q.moveInList(lists, 'p1', 2, 0)[0].tracks, ['50:114', '102:18', '102:1']);
  assert.equal(Q.moveInList(lists, 'p1', 0, 9)[0], lists[0], 'a move off the end is ignored');
  assert.deepEqual(Q.setListOrder(lists, 'p1', ['102:1', '50:114', '102:18'])[0].tracks, ['102:1', '50:114', '102:18']);
  assert.equal(Q.setListOrder(lists, 'p1', ['102:1', '102:1', '102:18'])[0], lists[0], 'a reorder must keep the same surahs');
  assert.deepEqual(Q.removeFromList(lists, 'p1', '102:18')[0].tracks, ['102:1', '50:114']);
  assert.equal(Q.renameList(lists, 'p1', 'Jumu’ah')[0].name, 'Jumu’ah');
  assert.equal(Q.renameList(lists, 'p1', ' ')[0].name, 'Friday');
  assert.deepEqual(Q.removeList(lists, 'p1'), []);
  assert.equal(lists[0].tracks.length, 3, 'the earlier list is never changed in place');
}

// Weather labels
assert.deepEqual([0, 2.9, 3, 7.9, 10, 11].map(uvLevel), ['low', 'low', 'moderate', 'high', 'very high', 'extreme']);
assert.deepEqual([42, 51, 101, 151, 201, 301].map(aqiLevel), ['good', 'moderate', 'unhealthy for sensitive groups', 'unhealthy', 'very unhealthy', 'hazardous']);
assert.deepEqual([0, 44, 90, 200, 315, 359, -45].map(compass), ['N', 'NE', 'E', 'SSW', 'NW', 'N', 'NW']);

// Weather codes
assert.deepEqual(weatherKind(63), { kind: 'rain', label: 'Rain' });
assert.equal(weatherKind(75).kind, 'snow');
assert.equal(weatherKind(999).kind, 'plain');
assert.equal(dayKind(73, 0.4, 6).kind, 'rain'); // a little snow on a rainy day is rain
assert.equal(dayKind(73, 5, 0.5).kind, 'snow');
assert.equal(dayKind(73, null, null).kind, 'snow');
assert.equal(dayKind(61, 9, 0).kind, 'rain');
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
// Today-tab duas point into hisn-text.json by chapter and entry. If the monthly copy ever reorders entries, this fails
// (the workflow runs it again after fetching), so the card can never show the wrong dua.
{
  const { fillSets } = await import('../iqama/adhkar.js');
  const { readFileSync } = await import('node:fs');
  fillSets(JSON.parse(readFileSync(new URL('../iqama/hisn-text.json', import.meta.url), 'utf8')).chapters);
  const bare = (s) => s.replace(/[ً-ٰٟۖ-ۭـؐ-ؚ]/g, '').replace(/[ٱأإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/\s+/g, ' ');
  const KEY = {
    '15.3': 'رب هذه الدعوة', '15.4': 'بين الاذان والاقامة', '25.0': 'انت السلام', '25.3': 'والحمد لله، والله اكبر',
    '27.3': 'اللهم بك اصبحنا', '27.11': 'لا يضر مع اسمه', '27.16': 'سبحان الله وبحمده', '27.18': 'وحده لا شريك له', '27.22': 'بكلمات الله التامات',
    '27.9': 'العفو والعافية', '28.6': 'باسمك اللهم اموت', '28.1': 'الحي القيوم', '28.7': 'والله اكبر', '23.0': 'صل علي محمد', '23.1': 'صل علي محمد',
    '24.2': 'ظلمت نفسي', '117.0': 'اتنا في الدنيا حسنة', '34.1': 'الهم والحزن', '130.2': 'كلمتان خفيفتان',
  };
  for (const [k, s] of Object.entries(SETS)) for (const it of s.items) {
    const key = KEY[`${it.ch}.${it.i}`];
    assert.ok(key, `adhkar ${k}: Hisn ${it.ch}.${it.i} has a key phrase in this check`);
    assert.ok(bare(it.ar).includes(bare(key)) && it.en && it.src.startsWith(`Hisn al-Muslim, ch. ${it.ch}`), `adhkar ${k}: Hisn ${it.ch}.${it.i} is still the expected dua`);
  }
}
// Hisn al-Muslim text: fields are matched by meaning, text is copied untouched, http audio links become https
{
  const raw = { ID: 1, ARABIC_TEXT: ' \u0627\u0644\u062d\u0645\u062f ', LANGUAGE_ARABIC_TRANSLATED_TEXT: 'Alhamdu', TRANSLATED_TEXT: 'Praise be.', REPEAT: '3', AUDIO: 'http://www.hisnmuslim.com/audio/ar/1.mp3' };
  assert.deepEqual(normalizeItem(raw), { ar: '\u0627\u0644\u062d\u0645\u062f', tr: 'Alhamdu', en: 'Praise be.', n: 3, audio: 'https://www.hisnmuslim.com/audio/ar/1.mp3' });
  assert.deepEqual(normalizeItem({ ARABIC_TEXT: 'a', TRANSLATED_TEXT: 'b' }), { ar: 'a', tr: '', en: 'b' }, 'no repeat or audio is fine');
  assert.equal(normalizeChapter({ 'Any chapter title': [raw, { ID: 2 }] }).length, 1, 'empty entries are dropped, the key is ignored');
  const ch = (n) => ({ items: Array.from({ length: n }, () => ({ ar: 'x', tr: '', en: 'y' })) });
  assert.throws(() => check({ 1: ch(3) }), /does not look as expected/, 'a bad download is refused');
  assert.equal(check({ 1: ch(3), 2: ch(2) }, { chapters: 2, duas: 5 }).duas, 5);
}
// A raw line break inside a text value (as in one of their chapter files) is read, and kept as a line break
{
  const bad = '{"What to say when\nyou feel frightened": [{"ARABIC_TEXT": "a\nb\tc", "TRANSLATED_TEXT": "say \\"hi\\"\r\nthere", "REPEAT": 1}]}';
  assert.throws(() => JSON.parse(bad), 'strict JSON refuses it');
  const item = normalizeChapter(parseLoose(bad))[0];
  assert.deepEqual([item.ar, item.en], ['a\nb\tc', 'say "hi"\nthere']);
  assert.deepEqual(parseLoose('\uFEFF{"a": [1, 2]}'), { a: [1, 2] }, 'valid JSON and a leading byte order mark are unchanged');
  assert.throws(() => parseLoose('{"a": [1, }'), 'real breakage still fails');
}
// Other slips in their JSON: a backslash that escapes nothing, a trailing comma. Real escapes and text stay as they are.
{
  assert.deepEqual(parseLoose('{"a": ["it\\\'s", "x\\\\ny", "q\\"z\\u0041"],}'), { a: ["it's", 'x\\ny', 'q"zA'] });
  assert.equal(repairJson('{"k": "a, ]"}'), '{"k": "a, ]"}', 'a comma inside a string is left alone');
  assert.throws(() => parseLoose('{"a": "' + 'x'.repeat(200) + '", "b": tru}'), /tru.*\(strict: /, 'the error shows the broken part and the strict error');
}
// A chapter whose title lost its closing quote (chapter 126) is read from the list inside it
{
  const broken = '{\r\n\t"What to say when you feel frightened:\r\n\t[\r\n\t\t{\r\n\t\t\t"ID": 245,\r\n\t\t\t"ARABIC_TEXT": "a",\r\n\t\t\t"TRANSLATED_TEXT": "b[1]",\r\n\t\t\t"REPEAT": 3\r\n\t\t}\r\n\t]\r\n}';
  assert.throws(() => parseLoose(broken), 'the whole file cannot be read');
  const items = normalizeChapter(parseChapterJson(broken));
  assert.deepEqual(items, [{ ar: 'a', tr: '', en: 'b[1]', n: 3 }]);
  assert.throws(() => parseChapterJson('{"no list here": 5'), 'a file with no list still fails');
}
console.log('selfcheck ok');

// Friday: Dhuhr shows as Jumu'ah only when khutbah times are known, and counts down to the first khutbah
{
  const rows = PRAYERS.map((key, i) => ({ key, adhan: 300 + i * 180, iqama: 330 + i * 180 }));
  assert.equal(fridayRows(rows, 'Thu', [720]), rows, 'not on other days');
  assert.equal(fridayRows(rows, 'Fri', []), rows, 'not without khutbah times');
  const f = fridayRows(rows, 'Fri', [790, 720]);
  assert.deepEqual(f[1], { key: 'dhuhr', adhan: 480, iqama: 720, jumuah: [720, 790] });
  assert.deepEqual(nextEvent(f, 300, 600, 400), { key: 'dhuhr', kind: 'iqama', at: 720 }, 'counts down to the first khutbah');
  assert.equal(rows[1].iqama, 510, 'the day rows used for alerts are left alone');
}
console.log('friday ok');

// Playlist ids from the device must have the shape addList makes, since they are written into the page
{
  const { cleanStore, addList } = await import('../iqama/quran-logic.js');
  const ok = addList([], 'Mine')[0];
  assert.match(ok.id, /^[a-z0-9]{1,24}$/i);
  const kept = cleanStore({ lists: [ok, { id: '"><img src=x onerror=alert(1)>', name: 'Bad', tracks: [] }] }).lists;
  assert.deepEqual(kept.map(l => l.id), [ok.id], 'a playlist id that could break out of an attribute is dropped');
}
console.log('playlist ids ok');

// CSP reports: both browser formats are read, other report types are skipped
{
  const { summarize } = await import('../functions/api/csp-report.js');
  assert.deepEqual(summarize({ 'csp-report': { 'document-uri': 'https://x/', 'violated-directive': 'script-src', 'blocked-uri': 'inline' } }),
    [{ page: 'https://x/', directive: 'script-src', blocked: 'inline', where: '' }]);
  assert.deepEqual(summarize([{ type: 'deprecation', body: {} }, { type: 'csp-violation', body: { documentURL: 'https://x/iqama/', effectiveDirective: 'media-src', blockedURL: 'https://y/a.mp3', sourceFile: 'https://x/iqama/app.js', lineNumber: 9 } }]),
    [{ page: 'https://x/iqama/', directive: 'media-src', blocked: 'https://y/a.mp3', where: 'https://x/iqama/app.js:9' }]);
  assert.deepEqual(summarize(null), []);
}
console.log('csp reports ok');

// Brightness: bright by day, the chosen night level after Isha (or Maghrib) until sunrise; a hand-picked level lasts until the next switch
{
  const { isNight, dimLevel } = await import('../iqama/logic.js');
  const rows = [324, 702, 861, 1002, 1080].map((adhan, i) => ({ key: PRAYERS[i], adhan }));
  assert.deepEqual([300, 500, 1010, 1085].map(m => isNight(m, rows, 402, 'isha')), [true, false, false, true]);
  assert.deepEqual([1010, 1085].map(m => isNight(m, rows, 402, 'maghrib')), [true, true]);
  assert.equal(isNight(1300, rows, 402, 'off'), false);
  const s = { autoDim: 'isha', nightLevel: 3, level: 1 };
  assert.deepEqual([dimLevel(s, false), dimLevel(s, true)], [0, 3]);
  assert.equal(dimLevel(s, true, { level: 1, night: true }), 1, 'a level picked at night holds for that night');
  assert.equal(dimLevel(s, false, { level: 1, night: true }), 0, 'and ends at sunrise');
  assert.equal(dimLevel({ ...s, autoDim: 'off' }, true), 1, 'with auto off the level stays where it is set');
}
console.log('brightness ok');

// Hijri date (Umm al-Qura) with a day shift, and adhan offsets
{
  const { hijri, cleanTune } = await import('../iqama/logic.js');
  assert.equal(hijri(2026, 2, 18), '1 Ramadan 1447');
  assert.equal(hijri(2026, 2, 18, -1), '29 Shaban 1447'); // Shaban 1447 has 29 days in Umm al-Qura
  assert.equal(hijri(2026, 3, 20), '1 Shawwal 1447');
  assert.deepEqual(cleanTune({ fajr: 2, dhuhr: 31, asr: 'x', isha: -3 }), { fajr: 2, dhuhr: 0, asr: 0, maghrib: 0, isha: -3 });
}
console.log('hijri and offsets ok');
