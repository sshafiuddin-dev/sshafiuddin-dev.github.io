// Quran player logic with no DOM in it, so scripts/selfcheck.mjs can test it.
// A "moshaf" is one recitation set by one reciter (a riwayah and a style); a track is one surah from one moshaf, written "moshafId:surah".

export const trackId = (m, s) => `${m}:${s}`;
export const parseTrack = (id) => { const [m, s] = String(id).split(':').map(Number); return { m, s }; };
export const trackUrl = (server, s) => `${server}${String(s).padStart(3, '0')}.mp3`;
const isTrack = (id) => typeof id === 'string' && /^\d+:\d{1,3}$/.test(id);

export function fmtTime(sec) {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const s = Math.floor(sec), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}

// Search ignores case, accents, apostrophes and hyphens, so "al fatiha" finds "Al-Fatihah" and "abdul" finds "Abdul'aziz"
export const fold = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ'’`]/g, '').replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
const short = (name) => String(name || '').replace(/^Rewayat\s+/i, '').replace(/\s+/g, ' ').trim();

// Turns mp3quran's three lists into what the player needs
export function buildCatalog(suwarJson, recitersJson, riwayatJson) {
  const surahs = new Map();
  for (const x of suwarJson?.suwar || []) {
    const n = +x.id;
    if (n >= 1 && n <= 114) surahs.set(n, { n, name: String(x.name || `Surah ${n}`).trim(), makki: x.makkia === 1, key: fold(x.name || '') });
  }
  const moshaf = new Map(), reciters = [], counts = new Map();
  for (const rc of recitersJson?.reciters || []) {
    const ids = [];
    for (const m of rc.moshaf || []) {
      const list = [...new Set(String(m.surah_list || '').split(',').map(Number).filter(n => Number.isInteger(n) && n >= 1 && n <= 114))].sort((a, b) => a - b);
      if (!m.server || !list.length || !Number.isInteger(+m.id)) continue;
      const [riwayah, ...style] = String(m.name || '').split(' - ');
      moshaf.set(+m.id, {
        id: +m.id, reciterId: +rc.id, reciter: String(rc.name).trim(), rewaya: +m.rewaya_id || 0, legacy: m.name,
        style: [short(riwayah), ...style.map(s => s.trim())].filter(Boolean).join(' · '),
        server: String(m.server).replace(/^http:/, 'https:').replace(/\/?$/, '/'), surahs: list,
      });
      ids.push(+m.id);
      counts.set(+m.rewaya_id || 0, (counts.get(+m.rewaya_id || 0) || 0) + 1);
    }
    if (ids.length) reciters.push({ id: +rc.id, name: String(rc.name).trim(), letter: (String(rc.letter || rc.name || '#').trim()[0] || '#').toUpperCase(), key: fold(rc.name), moshaf: ids });
  }
  reciters.sort((a, b) => a.name.localeCompare(b.name));
  const riwayat = (riwayatJson?.riwayat || []).map(r => ({ id: +r.id, name: short(r.name), count: counts.get(+r.id) || 0 })).filter(r => r.count);
  return { surahs, reciters, moshaf, riwayat };
}

// A reciter's recitations under the chosen riwayah ('all' or a riwayah id)
export const moshafOf = (cat, reciter, riwaya = 'all') => reciter.moshaf.map(id => cat.moshaf.get(id)).filter(m => riwaya === 'all' || m.rewaya === +riwaya);
export const recitersFor = (cat, riwaya = 'all') => (riwaya === 'all' ? cat.reciters : cat.reciters.filter(r => moshafOf(cat, r, riwaya).length));

export function search(cat, query, riwaya = 'all') {
  const q = fold(query);
  if (!q) return { reciters: [], surahs: [] };
  const num = /^\d{1,3}$/.test(q) ? +q : 0;
  return {
    reciters: recitersFor(cat, riwaya).filter(r => r.key.includes(q)),
    surahs: [...cat.surahs.values()].filter(s => s.n === num || s.key.includes(q)),
  };
}

export function trackInfo(cat, id) {
  const { m, s } = parseTrack(id), mo = cat.moshaf.get(m), su = cat.surahs.get(s);
  if (!mo || !mo.surahs.includes(s)) return null;
  return { id, n: s, title: su ? su.name : `Surah ${s}`, reciter: mo.reciter, style: mo.style, url: trackUrl(mo.server, s) };
}

// The play queue: `ids` in the order shown, `order` the order played (shuffled or not), `pos` the place in `order`
export function makeQueue(ids, start = 0, shuffle = false, rnd = Math.random) {
  const order = ids.map((_, i) => i);
  start = Math.min(Math.max(0, start), Math.max(0, ids.length - 1));
  if (!shuffle) return { ids, order, pos: start };
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  order.splice(order.indexOf(start), 1); // the chosen track plays first, the rest follow in shuffled order
  return { ids, order: [start, ...order], pos: 0 };
}
export const current = (q) => (q && q.ids.length ? q.ids[q.order[q.pos]] : null);
export const reshuffle = (q, shuffle, rnd = Math.random) => makeQueue(q.ids, q.order[q.pos], shuffle, rnd);
// Next and Previous buttons: "repeat all" wraps round, otherwise they stop at the ends. Returns the new pos, or -1.
export function stepPos(q, dir, repeat) {
  const n = q.order.length, p = q.pos + dir;
  if (p >= 0 && p < n) return p;
  return repeat === 'all' && n ? (p + n) % n : -1;
}
// When a track finishes: 'again' for repeat one, else the next pos, or -1 at the end of the queue
export const afterEnd = (q, repeat) => (repeat === 'one' ? 'again' : stepPos(q, 1, repeat));

