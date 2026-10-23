// Tienda Antuan: descubre apps, marca varias e instálalas de golpe (estilo Ninite), sigue el progreso,
// actualiza todo y abre paquetes .umbra (la ventana se abre con ?paquete=<ruta>).
(async () => {
'use strict';
const U = window.umbra;
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const T = (n, ...a) => U.ask('tienda.' + n, ...a);
const root = document.documentElement;
const params = new URLSearchParams(location.search);
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Glifos extra (solo para esta ventana).
Object.assign(window.ICONS, {
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  shield: '<path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
  box: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
  usb: '<path d="M12 3v14M12 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM8 8l4-5 4 5M7 12v2l5 3M17 10v4l-5 3"/>',
  link: '<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>'
});

/* ---------------------------------------------------------------- Aspecto (acento de Antuan) */
let C = null;
try { C = await U.ask('config'); } catch {}
function applyLook() {
  if (!C) return;
  if (C.accent && /^#[0-9a-f]{6}$/i.test(C.accent)) {
    root.style.setProperty('--accent', C.accent);
    root.style.setProperty('--accent-rgb', rgb(C.accent));
  }
  root.classList.toggle('reduce-motion', !!C.reduceMotion);
}
function rgb(hex) { const n = parseInt(String(hex || '#9db4ff').slice(1), 16) || 0x9db4ff; return [(n >> 16) & 255, (n >> 8) & 255, n & 255].join(', '); }
applyLook();
U.on('config-changed', (p) => { C = Object.assign(C || {}, p); applyLook(); });

let toastT;
function toast(t, ok = true) { const el = $('#toast'); el.innerHTML = (ok ? icon('check') : '') + `<span>${esc(t)}</span>`; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 2800); }
const fmtB = (b) => b > 1 << 30 ? (b / (1 << 30)).toFixed(1) + ' GB' : b > 1 << 20 ? (b / (1 << 20)).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';

/* ---------------------------------------------------------------- Estado */
let CAT = { apps: [], categorias: [], packs: [], umbra: [], sistema: null };
let porId = new Map();
const sel = new Set();
const jobs = new Map(); // id -> último evento de progreso
const iconosExtra = new Map(); // ids "umbra:..." -> { icono, color }
let vista = null, verTodas = false;
try { JSON.parse(sessionStorage.getItem('tienda.sel') || '[]').forEach((x) => sel.add(x)); } catch {}

const NAV_FIJA = [['Tienda'], ['inicio', 'Descubrir', 'home']];
const NAV_FIN = [['Tu biblioteca'], ['descargas', 'Descargas', 'down'], ['updates', 'Actualizaciones', 'restart'], ['instaladas', 'Instaladas', 'grid']];
function pintarNav() {
  const cats = CAT.categorias.map((c) => ['cat:' + c.id, c.nombre, c.icono]);
  const nav = [...NAV_FIJA, ...(paqueteRuta ? [['paquete', 'Paquete .umbra', 'box']] : []), ['Categorías'], ...cats, ...NAV_FIN];
  $('#nav').innerHTML = nav.map((n) => n.length === 1 ? `<div class="cap">${n[0]}</div>` : `<button class="nav-b" data-v="${n[0]}">${icon(n[2])}<span>${n[1]}</span></button>`).join('');
  marcarNav(); badgeDescargas();
}
function marcarNav() { $$('.nav-b').forEach((b) => b.setAttribute('aria-current', b.dataset.v === vista)); }
$('#nav').addEventListener('click', (e) => { const b = e.target.closest('.nav-b'); if (b) { $('#q').value = ''; go(b.dataset.v); } });

/* ---------------------------------------------------------------- Piezas */
function ico(a, s = 56, extra = '') {
  const c = rgb(a && a.color || '#9db4ff');
  const i = a && a.icono;
  let dentro;
  if (i && /^(https?:|data:|file:)/.test(i)) dentro = `<img src="${esc(i)}" alt="" loading="lazy" data-l="${esc((a.nombre || '?')[0])}">`;
  else if (i && window.ICONS[i]) dentro = icon(i);
  else dentro = `<span class="mono">${esc((a && a.nombre || '?')[0])}</span>`;
  return `<span class="ico ${extra}" style="--c-rgb:${c};--s:${s}px">${dentro}${a && a.instalado && s >= 46 && extra !== 'hico' ? `<i class="tick">${icon('check')}</i>` : ''}</span>`;
}
// Si un icono remoto falla (sin red), se muestra la inicial sobre su color.
document.addEventListener('error', (e) => {
  const im = e.target;
  if (im.tagName === 'IMG' && im.closest('.ico')) im.outerHTML = `<span class="mono">${esc(im.dataset.l || '?')}</span>`;
}, true);

function enCurso(id) { const j = jobs.get(id); return j && ['esperando', 'descargando', 'instalando'].includes(j.estado) ? j : null; }
function accion(a) {
  const j = enCurso(a.id);
  if (j) {
    if (j.estado === 'esperando') return `<span class="prog wait" title="En cola"><svg viewBox="0 0 30 30"><circle class="bg" cx="15" cy="15" r="13"/><circle class="fg" cx="15" cy="15" r="13"/></svg></span>`;
    return `<span class="prog ${j.pct == null ? 'ind' : ''}" style="--p:${j.pct || 0}" title="${esc(j.mensaje || '')}"><svg viewBox="0 0 30 30"><circle class="bg" cx="15" cy="15" r="13"/><circle class="fg" cx="15" cy="15" r="13"/></svg><i></i></span>`;
  }
  if (a.instalado) return a.cli ? `<span class="pill ok">${icon('check')}Instalada</span>` : `<button class="get open" data-act="abrir">Abrir</button>`;
  if (!a.disponible) return a.enlace ? `<button class="get" data-act="web">${icon('link')}Web</button>` : `<span class="get na">No disponible</span>`;
  if (sel.has(a.id)) return `<button class="get marked" data-act="desmarcar">${icon('check')}Marcada</button>`;
  return `<button class="get" data-act="obtener">Obtener</button>`;
}
const fuenteTxt = { winget: 'winget', flatpak: 'Flathub', apt: 'apt', web: 'App web', script: 'Instalador oficial' };
function tile(a) {
  const cls = ['app', sel.has(a.id) ? 'sel' : '', a.instalado ? 'inst' : '', !a.disponible && !a.instalado ? 'off' : ''].join(' ');
  return `<div class="${cls}" data-id="${a.id}" role="button" tabindex="0" aria-pressed="${sel.has(a.id)}">
    <span class="chk">${icon('check')}</span>${ico(a)}
    <div class="tx"><b>${esc(a.nombre)}</b><span>${esc(a.descripcion)}</span></div>
    <div class="ac">${accion(a)}</div></div>`;
}
function refrescarTile(id) {
  const a = porId.get(id); if (!a) return;
  for (const el of $$(`.app[data-id="${CSS.escape(id)}"]`)) {
    el.classList.toggle('sel', sel.has(id)); el.classList.toggle('inst', !!a.instalado); el.classList.toggle('off', !a.disponible && !a.instalado);
    el.setAttribute('aria-pressed', sel.has(id));
    const ac = $('.ac', el), j = enCurso(id), prog = $('.prog', ac);
    // Mismo estado de anillo: solo se mueve el porcentaje (así la transición es suave).
    if (j && prog && j.estado !== 'esperando' && !prog.classList.contains('wait') && (j.pct == null) === prog.classList.contains('ind')) prog.style.setProperty('--p', j.pct || 0);
    else ac.innerHTML = accion(a);
    const tick = $('.tick', el);
    if (a.instalado && !tick) $('.ico', el).insertAdjacentHTML('beforeend', `<i class="tick">${icon('check')}</i>`);
    if (!a.instalado && tick) tick.remove();
  }
}
const refrescarTiles = () => porId.forEach((_, id) => refrescarTile(id));
const skel = (n) => Array.from({ length: n }, () => '<div class="sk"></div>').join('');
function mount(html) {
  const pane = $('#pane');
  pane.innerHTML = `<div class="stagger">${html}</div>`;
  $$('.stagger > *', pane).forEach((c, i) => c.style.setProperty('--i', Math.min(i, 12)));
}
const cabecera = (t, d) => { $('#title').textContent = t; $('#sub').textContent = d || ''; };
const ordenar = (lista) => lista.slice().sort((x, y) => (y.disponible - x.disponible) || (!!x.instalado - !!y.instalado));

/* ---------------------------------------------------------------- Selección (modo pack) */
function guardarSel() { try { sessionStorage.setItem('tienda.sel', JSON.stringify([...sel])); } catch {} }
function alternar(id, forzar) {
  const a = porId.get(id);
  if (!a || !a.disponible || a.instalado || enCurso(id)) return false;
  const on = forzar ?? !sel.has(id);
  on ? sel.add(id) : sel.delete(id);
  refrescarTile(id); guardarSel(); pintarPack(); return true;
}
function pintarPack() {
  for (const id of [...sel]) { const a = porId.get(id); if (a && (a.instalado || !a.disponible)) sel.delete(id); }
  const n = sel.size, bar = $('#pack');
  document.body.classList.toggle('packing', n > 0);
  bar.classList.toggle('show', n > 0); bar.setAttribute('aria-hidden', n === 0);
  if (!n) return;
  const lista = [...sel].map((id) => porId.get(id)).filter(Boolean);
  $('#packIcons').innerHTML = lista.slice(0, 5).map((a) => ico(a, 36)).join('') + (n > 5 ? `<span class="more">+${n - 5}</span>` : '');
  $('#packT').textContent = n === 1 ? '1 app seleccionada' : `${n} apps seleccionadas`;
  $('#packD').textContent = lista.map((a) => a.nombre).join(', ');
  const go = $('#packGo');
  go.innerHTML = `${icon('down')}Instalar ${n} ${n === 1 ? 'app' : 'apps'}`;
  go.classList.remove('bump'); void go.offsetWidth; go.classList.add('bump');
  $$('.packc').forEach((p) => pintarPackCard(p));
}
$('#packClear').addEventListener('click', () => { const ids = [...sel]; sel.clear(); ids.forEach(refrescarTile); guardarSel(); pintarPack(); $$('.packc').forEach(pintarPackCard); });
$('#packGo').addEventListener('click', async () => {
  const ids = [...sel];
  if (!ids.length) return;
  sel.clear(); guardarSel(); pintarPack();
  ids.forEach((id) => jobs.set(id, { id, estado: 'esperando', pct: 0, nombre: porId.get(id).nombre, mensaje: 'En cola' }));
  ids.forEach(refrescarTile);
  const r = await T('instalar', ids);
  toast(`Instalando ${r && r.encolados ? r.encolados.length : ids.length} apps, una tras otra`);
  go('descargas');
});

/* ---------------------------------------------------------------- Acciones */
async function instalarUna(id) {
  const a = porId.get(id);
  jobs.set(id, { id, estado: 'esperando', pct: 0, nombre: a.nombre, mensaje: 'En cola' });
  sel.delete(id); guardarSel(); pintarPack(); refrescarTile(id); actualizarMini();
  await T('instalar', [id]);
}
async function abrir(id) {
  const r = await T('abrir', id);
  if (r && r.ok) toast('Abriendo ' + ((porId.get(id) || {}).nombre || 'la app') + '…');
  else toast((r && r.error) || 'No se pudo abrir', false);
}
async function desinstalar(id) {
  const a = porId.get(id) || CAT.umbra.find((u) => 'umbra:' + u.id === id);
  toast('Desinstalando ' + (a ? a.nombre : id) + '…');
  const r = await T('desinstalar', id);
  if (r && r.ok) { await recargar(); if (vista === 'instaladas') go('instaladas'); }
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  const tileEl = e.target.closest('.app');
  const id = (b && b.dataset.id) || (tileEl && tileEl.dataset.id);
  if (b) {
    e.stopPropagation();
    const act = b.dataset.act;
    if (act === 'obtener') instalarUna(id);
    else if (act === 'abrir') abrir(id);
    else if (act === 'web') U.cmd('tienda.web', id);
    else if (act === 'desmarcar') alternar(id, false);
    else if (act === 'marcar') alternar(id, true);
    else if (act === 'desinstalar') desinstalar(id);
    return;
  }
  if (tileEl && !e.target.closest('.ac')) alternar(id);
});
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey && e.key.toLowerCase() === 'k') || (e.key === '/' && document.activeElement !== $('#q'))) { e.preventDefault(); $('#q').focus(); $('#q').select(); return; }
  if (e.key === 'Escape' && document.activeElement === $('#q')) { $('#q').value = ''; $('#q').blur(); go(ultimaVista || 'inicio'); return; }
  const t = e.target.closest && e.target.closest('.app');
  if (t && (e.key === ' ' || e.key === 'Enter') && e.target === t) { e.preventDefault(); alternar(t.dataset.id); }
});

