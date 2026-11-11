import PrayTimes from './lib/PrayTimes.js';
import { CalculationMethods } from './lib/CalculationMethods.js';
import { PRAYERS, NAMES, parseHM, iqamaAt, fmt, nextEvent, km, alertsBetween, outlook, cardWindow } from './logic.js';
import { setSky, redrawSky } from './sky.js';
import { CLOCKS, renderClock, renderTimes } from './clocks.js';
import { fetchWeather, weatherHtml } from './weather.js';
import { SETS, pickSet } from './adhkar.js';

const $ = (id) => document.getElementById(id);
const root = document.documentElement;
const validZone = (z) => { if (typeof z !== 'string') return false; try { new Intl.DateTimeFormat('en-US', { timeZone: z }); return true; } catch (e) { return false; } };
const DEVICE_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const ISCJ = { lat: 40.384, lng: -74.563, zone: 'America/New_York', name: 'ISCJ, Monmouth Junction NJ' };
const NEAR_KM = 40;
const ADHANS = { makkah: 'Makkah (3:44)', egypt: 'Egyptian style (3:25)', aqsa: 'Masjid Al-Aqsa (4:07)', ottoman: 'Ottoman style, Shaykh Nazim (2:38)', afasy: 'Mishary Al-Afasy (4:17)' };
const FAJR_ADHANS = { 'fajr-zahrani': 'Mansoor Az-Zahrani (3:26)', 'fajr-afasy': 'Mishary Al-Afasy (3:24)' };
const ALERT_TYPES = { adhan: 'Adhan recording', beep: 'Soft beep', bismillah: 'Bismillah, spoken', message: 'Message only', off: 'Off' };
const SHORT_TYPES = ['beep', 'bismillah', 'message', 'off'];
const ALERT_KEYS = [...PRAYERS, 'jumuah'];
const PALETTES = { petrol: 'Petrol', green: 'Masjid green', dusk: 'Dusk', night: 'Night', contrast: 'High contrast' };
const MODES = ['auto', 'light', 'dark'];
const DEFAULTS = {
  method: 'ISNA', asr: 'Standard', place: null, asked: false, iqama: {}, adhan: 'makkah', fajrAdhan: 'fajr-zahrani', muted: false, alerts: null,
  clock: 'board', palette: 'petrol', mode: 'auto', units: /-US$/i.test(navigator.language || '') ? 'F' : 'C',
  adhkar: true, translit: true, arSize: 'm', awake: false, dxLayout: 'auto', dxNight: false, dxAuto: false, dxCard: 'rest',
};
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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
if (!CLOCKS[settings.clock]) settings.clock = DEFAULTS.clock;
if (!PALETTES[settings.palette]) settings.palette = DEFAULTS.palette;
if (!MODES.includes(settings.mode)) settings.mode = DEFAULTS.mode;
if (settings.units !== 'F' && settings.units !== 'C') settings.units = DEFAULTS.units;
settings.muted = settings.muted === true;
settings.adhkar = settings.adhkar !== false;
settings.translit = settings.translit !== false;
if (!['s', 'm', 'l'].includes(settings.arSize)) settings.arSize = DEFAULTS.arSize;
settings.awake = settings.awake === true;
settings.dxNight = settings.dxNight === true;
settings.dxAuto = settings.dxAuto === true;
if (!['rest', 'duas'].includes(settings.dxCard)) settings.dxCard = DEFAULTS.dxCard;
if (!['auto', 'times', 'full'].includes(settings.dxLayout)) settings.dxLayout = DEFAULTS.dxLayout;

// Alerts for each prayer and for Jumu'ah
const blankAlert = (key) => key === 'jumuah'
  ? { on: false, before: { type: 'message', min: 15 }, time: null }
  : { on: true, adhan: 'message', before: { type: 'off', min: 10 }, iqama: { type: 'off', min: 5 } };
function cleanAlert(key, a) {
  const d = blankAlert(key);
  if (!a || typeof a !== 'object') return d;
  const step = (s, def) => (s && SHORT_TYPES.includes(s.type) && Number.isInteger(s.min) && s.min >= 1 && s.min <= 60 ? { type: s.type, min: s.min } : def);
  if (key === 'jumuah') return { on: a.on === true, before: step(a.before, d.before), time: parseHM(a.time) != null ? a.time : null };
  return { on: a.on !== false, adhan: ALERT_TYPES[a.adhan] ? a.adhan : d.adhan, before: step(a.before, d.before), iqama: step(a.iqama, d.iqama) };
}
const savedAlerts = settings.alerts && typeof settings.alerts === 'object' ? settings.alerts : {};
settings.alerts = Object.fromEntries(ALERT_KEYS.map(k => [k, cleanAlert(k, savedAlerts[k])]));
const save = () => { try { localStorage.setItem('iqama-settings', JSON.stringify(settings)); } catch (e) {} };

