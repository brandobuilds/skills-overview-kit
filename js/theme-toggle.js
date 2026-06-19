/* theme-toggle.js — light/dark toggle wired to the nav button.
 * The no-flash boot script (in <head>) has already set data-theme before paint;
 * this just handles the click + persistence. */
(function () {
  var KEY = 'skills-theme';
  var btn = document.getElementById('theme-toggle');
  if (!btn) return;
  function current() {
    return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  }
  function apply(theme) {
    if (theme === 'light') document.documentElement.setAttribute('data-theme', 'light');
    else document.documentElement.removeAttribute('data-theme');
    btn.setAttribute('aria-label', theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme');
    btn.setAttribute('aria-pressed', String(theme === 'light'));
  }
  btn.addEventListener('click', function () {
    var next = current() === 'light' ? 'dark' : 'light';
    try { localStorage.setItem(KEY, next); } catch (e) {}
    apply(next);
  });
  apply(current());
  // Follow the OS only when the user hasn't chosen explicitly.
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: light)');
    var onChange = function (e) {
      var stored;
      try { stored = localStorage.getItem(KEY); } catch (err) {}
      if (!stored) apply(e.matches ? 'light' : 'dark');
    };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }
})();