/* ---------------------------------------------------------------- Vistas */
let heroI = 0, heroT = null, ultimaVista = null, heroLista = [];
const VISTAS = {
  inicio() {
    const so = CAT.sistema ? CAT.sistema.so : '';
    const gestor = CAT.sistema && CAT.sistema.gestor;
    cabecera('Descubrir', gestor ? `Marca las apps que quieras e instálalas todas de una vez · vía ${fuenteTxt[gestor] || gestor}` : so ? 'No hay gestor de paquetes disponible en este sistema' : 'Cargando catálogo…');
    const dest = CAT.apps.filter((a) => a.destacado && a.disponible);
    const destacadas = dest.length ? dest : CAT.apps.filter((a) => a.destacado);
    const packs = CAT.packs.map((p) => {
      const apps = p.apps.map((id) => porId.get(id)).filter((a) => a && a.disponible);
      return `<button class="packc" data-pack="${p.id}" style="--c-rgb:${rgb(p.color)}"><span class="pi">${icon(p.icono)}</span><b>${esc(p.nombre)}</b><span class="pd">${esc(p.descripcion)}</span>
        <span class="ministack">${apps.slice(0, 6).map((a) => ico(a, 26)).join('')}<em>${apps.length} apps</em></span><span class="go">${icon('plus')}</span></button>`;
    }).join('');
    const filas = CAT.categorias.map((c) => {
      const apps = ordenar(CAT.apps.filter((a) => a.categoria === c.id)).slice(0, 6);
      return `<section class="section"><div class="sh"><h2><span class="gi">${icon(c.icono)}</span>${esc(c.nombre)}</h2><button class="more" data-go="cat:${c.id}">Ver todo${icon('chevron')}</button></div><div class="apps">${apps.map(tile).join('')}</div></section>`;
    }).join('');
    mount(`<div class="hero" id="hero"></div>
      <section class="section"><div class="sh"><h2><span class="gi">${icon('spark')}</span>Packs en un clic</h2></div><div class="packs">${packs}</div></section>${filas}`);
    $$('.packc').forEach(pintarPackCard);
    heroLista = destacadas; pintarHero(heroLista);
    clearInterval(heroT);
    heroT = setInterval(() => { if (!$('#hero') || $('#hero').matches(':hover')) return; heroI++; pintarHero(heroLista); }, 7000);
  },
  descargas() { cabecera('Descargas', 'Las apps se instalan una tras otra, en silencio.'); pintarDescargas(true); },
  async updates() {
    cabecera('Actualizaciones', 'Mantén tus apps al día con un clic.');
    mount(`<div class="sk" style="height:94px;border-radius:20px"></div><div class="ups">${skel(4)}</div>`);
    const r = await T('actualizables');
    if (vista !== 'updates') return;
    const apps = (r && r.apps) || [];
    const todoEnCurso = enCurso('*todo');
    mount(`<div class="uphero ${apps.length ? 'pend' : ''}"><span class="ubig">${icon(apps.length ? 'restart' : 'shield')}</span>
        <div><h2>${apps.length ? `${apps.length} ${apps.length === 1 ? 'actualización disponible' : 'actualizaciones disponibles'}` : 'Todo está al día'}</h2>
        <p>${apps.length ? 'Se actualizan en segundo plano; puedes seguir usando el PC.' : 'Comprobado ahora mismo. Te avisaremos cuando haya novedades.'}</p></div>
        ${apps.length ? `<button class="btn primary big" id="upAll" ${todoEnCurso ? 'disabled' : ''}>${icon('down')}${todoEnCurso ? 'Actualizando…' : 'Actualizar todo'}</button>` : `<button class="btn" id="upRe">${icon('restart')}Comprobar</button>`}</div>
      <div class="ups">${apps.map((u) => `<div class="up" data-ref="${esc(u.id)}">${ico({ nombre: u.nombre, icono: u.icono, color: u.color || '#9db4ff' }, 40)}
        <div class="tx"><b>${esc(u.nombre)}</b><span>${esc(fuenteTxt[u.fuente] || u.fuente)} · ${esc(u.idFuente)}</span></div>
        <span class="vers">${esc(u.version || '—')}${icon('arrow')}<b>${esc(u.nueva)}</b></span>
        <button class="btn" data-up="${esc(u.catalogo ? u.id : u.fuente + ':' + u.idFuente)}" data-n="${esc(u.nombre)}">Actualizar</button></div>`).join('')}</div>`);
    const all = $('#upAll');
    if (all) all.addEventListener('click', async () => { all.disabled = true; all.innerHTML = `${icon('down')}Actualizando…`; T('actualizarTodo'); toast('Actualizando todas las apps…'); go('descargas'); });
    const re = $('#upRe'); if (re) re.addEventListener('click', () => go('updates'));
    $$('[data-up]').forEach((b) => b.addEventListener('click', () => { b.disabled = true; b.textContent = 'En cola'; T('actualizar', b.dataset.up, b.dataset.n); }));
  },
  instaladas() {
    cabecera('Instaladas', 'Lo que ya tienes del catálogo y tus paquetes .umbra.');
    const apps = CAT.apps.filter((a) => a.instalado);
    const um = CAT.umbra || [];
    if (!apps.length && !um.length) return mount(vacio('grid', 'Aún no hay nada por aquí', 'Las apps que instales desde la Tienda aparecerán aquí.'));
    const tUmbra = (u) => `<div class="app inst" data-uid="umbra:${esc(u.id)}">${ico({ ...u, instalado: true, color: u.color || '#9db4ff' })}
      <div class="tx"><b>${esc(u.nombre)}</b><span>${esc(u.descripcion || 'Paquete .umbra')} · v${esc(u.version)}</span></div>
      <div class="ac"><button class="get open" data-act="abrir" data-id="umbra:${esc(u.id)}">Abrir</button></div></div>`;
    mount(`${apps.length ? `<section class="section" style="margin-top:4px"><div class="sh"><h2><span class="gi">${icon('bag')}</span>Del catálogo</h2><span class="more" style="pointer-events:none">${apps.length}</span></div><div class="apps">${apps.map(tile).join('')}</div></section>` : ''}
      ${um.length ? `<section class="section"><div class="sh"><h2><span class="gi">${icon('box')}</span>Paquetes .umbra</h2></div><div class="apps">${um.map(tUmbra).join('')}</div></section>` : ''}`);
  },
  paquete() { pintarPaquete(); }
};
function vacio(ic, t, d) { return `<div class="empty"><span class="big">${icon(ic)}</span><b>${esc(t)}</b><span>${esc(d)}</span></div>`; }

