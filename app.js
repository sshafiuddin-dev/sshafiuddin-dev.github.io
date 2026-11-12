const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (id) => document.getElementById(id);

// Theme toggle (button names the theme it switches to)
const root = document.documentElement;
const themeBtn = $('theme-toggle');
const isDark = () => (root.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) === 'dark';
const labelTheme = () => { themeBtn.textContent = isDark() ? 'Light' : 'Dark'; };
labelTheme();
themeBtn.addEventListener('click', () => {
  const next = isDark() ? 'light' : 'dark';
  const apply = () => {
    root.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch (e) {}
    labelTheme();
  };
  (window.swapTheme || ((fn) => fn()))(apply, themeBtn); // motion.js adds the circular reveal when it can
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
const RULES = [ // duty pair, what holding both lets one person do, and how that goes wrong ({r} = the role)
  { duties: [0, 1], does: 'create a vendor and post its invoice', name: 'Fictitious invoice', sev: 'Medium', w: 2,
    steps: ['{r} sets up a new vendor record.', 'The same person posts an invoice against it.', 'The invoice waits in the queue like any other.', 'It needs only one more approval to become real money.'] },
  { duties: [0, 2], does: 'create a vendor and approve its payment', name: 'Ghost vendor', sev: 'High', w: 3,
    steps: ['{r} creates a vendor that does not exist.', 'An invoice for that vendor goes into the system.', '{r} also approves the payment, so nobody else sees it.', 'Money lands in an account they control. It surfaces months later, if at all.'] },
  { duties: [1, 2], does: 'post an invoice and approve its payment', name: 'Self-approved invoice', sev: 'High', w: 3,
    steps: ['{r} posts an inflated or duplicate invoice.', 'The same person approves it for payment.', 'No second reviewer ever looks at the amount.', 'The overpayment is booked as a normal expense.'] },
  { duties: [3, 4], does: 'change pay data and run the payroll', name: 'Ghost employee', sev: 'High', w: 3,
    steps: ['{r} adds a fake employee, or edits real bank details.', 'The same person runs the payroll.', 'The change is paid out before anyone reviews it.', 'Salary flows to the wrong account, cycle after cycle.'] },
  { duties: [5, 6], does: 'build a role and assign it', name: 'Self-granted access', sev: 'High', w: 3,
    steps: ['{r} designs a role with broad permissions.', 'The same person assigns it, possibly to themselves.', 'Every other control is now bypassable.', 'Audit logs show a legitimate admin doing admin work.'] },
];
const CONTROLS = [ // compensating controls and how much of the risk each removes
  { id: 'none', label: 'No control', cut: 0 },
  { id: 'dual', label: 'Dual approval', cut: 0.8 },
  { id: 'limit', label: 'System-enforced limit', cut: 0.7 },
  { id: 'review', label: 'Monthly review', cut: 0.5 },
];
const CLEAN = [[1], [0], [2], [3], [4], [5], [6]];
const MESSY = [[0, 1, 2], [0, 1], [1, 2], [3, 4], [3, 4], [5, 6], [5, 6]];
const SMALL = [[0, 1, 2], [0], [2], [3, 4], [4], [5, 6], [6]];
const SCENARIOS = { clean: CLEAN, small: SMALL, messy: MESSY };
const hits = (grants) => RULES.filter(({ duties: [a, b] }) => grants.has(a) && grants.has(b));
const countAll = (rows) => rows.reduce((sum, g) => sum + hits(new Set(g)).length, 0);
console.assert(countAll(CLEAN) === 0 && countAll(MESSY) === 9 && countAll(SMALL) === 5, 'SoD rule self-check failed');

const table = $('sod-table'), countEl = $('sod-count'), statusEl = $('sod-status'), reviewBtn = $('sod-review');
const barEl = $('sod-bar'), levelEl = $('sod-level'), findingEl = $('sod-finding'), chips = [...document.querySelectorAll('.sod-presets .chip')];
let state = (calm ? CLEAN : MESSY).map(g => new Set(g));
let scenario = calm ? 'clean' : 'messy', controls = {}, sel = 0, storyKey = null, storyStep = 0, storyTimer = 0;
let reviewing = false, note = '', focusAt = [0, 0];

table.innerHTML =
  `<thead><tr><td></td>${DUTIES.map(d => `<th scope="col"><span>${d}</span></th>`).join('')}</tr></thead><tbody>` +
  ROLES.map((r, i) => `<tr><th scope="row">${r}</th>${DUTIES.map((_, j) =>
    `<td><button class="cell" type="button" data-r="${i}" data-d="${j}"></button></td>`).join('')}</tr>`).join('') + '</tbody>';
const cells = [...table.querySelectorAll('.cell')];
const cellAt = (r, d) => cells[r * DUTIES.length + d];

// Every conflict in the matrix, in role order. A control turns an open conflict into a controlled one.
function allConflicts() {
  return state.flatMap((grants, r) => hits(grants).map(rule => {
    const k = `${r}:${RULES.indexOf(rule)}`, ctl = controls[k] || 'none';
    return { k, r, rule, ctl, controlled: ctl !== 'none' };
  }));
}
function pruneControls() { // a control belongs to a conflict; when the conflict goes, so does the control
  const live = new Set(allConflicts().map(c => c.k));
  Object.keys(controls).forEach(k => { if (!live.has(k)) delete controls[k]; });
}
const controlCut = (id) => CONTROLS.find(c => c.id === id).cut;
const sameAs = (rows) => state.every((g, i) => g.size === rows[i].length && rows[i].every(d => g.has(d)));

function render() {
  const cs = allConflicts(), open = cs.filter(c => !c.controlled), kept = cs.length - open.length;
  if (sel >= cs.length) sel = Math.max(0, cs.length - 1);
  if (!cs[sel] || cs[sel].k !== storyKey) storyKey = null;

  cells.forEach(c => {
    const r = +c.dataset.r, d = +c.dataset.d, on = state[r].has(d);
    const mine = cs.filter(x => x.r === r && x.rule.duties.includes(d));
    const bad = mine.some(x => !x.controlled), ctl = !bad && mine.length > 0;
    c.setAttribute('aria-pressed', on);
    c.classList.toggle('conflict', bad);
    c.classList.toggle('controlled', ctl);
    c.classList.toggle('sel', !!cs[sel] && cs[sel].r === r && cs[sel].rule.duties.includes(d)); // the finding panel's pair
    c.tabIndex = r === focusAt[0] && d === focusAt[1] ? 0 : -1;
    c.setAttribute('aria-label', `${ROLES[r]}: ${DUTIES[d]}${bad ? ', in conflict' : ctl ? ', conflict controlled' : ''}`);

    // A line joins the two duties of a conflict: solid when open, dashed when controlled
    const td = c.parentElement;
    const left = cs.filter(x => x.r === r && x.rule.duties[0] < d && d <= x.rule.duties[1]);
    const right = cs.filter(x => x.r === r && x.rule.duties[0] <= d && d < x.rule.duties[1]);
    td.classList.toggle('lk-l', left.length > 0);
    td.classList.toggle('lk-l-open', left.some(x => !x.controlled));
    td.classList.toggle('lk-r', right.length > 0);
    td.classList.toggle('lk-r-open', right.some(x => !x.controlled));
  });

  const score = cs.reduce((s, c) => s + c.rule.w * (1 - controlCut(c.ctl)), 0);
  countEl.textContent = `${open.length} conflict${open.length === 1 ? '' : 's'}${kept ? ` · ${kept} controlled` : ''}`;
  countEl.classList.toggle('has-risk', open.length > 0);
  barEl.style.width = `${Math.min(score / 12, 1) * 100}%`;
  barEl.classList.toggle('has-risk', score > 0);
  levelEl.textContent = score === 0 ? 'Low' : score <= 3 ? 'Moderate' : score <= 8 ? 'High' : 'Severe';
  chips.forEach(ch => ch.setAttribute('aria-pressed', ch.dataset.s === scenario));

  const first = open[0] && `${ROLES[open[0].r]} can ${open[0].rule.does}.`;
  statusEl.textContent = note ||
    (reviewing ? `Reviewing access. ${first || ''}` :
      open.length ? `${first}${kept ? ` ${kept} controlled.` : ''}` :
      kept ? `All ${kept} conflict${kept === 1 ? ' has' : 's have'} a compensating control.` :
      'No conflicts. Every duty has one owner.');
  renderFinding(cs);
}

// The finding panel: one conflict at a time, with its story and its controls
function renderFinding(cs) {
  const active = findingEl.contains(document.activeElement) ? document.activeElement.dataset.act : null;
  const c = cs[sel];
  if (!c) {
    findingEl.innerHTML = '<p class="finding-hint">Grant two duties to one role to see what a conflict looks like.</p>';
    return;
  }
  const role = ROLES[c.r], playing = storyKey === c.k, dis = reviewing ? ' disabled' : '';
  const revokeD = [...c.rule.duties].reverse().find(d => !CLEAN[c.r].includes(d)) ?? c.rule.duties[1];
  findingEl.innerHTML =
    `<div class="finding-top"><strong>${c.rule.name}</strong><span class="sev${c.rule.sev === 'Medium' ? ' sev-med' : ''}">${c.rule.sev}</span>` +
    `<span class="finding-n">${sel + 1} of ${cs.length}</span></div>` +
    `<p class="finding-who">${role} can ${c.rule.does}.</p>` +
    `<div class="finding-acts">` +
      `<button class="btn btn-small" type="button" data-act="story"${dis}>${playing ? 'Hide' : 'Play it out'}</button>` +
      `<select data-act="control" aria-label="Compensating control for ${c.rule.name}"${dis}>${CONTROLS.map(o =>
        `<option value="${o.id}"${o.id === c.ctl ? ' selected' : ''}>${o.label}</option>`).join('')}</select>` +
      `<button class="btn btn-small" type="button" data-act="revoke"${dis}>Revoke ${DUTIES[revokeD].toLowerCase()}</button>` +
      (cs.length > 1 ? `<button class="btn btn-small" type="button" data-act="next"${dis}>Next</button>` : '') +
    `</div>` +
    (playing ? `<ol class="story">${c.rule.steps.map((t, i) =>
      `<li class="${i < storyStep ? 'show' : ''}${i === 3 ? ' last' : ''}"><b>${i + 1}</b><span>${t.replace('{r}', role)}</span></li>`).join('')}</ol>` : '');
  if (active) { const el = findingEl.querySelector(`[data-act="${active}"]`); if (el) el.focus(); }
}

function playStory(c) {
  clearTimeout(storyTimer);
  if (storyKey === c.k) { storyKey = null; return render(); }
  storyKey = c.k; storyStep = calm ? 4 : 0;
  render();
  if (calm) return;
  (function tick() {
    if (storyKey !== c.k || storyStep >= 4) return;
    storyTimer = setTimeout(() => { storyStep++; renderFinding(allConflicts()); tick(); }, 650);
  })();
}

function touched() { // any hand edit: forget the scenario label and any review message
  scenario = null; note = ''; clearTimeout(storyTimer); pruneControls();
}

function load(name) {
  if (reviewing) return;
  state = SCENARIOS[name].map(g => new Set(g));
  scenario = name; controls = {}; sel = 0; note = ''; storyKey = null; clearTimeout(storyTimer);
  render();
}

// Access review: revoke what sits in an open conflict, restore each role's own duty, leave controlled conflicts alone
function review() {
  if (reviewing) return;
  clearTimeout(storyTimer); storyKey = null;
  const steps = [];
  let revoked = 0, restored = 0;
  state.forEach((grants, r) => {
    const open = new Set(hits(grants).filter(rule => !controls[`${r}:${RULES.indexOf(rule)}`]).flatMap(rule => rule.duties));
    grants.forEach(d => {
      if (!CLEAN[r].includes(d) && open.has(d)) steps.push([`Revoked ${DUTIES[d]} from ${ROLES[r]}`, () => { grants.delete(d); revoked++; }]);
    });
    CLEAN[r].forEach(d => {
      if (!grants.has(d)) steps.push([`Restored ${DUTIES[d]} to ${ROLES[r]}`, () => { grants.add(d); restored++; }]);
    });
  });
  const finish = () => {
    reviewing = reviewBtn.disabled = false;
    pruneControls();
    const kept = allConflicts().length;
    note = `Review complete. ${revoked} revoked, ${restored} restored${kept ? `, ${kept} kept under a control` : ''}.`;
    if (!kept && sameAs(CLEAN)) scenario = 'clean'; else scenario = null;
    render();
  };
  if (!steps.length) {
    const kept = allConflicts().length;
    note = `Review complete. Nothing to revoke${kept ? `, ${kept} kept under a control` : ''}.`;
    return render();
  }
  note = ''; reviewing = reviewBtn.disabled = true;
  render();
  steps.forEach(([text, run], k) => setTimeout(() => {
    run();
    note = `Reviewing access. ${text}.`;
    if (k === steps.length - 1) finish(); else render();
  }, calm ? 0 : 380 * (k + 1)));
}

table.addEventListener('click', (e) => {
  const c = e.target.closest('.cell');
  if (!c || reviewing) return;
  const r = +c.dataset.r, d = +c.dataset.d, grants = state[r];
  focusAt = [r, d];
  const before = new Set(allConflicts().map(x => x.k));
  grants.has(d) ? grants.delete(d) : grants.add(d);
  touched();
  const now = allConflicts(), fresh = now.findIndex(x => !before.has(x.k));
  if (fresh > -1) sel = fresh; // jump to the conflict you just created
  render();
});
table.addEventListener('keydown', (e) => { // arrow keys move between squares; Tab leaves the matrix
  const c = e.target.closest('.cell'), step = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
  if (!c || !step) return;
  e.preventDefault();
  const r = Math.min(ROLES.length - 1, Math.max(0, +c.dataset.r + step[0])), d = Math.min(DUTIES.length - 1, Math.max(0, +c.dataset.d + step[1]));
  focusAt = [r, d];
  render();
  cellAt(r, d).focus();
});
findingEl.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]'), cs = allConflicts(), c = cs[sel];
  if (!b || !c || reviewing) return;
  if (b.dataset.act === 'story') playStory(c);
  if (b.dataset.act === 'next') { sel = (sel + 1) % cs.length; clearTimeout(storyTimer); render(); }
  if (b.dataset.act === 'revoke') {
    const d = [...c.rule.duties].reverse().find(x => !CLEAN[c.r].includes(x)) ?? c.rule.duties[1];
    state[c.r].delete(d); touched(); render();
  }
});
findingEl.addEventListener('change', (e) => {
  const c = allConflicts()[sel];
  if (!c || e.target.dataset.act !== 'control') return;
  controls[c.k] = e.target.value; scenario = null; note = '';
  render();
});
document.querySelector('.sod-presets').addEventListener('click', (e) => {
  const b = e.target.closest('[data-s]');
  if (b) load(b.dataset.s);
});
reviewBtn.addEventListener('click', review);
render();
if (!calm) setTimeout(review, root.classList.contains('js-motion') ? 2400 : 1500); // let the hero entrance finish first

