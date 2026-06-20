#!/usr/bin/env node
/**
 * assemble.mjs — the single writer of a site's index.html.
 *
 *   node kit/build/assemble.mjs [siteDir]   (siteDir defaults to cwd)
 *
 * Reads the shared kit (theme.css + js/*.js, resolved relative to THIS file)
 * plus the site's own template.html, site.json, version.json, and data/*.json,
 * and emits a fully self-contained index.html — all CSS and JS inlined, no
 * runtime dependency beyond Google Fonts. The deployed artifact stays a single
 * static file (Vercel serves it raw); only the source is shared.
 *
 * Template directives:
 *   {{KEY}}                 — token from the merged context (site + version + derived)
 *   <!--@head-theme-->      — no-flash theme boot script (sets data-theme before paint)
 *   <!--@style-->           — <style> with theme.css + per-site brand overrides
 *   <!--@component:nav-->   — nav / footer / family / overlap / recipes (data-driven)
 *   <!--@component:footer-->
 *   <!--@component:family-->
 *   <!--@component:overlap-->
 *   <!--@component:recipes-->
 *   <!--@scripts-->         — data globals + selected kit JS modules, inlined
 *
 * Pure Node (fs/path only). No dependencies.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KIT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.resolve(process.argv[2] || process.cwd());

const readJSON = (p, fallback) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : fallback);
const readText = (p) => fs.readFileSync(p, 'utf8');
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const site = readJSON(path.join(SITE, 'site.json'), null);
if (!site) { console.error(`No site.json in ${SITE}`); process.exit(1); }
const version = readJSON(path.join(SITE, 'version.json'), {});
const dataDir = path.join(SITE, 'data');
const catalogMeta = readJSON(path.join(dataDir, 'catalog.json'), null);
const skillsRaw = readJSON(path.join(dataDir, 'skills.json'), null);
const engine = readJSON(path.join(dataDir, 'engine.json'), null);
const overlaps = readJSON(path.join(dataDir, 'overlaps.json'), null);
const recipes = readJSON(path.join(dataDir, 'recipes.json'), null);

/* ---------- context / token substitution ---------- */
const ver = version.version ? String(version.version) : (site.version || '');
const ctx = {
  NAME: site.name || '',
  BRANDMARK: site.brandMark || '◆',
  TITLE: site.title || site.name || '',
  META_DESC: site.metaDescription || '',
  VERSION: ver,
  VERSION_PILL: ver ? 'v' + ver : '',
  UPDATED: version.updated || '',
  CHECKED: version.checked || '',
  COUNT: version.count != null ? String(version.count) : (site.count != null ? String(site.count) : ''),
  HEADLINE: version.headline || site.headline || `${site.name} ${ver ? 'v' + ver : ''}`.trim(),
  WHATSNEW_HREF: site.whatsNewHref || (site.repo ? site.repo.url : '#'),
  WHATSNEW_ARROW: site.whatsNewArrow || 'changelog →',
  REPO_URL: site.repo ? site.repo.url : '#',
  REPO_LABEL: site.repo ? site.repo.label : '',
  DOMAIN: site.domain || '',
  YEAR: String(new Date().getFullYear()),
};
// Nav/footer pill: a version when there is one, else a skill count (version-less sites).
ctx.NAVPILL = site.navPill || ctx.VERSION_PILL || (ctx.COUNT ? `${ctx.COUNT} skills` : '');
const subst = (s) => s.replace(/\{\{([A-Z0-9_]+)\}\}/g, (m, k) => (k in ctx ? ctx[k] : m));

/* ---------- <style>: theme.css + brand overrides ---------- */
function styleBlock() {
  const theme = readText(path.join(KIT, 'theme.css'));
  const b = site.brand || {};
  const ov = [
    b.accent && `--accent:${b.accent}`,
    b.accentSoft && `--accent-soft:${b.accentSoft}`,
    b.accentLine && `--accent-line:${b.accentLine}`,
    b.accentPillBg && `--accent-pill-bg:${b.accentPillBg}`,
    b.accentPillLine && `--accent-pill-line:${b.accentPillLine}`,
  ].filter(Boolean).join(';');
  const ovLight = b.accentPillBgLight || b.accentPillLineLight
    ? `[data-theme="light"]{${[b.accentPillBgLight && `--accent-pill-bg:${b.accentPillBgLight}`, b.accentPillLineLight && `--accent-pill-line:${b.accentPillLineLight}`].filter(Boolean).join(';')}}`
    : '';
  return `<style>\n${theme}\n${ov ? `:root{${ov}}` : ''}${ovLight}\n</style>`;
}

