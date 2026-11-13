// Duas and adhkar for the Today tab and full screen, chosen by the time of day.
// Each item points to one entry of Hisn al-Muslim [chapter, entry]. Its Arabic, transliteration, English and repeat count
// come from hisn-text.json (copied from hisnmuslim.com by scripts/fetch-hisn.mjs) through fillSets, never typed here.
// ref names the Quran verse or hadith where it is known; the chapter is always shown.
import { HISN, hisnUrl } from './hisn.js';

const H = (ch, i, ref = '') => ({ ch, i, ref, ar: '', tr: '', en: '', n: 0, src: '' });
const D = {
  afterAdhan: H(15, 3, 'Bukhari 614'),
  notRejected: H(15, 4, 'Abu Dawud 521, Tirmidhi 212'),
  afterSalah: H(25, 0, 'Muslim 591'),
  tasbih: H(25, 3),
  kursi: H(28, 1, 'Quran 2:255'), // the same verse as ch. 25 entry 5, whose English is only the instruction to recite it
  bika: H(27, 3, 'Tirmidhi 3391'),
  bismillah: H(27, 11, 'Abu Dawud 5088, Tirmidhi 3388'),
  bihamdihi: H(27, 16, 'Muslim 2692'),
  tahlil: H(27, 18, 'Bukhari 3293, Muslim 2691'),
  aoodhu: H(27, 22, 'Muslim 2709'),
  afiyah: H(27, 9, 'Ibn Majah 3871'),
  sleepName: H(28, 6, 'Bukhari 6324'),
  sleepKursi: H(28, 1, 'Quran 2:255, Bukhari 2311'),
  sleepTasbih: H(28, 7, 'Bukhari 3705, Muslim 2727'),
  salawat: H(23, 0),
  salawat2: H(23, 1),
  zalamtu: H(24, 2),
  hasanah: H(117, 0, 'Quran 2:201, Bukhari 6389'),
  hamm: H(34, 1),
  azim: H(130, 2, 'Bukhari 6406, Muslim 2694'),
};

export const SETS = {
  adhan: { title: 'Between adhan and iqama', when: 'Dua after the adhan', items: [D.afterAdhan, D.notRejected] },
  prayer: { title: 'After the prayer', when: 'Adhkar after salah', items: [D.afterSalah, D.kursi, D.tasbih] },
  morning: { title: 'Morning adhkar', when: 'From Fajr until sunrise', items: [D.bika, D.bismillah, D.bihamdihi, D.tahlil] },
  evening: { title: 'Evening adhkar', when: 'From Asr until Maghrib', items: [D.bismillah, D.aoodhu, D.bihamdihi, D.bika] },
  sleep: { title: 'Before sleep', when: 'After Isha', items: [D.sleepName, D.sleepKursi, D.sleepTasbih] },
  friday: { title: 'Jumu’ah', when: 'Friday', items: [D.salawat, D.salawat2] },
  general: { title: 'Dua for today', when: 'A new one each day', items: [D.hasanah, D.afiyah, D.hamm, D.zalamtu, D.azim] },
};

// Fills every item from the Hisn al-Muslim text, { [chapter]: { items: [{ ar, tr, en, n }] } }. An entry that is missing stays empty.
export function fillSets(chapters) {
  for (const item of Object.values(D)) {
    const e = chapters?.[item.ch]?.items?.[item.i] || {};
    Object.assign(item, { ar: e.ar || '', tr: e.tr || '', en: e.en || '', n: Number.isInteger(e.n) && e.n > 1 ? e.n : 0 });
    item.src = `Hisn al-Muslim, ch. ${item.ch}${item.ref ? ` · ${item.ref}` : ''}`;
  }
}
// fills src at once, so a reference shows even before the text arrives
fillSets(null);

// Which set fits the moment. rows: today's [{ adhan, iqama }] for Fajr to Isha, in minutes after midnight.
export function pickSet(nowMin, rows, sunrise, weekday) {
  for (const r of rows) {
    const done = r.iqama ?? r.adhan;
    if (r.iqama != null && r.iqama > r.adhan && nowMin >= r.adhan && nowMin < r.iqama) return { key: 'adhan', until: r.iqama };
    if (nowMin >= done && nowMin < done + 20) return { key: 'prayer', until: done + 20 };
  }
  const [fajr, , asr, maghrib, isha] = rows;
  if (nowMin >= fajr.adhan && nowMin < sunrise) return { key: 'morning', until: sunrise };
  if (nowMin >= asr.adhan && nowMin < maghrib.adhan) return { key: 'evening', until: maghrib.adhan };
  if (nowMin >= (isha.iqama ?? isha.adhan) + 20 || nowMin < fajr.adhan) return { key: 'sleep', until: null };
  return { key: weekday === 'Fri' ? 'friday' : 'general', until: null };
}

// Hisn al-Muslim chapter recordings (Arabic), one file per chapter, looked up in hisn.js (file numbers are not always chapter + 1).
// Chapters: 15 after hearing the adhan, 25 after the prayer, 27 morning and evening, 28 before sleep.
const hisn = (id) => hisnUrl(HISN.find(([n]) => n === id)[2]);
export const AUDIO = { adhan: hisn(15), prayer: hisn(25), morning: hisn(27), evening: hisn(27), sleep: hisn(28) };
