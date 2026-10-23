// Archivos Antuan: gestor de archivos. Lateral de lugares, migas, cuadricula/lista,
// seleccion multiple, arrastrar y soltar, menu de cristal y Vista rapida con espacio.
(async () => {
'use strict';
const U = window.umbra;
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const A = (n, ...a) => U.ask(n, ...a).catch((e) => ({ error: e.message || String(e) }));
const root = document.documentElement;

/* ---------------- Iconos propios ---------------- */
Object.assign(window.ICONS, {
  back: '<path d="m15 18-6-6 6-6"/>', fwd: '<path d="m9 18 6-6-6-6"/>', upd: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  chev: '<path d="m9 6 6 6-6 6"/>', chevd: '<path d="m6 9 6 6 6-6"/>',
  tiles: '<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>',
  rows: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r=".9" fill="currentColor"/><circle cx="4" cy="12" r=".9" fill="currentColor"/><circle cx="4" cy="18" r=".9" fill="currentColor"/>',
  panel: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M15 4v16"/>',
  desktop: '<rect x="3" y="4" width="18" height="12" rx="2.5"/><path d="M8 20h8M12 16v4"/>',
  doc: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h6"/>',
  video: '<rect x="3" y="5" width="13" height="14" rx="3"/><path d="m16 10 5-3v10l-5-3"/>',
  drive: '<rect x="3" y="13" width="18" height="7" rx="2.5"/><path d="M5 13 7.5 5.5A2 2 0 0 1 9.4 4h5.2a2 2 0 0 1 1.9 1.5L19 13M7 16.5h.01M10 16.5h.01"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
  copy: '<rect x="8" y="8" width="13" height="13" rx="3"/><path d="M16 8V6a3 3 0 0 0-3-3H6a3 3 0 0 0-3 3v7a3 3 0 0 0 3 3h2"/>',
  cut: '<circle cx="6" cy="18" r="3"/><circle cx="18" cy="18" r="3"/><path d="M8.2 15.8 20 4M15.8 15.8 4 4"/>',
  paste: '<rect x="5" y="4" width="14" height="17" rx="3"/><path d="M9 4V3h6v1M9 11h6M9 15h4"/>',
  pencil: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  reveal: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M19 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  fplus: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M12 10v6M9 13h6"/>',
  open: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.7L20 8"/><path d="M20 3v5h-5"/>',
  zip: '<path d="M10 3v2M14 5v2M10 7v2M14 9v2M10 11v2"/><rect x="9" y="14" width="6" height="5" rx="1.5"/>',
  app: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M9 12h6M12 9v6"/>',
  sheet: '<rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="M4 10h16M4 15h16M10 4v16"/>',
  slide: '<rect x="3" y="5" width="18" height="12" rx="2.5"/><path d="M12 17v3M8 21h8"/>',
  eyeoff: '<path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.6 9.6 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  look: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5M8 11h6M11 8v6"/>',
  warn: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/>'
});

/* ---------------- Aspecto (acento y movimiento desde la config de Antuan) ---------------- */
function applyLook(c) {
  if (!c) return;
  if (c.accent) {
    root.style.setProperty('--accent', c.accent);
    const n = parseInt(c.accent.slice(1), 16);
    root.style.setProperty('--accent-rgb', [(n >> 16) & 255, (n >> 8) & 255, n & 255].join(', '));
  }
  if ('reduceMotion' in c) root.classList.toggle('reduce-motion', !!c.reduceMotion);
}
try { applyLook(await U.ask('config')); } catch { /* fuera de Antuan */ }
try { U.on('config-changed', applyLook); } catch { /* sin canal */ }

// Gradientes compartidos de la carpeta (un unico <defs> para todo el documento)
document.body.insertAdjacentHTML('beforeend', `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
  <linearGradient id="fBack" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--accent);stop-opacity:.62"/><stop offset="1" style="stop-color:var(--accent);stop-opacity:.38"/></linearGradient>
  <linearGradient id="fFront" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:color-mix(in srgb, var(--accent) 88%, #fff)"/><stop offset="1" style="stop-color:color-mix(in srgb, var(--accent) 72%, #1b2350)"/></linearGradient>
</defs></svg>`);

/* ---------------- Utilidades ---------------- */
const nf1 = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 });
function fmtSize(b) {
  if (b == null) return '—';
  if (b < 1024) return b + ' B';
  const u = ['KB', 'MB', 'GB', 'TB']; let i = -1;
  do { b /= 1024; i++; } while (b >= 1024 && i < u.length - 1);
  return nf1.format(b) + ' ' + u[i];
}
const dTime = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' });
const dDate = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
function fmtDate(ms) {
  if (!ms) return '—';
  const d = new Date(ms), now = new Date(), day = 864e5;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (ms >= start) return 'Hoy, ' + dTime.format(d);
  if (ms >= start - day) return 'Ayer, ' + dTime.format(d);
  return dDate.format(d).replace('.', '') + ', ' + dTime.format(d);
}
const plural = (n, a, b) => `${n.toLocaleString('es-ES')} ${n === 1 ? a : b}`;

