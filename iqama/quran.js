// Quran tab and player. Reciters, surahs and riwayat come from mp3quran.net when they are first needed; the audio streams
// from the reciter's server. Favorites, playlists and the place you stopped stay on this device (localStorage 'iqama-quran').
// The recitation has its own audio element, so an adhan or alert can pause it and hand it back afterwards.
import {
  trackId, trackInfo, buildCatalog, moshafOf, recitersFor, search, fmtTime, makeQueue, current, reshuffle, stepPos, afterEnd,
  cleanStore, legacyTrack, nextRepeat, nextRate, toggle, cleanName, addList, renameList, removeList, addToList, removeFromList, moveInList, setListOrder,
} from './quran-logic.js';
import * as mo from './motion.js';
import { esc } from './logic.js';

const API = 'https://mp3quran.net/api/v3';
const $ = (id) => document.getElementById(id);
const svg = (d, extra = '') => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/>${extra}</svg>`;
const num = (n) => `<text x="12" y="15.2" text-anchor="middle">${n}</text>`;
const IC = {
  play: '<svg viewBox="0 0 24 24" aria-hidden="true" class="qp-solid"><path d="M7.5 4.5v15l12-7.5z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true" class="qp-solid"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/></svg>',
  prev: svg('M6 5v14M19 5.5v13L9 12z'), next: svg('M18 5v14M5 5.5v13L15 12z'),
  back: svg('M4.5 12a7.5 7.5 0 1 0 2.3-5.4M4.5 4v4h4', num(10)), fwd: svg('M19.5 12a7.5 7.5 0 1 1-2.3-5.4M19.5 4v4h-4', num(10)),
  repeat: svg('M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3'),
  repeat1: svg('M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3', '<text x="12" y="14.6" text-anchor="middle">1</text>'),
  shuffle: svg('M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5'),
  heart: svg('M12 20.5S4 15.5 4 9.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 2.5c0 6-8 11-8 11z'),
  add: svg('M4 6h11M4 11h11M4 16h7M18 13v7M14.5 16.5h7'),
  up: svg('M6 15l6-6 6 6'), down: svg('M6 9l6 6 6-6'), left: svg('M15 5l-7 7 7 7'), close: svg('M6 6l12 12M18 6L6 18'),
  grip: '<svg viewBox="0 0 24 24" aria-hidden="true" class="qp-dots"><path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01"/></svg>',
  vol: svg('M4 9v6h4l5 4V5L8 9zM16.5 8.5a5 5 0 0 1 0 7'),
};
const REPEAT_TEXT = { off: 'Repeat is off', all: 'Repeating the whole list', one: 'Repeating this surah' };
const btn = (q, icon, label, cls = '') => `<button class="qp-ic ${cls}" type="button" data-q="${q}" aria-label="${label}" title="${label}">${IC[icon]}</button>`;
const eq = '<span class="qp-eq" aria-hidden="true"><i></i><i></i><i></i></span>';
const timeline = () => `<div class="qp-time"><span class="qp-cur">0:00</span><div class="qp-track"><div class="qp-buf"></div><div class="qp-fill"></div>`
  + `<input class="qp-seek" type="range" min="0" max="1000" step="1" value="0" aria-label="Position in the surah" disabled></div><span class="qp-dur">0:00</span></div>`;
const transport = () => `${btn('shuffle', 'shuffle', 'Shuffle', 'qp-extra')}${btn('prev', 'prev', 'Previous surah')}${btn('back', 'back', 'Back 10 seconds', 'qp-extra')}`
  + `${btn('toggle', 'play', 'Play', 'qp-play')}${btn('fwd', 'fwd', 'Forward 10 seconds', 'qp-extra')}${btn('next', 'next', 'Next surah')}${btn('repeat', 'repeat', 'Repeat', 'qp-extra')}`;

export function initQuran({ say, stopOthers }) {
  let store = cleanStore(null);
  try { store = cleanStore(JSON.parse(localStorage.getItem('iqama-quran') || '{}')); } catch (e) {}
  const save = () => { try { localStorage.setItem('iqama-quran', JSON.stringify(store)); } catch (e) {} };

  let cat = null, catP = null, failed = false;
  let view = 'reciters', query = '', detail = null; // detail: { type: 'reciter', id, m } | { type: 'surah', n } | { type: 'list', id }
  let q = null, cur = store.last ? { id: store.last.id, label: store.last.title, sub: store.last.sub, url: store.last.url } : null;
  let startAt = 0, scrubbing = false, interrupted = false, lastSaved = 0, wasPlaying = false;
  const audio = new Audio();
  audio.preload = 'metadata';
  audio.volume = store.vol;
  const isPlaying = () => !!audio.src && !audio.paused && !audio.ended;

  // ---- Markup that lives outside the tab: the docked player, the now-playing screen and one dialog ----
  const tabEl = $('tab-quran'), listEl = $('qp-list'), detailEl = $('qp-detail');
  document.querySelector('.view').insertAdjacentHTML('beforeend',
    `<section class="qp-player" id="qp-player" aria-label="Quran player" hidden>${timeline()}<div class="qp-ctl">`
    + `<button class="qp-meta" type="button" data-q="open" aria-label="Open now playing">${eq}<span class="qp-txt"><b class="qp-label"></b><small class="qp-sub"></small></span></button>`
    + `<div class="qp-btns">${transport()}</div>`
    + `<div class="qp-side">${btn('fav', 'heart', 'Add this surah to favorites', 'qp-extra qp-heart')}${btn('add', 'add', 'Add this surah to a playlist', 'qp-extra')}${btn('open', 'up', 'Open now playing and the queue')}${btn('dismiss', 'close', 'Stop and close the player', 'qp-extra')}</div>`
    + '</div></section>');
  document.body.insertAdjacentHTML('beforeend',
    `<div class="qp-now" id="qp-now" role="dialog" aria-modal="true" aria-label="Now playing" hidden><div class="qp-now-in">`
    + `<div class="qp-now-top">${btn('close', 'down', 'Close now playing')}<span>Now playing</span></div>`
    + `<div class="qp-now-title">${eq}<h2 class="qp-label"></h2><p class="qp-sub"></p></div>${timeline()}`
    + `<div class="qp-btns qp-btns-lg">${transport()}</div>`
    + `<div class="qp-more">${btn('fav', 'heart', 'Add this surah to favorites', 'qp-heart')}${btn('add', 'add', 'Add this surah to a playlist')}`
    + `<button class="d-btn d-btn-sm d-btn-outline qp-rate" type="button" data-q="rate" aria-label="Playback speed">1×</button>`
    + `<label class="qp-vol">${IC.vol}<input type="range" min="0" max="100" step="1" id="qp-vol" aria-label="Volume"></label></div>`
    + `<h3 class="qp-h">Up next</h3><ol class="qp-rows qp-queue" id="qp-queue"></ol></div></div>`
    + '<dialog class="qp-dlg" id="qp-dlg" aria-labelledby="qp-dlg-h"><div class="qp-dlg-in" id="qp-dlg-in"></div></dialog>');
  const player = $('qp-player'), now = $('qp-now'), dlg = $('qp-dlg'), dlgIn = $('qp-dlg-in'), app = document.querySelector('.app');
  $('qp-vol').value = Math.round(store.vol * 100);

  // ---- Catalogue ----
  const get = (path) => fetch(`${API}/${path}`).then(r => { if (!r.ok) throw new Error(`mp3quran answered ${r.status}`); return r.json(); });
  function ensureCat() {
    if (cat) return Promise.resolve(cat);
    return catP ||= Promise.all([get('suwar?language=eng'), get('reciters?language=eng'), get('riwayat?language=eng')]).then(([s, r, w]) => {
      const c = buildCatalog(s, r, w);
      if (!c.reciters.length) throw new Error('no reciters');
      cat = c; failed = false;
      if (store.riwaya !== 'all' && !cat.riwayat.some(x => x.id === store.riwaya)) store.riwaya = 'all';
      $('qp-riwaya').innerHTML = `<option value="all">All riwayat (${cat.moshaf.size} recitations)</option>` + cat.riwayat.map(x => `<option value="${x.id}">${esc(x.name)} (${x.count})</option>`).join('');
      $('qp-riwaya').value = store.riwaya;
      $('qp-riwaya').disabled = false;
      // the old player remembered a reciter and a surah: carry them over once, as the place to start from
      const old = legacyTrack(cat, store.legacy);
      delete store.legacy;
      if (old && !cur) setCurrent(trackInfo(cat, old), 0);
      restoreQueue();
      save();
      return cat;
    }).catch((e) => { catP = null; failed = true; console.warn('Iqama Times: Quran list failed', e); throw e; });
  }
  const info = (id) => trackInfo(cat, id);
  const label = (i) => `${i.n}. ${i.title}`, sub = (i) => `${i.reciter} · ${i.style}`;
  function setCurrent(i, at) {
    cur = { id: i.id, label: label(i), sub: sub(i), url: i.url };
    store.last = { id: i.id, t: at, title: cur.label, sub: cur.sub, url: i.url, queue: (q ? q.ids : [i.id]).slice(0, 400) };
  }
  // After a reload only the saved track ids are known; this rebuilds the queue once the catalogue is in
  function restoreQueue() {
    if (q || !cur || !cat) return;
    let ids = (store.last?.queue || []).filter(id => info(id));
    if (ids.length < 2 || !ids.includes(cur.id)) { const m = cat.moshaf.get(+cur.id.split(':')[0]); ids = m ? m.surahs.map(s => trackId(m.id, s)) : [cur.id]; }
    if (!ids.includes(cur.id)) ids = [cur.id];
    q = makeQueue(ids, ids.indexOf(cur.id), store.shuffle);
  }

  // ---- Playback ----
  function start() {
    stopOthers();
    interrupted = false;
    audio.play().catch((err) => {
      if (err && err.name === 'AbortError') return;
      say(err && err.name === 'NotAllowedError' ? 'Tap play to start the recitation.' : 'This recitation could not play. Check the connection.');
      paint();
    });
  }
  function load(id, at, autoplay) {
    const i = info(id);
    if (!i) return say('That recitation is no longer on mp3quran.net.');
    setCurrent(i, at);
    save();
    startAt = at;
    audio.src = i.url;
    audio.playbackRate = store.rate;
    showPlayer();
    paint(); paintTime(); mediaMeta();
    if (!now.hidden) renderQueue();
    if (autoplay) start();
  }
  function playQueue(ids, index) {
    q = makeQueue(ids, index, store.shuffle);
    load(current(q), 0, true);
  }
  function togglePlay() {
    if (!cur) return;
    if (isPlaying()) return audio.pause();
    if (!audio.src) { // first play after a reload: start from the saved place at once, and fetch the lists behind it
      const at = store.last?.t || 0;
      if (!cur.url) return void ensureCat().then(() => { restoreQueue(); load(cur.id, at, true); }).catch(() => say('Could not load the reciters. Check the connection.'));
      startAt = at;
      audio.src = cur.url;
      audio.playbackRate = store.rate;
      ensureCat().then(() => { restoreQueue(); if (!now.hidden) renderQueue(); }).catch(() => {});
      mediaMeta();
    }
    start();
  }
  function step(dir) {
    ensureCat().then(() => {
      restoreQueue();
      if (!q) return;
      if (dir < 0 && audio.currentTime > 3) { audio.currentTime = 0; return; }
      const p = stepPos(q, dir, store.repeat);
      if (p < 0) return say(dir > 0 ? 'That was the last surah in this list.' : 'This is the first surah in this list.');
      q.pos = p;
      load(current(q), 0, true);
    }).catch(() => say('Could not load the list. Check the connection.'));
  }
  const seekBy = (s) => { if (Number.isFinite(audio.duration)) audio.currentTime = Math.min(Math.max(0, audio.currentTime + s), audio.duration - .25); };
  function dismiss() {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    cur = null; q = null; store.last = null; interrupted = false;
    save();
    player.hidden = true;
    paint();
  }
  audio.addEventListener('loadedmetadata', () => {
    if (startAt > 0 && startAt < audio.duration - 5) audio.currentTime = startAt;
    startAt = 0;
    paintTime();
  });
  audio.addEventListener('ended', () => {
    const r = q ? afterEnd(q, store.repeat) : -1;
    if (r === 'again') { audio.currentTime = 0; return start(); }
    if (r >= 0) { q.pos = r; return load(current(q), 0, true); }
    if (store.last) { store.last.t = 0; save(); }
    paint();
  });
  audio.addEventListener('error', () => { if (audio.getAttribute('src')) say('This recitation could not load. Check the connection, or try another reciter.'); paint(); });
  for (const ev of ['play', 'playing', 'pause', 'waiting', 'canplay']) audio.addEventListener(ev, paint);
  for (const ev of ['timeupdate', 'durationchange', 'progress', 'seeked']) audio.addEventListener(ev, paintTime);
  audio.addEventListener('timeupdate', () => {
    if (store.last && Math.abs(audio.currentTime - lastSaved) >= 5) { lastSaved = store.last.t = audio.currentTime; save(); }
  });
  const keepPlace = () => { if (store.last && audio.getAttribute('src') && !audio.ended && audio.currentTime > 0) { store.last.t = audio.currentTime; save(); } };
  audio.addEventListener('pause', keepPlace);
  addEventListener('pagehide', keepPlace);

  // Lock screen and headset buttons
  function mediaMeta() {
    if (!('mediaSession' in navigator) || !cur) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({ title: cur.label, artist: cur.sub, album: 'Quran', artwork: [{ src: 'icon-512.png', sizes: '512x512', type: 'image/png' }] });
    } catch (e) {}
  }
  if ('mediaSession' in navigator) {
    const on = (name, fn) => { try { navigator.mediaSession.setActionHandler(name, fn); } catch (e) {} };
    on('play', togglePlay); on('pause', () => audio.pause());
    on('previoustrack', () => step(-1)); on('nexttrack', () => step(1));
    on('seekbackward', (d) => seekBy(-(d.seekOffset || 10))); on('seekforward', (d) => seekBy(d.seekOffset || 10));
    on('seekto', (d) => { if (Number.isFinite(d.seekTime)) audio.currentTime = d.seekTime; });
  }

  // ---- Painting the player (the docked bar and the now-playing screen share every control) ----
  const all = (sel) => document.querySelectorAll(`#qp-player ${sel}, #qp-now ${sel}`);
  function showPlayer() {
    if (!player.hidden) return;
    player.hidden = false;
    mo.rise(player, mo.T.dist.lg);
  }
  function paint() {
    const playing = isPlaying(), busy = playing && audio.readyState < 3;
    for (const el of [player, now]) el.dataset.state = busy ? 'loading' : playing ? 'playing' : 'paused';
    all('.qp-label').forEach(el => { el.textContent = cur ? cur.label : ''; });
    all('.qp-sub').forEach(el => { el.textContent = cur ? cur.sub : ''; });
    all('[data-q="toggle"]').forEach(el => {
      if (playing !== wasPlaying || !el.firstElementChild) { el.innerHTML = playing ? IC.pause : IC.play; mo.swap(el.firstElementChild); }
      el.setAttribute('aria-label', playing ? 'Pause' : 'Play'); el.title = playing ? 'Pause' : 'Play';
    });
    wasPlaying = playing;
    all('[data-q="repeat"]').forEach(el => {
      el.innerHTML = store.repeat === 'one' ? IC.repeat1 : IC.repeat;
      el.setAttribute('aria-pressed', String(store.repeat !== 'off')); el.setAttribute('aria-label', `${REPEAT_TEXT[store.repeat]}. Change repeat`); el.title = REPEAT_TEXT[store.repeat];
    });
    all('[data-q="shuffle"]').forEach(el => { el.setAttribute('aria-pressed', String(store.shuffle)); el.title = store.shuffle ? 'Shuffle is on' : 'Shuffle is off'; });
    const fav = !!cur && store.favT.includes(cur.id);
    all('[data-q="fav"]').forEach(el => { el.setAttribute('aria-pressed', String(fav)); el.setAttribute('aria-label', fav ? 'Remove this surah from favorites' : 'Add this surah to favorites'); });
    all('[data-q="rate"]').forEach(el => { el.textContent = `${store.rate}×`; });
    markRows();
    if ('mediaSession' in navigator) try { navigator.mediaSession.playbackState = playing ? 'playing' : 'paused'; } catch (e) {}
  }
  // The row of whatever is playing shows moving bars in place of its number
  function markRows() {
    const playing = isPlaying();
    document.querySelectorAll('li[data-track]').forEach(li => {
      const on = !!cur && li.dataset.track === cur.id;
      li.classList.toggle('is-cur', on);
      li.classList.toggle('is-playing', on && playing);
    });
  }
  function paintTime() {
    const d = audio.duration, has = Number.isFinite(d) && d > 0;
    const t = audio.getAttribute('src') ? audio.currentTime : (store.last?.t || 0);
    let buf = 0;
    try { for (let i = 0; i < audio.buffered.length; i++) if (audio.buffered.start(i) <= t + 1) buf = Math.max(buf, audio.buffered.end(i)); } catch (e) {}
    all('.qp-fill').forEach(el => { if (!scrubbing) el.style.transform = `scaleX(${has ? Math.min(1, t / d) : 0})`; });
    all('.qp-buf').forEach(el => { el.style.transform = `scaleX(${has ? Math.min(1, buf / d) : 0})`; });
    all('.qp-cur').forEach(el => { if (!scrubbing) el.textContent = fmtTime(t); });
    all('.qp-dur').forEach(el => { el.textContent = has ? fmtTime(d) : '–:––'; });
    all('.qp-seek').forEach(el => {
      el.disabled = !has;
      if (!scrubbing) el.value = has ? Math.round(t / d * 1000) : 0;
      el.setAttribute('aria-valuetext', has ? `${fmtTime(t)} of ${fmtTime(d)}` : 'Not loaded yet');
    });
  }
  // Scrubbing: the fill and the time follow the thumb; the audio jumps when the thumb is let go
  function onScrub(e) {
    if (!e.target.classList.contains('qp-seek') || !Number.isFinite(audio.duration)) return;
    const frac = e.target.value / 1000;
    if (e.type === 'input') {
      scrubbing = true;
      all('.qp-fill').forEach(el => { el.style.transform = `scaleX(${frac})`; });
      all('.qp-cur').forEach(el => { el.textContent = fmtTime(frac * audio.duration); });
    } else {
      scrubbing = false;
      audio.currentTime = frac * audio.duration;
    }
  }
  for (const el of [player, now]) { el.addEventListener('input', onScrub); el.addEventListener('change', onScrub); }
  $('qp-vol').addEventListener('input', (e) => { store.vol = audio.volume = e.target.value / 100; save(); });

  // ---- Now playing, with the queue ----
  function renderQueue() {
    const ol = $('qp-queue');
    if (!q) { ol.innerHTML = '<li class="qp-empty">The queue shows here once the lists have loaded.</li>'; return; }
    const upcoming = q.order.slice(q.pos + 1, q.pos + 51).map((ix, k) => ({ id: q.ids[ix], pos: q.pos + 1 + k }));
    ol.innerHTML = upcoming.length ? upcoming.map(({ id, pos }) => {
      const i = info(id);
      return i ? `<li class="qp-row"><button class="qp-main" type="button" data-q="jump" data-pos="${pos}"><span class="qp-no">${i.n}</span><span class="qp-txt"><b>${esc(i.title)}</b><small>${esc(sub(i))}</small></span></button></li>` : '';
    }).join('') : `<li class="qp-empty">${store.repeat === 'all' ? 'The list starts again after this surah.' : 'Nothing after this surah.'}</li>`;
  }
  function openNow() {
    if (!cur || !now.hidden) return;
    renderQueue();
    now.hidden = false;
    app.inert = true;
    mo.sheetIn(now.firstElementChild);
    now.querySelector('[data-q="close"]').focus();
    ensureCat().then(() => { restoreQueue(); renderQueue(); }).catch(() => {});
  }
  function closeNow() {
    if (now.hidden) return;
    app.inert = false;
    mo.done(mo.sheetOut(now.firstElementChild)).then(() => { now.hidden = true; now.firstElementChild.style.cssText = ''; });
    player.querySelector('.qp-side [data-q="open"]').focus();
  }
  now.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); closeNow(); } });

  function onPlayerClick(e) {
    const b = e.target.closest('[data-q]');
    if (!b) return;
    const a = b.dataset.q;
    if (a === 'toggle') togglePlay();
    else if (a === 'prev') step(-1);
    else if (a === 'next') step(1);
    else if (a === 'back') seekBy(-10);
    else if (a === 'fwd') seekBy(10);
    else if (a === 'repeat') { store.repeat = nextRepeat(store.repeat); save(); paint(); say(`${REPEAT_TEXT[store.repeat]}.`); if (!now.hidden) renderQueue(); }
    else if (a === 'shuffle') { store.shuffle = !store.shuffle; if (q) q = reshuffle(q, store.shuffle); save(); paint(); say(store.shuffle ? 'Shuffle is on.' : 'Shuffle is off.'); if (!now.hidden) renderQueue(); }
    else if (a === 'fav') { if (cur) { favTrack(cur.id); mo.pop(b.firstElementChild); } }
    else if (a === 'add') { if (cur) openAdd(cur.id, cur.label); }
    else if (a === 'rate') { store.rate = audio.playbackRate = nextRate(store.rate); save(); paint(); }
    else if (a === 'open') openNow();
    else if (a === 'close') closeNow();
    else if (a === 'dismiss') dismiss();
    else if (a === 'jump' && q) { q.pos = +b.dataset.pos; load(current(q), 0, true); }
  }
  player.addEventListener('click', onPlayerClick);
  now.addEventListener('click', onPlayerClick);

  // ---- Favorites and playlists ----
  function favTrack(id) {
    store.favT = toggle(store.favT, id); save();
    say(store.favT.includes(id) ? 'Added to your favorite surahs.' : 'Removed from your favorite surahs.');
    paint();
    document.querySelectorAll(`li[data-track="${id}"] [data-act="fav-t"]`).forEach(b => b.setAttribute('aria-pressed', String(store.favT.includes(id))));
    if (view === 'favorites' && !query) renderList();
  }
  function favReciter(id) {
    store.favR = toggle(store.favR, id); save();
    say(store.favR.includes(id) ? 'Added to your favorite reciters.' : 'Removed from your favorite reciters.');
    tabEl.querySelectorAll(`[data-act="fav-r"][data-id="${id}"]`).forEach(b => b.setAttribute('aria-pressed', String(store.favR.includes(id))));
    if (view === 'favorites' && !query) renderList();
  }
  const listById = (id) => store.lists.find(l => l.id === id);
  const count = (n, one) => `${n} ${one}${n === 1 ? '' : 's'}`;

  function showDlg(html, focusSel) {
    dlgIn.innerHTML = html;
    if (!dlg.open) { dlg.showModal(); mo.sheetIn(dlgIn); }
    (focusSel && dlgIn.querySelector(focusSel) || dlgIn.querySelector('button')).focus();
  }
  const closeDlg = () => { if (dlg.open) dlg.close(); };
  dlg.addEventListener('click', (e) => { if (e.target === dlg) closeDlg(); }); // a tap on the dimmed backdrop
  function openAdd(track, name) {
    const rowsHtml = store.lists.map(l => {
      const has = l.tracks.includes(track);
      return `<li><button class="qp-pick" type="button" data-d="pick" data-id="${l.id}"${has ? ' disabled' : ''}><b>${esc(l.name)}</b><small>${has ? 'Already in this playlist' : count(l.tracks.length, 'surah')}</small></button></li>`;
    }).join('');
    showDlg(`<h3 id="qp-dlg-h">Add to a playlist</h3><p class="qp-dlg-sub">${esc(name)}</p>`
      + (rowsHtml ? `<ul class="qp-picks">${rowsHtml}</ul>` : '<p class="iq-note">You have no playlists yet. Name one below.</p>')
      + `<form class="qp-form" data-d="create-add"><input class="d-input" name="name" maxlength="40" placeholder="New playlist name" aria-label="New playlist name" autocomplete="off"><button class="d-btn d-btn-primary" type="submit">Create and add</button></form>`
      + '<div class="qp-dlg-foot"><button class="d-btn d-btn-ghost" type="button" data-d="cancel">Cancel</button></div>', store.lists.some(l => !l.tracks.includes(track)) ? '.qp-pick:not([disabled])' : 'input');
    dlg.dataset.track = track;
  }
  function openName(id) {
    const l = id && listById(id);
    showDlg(`<h3 id="qp-dlg-h">${l ? 'Rename playlist' : 'New playlist'}</h3>`
      + `<form class="qp-form" data-d="${l ? 'rename' : 'create'}" data-id="${l ? l.id : ''}"><input class="d-input" name="name" maxlength="40" value="${l ? esc(l.name) : ''}" placeholder="Playlist name" aria-label="Playlist name" autocomplete="off"><button class="d-btn d-btn-primary" type="submit">Save</button></form>`
      + '<div class="qp-dlg-foot"><button class="d-btn d-btn-ghost" type="button" data-d="cancel">Cancel</button></div>', 'input');
  }
  function openDelete(id) {
    const l = listById(id);
    if (!l) return;
    showDlg(`<h3 id="qp-dlg-h">Delete “${esc(l.name)}”?</h3><p class="qp-dlg-sub">This removes the playlist and its list of ${count(l.tracks.length, 'surah')} from this device. It cannot be undone.</p>`
      + `<div class="qp-dlg-foot"><button class="d-btn d-btn-ghost" type="button" data-d="cancel">Keep it</button><button class="d-btn d-btn-error" type="button" data-d="delete" data-id="${l.id}">Delete playlist</button></div>`, '[data-d="cancel"]');
  }
  dlg.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-d]');
    if (!b) return;
    const a = b.dataset.d;
    if (a === 'cancel') closeDlg();
    else if (a === 'pick') {
      store.lists = addToList(store.lists, b.dataset.id, dlg.dataset.track); save();
      say(`Added to ${listById(b.dataset.id).name}.`);
      closeDlg(); refreshLists(); if (detail?.type === 'list') renderDetail();
    } else if (a === 'delete') {
      store.lists = removeList(store.lists, b.dataset.id); save();
      if (detail?.type === 'list' && detail.id === b.dataset.id) { detail = null; setPane('list'); }
      say('Playlist deleted.');
      closeDlg(); refreshLists(); renderDetail();
    }
  });
  dlg.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target, name = cleanName(f.elements.name.value), a = f.dataset.d;
    if (!name) { say('Give the playlist a name first.'); return f.elements.name.focus(); }
    closeDlg();
    if (a === 'rename') { store.lists = renameList(store.lists, f.dataset.id, name); say('Playlist renamed.'); }
    else {
      store.lists = addList(store.lists, name);
      const made = store.lists[store.lists.length - 1];
      if (a === 'create-add') { store.lists = addToList(store.lists, made.id, dlg.dataset.track); say(`Added to ${name}.`); }
      else { say(`Playlist “${name}” created.`); save(); view = 'playlists'; return openDetail({ type: 'list', id: made.id }); }
    }
    save();
    refreshLists(); if (detail?.type === 'list') renderDetail();
  });
  const refreshLists = () => { if (view === 'playlists' && !query) renderList(); };

  // ---- The tab: a list on the left (reciters, surahs, favorites, playlists or search results) and a detail on the right ----
  const heart = (act, on, text, attrs = '') => `<button class="qp-ic qp-heart" type="button" data-act="${act}" ${attrs} aria-pressed="${on}" aria-label="${esc(text)}" title="Favorite">${IC.heart}</button>`;
  const main = (act, attrs, no, title, small) => `<button class="qp-main" type="button" data-act="${act}" ${attrs}>${no == null ? '' : `<span class="qp-no">${no}</span>`}${eq}<span class="qp-txt"><b>${esc(title)}</b>${small ? `<small>${esc(small)}</small>` : ''}</span></button>`;
  const recRow = (r) => {
    const ms = moshafOf(cat, r, store.riwaya), open = detail?.type === 'reciter' && detail.id === r.id;
    return `<li class="qp-row${open ? ' is-open' : ''}">${main('open-reciter', `data-id="${r.id}"`, null, r.name, ms.length === 1 ? ms[0].style : count(ms.length, 'recitation'))}${heart('fav-r', store.favR.includes(r.id), `Favorite reciter: ${r.name}`, `data-id="${r.id}"`)}</li>`;
  };
  const surahRow = (s) => `<li class="qp-row${detail?.type === 'surah' && detail.n === s.n ? ' is-open' : ''}">${main('open-surah', `data-n="${s.n}"`, s.n, s.name, s.makki ? 'Makki' : 'Madani')}</li>`;
  const trackRow = (id, no, title, small) => `<li class="qp-row" data-track="${id}">${main('play', '', no, title, small)}`
    + `${heart('fav-t', store.favT.includes(id), `Favorite: ${title}`)}<button class="qp-ic" type="button" data-act="add" aria-label="Add ${esc(title)} to a playlist" title="Add to a playlist">${IC.add}</button></li>`;
  const empty = (text) => `<p class="qp-empty">${text}</p>`;

  function renderList(animateIn) {
    tabEl.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-selected', String(!query && b.dataset.view === view)));
    if (!cat) {
      listEl.innerHTML = failed ? `${empty('Could not load the reciters. Check the connection.')}<button class="d-btn d-btn-primary" type="button" data-act="retry">Try again</button>` : empty('Loading reciters and surahs…');
      return;
    }
    let html = '';
    if (query) {
      const r = search(cat, query, store.riwaya);
      html = ((r.reciters.length ? `<h3 class="qp-h">Reciters (${r.reciters.length})</h3><ul class="qp-rows">${r.reciters.map(recRow).join('')}</ul>` : '')
        + (r.surahs.length ? `<h3 class="qp-h">Surahs (${r.surahs.length})</h3><ul class="qp-rows">${r.surahs.map(surahRow).join('')}</ul>` : ''))
        || empty(`Nothing matches “${esc(query)}”${store.riwaya === 'all' ? '' : ' in this riwayah'}. Try part of a reciter’s name, a surah name or a surah number.`);
    } else if (view === 'reciters') {
      const groups = new Map();
      for (const r of recitersFor(cat, store.riwaya)) { if (!groups.has(r.letter)) groups.set(r.letter, []); groups.get(r.letter).push(r); }
      html = [...groups].sort((a, b) => a[0].localeCompare(b[0])).map(([letter, rs]) => `<h3 class="qp-h qp-letter">${esc(letter)}</h3><ul class="qp-rows">${rs.map(recRow).join('')}</ul>`).join('');
    } else if (view === 'surahs') {
      html = `<ul class="qp-rows">${[...cat.surahs.values()].map(surahRow).join('')}</ul>`;
    } else if (view === 'favorites') {
      const rs = cat.reciters.filter(r => store.favR.includes(r.id)), ts = store.favT.map(info).filter(Boolean);
      html = `<h3 class="qp-h">Reciters</h3>${rs.length ? `<ul class="qp-rows">${rs.map(recRow).join('')}</ul>` : empty('Tap the heart beside a reciter to keep them here.')}`
        + `<h3 class="qp-h">Surahs</h3>${ts.length ? `<ul class="qp-rows">${ts.map(i => trackRow(i.id, i.n, i.title, sub(i))).join('')}</ul>` : empty('Tap the heart beside a surah, or in the player, to keep it here.')}`;
    } else {
      html = `<button class="d-btn d-btn-primary qp-new" type="button" data-act="new-list">New playlist</button>`
        + (store.lists.length ? `<ul class="qp-rows">${store.lists.map(l => `<li class="qp-row${detail?.type === 'list' && detail.id === l.id ? ' is-open' : ''}">${main('open-list', `data-id="${l.id}"`, null, l.name, count(l.tracks.length, 'surah'))}</li>`).join('')}</ul>`
          : empty('A playlist is your own list of surahs, from any reciters, in the order you choose.'));
    }
    listEl.innerHTML = html;
    markRows();
    if (animateIn) { listEl.scrollTop = 0; mo.rows(listEl.querySelectorAll('.qp-row')); }
  }

  function renderDetail(animateIn) {
    const back = `<button class="qp-ic qp-back" type="button" data-act="back" aria-label="Back to the list">${IC.left}</button>`;
    let html = '';
    if (!cat || !detail) html = cat ? empty('Choose a reciter, a surah or a playlist to see what you can play.') : '';
    else if (detail.type === 'reciter') {
      const r = cat.reciters.find(x => x.id === detail.id), ms = r ? moshafOf(cat, r, store.riwaya) : [];
      if (!ms.length) html = `<div class="qp-head">${back}<h3>${r ? esc(r.name) : 'Reciter'}</h3></div>${empty('This reciter has no recitation in the chosen riwayah. Choose “All riwayat” above to see the others.')}`;
      else {
        const m = ms.find(x => x.id === detail.m) || ms[0];
        detail.m = m.id;
        html = `<div class="qp-head">${back}<h3>${esc(r.name)}</h3>${heart('fav-r', store.favR.includes(r.id), `Favorite reciter: ${r.name}`, `data-id="${r.id}"`)}</div>`
          + (ms.length > 1 ? `<div class="qp-chips" role="group" aria-label="Recitation">${ms.map(x => `<button class="d-btn d-btn-sm${x.id === m.id ? ' d-btn-primary' : ' d-btn-outline'}" type="button" data-act="moshaf" data-m="${x.id}" aria-pressed="${x.id === m.id}">${esc(x.style)}</button>`).join('')}</div>` : `<p class="qp-dlg-sub">${esc(m.style)}</p>`)
          + `<p class="qp-count">${count(m.surahs.length, 'surah')}</p><ul class="qp-rows">${m.surahs.map(s => { const su = cat.surahs.get(s); return trackRow(trackId(m.id, s), s, su ? su.name : `Surah ${s}`, su ? (su.makki ? 'Makki' : 'Madani') : ''); }).join('')}</ul>`;
      }
    } else if (detail.type === 'surah') {
      const s = cat.surahs.get(detail.n);
      const ms = [...cat.moshaf.values()].filter(m => m.surahs.includes(detail.n) && (store.riwaya === 'all' || m.rewaya === store.riwaya)).sort((a, b) => a.reciter.localeCompare(b.reciter));
      html = `<div class="qp-head">${back}<h3>${detail.n}. ${esc(s ? s.name : 'Surah')}</h3></div><p class="qp-count">${count(ms.length, 'recitation')}</p>`
        + (ms.length ? `<ul class="qp-rows">${ms.map(m => trackRow(trackId(m.id, detail.n), null, m.reciter, m.style)).join('')}</ul>` : empty('No recitation of this surah in the chosen riwayah.'));
    } else {
      const l = listById(detail.id);
      if (!l) { detail = null; return renderDetail(); }
      const grip = (title) => `<button class="qp-ic qp-grip" type="button" aria-label="Move ${esc(title)}: drag, or press the up and down arrow keys" title="Drag to reorder">${IC.grip}</button>`;
      html = `<div class="qp-head">${back}<h3>${esc(l.name)}</h3></div><p class="qp-count">${count(l.tracks.length, 'surah')}</p>`
        + `<div class="qp-chips"><button class="d-btn d-btn-sm d-btn-primary" type="button" data-act="play-all"${l.tracks.some(id => info(id)) ? '' : ' disabled'}>Play all</button><button class="d-btn d-btn-sm d-btn-outline" type="button" data-act="rename">Rename</button><button class="d-btn d-btn-sm d-btn-outline" type="button" data-act="delete">Delete</button></div>`
        + (l.tracks.length ? `<ul class="qp-rows qp-sortable">${l.tracks.map((id, k) => {
          const i = info(id);
          return i ? `<li class="qp-row" data-track="${id}">${grip(i.title)}${main('play', '', k + 1, `${i.n}. ${i.title}`, sub(i))}<button class="qp-ic" type="button" data-act="remove" aria-label="Remove ${esc(i.title)} from this playlist" title="Remove">${IC.close}</button></li>`
            : `<li class="qp-row" data-track="${id}"><span class="qp-main"><span class="qp-txt"><b>No longer on mp3quran.net</b></span></span><button class="qp-ic" type="button" data-act="remove" aria-label="Remove from this playlist">${IC.close}</button></li>`;
        }).join('')}</ul>` : empty('Empty so far. Use the add button beside any surah, or in the player, to put it here.'));
    }
    detailEl.innerHTML = html;
    markRows();
    if (animateIn) { detailEl.scrollTop = 0; mo.fade(detailEl.querySelector('.qp-head')); mo.rows(detailEl.querySelectorAll('.qp-row')); }
  }
  // On a narrow screen only one of the two panes shows at a time
  const setPane = (p) => { tabEl.dataset.pane = p; };
  function openDetail(d) {
    detail = d;
    setPane('detail');
    renderList();
    renderDetail(true);
    if (getComputedStyle(listEl).display === 'none') detailEl.querySelector('.qp-back')?.focus();
  }
  const queueFrom = (li) => { const ids = [...li.parentElement.querySelectorAll(':scope > li[data-track]')].map(x => x.dataset.track).filter(id => info(id)); return [ids, ids.indexOf(li.dataset.track)]; };

  tabEl.addEventListener('click', (e) => {
    const v = e.target.closest('[data-view]');
    if (v) { view = v.dataset.view; query = $('qp-search').value = ''; setPane('list'); return renderList(true); }
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const a = b.dataset.act, li = b.closest('li[data-track]');
    if (a === 'retry') { failed = false; open(); }
    else if (a === 'open-reciter') openDetail({ type: 'reciter', id: +b.dataset.id });
    else if (a === 'open-surah') openDetail({ type: 'surah', n: +b.dataset.n });
    else if (a === 'open-list') openDetail({ type: 'list', id: b.dataset.id });
    else if (a === 'back') { setPane('list'); (listEl.querySelector('.is-open .qp-main') || $('qp-search')).focus(); }
    else if (a === 'moshaf') { detail.m = +b.dataset.m; renderDetail(true); }
    else if (a === 'fav-r') { favReciter(+b.dataset.id); mo.pop(b.firstElementChild); }
    else if (a === 'new-list') openName(null);
    else if (a === 'rename') openName(detail.id);
    else if (a === 'delete') openDelete(detail.id);
    else if (a === 'play-all') { const ids = listById(detail.id).tracks.filter(id => info(id)); if (ids.length) playQueue(ids, 0); }
    else if (li && a === 'play') {
      if (cur && cur.id === li.dataset.track && audio.getAttribute('src')) return togglePlay();
      const [ids, i] = queueFrom(li);
      if (i >= 0) playQueue(ids, i);
    } else if (li && a === 'fav-t') { favTrack(li.dataset.track); mo.pop(b.firstElementChild); }
    else if (li && a === 'add') { const i = info(li.dataset.track); if (i) openAdd(i.id, `${label(i)} · ${i.reciter}`); }
    else if (li && a === 'remove') {
      const glide = mo.flip(li.parentElement.children);
      store.lists = removeFromList(store.lists, detail.id, li.dataset.track); save();
      li.remove(); glide();
      refreshLists();
      setTimeout(() => { if (detail?.type === 'list') renderDetail(); }, mo.T.spring.snappy.duration * 1000);
    }
  });

  // Reordering a playlist: drag the handle, or focus it and press the arrow keys
  detailEl.addEventListener('pointerdown', (e) => {
    const h = e.target.closest('.qp-grip');
    if (!h || detail?.type !== 'list') return;
    const li = h.closest('li'), ul = li.parentElement, listId = detail.id;
    let lastSwap = 0;
    e.preventDefault();
    h.focus();
    li.classList.add('is-drag');
    // The row being dragged stays where it is in the DOM and its neighbours hop over it, so the browser never loses track of the pointer
    const move = (ev) => {
      const over = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('li[data-track]');
      if (!over || over === li || over.parentElement !== ul || ev.timeStamp - lastSwap < 140) return; // the pause lets the rows finish gliding
      lastSwap = ev.timeStamp;
      const glide = mo.flip(ul.children);
      ul.insertBefore(over, li.compareDocumentPosition(over) & Node.DOCUMENT_POSITION_FOLLOWING ? li : li.nextSibling);
      glide();
    };
    const drop = () => {
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', drop);
      removeEventListener('pointercancel', drop);
      li.classList.remove('is-drag');
      store.lists = setListOrder(store.lists, listId, [...ul.children].map(x => x.dataset.track)); save();
      if (detail?.type === 'list' && detail.id === listId) { renderDetail(); detailEl.querySelector(`li[data-track="${li.dataset.track}"] .qp-grip`)?.focus(); }
    };
    addEventListener('pointermove', move);
    addEventListener('pointerup', drop);
    addEventListener('pointercancel', drop);
  });
  detailEl.addEventListener('keydown', (e) => {
    const h = e.target.closest('.qp-grip');
    if (!h || detail?.type !== 'list' || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    e.preventDefault();
    const li = h.closest('li'), from = [...li.parentElement.children].indexOf(li), to = from + (e.key === 'ArrowUp' ? -1 : 1), id = li.dataset.track;
    if (to < 0 || to >= li.parentElement.children.length) return;
    const tops = new Map([...li.parentElement.children].map(x => [x.dataset.track, x.getBoundingClientRect().top]));
    store.lists = moveInList(store.lists, detail.id, from, to); save();
    renderDetail();
    for (const x of detailEl.querySelectorAll('li[data-track]')) {
      const dy = tops.get(x.dataset.track) - x.getBoundingClientRect().top;
      if (dy) mo.animate(x, { translate: [`0 ${dy}px`, '0 0'] }, mo.spring('snappy'));
    }
    detailEl.querySelector(`li[data-track="${id}"] .qp-grip`)?.focus();
    say(`Moved to place ${to + 1}.`);
  });

  $('qp-search').addEventListener('input', (e) => { query = e.target.value.trim(); setPane('list'); renderList(); });
  $('qp-riwaya').addEventListener('change', (e) => {
    store.riwaya = e.target.value === 'all' ? 'all' : +e.target.value; save();
    renderList(true); renderDetail();
  });

  // Opening the tab loads the lists the first time
  function open() {
    renderList();
    if (cat) return;
    ensureCat().then(() => {
      if (!detail && cur) { const m = cat.moshaf.get(+cur.id.split(':')[0]); if (m) detail = { type: 'reciter', id: m.reciterId, m: m.id }; }
      if (cur) showPlayer();
      paint(); paintTime();
      renderList(true); renderDetail(true);
    }).catch(() => renderList());
  }
  addEventListener('hashchange', () => { if (location.hash === '#quran') open(); });
  if (location.hash === '#quran') open();
  if (cur) player.hidden = false;
  paint(); paintTime();

  return {
    // Another sound (an adhan, an alert, an adhkar recording) is about to play: step aside, and remember to come back
    interrupt() { if (isPlaying()) { interrupted = true; audio.pause(); } },
    resume() { if (interrupted) { interrupted = false; if (audio.getAttribute('src')) audio.play().catch(() => {}); } },
    // A modal dialog would sit on top of the alert's Stop button, so it closes when an alert starts
    closeDialogs: closeDlg,
  };
}
