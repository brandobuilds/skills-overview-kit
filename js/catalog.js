/* catalog.js — data-driven, searchable, filterable skill catalog.
 *
 * Reads window.__CATALOG__ (built at assemble time by build/assemble.mjs from
 * data/skills.json + data/catalog.json):
 *   {
 *     cats:   [{k, name, color}],            // ordered category definitions
 *     libs:   {gstack:{name,color}, ...},    // optional library badge colors
 *     skills: [{name, v, u, cat, d, lib, repo}],
 *     freshDays: 30,
 *     showLib: false,                         // render a library badge per card
 *     foundation: 'product-marketing'         // optional: lifted into a callout
 *   }
 *
 * Targets these elements (provided by the template):
 *   #catalog-tools  — search box is injected here
 *   #filters        — category chips
 *   #catalog        — grouped category sections
 *   #foundation-card (optional) — hidden while searching/filtering
 *   #pm-ver (optional) — foundation version pill text
 */
(function () {
  var CFG = window.__CATALOG__ || { cats: [], skills: [] };
  var CATS = CFG.cats || [];
  var LIBS = CFG.libs || {};
  var SKILLS = CFG.skills || [];
  var FRESH_DAYS = CFG.freshDays || 30;
  var SHOW_LIB = !!CFG.showLib;
  var FOUNDATION = CFG.foundation || null;

  var catalog = document.getElementById('catalog');
  var filters = document.getElementById('filters');
  var tools = document.getElementById('catalog-tools');
  var foundationCard = document.getElementById('foundation-card');
  if (!catalog || !filters) return;

  var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  function fmtDate(iso) {
    if (!iso) return '';
    var p = iso.split('-'); if (p.length !== 3) return iso;
    return MONTHS[parseInt(p[1], 10) - 1] + ' ' + parseInt(p[2], 10) + ', ' + p[0];
  }
  function isFresh(iso) {
    if (!iso) return false;
    var d = new Date(iso + 'T00:00:00Z'), now = new Date();
    return (now - d) / 86400000 <= FRESH_DAYS;
  }
  function catColor(k) {
    for (var i = 0; i < CATS.length; i++) if (CATS[i].k === k) return CATS[i].color;
    return 'var(--c-slate)';
  }
  function catName(k) {
    for (var i = 0; i < CATS.length; i++) if (CATS[i].k === k) return CATS[i].name;
    return 'More';
  }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  /* foundation version pill */
  if (FOUNDATION) {
    var pm = null;
    for (var i = 0; i < SKILLS.length; i++) if (SKILLS[i].name === FOUNDATION) { pm = SKILLS[i]; break; }
    var pmEl = document.getElementById('pm-ver');
    if (pm && pm.v && pmEl) pmEl.textContent = 'v' + pm.v;
  }

  /* group skills into known categories, unknowns into a "more" bucket */
  function grouped() {
    var g = {}; CATS.forEach(function (c) { g[c.k] = []; });
    var extra = [];
    SKILLS.forEach(function (s) {
      if (FOUNDATION && s.name === FOUNDATION) return;
      if (s.cat && g[s.cat]) g[s.cat].push(s); else extra.push(s);
    });
    Object.keys(g).forEach(function (k) { g[k].sort(byName); });
    extra.sort(byName);
    return { g: g, extra: extra };
  }
  function byName(a, b) { return a.name < b.name ? -1 : 1; }

  function cardHTML(s, color) {
    var fresh = isFresh(s.u);
    var lib = SHOW_LIB && s.lib && LIBS[s.lib];
    var hasLink = !!s.repo;
    var tag = hasLink ? 'a' : 'div';
    var attrs = hasLink ? ' href="' + esc(s.repo) + '" target="_blank" rel="noopener"' : '';
    return '<' + tag + ' class="skcard" ' + attrs + ' style="--cc:' + color + (lib ? ';--lc:' + lib.color : '') + '" ' +
      'data-name="' + esc(s.name) + '" data-d="' + esc((s.d || '').toLowerCase()) + '" data-cat="' + esc(s.cat || 'more') + '">' +
      (fresh ? '<span class="new-tag">UPDATED</span>' : '') +
      '<div class="top"><span class="nm">' + esc(s.name) + '</span>' +
        (s.v ? '<span class="vpill' + (fresh ? ' fresh' : '') + '">v' + esc(s.v) + '</span>' : '') + '</div>' +
      '<p>' + esc(s.d || '') + '</p>' +
      (s.u ? '<div class="upd">Updated ' + fmtDate(s.u) + '</div>' : '') +
      (lib ? '<div class="lib"><i></i>' + esc(lib.name) + '</div>' : '') +
      '</' + tag + '>';
  }

  /* ---- render search + filters + catalog ---- */
  var data = grouped();
  if (tools) {
    tools.innerHTML =
      '<div class="search" id="search-wrap">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>' +
        '<input id="catalog-search" type="search" autocomplete="off" placeholder="Search skills…" aria-label="Search skills">' +
        '<button class="clr" id="search-clear" aria-label="Clear search">×</button>' +
      '</div>';
  }

  var fhtml = '<button class="fchip active" data-cat="all" style="--fc:var(--accent)"><i style="background:var(--accent)"></i>All</button>';
  var html = '';
  CATS.forEach(function (c) {
    var items = data.g[c.k]; if (!items.length) return;
    fhtml += '<button class="fchip" data-cat="' + c.k + '" style="--fc:' + c.color + '"><i style="background:' + c.color + '"></i>' + esc(c.name) + ' ' + items.length + '</button>';
    html += '<div class="catsec reveal in" data-cat="' + c.k + '" style="--cc:' + c.color + '">' +
      '<div class="cathead"><i></i><h3>' + esc(c.name) + '</h3><span class="ct">' + items.length + '</span></div>' +
      '<div class="skgrid">' + items.map(function (s) { return cardHTML(s, c.color); }).join('') + '</div></div>';
  });
  if (data.extra.length) {
    fhtml += '<button class="fchip" data-cat="more" style="--fc:var(--c-slate)"><i style="background:var(--c-slate)"></i>More ' + data.extra.length + '</button>';
    html += '<div class="catsec reveal in" data-cat="more" style="--cc:var(--c-slate)">' +
      '<div class="cathead"><i></i><h3>More</h3><span class="ct">' + data.extra.length + '</span></div>' +
      '<div class="skgrid">' + data.extra.map(function (s) { return cardHTML(s, 'var(--c-slate)'); }).join('') + '</div></div>';
  }
  html += '<div class="catalog-empty" id="catalog-empty" style="display:none">No skills match <code id="empty-q"></code>. <button class="np-reset" id="empty-reset">Clear</button></div>';
  filters.innerHTML = fhtml;
  catalog.innerHTML = html;

  /* ---- filter + search state ---- */
  var state = { cat: 'all', q: '' };
  var input = document.getElementById('catalog-search');
  var clearBtn = document.getElementById('search-clear');
  var searchWrap = document.getElementById('search-wrap');
  var emptyEl = document.getElementById('catalog-empty');
  var emptyQ = document.getElementById('empty-q');

  function apply() {
    var q = state.q.trim().toLowerCase();
    var any = false;
    Array.prototype.forEach.call(catalog.querySelectorAll('.catsec'), function (sec) {
      var secCat = sec.getAttribute('data-cat');
      var visibleInSec = 0;
      Array.prototype.forEach.call(sec.querySelectorAll('.skcard'), function (card) {
        var matchCat = state.cat === 'all' || secCat === state.cat;
        var matchQ = !q || card.getAttribute('data-name').indexOf(q) !== -1 || card.getAttribute('data-d').indexOf(q) !== -1;
        var show = matchCat && matchQ;
        card.style.display = show ? '' : 'none';
        if (show) { visibleInSec++; any = true; }
      });
      sec.classList.toggle('hide', visibleInSec === 0);
    });
    if (foundationCard) foundationCard.style.display = (state.cat === 'all' && !q) ? '' : 'none';
    if (emptyEl) { emptyEl.style.display = any ? 'none' : ''; if (!any && emptyQ) emptyQ.textContent = q || catName(state.cat); }
  }

  Array.prototype.forEach.call(filters.querySelectorAll('.fchip'), function (b) {
    b.addEventListener('click', function () {
      state.cat = b.getAttribute('data-cat');
      Array.prototype.forEach.call(filters.querySelectorAll('.fchip'), function (x) { x.classList.toggle('active', x === b); });
      apply();
    });
  });
  if (input) {
    input.addEventListener('input', function () {
      state.q = input.value;
      if (searchWrap) searchWrap.classList.toggle('has-val', !!input.value);
      apply();
    });
  }
  if (clearBtn) clearBtn.addEventListener('click', function () {
    input.value = ''; state.q = ''; if (searchWrap) searchWrap.classList.remove('has-val'); input.focus(); apply();
  });
  var emptyReset = document.getElementById('empty-reset');
  if (emptyReset) emptyReset.addEventListener('click', function () {
    state.q = ''; state.cat = 'all'; if (input) input.value = '';
    if (searchWrap) searchWrap.classList.remove('has-val');
    Array.prototype.forEach.call(filters.querySelectorAll('.fchip'), function (x) { x.classList.toggle('active', x.getAttribute('data-cat') === 'all'); });
    apply();
  });
})();
