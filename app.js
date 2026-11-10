const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (id) => document.getElementById(id);

// Theme toggle (button names the theme it switches to)
const root = document.documentElement;
const themeBtn = $('theme-toggle');
const isDark = () => (root.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) === 'dark';
const labelTheme = () => { themeBtn.textContent = isDark() ? 'Light' : 'Dark'; };
labelTheme();
themeBtn.addEventListener('click', () => {
  root.dataset.theme = isDark() ? 'light' : 'dark';
  try { localStorage.setItem('theme', root.dataset.theme); } catch (e) {}
  labelTheme();
});

// Hero name: one span per letter so they can rise in sequence
const h1 = $('hero-name');
const name = h1.textContent;
h1.setAttribute('aria-label', name);
let n = 0;
h1.innerHTML = name.split(' ').map(w =>
  `<span class="word" aria-hidden="true">${[...w].map(c => `<span class="ch" style="--i:${n++}">${c}</span>`).join('')}</span>`
).join(' ');

// Segregation-of-duties matrix
const ROLES = ['AP clerk', 'Vendor maintainer', 'Payment approver', 'Payroll admin', 'Payroll processor', 'Role designer', 'Security admin'];
const DUTIES = ['Create vendor', 'Post invoice', 'Approve payment', 'Change pay data', 'Run payroll', 'Build role', 'Assign role'];
const RULES = [ // [duty, duty, what holding both lets one person do]
  [0, 1, 'create a vendor and post its invoice'],
  [0, 2, 'create a vendor and approve its payment'],
  [1, 2, 'post an invoice and approve its payment'],
  [3, 4, 'change pay data and run the payroll'],
  [5, 6, 'build a role and assign it'],
];
const CLEAN = [[1], [0], [2], [3], [4], [5], [6]];
const MESSY = [[0, 1, 2], [0, 1], [1, 2], [3, 4], [3, 4], [5, 6], [5, 6]];
const conflictsIn = (grants) => RULES.filter(([a, b]) => grants.has(a) && grants.has(b));
const countAll = (rows) => rows.reduce((sum, g) => sum + conflictsIn(new Set(g)).length, 0);
console.assert(countAll(CLEAN) === 0 && countAll(MESSY) === 9, 'SoD rule self-check failed');

const table = $('sod-table'), countEl = $('sod-count'), statusEl = $('sod-status'), reviewBtn = $('sod-review');
let state = (calm ? CLEAN : MESSY).map(g => new Set(g));
let reviewing = false;

table.innerHTML =
  `<thead><tr><td></td>${DUTIES.map(d => `<th scope="col"><span>${d}</span></th>`).join('')}</tr></thead><tbody>` +
  ROLES.map((r, i) => `<tr><th scope="row">${r}</th>${DUTIES.map((_, j) =>
    `<td><button class="cell" type="button" data-r="${i}" data-d="${j}"></button></td>`).join('')}</tr>`).join('') + '</tbody>';
const cells = [...table.querySelectorAll('.cell')];

function render() {
  let total = 0, first = '';
  const hot = state.map((grants, i) => {
    const hits = conflictsIn(grants);
    total += hits.length;
    if (hits.length && !first) first = `${ROLES[i]} can ${hits[0][2]}.`;
    return new Set(hits.flatMap(([a, b]) => [a, b]));
  });
  cells.forEach(c => {
    const r = +c.dataset.r, d = +c.dataset.d, on = state[r].has(d), bad = hot[r].has(d);
    c.setAttribute('aria-pressed', on);
    c.classList.toggle('conflict', bad);
    c.setAttribute('aria-label', `${ROLES[r]}: ${DUTIES[d]}${bad ? ', in conflict' : ''}`);
  });
  countEl.textContent = `${total} conflict${total === 1 ? '' : 's'}`;
  countEl.classList.toggle('has-risk', total > 0);
  statusEl.textContent = reviewing ? `Reviewing access. ${first}` : (first || 'No conflicts. Every duty has one owner.');
}

