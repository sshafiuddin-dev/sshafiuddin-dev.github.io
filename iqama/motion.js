// Motion for the Iqama app, on the self-hosted ../vendor/motion.min.js (Motion, MIT), the same bundle the portfolio uses.
// Every duration, distance and spring lives here; nothing else in the app writes its own numbers.
// It is an extra: with no bundle, or an error, the page simply does not animate. With "reduce motion" on, nothing moves
// or scales; the only thing left is a short fade.
const M = globalThis.Motion;

export const T = {
  dur: { instant: .08, fast: .18, normal: .35, slow: .6 },
  ease: [.22, 1, .36, 1],
  dist: { xs: 4, sm: 8, md: 16, lg: 24 },
  scale: { press: .95, pop: 1.3 },
  gap: .05, // seconds between list rows; the motion rules keep this between .05 and .10
  staggerMax: 14, // only the first screenful of a list animates in
  spring: { snappy: { bounce: .12, duration: .4 }, gentle: { bounce: .2, duration: .55 }, bouncy: { bounce: .5, duration: .6 } },
};
export const calm = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
export const spring = (name) => (M ? { type: M.spring, ...T.spring[name] } : { duration: T.dur.normal, ease: T.ease });
const stagger = () => (M ? M.stagger(T.gap) : 0);

// animate(el or [els], keyframes, options). Returns the Motion animation (it has a .finished promise), or null.
export function animate(target, keyframes, options = {}) {
  const none = !target || (target.length === 0);
  if (!M || none) return null;
  try {
    if (calm()) {
      if (!keyframes.opacity) return null;
      return M.animate(target, { opacity: keyframes.opacity }, { duration: T.dur.fast * .8 });
    }
    return M.animate(target, keyframes, options);
  } catch (e) { return null; }
}
export const done = (anim) => (anim && anim.finished ? Promise.resolve(anim.finished).catch(() => {}) : Promise.resolve());

// Named moves, so the same thing looks the same everywhere
export const rise = (el, dist = T.dist.md) => animate(el, { opacity: [0, 1], translate: [`0 ${dist}px`, '0 0'] }, spring('gentle'));
export const fade = (el) => animate(el, { opacity: [0, 1] }, { duration: T.dur.fast, ease: T.ease });
export const pop = (el) => animate(el, { scale: [1, T.scale.pop, 1] }, spring('bouncy'));
export const swap = (el) => animate(el, { scale: [T.scale.press, 1], opacity: [.4, 1] }, { duration: T.dur.fast, ease: T.ease });
export const rows = (els) => animate([...els].slice(0, T.staggerMax), { opacity: [0, 1], translate: [`0 ${T.dist.sm}px`, '0 0'] }, { duration: T.dur.normal, ease: T.ease, delay: stagger() });
export const sheetIn = (el) => animate(el, { opacity: [0, 1], translate: ['0 100%', '0 0'] }, spring('gentle'));
export const sheetOut = (el) => animate(el, { opacity: [1, 0], translate: ['0 0', '0 100%'] }, { duration: T.dur.fast, ease: T.ease });
// FLIP: read where things are, change the DOM, then call the returned function to glide them from the old place to the new
export function flip(els) {
  const before = new Map([...els].map(el => [el, el.getBoundingClientRect().top]));
  return () => {
    for (const [el, top] of before) {
      const dy = top - el.getBoundingClientRect().top;
      if (dy) animate(el, { translate: [`0 ${dy}px`, '0 0'] }, spring('snappy'));
    }
  };
}