// Theme and clock style
const darkMQ = matchMedia('(prefers-color-scheme: dark)');
function applyLook() {
  root.dataset.palette = settings.palette;
  root.dataset.theme = settings.palette === 'night' ? 'dark' : settings.mode === 'auto' ? (darkMQ.matches ? 'dark' : 'light') : settings.mode;
  root.dataset.clock = settings.clock;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = getComputedStyle(root).getPropertyValue('--paper').trim() || '#0B2A33';
  redrawSky();
}
darkMQ.addEventListener?.('change', applyLook);
applyLook();

let masjid = { iqama: {}, jumuah: [], updated: '', checked: 0, stale: false, failed: false };
const place = () => settings.place || ISCJ;
const near = () => km(place(), ISCJ) <= NEAR_KM;
// Messages show as a toast above the tab bar and fade after a few seconds
let toastTimer = 0;
const say = (text) => {
  $('status').textContent = text;
  $('status').classList.toggle('show', !!text);
  clearTimeout(toastTimer);
  if (text) toastTimer = setTimeout(() => $('status').classList.remove('show'), 5000);
};

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

let today = null, day = null, tomorrow = null, lastSec = null, weather = null;

function loadDay(c) {
  today = c;
  day = dayTimes(c.y, c.m, c.d);
  const n = new Date(Date.UTC(c.y, c.m - 1, c.d + 1));
  tomorrow = dayTimes(n.getUTCFullYear(), n.getUTCMonth() + 1, n.getUTCDate());
  today.long = new Intl.DateTimeFormat('en-US', { timeZone: place().zone, weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());
  renderDay();
  renderWeather();
}

const jumuahMins = () => (near() ? masjid.jumuah.map(parseHM).filter(v => v != null) : []);
const jumuah = () => jumuahMins().map(fmt).join(', ');

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
      : `Iqama times from ISCJ${masjid.checked ? `, checked ${new Date(masjid.checked).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}${masjid.stale ? ' (ISCJ did not answer, so this is the last copy)' : ''}` : uy ? `, last changed ${MONTHS[um - 1]} ${+ud}, ${uy}` : ''}.${mine}`;

  jumuahNote();
  $('dx-date').textContent = today.long;
  $('dx-place').textContent = place().name;
  if (tab === 'month') { renderMonth(); $('tab-title').textContent = monthTitle(); }
  tick();
}

// Friday khutbah for the Jumu'ah alert: the visitor's own time, else ISCJ's first khutbah nearby
const khutbah = () => parseHM(settings.alerts.jumuah.time) ?? jumuahMins()[0] ?? null;
const alertRows = () => (today.weekday === 'Fri' && khutbah() != null ? [...day.rows, { key: 'jumuah', adhan: khutbah(), iqama: null }] : day.rows);

function tick() {
  const c = clock(new Date(), place().zone);
  if (!today || c.d !== today.d) { const later = !!today; loadDay(c); if (later) sync(); return; }
  const nowMin = c.sec / 60, ev = nextEvent(day.rows, tomorrow.rows[0].adhan, nowMin, day.sunrise);
  $('now').textContent = fmt(Math.floor(nowMin));
  const html = renderClock(settings.clock, { sec: c.sec, now: nowMin, rows: day.rows, sunrise: day.sunrise, next: ev, jumuah: jumuahMins(), date: today.long });
  $('clock').innerHTML = html;
  nowMinute = nowMin;
  if (displayOpen) {
    applyNight();
    if (timesLayout()) $('dx-small').innerHTML = renderTimes({ sec: c.sec, now: nowMin, rows: day.rows, sunrise: day.sunrise, next: ev, tomorrowFajr: tomorrow.rows[0], wx: wxStats(), card: dxCardFor(nowMin), jumuah: jumuahMins(), friday: today.weekday === 'Fri' });
    else {
      $('dx-clock').innerHTML = html;
      if (c.sec % 10 === 0) fitDisplay(); // re-fit after late font loads or a change in what the clock shows
    }
  }
  renderAdhkar(nowMin);
  for (const tr of $('today').tBodies[0].rows) tr.classList.toggle('next', tr.dataset.k === ev.key);
  setSky(weather ? weather.kind : 'plain', nowMin >= day.sunrise && nowMin < day.rows[3].adhan);

  // Alerts: only for moments crossed while the page is open
  if (lastSec != null && c.sec > lastSec) for (const a of alertsBetween(alertRows(), settings.alerts, lastSec, c.sec)) fire(a);
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
const monthTitle = () => (today ? new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date(Date.UTC(today.y, today.m - 1, 15))) : 'This month');

