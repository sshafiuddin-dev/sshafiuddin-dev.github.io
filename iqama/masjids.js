// The masjids whose iqama times the app can read. Used by the page (to list them and work out which is near),
// by functions/api/iqama.js (which only ever fetches the sources below) and by the nightly scripts/fetch-iqama.mjs.
//
// To add a masjid: find where its website publishes iqama times, pick the reader that fits, add an entry,
// and add a test with a copy of its page to scripts/selfcheck.mjs.
//   iscj      iscj.org's home page ("Fajr 5:12 AM Iqama 5:45 ... Jumu'ah Khutbahs 12:00 PM")
//   table     a page with one iqama time after each prayer's name ("Fajr 6:00 Dhuhr 12:15 ... Maghrib On Time",
//             "Juma Times 12:40 & 1:40"); only for pages that show iqama times alone, not adhan and iqama side by side
//   masjidal  a Masjidal (Athan+) monthly widget, timing.athanplus.com/masjid/widgets/monthly?masjid_id=...; set `id`
//   mcmc      the JSON feed behind mcmcnj.org's prayer widget (/wp-json/mcmc/v1/prayer-times?date=YYYY-MM-DD)
// lat and lng are the masjid's own location (looked up on OpenStreetMap); its times are used within 40 km of it.

export const MASJIDS = [
  {
    id: 'iscj', name: 'ISCJ', full: 'Islamic Society of Central Jersey', town: 'Monmouth Junction',
    lat: 40.384, lng: -74.563, zone: 'America/New_York', site: 'https://iscj.org/',
    source: { kind: 'iscj', url: 'https://iscj.org/' },
  },
  {
    id: 'nbic', name: 'NBIC', full: 'New Brunswick Islamic Center', town: 'North Brunswick',
    lat: 40.4615, lng: -74.4775, zone: 'America/New_York', site: 'https://www.nbic.org/',
    source: { kind: 'table', url: 'https://www.nbic.org/' },
  },
  {
    id: 'mcgp', name: 'MCGP', full: 'The Muslim Center of Greater Princeton', town: 'West Windsor',
    lat: 40.2813, lng: -74.5704, zone: 'America/New_York', site: 'https://www.themuslimcenter.org/',
    source: { kind: 'masjidal', id: '3OA87VLp' },
  },
  {
    id: 'mcmc', name: 'MCMC', full: 'Muslim Center of Middlesex County', town: 'Piscataway',
    lat: 40.5296, lng: -74.4685, zone: 'America/New_York', site: 'https://mcmcnj.org/',
    source: { kind: 'mcmc', url: 'https://mcmcnj.org/wp-json/mcmc/v1/prayer-times' },
  },
];

export const masjidById = (id) => MASJIDS.find(m => m.id === id) || null;
export const DEFAULT_MASJID = 'iscj';