function vistaCategoria(cid) {
  const c = CAT.categorias.find((x) => x.id === cid);
  if (!c) return go('inicio');
  const apps = ordenar(CAT.apps.filter((a) => a.categoria === cid));
  const disp = apps.filter((a) => a.disponible && !a.instalado);
  cabecera(c.nombre, `${apps.length} apps · ${apps.filter((a) => a.disponible).length} disponibles en este sistema`);
  mount(`<div class="sh" style="margin-top:4px"><h2><span class="gi">${icon(c.icono)}</span>Todas</h2>${disp.length ? `<button class="more" id="selAll">${icon('check')}Marcar todas</button>` : ''}</div><div class="apps">${apps.map(tile).join('')}</div>`);
  const b = $('#selAll'); if (b) b.addEventListener('click', () => { const todas = disp.every((a) => sel.has(a.id)); disp.forEach((a) => alternar(a.id, !todas)); });
}

function buscar(q) {
  const n = norm(q).trim();
  if (!n) return go(ultimaVista || 'inicio');
  if (vista !== 'buscar') ultimaVista = vista;
  vista = 'buscar'; marcarNav(); clearInterval(heroT);
  const cats = new Map(CAT.categorias.map((c) => [c.id, norm(c.nombre)]));
  const pal = n.split(/\s+/);
  const res = CAT.apps.map((a) => {
    const nom = norm(a.nombre), txt = `${nom} ${norm(a.descripcion)} ${cats.get(a.categoria)} ${a.id} ${Object.values(a.fuentes || {}).join(' ').toLowerCase()}`;
    if (!pal.every((p) => txt.includes(p))) return null;
    return { a, s: nom.startsWith(n) ? 0 : nom.includes(n) ? 1 : 2 };
  }).filter(Boolean).sort((x, y) => x.s - y.s || (y.a.disponible - x.a.disponible)).map((x) => x.a);
  cabecera(`Resultados para «${q.trim()}»`, res.length ? `${res.length} ${res.length === 1 ? 'app' : 'apps'}` : 'Sin resultados');
  const pane = $('#pane');
  pane.innerHTML = res.length ? `<div class="apps stagger">${res.map(tile).join('')}</div>` : vacio('search', 'No encontramos esa app', 'Prueba con otro nombre o explora las categorías.');
  $$('.stagger > *', pane).forEach((c, i) => c.style.setProperty('--i', Math.min(i, 12)));
}
let qT;
$('#q').addEventListener('input', () => { clearTimeout(qT); qT = setTimeout(() => buscar($('#q').value), 90); });
$('#sIc').innerHTML = icon('search');