// Tabs: one screen each, chosen by the address (#weather), so the back button moves between them
const TAB_IDS = ['today', 'weather', 'alerts', 'month', 'settings'];
const TITLES = { today: 'Today', weather: 'Weather', alerts: 'Adhan and alerts', settings: 'Settings' };
let tab = 'today', sub = 'location';
function go(t, s) {
  if (s) sub = s;
  if (location.hash.slice(1) === t) route(); else location.hash = t;
}
function route() {
  const h = location.hash.slice(1);
  tab = TAB_IDS.includes(h) ? h : 'today';
  for (const id of TAB_IDS) $(`tab-${id}`).hidden = id !== tab;
  document.querySelectorAll('.tabbar a, .dockbar a').forEach(a => {
    const on = a.getAttribute('href') === `#${tab}`;
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    a.classList.toggle('d-menu-active', on && !!a.closest('.tabbar'));
    a.classList.toggle('d-dock-active', on && !!a.closest('.dockbar'));
  });
  $('tab-title').textContent = tab === 'month' ? monthTitle() : TITLES[tab];
  document.querySelectorAll('[data-sub]').forEach(b => b.setAttribute('aria-selected', b.dataset.sub === sub));
  document.querySelectorAll('.sub-pane').forEach(p => { p.hidden = p.id !== `sub-${sub}`; });
  if (tab === 'month' && today) renderMonth();
}
addEventListener('hashchange', route);
document.querySelectorAll('[data-sub]').forEach(b => b.addEventListener('click', () => { sub = b.dataset.sub; route(); }));

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
$('share-app').addEventListener('click', () => share('Iqama Times', 'Prayer and iqama times with a live clock, alerts and weather.'));

// Sound: one player for the adhan, alert sounds and previews
let audio = null;
const playing = () => !!audio && !audio.paused && !audio.ended;
function syncSound() {
  $('alerts-label').textContent = playing() ? 'Stop sound' : `Alerts: ${settings.muted ? 'off' : 'on'}`;
  $('alerts-toggle').checked = !settings.muted;
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
$('alerts-toggle').addEventListener('click', (e) => {
  if (playing()) { e.preventDefault(); return audio.pause(); }
  settings.muted = !settings.muted;
  save();
  syncSound();
  say(settings.muted ? 'All alerts are off. Your settings for each prayer are kept.' : 'Alerts are on. Set them for each prayer under Adhan and alerts.');
});

const fillSelect = (id, map, value) => { $(id).innerHTML = Object.entries(map).map(([k, v]) => `<option value="${k}">${v}</option>`).join(''); $(id).value = value; };
fillSelect('adhan', ADHANS, settings.adhan);
fillSelect('fajr-adhan', FAJR_ADHANS, settings.fajrAdhan);
$('adhan').addEventListener('change', () => { settings.adhan = $('adhan').value; save(); });
$('fajr-adhan').addEventListener('change', () => { settings.fajrAdhan = $('fajr-adhan').value; save(); });
document.querySelectorAll('[data-try]').forEach(b => b.addEventListener('click', () => {
  if (playing()) return audio.pause();
  const t = b.dataset.try;
  play(t === 'adhan' ? settings.adhan : t === 'fajr-adhan' ? settings.fajrAdhan : t);
}));

// Alert cards, one per prayer plus Jumu'ah
const typeOptions = (types, sel) => types.map(t => `<option value="${t}"${t === sel ? ' selected' : ''}>${ALERT_TYPES[t]}</option>`).join('');
function alertCard(k) {
  const a = settings.alerts[k], id = (part) => `al-${k}-${part}`, name = k === 'jumuah' ? 'Jumu’ah' : NAMES[k];
  const step = (part, label) => `<div class="al-row"><label for="${id(`${part}-type`)}">${label}</label><select class="d-select d-select-sm" id="${id(`${part}-type`)}" data-k="${k}">${typeOptions(SHORT_TYPES, a[part].type)}</select>`
    + `<span class="al-min"><input class="d-input d-input-sm" type="number" id="${id(`${part}-min`)}" data-k="${k}" min="1" max="60" step="1" inputmode="numeric" value="${a[part].min}" aria-label="${name}, ${label.toLowerCase()}, minutes"><span>min</span></span></div>`;
  const body = k === 'jumuah'
    ? `${step('before', 'Before khutbah')}<div class="al-row"><label for="${id('time')}">Khutbah time</label><input class="d-input d-input-sm" type="time" id="${id('time')}" data-k="${k}" value="${a.time ? a.time.padStart(5, '0') : ''}"></div><p class="al-note" id="al-jumuah-note"></p>`
    : `<div class="al-row"><label for="${id('adhan')}">At adhan</label><select class="d-select d-select-sm" id="${id('adhan')}" data-k="${k}">${typeOptions(Object.keys(ALERT_TYPES), a.adhan)}</select></div>`
      + `${step('before', 'Before adhan')}${step('iqama', 'Before iqama')}<button class="d-btn d-btn-sm d-btn-ghost al-copy" type="button" data-copy="${k}">Use for all prayers</button>`;
  return `<div class="al-card d-collapse d-collapse-arrow" id="${id('card')}"><input type="checkbox" class="al-open" aria-label="Show ${name} settings">`
    + `<div class="d-collapse-title al-title"><input class="d-toggle d-toggle-success d-toggle-sm" type="checkbox" role="switch" id="${id('on')}" data-k="${k}" aria-label="${name} alerts"${a.on ? ' checked' : ''}><span class="al-name">${name}</span><span class="al-sum" id="${id('sum')}">${alertSummary(k, a)}</span></div>`
    + `<div class="d-collapse-content al-body">${body}</div></div>`;
}
// A short line that sums up a card, so it is readable while folded
function alertSummary(k, a) {
  if (!a.on) return 'Off';
  const parts = k === 'jumuah' ? [] : [ALERT_TYPES[a.adhan]];
  if (a.before.type !== 'off') parts.push(`${a.before.min} min before ${k === 'jumuah' ? 'khutbah' : 'adhan'}`);
  if (k !== 'jumuah' && a.iqama.type !== 'off') parts.push(`${a.iqama.min} min before iqama`);
  return parts.join(', ') || 'No alerts';
}
function syncCard(k) {
  const a = settings.alerts[k], card = $(`al-${k}-card`);
  card.classList.toggle('is-off', !a.on);
  card.querySelectorAll('.al-body select, .al-body input, .al-body button').forEach(el => { el.disabled = !a.on; });
  $(`al-${k}-sum`).textContent = alertSummary(k, a);
}
function buildAlerts() { $('alert-cards').innerHTML = ALERT_KEYS.map(alertCard).join(''); ALERT_KEYS.forEach(syncCard); jumuahNote(); }
function jumuahNote() {
  const el = $('al-jumuah-note');
  if (!el) return;
  const own = parseHM(settings.alerts.jumuah.time), first = jumuahMins()[0];
  el.textContent = own != null ? `Fridays, before your khutbah time of ${fmt(own)}.`
    : first != null ? `Uses ISCJ’s first khutbah, ${fmt(first)}, unless you set a time.` : 'Set your khutbah time to get this alert.';
}
$('alert-cards').addEventListener('change', (e) => {
  const k = e.target.dataset.k;
  if (!k) return;
  const v = (part) => $(`al-${k}-${part}`), a = settings.alerts[k];
  const mins = (part, old) => { const n = Math.round(+v(part).value); if (n >= 1 && n <= 60) return n; say('Alert minutes must be between 1 and 60.'); v(part).value = old; return old; };
  a.on = v('on').checked;
  a.before = { type: v('before-type').value, min: mins('before-min', a.before.min) };
  if (k === 'jumuah') a.time = parseHM(v('time').value) != null ? v('time').value : null;
  else { a.adhan = v('adhan').value; a.iqama = { type: v('iqama-type').value, min: mins('iqama-min', a.iqama.min) }; }
  settings.alerts[k] = cleanAlert(k, a);
  save();
  syncCard(k);
  jumuahNote();
  try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); } catch (err) {}
});
$('alert-cards').addEventListener('click', (e) => {
  const k = e.target.dataset.copy;
  if (!k) return;
  for (const other of PRAYERS) if (other !== k) settings.alerts[other] = cleanAlert(other, JSON.parse(JSON.stringify(settings.alerts[k])));
  save();
  buildAlerts();
  say(`All five prayers now use the ${NAMES[k]} alerts.`);
});

