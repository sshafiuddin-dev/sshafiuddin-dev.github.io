// Iqama Times guide: the device picker in chapter 1, and the contents list kept open on wide screens.
// Kept out of the pages so the Content-Security-Policy can forbid inline scripts. Without it, the pages still work:
// the contents fold open on tap, and chapter 1 shows Android, Fire and iPad one after another.
(function () {
  var doc = document.documentElement;
  doc.className += ' js';

  // Contents: always open in the side column, folded above the chapter on small screens
  var toc = document.querySelector('.g-toc'), wide = window.matchMedia && window.matchMedia('(min-width: 60rem)');
  function fitToc() { if (toc && wide) toc.open = wide.matches; }
  fitToc();
  if (wide && wide.addEventListener) wide.addEventListener('change', fitToc);

  // Device picker: guess from the browser, remember the reader's choice on this device
  var tabs = document.querySelectorAll('.g-tabs [role="tab"]');
  if (!tabs.length) return;
  var KEY = 'iqama-guide-device', ua = navigator.userAgent || '', saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) {}
  var isIpad = /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  var guess = saved || (/Silk|KF[A-Z]{2,4}\b/.test(ua) ? 'fire' : isIpad || /iPhone/.test(ua) ? 'ipad' : 'android');

  function show(name, focus) {
    for (var i = 0; i < tabs.length; i++) {
      var t = tabs[i], on = t.getAttribute('data-device') === name, panel = document.getElementById(t.getAttribute('aria-controls'));
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      if (panel) panel.hidden = !on;
      if (on && focus) t.focus();
    }
  }
  for (var i = 0; i < tabs.length; i++) {
    tabs[i].addEventListener('click', function () {
      var name = this.getAttribute('data-device');
      try { localStorage.setItem(KEY, name); } catch (e) {}
      show(name);
    });
    tabs[i].addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      var list = Array.prototype.slice.call(tabs), n = list.indexOf(this) + (e.key === 'ArrowRight' ? 1 : -1);
      show(list[(n + list.length) % list.length].getAttribute('data-device'), true);
      e.preventDefault();
    });
  }
  show(guess);
})();