function pintarHero(lista) {
  const h = $('#hero'); if (!h || !lista.length) return;
  const a = lista[((heroI % lista.length) + lista.length) % lista.length];
  h.style.setProperty('--c-rgb', rgb(a.color));
  const btn = enCurso(a.id) ? `<button class="btn primary big" disabled>${icon('down')}Instalando…</button>`
    : a.instalado ? `<button class="btn primary big" data-act="abrir" data-id="${a.id}">Abrir</button>`
    : a.disponible ? `<button class="btn primary big" data-act="obtener" data-id="${a.id}">${icon('down')}Obtener</button><button class="btn big" data-act="${sel.has(a.id) ? 'desmarcar' : 'marcar'}" data-id="${a.id}" style="background:rgba(255,255,255,.12)">${sel.has(a.id) ? icon('check') + 'En el pack' : icon('plus') + 'Añadir al pack'}</button>`
    : `<span class="pill">No disponible en este sistema</span>`;
  const cat = CAT.categorias.find((c) => c.id === a.categoria);
  h.innerHTML = `<div class="hin"><div class="htx"><span class="lab">${icon('spark')}Destacado · ${esc(cat ? cat.nombre : '')}</span><h2>${esc(a.nombre)}</h2><p>${esc(a.destacado || a.descripcion)}</p><div class="btns">${btn}</div></div>${ico(a, 150, 'hico')}</div>
    <div class="dots">${lista.map((_, i) => `<button data-h="${i}" aria-current="${i === ((heroI % lista.length) + lista.length) % lista.length}" aria-label="Destacado ${i + 1}"></button>`).join('')}</div>
    <div class="harrows"><button class="l" data-hd="-1" aria-label="Anterior">${icon('chevron')}</button><button data-hd="1" aria-label="Siguiente">${icon('chevron')}</button></div>`;
  h.onclick = (e) => {
    const d = e.target.closest('[data-h]'), m = e.target.closest('[data-hd]');
    if (d) { heroI = +d.dataset.h; pintarHero(lista); }
    if (m) { heroI += +m.dataset.hd; pintarHero(lista); }
    if (e.target.closest('[data-act]')) setTimeout(() => pintarHero(lista), 50);
  };
}