function notify(text) {
  if (!('Notification' in window) || Notification.permission !== 'granted' || !navigator.serviceWorker) return;
  navigator.serviceWorker.ready.then(r => r.showNotification('Iqama Times', { body: text, icon: 'icon-192.png', tag: 'iqama' })).catch(() => {});
}
const MESSAGES = {
  adhan: (n) => `Time for ${n}.`,
  before: (n, m, k) => `${n} ${k === 'jumuah' ? 'khutbah' : 'adhan'} in ${m} minutes.`,
  iqama: (n, m) => `${n} iqama in ${m} minutes.`,
};
function fire({ kind, key, type, min }) {
  if (settings.muted) return;
  const text = MESSAGES[kind](key === 'jumuah' ? 'Jumu’ah' : NAMES[key], min, key);
  say(text);
  if (document.hidden) notify(text);
  if (type === 'adhan') play(key === 'fajr' ? settings.fajrAdhan : settings.adhan);
  else if ((type === 'beep' || type === 'bismillah') && !playing()) play(type);
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
      <select class="d-select d-select-sm" id="mode-${k}" data-k="${k}">
        <option value="masjid">${nearby ? 'ISCJ time' : 'Not set'}</option><option value="time">Fixed time</option><option value="offset">Minutes after adhan</option>
      </select>
      <input class="d-input d-input-sm" type="time" id="time-${k}" data-k="${k}" aria-label="${NAMES[k]} iqama time" hidden>
      <input class="d-input d-input-sm" type="number" id="offset-${k}" data-k="${k}" min="0" max="180" step="1" inputmode="numeric" aria-label="${NAMES[k]} iqama, minutes after adhan" hidden>
    </div>`).join('') + `<button class="d-btn d-btn-sm" type="button" id="iqama-reset">${nearby ? 'Use ISCJ times for all' : 'Clear all'}</button>`;
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
function setPlace(pl) {
  settings.place = pl;
  settings.asked = true;
  save();
  $('ask').hidden = true;
  $('results').replaceChildren();
  today = null;
  lastSec = null;
  buildForm();
  tick();
  loadWeather();
  const needIqama = !near() && !Object.keys(settings.iqama).length;
  if (needIqama) go('settings', 'iqama');
  say(`Times are now for ${place().name}.${needIqama ? ' Set your masjid’s iqama times here.' : ''}`);
}
function locateMe() {
  if (!navigator.geolocation) return say('This browser cannot share a location. Search for your city instead.');
  navigator.geolocation.getCurrentPosition(
    (pos) => setPlace({ lat: +pos.coords.latitude.toFixed(3), lng: +pos.coords.longitude.toFixed(3), zone: DEVICE_ZONE, name: 'Your location' }),
    () => say('Location was not shared, so nothing changed. Search for your city instead.'));
}
const openLocation = () => { go('settings', 'location'); $('search').focus(); };
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
      b.className = 'd-btn d-btn-sm';
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
fillSelect('method', Object.fromEntries(Object.entries(CalculationMethods).map(([id, m]) => [id, m.name])), settings.method);
$('asr').value = settings.asr === 'Hanafi' ? 'Hanafi' : 'Standard';
const recalc = () => { save(); today = null; tick(); };
$('method').addEventListener('change', () => { settings.method = $('method').value; recalc(); });
$('asr').addEventListener('change', () => { settings.asr = $('asr').value; recalc(); });

// Clock style and theme
// decorative swatches: the theme's dark paper beside its accent
const SWATCH = { petrol: ['#0B2A33', '#5BD6B8'], green: ['#0B2219', '#D9B657'], dusk: ['#1A1830', '#5ED6D0'], night: ['#000000', '#E8A33D'], contrast: ['#000000', '#FFFFFF'] };
function fillPicker(id, map, current, label, onPick) {
  const box = $(id);
  box.innerHTML = Object.entries(map).map(([k, name]) => `<button type="button" role="radio" data-v="${k}" aria-checked="${k === current}" ${label(k, name)}</button>`).join('');
  box.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    box.querySelectorAll('button').forEach(x => x.setAttribute('aria-checked', x === b));
    onPick(b.dataset.v);
  });
}
fillPicker('clock-style', CLOCKS, settings.clock, (k, name) => `class="d-btn d-btn-sm">${name}`, (v) => { settings.clock = v; save(); applyLook(); tick(); });
fillPicker('palette', PALETTES, settings.palette, (k, name) => `class="swatch" style="--a:${SWATCH[k][0]};--b:${SWATCH[k][1]}" aria-label="${name}" title="${name}">`, (v) => { settings.palette = v; save(); applyLook(); syncMode(); });
const modeInputs = document.querySelectorAll('input[name="mode"]');
function syncMode() {
  modeInputs.forEach(r => { r.checked = r.value === settings.mode; r.disabled = settings.palette === 'night'; });
  $('mode-note').textContent = settings.palette === 'night' ? 'Night is always dark, for low glare.' : '';
}
modeInputs.forEach(r => r.addEventListener('change', () => { settings.mode = r.value; save(); applyLook(); }));

// Weather, for the header, the backdrop and the Weather panel; the page works the same without it
async function loadWeather() {
  const { lat, lng } = place();
  try { weather = await fetchWeather(lat, lng, settings.units); } catch (e) { weather = null; }
  renderWeather();
  tick();
}
function prayerMarks() {
  if (!day) return [];
  const nowMin = clock(new Date(), place().zone).sec / 60;
  return day.rows.map((r, i) => (r.adhan >= nowMin ? { name: NAMES[r.key], min: r.adhan, today: true } : { name: NAMES[r.key], min: tomorrow.rows[i].adhan, today: false }));
}
// Under the time in the times-only full screen: temperature, a line about the next two days, then one row of details.
function wxStats() {
  const w = weather;
  if (!w) return '';
  const u = settings.units, r = v => (v == null ? '–' : Math.round(v)), out = outlook(w.days, u), rain = w.today.pop ?? w.pop;
  const item = (k, v) => `<span class="tm-st"><span class="tm-k">${k}</span><b>${v}</b></span>`;
  return `<div class="tm-wx"><p class="tm-temp">${r(w.temp)}°${u}<span>${w.label ? w.label.toLowerCase() : ''}</span></p>${out ? `<p class="tm-out">${out}</p>` : ''}<div class="tm-stats">`
    + item('High/low', `${r(w.today.max)}°/${r(w.today.min)}°`) + item('Feels', `${r(w.feels)}°`) + item('Humidity', w.humidity == null ? '–' : `${r(w.humidity)}%`)
    + item('Wind', `${r(w.wind)} ${u === 'F' ? 'mph' : 'km/h'}`) + item('Rain', rain == null ? '–' : `${r(rain)}%`) + '</div></div>';
}
// What the card in the times-only full screen shows instead of the current prayer: after sunrise until Dhuhr (rest of today or a morning dua)
// and, with duas chosen, from Maghrib until Isha (an evening dua). null keeps the current prayer.
// shortcut: the dua changes every 3 minutes by itself and by one more on each tap on the card.
let duaTap = 0;
function dxCardFor(nowMin) {
  const w = cardWindow(nowMin, day.rows, day.sunrise);
  if (!w) return null;
  if (settings.dxCard === 'duas' && settings.adhkar) {
    const set = SETS[w], i = (Math.floor(nowMin / 3) + duaTap) % set.items.length;
    return { kind: 'dua', title: set.title, item: set.items[i], pos: `${i + 1} / ${set.items.length}` };
  }
  return w === 'morning' ? { kind: 'rest' } : null;
}
$('dx-small').addEventListener('click', (e) => { if (e.target.closest('[data-dua]')) { duaTap++; tick(); } });
function renderWeather() {
  const u = settings.units, w = weather;
  $('weather').hidden = !w;
  $('weather').textContent = w ? `${Math.round(w.temp)}°${u}${w.label ? `, ${w.label.toLowerCase()}` : ''}` : '';
  $('wx-body').innerHTML = w ? weatherHtml(w, u, prayerMarks()) : '<p class="iq-note">Weather is not available right now. The page tries again every 15 minutes.</p>';
  $('wx-updated').textContent = w && w.at != null ? `Updated ${fmt(w.at)} local time. Weather and air quality from Open-Meteo.` : '';
  document.querySelectorAll('[data-unit]').forEach(b => b.setAttribute('aria-pressed', b.dataset.unit === u));
}
$('weather').addEventListener('click', () => go('weather'));
document.querySelectorAll('[data-unit]').forEach(b => b.addEventListener('click', () => {
  if (settings.units === b.dataset.unit) return;
  settings.units = b.dataset.unit;
  save();
  loadWeather();
}));

// Duas and adhkar: the set follows the time of day; counts reset each day and stay on this device
let dk = { key: null, i: 0, until: null }, dkSig = '';
let dkStore = {};
try { dkStore = JSON.parse(localStorage.getItem('iqama-adhkar') || '{}') || {}; } catch (e) {}
function dkCounts() {
  const date = `${today.y}-${today.m}-${today.d}`;
  if (dkStore.date !== date || !dkStore.c || typeof dkStore.c !== 'object') dkStore = { date, c: {} };
  return dkStore.c;
}
const dkItem = () => SETS[dk.key].items[dk.i];
function renderAdhkar(nowMin) {
  const pick = pickSet(nowMin, day.rows, day.sunrise, today.weekday), set = SETS[pick.key];
  if (pick.key !== dk.key) dk = { key: pick.key, i: pick.key === 'general' ? Math.floor(Date.UTC(today.y, today.m - 1, today.d) / 864e5) % set.items.length : 0 };
  dk.until = pick.until;
  const it = dkItem(), c = dkCounts()[`${dk.key}.${dk.i}`] || 0, done = it.n > 0 && c >= it.n;
  const sig = [dk.key, dk.i, dk.until, c, settings.adhkar, settings.translit, settings.arSize].join('|');
  if (sig === dkSig) return;
  dkSig = sig;
  $('adhkar').hidden = !settings.adhkar;
  $('adhkar').dataset.size = settings.arSize;
  $('dk-title').textContent = set.title;
  $('dk-when').textContent = dk.until != null ? `${set.when}, until ${fmt(dk.until)}` : set.when;
  $('dk-pos').textContent = `${dk.i + 1} of ${set.items.length}`;
  $('dk-ar').textContent = it.ar;
  $('dk-ar').hidden = !it.ar;
  $('dk-tr').textContent = it.tr;
  $('dk-tr').hidden = !settings.translit || !it.tr;
  $('dk-en').textContent = it.en;
  $('dk-src').textContent = it.src;
  $('dk-count').hidden = !it.n;
  $('dk-count').classList.toggle('done', done);
  $('dk-count').style.setProperty('--value', it.n ? Math.round(100 * Math.min(c, it.n) / it.n) : 0);
  $('dk-count-big').textContent = done ? 'Done' : String(c);
  $('dk-count-small').textContent = `of ${it.n}`;
  $('dk-count').setAttribute('aria-label', done ? `Done, ${it.n} of ${it.n}` : `Count, ${c} of ${it.n}`);
  $('dk-tr-toggle').textContent = settings.translit ? 'Hide transliteration' : 'Show transliteration';
  $('dk-tr-toggle').hidden = !it.tr;
  $('dx-dhikr').hidden = !settings.adhkar;
  $('dx-ar').textContent = it.ar;
  $('dx-ar').hidden = !it.ar;
  $('dx-en').textContent = it.en;
  $('dx-pos').textContent = `${dk.i + 1} of ${set.items.length}`;
}
const stepAdhkar = (by) => { const n = SETS[dk.key].items.length; dk.i = (dk.i + by + n) % n; renderAdhkar(clock(new Date(), place().zone).sec / 60); };
$('dk-prev').addEventListener('click', () => stepAdhkar(-1));
$('dk-next').addEventListener('click', () => stepAdhkar(1));
$('dx-next').addEventListener('click', () => stepAdhkar(1));
$('dk-count').addEventListener('click', () => {
  const it = dkItem(), counts = dkCounts(), k = `${dk.key}.${dk.i}`, c = counts[k] || 0;
  if (c >= it.n) return;
  counts[k] = c + 1;
  try { localStorage.setItem('iqama-adhkar', JSON.stringify(dkStore)); } catch (e) {}
  try { navigator.vibrate?.(c + 1 === it.n ? [30, 60, 30] : 12); } catch (e) {}
  renderAdhkar(clock(new Date(), place().zone).sec / 60);
});
$('dk-tr-toggle').addEventListener('click', () => { settings.translit = !settings.translit; $('set-translit').checked = settings.translit; save(); tick(); });
$('dk-share').addEventListener('click', () => { const it = dkItem(); share(SETS[dk.key].title, [it.ar, it.tr, it.en, it.src].filter(Boolean).join('\n')); });
$('set-adhkar').checked = settings.adhkar;
$('set-translit').checked = settings.translit;
const AR_SIZES = ['s', 'm', 'l'], AR_NAMES = ['Small', 'Medium', 'Large'];
$('set-arsize').value = AR_SIZES.indexOf(settings.arSize);
$('set-arsize').setAttribute('aria-valuetext', AR_NAMES[AR_SIZES.indexOf(settings.arSize)]);
$('set-adhkar').addEventListener('change', () => { settings.adhkar = $('set-adhkar').checked; save(); tick(); });
$('set-translit').addEventListener('change', () => { settings.translit = $('set-translit').checked; save(); tick(); });
$('set-dxcard').value = settings.dxCard;
$('set-dxcard').addEventListener('change', () => { settings.dxCard = $('set-dxcard').value; save(); tick(); });
$('set-dxlayout').value = settings.dxLayout;
$('set-dxlayout').addEventListener('change', () => { settings.dxLayout = $('set-dxlayout').value; save(); applyLayout(); });
$('set-arsize').addEventListener('input', () => { const i = +$('set-arsize').value; settings.arSize = AR_SIZES[i]; $('set-arsize').setAttribute('aria-valuetext', AR_NAMES[i]); save(); tick(); });

// Keep screen on (Screen Wake Lock); also held while full screen is open. The browser drops it when the app is hidden.
let lock = null, locking = false, displayOpen = false;
const wantAwake = () => settings.awake || displayOpen;
async function updateLock() {
  if (wantAwake() && !lock && !locking && document.visibilityState === 'visible' && 'wakeLock' in navigator) {
    locking = true;
    try {
      lock = await navigator.wakeLock.request('screen');
      lock.addEventListener('release', () => { lock = null; syncAwake(); });
    } catch (e) {
      say('The screen could not be kept on, for example while battery saver is on.');
    }
    locking = false;
  } else if (!wantAwake() && lock) {
    lock.release().catch(() => {});
    lock = null;
  }
  syncAwake();
}
function syncAwake() {
  $('awake').setAttribute('aria-pressed', settings.awake);
  $('awake-label').textContent = settings.awake ? 'Screen stays on' : 'Keep screen on';
  $('awake-switch').checked = settings.awake;
  $('dx-awake').hidden = !lock;
}
function setAwake(on) {
  settings.awake = on;
  save();
  if (on && !('wakeLock' in navigator)) say('This browser cannot keep the screen on. Try a current Chrome, Edge, Safari or Firefox.');
  else say(on ? 'The screen stays on while this app is open.' : 'The screen can sleep again.');
  updateLock();
}
$('awake').addEventListener('click', () => setAwake(!settings.awake));
$('awake-switch').addEventListener('change', () => setAwake($('awake-switch').checked));
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  updateLock();
  if (Date.now() - lastSync > SYNC_EVERY) sync(); // the device was asleep or the app was in the background
});

// Full screen: the chosen clock scaled to fill the screen, with the adhkar line. iPhone has no full screen for web pages, so it opens in the page.
function fitDisplay() {
  if (timesLayout()) return;
  const el = $('dx-clock'), box = $('dx-main');
  el.style.zoom = 1;
  const r = el.getBoundingClientRect();
  if (!r.width || !r.height) return;
  let z = Math.max(0.5, Math.min(3, 0.96 * Math.min(box.clientWidth / r.width, box.clientHeight / r.height)));
  el.style.zoom = z.toFixed(3);
  // second pass: some clocks (text sized in vw) do not scale exactly with zoom
  const after = el.getBoundingClientRect(), over = Math.max(after.width / box.clientWidth, after.height / box.clientHeight);
  if (over > 1) el.style.zoom = Math.max(0.5, z / over * 0.97).toFixed(3);
}
let cursorTimer = 0;
function wakeCursor() {
  $('display').classList.remove('idle');
  clearTimeout(cursorTimer);
  cursorTimer = setTimeout(() => $('display').classList.add('idle'), 3000);
}
// Small screens (a touch device whose shorter side is under 800 CSS pixels: phones and tablets under about 10 inches) get the times-only view.
// shortcut: the screen's size is used, not the window's, so entering full screen cannot flip the layout; inches are not available to a web page.
const smallScreen = () => matchMedia('(any-pointer: coarse)').matches && Math.min(screen.width, screen.height) < 800;
const timesLayout = () => settings.dxLayout === 'times' || (settings.dxLayout === 'auto' && smallScreen());
function applyLayout() {
  const want = timesLayout() ? 'times' : 'full';
  if ($('display').dataset.layout === want) return;
  $('display').dataset.layout = want;
  if (displayOpen) { tick(); requestAnimationFrame(fitDisplay); }
}
async function openDisplay() {
  displayOpen = true;
  autoPaused = false;
  applyLayout();
  $('display').hidden = false;
  dkSig = '';
  tick();
  requestAnimationFrame(fitDisplay);
  wakeCursor();
  try { if ($('display').requestFullscreen && !document.fullscreenElement) await $('display').requestFullscreen({ navigationUI: 'hide' }); } catch (e) {}
  updateLock();
  $('dx-exit').focus();
}
function closeDisplay() {
  if (!displayOpen) return;
  displayOpen = false;
  $('display').hidden = true;
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  updateLock();
  $('fullscreen').focus();
}
$('fullscreen').addEventListener('click', openDisplay);
$('dx-exit').addEventListener('click', closeDisplay);
// Night mode is on by hand, or from sunset to sunrise when the setting is on.
// shortcut: without weather data sunset is taken as the Maghrib adhan, which is a few minutes later, fine for dimming.
let nowMinute = 0, autoPaused = false;
const isDark = () => !!day && (nowMinute < day.sunrise || nowMinute >= (weather?.today?.sunset ?? day.rows[3].adhan));
const nightOn = () => settings.dxNight || (settings.dxAuto && !autoPaused && isDark());
function applyNight() {
  const on = nightOn();
  $('display').dataset.night = on ? 'on' : 'off';
  $('dx-night').setAttribute('aria-pressed', String(on));
}
$('dx-night').addEventListener('click', () => {
  // switching off while the sunset timer is dimming pauses the timer until full screen is opened again
  if (nightOn()) { settings.dxNight = false; autoPaused = true; } else settings.dxNight = true;
  save(); applyNight();
});
$('set-dxauto').checked = settings.dxAuto;
$('set-dxauto').addEventListener('change', () => { settings.dxAuto = $('set-dxauto').checked; autoPaused = false; save(); applyNight(); });
applyNight();
document.addEventListener('fullscreenchange', () => { if (document.fullscreenElement) requestAnimationFrame(fitDisplay); else closeDisplay(); });
addEventListener('keydown', (e) => { if (e.key === 'Escape' && displayOpen) closeDisplay(); });
addEventListener('resize', () => { if (displayOpen) { applyLayout(); fitDisplay(); } });
$('display').addEventListener('pointermove', wakeCursor);

// Install and offline
let installEvent = null;
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvent = e; $('install').hidden = false; });
$('install').addEventListener('click', async () => { installEvent.prompt(); await installEvent.userChoice; $('install').hidden = true; });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

// Iqama times come from our own /api/iqama (which reads iscj.org live); the daily iqama.json is the fallback.
// Returns true when ISCJ itself answered. fresh asks the server to skip its 5 minute cache.
const SYNC_EVERY = 15 * 60e3;
let lastSync = 0;
async function loadIqama(fresh) {
  let j = null, live = false;
  try { const r = await fetch(`/api/iqama${fresh ? '?fresh=1' : ''}`); if (r.ok) { j = await r.json(); live = !j.stale; } } catch (e) { /* fall back below */ }
  if (!j || !j.iqama) {
    live = false;
    try { const r = await fetch('iqama.json', { cache: 'no-cache' }); if (r.ok) j = await r.json(); } catch (e) { j = null; }
  }
  if (!j || !j.iqama || typeof j.iqama !== 'object') { masjid.failed = !Object.keys(masjid.iqama).length; return false; }
  masjid = { iqama: j.iqama, jumuah: Array.isArray(j.jumuah) ? j.jumuah : [], updated: /^\d{4}-\d{2}-\d{2}$/.test(j.updated) ? j.updated : '', checked: Number.isFinite(j.fetched) ? j.fetched : 0, stale: !!j.stale, failed: false };
  return live;
}
// Iqama times, prayer times and weather in one go: at start, every 15 minutes, on a new day, on waking, and on Sync now.
async function sync(fresh) {
  lastSync = Date.now();
  const [live] = await Promise.all([loadIqama(fresh), loadWeather()]);
  if (today) loadDay(today);
  return live;
}

// Start with calculated times at once, then fill in ISCJ's iqama times and the weather when they arrive
save();
route();
buildForm();
buildAlerts();
syncSound();
syncMode();
tick();
updateLock();
setInterval(tick, 1000);
sync();
setInterval(sync, SYNC_EVERY);
$('sync').addEventListener('click', async () => {
  $('sync').disabled = true;
  say('Syncing iqama times, prayer times and weather…');
  const live = await sync(true);
  $('sync').disabled = false;
  say(live && weather ? 'Synced.' : `${live ? '' : 'Could not reach ISCJ, so the iqama times are the last saved ones. '}${weather ? '' : 'Weather is not available right now.'}`.trim());
});
