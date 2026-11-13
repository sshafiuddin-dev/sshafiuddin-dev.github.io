// Runs first, before the page paints. Kept out of index.html so the Content-Security-Policy can forbid inline scripts.
// The old github.io address forwards to the Cloudflare site
if (location.hostname.endsWith('.github.io')) location.replace('https://sshafiuddin.pages.dev' + location.pathname + location.search + location.hash);
// Saved theme and motion choice, applied before first paint
try { var t = localStorage.getItem('theme'); if (t) document.documentElement.dataset.theme = t; if (localStorage.getItem('motion') === 'off') document.documentElement.dataset.motion = 'off'; } catch (e) {}
// Hides the entrance targets until motion.js takes over; the timer shows everything if it never does
if (!matchMedia('(prefers-reduced-motion: reduce)').matches) { document.documentElement.classList.add('js-motion'); setTimeout(function () { document.documentElement.classList.remove('js-motion'); }, 4000); }