// Marquee: duplicate the list once so the loop is seamless
const marquee = $('marquee');
[...marquee.children].forEach(li => { const c = li.cloneNode(true); c.dataset.dup = ''; marquee.append(c); });

// Scroll-in entrances and the stat count-up live in motion.js (Motion). Without it, everything simply shows.

// Active nav link
const links = document.querySelectorAll('.nav-links a');
const spy = new IntersectionObserver((entries) => entries.forEach(en => {
  if (en.isIntersecting) links.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + en.target.id));
}), { rootMargin: '-30% 0px -60% 0px' });
document.querySelectorAll('section[id]').forEach(s => spy.observe(s));

// SAP-style command field: /nSM37 jumps to a section
// Each nav link carries its own data-tcode, so the box, its suggestion list and the tags beside the links can't drift apart
const TCODES = Object.fromEntries([...links].map(a => [a.dataset.tcode, a.getAttribute('href').slice(1)]));
$('tcodes').innerHTML = [...links].map(a => `<option value="/n${a.dataset.tcode}">${a.textContent}, ${a.title.split(': ')[1]}</option>`).join('');
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
  document.dispatchEvent(new CustomEvent('jump', { detail: id })); // motion.js sweeps the heading
}
tForm.addEventListener('submit', (e) => { e.preventDefault(); runTcode(); });
tInput.addEventListener('input', () => { // picking from the suggestion list jumps straight away
  if (TCODES[typedCode()]) runTcode(); else { tForm.classList.remove('bad'); tMsg.textContent = ''; }
});

// Project cards and the hero SoD card: glow follows the pointer
document.querySelectorAll('.project, .sod').forEach(p => p.addEventListener('pointermove', (e) => {
  const r = p.getBoundingClientRect();
  p.style.setProperty('--mx', `${e.clientX - r.left}px`);
  p.style.setProperty('--my', `${e.clientY - r.top}px`);
}));

// Current role: duration stays right without yearly edits
document.querySelectorAll('[data-since]').forEach(el => { el.textContent = `${new Date().getFullYear() - el.dataset.since} years`; });
