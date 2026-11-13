# Sources and credits

Everything on this site that comes from someone else, where it is used, and under what terms.
Iqama Times (`/iqama`) shows the same list under Settings, About.

## Iqama Times

### Quran

| What | Source | Used in |
|---|---|---|
| Recitations (audio), reciter list, riwayat and surah names | [mp3quran.net](https://mp3quran.net/) API v3. Each recitation is by the reciter named in the player and streams from mp3quran.net's servers. | `iqama/quran.js` |

### Adhkar and duas

| What | Source | Used in |
|---|---|---|
| Book | *Hisn al-Muslim* (Fortress of the Muslim) by Saʿid ibn ʿAli ibn Wahf al-Qahtani | Adhkar tab, Today tab, full screen |
| Arabic text, transliteration, English translation, repeat counts | [hisnmuslim.com](https://www.hisnmuslim.com/) ([index](https://www.hisnmuslim.com/api/en/husn_en.json)), copied unchanged into `iqama/hisn-text.json` by `scripts/fetch-hisn.mjs` | `iqama/hisn-text.json`, `iqama/adhkar.js` |
| Arabic chapter and dua recordings, and the spoken Bismillah alert sound (chapter 8) | hisnmuslim.com, streamed from their site | `iqama/hisn.js`, `iqama/adhkar.js`, `iqama/app.js` |
| Hadith and verse references beside Today-tab duas | Given in `iqama/adhkar.js` where known. Every dua also names its Hisn al-Muslim chapter. | `iqama/adhkar.js` |

### Adhan and alert sounds

| What | Source | Used in |
|---|---|---|
| Adhan recordings: Makkah, Egyptian style, Masjid al-Aqsa, Ottoman style (Shaykh Nazim), Mishary al-Afasy; Fajr adhans by Mansoor az-Zahrani and Mishary al-Afasy | Bundled with the open-source [Adhan Clock](https://github.com/adhanclock/PWA) | `iqama/audio/` |
| Soft beep | Generated in the app (`beepWav` in `iqama/logic.js`); no recording | `iqama/app.js` |

### Prayer and iqama times

| What | Source | Licence | Used in |
|---|---|---|---|
| Prayer time calculator | [PrayTimes.org](http://praytimes.org/) v2.3 by Hamid Zarrabi-Zadeh, as adapted in Adhan Clock | GNU LGPL 3.0, see `iqama/lib/PRAYTIMES-LICENSE` | `iqama/lib/PrayTimes.js` |
| Calculation methods and the adaptation above | [Adhan Clock](https://github.com/adhanclock/PWA) © 2022 AdhanClock.com | MIT, see `iqama/lib/ADHANCLOCK-LICENSE` | `iqama/lib/` |
| Iqama and Jumuʿah times near the masjid | [Islamic Society of Central Jersey](https://iscj.org/#prayer-times), read from iscj.org | | `functions/`, `scripts/fetch-iqama.mjs`, `iqama/iqama.json` |

### Weather and places

| What | Source | Licence |
|---|---|---|
| Weather and forecast | [Open-Meteo.com](https://open-meteo.com/) | CC BY 4.0 |
| Air quality | Open-Meteo, using [Copernicus Atmosphere Monitoring Service](https://atmosphere.copernicus.eu/) information | CC BY 4.0 (Open-Meteo); Copernicus licence |
| Place search | Open-Meteo geocoding, using [GeoNames](https://www.geonames.org/) | CC BY 4.0 |

## Whole site

| What | Source | Licence | Where |
|---|---|---|---|
| Animation | [Motion](https://motion.dev/) © Motion B.V. | MIT, see `vendor/MOTION-LICENSE.md` | `vendor/motion.min.js` |
| UI components | [daisyUI](https://daisyui.com/) 5 and [Tailwind CSS](https://tailwindcss.com/) 4, built into `iqama/daisy.css` by `scripts/daisy/build.sh` | MIT | `iqama/daisy.css` |
| Fonts | Amiri, Bricolage Grotesque, IBM Plex Sans, IBM Plex Mono, served by [Google Fonts](https://fonts.google.com/) | SIL Open Font License 1.1 | `index.html`, `iqama/index.html` |