const CODE = new Set(['js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx', 'css', 'scss', 'html', 'htm', 'xml', 'json', 'py', 'rb', 'go', 'rs', 'c', 'h', 'cpp', 'hpp', 'cs', 'java', 'kt', 'php', 'sh', 'ps1', 'bat', 'cmd', 'sql', 'lua', 'vue', 'svelte', 'yml', 'yaml', 'toml']);
const ZIP = new Set(['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'tgz', 'iso', 'cab']);
const APP = new Set(['exe', 'msi', 'lnk', 'url', 'appimage', 'deb', 'rpm', 'appref-ms', 'bat', 'cmd']);
const ICONIC = new Set(['exe', 'lnk', 'url', 'msi', 'ico', 'appref-ms', 'cpl', 'scr']); // su icono real merece la pena
const DOCX = new Set(['doc', 'docx', 'odt', 'rtf', 'pages']), SHEET = new Set(['xls', 'xlsx', 'ods', 'csv', 'numbers']), SLIDE = new Set(['ppt', 'pptx', 'odp', 'key']);
function cat(it) {
  if (it.isDir) return 'folder';
  const e = it.ext;
  if (it.kind === 'image') return 'image'; if (it.kind === 'video') return 'video'; if (it.kind === 'audio') return 'audio'; if (it.kind === 'pdf') return 'pdf';
  if (ZIP.has(e)) return 'zip'; if (APP.has(e)) return 'app'; if (DOCX.has(e)) return 'doc'; if (SHEET.has(e)) return 'sheet'; if (SLIDE.has(e)) return 'slide';
  if (CODE.has(e)) return 'code'; if (it.kind === 'text') return 'text';
  return 'other';
}
const CAT_ICON = { image: 'image', video: 'video', audio: 'music', pdf: 'doc', zip: 'zip', app: 'app', doc: 'doc', sheet: 'sheet', slide: 'slide', code: 'code', text: 'note', other: 'file' };
const TYPE_NAMES = { exe: 'Aplicación', msi: 'Instalador', lnk: 'Acceso directo', url: 'Acceso a Internet', pdf: 'Documento PDF', doc: 'Documento de Word', docx: 'Documento de Word',
  xls: 'Hoja de Excel', xlsx: 'Hoja de Excel', ppt: 'Presentación', pptx: 'Presentación', txt: 'Texto', md: 'Markdown', json: 'JSON', ini: 'Configuración', iso: 'Imagen de disco' };
function typeName(it) {
  if (it.isDir) return 'Carpeta';
  const e = it.ext, E = e.toUpperCase();
  if (TYPE_NAMES[e]) return TYPE_NAMES[e];
  const c = cat(it);
  return ({ image: `Imagen ${E}`, video: `Vídeo ${E}`, audio: `Audio ${E}`, zip: `Comprimido ${E}`, code: `Código ${E}`, text: `Texto ${E}`, sheet: `Hoja ${E}`, doc: `Documento ${E}`, slide: `Presentación ${E}` })[c] || (E ? `Archivo ${E}` : 'Archivo');
}

let PLACES = { favs: [], drives: [] };
const favIcon = (p) => { const f = PLACES.favs.find((x) => samePath(x.path, p) && x.id !== 'home'); return f ? f.icon : null; };
const isWin = navigator.userAgent.includes('Windows');
const norm = (p) => { p = String(p || '').replace(/[\\/]+$/, ''); return isWin ? p.toLowerCase() : p; };
const samePath = (a, b) => norm(a) === norm(b);

function folderSvg(p) {
  const fi = p && favIcon(p);
  return `<svg class="folder" viewBox="0 0 74 62" aria-hidden="true">
    <path d="M4 10a6 6 0 0 1 6-6h15.5a4 4 0 0 1 2.9 1.2L33 10h31a6 6 0 0 1 6 6v36a6 6 0 0 1-6 6H10a6 6 0 0 1-6-6z" fill="url(#fBack)"/>
    <rect x="10" y="13" width="54" height="30" rx="3" fill="rgba(255,255,255,.82)"/>
    <path d="M4 23a6 6 0 0 1 6-6h54a6 6 0 0 1 6 6v29a6 6 0 0 1-6 6H10a6 6 0 0 1-6-6z" fill="url(#fFront)"/>
    <path d="M10 17.6h54" stroke="rgba(255,255,255,.45)" stroke-width="1.2"/>
    ${fi && window.ICONS[fi] ? `<g transform="translate(26.5 27) scale(.875)" fill="none" stroke="rgba(11,13,26,.42)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${window.ICONS[fi]}</g>` : ''}
  </svg>`;
}
function glyph(it) {
  const c = cat(it), label = it.ext ? it.ext.slice(0, 4) : '';
  return `<div class="glyph k-${c}"><svg viewBox="0 0 52 64" aria-hidden="true">
    <path d="M9 1.5h24.5L50.5 18.5V56a6.5 6.5 0 0 1-6.5 6.5H9A6.5 6.5 0 0 1 2.5 56V8A6.5 6.5 0 0 1 9 1.5z" style="fill:color-mix(in srgb, var(--k) 14%, rgba(30,33,44,.95))" stroke="color-mix(in srgb, var(--k) 40%, transparent)" stroke-width="1.2"/>
    <path d="M33.5 1.5V13a5.5 5.5 0 0 0 5.5 5.5h11.5" style="fill:color-mix(in srgb, var(--k) 30%, rgba(30,33,44,.95))" stroke="color-mix(in srgb, var(--k) 40%, transparent)" stroke-width="1.2"/>
  </svg><span class="gi">${icon(CAT_ICON[c])}</span>${label ? `<b>${esc(label)}</b>` : ''}</div>`;
}
// Windows oculta la extension de accesos directos
// y muestra las carpetas conocidas con su nombre en espanol (Desktop -> Escritorio)
const dispName = (it) => it.isDir ? (PLACES.favs.find((f) => f.id !== 'home' && samePath(f.path, it.path))?.name || it.name) : (it.ext === 'lnk' || it.ext === 'url') ? it.name.slice(0, -(it.ext.length + 1)) : it.name;
const visual = (it) => it.isDir ? folderSvg(it.path) : glyph(it);
const wantsThumb = (it, size) => !it.isDir && (it.kind === 'image' || ICONIC.has(it.ext) || (size > 48 && (it.kind === 'video' || it.kind === 'pdf')));

let toastT;
function toast(t, bad) { const el = $('#toast'); el.textContent = t; el.classList.toggle('bad', !!bad); el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 2800); }
function report(r, ok) {
  if (!r) return toast('No se pudo completar la operación', true);
  if (r.error) return toast(r.error === 'EPERM' || r.error === 'EACCES' ? 'Sin permiso para esta carpeta' : r.error, true);
  if (r.errors && r.errors.length) return toast(`${r.errors.length} con error: ${r.errors[0].error}`, true);
  if (ok) toast(ok);
}

/* ---------------- Estado ---------------- */
const store = { get(k, d) { try { const v = localStorage.getItem('archivos.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem('archivos.' + k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } } };
const S = {
  dir: null, items: [], shown: [], error: null, external: false, search: null,
  view: store.get('view', 'grid'), sort: store.get('sort', { key: 'name', desc: false }),
  hidden: store.get('hidden', false), prev: store.get('prev', false),
  sel: new Set(), anchor: -1, focus: -1, hist: [], hi: -1, clip: null
};
const scroller = $('#scroller'), itemsEl = $('#items');
const coll = new Intl.Collator('es', { numeric: true, sensitivity: 'base' });

function sortItems(list) {
  const { key, desc } = S.sort, k = desc ? -1 : 1;
  return list.slice().sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    let r = 0;
    if (key === 'date') r = a.mtime - b.mtime;
    else if (key === 'size') r = (a.size || 0) - (b.size || 0);
    else if (key === 'type') r = coll.compare(typeName(a), typeName(b));
    return (r || coll.compare(a.name, b.name)) * (key === 'name' ? k : r ? k : 1);
  });
}

/* ---------------- Lugares ---------------- */
async function loadPlaces() {
  const r = await A('fs.places');
  if (r && !r.error) PLACES = r;
  const pl = (p, extra = '', cls = '') => `<button class="pl ${cls}" data-path="${esc(p.path)}" title="${esc(p.path)}">${icon(p.icon)}<span>${esc(p.name)}</span>${extra}</button>`;
  let h = `<div class="cap">Favoritos</div>` + PLACES.favs.map((p) => pl(p)).join('');
  if (PLACES.drives.length) {
    h += `<div class="cap">Unidades</div>` + PLACES.drives.map((d) => {
      const used = d.total ? (d.total - d.free) / d.total : 0, c = used > .9 ? 'var(--bad)' : used > .75 ? 'var(--warn)' : 'var(--accent)';
      return pl(d, `<span class="space"><span class="bar"><i style="--p:${(used * 100).toFixed(1)}%;--c:${c}"></i></span>${fmtSize(d.free)} libres de ${fmtSize(d.total)}</span>`, 'drive');
    }).join('');
  }
  if (PLACES.trash) h += `<div class="cap">Sistema</div>` + pl(PLACES.trash);
  $('#places').innerHTML = h;
  markPlace();
}
function markPlace() { $$('.pl').forEach((b) => b.setAttribute('aria-current', !S.search && samePath(b.dataset.path, S.dir))); }
$('#places').addEventListener('click', (e) => { const b = e.target.closest('.pl'); if (b) go(b.dataset.path); });

/* ---------------- Navegacion ---------------- */
let loadSeq = 0;
async function go(dir, opt = {}) {
  const { push = true, select = null, anim = true, keepScroll = false } = opt;
  const seq = ++loadSeq, sameDir = samePath(dir, S.dir);
  if (!keepScroll && !sameDir) { itemsEl.innerHTML = ''; }
  const slow = setTimeout(() => { if (seq === loadSeq && !keepScroll) itemsEl.innerHTML = `<div class="loading"><i class="spin"></i>Cargando…</div>`; }, 160);
  const r = await A('fs.list', dir, { hidden: S.hidden });
  clearTimeout(slow);
  if (seq !== loadSeq) return;
  if (S.search) { S.search = null; $('#q').value = ''; }
  const top = scroller.scrollTop;
  S.dir = r.dir || dir; S.items = r.items || []; S.error = r.error || null; S.external = !!r.external;
  if (push) { S.hist = S.hist.slice(0, S.hi + 1); if (!samePath(S.hist[S.hi], S.dir)) { S.hist.push(S.dir); S.hi = S.hist.length - 1; } }
  S.sel = new Set(select ? select.filter((p) => S.items.some((i) => samePath(i.path, p))).map((p) => S.items.find((i) => samePath(i.path, p)).path) : []);
  S.anchor = S.focus = -1;
  render(anim && !sameDir);
  scroller.scrollTop = keepScroll || (sameDir && !anim) ? top : 0;
  if (select && select.length) { const idx = S.shown.findIndex((i) => S.sel.has(i.path)); if (idx >= 0) { S.anchor = S.focus = idx; reveal(idx); } }
  crumbs();
  markPlace();
  const base = S.dir === PLACES.trash?.path ? 'Papelera' : PLACES.favs.find((f) => samePath(f.path, S.dir))?.name || (S.dir.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || S.dir);
  document.title = base + ' — Archivos';
  navButtons();
}
const refresh = (select) => S.search ? runSearch(S.search) : go(S.dir, { push: false, anim: false, keepScroll: true, select: select || [...S.sel] });
function navButtons() {
  $('#back').disabled = S.hi <= 0; $('#fwd').disabled = S.hi >= S.hist.length - 1;
  $('#up').disabled = !parentOf(S.dir) || S.external;
}
function parentOf(p) {
  if (!p || p === PLACES.trash?.path) return null;
  const t = p.replace(/[\\/]+$/, ''), i = Math.max(t.lastIndexOf('\\'), t.lastIndexOf('/'));
  if (i < 0) return null;
  const par = t.slice(0, i);
  if (!par) return t.startsWith('/') && t !== '' ? '/' : null;
  return /^[a-z]:$/i.test(par) ? par + '\\' : par;
}
function histGo(d) { const n = S.hi + d; if (n < 0 || n >= S.hist.length) return; S.hi = n; go(S.hist[n], { push: false }); }
const goUp = () => { const p = parentOf(S.dir); if (p) go(p, { select: [S.dir] }); };

function crumbs() {
  const el = $('#crumbs');
  if (S.search) { el.innerHTML = `<button class="cr" data-path="${esc(S.dir)}">${esc(PLACES.favs.find((f) => samePath(f.path, S.dir))?.name || lastName(S.dir))}</button><span class="sep">${icon('chev')}</span><span class="cr anim">Resultados de «${esc(S.search)}»</span>`; return; }
  if (S.dir === PLACES.trash?.path) { el.innerHTML = `<span class="cr">Papelera</span>`; return; }
  const parts = [], segs = S.dir.split(/[\\/]+/).filter(Boolean);
  let acc = '';
  if (S.dir.startsWith('/')) {
    parts.push({ name: 'Sistema', path: '/' });
    for (const s of segs) { acc += '/' + s; parts.push({ name: s, path: acc }); }
  } else {
    segs.forEach((s, i) => {
      acc = i === 0 ? (/^[a-z]:$/i.test(s) ? s + '\\' : s) : (acc.endsWith('\\') ? acc + s : acc + '\\' + s);
      parts.push({ name: i === 0 ? (PLACES.drives.find((d) => samePath(d.path, acc))?.name || s) : s, path: acc });
    });
  }
  // Las carpetas conocidas usan su nombre en espanol
  for (const p of parts) { const f = PLACES.favs.find((x) => samePath(x.path, p.path)); if (f) p.name = f.name; }
  // Si la ruta cuelga de Inicio, se muestra desde ahi (mas corta y amable)
  const homeP = PLACES.favs.find((f) => f.id === 'home');
  let from = 0;
  if (homeP) { const h = parts.findIndex((p) => samePath(p.path, homeP.path)); if (h >= 0) { from = h; parts[h].name = homeP.name; } }
  const shown = parts.slice(from);
  el.innerHTML = shown.map((p, i) => `${i ? `<span class="sep">${icon('chev')}</span>` : ''}<button class="cr anim" style="animation-delay:${i * 30}ms" data-path="${esc(p.path)}" title="${esc(p.path)}">${esc(p.name)}</button>`).join('');
  el.scrollLeft = el.scrollWidth;
}
const lastName = (p) => p.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || p;
$('#crumbs').addEventListener('click', (e) => { const b = e.target.closest('.cr[data-path]'); if (b) go(b.dataset.path); });
$('#back').innerHTML = icon('back'); $('#fwd').innerHTML = icon('fwd'); $('#up').innerHTML = icon('upd');
$('#back').onclick = () => histGo(-1); $('#fwd').onclick = () => histGo(1); $('#up').onclick = goUp;
$('#find .fi').innerHTML = icon('search');

/* ---------------- Render ---------------- */
let io;
function render(anim) {
  document.body.classList.toggle('v-grid', S.view === 'grid');
  document.body.classList.toggle('v-list', S.view === 'list');
  $$('#views button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.v === S.view));
  S.shown = sortItems(S.items);
  if (io) io.disconnect();
  io = new IntersectionObserver(onSeen, { root: scroller, rootMargin: '300px 0px' });
  lhead();
  if (S.external) {
    itemsEl.innerHTML = `<div class="empty"><span class="big">${icon('trash')}</span><b>Papelera de Windows</b><span>Windows gestiona la papelera por su cuenta.</span><button class="btn" data-act="trash-os">${icon('reveal')}Abrir la papelera</button></div>`;
  } else if (S.error && !S.items.length) {
    itemsEl.innerHTML = `<div class="empty"><span class="big">${icon(S.error === 'ENOENT' ? 'warn' : 'lock')}</span><b>${S.error === 'ENOENT' ? 'Esta carpeta ya no existe' : 'No se puede abrir esta carpeta'}</b><span>${esc(S.error === 'EPERM' || S.error === 'EACCES' ? 'No tienes permiso para ver su contenido.' : S.error)}</span></div>`;
  } else if (!S.shown.length) {
    itemsEl.innerHTML = `<div class="empty"><span class="big">${icon(S.search ? 'search' : 'folder')}</span><b>${S.search ? 'Sin resultados' : 'Carpeta vacía'}</b><span>${S.search ? 'Prueba con otro nombre.' : 'Arrastra archivos aquí o crea una carpeta nueva.'}</span></div>`;
  } else {
    const grid = S.view === 'grid', cutSet = S.clip && S.clip.mode === 'cut' ? new Set(S.clip.paths) : null;
    itemsEl.innerHTML = S.shown.map((it, i) => {
      const cls = (S.sel.has(it.path) ? ' sel' : '') + (cutSet && cutSet.has(it.path) ? ' cut' : '');
      const th = wantsThumb(it, grid ? 160 : 32) ? ' data-th="1"' : '';
      if (grid) return `<div class="tile${cls}" data-i="${i}" draggable="true" style="--i:${i}"><div class="th"${th}>${visual(it)}</div><div class="nm" title="${esc(it.name)}">${esc(dispName(it))}</div></div>`;
      return `<div class="row${cls}" data-i="${i}" draggable="true" style="--i:${i}"><div class="n"><span class="mi"${th}>${visual(it)}</span><span class="nm">${esc(dispName(it))}</span></div><span class="d">${fmtDate(it.mtime)}</span><span class="s">${it.isDir ? '—' : fmtSize(it.size)}</span><span class="t">${esc(S.search ? lastName(parentOf(it.path) || '') : typeName(it))}</span></div>`;
    }).join('');
    $$('[data-th]', itemsEl).forEach((el) => io.observe(el));
  }
  itemsEl.classList.remove('anim');
  if (anim) { void itemsEl.offsetWidth; itemsEl.classList.add('anim'); }
  status(); preview();
}
async function onSeen(entries) {
  for (const en of entries) {
    if (!en.isIntersecting) continue;
    const el = en.target; io.unobserve(el);
    const it = S.shown[+el.closest('[data-i]').dataset.i]; if (!it) continue;
    const grid = !!el.closest('.tile'), iconic = ICONIC.has(it.ext);
    const url = await A('fs.thumb', it.path, grid ? 176 : (it.kind === 'image' ? 64 : 32), { icon: iconic });
    if (!url || typeof url !== 'string' || !el.isConnected) continue;
    const pic = !iconic;
    el.innerHTML = `<img class="${pic ? 'pic' : 'ico'}" src="${url}" alt="" draggable="false">${grid && it.kind === 'video' ? `<span class="play">${icon('play')}</span>` : ''}`;
  }
}
itemsEl.addEventListener('click', (e) => { if (e.target.closest('[data-act="trash-os"]')) U.cmd('fs.openTrash'); });

const COLS = [['name', 'Nombre'], ['date', 'Fecha de modificación'], ['size', 'Tamaño', 'r'], ['type', S.search ? 'Ubicación' : 'Tipo']];
function lhead() {
  COLS[3][1] = S.search ? 'Ubicación' : 'Tipo';
  $('#lhead').innerHTML = COLS.map(([k, t, r]) => `<button data-k="${k}" class="${r || ''} ${S.sort.key === k ? 'on' : ''} ${S.sort.key === k && S.sort.desc ? 'desc' : ''}">${r && S.sort.key === k ? icon('chevd') : ''}${t}${!r && S.sort.key === k ? icon('chevd') : ''}</button>`).join('');
}
$('#lhead').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  const k = b.dataset.k;
  S.sort = { key: k, desc: S.sort.key === k ? !S.sort.desc : k === 'date' || k === 'size' };
  store.set('sort', S.sort);
  const keep = [...S.sel]; render(false); S.sel = new Set(keep); paintSel();
});

/* ---------------- Seleccion ---------------- */
const elOf = (i) => itemsEl.querySelector(`[data-i="${i}"]`);
function paintSel() {
  $$('[data-i]', itemsEl).forEach((el) => el.classList.toggle('sel', S.sel.has(S.shown[+el.dataset.i]?.path)));
  status(); preview();
}
function selectOnly(i) { S.sel = new Set(i >= 0 && S.shown[i] ? [S.shown[i].path] : []); S.anchor = S.focus = i; paintSel(); }
function selectRange(a, b, add) {
  if (!add) S.sel.clear();
  const [x, y] = a < b ? [a, b] : [b, a];
  for (let i = Math.max(0, x); i <= y; i++) S.sel.add(S.shown[i].path);
  S.focus = b; paintSel();
}
const selItems = () => S.shown.filter((i) => S.sel.has(i.path));
function reveal(i) {
  const el = elOf(i); if (!el) return;
  const r = el.getBoundingClientRect(), sr = scroller.getBoundingClientRect(), headH = S.view === 'list' ? 34 : 0;
  if (r.top < sr.top + headH) scroller.scrollTop -= sr.top + headH - r.top + 8;
  else if (r.bottom > sr.bottom) scroller.scrollTop += r.bottom - sr.bottom + 8;
}
function status() {
  const n = S.shown.length;
  $('#count').textContent = S.external ? '' : plural(n, 'elemento', 'elementos') + (S.search ? ' encontrados' : '');
  const sel = selItems();
  if (sel.length) {
    const files = sel.filter((i) => !i.isDir), total = files.reduce((a, i) => a + (i.size || 0), 0);
    $('#selinfo').textContent = `${plural(sel.length, 'seleccionado', 'seleccionados')}${files.length ? ' · ' + fmtSize(total) : ''}`;
  } else $('#selinfo').textContent = '';
  $('#hint').textContent = S.clip ? `${plural(S.clip.paths.length, 'elemento', 'elementos')} para ${S.clip.mode === 'cut' ? 'mover' : 'copiar'} · Ctrl+V para pegar` : '';
}

/* ---------------- Raton: clic, doble clic, rectangulo ---------------- */
let pressed = null;
itemsEl.addEventListener('mousedown', (e) => {
  const el = e.target.closest('[data-i]');
  if (!el || e.target.closest('input.ren')) return;
  if (e.button === 2 && S.sel.has(S.shown[+el.dataset.i].path)) return;
  const i = +el.dataset.i, was = S.sel.has(S.shown[i].path);
  scroller.focus({ preventScroll: true });
  if (e.shiftKey && S.anchor >= 0) selectRange(S.anchor, i, e.ctrlKey);
  else if (e.ctrlKey || e.metaKey) { if (was) S.sel.delete(S.shown[i].path); else S.sel.add(S.shown[i].path); S.anchor = S.focus = i; paintSel(); }
  else if (!was) selectOnly(i);
  pressed = { i, was, mods: e.shiftKey || e.ctrlKey || e.metaKey };
});
itemsEl.addEventListener('click', (e) => {
  const el = e.target.closest('[data-i]');
  if (el && pressed && pressed.was && !pressed.mods && +el.dataset.i === pressed.i && S.sel.size > 1) selectOnly(pressed.i);
  pressed = null;
});
itemsEl.addEventListener('dblclick', (e) => { const el = e.target.closest('[data-i]'); if (el && !e.target.closest('input.ren')) openItems([S.shown[+el.dataset.i]]); });

// Rectangulo de seleccion sobre zona vacia
const band = $('#band');
scroller.addEventListener('mousedown', (e) => {
  if (e.button !== 0 || e.target.closest('[data-i], #lhead, .btn, input')) return;
  if (e.offsetX > scroller.clientWidth) return; // barra de desplazamiento
  scroller.focus({ preventScroll: true });
  const sr = scroller.getBoundingClientRect();
  const P = (ev) => ({ x: ev.clientX - sr.left + scroller.scrollLeft, y: ev.clientY - sr.top + scroller.scrollTop });
  const start = P(e), base = e.ctrlKey || e.shiftKey ? new Set(S.sel) : new Set();
  const rects = $$('[data-i]', itemsEl).map((el) => { const r = el.getBoundingClientRect(); return { i: +el.dataset.i, x: r.left - sr.left + scroller.scrollLeft, y: r.top - sr.top + scroller.scrollTop, w: r.width, h: r.height }; });
  if (!base.size) { S.sel.clear(); paintSel(); }
  let last = e, moved = false;
  const update = () => {
    const p = P(last), x = Math.min(p.x, start.x), y = Math.min(p.y, start.y), w = Math.abs(p.x - start.x), h = Math.abs(p.y - start.y);
    if (!moved && w + h < 5) return; moved = true;
    Object.assign(band.style, { display: 'block', left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
    const next = new Set(base);
    for (const r of rects) if (r.x < x + w && r.x + r.w > x && r.y < y + h && r.y + r.h > y) next.add(S.shown[r.i].path);
    if (next.size !== S.sel.size || [...next].some((p) => !S.sel.has(p))) { S.sel = next; paintSel(); }
  };
  const tick = setInterval(() => {
    // Desplazamiento automatico al acercarse a los bordes
    const y = last.clientY, d = y < sr.top + 30 ? -14 : y > sr.bottom - 30 ? 14 : 0;
    if (d) { scroller.scrollTop += d; update(); }
  }, 16);
  const mm = (ev) => { last = ev; update(); };
  const mu = () => {
    clearInterval(tick); band.style.display = 'none';
    removeEventListener('mousemove', mm); removeEventListener('mouseup', mu);
    const idx = S.shown.findIndex((i) => S.sel.has(i.path)); S.anchor = S.focus = idx;
  };
  addEventListener('mousemove', mm); addEventListener('mouseup', mu);
});

/* ---------------- Abrir ---------------- */
async function openItems(list) {
  if (!list.length) return;
  const dirs = list.filter((i) => i.isDir);
  if (dirs.length === 1 && list.length === 1) return go(dirs[0].path);
  for (const it of list.filter((i) => !i.isDir).slice(0, 12)) { const r = await A('fs.open', it.path); if (r && r.error) report(r); }
  if (dirs.length && list.length > 1) go(dirs[0].path);
}

/* ---------------- Operaciones ---------------- */
const curOk = () => S.dir && !S.external && !S.search;
async function newFolder() {
  if (!curOk()) return;
  const r = await A('fs.mkdir', S.dir, 'Nueva carpeta');
  if (r.error) return report(r);
  await go(S.dir, { push: false, anim: false, keepScroll: true, select: [r.path] });
  const i = S.shown.findIndex((x) => samePath(x.path, r.path)); if (i >= 0) rename(i);
}
async function trash(list = selItems()) {
  if (!list.length || S.external) return;
  const r = await A('fs.trash', list.map((i) => i.path));
  report(r, r.done && r.done.length ? `${plural(r.done.length, 'elemento enviado', 'elementos enviados')} a la papelera` : '');
  const idx = S.shown.findIndex((i) => S.sel.has(i.path));
  await refresh([]);
  if (S.shown.length) selectOnly(Math.min(Math.max(0, idx), S.shown.length - 1));
}
function setClip(mode) {
  const sel = selItems(); if (!sel.length) return;
  S.clip = { mode, paths: sel.map((i) => i.path) };
  $$('[data-i]', itemsEl).forEach((el) => el.classList.toggle('cut', mode === 'cut' && S.sel.has(S.shown[+el.dataset.i].path)));
  toast(mode === 'cut' ? `${plural(sel.length, 'elemento listo', 'elementos listos')} para mover` : `${plural(sel.length, 'elemento copiado', 'elementos copiados')}`);
  status();
}
async function paste(dest = S.dir) {
  if (!S.clip || !dest || S.external) return;
  const { mode, paths } = S.clip;
  const r = await transfer(paths, dest, mode === 'cut' ? 'move' : 'copy');
  if (mode === 'cut' && r && r.done && r.done.length) S.clip = null;
  status();
}
async function transfer(paths, dest, op) {
  toast(op === 'move' ? 'Moviendo…' : 'Copiando…');
  const r = await A(op === 'move' ? 'fs.move' : 'fs.copy', paths, dest);
  report(r, r.done ? `${plural(r.done.length, 'elemento', 'elementos')} ${op === 'move' ? 'movido' + (r.done.length === 1 ? '' : 's') : 'copiado' + (r.done.length === 1 ? '' : 's')}` : '');
  if (samePath(dest, S.dir)) await refresh(r.done || []); else await refresh();
  return r;
}
async function copyPaths(list = selItems()) {
  const ps = list.length ? list.map((i) => i.path) : [S.dir];
  const r = await A('fs.copyPaths', ps); report(r, ps.length === 1 ? 'Ruta copiada' : 'Rutas copiadas');
}

// Renombrar en linea
let renaming = null;
function rename(i = S.focus) {
  if (S.external || i < 0 || !S.shown[i]) return;
  const it = S.shown[i], el = elOf(i); if (!el) return;
  reveal(i);
  const nm = $('.nm', el), inp = document.createElement('input');
  inp.className = 'ren'; inp.value = it.name; inp.spellcheck = false;
  nm.replaceWith(inp); renaming = it.path;
  inp.focus();
  const dot = it.isDir ? -1 : it.name.lastIndexOf('.');
  inp.setSelectionRange(0, dot > 0 ? dot : it.name.length);
  let done = false;
  const finish = async (ok) => {
    if (done) return; done = true; renaming = null;
    const v = inp.value.trim();
    if (!ok || !v || v === it.name) { inp.replaceWith(nm); scroller.focus({ preventScroll: true }); return; }
    const r = await A('fs.rename', it.path, v);
    if (r.error) { report(r); inp.replaceWith(nm); scroller.focus({ preventScroll: true }); return; }
    if (S.clip) S.clip.paths = S.clip.paths.map((p) => samePath(p, it.path) ? r.path : p);
    await refresh([r.path]); scroller.focus({ preventScroll: true });
  };
  inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') finish(true); if (e.key === 'Escape') finish(false); });
  inp.addEventListener('blur', () => finish(true));
  inp.addEventListener('mousedown', (e) => e.stopPropagation());
  inp.addEventListener('dblclick', (e) => e.stopPropagation());
}

/* ---------------- Arrastrar y soltar ---------------- */
const DT = 'text/umbra-paths';
let dragging = null;
itemsEl.addEventListener('dragstart', (e) => {
  const el = e.target.closest('[data-i]'); if (!el || renaming) return e.preventDefault();
  const it = S.shown[+el.dataset.i];
  if (!S.sel.has(it.path)) selectOnly(+el.dataset.i);
  dragging = selItems().map((i) => i.path);
  e.dataTransfer.setData(DT, JSON.stringify(dragging));
  e.dataTransfer.setData('text/plain', dragging.join('\n'));
  e.dataTransfer.effectAllowed = 'copyMove';
  // Insignia de arrastre: icono + contador
  const g = document.createElement('div');
  g.style.cssText = 'position:fixed;top:-200px;left:-200px;display:flex;align-items:center;gap:8px;padding:6px 12px 6px 6px;border-radius:12px;background:rgba(26,29,38,.92);color:#e9ebf1;font:600 12.5px "Segoe UI Variable Text","Segoe UI",sans-serif;box-shadow:0 0 0 1px rgba(255,255,255,.12)';
  g.innerHTML = `<span style="width:28px;height:28px;display:grid;place-items:center">${it.isDir ? folderSvg().replace('class="folder"', 'class="folder" style="width:28px;height:24px"') : `<span style="transform:scale(.45);display:block">${glyph(it)}</span>`}</span>${dragging.length > 1 ? plural(dragging.length, 'elemento', 'elementos') : esc(it.name.slice(0, 32))}`;
  document.body.appendChild(g); e.dataTransfer.setDragImage(g, 18, 18); setTimeout(() => g.remove(), 0);
});
itemsEl.addEventListener('dragend', () => { dragging = null; clearDrop(); });
const clearDrop = () => $$('.drop').forEach((x) => x.classList.remove('drop'));
function dropTarget(e) {
  const t = e.target.closest('[data-i], .pl, .cr[data-path]');
  if (t && t.dataset.i != null) { const it = S.shown[+t.dataset.i]; return it && it.isDir ? { el: t, path: it.path } : null; }
  if (t && t.dataset.path && t.dataset.path !== PLACES.trash?.path) return { el: t, path: t.dataset.path };
  if (t && t.dataset.path === PLACES.trash?.path) return { el: t, path: 'TRASH' };
  if (e.target.closest('#scroller') && curOk()) return { el: null, path: S.dir };
  return null;
}
document.addEventListener('dragover', (e) => {
  e.preventDefault();
  if (!e.dataTransfer.types.includes(DT)) { e.dataTransfer.dropEffect = 'none'; return; }
  const t = dropTarget(e);
  const bad = !t || (dragging && dragging.some((p) => samePath(p, t.path))) || (t.path === S.dir && !t.el && dragging && dragging.every((p) => samePath(parentOf(p), S.dir)));
  clearDrop();
  if (bad) { e.dataTransfer.dropEffect = 'none'; return; }
  if (t.el) t.el.classList.add('drop');
  e.dataTransfer.dropEffect = e.ctrlKey && t.path !== 'TRASH' ? 'copy' : 'move';
});
document.addEventListener('dragleave', (e) => { if (!e.relatedTarget) clearDrop(); });
document.addEventListener('drop', async (e) => {
  e.preventDefault(); clearDrop();
  if (!e.dataTransfer.types.includes(DT)) return;
  const paths = JSON.parse(e.dataTransfer.getData(DT) || '[]'), t = dropTarget(e);
  if (!t || !paths.length || paths.some((p) => samePath(p, t.path))) return;
  if (t.path === 'TRASH') return trash(S.shown.filter((i) => paths.includes(i.path)));
  await transfer(paths, t.path, e.ctrlKey ? 'copy' : 'move');
});

/* ---------------- Menu contextual de cristal ---------------- */
const menu = $('#menu');
let menuItems = [];
function showMenu(x, y, entries) {
  menuItems = entries.filter(Boolean);
  menu.innerHTML = menuItems.map((m, i) => m === '-' ? '<hr>' : `<button data-m="${i}" class="${m.danger ? 'danger' : ''}" ${m.off ? 'disabled' : ''}>${icon(m.icon)}<span>${m.t}</span>${m.k ? `<kbd>${m.k}</kbd>` : ''}</button>`).join('');
  menu.classList.remove('show'); menu.style.display = 'block';
  const w = menu.offsetWidth, h = menu.offsetHeight;
  const left = Math.min(x, innerWidth - w - 8), top = Math.min(y, innerHeight - h - 8);
  menu.style.left = left + 'px'; menu.style.top = top + 'px';
  menu.style.setProperty('--ox', (x - left) + 'px'); menu.style.setProperty('--oy', (y - top) + 'px');
  menu.style.display = ''; void menu.offsetWidth; menu.classList.add('show');
}
const hideMenu = () => menu.classList.remove('show');
menu.addEventListener('click', (e) => { const b = e.target.closest('[data-m]'); if (!b) return; hideMenu(); menuItems[+b.dataset.m].run(); });
addEventListener('mousedown', (e) => { if (!e.target.closest('#menu')) hideMenu(); }, true);
addEventListener('blur', hideMenu);
document.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  if (e.target.closest('input') && !e.target.closest('#items')) return;
  const el = e.target.closest('#items [data-i]'), place = e.target.closest('.pl');
  if (place) {
    const p = place.dataset.path;
    if (p === PLACES.trash?.path) return showMenu(e.clientX, e.clientY, [{ t: 'Abrir', icon: 'open', run: () => go(p) }, { t: 'Abrir en el sistema', icon: 'reveal', run: () => U.cmd('fs.openTrash') }]);
    return showMenu(e.clientX, e.clientY, [
      { t: 'Abrir', icon: 'open', run: () => go(p) },
      { t: 'Pegar aquí', icon: 'paste', off: !S.clip, run: () => paste(p) }, '-',
      { t: 'Copiar ruta', icon: 'link', run: () => A('fs.copyPaths', [p]).then((r) => report(r, 'Ruta copiada')) },
      { t: 'Abrir en el sistema', icon: 'reveal', run: () => A('fs.open', p) }
    ]);
  }
  if (!e.target.closest('#scroller')) return;
  if (el) {
    const i = +el.dataset.i;
    if (!S.sel.has(S.shown[i].path)) selectOnly(i);
    const sel = selItems(), one = sel.length === 1 ? sel[0] : null;
    showMenu(e.clientX, e.clientY, [
      { t: 'Abrir', icon: 'open', k: 'Intro', run: () => openItems(sel) },
      { t: 'Vista rápida', icon: 'look', k: 'Espacio', run: () => quickLook(true) },
      one && { t: 'Renombrar', icon: 'pencil', k: 'F2', off: S.external, run: () => rename(S.shown.indexOf(one)) }, '-',
      { t: 'Copiar', icon: 'copy', k: 'Ctrl+C', run: () => setClip('copy') },
      { t: 'Cortar', icon: 'cut', k: 'Ctrl+X', run: () => setClip('cut') },
      { t: one && one.isDir ? 'Pegar dentro' : 'Pegar', icon: 'paste', k: 'Ctrl+V', off: !S.clip || (!curOk() && !(one && one.isDir)), run: () => paste(one && one.isDir ? one.path : S.dir) },
      { t: 'Copiar ruta', icon: 'link', k: 'Ctrl+Mayús+C', run: () => copyPaths(sel) }, '-',
      { t: 'Mostrar en el sistema', icon: 'reveal', run: () => A('fs.reveal', sel[0].path) },
      S.search && one && { t: 'Ir a la carpeta', icon: 'folder', run: () => go(parentOf(one.path), { select: [one.path] }) },
      { t: 'Mover a la papelera', icon: 'trash', k: 'Supr', danger: true, run: () => trash(sel) }
    ]);
  } else {
    if (!e.ctrlKey) { S.sel.clear(); paintSel(); }
    showMenu(e.clientX, e.clientY, [
      { t: 'Nueva carpeta', icon: 'fplus', k: 'Ctrl+Mayús+N', off: !curOk(), run: newFolder },
      { t: 'Pegar', icon: 'paste', k: 'Ctrl+V', off: !S.clip || !curOk(), run: () => paste() }, '-',
      { t: S.view === 'grid' ? 'Ver como lista' : 'Ver como cuadrícula', icon: S.view === 'grid' ? 'rows' : 'tiles', run: () => setView(S.view === 'grid' ? 'list' : 'grid') },
      { t: S.hidden ? 'Ocultar archivos ocultos' : 'Mostrar archivos ocultos', icon: S.hidden ? 'eyeoff' : 'eye', k: 'Ctrl+H', run: toggleHidden },
      { t: 'Actualizar', icon: 'refresh', k: 'F5', run: () => refresh() }, '-',
      { t: 'Copiar ruta', icon: 'link', run: () => copyPaths([]) },
      { t: 'Abrir en el sistema', icon: 'reveal', off: S.external, run: () => A('fs.open', S.dir) }
    ]);
  }
});

/* ---------------- Vista, ocultos, panel ---------------- */
$('#views').innerHTML = `<button data-v="grid" title="Cuadrícula (Ctrl+1)">${icon('tiles')}</button><button data-v="list" title="Lista (Ctrl+2)">${icon('rows')}</button>`;
$('#views').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setView(b.dataset.v); });
function setView(v) { if (v === S.view) return; S.view = v; store.set('view', v); const keep = [...S.sel], f = S.focus; render(true); S.sel = new Set(keep); S.focus = S.anchor = f; paintSel(); }
function toggleHidden() { S.hidden = !S.hidden; store.set('hidden', S.hidden); toast(S.hidden ? 'Mostrando archivos ocultos' : 'Archivos ocultos escondidos'); refresh(); }
const tp = $('#togglePrev'); tp.innerHTML = icon('panel');
function setPrev(on) { S.prev = on; store.set('prev', on); document.body.classList.toggle('show-prev', on); tp.setAttribute('aria-pressed', on); preview(); }
tp.onclick = () => setPrev(!S.prev);

/* ---------------- Panel de vista previa ---------------- */
let pvT, pvKey = '';
function preview() {
  if (!S.prev) return;
  clearTimeout(pvT);
  pvT = setTimeout(async () => {
    const pane = $('#preview'), sel = selItems(), key = sel.map((i) => i.path).join('|') + '#' + S.dir;
    if (key === pvKey) return; pvKey = key;
    if (sel.length !== 1) {
      const files = sel.filter((i) => !i.isDir);
      pane.innerHTML = sel.length
        ? `<div class="pv"><div class="hero">${folderSvg()}</div><h2>${plural(sel.length, 'elemento', 'elementos')}</h2><div class="kv"><span>Archivos</span><b>${files.length}</b><span>Carpetas</span><b>${sel.length - files.length}</b><span>Tamaño</span><b>${fmtSize(files.reduce((a, i) => a + (i.size || 0), 0))}</b></div></div>`
        : `<div class="pv"><div class="none">${icon('eye')}<span>Selecciona un elemento<br>para ver sus detalles</span></div></div>`;
      return;
    }
    const it = sel[0];
    pane.innerHTML = `<div class="pv"><div class="hero">${visual(it)}</div><h2>${esc(dispName(it))}</h2><div class="kv"><span>Tipo</span><b>${esc(typeName(it))}</b>${it.isDir ? '' : `<span>Tamaño</span><b>${fmtSize(it.size)}</b>`}<span>Modificado</span><b>${fmtDate(it.mtime)}</b></div><div class="acts"><button class="btn" data-a="open">${icon('open')}Abrir</button><button class="btn" data-a="ql">${icon('look')}Vista rápida</button></div></div>`;
    const hero = $('.hero', pane);
    if (it.kind === 'image' || it.kind === 'video' || it.kind === 'pdf' || ICONIC.has(it.ext)) {
      const url = await A('fs.thumb', it.path, 400, { icon: ICONIC.has(it.ext) });
      if (typeof url === 'string' && pvKey === key) hero.innerHTML = `<img class="${ICONIC.has(it.ext) ? 'ico' : 'pic'}" src="${url}" alt="">`;
    } else if (it.kind === 'text' || cat(it) === 'code') {
      const r = await A('fs.preview', it.path);
      if (r && r.text != null && pvKey === key) hero.innerHTML = `<pre>${esc(r.text.slice(0, 1600))}</pre>`;
    } else if (it.isDir) {
      const r = await A('fs.preview', it.path);
      if (r && r.count != null && pvKey === key) $('.kv', pane).insertAdjacentHTML('afterbegin', `<span>Contiene</span><b>${plural(r.count, 'elemento', 'elementos')}</b>`);
    }
  }, 90);
}
$('#preview').addEventListener('click', (e) => {
  const b = e.target.closest('[data-a]'); if (!b) return;
  if (b.dataset.a === 'open') openItems(selItems()); else quickLook(true);
});

/* ---------------- Vista rapida (espacio) ---------------- */
const ql = $('#ql');
let qlOpen = false, qlSeq = 0;
$('.ql-x').innerHTML = icon('x'); $('.ql-open').innerHTML = icon('reveal');
$('.ql-nav.prev').innerHTML = icon('back'); $('.ql-nav.next').innerHTML = icon('fwd');
function quickLook(on) {
  if (on === qlOpen) return on && qlShow();
  qlOpen = on;
  ql.classList.toggle('show', on); ql.setAttribute('aria-hidden', !on);
  if (on) qlShow(); else { const b = $('.ql-body'); setTimeout(() => { if (!qlOpen) b.innerHTML = ''; }, 260); scroller.focus({ preventScroll: true }); }
}
async function qlShow() {
  let i = S.focus >= 0 && S.sel.has(S.shown[S.focus]?.path) ? S.focus : S.shown.findIndex((x) => S.sel.has(x.path));
  if (i < 0) { if (!S.shown.length) return quickLook(false); selectOnly(0); i = 0; }
  const it = S.shown[i], seq = ++qlSeq, body = $('.ql-body');
  $('.ql-name').textContent = dispName(it);
  $('.ql-meta').textContent = [typeName(it), it.isDir ? '' : fmtSize(it.size), fmtDate(it.mtime)].filter(Boolean).join(' · ');
  $('.ql-nav.prev').disabled = i <= 0; $('.ql-nav.next').disabled = i >= S.shown.length - 1;
  const r = await A('fs.preview', it.path);
  if (seq !== qlSeq || !qlOpen) return;
  const k = r && !r.error ? r.kind : 'other';
  if (k === 'image') body.innerHTML = `<img class="pic" src="${r.url}" alt="">`;
  else if (k === 'video') body.innerHTML = `<video src="${r.url}" controls autoplay></video>`;
  else if (k === 'audio') body.innerHTML = `<div class="aud"><div class="disc">${icon('music')}</div><audio src="${r.url}" controls autoplay></audio></div>`;
  else if (k === 'pdf') body.innerHTML = `<iframe src="${r.url}#toolbar=0&view=FitH"></iframe>`;
  else if (k === 'text') body.innerHTML = `<pre>${esc(r.text)}${r.truncated ? '\n\n…' : ''}</pre>`;
  else {
    body.innerHTML = `<div class="info">${visual(it)}<span>${it.isDir ? (r && r.count != null ? plural(r.count, 'elemento', 'elementos') : 'Carpeta') : 'Sin vista previa para este tipo de archivo'}</span><button class="btn" data-a="open">${icon('open')}Abrir</button></div>`;
    if (ICONIC.has(it.ext)) { const u = await A('fs.thumb', it.path, 256, { icon: true }); if (typeof u === 'string' && seq === qlSeq) $('.info > :first-child', body).outerHTML = `<img class="ico" src="${u}" alt="">`; }
  }
}
function qlStep(d) {
  const cur = S.focus >= 0 ? S.focus : 0, n = Math.max(0, Math.min(S.shown.length - 1, cur + d));
  if (n === cur && S.sel.size === 1) return;
  selectOnly(n); reveal(n); qlShow();
}
ql.addEventListener('click', (e) => {
  if (e.target === ql) return quickLook(false);
  if (e.target.closest('.ql-x')) return quickLook(false);
  if (e.target.closest('.ql-open') || e.target.closest('[data-a="open"]')) { quickLook(false); return openItems(selItems()); }
  if (e.target.closest('.ql-nav.prev')) qlStep(-1);
  if (e.target.closest('.ql-nav.next')) qlStep(1);
});

/* ---------------- Busqueda ---------------- */
let qT;
async function runSearch(q) {
  const seq = ++loadSeq;
  S.search = q; crumbs(); markPlace();
  itemsEl.innerHTML = `<div class="loading"><i class="spin"></i>Buscando «${esc(q)}»…</div>`;
  const base = S.searchBase || S.dir;
  const r = await A('fs.search', base, q, { hidden: S.hidden });
  if (seq !== loadSeq || S.search !== q) return;
  S.items = r.items || []; S.sel.clear(); S.anchor = S.focus = -1;
  render(true);
  if (r.partial) toast('Búsqueda limitada: mostrando los primeros resultados');
}
$('#q').addEventListener('input', (e) => {
  clearTimeout(qT);
  const q = e.target.value.trim();
  qT = setTimeout(() => {
    if (!q) { if (S.search) { S.search = null; go(S.searchBase || S.dir, { push: false }); S.searchBase = null; } return; }
    if (!S.search) S.searchBase = S.dir;
    runSearch(q);
  }, 260);
});
$('#q').addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { e.target.value = ''; e.target.dispatchEvent(new Event('input')); scroller.focus(); }
  if (e.key === 'ArrowDown' || e.key === 'Enter') { e.preventDefault(); scroller.focus(); if (S.shown.length && S.focus < 0) selectOnly(0); }
});

/* ---------------- Teclado ---------------- */
function cols() {
  if (S.view === 'list') return 1;
  const els = itemsEl.children; if (!els.length) return 1;
  const top = els[0].offsetTop; let n = 0;
  for (const el of els) { if (el.offsetTop !== top) break; n++; }
  return Math.max(1, n);
}
let typed = '', typedT;
document.addEventListener('keydown', (e) => {
  const inInput = e.target.closest && e.target.closest('input');
  const k = e.key, ctrl = e.ctrlKey || e.metaKey;
  if (menu.classList.contains('show')) { if (k === 'Escape') hideMenu(); return; }
  if (qlOpen) {
    if (k === ' ' || k === 'Escape') { e.preventDefault(); return quickLook(false); }
    if (k === 'ArrowLeft' || k === 'ArrowUp') { e.preventDefault(); return qlStep(k === 'ArrowUp' ? -cols() : -1); }
    if (k === 'ArrowRight' || k === 'ArrowDown') { e.preventDefault(); return qlStep(k === 'ArrowDown' ? cols() : 1); }
    if (k === 'Enter') { quickLook(false); return openItems(selItems()); }
    return;
  }
  if (ctrl && k.toLowerCase() === 'f') { e.preventDefault(); $('#q').focus(); $('#q').select(); return; }
  if (k === 'F5') { e.preventDefault(); return refresh(); }
  if (inInput) return;
  if (e.altKey && k === 'ArrowLeft') return histGo(-1);
  if (e.altKey && k === 'ArrowRight') return histGo(1);
  if (e.altKey && k === 'ArrowUp') return goUp();
  if (ctrl && e.shiftKey && k.toLowerCase() === 'n') { e.preventDefault(); return newFolder(); }
  if (ctrl && e.shiftKey && k.toLowerCase() === 'c') { e.preventDefault(); return copyPaths(); }
  if (ctrl) {
    const l = k.toLowerCase();
    if (l === 'a') { e.preventDefault(); S.sel = new Set(S.shown.map((i) => i.path)); return paintSel(); }
    if (l === 'c') return setClip('copy');
    if (l === 'x') return setClip('cut');
    if (l === 'v') return paste();
    if (l === 'h') { e.preventDefault(); return toggleHidden(); }
    if (l === 'p') { e.preventDefault(); return setPrev(!S.prev); }
    if (k === '1') return setView('grid');
    if (k === '2') return setView('list');
  }
  if (k === ' ') { e.preventDefault(); return quickLook(true); }
  if (k === 'Enter') return openItems(selItems());
  if (k === 'Backspace') { e.preventDefault(); return S.search ? (($('#q').value = ''), $('#q').dispatchEvent(new Event('input'))) : goUp(); }
  if (k === 'F2') { e.preventDefault(); return rename(S.focus >= 0 && S.sel.has(S.shown[S.focus]?.path) ? S.focus : S.shown.findIndex((i) => S.sel.has(i.path))); }
  if (k === 'Delete') return trash();
  if (k === 'Escape') { if (S.clip) { S.clip = null; $$('.cut').forEach((x) => x.classList.remove('cut')); status(); } S.sel.clear(); return paintSel(); }
  const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -cols(), ArrowDown: cols(), Home: -1e9, End: 1e9, PageUp: -cols() * 5, PageDown: cols() * 5 };
  if (k in moves && S.shown.length) {
    e.preventDefault();
    if (S.view === 'list' && (k === 'ArrowLeft' || k === 'ArrowRight')) return;
    const n = S.focus < 0 ? 0 : Math.max(0, Math.min(S.shown.length - 1, S.focus + moves[k]));
    if (e.shiftKey) { if (S.anchor < 0) S.anchor = S.focus < 0 ? 0 : S.focus; selectRange(S.anchor, n, false); } else selectOnly(n);
    return reveal(n);
  }
  // Escribir para saltar al elemento por nombre
  if (k.length === 1 && !ctrl && !e.altKey) {
    typed += k.toLowerCase(); clearTimeout(typedT); typedT = setTimeout(() => (typed = ''), 700);
    const i = S.shown.findIndex((x) => x.name.toLowerCase().startsWith(typed));
    if (i >= 0) { selectOnly(i); reveal(i); }
  }
});
addEventListener('mouseup', (e) => { if (e.button === 3) histGo(-1); if (e.button === 4) histGo(1); });

// Al volver a la ventana, refresca por si algo cambio fuera
let lastFocus = Date.now();
addEventListener('focus', () => { if (Date.now() - lastFocus > 1500 && !renaming && !S.search && S.dir) refresh(); lastFocus = Date.now(); });
addEventListener('blur', () => { lastFocus = Date.now(); });

/* ---------------- Arranque ---------------- */
document.body.classList.add(S.view === 'list' ? 'v-list' : 'v-grid');
setPrev(S.prev);
await loadPlaces();
const qp = new URLSearchParams(location.search);
const start = qp.get('dir') || PLACES.favs.find((f) => f.id === 'home')?.path || (await A('fs.home'));
await go(start);
scroller.focus({ preventScroll: true });
window.__archivos = { S, go, quickLook, showMenu, setView, setPrev, selectOnly, render }; // ayuda para depurar
})();