function pintarPackCard(el) {
  const p = CAT.packs.find((x) => x.id === el.dataset.pack); if (!p) return;
  const libres = p.apps.map((id) => porId.get(id)).filter((a) => a && a.disponible && !a.instalado);
  const on = libres.length > 0 && libres.every((a) => sel.has(a.id));
  el.classList.toggle('on', on);
  $('.go', el).innerHTML = icon(on ? 'check' : 'plus');
}
document.addEventListener('click', (e) => {
  const p = e.target.closest('.packc');
  if (p) {
    const pk = CAT.packs.find((x) => x.id === p.dataset.pack);
    const libres = pk.apps.map((id) => porId.get(id)).filter((a) => a && a.disponible && !a.instalado && !enCurso(a.id));
    if (!libres.length) return toast('Ya tienes todo este pack', true);
    const todas = libres.every((a) => sel.has(a.id));
    libres.forEach((a) => alternar(a.id, !todas));
    pintarPackCard(p);
    if (!todas) toast(`Pack «${pk.nombre}»: ${libres.length} apps marcadas`);
  }
  const g = e.target.closest('[data-go]');
  if (g) go(g.dataset.go);
});

/* ---------------------------------------------------------------- Descargas */
function infoJob(j) {
  const a = porId.get(j.id);
  if (a) return a;
  if (j.id === '*todo') return { nombre: 'Actualizar todo', icono: 'restart', color: '#7ee0b5' };
  const x = iconosExtra.get(j.id) || {};
  return { nombre: j.nombre || j.id, icono: x.icono || 'box', color: x.color || '#9db4ff' };
}
const ESTADO = { esperando: ['En cola', ''], descargando: ['Descargando', 'acc'], instalando: ['Instalando', 'acc'], hecho: ['Listo', 'ok'], error: ['Error', 'bad'] };
function filaDl(j) {
  const a = infoJob(j), [et, ec] = ESTADO[j.estado] || ['', ''];
  return `<div class="dl" data-j="${esc(j.id)}">${ico({ ...a, instalado: false }, 46)}
    <div class="tx"><div class="line"><b>${esc(a.nombre)}</b><span class="pill ${ec}">${et}</span><span class="pct">${j.pct != null && j.estado !== 'hecho' && j.estado !== 'esperando' && j.estado !== 'error' ? j.pct + ' %' : ''}</span></div>
    <div class="msg">${esc(j.mensaje || '')}</div>${barra(j)}</div>
    ${j.estado === 'hecho' && a.id && porId.get(a.id) && !a.cli && j.accion !== 'desinstalar' ? `<button class="get open" data-act="abrir" data-id="${a.id}">Abrir</button>` : j.estado === 'hecho' && String(j.id).startsWith('umbra:') ? `<button class="get open" data-act="abrir" data-id="${esc(j.id)}">Abrir</button>` : '<span></span>'}</div>`;
}
function barra(j) {
  const cls = j.estado === 'hecho' ? 'ok' : j.estado === 'error' ? 'bad' : j.estado === 'esperando' ? 'wait' : j.pct == null ? 'ind' : '';
  return `<div class="pbar ${cls}" style="--p:${j.pct || 0}%"><i></i></div>`;
}
function resumen() {
  const l = [...jobs.values()];
  const activos = l.filter((j) => ['esperando', 'descargando', 'instalando'].includes(j.estado));
  const hechos = l.filter((j) => j.estado === 'hecho').length, errores = l.filter((j) => j.estado === 'error').length;
  const pct = l.length ? l.reduce((s, j) => s + (j.estado === 'hecho' || j.estado === 'error' ? 100 : j.estado === 'esperando' ? 0 : j.pct == null ? 50 : j.pct), 0) / l.length : 0;
  const actual = l.find((j) => j.estado === 'descargando' || j.estado === 'instalando');
  return { l, activos, hechos, errores, pct, actual };
}
function pintarDescargas(completo) {
  if (vista !== 'descargas') return;
  const r = resumen();
  if (!r.l.length) return mount(vacio('down', 'No hay descargas', 'Marca unas cuantas apps y pulsa «Instalar».'));
  const head = `<div class="dlhead"><span class="ring ${r.actual && r.actual.pct == null && r.activos.length === 1 ? 'ind' : ''}" style="--p:${Math.round(r.pct)}"><svg viewBox="0 0 36 36"><circle class="bg" cx="18" cy="18" r="15"/><circle class="fg" cx="18" cy="18" r="15"/></svg></span>
    <div><h2>${r.activos.length ? `Instalando ${r.hechos + r.errores + 1} de ${r.l.length}` : r.errores ? `Terminado con ${r.errores} ${r.errores === 1 ? 'error' : 'errores'}` : '¡Todo listo!'}</h2>
    <p>${r.actual ? esc(infoJob(r.actual).nombre) + ' · ' + esc(r.actual.mensaje || '') : r.activos.length ? 'Esperando turno…' : `${r.hechos} ${r.hechos === 1 ? 'app instalada' : 'apps instaladas'} correctamente.`}</p></div>
    <div class="btns">${r.activos.length ? `<button class="btn danger" id="dlStop">${icon('stop')}Cancelar</button>` : `<button class="btn" id="dlClear">Limpiar lista</button>`}</div></div>`;
  if (completo || !$('.dlhead')) {
    mount(`<div id="dlh">${head}</div><div class="dls">${r.l.map(filaDl).join('')}</div>`);
  } else {
    $('#dlh').innerHTML = head;
    const cont = $('.dls');
    for (const j of r.l) {
      const el = $(`.dl[data-j="${CSS.escape(j.id)}"]`, cont);
      if (!el) { cont.insertAdjacentHTML('beforeend', filaDl(j)); continue; }
      const [et, ec] = ESTADO[j.estado] || ['', ''];
      const pill = $('.pill', el); if (pill.textContent !== et) { pill.className = 'pill ' + ec; pill.textContent = et; }
      $('.pct', el).textContent = j.pct != null && (j.estado === 'descargando' || j.estado === 'instalando') ? j.pct + ' %' : '';
      $('.msg', el).textContent = j.mensaje || '';
      const pb = $('.pbar', el), cls = j.estado === 'hecho' ? 'ok' : j.estado === 'error' ? 'bad' : j.estado === 'esperando' ? 'wait' : j.pct == null ? 'ind' : '';
      pb.className = 'pbar ' + cls; pb.style.setProperty('--p', (j.pct || 0) + '%');
      if ((j.estado === 'hecho' || j.estado === 'error') && !el.dataset.fin) { el.dataset.fin = 1; el.outerHTML = filaDl(j); }
    }
  }
  const s = $('#dlStop'); if (s) s.onclick = async () => { s.disabled = true; await T('cancelar'); toast('Cancelado', false); };
  const c = $('#dlClear'); if (c) c.onclick = () => { for (const [id, j] of jobs) if (!enCurso(id)) jobs.delete(id); pintarDescargas(true); actualizarMini(); badgeDescargas(); };
}