function review() {
  if (reviewing) return;
  const steps = [];
  state.forEach((grants, r) => {
    grants.forEach(d => { if (!CLEAN[r].includes(d)) steps.push(() => grants.delete(d)); });
    CLEAN[r].forEach(d => { if (!grants.has(d)) steps.push(() => grants.add(d)); });
  });
  if (!steps.length) return;
  reviewing = reviewBtn.disabled = true;
  render();
  steps.forEach((step, k) => setTimeout(() => {
    step();
    if (k === steps.length - 1) reviewing = reviewBtn.disabled = false;
    render();
  }, calm ? 0 : 380 * (k + 1)));
}

table.addEventListener('click', (e) => {
  const c = e.target.closest('.cell');
  if (!c || reviewing) return;
  const grants = state[+c.dataset.r], d = +c.dataset.d;
  grants.has(d) ? grants.delete(d) : grants.add(d);
  render();
});
reviewBtn.addEventListener('click', review);
render();
if (!calm) setTimeout(review, 1500);

// Marquee: duplicate the list once so the loop is seamless
const marquee = $('marquee');
[...marquee.children].forEach(li => { const c = li.cloneNode(true); c.dataset.dup = ''; marquee.append(c); });

// Scroll-in entrances and stat count-up
document.querySelectorAll('.grants, .job-log').forEach(ul => [...ul.children].forEach((li, i) => li.style.setProperty('--i', i)));
const io = new IntersectionObserver((entries) => entries.forEach(en => {
  if (!en.isIntersecting) return;
  io.unobserve(en.target);
  if (en.target.dataset.count) countUp(en.target); else en.target.classList.add('in');
}), { threshold: 0.2 });
document.querySelectorAll('[data-reveal], [data-count]').forEach(el => io.observe(el));

function countUp(el) {
  if (calm) return;
  const end = +el.dataset.count, t0 = performance.now();
  (function tick(now) {
    const p = Math.min((now - t0) / 1400, 1);
    el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3))).toLocaleString('en-US');
    if (p < 1) requestAnimationFrame(tick);
  })(t0);
}

// Active nav link
const links = document.querySelectorAll('.nav-links a');
const spy = new IntersectionObserver((entries) => entries.forEach(en => {
  if (en.isIntersecting) links.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + en.target.id));
}), { rootMargin: '-30% 0px -60% 0px' });
document.querySelectorAll('section[id]').forEach(s => spy.observe(s));

// SAP-style command field: /nSM37 jumps to a section
const TCODES = { SU01: 'about', PFCG: 'skills', SM37: 'timeline', SE80: 'projects', SO01: 'contact' };
const tForm = $('tcode-form'), tInput = $('tcode'), tMsg = $('tcode-msg');
const typedCode = () => tInput.value.trim().toUpperCase().replace(/^\/[NO]/, '');
function runTcode() {
  const code = typedCode(), id = TCODES[code];
  tForm.classList.toggle('bad', !!code && !id);
  tMsg.textContent = code && !id ? `Transaction ${code} does not exist` : '';
  if (!id) return;
  tInput.value = '';
  tInput.blur();
  $(id).scrollIntoView();
}
tForm.addEventListener('submit', (e) => { e.preventDefault(); runTcode(); });
tInput.addEventListener('input', () => { // picking from the suggestion list jumps straight away
  if (TCODES[typedCode()]) runTcode(); else { tForm.classList.remove('bad'); tMsg.textContent = ''; }
});

// Project cards: glow follows the pointer
document.querySelectorAll('.project').forEach(p => p.addEventListener('pointermove', (e) => {
  const r = p.getBoundingClientRect();
  p.style.setProperty('--mx', `${e.clientX - r.left}px`);
  p.style.setProperty('--my', `${e.clientY - r.top}px`);
}));

// Current role: duration stays right without yearly edits
document.querySelectorAll('[data-since]').forEach(el => { el.textContent = `${new Date().getFullYear() - el.dataset.since} years`; });