/* ---------- favicon: brand accent + mark, inlined as a data URI ---------- */
function faviconLink() {
  const accent = (site.brand && site.brand.accent) || '#6ea8ff';
  const mark = ctx.BRANDMARK || '◆';
  const fs = mark.length <= 1 ? 18 : mark.length === 2 ? 14 : 11;
  const y = Math.round(16 + fs * 0.34);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="${accent}"/>` +
    `<text x="16" y="${y}" font-family="ui-monospace,SFMono-Regular,Menlo,monospace" font-size="${fs}" font-weight="800" text-anchor="middle" fill="#0a0e16">${esc(mark)}</text></svg>`;
  const b64 = Buffer.from(svg, 'utf8').toString('base64');
  return `<link rel="icon" href="data:image/svg+xml;base64,${b64}">`;
}

/* ---------- no-flash theme boot ---------- */
function headTheme() {
  return `<script>document.documentElement.classList.remove('no-js');document.documentElement.classList.add('js');` +
    `(function(){try{var t=localStorage.getItem('skills-theme');if(!t&&window.matchMedia&&matchMedia('(prefers-color-scheme: light)').matches)t='light';if(t==='light')document.documentElement.setAttribute('data-theme','light');}catch(e){}})();</script>` +
    faviconLink();
}

/* ---------- nav ---------- */
function navComponent() {
  const links = (site.navLinks || []).map((l) =>
    `<a href="${esc(l.href)}"${l.hot ? ' class="hot"' : ''}>${esc(l.label)}</a>`).join('\n      ');
  const toggle = `<button class="theme-toggle" id="theme-toggle" type="button" aria-label="Toggle theme">` +
    `<svg class="i-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>` +
    `<svg class="i-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 1.5v2.5M12 20v2.5M4.2 4.2l1.8 1.8M18 18l1.8 1.8M1.5 12h2.5M20 12h2.5M4.2 19.8 6 18M18 6l1.8-1.8"/></svg>` +
    `</button>`;
  return `<nav class="nav">
  <div class="nav-inner">
    <div class="brand"><span class="mk">${esc(ctx.BRANDMARK)}</span> ${esc(ctx.NAME)}</div>
    <div class="nav-links">
      ${links}
    </div>
    <span class="pill-ver"><!--VER-->${esc(ctx.NAVPILL)}<!--/VER--></span>
    ${toggle}
  </div>
</nav>`;
}

/* ---------- family strip ---------- */
function familyComponent() {
  const sibs = site.siblings || [];
  if (!sibs.length) return '';
  const cards = sibs.map((s) => {
    const current = s.id === site.id;
    return `<a class="famcard${current ? ' current' : ''}" href="${esc(s.url)}"${current ? ' aria-current="page"' : ''} style="--fc:${s.color || 'var(--accent)'}">
      <div class="fn">${esc(s.name)}${current ? '<span class="badge">you are here</span>' : ''}</div>
      <p>${esc(s.blurb || '')}</p>
      <div class="go">${current ? 'this site' : esc(s.domain || 'open →')}</div>
    </a>`;
  }).join('\n    ');
  return `<div class="family">\n    ${cards}\n  </div>`;
}

/* ---------- overlap / routing map ---------- */
function overlapComponent() {
  if (!overlaps || !overlaps.length) return '';
  return `<div class="ovmap">\n` + overlaps.map((o) => {
    const pair = (o.items || []).map((it) => `<code>${esc(it)}</code>`).join(`<span class="vs">${esc(o.sep || 'vs')}</span>`);
    return `    <div class="ovrow" style="--oc:${o.color || 'var(--accent)'}">
      <span class="ovkind">${esc(o.kind || 'overlap')}</span>
      <div class="ovpair">${pair}${o.pick ? `<span class="vs">use</span><span class="ovpick">${esc(o.pick)}</span>` : ''}</div>
      <p>${o.note || ''}</p>
    </div>`;
  }).join('\n') + `\n  </div>`;
}

/* ---------- recipes ---------- */
function recipesComponent() {
  if (!recipes || !recipes.length) return '';
  return `<div class="recipes">\n` + recipes.map((r) => {
    const chain = (r.chain || []).map((c) => `<code>${esc(c)}</code>`).join('<span class="arr">→</span>');
    return `    <div class="recipe reveal">
      <h4>${esc(r.title)}</h4>
      <p>${esc(r.when || '')}</p>
      <div class="chain">${chain}</div>
    </div>`;
  }).join('\n') + `\n  </div>`;
}