function actualizarMini() {
  const r = resumen(), m = $('#mini');
  if (!r.activos.length) { m.hidden = true; return; }
  m.hidden = false;
  const ring = $('.ring', m);
  ring.style.setProperty('--p', Math.round(r.pct));
  ring.classList.toggle('ind', !!(r.actual && r.actual.pct == null && r.activos.length === 1));
  $('#miniT').textContent = `Instalando ${r.hechos + r.errores + 1} de ${r.l.length}`;
  $('#miniD').textContent = r.actual ? infoJob(r.actual).nombre + (r.actual.pct != null ? ` · ${r.actual.pct} %` : '') : 'En cola…';
}
$('#mini').addEventListener('click', () => go('descargas'));
function badgeDescargas() {
  const b = $('.nav-b[data-v="descargas"]'); if (!b) return;
  const n = resumen().activos.length;
  let el = $('.n', b);
  if (!n) { if (el) el.remove(); return; }
  if (!el) { b.insertAdjacentHTML('beforeend', '<i class="n"></i>'); el = $('.n', b); }
  el.textContent = n;
}

U.on('tienda-progreso', async (ev) => {
  if (!ev || !ev.id) return;
  const previo = jobs.get(ev.id);
  jobs.set(ev.id, { ...(previo || {}), ...ev });
  const a = porId.get(ev.id);
  if (ev.estado === 'hecho' && a) {
    if (ev.accion === 'desinstalar') a.instalado = false;
    else if (ev.accion !== 'actualizar' && ev.accion !== 'actualizarTodo') a.instalado = true;
    if (!previo || previo.estado !== 'hecho') toast(`${a.nombre}: ${ev.accion === 'desinstalar' ? 'desinstalada' : ev.accion === 'actualizar' ? 'actualizada' : 'instalada'}`);
  }
  if (ev.estado === 'error' && (!previo || previo.estado !== 'error') && ev.mensaje !== 'Cancelado') toast(`${ev.nombre || ev.id}: ${ev.mensaje || 'error'}`, false);
  if (a) refrescarTile(ev.id);
  if (paqueteInfo && ev.id === 'umbra:' + paqueteInfo.manifiesto.id) pintarAccionPaquete();
  pintarDescargas(false); actualizarMini(); badgeDescargas();
  if (vista === 'inicio' && a && $('#hero') && $('#hero h2') && $('#hero h2').textContent === a.nombre && ['hecho', 'error', 'descargando'].includes(ev.estado) && (!previo || previo.estado !== ev.estado)) pintarHero(heroLista);
});

