import PrayTimes from './lib/PrayTimes.js';
import { CalculationMethods } from './lib/CalculationMethods.js';
import { PRAYERS, NAMES, parseHM, iqamaAt, fmt, fmtSpan, nextEvent } from './logic.js';

const $ = (id) => document.getElementById(id);
const ISCJ = { lat: 40.384, lng: -74.563, zone: 'America/New_York', name: 'ISCJ, Monmouth Junction NJ' };
const DEFAULTS = { method: 'ISNA', asr: 'Standard', place: null, iqama: {}, sound: false };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Settings stay on this device; anything malformed falls back to the defaults
let settings = { ...DEFAULTS };
try { settings = { ...DEFAULTS, ...JSON.parse(localStorage.getItem('iqama-settings') || '{}') }; } catch (e) {}
if (!CalculationMethods[settings.method]) settings.method = DEFAULTS.method;
if (!settings.iqama || typeof settings.iqama !== 'object') settings.iqama = {};
if (!settings.place || !isFinite(settings.place.lat) || !isFinite(settings.place.lng)) settings.place = null;
const save = () => { try { localStorage.setItem('iqama-settings', JSON.stringify(settings)); } catch (e) {} };

let masjid = { iqama: {}, jumuah: [], updated: '', failed: false };
const place = () => settings.place ? { ...settings.place, zone: undefined, name: 'Your location' } : ISCJ;
const say = (text) => { $('status').textContent = text; };

// Wall clock at the prayer location (the masjid's time zone, or this device's for "my location")
const formatters = {};
function clock(date, zone) {
  const f = formatters[zone] ||= new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', weekday: 'short', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' });
  const p = {};
  for (const { type, value } of f.formatToParts(date)) p[type] = value;
  const [y, m, d, h, mi, s] = ['year', 'month', 'day', 'hour', 'minute', 'second'].map(k => +p[k]);
  return { y, m, d, weekday: p.weekday, sec: h * 3600 + mi * 60 + s, offset: Math.round((Date.UTC(y, m - 1, d, h, mi, s) - date.getTime()) / 9e5) / 4 };
}

function dayTimes(y, m, d) {
  const { lat, lng, zone } = place();
  const pt = PrayTimes(settings.method);
  pt.setMethod(settings.method);
  pt.adjust({ asr: settings.asr === 'Hanafi' ? 'Hanafi' : 'Standard' });
  // shortcut: one UTC offset per day (taken at midday), so times before 2 AM on a clock-change day are an hour off
  const t = pt.getTimes([y, m, d], [lat, lng], clock(new Date(Date.UTC(y, m - 1, d, 17)), zone).offset, 0, 'Float');
  const min = (k) => Math.round(t[k] * 60);
  return {
    sunrise: min('sunrise'),
    rows: PRAYERS.map(key => {
      const adhan = min(key), own = settings.iqama[key] != null;
      return { key, adhan, own, iqama: iqamaAt(own ? settings.iqama[key] : masjid.iqama[key], adhan) };
    }),
  };
}

let today = null, day = null, tomorrowFajr = 0, lastSec = null;

function loadDay(c) {
  today = c;
  day = dayTimes(c.y, c.m, c.d);
  const n = new Date(Date.UTC(c.y, c.m - 1, c.d + 1));
  tomorrowFajr = dayTimes(n.getUTCFullYear(), n.getUTCMonth() + 1, n.getUTCDate()).rows[0].adhan;
  renderDay();
}

const jumuah = () => masjid.jumuah.map(parseHM).filter(v => v != null).map(fmt).join(', ');

function renderDay() {
  $('date').textContent = `${today.weekday}, ${MONTHS[today.m - 1]} ${today.d}`;
  $('place').textContent = place().name;
  $('place-name').textContent = place().name;

  const cell = (r) => r.iqama == null ? 'Not set' : fmt(r.iqama);
  let body = '';
  for (const r of day.rows) {
    body += `<tr data-k="${r.key}"><th scope="row">${NAMES[r.key]}</th><td>${fmt(r.adhan)}</td><td>${cell(r)}</td></tr>`;
    if (r.key === 'fajr') body += `<tr class="minor"><th scope="row">Sunrise</th><td>${fmt(day.sunrise)}</td><td></td></tr>`;
  }
  if (jumuah()) body += `<tr class="minor${today.weekday === 'Fri' ? ' friday' : ''}"><th scope="row">Jumu&rsquo;ah khutbah</th><td colspan="2">${jumuah()}</td></tr>`;
  $('today').tBodies[0].innerHTML = body;

  const own = day.rows.filter(r => r.own).map(r => NAMES[r.key]);
  const [uy, um, ud] = masjid.updated.split('-');
  $('source').textContent =
    (own.length === 5 ? 'All iqama times set by you.'
      : masjid.failed ? 'Could not load ISCJ iqama times. Set your own below.'
      : `Iqama times from ISCJ${uy ? `, last changed ${MONTHS[um - 1]} ${+ud}, ${uy}` : ''}.`) +
    (own.length && own.length < 5 ? ` ${own.join(', ')} set by you.` : '');

  drawDial();
  if ($('month-panel').open) renderMonth();
  tick();
}

