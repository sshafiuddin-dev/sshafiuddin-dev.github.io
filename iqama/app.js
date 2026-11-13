import PrayTimes from './lib/PrayTimes.js';
import { CalculationMethods } from './lib/CalculationMethods.js';
import { PRAYERS, NAMES, DIM_NAMES, isNight, dimLevel, hijriNow, cleanTune, parseHM, iqamaAt, fmt, nextEvent, fridayRows, km, alertsBetween, cleanStep, outlook, cardWindow, clock, esc, beepWav, alertLogText } from './logic.js';
import { setSky, redrawSky } from './sky.js';
import { CLOCKS, renderClock, renderTimes } from './clocks.js';
import { fetchWeather, weatherHtml } from './weather.js';
import { SETS, AUDIO, pickSet, fillSets } from './adhkar.js';
import { HISN, hisnUrl } from './hisn.js';
import { initQuran } from './quran.js';

const $ = (id) => document.getElementById(id);
const root = document.documentElement;
const validZone = (z) => { if (typeof z !== 'string') return false; try { new Intl.DateTimeFormat('en-US', { timeZone: z }); return true; } catch (e) { return false; } };
const DEVICE_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const ISCJ = { lat: 40.384, lng: -74.563, zone: 'America/New_York', name: 'ISCJ, Monmouth Junction NJ' };
const NEAR_KM = 40;
const ADHANS = { makkah: 'Makkah (3:44)', egypt: 'Egyptian style (3:25)', aqsa: 'Masjid Al-Aqsa (4:07)', ottoman: 'Ottoman style, Shaykh Nazim (2:38)', afasy: 'Mishary Al-Afasy (4:17)' };
const FAJR_ADHANS = { 'fajr-zahrani': 'Mansoor Az-Zahrani (3:26)', 'fajr-afasy': 'Mishary Al-Afasy (3:24)' };
// What an alert can do: show a message only, play a short sound, or play an adhan recording (the default one from the pickers above, or a named one)
const SOUNDS = { message: 'Message only', beep: 'Soft beep', bismillah: 'Bismillah, spoken', adhan: 'Adhan, your default recording' };
const RECORDINGS = { ...ADHANS, ...FAJR_ADHANS };
// The beep is made in the page. audio/bismillah.mp3 is hisnmuslim.com's recording of Hisn al-Muslim ch. 8 (before wudu), kept here so it plays offline;
// the recording says more, so only 5.5 to 6.6 s plays, where "Bismillah" is said on its own (the browser stops at the end of the range)
const SOUND_SRC = { beep: URL.createObjectURL(new Blob([beepWav()], { type: 'audio/wav' })), bismillah: 'audio/bismillah.mp3#t=5.5,6.6' };
const SOUND_KEYS = [...Object.keys(SOUNDS), ...Object.keys(RECORDINGS)];
const soundName = (t) => t === 'adhan' ? 'Adhan recording' : SOUNDS[t] ? SOUNDS[t].split(',')[0] : `${RECORDINGS[t].replace(/ \(.*/, '')} adhan`;
const ALERT_KEYS = [...PRAYERS, 'jumuah'];
const LOOKS = { paper: 'Printed timetable', hand: 'Handwritten', contrast: 'High contrast' };
const AUTO_DIM = ['isha', 'maghrib', 'off'];
const DEFAULTS = {
  method: 'ISNA', asr: 'Standard', place: null, asked: false, iqama: {}, adhan: 'makkah', fajrAdhan: 'fajr-zahrani', muted: false, alerts: null,
  tune: {}, hijriShift: 0, hijriMaghrib: false, clock: 'board', look: 'paper', autoDim: 'isha', nightLevel: 2, level: 0, units: /-US$/i.test(navigator.language || '') ? 'F' : 'C',
  adhkar: true, translit: true, arSize: 'm', awake: false, dxLayout: 'auto', dxCard: 'rest',
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
// Saves from before the timetable look: High contrast stays, the always-dark Night theme or a fixed dark mode become a fixed dim level
if (settings.palette !== undefined && settings.look === DEFAULTS.look) {
  if (settings.palette === 'contrast') settings.look = 'contrast';
  if (settings.palette === 'night') Object.assign(settings, { autoDim: 'off', level: 3 });
  else if (settings.mode === 'dark') Object.assign(settings, { autoDim: 'off', level: 2 });
}
for (const k of ['palette', 'mode', 'dxNight', 'dxAuto']) delete settings[k];
if (!LOOKS[settings.look]) settings.look = DEFAULTS.look;
settings.tune = cleanTune(settings.tune);
if (![-2, -1, 0, 1, 2].includes(settings.hijriShift)) settings.hijriShift = 0;
settings.hijriMaghrib = settings.hijriMaghrib === true;
if (!AUTO_DIM.includes(settings.autoDim)) settings.autoDim = DEFAULTS.autoDim;
if (![1, 2, 3].includes(settings.nightLevel)) settings.nightLevel = DEFAULTS.nightLevel;
if (![0, 1, 2, 3].includes(settings.level)) settings.level = DEFAULTS.level;
if (settings.units !== 'F' && settings.units !== 'C') settings.units = DEFAULTS.units;
settings.muted = settings.muted === true;
settings.adhkar = settings.adhkar !== false;
settings.translit = settings.translit !== false;
if (!['s', 'm', 'l'].includes(settings.arSize)) settings.arSize = DEFAULTS.arSize;
settings.awake = settings.awake === true;
if (!['rest', 'duas'].includes(settings.dxCard)) settings.dxCard = DEFAULTS.dxCard;
if (!['auto', 'times', 'full'].includes(settings.dxLayout)) settings.dxLayout = DEFAULTS.dxLayout;

// Alerts for each prayer and for Jumu'ah
const blankAlert = (key) => key === 'jumuah'
  ? { on: false, before: { on: true, type: 'message', min: 15 }, time: null }
  : { on: true, adhan: { on: true, type: 'message' }, before: { on: false, type: 'beep', min: 10 }, iqama: { on: false, type: 'beep', min: 5 } };
function cleanAlert(key, a) {
  const d = blankAlert(key);
  if (!a || typeof a !== 'object') return d;
  const step = (part, withMin = true) => cleanStep(a[part], d[part], SOUND_KEYS, withMin);
  if (key === 'jumuah') return { on: a.on === true, before: step('before'), time: parseHM(a.time) != null ? a.time : null };
  return { on: a.on !== false, adhan: step('adhan', false), before: step('before'), iqama: step('iqama') };
}
const savedAlerts = settings.alerts && typeof settings.alerts === 'object' ? settings.alerts : {};
settings.alerts = Object.fromEntries(ALERT_KEYS.map(k => [k, cleanAlert(k, savedAlerts[k])]));
const save = () => { try { localStorage.setItem('iqama-settings', JSON.stringify(settings)); } catch (e) {} };

// Look, brightness and clock style. Brightness follows the prayer times once they are known; until then, the last level shown.
// A level picked by hand (the brightness button or slider) holds until day turns to night or back, then Auto takes over again.
let dimOverride = null, shownDim = null, timesKnown = false;
try { const d = +localStorage.getItem('iqama-dim'); if ([0, 1, 2, 3].includes(d)) shownDim = d; } catch (e) {}
const nightNow = () => timesKnown && isNight(nowMinute, day.rows, day.sunrise, settings.autoDim);
const currentDim = () => (timesKnown || settings.autoDim === 'off' ? dimLevel(settings, nightNow(), dimOverride) : shownDim ?? 0);
function setDim(level) {
  if (settings.autoDim === 'off') { settings.level = level; save(); dimOverride = null; }
  else dimOverride = { level, night: nightNow() };
  applyLook();
}
function applyLook() {
  const dim = currentDim();
  root.dataset.palette = settings.look;
  root.dataset.dim = String(dim);
  root.dataset.theme = dim >= 2 ? 'dark' : 'light';
  root.dataset.clock = settings.clock;
  if (dim !== shownDim) { shownDim = dim; try { localStorage.setItem('iqama-dim', String(dim)); } catch (e) {} }
  syncDim();
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = getComputedStyle(root).getPropertyValue('--paper').trim() || '#0B2A33';
  redrawSky();
}
let nowMinute = 0;
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

// A short record under Settings, Adhan and alerts, so a missed alert can be explained: the last alert and what became of its message and sound,
// the times this page's clock stopped (a sleeping or frozen tab skips alerts), and when the page started. Kept on this device.
let alertLog = { last: null, gaps: [] }, tickedAt = 0;
try { const j = JSON.parse(localStorage.getItem('iqama-alertlog') || '{}'); if (j && typeof j === 'object') alertLog = { last: j.last || null, gaps: Array.isArray(j.gaps) ? j.gaps : [] }; } catch (e) {}
const stamp = (ms = Date.now()) => { const c = clock(new Date(ms), place().zone); return `${MONTHS[c.m - 1]} ${c.d}, ${fmt(c.sec / 60)}`; };
const startedAt = stamp();
const showAlertLog = () => { $('alert-log').textContent = alertLogText(alertLog, startedAt); };
function logAlert(patch) {
  alertLog = { ...alertLog, ...patch };
  try { localStorage.setItem('iqama-alertlog', JSON.stringify(alertLog)); } catch (e) {}
  showAlertLog();
}

// Back link only for visitors who came from the portfolio, never in the installed app
try {
  const ref = new URL(document.referrer);
  $('back').hidden = !(ref.origin === location.origin && !ref.pathname.startsWith('/iqama') && !matchMedia('(display-mode: standalone)').matches);
} catch (e) {}

function dayTimes(y, m, d) {
  const { lat, lng, zone } = place(), useMasjid = near();
  const pt = PrayTimes(settings.method);
  pt.setMethod(settings.method);
  pt.adjust({ asr: settings.asr === 'Hanafi' ? 'Hanafi' : 'Standard' });
  // shortcut: one UTC offset per day (taken at midday), so times before 2 AM on a clock-change day are an hour off
  const t = pt.getTimes([y, m, d], [lat, lng], clock(new Date(Date.UTC(y, m - 1, d, 17)), zone).offset, 0, 'Float');
  const min = (k) => Math.round(t[k] * 60) + (settings.tune[k] || 0); // the visitor's own adjustment, Settings, Location
  return {
    sunrise: min('sunrise'),
    rows: PRAYERS.map(key => {
      const adhan = min(key), own = settings.iqama[key] != null;
      return { key, adhan, own, iqama: iqamaAt(own ? settings.iqama[key] : useMasjid ? masjid.iqama[key] : null, adhan) };
    }),
  };
}

// Hijri date for the top bar, the clock and full screen; with the Maghrib setting on it turns over at the Maghrib adhan
function setHijri(nowMin) {
  const h = hijriNow(today.y, today.m, today.d, settings.hijriShift, settings.hijriMaghrib, nowMin, day.rows[3].adhan);
  if (h === today.hijri) return false;
  today.hijri = h;
  today.full = h ? `${today.long} · ${h}` : today.long;
  return true;
}
function showHijri() {
  $('dx-date').textContent = today.full;
  $('hijri').textContent = today.hijri;
  $('hijri').hidden = !today.hijri;
}

let today = null, day = null, tomorrow = null, lastSec = null, weather = null;

function loadDay(c) {
  today = c;
  day = dayTimes(c.y, c.m, c.d);
  timesKnown = true;
  const n = new Date(Date.UTC(c.y, c.m - 1, c.d + 1));
  tomorrow = dayTimes(n.getUTCFullYear(), n.getUTCMonth() + 1, n.getUTCDate());
  today.long = new Intl.DateTimeFormat('en-US', { timeZone: place().zone, weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());
  setHijri(c.sec / 60);
  renderDay();
  renderWeather();
}

const jumuahMins = () => (near() ? masjid.jumuah.map(parseHM).filter(v => v != null) : []);
// Khutbah times to show: the visitor's own khutbah time (set under Jumu'ah alerts), else ISCJ's nearby, else none
const shownJumuah = () => { const own = parseHM(settings.alerts.jumuah.time); return own != null ? [own] : jumuahMins(); };
const jumuah = () => shownJumuah().map(fmt).join(', ');
// Rows the clocks show: on a Friday with khutbah times, Dhuhr is shown as Jumu'ah
const shownRows = () => fridayRows(day.rows, today.weekday, shownJumuah());

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
  showHijri();
  $('dx-place').textContent = place().name;
  if (tab === 'month') { renderMonth(); $('tab-title').textContent = monthTitle(); }
  tick();
}

// Friday khutbah for the Jumu'ah alert: the visitor's own time, else ISCJ's first khutbah nearby
const khutbah = () => parseHM(settings.alerts.jumuah.time) ?? jumuahMins()[0] ?? null;
const alertRows = () => (today.weekday === 'Fri' && khutbah() != null ? [...day.rows, { key: 'jumuah', adhan: khutbah(), iqama: null }] : day.rows);

function tick() {
  const c = clock(new Date(), place().zone), nowMs = Date.now();
  // over 100 s since the last tick (alerts skip anything over 90 s late): the page was asleep, frozen or discarded
  if (tickedAt && nowMs - tickedAt > 100e3) logAlert({ gaps: [{ from: stamp(tickedAt), to: stamp(nowMs) }, ...alertLog.gaps].slice(0, 3) });
  tickedAt = nowMs;
  if (!today || c.d !== today.d) { const later = !!today; loadDay(c); if (later) sync(); return; }
  const nowMin = c.sec / 60, rows = shownRows(), ev = nextEvent(rows, tomorrow.rows[0].adhan, nowMin, day.sunrise);
  $('now').textContent = fmt(Math.floor(nowMin));
  const html = renderClock(settings.clock, { sec: c.sec, now: nowMin, rows, sunrise: day.sunrise, next: ev, jumuah: shownJumuah(), date: today.full });
  $('clock').innerHTML = html;
  nowMinute = nowMin;
  if (setHijri(nowMin)) showHijri();
  if (currentDim() !== shownDim) applyLook();
  if (displayOpen) {
    if (timesLayout()) $('dx-small').innerHTML = renderTimes({ sec: c.sec, now: nowMin, rows, sunrise: day.sunrise, next: ev, tomorrowFajr: tomorrow.rows[0], wx: wxStats(), card: dxCardFor(nowMin) });
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
const TAB_IDS = ['today', 'weather', 'adhkar', 'quran', 'month', 'settings'];
const TITLES = { today: 'Today', weather: 'Weather', adhkar: 'Adhkar audio', quran: 'Quran', settings: 'Settings' };
let tab = 'today', sub = 'location';
function go(t, s) {
  if (s) sub = s;
  if (location.hash.slice(1) === t) route(); else location.hash = t;
}
function route() {
  let h = location.hash.slice(1);
  if (h === 'alerts') { h = 'settings'; sub = 'alerts'; } // the old address for the alerts screen
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

// Sound: one shared player for the adhan, alert sounds and previews.
// Browsers only allow sound after the page has been touched in this visit. The first touch unlocks it; until then an
// alert that could not sound shows a "Tap to enable sound" button on the display, and plays when it is tapped.
const audio = new Audio();
audio.preload = 'auto';
let soundLocked = false, pending = null, alertNow = null; // alertNow names the alert that is sounding, for the Stop button
const playing = () => !!audio.src && !audio.paused && !audio.ended;
function syncSound() {
  $('alerts-label').textContent = playing() ? 'Stop sound' : `Alerts: ${settings.muted ? 'off' : 'on'}`;
  $('alerts-toggle').checked = !settings.muted;
  $('dx-sound').hidden = !soundLocked;
  $('sound-lock').hidden = !soundLocked;
  if (!playing() && !pending) alertNow = null;
  const stop = !!alertNow && playing();
  for (const id of ['alert-stop', 'dx-stop']) { $(id).hidden = !stop; if (stop) $(id).textContent = `Stop ${alertNow}`; }
  document.querySelectorAll('.au-play').forEach(b => { b.textContent = playing() && audio.src === b.dataset.src ? 'Stop' : (b.dataset.label || 'Play'); });
}
// The Quran player has its own audio element. It steps aside for any sound played here and comes back when that sound is over.
const quran = initQuran({ say, stopOthers: () => { pending = null; if (playing() && !audio.muted) audio.pause(); } }); // a muted sound is the silent unlock, which must finish
const soundOver = () => { syncSound(); if (!playing()) quran.resume(); };
audio.addEventListener('ended', soundOver);
audio.addEventListener('pause', soundOver);
// shortcut: on touch screens only the end of a tap counts as a user gesture (pointerdown does not), so listen for all of these
const GESTURES = ['pointerup', 'touchend', 'mousedown', 'keydown'];
function markUnlocked() {
  soundLocked = false;
  GESTURES.forEach(g => removeEventListener(g, unlockSound, true));
  syncSound();
}
function unlockSound(e) {
  const late = pending && Date.now() - pending.at < 120000 ? pending : null; // a stale alert is not played late
  const file = late && late.file;
  pending = null;
  const tapped = (sel) => !!(e && e.target.closest && e.target.closest(sel));
  // a tap on a button that starts its own sound unlocks through that sound, so a missed alert does not replay over it
  if (tapped('#dk-listen, .au-play, [data-try]')) return;
  // a Quran button plays on the Quran's own element: the missed alert is dropped, but this element still needs the silent unlock
  if (file && !tapped('[data-q="toggle"], [data-q="prev"], [data-q="next"], [data-q="jump"], [data-act="play"], [data-act="play-all"]')) return play(file, late.label);
  if (playing()) return;
  audio.muted = true; // a silent start that lets later alerts play on their own
  audio.src = SOUND_SRC.beep;
  audio.play().then(() => { if (audio.muted) { audio.pause(); audio.muted = false; } markUnlocked(); }, () => {});
}
GESTURES.forEach(g => addEventListener(g, unlockSound, true));
function play(file, label) {
  audio.pause();
  quran.interrupt();
  if (label) quran.closeDialogs();
  alertNow = label || null;
  audio.muted = false;
  audio.src = SOUND_SRC[file] || (/^https:/.test(file) ? file : `audio/${file}.mp3`);
  audio.addEventListener('playing', syncSound, { once: true });
  const outcome = (r) => { if (label) logAlert({ last: { ...alertLog.last, result: `message shown, ${r}` } }); };
  audio.play().then(() => { markUnlocked(); outcome('sound played'); }, (err) => {
    if (err && err.name === 'AbortError') return; // another sound took over
    if (err && err.name === 'NotAllowedError') {
      soundLocked = true;
      pending = { file, label, at: Date.now() };
      say('Sound is blocked until you tap the page. Tap anywhere to turn it on.');
      outcome('sound blocked until the page is tapped');
      soundOver();
    } else {
      console.warn('Iqama Times: the sound could not play', err);
      say('The sound could not play.');
      outcome('sound could not play');
      soundOver();
    }
  });
}
// Adhkar audio: Hisn al-Muslim records one chapter per set, so this plays the whole chapter, not just the line shown
$('dk-listen').addEventListener('click', () => {
  if (playing()) return audio.pause();
  if (AUDIO[dk.key]) play(AUDIO[dk.key]);
});

// Adhkar tab: every Hisn al-Muslim chapter with its recording, filtered by what is typed in the search box
$('adhkar-audio').innerHTML = HISN.map(([id, title, num]) => `<li data-id="${id}" data-t="${title.toLowerCase()} ${id}"><div class="au-row"><button class="au-toggle" type="button" aria-expanded="false" aria-controls="au-body-${id}"><span class="au-no">${id}</span><span class="au-title">${title}</span></button><button class="d-btn d-btn-sm d-btn-soft d-btn-primary au-play" type="button" data-src="${hisnUrl(num)}" data-label="Chapter" aria-label="Play the whole chapter: ${title}">Chapter</button></div><div class="au-body" id="au-body-${id}" hidden></div></li>`).join('');
function filterAdhkar() {
  const q = $('au-search').value.trim().toLowerCase();
  let shown = 0;
  for (const li of $('adhkar-audio').children) { const on = !q || li.dataset.t.includes(q); li.hidden = !on; if (on) shown++; }
  $('au-count').textContent = shown ? (q ? `${shown} of ${HISN.length} chapters` : `${HISN.length} chapters`) : 'No chapters match.';
}
$('au-search').addEventListener('input', filterAdhkar);
filterAdhkar();
// The text is copied from hisnmuslim.com into hisn-text.json by scripts/fetch-hisn.mjs, so it loads from this site
let hisnText = null;
async function loadHisnText() {
  if (hisnText) return hisnText;
  const r = await fetch('hisn-text.json');
  if (!r.ok) throw new Error(`hisn-text.json answered ${r.status}`);
  hisnText = (await r.json()).chapters || {};
  return hisnText;
}
const hisnItems = (items) => items.map((it, i) => `<article class="au-dua"><div class="au-meta"><span>Dua ${i + 1} of ${items.length}</span>${it.n ? `<span>Read ${it.n} ${it.n === 1 ? 'time' : 'times'}</span>` : ''}</div>`
  + `${it.ar ? `<p class="au-ar" lang="ar" dir="rtl">${esc(it.ar)}</p>` : ''}${it.tr ? `<p class="au-tr">${esc(it.tr)}</p>` : ''}${it.en ? `<p class="au-en">${esc(it.en)}</p>` : ''}`
  + `${it.audio ? `<button class="d-btn d-btn-sm d-btn-soft d-btn-primary au-play" type="button" data-src="${esc(it.audio)}" aria-label="Play dua ${i + 1}">Play</button>` : ''}</article>`).join('');
function openChapter(li, btn) {
  const body = li.querySelector('.au-body'), open = btn.getAttribute('aria-expanded') !== 'true';
  btn.setAttribute('aria-expanded', String(open));
  body.hidden = !open;
  if (!open || body.dataset.done) return;
  body.innerHTML = '<p class="iq-note">Loading…</p>';
  loadHisnText().then(all => {
    const items = all[li.dataset.id]?.items || [];
    body.innerHTML = items.length ? hisnItems(items) : '<p class="iq-note">There is no text for this chapter.</p>';
    body.dataset.done = '1';
  }).catch((e) => {
    console.warn('Iqama Times: adhkar text failed', e);
    body.innerHTML = '<p class="iq-note">The text is not available yet. The recording still plays.</p>';
  });
}
$('adhkar-audio').addEventListener('click', (e) => {
  const t = e.target.closest('.au-toggle');
  if (t) return openChapter(t.closest('li'), t);
  const b = e.target.closest('.au-play');
  if (!b) return;
  if (playing() && audio.src === b.dataset.src) return audio.pause();
  play(b.dataset.src);
});

for (const id of ['alert-stop', 'dx-stop']) $(id).addEventListener('click', () => { audio.pause(); say('Alert stopped. Your alert settings are unchanged.'); });
$('alerts-toggle').addEventListener('click', (e) => {
  if (playing()) { e.preventDefault(); return audio.pause(); }
  settings.muted = !settings.muted;
  save();
  syncSound();
  say(settings.muted ? 'All alerts are off. Your settings for each prayer are kept.' : 'Alerts are on. Set them for each prayer under Settings, Adhan and alerts.');
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
const soundOptions = (sel) => {
  const opts = (map) => Object.keys(map).map(t => `<option value="${t}"${t === sel ? ' selected' : ''}>${map === SOUNDS ? SOUNDS[t] : RECORDINGS[t]}</option>`).join('');
  return `${opts(SOUNDS)}<optgroup label="A named adhan recording">${opts(RECORDINGS)}</optgroup>`;
};
function alertCard(k) {
  const a = settings.alerts[k], id = (part) => `al-${k}-${part}`, name = k === 'jumuah' ? 'Jumu’ah' : NAMES[k];
  // each step has its own switch and its own sound; the two "before" steps also have minutes
  const step = (part, label) => `<div class="al-row" data-part="${part}"><input class="d-toggle d-toggle-success d-toggle-xs" type="checkbox" role="switch" id="${id(`${part}-on`)}" data-k="${k}" aria-label="${name}, ${label.toLowerCase()} alert"${a[part].on ? ' checked' : ''}>`
    + `<label for="${id(`${part}-type`)}">${label}</label><select class="d-select d-select-sm" id="${id(`${part}-type`)}" data-k="${k}" aria-label="${name}, ${label.toLowerCase()}, sound">${soundOptions(a[part].type)}</select>`
    + (part === 'adhan' ? '' : `<span class="al-min"><input class="d-input d-input-sm" type="number" id="${id(`${part}-min`)}" data-k="${k}" min="1" max="60" step="1" inputmode="numeric" value="${a[part].min}" aria-label="${name}, ${label.toLowerCase()}, minutes"><span>min</span></span>`)
    + '</div>';
  const body = k === 'jumuah'
    ? `${step('before', 'Before khutbah')}<div class="al-row"><label for="${id('time')}">Khutbah time</label><input class="d-input d-input-sm" type="time" id="${id('time')}" data-k="${k}" value="${a.time ? a.time.padStart(5, '0') : ''}"></div><p class="al-note" id="al-jumuah-note"></p>`
    : `${step('adhan', 'At adhan')}${step('before', 'Before adhan')}${step('iqama', 'Before iqama')}<button class="d-btn d-btn-sm d-btn-ghost al-copy" type="button" data-copy="${k}">Use for all prayers</button>`;
  return `<div class="al-card d-collapse d-collapse-arrow" id="${id('card')}"><input type="checkbox" class="al-open" aria-label="Show ${name} settings">`
    + `<div class="d-collapse-title al-title"><input class="d-toggle d-toggle-success d-toggle-sm" type="checkbox" role="switch" id="${id('on')}" data-k="${k}" aria-label="${name} alerts"${a.on ? ' checked' : ''}><span class="al-name">${name}</span><span class="al-sum" id="${id('sum')}">${alertSummary(k, a)}</span></div>`
    + `<div class="d-collapse-content al-body">${body}</div></div>`;
}
// A short line that sums up a card, so it is readable while folded
function alertSummary(k, a) {
  if (!a.on) return 'Off';
  const parts = k !== 'jumuah' && a.adhan.on ? [soundName(a.adhan.type)] : [];
  if (a.before.on) parts.push(`${a.before.min} min before ${k === 'jumuah' ? 'khutbah' : 'adhan'}`);
  if (k !== 'jumuah' && a.iqama.on) parts.push(`${a.iqama.min} min before iqama`);
  return parts.join(', ') || 'No alerts';
}
function syncCard(k) {
  const a = settings.alerts[k], card = $(`al-${k}-card`);
  card.classList.toggle('is-off', !a.on);
  card.querySelectorAll('.al-body select, .al-body input, .al-body button').forEach(el => {
    const part = el.closest('[data-part]')?.dataset.part; // a step that is switched off keeps its switch live and greys the rest of its row
    el.disabled = !a.on || (!!part && !a[part].on && el.type !== 'checkbox');
  });
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
  const step = (part) => ({ on: v(`${part}-on`).checked, type: v(`${part}-type`).value, ...(part === 'adhan' ? {} : { min: mins(`${part}-min`, a[part].min) }) });
  a.before = step('before');
  if (k === 'jumuah') a.time = parseHM(v('time').value) != null ? v('time').value : null;
  else { a.adhan = step('adhan'); a.iqama = step('iqama'); }
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
  const name = key === 'jumuah' ? 'Jumu’ah' : NAMES[key], label = kind === 'adhan' ? `${name} adhan` : `${name} alert`;
  const note = (result) => logAlert({ last: { what: label, when: stamp(), result } });
  if (settings.muted) return note('skipped, alerts are off');
  const text = MESSAGES[kind](name, min, key);
  say(text);
  if (document.hidden) notify(text);
  note('message shown'); // play() adds what became of the sound
  // a recording takes over whatever is playing; a short sound waits its turn rather than cut an adhan off
  if (type === 'adhan') play(key === 'fajr' ? settings.fajrAdhan : settings.adhan, label);
  else if (RECORDINGS[type]) play(type, label);
  else if (type === 'beep' || type === 'bismillah') { if (!playing()) play(type, label); else note('message shown, sound skipped because another sound was playing'); }
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
$('iqama-form').addEventListener('submit', (e) => e.preventDefault()); // Enter in a field must not reload the page
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
// Adhan time offsets and the Hijri day shift
$('tune-form').innerHTML = PRAYERS.map(k => `<label class="tune-row"><span>${NAMES[k]}</span><input class="d-input d-input-sm" type="number" inputmode="numeric" min="-30" max="30" step="1" data-k="${k}" value="${settings.tune[k]}" aria-label="${NAMES[k]} adhan, minutes earlier or later"><small>min</small></label>`).join('');
$('tune-form').addEventListener('submit', (e) => e.preventDefault());
$('tune-form').addEventListener('change', (e) => {
  const k = e.target.dataset.k, v = Math.round(+e.target.value);
  if (!k) return;
  settings.tune = cleanTune({ ...settings.tune, [k]: Number.isFinite(v) ? Math.max(-30, Math.min(30, v)) : 0 });
  e.target.value = settings.tune[k];
  recalc();
});
$('tune-reset').addEventListener('click', () => { settings.tune = cleanTune({}); $('tune-form').querySelectorAll('input').forEach(i => { i.value = 0; }); recalc(); });
$('hijri-shift').value = String(settings.hijriShift);
$('hijri-shift').addEventListener('change', () => { settings.hijriShift = +$('hijri-shift').value; recalc(); });
$('set-hijri-maghrib').checked = settings.hijriMaghrib;
$('set-hijri-maghrib').addEventListener('change', () => { settings.hijriMaghrib = $('set-hijri-maghrib').checked; recalc(); });

// Clock style and theme
// decorative swatches: the theme's dark paper beside its accent
const SWATCH = { paper: ['#F3EDE1', '#A8321F'], hand: ['#F6F1E4', '#24345C'], contrast: ['#FFFFFF', '#000000'] };
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
fillPicker('palette', LOOKS, settings.look, (k, name) => `class="swatch" style="--a:${SWATCH[k][0]};--b:${SWATCH[k][1]}" aria-label="${name}" title="${name}">`, (v) => { settings.look = v; save(); applyLook(); $('look-name').textContent = LOOKS[v]; });
$('look-name').textContent = LOOKS[settings.look];
// Brightness: the button in the top bar and in full screen steps through the four levels; Settings has the sliders and Auto
function syncDim() {
  const dim = Number(root.dataset.dim) || 0, name = DIM_NAMES[dim];
  for (const id of ['dim-btn', 'dx-dim']) {
    const b = $(id);
    if (!b) continue;
    b.querySelector('span').textContent = name;
    b.dataset.level = String(dim);
    b.setAttribute('aria-label', `Brightness: ${name}. Tap for ${DIM_NAMES[(dim + 1) % 4].toLowerCase()}`);
  }
  if (!$('set-dim')) return;
  $('set-dim').value = String(dim); $('set-dim-out').textContent = name;
  $('set-night').value = String(settings.nightLevel); $('set-night-out').textContent = DIM_NAMES[settings.nightLevel];
  document.querySelectorAll('input[name="autodim"]').forEach(r => { r.checked = r.value === settings.autoDim; });
  $('night-row').hidden = settings.autoDim === 'off';
  $('dim-note').textContent = settings.autoDim === 'off' ? 'Brightness stays where you set it.'
    : `Bright from sunrise; ${DIM_NAMES[settings.nightLevel].toLowerCase()} after ${settings.autoDim === 'isha' ? 'Isha' : 'Maghrib'}.${dimOverride ? ' Your change holds until the next switch.' : ''}`;
}
for (const id of ['dim-btn', 'dx-dim']) $(id)?.addEventListener('click', () => setDim(((Number(root.dataset.dim) || 0) + 1) % 4));
$('set-dim').addEventListener('input', () => setDim(+$('set-dim').value));
$('set-night').addEventListener('input', () => { settings.nightLevel = +$('set-night').value; save(); if (dimOverride?.night) dimOverride = null; applyLook(); });
document.querySelectorAll('input[name="autodim"]').forEach(r => r.addEventListener('change', () => {
  settings.autoDim = r.value;
  if (r.value === 'off') settings.level = Number(root.dataset.dim) || 0; // turning Auto off keeps what is showing now
  dimOverride = null; save(); applyLook();
}));
syncDim();

// Weather, for the header, the backdrop and the Weather panel; the page works the same without it
let wxReq = 0;
async function loadWeather() {
  const { lat, lng } = place(), n = ++wxReq;
  let w = null;
  try { w = await fetchWeather(lat, lng, settings.units); } catch (e) {}
  if (n !== wxReq) return; // a newer request (new place or units) has started; this answer is stale
  weather = w;
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
  if (settings.dxCard === 'duas' && settings.adhkar && SETS[w].items[0].ar) { // the text has loaded
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
  const show = settings.adhkar && !!(it.ar || it.en); // hidden until the Hisn al-Muslim text has loaded
  const sig = [dk.key, dk.i, dk.until, c, show, settings.translit, settings.arSize].join('|');
  if (sig === dkSig) return;
  dkSig = sig;
  $('adhkar').hidden = !show;
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
  $('dk-listen').hidden = !AUDIO[dk.key];
  $('dx-dhikr').hidden = !show;
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
  // the Today tab's duas are entries of Hisn al-Muslim, read from the Adhkar tab's file; asked again until it has loaded once
  if (!SETS.adhan.items[0].ar) loadHisnText().then(fillSets).then(() => { dkSig = ''; tick(); }).catch((e) => console.warn('Iqama Times: adhkar text failed', e));
  const [live] = await Promise.all([loadIqama(fresh), loadWeather()]);
  if (today) loadDay(today);
  return live;
}

// Start with calculated times at once, then fill in ISCJ's iqama times and the weather when they arrive
save();
route();
buildForm();
buildAlerts();
showAlertLog();
syncSound();
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
