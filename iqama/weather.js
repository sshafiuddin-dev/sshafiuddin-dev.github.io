// Weather details from Open-Meteo (free, no key). fetchWeather normalises the reply; weatherHtml draws the panel.
// Only numbers and parsed times from the reply reach the page, never its raw strings.
import { fmt, weatherKind, uvLevel, aqiLevel, compass } from './logic.js';

const CURRENT = 'temperature_2m,apparent_temperature,relative_humidity_2m,dew_point_2m,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m,visibility,uv_index,precipitation_probability';
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const minutesOf = (iso) => { const m = /T(\d{2}):(\d{2})/.exec(typeof iso === 'string' ? iso : ''); return m ? m[1] * 60 + +m[2] : null; };

export async function fetchWeather(lat, lng, units) {
  const f = units === 'F';
  const base = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&timezone=auto&forecast_days=2`
    + `&temperature_unit=${f ? 'fahrenheit' : 'celsius'}&wind_speed_unit=${f ? 'mph' : 'kmh'}&precipitation_unit=${f ? 'inch' : 'mm'}`;
  const airReq = fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&timezone=auto&current=us_aqi,pm2_5,pm10,ozone,nitrogen_dioxide`)
    .then(r => (r.ok ? r.json() : null)).catch(() => null);
  let r = await fetch(`${base}&current=${CURRENT}&hourly=temperature_2m,weather_code,precipitation_probability&daily=temperature_2m_max,temperature_2m_min,uv_index_max,precipitation_sum,sunrise,sunset`);
  // shortcut: if Open-Meteo ever rejects a variable, show the basics rather than no weather at all
  if (r.status === 400) r = await fetch(`${base}&current=temperature_2m,weather_code`);
  if (!r.ok) throw new Error(`weather ${r.status}`);
  const j = await r.json(), c = j.current || {}, h = j.hourly || {}, dl = j.daily || {};
  if (num(c.temperature_2m) == null) throw new Error('no reading');

  const now = typeof c.time === 'string' ? c.time : '';
  const times = Array.isArray(h.time) ? h.time : [];
  let start = times.findIndex(t => typeof t === 'string' && t.slice(0, 13) === now.slice(0, 13));
  if (start < 0) start = 0;
  const col = (name, i) => num((h[name] || [])[i]);
  const hours = times.slice(start, start + 24).map((t, k) => ({
    today: typeof t === 'string' && t.slice(0, 10) === now.slice(0, 10), min: minutesOf(t),
    temp: col('temperature_2m', start + k), code: col('weather_code', start + k), pop: col('precipitation_probability', start + k),
  })).filter(x => x.min != null);
  const first = (name) => (dl[name] || [])[0];
  const a = (await airReq)?.current || null;
  return {
    ...weatherKind(num(c.weather_code)), at: minutesOf(now),
    temp: c.temperature_2m, feels: num(c.apparent_temperature), humidity: num(c.relative_humidity_2m), dew: num(c.dew_point_2m),
    cloud: num(c.cloud_cover), pressure: num(c.pressure_msl), wind: num(c.wind_speed_10m), dir: num(c.wind_direction_10m),
    gust: num(c.wind_gusts_10m), vis: num(c.visibility), uv: num(c.uv_index), pop: num(c.precipitation_probability),
    today: {
      max: num(first('temperature_2m_max')), min: num(first('temperature_2m_min')), uv: num(first('uv_index_max')),
      rain: num(first('precipitation_sum')), sunrise: minutesOf(first('sunrise')), sunset: minutesOf(first('sunset')),
    },
    hours,
    air: a ? { aqi: num(a.us_aqi), pm25: num(a.pm2_5), pm10: num(a.pm10), o3: num(a.ozone), no2: num(a.nitrogen_dioxide) } : null,
  };
}

