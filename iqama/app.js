import PrayTimes from './lib/PrayTimes.js';
import { CalculationMethods } from './lib/CalculationMethods.js';
import { PRAYERS, NAMES, parseHM, iqamaAt, fmt, fmtSpan, nextEvent, km, alertsBetween, weatherKind } from './logic.js';
import { setSky } from './sky.js';

const $ = (id) => document.getElementById(id);
const validZone = (z) => { if (typeof z !== 'string') return false; try { new Intl.DateTimeFormat('en-US', { timeZone: z }); return true; } catch (e) { return false; } };
const DEVICE_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const ISCJ = { lat: 40.384, lng: -74.563, zone: 'America/New_York', name: 'ISCJ, Monmouth Junction NJ' };
const NEAR_KM = 40;
const ADHANS = { makkah: 'Makkah (3:44)', egypt: 'Egyptian style (3:25)', aqsa: 'Masjid Al-Aqsa (4:07)', ottoman: 'Ottoman style, Shaykh Nazim (2:38)', afasy: 'Mishary Al-Afasy (4:17)' };
const FAJR_ADHANS = { 'fajr-zahrani': 'Mansoor Az-Zahrani (3:26)', 'fajr-afasy': 'Mishary Al-Afasy (3:24)' };
const CHIMES = { beep: 'Soft beep', bismillah: 'Bismillah, spoken', none: 'No sound, message only' };
const REMINDERS = [['before', 'Before adhan', 10], ['after', 'After adhan', 15], ['iqama', 'Before iqama', 5]];
const DEFAULTS = { method: 'ISNA', asr: 'Standard', place: null, asked: false, iqama: {}, sound: false, adhan: 'makkah', fajrAdhan: 'fajr-zahrani', reminders: {}, chime: 'beep' };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FAHRENHEIT = /-US$/i.test(navigator.language || '');

// Settings stay on this device; anything malformed falls back to the defaults
let settings = { ...DEFAULTS };
try { settings = { ...DEFAULTS, ...JSON.parse(localStorage.getItem('iqama-settings') || '{}') }; } catch (e) {}
if (!CalculationMethods[settings.method]) settings.method = DEFAULTS.method;
if (!settings.iqama || typeof settings.iqama !== 'object') settings.iqama = {};
const p = settings.place;
settings.place = p && typeof p === 'object' && Number.isFinite(p.lat) && Number.isFinite(p.lng)
  ? { lat: p.lat, lng: p.lng, zone: validZone(p.zone) ? p.zone : DEVICE_ZONE, name: typeof p.name === 'string' && p.name ? p.name.slice(0, 80) : 'Your location' }
  : null;
if (settings.place) settings.asked = true;
if (!ADHANS[settings.adhan]) settings.adhan = DEFAULTS.adhan;
if (!FAJR_ADHANS[settings.fajrAdhan]) settings.fajrAdhan = DEFAULTS.fajrAdhan;
if (!CHIMES[settings.chime]) settings.chime = DEFAULTS.chime;
const savedRem = settings.reminders && typeof settings.reminders === 'object' ? settings.reminders : {};
settings.reminders = {};
for (const [k] of REMINDERS) if (Number.isInteger(savedRem[k]) && savedRem[k] >= 1 && savedRem[k] <= 60) settings.reminders[k] = savedRem[k];
const save = () => { try { localStorage.setItem('iqama-settings', JSON.stringify(settings)); } catch (e) {} };

let masjid = { iqama: {}, jumuah: [], updated: '', failed: false };
const place = () => settings.place || ISCJ;
const near = () => km(place(), ISCJ) <= NEAR_KM;
const say = (text) => { $('status').textContent = text; };

// Back link only for visitors who came from the portfolio, never in the installed app
try {
  const ref = new URL(document.referrer);
  $('back').hidden = !(ref.origin === location.origin && !ref.pathname.startsWith('/iqama') && !matchMedia('(display-mode: standalone)').matches);
} catch (e) {}

// Wall clock at the prayer location
const formatters = {};
function clock(date, zone) {
  const f = formatters[zone] ||= new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', weekday: 'short', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' });
  const parts = {};
  for (const { type, value } of f.formatToParts(date)) parts[type] = value;
  const [y, m, d, h, mi, s] = ['year', 'month', 'day', 'hour', 'minute', 'second'].map(k => +parts[k]);
  return { y, m, d, weekday: parts.weekday, sec: h * 3600 + mi * 60 + s, offset: Math.round((Date.UTC(y, m - 1, d, h, mi, s) - date.getTime()) / 9e5) / 4 };
}