// Everything kept on the device. Saves from the old two-dropdown player ({ reciter, surah }) are carried over as `legacy`.
const REPEATS = ['off', 'all', 'one'];
export const RATES = [1, 1.25, 1.5, 0.75];
export const cleanName = (name) => String(name ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
export function cleanStore(raw) {
  const o = raw && typeof raw === 'object' ? raw : {};
  const tracks = (a) => [...new Set(Array.isArray(a) ? a.filter(isTrack) : [])];
  const last = o.last && isTrack(o.last.id) ? {
    id: o.last.id, t: Number.isFinite(o.last.t) && o.last.t > 0 ? o.last.t : 0,
    title: String(o.last.title || '').slice(0, 80), sub: String(o.last.sub || '').slice(0, 160), queue: tracks(o.last.queue).slice(0, 400),
    url: typeof o.last.url === 'string' && /^https:\/\/[^\s"'<>]+\.mp3$/.test(o.last.url) ? o.last.url : '',
  } : null;
  const out = {
    v: 2, last,
    riwaya: Number.isInteger(o.riwaya) ? o.riwaya : 'all',
    favR: [...new Set(Array.isArray(o.favR) ? o.favR.filter(Number.isInteger) : [])],
    favT: tracks(o.favT),
    lists: (Array.isArray(o.lists) ? o.lists : []).filter(l => l && typeof l.id === 'string' && cleanName(l.name)).map(l => ({ id: l.id, name: cleanName(l.name), tracks: tracks(l.tracks) })),
    repeat: REPEATS.includes(o.repeat) ? o.repeat : 'off',
    shuffle: o.shuffle === true,
    vol: Number.isFinite(o.vol) && o.vol >= 0 && o.vol <= 1 ? o.vol : 1,
    rate: RATES.includes(o.rate) ? o.rate : 1,
  };
  if (!last && typeof o.reciter === 'string' && Number.isInteger(o.surah)) out.legacy = { reciter: o.reciter, surah: o.surah };
  else if (!last && o.legacy && typeof o.legacy.reciter === 'string' && Number.isInteger(o.legacy.surah)) out.legacy = { reciter: o.legacy.reciter, surah: o.legacy.surah };
  return out;
}
// The old player saved the dropdown's label: the reciter's name, with "(recitation name)" after it when the reciter had several
export function legacyTrack(cat, legacy) {
  if (!legacy) return null;
  for (const m of cat.moshaf.values()) {
    if ((legacy.reciter === m.reciter || legacy.reciter === `${m.reciter} (${m.legacy})`) && m.surahs.includes(legacy.surah)) return trackId(m.id, legacy.surah);
  }
  return null;
}
export const nextRepeat = (r) => REPEATS[(REPEATS.indexOf(r) + 1) % REPEATS.length];
export const nextRate = (r) => RATES[(RATES.indexOf(r) + 1) % RATES.length];
export const toggle = (arr, id) => (arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id]);

// Playlists. Each function returns a new list of playlists and leaves the old one alone.
export function addList(lists, name, id = `p${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`) {
  name = cleanName(name);
  return name ? [...lists, { id, name, tracks: [] }] : lists;
}
const edit = (lists, id, fn) => lists.map(l => (l.id === id ? fn(l) : l));
export const renameList = (lists, id, name) => (cleanName(name) ? edit(lists, id, l => ({ ...l, name: cleanName(name) })) : lists);
export const removeList = (lists, id) => lists.filter(l => l.id !== id);
export const addToList = (lists, id, track) => edit(lists, id, l => (l.tracks.includes(track) || !isTrack(track) ? l : { ...l, tracks: [...l.tracks, track] }));
export const removeFromList = (lists, id, track) => edit(lists, id, l => ({ ...l, tracks: l.tracks.filter(t => t !== track) }));
// Used after a drag: the new order must be the same tracks, or it is ignored
export const setListOrder = (lists, id, order) => edit(lists, id, l => (order.length === l.tracks.length && new Set(order).size === order.length && order.every(t => l.tracks.includes(t)) ? { ...l, tracks: [...order] } : l));
export function moveInList(lists, id, from, to) {
  return edit(lists, id, l => {
    if (from === to || from < 0 || to < 0 || from >= l.tracks.length || to >= l.tracks.length) return l;
    const t = [...l.tracks], [x] = t.splice(from, 1);
    t.splice(to, 0, x);
    return { ...l, tracks: t };
  });
}