/* ---------------------------------------------------------------- Paquete .umbra */
let paqueteRuta = params.get('paquete'), paqueteInfo = null;
const PERM = {
  red: ['globe', 'Internet', 'Puede conectarse a la red'], archivos: ['folder', 'Tus archivos', 'Leer y escribir en tu carpeta personal', 1],
  descargas: ['down', 'Descargas', 'Acceso a tu carpeta Descargas'], camara: ['camera', 'Cámara', 'Puede usar la cámara', 1], microfono: ['mic', 'Micrófono', 'Puede escuchar el micrófono', 1],
  pantalla: ['image', 'Pantalla', 'Puede capturar lo que ves', 1], notificaciones: ['bell', 'Notificaciones', 'Puede mostrarte avisos'],
  inicio: ['power', 'Arranque', 'Se abre al iniciar sesión'], administrador: ['lock', 'Administrador', 'Pide permisos de administrador', 1], dispositivos: ['usb', 'Dispositivos', 'Mandos, USB y otros periféricos']
};
const TIPO = { appimage: 'AppImage', archivos: 'App portátil', flatpakref: 'Flatpak', winget: 'Vía winget', exe: 'Programa de Windows' };
async function pintarPaquete() {
  cabecera('Paquete .umbra', paqueteRuta ? paqueteRuta.split(/[\\/]/).pop() : '');
  if (!paqueteRuta) return mount(vacio('box', 'Ningún paquete abierto', 'Haz doble clic en un archivo .umbra para verlo aquí.'));
  if (!paqueteInfo) {
    mount(`<div class="sk" style="height:250px;border-radius:24px"></div>`);
    paqueteInfo = await T('leerPaquete', paqueteRuta);
  }
  if (vista !== 'paquete') return;
  const P = paqueteInfo;
  if (!P || P.error) return mount(vacio('info', 'No se puede abrir este paquete', (P && P.error) || 'El archivo no es un .umbra válido.'));
  const m = P.manifiesto;
  const color = m.color || '#9db4ff';
  iconosExtra.set('umbra:' + m.id, { icono: P.icono || 'box', color });
  const perms = m.permisos.length ? m.permisos.map((p) => { const d = PERM[p] || ['info', p, 'Permiso personalizado']; return `<div class="perm ${d[3] ? 'alto' : ''}"><span class="pi">${icon(d[0])}</span><div><b>${esc(d[1])}</b><span>${esc(d[2])}</span></div></div>`; }).join('')
    : `<div class="perm"><span class="pi">${icon('shield')}</span><div><b>Sin permisos especiales</b><span>Solo funciona dentro de su carpeta</span></div></div>`;
  mount(`<div class="pk" style="--c-rgb:${rgb(color)}"><div class="top">
      <span class="ico ${P.icono ? '' : 'glyph'}" style="--c-rgb:${rgb(color)};--s:132px">${P.icono ? `<img src="${P.icono}" alt="">` : icon('box')}</span>
      <div class="meta"><span class="kicker">${icon('box')}Paquete Antuan</span><h2>${esc(m.nombre)}</h2><div class="by">Versión ${esc(m.version)} · ${esc(m.autor)}</div>
        <div class="pills"><span class="pill acc">${esc(TIPO[m.tipo] || m.tipo)}</span>${m.categorias.slice(0, 3).map((c) => `<span class="pill">${esc(c)}</span>`).join('')}${m.licencia ? `<span class="pill">${esc(m.licencia)}</span>` : ''}${P.compatible ? '' : '<span class="pill bad">No compatible</span>'}</div></div>
      <div class="act" id="pkAct"></div></div>
      ${m.descripcion ? `<p class="desc">${esc(m.descripcion)}</p>` : ''}
      ${P.compatible ? '' : `<div class="warnbox">${icon('info')}Este paquete es para ${esc((m.sistemas || []).join(', '))}.</div>`}</div>
    <div class="pkgrid"><div class="card"><h3>${icon('shield')}Permisos</h3><div class="perms">${perms}</div></div>
      <div class="card"><h3>${icon('info')}Información</h3><dl class="kv">
        <dt>Identificador</dt><dd>${esc(m.id)}</dd><dt>Tamaño del paquete</dt><dd>${fmtB(P.tamano)}</dd><dt>Instalado ocupa</dt><dd>${fmtB(P.tamanoInstalado)}</dd>
        <dt>Archivos</dt><dd>${P.archivos}</dd><dt>Contenido</dt><dd>${esc(P.carga)}</dd>${m.web ? `<dt>Web</dt><dd>${esc(m.web)}</dd>` : ''}<dt>Archivo</dt><dd title="${esc(P.ruta)}">${esc(P.ruta.split(/[\\/]/).pop())}</dd></dl></div></div>`);
  pintarAccionPaquete();
}
function pintarAccionPaquete() {
  const el = $('#pkAct'); if (!el || !paqueteInfo || paqueteInfo.error) return;
  const id = 'umbra:' + paqueteInfo.manifiesto.id, j = jobs.get(id);
  const ya = (CAT.umbra || []).find((u) => u.id === paqueteInfo.manifiesto.id);
  if (j && ['esperando', 'descargando', 'instalando'].includes(j.estado)) {
    const bar = $('.pbar', el);
    if (bar) { bar.className = 'pbar ' + (j.estado === 'esperando' ? 'wait' : j.pct == null ? 'ind' : ''); bar.style.setProperty('--p', (j.pct || 0) + '%'); $('small', el).textContent = j.mensaje || 'Instalando…'; return; }
    el.innerHTML = `<button class="btn primary big" disabled>Instalando…</button>${barra(j)}<small>${esc(j.mensaje || '')}</small>`;
  } else if (j && j.estado === 'hecho' && j.accion !== 'desinstalar' || ya && !(j && j.estado === 'error')) {
    el.innerHTML = `<button class="btn primary big" data-act="abrir" data-id="${esc(id)}">Abrir</button><small>${ya && !j ? `Ya instalada (v${esc(ya.version)})` : 'Instalada · añadida al menú'}</small>`;
  } else {
    el.innerHTML = `<button class="btn primary big" id="pkGo" ${paqueteInfo.compatible ? '' : 'disabled'}>${icon('down')}Instalar</button><small>${j && j.estado === 'error' ? esc(j.mensaje) : 'Se añadirá al menú de apps'}</small>`;
    const b = $('#pkGo');
    if (b) b.onclick = async () => {
      jobs.set(id, { id, estado: 'esperando', pct: 0, nombre: paqueteInfo.manifiesto.nombre, mensaje: 'Preparando…' });
      pintarAccionPaquete(); actualizarMini();
      const r = await T('instalarPaquete', paqueteRuta);
      if (r && r.ok) { await recargar(); pintarAccionPaquete(); }
    };
  }
}
U.on('tienda-paquete', (ruta) => { paqueteRuta = ruta; paqueteInfo = null; pintarNav(); go('paquete'); });