function dayTimes(y, m, d) {
  const { lat, lng, zone } = place(), useMasjid = near();
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
      return { key, adhan, own, iqama: iqamaAt(own ? settings.iqama[key] : useMasjid ? masjid.iqama[key] : null, adhan) };
    }),
  };
}

let today = null, day = null, tomorrowFajr = 0, lastSec = null, weather = null;

function loadDay(c) {
  today = c;
  day = dayTimes(c.y, c.m, c.d);
  const n = new Date(Date.UTC(c.y, c.m - 1, c.d + 1));
  tomorrowFajr = dayTimes(n.getUTCFullYear(), n.getUTCMonth() + 1, n.getUTCDate()).rows[0].adhan;
  renderDay();
}

const jumuah = () => near() ? masjid.jumuah.map(parseHM).filter(v => v != null).map(fmt).join(', ') : '';

function renderDay() {
  $('date').textContent = `${today.weekday}, ${MONTHS[today.m - 1]} ${today.d}`;
  $('place').textContent = place().name;
  $('place-name').textContent = place().name;

  let body = '';
  for (const r of day.rows) {
    body += `<tr data-k="${r.key}"><th scope="row">${NAMES[r.key]}</th><td>${fmt(r.adhan)}</td><td>${r.iqama == null ? 'Not set' : fmt(r.iqama)}</td></tr>`;
    if (r.key === 'fajr') body += `<tr class="minor"><th scope="row">Sunrise</th><td>${fmt(day.sunrise)}</td><td></td></tr>`;
  }
  if (jumuah()) body += `<tr class="minor${today.weekday === 'Fri' ? ' friday' : ''}"><th scope="row">Jumu&rsquo;ah khutbah</th><td colspan="2">${jumuah()}</td></tr>`;
  $('today').tBodies[0].innerHTML = body;

  const own = day.rows.filter(r => r.own).map(r => NAMES[r.key]), mine = own.length ? ` ${own.join(', ')} set by you.` : '';
  const [uy, um, ud] = masjid.updated.split('-');
  $('source').textContent =
    own.length === 5 ? 'All iqama times set by you.'
      : !near() ? (own.length ? `${mine.trim()} Set the rest under Set your own iqama times.` : 'ISCJ iqama times only show near the masjid. Set your masjid’s times under Set your own iqama times.')
      : masjid.failed ? `Could not load ISCJ iqama times. Set your own below.${mine}`
      : `Iqama times from ISCJ${uy ? `, last changed ${MONTHS[um - 1]} ${+ud}, ${uy}` : ''}.${mine}`;

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
  const nowMin = c.sec / 60, ev = nextEvent(day.rows, tomorrowFajr, nowMin);
  $('next-label').textContent = `${NAMES[ev.key]} ${ev.kind} in`;
  $('countdown').textContent = fmtSpan(ev.at * 60 - c.sec);
  $('next-at').textContent = `at ${fmt(ev.at)}${ev.at >= 1440 ? ' tomorrow' : ''}`;
  $('now').textContent = fmt(Math.floor(nowMin));
  for (const tr of $('today').tBodies[0].rows) tr.classList.toggle('next', tr.dataset.k === ev.key);
  const [hx, hy] = at(nowMin);
  $('hand').setAttribute('cx', hx);
  $('hand').setAttribute('cy', hy);
  setSky(weather ? weather.kind : 'plain', nowMin >= day.sunrise && nowMin < day.rows[3].adhan);

  // Adhan and reminders: only for moments crossed while the page is open
  if (lastSec != null && c.sec > lastSec) for (const a of alertsBetween(day.rows, settings.reminders, lastSec, c.sec)) fire(a);
  lastSec = c.sec;
}

// Month table: adhan times only
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

// Sound: one player for adhan, reminders and previews
let audio = null;
const playing = () => !!audio && !audio.paused && !audio.ended;
function syncSound() {
  $('sound').textContent = playing() ? 'Stop sound' : `Adhan sound: ${settings.sound ? 'on' : 'off'}`;
  $('sound').setAttribute('aria-pressed', settings.sound);
}
function play(file) {
  if (audio) audio.pause();
  audio = new Audio(`audio/${file}.mp3`);
  audio.addEventListener('ended', syncSound);
  audio.addEventListener('pause', syncSound);
  audio.play().then(syncSound, () => {
    // shortcut: browsers mute sound until the page is touched in this visit; a tap then starts it late
    say('Tap anywhere on the page so the sound can play.');
    document.addEventListener('pointerdown', () => audio.play().then(syncSound, () => {}), { once: true });
  });
}
$('sound').addEventListener('click', () => {
  if (playing()) return audio.pause();
  settings.sound = !settings.sound;
  save();
  syncSound();
  if (settings.sound) $('sound-panel').open = true;
  say(settings.sound ? 'The adhan will play at each prayer time while this page is open. Pick the recording under Adhan and reminders.' : 'Adhan sound is off.');
});

