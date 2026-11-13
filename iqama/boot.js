// Runs first, before the page paints. Kept out of index.html so the Content-Security-Policy can forbid inline scripts.
// The old github.io address forwards to the Cloudflare site
if (location.hostname.endsWith('.github.io')) location.replace('https://sshafiuddin.pages.dev' + location.pathname + location.search + location.hash);
// Apply the saved theme and clock style before first paint
// The look and the last brightness level shown; app.js works out the right level once the prayer times are known
try { var s = JSON.parse(localStorage.getItem('iqama-settings') || '{}'), d = document.documentElement, dim = +localStorage.getItem('iqama-dim') || 0;
  d.dataset.palette = s.look || (s.palette === 'contrast' ? 'contrast' : 'paper'); d.dataset.clock = s.clock || 'board';
  d.dataset.dim = String(dim); d.dataset.theme = dim >= 2 ? 'dark' : 'light'; } catch (e) {}