const CLOUD = 'M7 15h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.1 8 3.5 3.5 0 0 0 7 15z';
const ICONS = {
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  cloud: '<path d="M7 18h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.1 11 3.5 3.5 0 0 0 7 18z"/>',
  fog: '<path d="M4 8h16M4 12h16M6 16h12M8 20h8"/>',
  rain: `<path d="${CLOUD}"/><path d="M9 18l-1 3M13 18l-1 3M17 18l-1 3"/>`,
  snow: `<path d="${CLOUD}"/><path d="M8 19h.01M12 19h.01M16 19h.01M10 22h.01M14 22h.01"/>`,
  storm: `<path d="${CLOUD}"/><path d="M13 16l-3 4h3l-2 3"/>`,
};
const icon = (kind, night) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[kind === 'clear' ? (night ? 'moon' : 'sun') : kind] || ICONS.cloud}</svg>`;
const hourLabel = (min) => { const h = Math.floor(min / 60); return `${(h + 11) % 12 + 1} ${h < 12 ? 'AM' : 'PM'}`; };
const AQI_STEPS = [50, 100, 150, 200, 300];

// prayers: the next occurrence of each prayer, [{ name, min, today }]
export function weatherHtml(w, units, prayers) {
  const F = units === 'F', deg = (v) => (v == null ? '–' : `${Math.round(v)}°`);
  const night = (min) => w.today.sunrise != null && w.today.sunset != null && (min < w.today.sunrise || min >= w.today.sunset);
  const facts = [
    ['Feels like', w.feels == null ? null : deg(w.feels)],
    ['Humidity', w.humidity == null ? null : `${Math.round(w.humidity)}%`],
    ['Dew point', w.dew == null ? null : deg(w.dew)],
    ['Wind', w.wind == null ? null : `${Math.round(w.wind)} ${F ? 'mph' : 'km/h'}${w.dir == null ? '' : ` ${compass(w.dir)}`}${w.gust == null ? '' : `, gusts ${Math.round(w.gust)}`}`],
    ['Visibility', w.vis == null ? null : F ? `${+(w.vis / 1609.34).toFixed(1)} mi` : `${+(w.vis / 1000).toFixed(1)} km`],
    ['UV index', w.uv == null ? null : `${Math.round(w.uv)}, ${uvLevel(w.uv)}`],
    ['Chance of rain', w.pop == null ? null : `${Math.round(w.pop)}%`],
    ['Cloud cover', w.cloud == null ? null : `${Math.round(w.cloud)}%`],
    ['Pressure', w.pressure == null ? null : F ? `${(w.pressure * 0.02953).toFixed(2)} inHg` : `${Math.round(w.pressure)} hPa`],
    ['Sunrise', w.today.sunrise == null ? null : fmt(w.today.sunrise)],
    ['Sunset', w.today.sunset == null ? null : fmt(w.today.sunset)],
    ['UV peak today', w.today.uv == null ? null : `${Math.round(w.today.uv)}, ${uvLevel(w.today.uv)}`],
    ['Rain today', w.today.rain == null ? null : `${+w.today.rain.toFixed(2)} ${F ? 'in' : 'mm'}`],
  ].filter(([, v]) => v != null);
  const highLow = w.today.max != null && w.today.min != null ? `High ${deg(w.today.max)}, low ${deg(w.today.min)}` : '';

  let html = `<div class="wx-now">${icon(w.kind, night(w.at ?? 720))}<p class="wx-temp">${Math.round(w.temp)}°${units}</p>`
    + `<div><p class="wx-cond">${w.label || 'Now'}</p><p class="wx-sub">${highLow}</p></div></div>`
    + `<dl class="wx-grid">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>`;

  if (w.air && w.air.aqi != null) {
    const level = AQI_STEPS.findIndex(s => w.air.aqi <= s);
    const parts = [['PM2.5', w.air.pm25], ['PM10', w.air.pm10], ['Ozone', w.air.o3], ['Nitrogen dioxide', w.air.no2]].filter(([, v]) => v != null);
    html += `<h3>Air quality</h3><p class="wx-aqi"><span class="wx-aqi-dot" data-level="${level < 0 ? 5 : level}"></span><strong>${Math.round(w.air.aqi)}</strong> US AQI, ${aqiLevel(w.air.aqi)}</p>`
      + `<dl class="wx-grid">${parts.map(([k, v]) => `<div><dt>${k}</dt><dd>${Math.round(v)} µg/m³</dd></div>`).join('')}</dl>`;
  }

  const inHour = (h, p) => p.today === h.today && Math.floor(p.min / 60) === Math.floor(h.min / 60);
  if (w.hours.length) {
    html += `<h3>Next 24 hours</h3><div class="wx-hours" role="region" aria-label="Hourly forecast" tabindex="0"><ol>${w.hours.map((h, i) => {
      const here = prayers.filter(p => inHour(h, p));
      return `<li${here.length ? ' class="has-prayer"' : ''}><span class="wx-h">${i ? hourLabel(h.min) : 'Now'}</span>${icon(weatherKind(h.code).kind, night(h.min))}`
        + `<span class="wx-t">${deg(h.temp)}</span><span class="wx-p">${h.pop == null ? '' : `${Math.round(h.pop)}%`}</span>${here.map(p => `<span class="wx-prayer">${p.name}</span>`).join('')}</li>`;
    }).join('')}</ol></div>`;
    const rows = prayers.map(p => {
      const h = w.hours.find(x => inHour(x, p));
      if (!h) return '';
      const label = weatherKind(h.code).label;
      return `<tr><th scope="row">${p.name}</th><td>${fmt(p.min)}${p.today ? '' : ' tomorrow'}</td><td>${deg(h.temp)}${label ? `, ${label.toLowerCase()}` : ''}${h.pop == null ? '' : `, ${Math.round(h.pop)}% chance of rain`}</td></tr>`;
    }).join('');
    if (rows) html += `<h3>Weather at prayer times</h3><div class="table-scroll"><table class="wx-prayers"><tbody>${rows}</tbody></table></div>`;
  }
  return html;
}
