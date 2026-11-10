// Weather backdrop. <html data-sky data-night> picks the tint in styles.css; this draws the moving layer on one canvas.
const canvas = document.getElementById('sky'), ctx = canvas.getContext('2d'), root = document.documentElement;
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
const COUNTS = { rain: 80, storm: 150, snow: 70, stars: 80, cloudy: 6, overcast: 9, fog: 6 };
const rand = (a, b) => a + Math.random() * (b - a);
let layer = '', parts = [], raf = 0, frames = 0, colors = {};

export function setSky(kind, isDay) {
  if (root.dataset.sky !== kind) root.dataset.sky = kind;
  root.toggleAttribute('data-night', !isDay);
  const next = kind === 'clear' ? (isDay ? 'sun' : 'stars') : kind;
  if (next === layer) return;
  layer = next;
  seed();
  draw();
}

function seed() {
  parts = Array.from({ length: COUNTS[layer] || 0 }, () => ({ x: rand(0, innerWidth), y: rand(0, innerHeight), s: rand(.6, 1), p: rand(0, 6.28) }));
}
function size() {
  const d = devicePixelRatio || 1;
  canvas.width = innerWidth * d;
  canvas.height = innerHeight * d;
}
addEventListener('resize', () => { size(); seed(); draw(); });
size();

// Particle colours are "r,g,b,a" tokens in styles.css so both themes stay readable
const rgba = (name, k = 1) => { const [r, g, b, a] = colors[name] || [0, 0, 0, 0]; return `rgba(${r},${g},${b},${a * k})`; };

function draw() {
  cancelAnimationFrame(raf);
  raf = 0;
  if (frames++ % 60 === 0) for (const n of ['rain', 'flake', 'cloud', 'star', 'sun']) colors[n] = getComputedStyle(root).getPropertyValue(`--sky-${n}`).split(',').map(Number);
  const d = devicePixelRatio || 1, W = innerWidth, H = innerHeight;
  ctx.setTransform(d, 0, 0, d, 0, 0);
  ctx.clearRect(0, 0, W, H);

  if (layer === 'rain' || layer === 'storm') {
    const v = layer === 'storm' ? 15 : 10;
    ctx.strokeStyle = rgba('rain');
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (const q of parts) {
      ctx.moveTo(q.x, q.y);
      ctx.lineTo(q.x - 4 * q.s, q.y + 16 * q.s);
      q.y += v * q.s;
      q.x -= v * q.s / 4;
      if (q.y > H) { q.y = -20; q.x = rand(0, W + 100); }
    }
    ctx.stroke();
  } else if (layer === 'snow') {
    ctx.fillStyle = rgba('flake');
    ctx.beginPath();
    for (const q of parts) {
      q.p += .02;
      q.y += q.s;
      q.x += Math.sin(q.p) * .5;
      if (q.y > H + 5) { q.y = -5; q.x = rand(0, W); }
      ctx.moveTo(q.x + 2.5 * q.s, q.y);
      ctx.arc(q.x, q.y, 2.5 * q.s, 0, 6.283);
    }
    ctx.fill();
  } else if (layer === 'stars') {
    for (const q of parts) {
      q.p += .03;
      ctx.fillStyle = rgba('star', q.s * (.4 + .6 * Math.abs(Math.sin(q.p))));
      ctx.fillRect(q.x, q.y * .6, 1.6, 1.6);
    }
  } else if (layer === 'sun') {
    const g = ctx.createRadialGradient(W * .85, 0, 0, W * .85, 0, Math.max(W, H) * .6);
    g.addColorStop(0, rgba('sun'));
    g.addColorStop(1, rgba('sun', 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  } else if (parts.length) { // cloudy, overcast, fog: soft drifting blobs
    for (const q of parts) {
      q.x += .2 * q.s;
      if (q.x > W + 300) q.x = -300;
      const r = (layer === 'fog' ? 340 : 220) * q.s, y = layer === 'fog' ? H * .25 + q.y * .5 : q.y * .4;
      const g = ctx.createRadialGradient(q.x, y, 0, q.x, y, r);
      g.addColorStop(0, rgba('cloud', layer === 'overcast' ? 1.2 : 1));
      g.addColorStop(1, rgba('cloud', 0));
      ctx.fillStyle = g;
      ctx.fillRect(q.x - r, y - r, 2 * r, 2 * r);
    }
  }
  if (!calm && parts.length) raf = requestAnimationFrame(draw);
}