const options = (map) => Object.entries(map).map(([id, name]) => `<option value="${id}">${name}</option>`).join('');
for (const [id, key, map] of [['adhan', 'adhan', ADHANS], ['fajr-adhan', 'fajrAdhan', FAJR_ADHANS], ['chime', 'chime', CHIMES]]) {
  $(id).innerHTML = options(map);
  $(id).value = settings[key];
  $(id).addEventListener('change', () => { settings[key] = $(id).value; save(); });
}
document.querySelectorAll('[data-try]').forEach(b => b.addEventListener('click', () => {
  if (playing()) return audio.pause();
  const file = $(b.dataset.try).value;
  if (file === 'none') return say('Reminders will show a message without sound.');
  play(file);
}));

// Reminders
$('reminders').innerHTML = REMINDERS.map(([k, label, n]) => `
  <div class="iq-rem">
    <input type="checkbox" id="rem-${k}" data-k="${k}">
    <label for="rem-${k}">${label}</label>
    <input type="number" id="rem-${k}-min" data-k="${k}" min="1" max="60" step="1" inputmode="numeric" value="${settings.reminders[k] || n}" aria-label="${label}, minutes">
    <span>minutes</span>
  </div>`).join('');
for (const [k] of REMINDERS) $(`rem-${k}`).checked = !!settings.reminders[k];
$('reminders').addEventListener('change', (e) => {
  const k = e.target.dataset.k;
  if (!k) return;
  const n = Math.round(+$(`rem-${k}-min`).value);
  if ($(`rem-${k}`).checked) {
    if (!(n >= 1 && n <= 60)) return say('Reminder minutes must be between 1 and 60.');
    settings.reminders[k] = n;
    try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); } catch (err) {}
  } else delete settings.reminders[k];
  save();
});

function notify(text) {
  if (!('Notification' in window) || Notification.permission !== 'granted' || !navigator.serviceWorker) return;
  navigator.serviceWorker.ready.then(r => r.showNotification('Iqama Times', { body: text, icon: 'icon-192.png', tag: 'iqama' })).catch(() => {});
}
const MESSAGES = {
  adhan: (n) => `Time for ${n}.`,
  before: (n, m) => `${n} adhan in ${m} minutes.`,
  after: (n, m) => `${n} adhan was ${m} minutes ago.`,
  iqama: (n, m) => `${n} iqama in ${m} minutes.`,
};
function fire({ kind, key }) {
  const text = MESSAGES[kind](NAMES[key], settings.reminders[kind]);
  say(text);
  if (document.hidden) notify(text);
  if (kind === 'adhan') { if (settings.sound) play(key === 'fajr' ? settings.fajrAdhan : settings.adhan); }
  else if (settings.chime !== 'none' && !playing()) play(settings.chime);
}

// Your own iqama times; the first choice is ISCJ near the masjid and "Not set" elsewhere
function buildForm() {
  const nearby = near();
  $('iqama-note').textContent = nearby
    ? 'Each prayer can follow ISCJ, a fixed time, or a number of minutes after adhan. Your choices stay on this device.'
    : 'You are not near ISCJ, so set your masjid’s iqama times: a fixed time or a number of minutes after adhan. Your choices stay on this device.';
  $('iqama-form').innerHTML = PRAYERS.map(k => `
    <div class="iq-rule">
      <label for="mode-${k}">${NAMES[k]}</label>
      <select id="mode-${k}" data-k="${k}">
        <option value="masjid">${nearby ? 'ISCJ time' : 'Not set'}</option><option value="time">Fixed time</option><option value="offset">Minutes after adhan</option>
      </select>
      <input type="time" id="time-${k}" data-k="${k}" aria-label="${NAMES[k]} iqama time" hidden>
      <input type="number" id="offset-${k}" data-k="${k}" min="0" max="180" step="1" inputmode="numeric" aria-label="${NAMES[k]} iqama, minutes after adhan" hidden>
    </div>`).join('') + `<button class="btn btn-small" type="button" id="iqama-reset">${nearby ? 'Use ISCJ times for all' : 'Clear all'}</button>`;
  $('iqama-reset').addEventListener('click', () => { settings.iqama = {}; save(); fillForm(); loadDay(today); });
  fillForm();
}
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
    const base = row.iqama ?? row.adhan + 15;
    const v = e.target.type === 'time' ? e.target.value : `${String(Math.floor(base / 60) % 24).padStart(2, '0')}:${String(base % 60).padStart(2, '0')}`;
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

