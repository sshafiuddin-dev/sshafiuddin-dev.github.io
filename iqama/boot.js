// Runs first, before the page paints. Kept out of index.html so the Content-Security-Policy can forbid inline scripts.
// The old github.io address forwards to the Cloudflare site
if (location.hostname.endsWith('.github.io')) location.replace('https://sshafiuddin.pages.dev' + location.pathname + location.search + location.hash);
// Apply the saved theme and clock style before first paint
try{var s=JSON.parse(localStorage.getItem('iqama-settings')||'{}'),d=document.documentElement,m=s.mode||'auto';d.dataset.palette=s.palette||'petrol';d.dataset.clock=s.clock||'board';d.dataset.theme=s.palette==='night'?'dark':m==='auto'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):m}catch(e){}