/* ---------- footer ---------- */
function footerComponent() {
  return `<footer class="foot">
  <div class="wrap">
    <div class="big grad">${esc(site.footerBig || 'Skills, as a system.')}</div>
    <p>${site.footerNote || ''}</p>
    <div class="meta">${esc(ctx.NAME)}${ctx.VERSION_PILL ? ` <!--VER-->${esc(ctx.VERSION_PILL)}<!--/VER-->` : ''} · ${esc(site.license || 'MIT')} · <a href="${esc(ctx.REPO_URL)}" target="_blank" rel="noopener">${esc(ctx.REPO_LABEL)}</a></div>
    <div class="meta" style="margin-top:8px;opacity:.85">Updated <!--UPD-->${esc(ctx.UPDATED)}<!--/UPD--> · Checked <!--CHK-->${esc(ctx.CHECKED)}<!--/CHK-->${site.autoNote ? ' · ' + esc(site.autoNote) : ''}</div>
  </div>
</footer>`;
}

/* ---------- catalog data: merge live versions with hand-authored meta ---------- */
function buildCatalog() {
  if (!catalogMeta) return null;
  const repoBase = catalogMeta.repoBase || '';
  const meta = catalogMeta.meta || {};
  let records = [];
  if (Array.isArray(skillsRaw)) {
    // full records already (my-skills scan)
    records = skillsRaw.map((s) => ({
      name: s.name, v: s.v || '', u: s.u || '',
      cat: s.cat || (meta[s.name] && meta[s.name].c) || '',
      d: s.d || (meta[s.name] && meta[s.name].d) || '',
      lib: s.lib || '',
      repo: s.repo || (repoBase ? repoBase + s.name : ''),
    }));
  } else if (skillsRaw && typeof skillsRaw === 'object') {
    // { name: {v,u} } live versions → merge with meta
    const seen = {};
    Object.keys(skillsRaw).forEach((name) => {
      seen[name] = true;
      const m = meta[name] || {};
      records.push({ name, v: skillsRaw[name].v || '', u: skillsRaw[name].u || '', cat: m.c || '', d: m.d || '', lib: m.lib || '', repo: repoBase ? repoBase + name : '' });
    });
    // meta-only skills missing from the live table still render (graceful, versionless)
    Object.keys(meta).forEach((name) => {
      if (seen[name]) return;
      const m = meta[name];
      records.push({ name, v: '', u: '', cat: m.c || '', d: m.d || '', lib: m.lib || '', repo: repoBase ? repoBase + name : '' });
    });
  } else if (meta && Object.keys(meta).length) {
    records = Object.keys(meta).map((name) => ({ name, v: '', u: '', cat: meta[name].c || '', d: meta[name].d || '', lib: meta[name].lib || '', repo: repoBase ? repoBase + name : '' }));
  }
  return {
    cats: catalogMeta.cats || [],
    libs: catalogMeta.libs || {},
    skills: records,
    freshDays: catalogMeta.freshDays || 30,
    showLib: !!catalogMeta.showLib,
    foundation: catalogMeta.foundation || null,
  };
}

/* ---------- scripts: data globals + selected kit modules ---------- */
function scriptsBlock() {
  const modules = site.modules || [];
  const globals = {};
  if (modules.includes('catalog')) { const c = buildCatalog(); if (c) globals.__CATALOG__ = c; }
  if (modules.includes('engine') && engine) globals.__ENGINE__ = engine;
  globals.__SITE__ = { id: site.id, name: site.name };

  const dataScript = `<script>` + Object.keys(globals).map((k) => `window.${k}=${JSON.stringify(globals[k])};`).join('') + `</script>`;

  // theme-toggle + reveal always; catalog/engine per modules
  const wanted = ['theme-toggle'];
  if (modules.includes('catalog')) wanted.push('catalog');
  if (modules.includes('engine')) wanted.push('engine');
  wanted.push('reveal'); // reveal last so it observes everything
  const inlined = wanted.map((m) => {
    const p = path.join(KIT, 'js', m + '.js');
    return fs.existsSync(p) ? `<script>\n${readText(p)}\n</script>` : '';
  }).filter(Boolean).join('\n');
  return dataScript + '\n' + inlined;
}

/* ---------- assemble ---------- */
const COMPONENTS = {
  nav: navComponent, footer: footerComponent, family: familyComponent,
  overlap: overlapComponent, recipes: recipesComponent,
};

let html = readText(path.join(SITE, 'template.html'));
html = html
  .replace('<!--@head-theme-->', headTheme())
  .replace('<!--@style-->', styleBlock())
  .replace(/<!--@component:([a-z]+)-->/g, (m, name) => (COMPONENTS[name] ? COMPONENTS[name]() : m))
  .replace('<!--@scripts-->', scriptsBlock());
html = subst(html);

fs.writeFileSync(path.join(SITE, 'index.html'), html);
const stats = fs.statSync(path.join(SITE, 'index.html'));
console.log(`assembled ${site.id} → index.html (${(stats.size / 1024).toFixed(1)} KB)` +
  (ctx.VERSION ? ` · v${ctx.VERSION}` : '') + (ctx.COUNT ? ` · ${ctx.COUNT} skills` : ''));