// Location
function setPlace(p) {
  settings.place = p;
  settings.asked = true;
  save();
  $('ask').hidden = true;
  $('results').replaceChildren();
  today = null;
  lastSec = null;
  buildForm();
  tick();
  loadWeather();
  if (!near() && !Object.keys(settings.iqama).length) $('iqama-panel').open = true;
  say(`Times are now for ${place().name}.`);
}
function locateMe() {
  if (!navigator.geolocation) return say('This browser cannot share a location. Search for your city instead.');
  navigator.geolocation.getCurrentPosition(
    (pos) => setPlace({ lat: +pos.coords.latitude.toFixed(3), lng: +pos.coords.longitude.toFixed(3), zone: DEVICE_ZONE, name: 'Your location' }),
    () => say('Location was not shared, so nothing changed. Search for your city instead.'));
}
const openLocation = () => { $('loc-panel').open = true; $('search').focus(); };
$('use-here').addEventListener('click', locateMe);
$('ask-here').addEventListener('click', locateMe);
$('use-iscj').addEventListener('click', () => setPlace(null));
$('ask-iscj').addEventListener('click', () => { settings.asked = true; save(); $('ask').hidden = true; });
$('ask-search').addEventListener('click', openLocation);
$('change-place').addEventListener('click', openLocation);
$('ask').hidden = settings.asked;

$('search-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const q = $('search').value.trim(), list = $('results');
  list.replaceChildren();
  if (q.length < 2) return say('Type at least two letters of a city name.');
  try {
    const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=5&language=en&format=json&name=${encodeURIComponent(q)}`);
    if (!r.ok) throw new Error(r.status);
    const hits = ((await r.json()).results || []).filter(h => Number.isFinite(h.latitude) && Number.isFinite(h.longitude) && typeof h.name === 'string');
    if (!hits.length) return say(`No places found for “${q}”. Try a nearby larger town.`);
    say('');
    for (const h of hits) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn btn-small';
      b.textContent = [h.name, h.admin1, h.country].filter(v => typeof v === 'string' && v).join(', ');
      b.addEventListener('click', () => setPlace({
        lat: +h.latitude.toFixed(3), lng: +h.longitude.toFixed(3),
        zone: validZone(h.timezone) ? h.timezone : DEVICE_ZONE,
        name: [h.name, typeof h.admin1 === 'string' ? h.admin1 : h.country].filter(Boolean).join(', ').slice(0, 80),
      }));
      const li = document.createElement('li');
      li.append(b);
      list.append(li);
    }
  } catch (err) {
    say('Could not search places. Check your connection and try again.');
  }
});

// Calculation method
$('method').innerHTML = Object.entries(CalculationMethods).map(([id, m]) => `<option value="${id}">${m.name}</option>`).join('');
$('method').value = settings.method;
$('asr').value = settings.asr === 'Hanafi' ? 'Hanafi' : 'Standard';
const recalc = () => { save(); today = null; tick(); };
$('method').addEventListener('change', () => { settings.method = $('method').value; recalc(); });
$('asr').addEventListener('change', () => { settings.asr = $('asr').value; recalc(); });

// Weather for the backdrop; the page works the same without it
async function loadWeather() {
  const { lat, lng } = place();
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code&temperature_unit=${FAHRENHEIT ? 'fahrenheit' : 'celsius'}`);
    if (!r.ok) throw new Error(r.status);
    const c = (await r.json()).current;
    if (!Number.isFinite(c.temperature_2m)) throw new Error('no reading');
    weather = { temp: Math.round(c.temperature_2m), ...weatherKind(c.weather_code) };
  } catch (e) {
    weather = null;
  }
  $('weather').textContent = weather ? `${weather.temp}°${FAHRENHEIT ? 'F' : 'C'}${weather.label ? `, ${weather.label.toLowerCase()}` : ''}` : '';
  tick();
}

// Install and offline
let installEvent = null;
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvent = e; $('install').hidden = false; });
$('install').addEventListener('click', async () => { installEvent.prompt(); await installEvent.userChoice; $('install').hidden = true; });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

// Start with calculated times at once, then fill in ISCJ's iqama times and the weather when they arrive
buildForm();
syncSound();
tick();
setInterval(tick, 1000);
loadWeather();
setInterval(loadWeather, 30 * 60 * 1000);
fetch('iqama.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : Promise.reject()).then(j => {
  masjid = { iqama: j.iqama && typeof j.iqama === 'object' ? j.iqama : {}, jumuah: Array.isArray(j.jumuah) ? j.jumuah : [], updated: /^\d{4}-\d{2}-\d{2}$/.test(j.updated) ? j.updated : '', failed: false };
}, () => { masjid.failed = true; }).then(() => loadDay(today));