/* ---------------------------------------------------------------- Navegación */
function go(v) {
  clearInterval(heroT);
  vista = v; marcarNav();
  $('#pane').scrollTop = 0;
  if (v.startsWith('cat:')) return vistaCategoria(v.slice(4));
  (VISTAS[v] || VISTAS.inicio)();
}
U.on('goto', (v) => go(v));

/* ---------------------------------------------------------------- Arranque */
function cargar(c) {
  CAT = c || CAT;
  porId = new Map(CAT.apps.map((a) => [a.id, a]));
  for (const a of CAT.apps) if (a.trabajo && !jobs.has(a.id)) jobs.set(a.id, a.trabajo);
}
async function recargar() {
  const c = await T('catalogo');
  if (!c) return;
  cargar(c); refrescarTiles(); pintarPack(); $$('.packc').forEach(pintarPackCard);
}

const inicial = paqueteRuta ? 'paquete' : (params.get('v') || 'inicio');
vista = inicial;
mount(`<div class="sk hero-sk"></div><div class="section"><div class="apps">${skel(6)}</div></div>`);
try { const st = await T('estado'); if (st && st.trabajos) st.trabajos.forEach((j) => jobs.set(j.id, j)); } catch {}
cargar(await T('catalogo', { rapido: true }));
pintarNav(); go(inicial); pintarPack(); actualizarMini();
// Segunda pasada con lo instalado (winget list / flatpak list tarda unos segundos la primera vez).
const completo = await T('catalogo');
if (completo) {
  cargar(completo); refrescarTiles(); pintarPack();
  if (vista === 'inicio') { pintarHero(heroLista); $$('.packc').forEach(pintarPackCard); }
  else if (vista === 'instaladas' || vista === 'paquete') go(vista);
  document.body.dataset.listo = '1';
}
})();