// 24-hour dial: midnight at the bottom, noon at the top
const C = 180, R = 122;
const at = (min, r = R) => { const a = min / 1440 * 2 * Math.PI; return [(C - r * Math.sin(a)).toFixed(1), (C + r * Math.cos(a)).toFixed(1)]; };
const arc = (a, b) => `M${at(a)} A${R} ${R} 0 ${b - a > 720 ? 1 : 0} 1 ${at(b)}`;
function drawDial() {
  let svg = `<circle class="d-ring" cx="${C}" cy="${C}" r="${R}"/><path class="d-day" d="${arc(day.sunrise, day.rows[3].adhan)}"/>`;
  for (const r of day.rows) {
    if (r.iqama > r.adhan) svg += `<path class="d-iqama" d="${arc(r.adhan, r.iqama)}"/>`;
    const [x1, y1] = at(r.adhan, R - 11), [x2, y2] = at(r.adhan, R + 11), [tx, ty] = at(r.adhan, R + 32);
    svg += `<line class="d-tick" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/><text x="${tx}" y="${ty}">${NAMES[r.key]}</text>`;
  }
  $('dial').innerHTML = svg + '<circle id="hand" class="d-hand" r="8"/>';
}

function tick() {
  const c = clock(new Date(), place().zone);
  if (!today || c.d !== today.d) return loadDay(c);
  const ev = nextEvent(day.rows, tomorrowFajr, c.sec / 60);
  $('next-label').textContent = `${NAMES[ev.key]} ${ev.kind} in`;
  $('countdown').textContent = fmtSpan(ev.at * 60 - c.sec);
  $('next-at').textContent = `at ${fmt(ev.at)}${ev.at >= 1440 ? ' tomorrow' : ''}`;
  for (const tr of $('today').tBodies[0].rows) tr.classList.toggle('next', tr.dataset.k === ev.key);
  const [hx, hy] = at(c.sec / 60);
  $('hand').setAttribute('cx', hx);
  $('hand').setAttribute('cy', hy);

  // Adhan: only for a prayer time crossed while the page was open
  if (lastSec != null) for (const r of day.rows) if (lastSec < r.adhan * 60 && c.sec >= r.adhan * 60 && c.sec - r.adhan * 60 < 90) playAdhan(r.key);
  lastSec = c.sec;
}

// Month table: adhan times only, because ISCJ publishes iqama times one day at a time
function monthRows() {
  const n = new Date(Date.UTC(today.y, today.m, 0)).getUTCDate();
  return Array.from({ length: n }, (_, i) => {
    const t = dayTimes(today.y, today.m, i + 1);
    return { d: i + 1, weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(Date.UTC(today.y, today.m - 1, i + 1)).getUTCDay()], times: [t.rows[0].adhan, t.sunrise, ...t.rows.slice(1).map(r => r.adhan)] };
  });
}
function renderMonth() {
  $('month').tBodies[0].innerHTML = monthRows().map(r =>
    `<tr${r.d === today.d ? ' class="today"' : ''}><th scope="row">${r.weekday} ${r.d}</th>${r.times.map(t => `<td>${fmt(t)}</td>`).join('')}</tr>`).join('');
}
$('month-panel').addEventListener('toggle', () => { if ($('month-panel').open) renderMonth(); });

