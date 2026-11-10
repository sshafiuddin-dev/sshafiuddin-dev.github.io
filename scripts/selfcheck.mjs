// Run with: node scripts/selfcheck.mjs
import assert from 'node:assert/strict';
import { parse } from './fetch-iqama.mjs';
import { parseHM, iqamaAt, fmt, fmtSpan, nextEvent, km, alertsBetween, weatherKind, uvLevel, aqiLevel, compass } from '../iqama/logic.js';

// Page parser, against markup shaped like iscj.org's prayer times block
const page = `<nav>Fajr Institute</nav><style>.x{}</style><div><span>Fajr</span><b>5:12 AM</b><i>Iqama</i> 5:45</div>
  <div>Sunrise 6:41 AM</div><div>Dhuhr 1:10 PM <i>Iqama</i>&nbsp;12:30</div><div>Asr 4:50 PM Iqama 2:45</div>
  <div>Maghrib 7:58 PM Iqama <em>On Time</em></div><div>Isha 9:24 PM Iqama 8:00</div>
  <h3>Jumu'ah Khutbahs</h3><p>12:00 PM</p><p>1:10 PM</p>`;
assert.deepEqual(parse(page), { iqama: { fajr: '05:45', dhuhr: '12:30', asr: '14:45', maghrib: '+0', isha: '20:00' }, jumuah: ['12:00', '13:10'] });
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
console.log('selfcheck ok');