// Sharing: the system share sheet where there is one, otherwise the clipboard
const appUrl = location.href.split(/[?#]/)[0];
async function share(title, text) {
  try {
    if (navigator.share) return await navigator.share({ title, text, url: appUrl });
    await navigator.clipboard.writeText(`${text}\n${appUrl}`);
    say('Copied. Paste it into a message to share.');
  } catch (e) {
    if (e.name !== 'AbortError') say('Sharing is blocked in this browser. Copy the page address instead.');
  }
}
$('share-day').addEventListener('click', () => share('Iqama Times', [
  `Prayer times for ${today.weekday}, ${MONTHS[today.m - 1]} ${today.d} (${place().name})`,
  ...day.rows.map(r => `${NAMES[r.key]}: ${fmt(r.adhan)}${r.iqama == null ? '' : `, iqama ${fmt(r.iqama)}`}`),
  ...(jumuah() ? [`Jumu'ah khutbah: ${jumuah()}`] : []),
].join('\n')));
$('share-month').addEventListener('click', () => share('Iqama Times', [
  `Prayer times for ${MONTHS[today.m - 1]} ${today.y} (${place().name})`,
  'Day: Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha',
  ...monthRows().map(r => `${r.weekday} ${r.d}: ${r.times.map(fmt).join(', ')}`),
].join('\n')));
$('share-app').addEventListener('click', () => share('Iqama Times', 'Prayer and iqama times with a live countdown.'));

// Adhan sound
let audio = null;
const playing = () => !!audio && !audio.paused && !audio.ended;
function syncSound() {
  $('sound').textContent = playing() ? 'Stop adhan' : `Adhan sound: ${settings.sound ? 'on' : 'off'}`;
  $('sound').setAttribute('aria-pressed', settings.sound);
}
function playAdhan(key) {
  if (!settings.sound) return;
  if (audio) audio.pause();
  audio = new Audio(key === 'fajr' ? 'adhan-fajr.mp3' : 'adhan.mp3');
  audio.addEventListener('ended', syncSound);
  audio.play().then(syncSound, () => {
    // shortcut: browsers mute sound until the page is touched in this visit; a tap then starts the adhan late
    say('Tap anywhere on the page so the adhan can play.');
    document.addEventListener('pointerdown', () => audio.play().then(syncSound, () => {}), { once: true });
  });
}
$('sound').addEventListener('click', () => {
  if (playing()) { audio.pause(); return syncSound(); }
  settings.sound = !settings.sound;
  save();
  syncSound();
  say(settings.sound ? 'The adhan will play at each prayer time while this page is open.' : 'Adhan sound is off.');
});

// Your own iqama times
$('iqama-form').innerHTML = PRAYERS.map(k => `
  <div class="iq-rule">
    <label for="mode-${k}">${NAMES[k]}</label>
    <select id="mode-${k}" data-k="${k}">
      <option value="masjid">ISCJ time</option><option value="time">Fixed time</option><option value="offset">Minutes after adhan</option>
    </select>
    <input type="time" id="time-${k}" data-k="${k}" aria-label="${NAMES[k]} iqama time" hidden>
    <input type="number" id="offset-${k}" data-k="${k}" min="0" max="180" step="1" inputmode="numeric" aria-label="${NAMES[k]} iqama, minutes after adhan" hidden>
  </div>`).join('') + '<button class="btn btn-small" type="button" id="iqama-reset">Use ISCJ times for all</button>';

function fillForm() {
  for (const k of PRAYERS) {
    const rule = settings.iqama[k], mode = rule == null ? 'masjid' : rule[0] === '+' ? 'offset' : 'time';
    $(`mode-${k}`).value = mode;
    $(`time-${k}`).hidden = mode !== 'time';
    $(`offset-${k}`).hidden = mode !== 'offset';
    if (mode === 'time') $(`time-${k}`).value = rule.padStart(5, '0');
    if (mode === 'offset') $(`offset-${k}`).value = rule.slice(1);
  }
}
$('iqama-form').addEventListener('change', (e) => {
  const k = e.target.dataset.k;
  if (!k) return;
  const mode = $(`mode-${k}`).value, row = day.rows.find(r => r.key === k);
  if (mode === 'masjid') delete settings.iqama[k];
  else if (mode === 'time') {
    // start from the time already showing, so switching modes never blanks the row
    const v = e.target.type === 'time' ? e.target.value : `${String(Math.floor((row.iqama ?? row.adhan + 15) / 60) % 24).padStart(2, '0')}:${String((row.iqama ?? row.adhan + 15) % 60).padStart(2, '0')}`;
    if (parseHM(v) == null) return;
    settings.iqama[k] = v;
  } else {
    const n = e.target.type === 'number' ? Math.round(+e.target.value) : 15;
    if (!(n >= 0 && n <= 180)) return say('Minutes after adhan must be between 0 and 180.');
    settings.iqama[k] = `+${n}`;
  }
  save();
  fillForm();
  loadDay(today);
});
$('iqama-reset').addEventListener('click', () => { settings.iqama = {}; save(); fillForm(); loadDay(today); });

// Location and calculation method
$('method').innerHTML = Object.entries(CalculationMethods).map(([id, m]) => `<option value="${id}">${m.name}</option>`).join('');
$('method').value = settings.method;
$('asr').value = settings.asr === 'Hanafi' ? 'Hanafi' : 'Standard';
const recalc = () => { save(); today = null; tick(); };
$('method').addEventListener('change', () => { settings.method = $('method').value; recalc(); });
$('asr').addEventListener('change', () => { settings.asr = $('asr').value; recalc(); });
$('use-iscj').addEventListener('click', () => { settings.place = null; recalc(); });
$('use-here').addEventListener('click', () => {
  if (!navigator.geolocation) return say('This browser cannot share a location.');
  navigator.geolocation.getCurrentPosition(
    (pos) => { settings.place = { lat: +pos.coords.latitude.toFixed(3), lng: +pos.coords.longitude.toFixed(3) }; recalc(); },
    () => say('Location was not shared, so nothing changed.'));
});

// Install and offline
let installEvent = null;
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvent = e; $('install').hidden = false; });
$('install').addEventListener('click', async () => { installEvent.prompt(); await installEvent.userChoice; $('install').hidden = true; });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

// Start with calculated times at once, then fill in ISCJ's iqama times when they arrive
fillForm();
syncSound();
tick();
setInterval(tick, 1000);
fetch('iqama.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : Promise.reject()).then(j => {
  masjid = { iqama: j.iqama && typeof j.iqama === 'object' ? j.iqama : {}, jumuah: Array.isArray(j.jumuah) ? j.jumuah : [], updated: /^\d{4}-\d{2}-\d{2}$/.test(j.updated) ? j.updated : '', failed: false };
}, () => { masjid.failed = true; }).then(() => loadDay(today));
