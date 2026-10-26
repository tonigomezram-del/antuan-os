(async () => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const root = document.documentElement;
const U = window.umbra;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const hydrateIcons = (r = document) => $$('[data-icon]', r).forEach((el) => { el.outerHTML = icon(el.dataset.icon); });

const boot = await U.init();
// Antuan OS: lo que solo existe en Windows se oculta o se traduce (el nucleo lleva cada ajuste a su sitio)
const LINUX = (U.plataforma || boot.plataforma) === 'linux';
let S = boot.config;
if (S.liquidGlass === undefined) S.liquidGlass = true;   // el cristal liquido viene activado
let catalog = boot.catalog;
let running = [];
const byId = new Map(catalog.map((a) => [a.id, a]));
const appName = (a) => a.display || a.name;

/* ---------- Estado y apariencia ---------- */
const hexToRgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].join(', '); };
function apply() {
  root.classList.toggle('contrast', !!S.contrast);
  root.classList.toggle('reduce-motion', !!S.reduceMotion);
  root.classList.toggle('big-text', !!S.bigText);
  root.classList.toggle('focus-rings', !!S.focusRings);
  root.style.setProperty('--accent', S.accent);
  root.style.setProperty('--accent-rgb', hexToRgb(S.accent));
  if (!S.contrast) root.style.setProperty('--glass-a', (S.glass / 100).toFixed(2)); else root.style.removeProperty('--glass-a');
  root.style.setProperty('--dock-size', S.dockSize + 'px');
  // Liquid Glass tipo iOS en el dock y la bandeja (con alto contraste se queda el cristal opaco)
  if (window.LiquidGlass) {
    LiquidGlass.ajustar(LiquidGlass.desdeConfig(S));
    if (!S.contrast && S.liquidGlass !== false) { LiquidGlass.iniciar(); LiquidGlass.controles(); } else LiquidGlass.apagar();
  }
  $$('[data-setting]').forEach((el) => {
    const v = S[el.dataset.setting];
    if (el.type === 'range') { el.value = v; paintRange(el); }
    else if (el.classList.contains('switch')) el.setAttribute('aria-checked', !!v);
    else if (el.dataset.v !== undefined) el.setAttribute('aria-pressed', String(v) === el.dataset.v);
    else el.setAttribute('aria-pressed', !!v);
  });
}
function set(patch, quiet) {
  Object.assign(S, patch);
  U.config(patch);
  apply();
  if ('edge' in patch) dockTo(S.edge);
  if ('dockSize' in patch || 'contrast' in patch || 'bigText' in patch) requestAnimationFrame(layout);
  if (!quiet) tick();
}
const paintRange = (el) => el.style.setProperty('--v', ((el.value - el.min) / (el.max - el.min) * 100) + '%');

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-setting]');
  if (!el || el.type === 'range') return;
  const k = el.dataset.setting;
  if (el.dataset.v !== undefined) set({ [k]: el.dataset.v });
  else set({ [k]: !S[k] });
});
document.addEventListener('input', (e) => {
  const el = e.target;
  if (el.matches('input[type=range][data-setting]')) { paintRange(el); set({ [el.dataset.setting]: +el.value }, true); }
});

/* ---------- Sonido ---------- */
let ac, acIdle;
function tick(f = 1250, d = .045, g = .035) {
  if (!S.sounds) return;
  try {
    ac = ac || new AudioContext();
    // El motor de audio se libera tras 8 s sin sonidos (ahorra un proceso entero).
    clearTimeout(acIdle); acIdle = setTimeout(() => { try { ac.close(); } catch { } ac = null; }, 8000);
    const o = ac.createOscillator(), v = ac.createGain(), t = ac.currentTime;
    o.type = 'sine'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * .6, t + d);
    v.gain.setValueAtTime(g, t); v.gain.exponentialRampToValueAtTime(.0001, t + d);
    o.connect(v).connect(ac.destination); o.start(t); o.stop(t + d + .01);
  } catch { }
}
const whoosh = (up) => tick(up ? 520 : 760, .12, .03);

/* ---------- Iconos de app ---------- */
function tile(a, extra = '') {
  if (!a) return `<span class="tile letter ${extra}" style="--h:230">?</span>`;
  // Estilo "Originales": el icono real de la app sobre cristal
  if (S.logoStyle === 'original' && (a.png || a.icon)) {
    const src = a.icon || ('file:///' + encodeURI(a.png.replace(/\\/g, '/')));
    return `<span class="tile img ${extra}"><img src="${src}" alt=""></span>`;
  }
  // Logo original recreado en linea por Antuan
  if (a.logo) return `<span class="tile ${extra}" style="--h:${a.logo.hue};--sat:${a.logo.sat}%"><img class="logo" src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(a.logo.svg)}" alt=""></span>`;
  if (a.glyph) return `<span class="tile ${extra}" style="--h:${a.hue}">${icon(a.glyph)}</span>`;
  if (a.icon) return `<span class="tile img ${extra}"><img src="${a.icon}" alt=""></span>`;
  const n = appName(a);
  let h = 0; for (const c of n) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `<span class="tile letter ${extra}" style="--h:${h}">${esc(n[0] || '?').toUpperCase()}</span>`;
}

/* ---------- Fondo desenfocado detras del cristal ---------- */
let wpCover = null;
if (boot.wallpaper) {
  const img = new Image();
  img.onload = () => { wpCover = { w: img.naturalWidth, h: img.naturalHeight }; root.style.setProperty('--wp-img', `url("${boot.wallpaper}")`); updateWp(); };
  img.src = boot.wallpaper;
}
function updateWp() {
  if (!wpCover) return;
  const W = innerWidth, H = innerHeight, s = Math.max(W / wpCover.w, H / wpCover.h);
  const cw = wpCover.w * s, ch = wpCover.h * s, ox = (W - cw) / 2, oy = (H - ch) / 2;
  for (const wp of $$('.wp')) {
    const r = wp.getBoundingClientRect();
    wp.style.setProperty('--wp-size', `${cw}px ${ch}px`);
    wp.style.setProperty('--wp-pos', `${ox - r.left + 40}px ${oy - r.top + 40}px`);
  }
}
let wpUntil = 0;
function followWp(ms = 750) {
  const start = !wpUntil || performance.now() > wpUntil;
  wpUntil = Math.max(wpUntil, performance.now() + ms);
  if (!start) return;
  const loop = () => { updateWp(); if (performance.now() < wpUntil) requestAnimationFrame(loop); else wpUntil = 0; };
  requestAnimationFrame(loop);
}

/* ---------- Dock ---------- */
const dock = $('#dock'), tray = $('#tray');
let shownKeys = new Set();

function groupFor(appId) { return running.find((g) => g.appId === appId); }
function renderDock() {
  const pinned = (S.pinned || []).map((id) => byId.get(id)).filter(Boolean);
  const items = pinned.map((a) => ({ key: 'a:' + a.id, app: a, group: groupFor(a.id), pinned: true }));
  const extra = running.filter((g) => !g.appId || !S.pinned.includes(g.appId))
    .map((g) => ({ key: 'g:' + g.id, app: g.appId ? byId.get(g.appId) : g, group: g, pinned: false }));
  const html = (list) => list.map((it) => {
    const g = it.group, run = !!g, foc = g && g.windows.some((w) => w.active), multi = g && g.windows.length > 1;
    const name = it.app ? appName(it.app) : 'App';
    return `<button class="dock-item ${run ? 'running' : ''} ${foc ? 'focused' : ''} ${multi ? 'multi' : ''} ${shownKeys.has(it.key) ? '' : 'enter'}" data-key="${esc(it.key)}" data-tip="${esc(name)}" aria-label="${esc(name)}">${tile(it.app)}<span class="dot"></span></button>`;
  }).join('');
  $('#dockApps').innerHTML = html(items);
  $('#dockRunning').innerHTML = html(extra);
  shownKeys = new Set([...items, ...extra].map((i) => i.key));
  dockItems = new Map([...items, ...extra].map((i) => [i.key, i]));
  layout();
}
let dockItems = new Map();

function activate(key, el) {
  const it = dockItems.get(key);
  if (!it) return;
  const g = it.group;
  if (!g) {
    U.launch(it.app.id);
    el.classList.remove('bounce'); void el.offsetWidth; el.classList.add('bounce');
    whoosh(true);
    return;
  }
  const active = g.windows.find((w) => w.active);
  if (active && g.windows.length === 1) { U.window(active.id, 'minimize'); whoosh(false); return; }
  if (active) {
    const i = g.windows.indexOf(active);
    U.window(g.windows[(i + 1) % g.windows.length].id, 'focus');
  } else U.window(g.windows[0].id, 'focus');
  tick();
}

U.on('running', (groups) => { running = groups; renderDock(); });
U.on('catalog', (list) => {
  catalog = list; byId.clear(); for (const a of list) byId.set(a.id, a);
  renderDock();
  if (openP === launcher) renderLauncher();
});
U.on('open-settings', () => openSettings('look'));

/* Menu contextual del dock */
const ctx = $('#ctx');
function openCtx(key, el) {
  const it = dockItems.get(key); if (!it) return;
  const g = it.group, a = it.app, appId = a && a.id && byId.has(a.id) ? a.id : null;
  let h = '';
  if (g) {
    h += `<div class="cap">Ventanas</div>` + g.windows.map((w) => `<button data-w="${w.id}">${icon(w.minimized ? 'min' : 'dock')}<span class="t">${esc(w.title)}</span></button>`).join('') + '<hr>';
  }
  if (appId) h += `<button data-c="new">${icon('plus')}<span class="t">Abrir nueva</span></button>`;
  if (appId) h += S.pinned.includes(appId) ? `<button data-c="unpin">${icon('unpin')}<span class="t">Quitar del dock</span></button>` : `<button data-c="pin">${icon('pin')}<span class="t">Fijar en el dock</span></button>`;
  if (g) h += `<button class="danger" data-c="close">${icon('x')}<span class="t">Cerrar ${g.windows.length > 1 ? 'todas' : 'ventana'}</span></button>`;
  if (!h) return;
  ctx.innerHTML = h;
  ctx.onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.w) U.window(b.dataset.w, 'focus');
    if (b.dataset.c === 'new') U.launch(appId);
    if (b.dataset.c === 'pin') set({ pinned: [...S.pinned, appId] });
    if (b.dataset.c === 'unpin') set({ pinned: S.pinned.filter((p) => p !== appId) });
    if (b.dataset.c === 'close') g.windows.forEach((w) => U.window(w.id, 'close'));
    if (b.dataset.c === 'pin' || b.dataset.c === 'unpin') renderDock();
    closePanels(!b.dataset.w && b.dataset.c !== 'new');
  };
  openPanel(ctx, null, el);
}

dock.addEventListener('click', (e) => {
  if (suppressClick) return;
  const b = e.target.closest('.dock-item[data-key]');
  if (b) { hideTip(); activate(b.dataset.key, b); }
});
dock.addEventListener('contextmenu', (e) => {
  const b = e.target.closest('.dock-item[data-key]');
  e.preventDefault();
  if (b) { hideTip(); openCtx(b.dataset.key, b); }
});
hydrateIcons();

/* Posicion */
const GAP = 12;
function anchors(edge, W = innerWidth, H = innerHeight) {
  return {
    bottom: { d: [W / 2, H - GAP, -50, -100], t: [W - GAP, H - GAP, -100, -100] },
    top: { d: [W / 2, GAP, -50, 0], t: [W - GAP, GAP, -100, 0] },
    left: { d: [GAP, H / 2, 0, -50], t: [GAP, H - GAP, 0, -100] },
    right: { d: [W - GAP, H / 2, -100, -50], t: [W - GAP, H - GAP, -100, -100] }
  }[edge];
}
function place(el, [x, y, tx, ty]) { el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.transform = `translate(${tx}%, ${ty}%)`; }
function layout() {
  const a = anchors(S.edge);
  document.body.dataset.edge = S.edge;
  const vert = S.edge === 'left' || S.edge === 'right';
  dock.classList.toggle('vertical', vert); tray.classList.toggle('vertical', vert);
  if (!drag || !drag.moved) place(dock, a.d);
  const crowded = vert
    ? dock.offsetHeight / 2 + tray.offsetHeight + GAP * 3 > innerHeight / 2
    : dock.offsetWidth / 2 + tray.offsetWidth + GAP * 3 > innerWidth / 2;
  const opp = { bottom: 'top', top: 'bottom', left: 'right', right: 'left' }[S.edge];
  place(tray, crowded ? anchors(opp).t : a.t);
  followWp();
}
function dockTo(edge) {
  const changed = document.body.dataset.edge !== edge;
  S.edge = edge;
  if (changed) { dock.classList.remove('morph'); void dock.offsetWidth; dock.classList.add('morph'); }
  layout();
  if (changed) { whoosh(); toast(icon('dock') + `Dock ${({ bottom: 'abajo', top: 'arriba', left: 'a la izquierda', right: 'a la derecha' })[edge]}`); }
}
addEventListener('resize', layout);
U.on('layout', layout);
U.on('edge', (e) => set({ edge: e }));

/* Arrastre con anclaje magnetico */
let drag = null, suppressClick = false, marcoDrag = 0;
dock.addEventListener('pointerdown', (e) => { if (e.button === 0) drag = { x: e.clientX, y: e.clientY, moved: false, id: e.pointerId }; });
// El raton manda muchos eventos por fotograma: se guarda el ultimo y el dock se mueve una vez por fotograma,
// con transform (lo mueve la tarjeta grafica sin recalcular la pagina)
addEventListener('pointermove', (e) => {
  if (!drag) return;
  drag.ex = e.clientX; drag.ey = e.clientY;
  if (!drag.moved) {
    if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 8) return;
    drag.moved = true; dock.setPointerCapture(drag.id); dock.classList.add('dragging');
    closePanels(); resetMagnify(); hideTip(); tick(900, .03);
    U.panel(true, false);
    dock.style.left = drag.x + 'px'; dock.style.top = drag.y + 'px';
  }
  if (!marcoDrag) marcoDrag = requestAnimationFrame(moverDock);
});
function moverDock() {
  marcoDrag = 0;
  if (!drag || !drag.moved) return;
  const x = drag.ex, y = drag.ey;
  dock.style.transform = `translate3d(${x - drag.x}px, ${y - drag.y}px, 0) translate(-50%, -50%)`;
  const e2 = nearestEdge(x, y);
  if (e2 !== drag.edge) {   // solo al cambiar de borde: es lo unico que cambia el tamano del dock
    drag.edge = e2; tick(1500, .02, .02);
    $$('.edge-hint').forEach((h) => h.classList.toggle('on', h.dataset.e === e2));
    dock.classList.toggle('vertical', e2 === 'left' || e2 === 'right');
  }
  updateWp();
  if (dock._lgGel) dock._lgGel.mover(x, y); // liquid glass: se estira con la velocidad del raton
}
addEventListener('pointerup', () => {
  if (!drag) return;
  const d = drag; drag = null;
  cancelAnimationFrame(marcoDrag); marcoDrag = 0;
  if (!d.moved) return;
  dock.classList.remove('dragging');
  $$('.edge-hint').forEach((h) => h.classList.remove('on'));
  U.panel(false, true);
  set({ edge: d.edge || S.edge }, true);
  suppressClick = true; setTimeout(() => { suppressClick = false; }, 50);
});
function nearestEdge(x, y) {
  const W = innerWidth, H = innerHeight;
  const d = { left: x / W, right: (W - x) / W, top: y / H, bottom: (H - y) / H };
  return Object.keys(d).sort((a, b) => d[a] - d[b])[0];
}

/* Ampliacion */
const MAXS = 1.42, RANGE = 120;
dock.addEventListener('pointermove', (e) => {
  const r = dock.getBoundingClientRect();
  dock.style.setProperty('--mx', (e.clientX - r.left) + 'px');
  dock.style.setProperty('--my', (e.clientY - r.top) + 'px');
  if (drag || !S.magnify || S.reduceMotion) return;
  const vert = dock.classList.contains('vertical');
  const out = { bottom: [0, -1], top: [0, 1], left: [1, 0], right: [-1, 0] }[S.edge];
  $$('.dock-item', dock).forEach((it) => {
    const ir = it.offsetParent === dock ? { l: it.offsetLeft, t: it.offsetTop } : { l: it.offsetLeft + it.offsetParent.offsetLeft, t: it.offsetTop + it.offsetParent.offsetTop };
    const c = vert ? r.top + ir.t + it.offsetHeight / 2 : r.left + ir.l + it.offsetWidth / 2;
    const p = vert ? e.clientY : e.clientX;
    const k = Math.max(0, 1 - Math.abs(p - c) / RANGE);
    const s = 1 + (MAXS - 1) * (Math.sin(k * Math.PI / 2) ** 2);
    const push = (s - 1) * it.offsetWidth * .5;
    it.style.setProperty('--s', s.toFixed(3));
    it.style.setProperty('--tx', (out[0] * push).toFixed(1) + 'px');
    it.style.setProperty('--ty', (out[1] * push).toFixed(1) + 'px');
  });
});
function resetMagnify() { $$('.dock-item', dock).forEach((it) => { it.style.removeProperty('--s'); it.style.removeProperty('--tx'); it.style.removeProperty('--ty'); }); }
dock.addEventListener('pointerleave', resetMagnify);

/* Zonas clicables: el resto de la pantalla deja pasar el raton a Windows */
let inside = false;
document.addEventListener('mousemove', (e) => {
  if (document.body.classList.contains('panel-open') || drag) return;
  const now = !!e.target.closest('.hit');
  if (now !== inside) { inside = now; U.hit(now); }
});
// Antuan OS (X11): la ventana solo recibe el raton dentro de estas zonas (dock, barra, avisos...);
// se mandan al nucleo cada vez que cambian de sitio o tamano.
if (U.plataforma === 'linux') {
  let ultimas = '';
  setInterval(() => {
    const r = [...document.querySelectorAll('.hit')].map((el) => el.getBoundingClientRect())
      .filter((b) => b.width > 0 && b.height > 0 && getComputedStyle(document.body).visibility !== 'hidden')
      .map((b) => [Math.floor(b.left), Math.floor(b.top), Math.ceil(b.width), Math.ceil(b.height)]);
    const k = JSON.stringify(r);
    if (k !== ultimas) { ultimas = k; U.zonas(r); }
  }, 200);
}

/* Tooltips */
const tip = $('#tip'); let tipT;
document.addEventListener('pointerover', (e) => {
  const el = e.target.closest('[data-tip]');
  if (!el || drag) return;
  clearTimeout(tipT);
  tipT = setTimeout(() => {
    tip.textContent = el.dataset.tip;
    const r = el.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
    let x = r.left + r.width / 2 - tw / 2, y = r.top - th - 14;
    if (el.closest('#dock, #tray')) {
      if (S.edge === 'top') y = r.bottom + 14;
      if (S.edge === 'left') { x = r.right + 16; y = r.top + r.height / 2 - th / 2; }
      if (S.edge === 'right') { x = r.left - tw - 16; y = r.top + r.height / 2 - th / 2; }
    }
    if (y < 8) y = r.bottom + 12;
    tip.style.left = Math.max(8, Math.min(innerWidth - tw - 8, x)) + 'px';
    tip.style.top = Math.max(8, y) + 'px';
    tip.classList.add('show');
  }, 380);
});
document.addEventListener('pointerout', (e) => { if (e.target.closest('[data-tip]')) hideTip(); });
function hideTip() { clearTimeout(tipT); tip.classList.remove('show'); }

/* ---------- Paneles ---------- */
const launcher = $('#launcher'), quick = $('#quick'), settings = $('#settings');
function positionPanels() {
  const W = innerWidth, H = innerHeight, off = GAP * 2;
  const dw = dock.offsetWidth, dh = dock.offsetHeight;
  const place2 = (p, x, y, origin) => {
    const w = p.offsetWidth, h = p.offsetHeight;
    p.style.left = Math.max(GAP, Math.min(W - w - GAP, x)) + 'px';
    p.style.top = Math.max(GAP, Math.min(H - h - GAP, y)) + 'px';
    if (origin) p.style.transformOrigin = origin;
  };
  const lw = launcher.offsetWidth, lh = launcher.offsetHeight, qw = quick.offsetWidth, qh = quick.offsetHeight;
  const tr = tray.getBoundingClientRect();
  switch (S.edge) {
    case 'bottom': place2(launcher, W / 2 - lw / 2, H - dh - off - lh, '50% 100%'); break;
    case 'top': place2(launcher, W / 2 - lw / 2, dh + off, '50% 0'); break;
    case 'left': place2(launcher, dw + off, H / 2 - lh / 2, '0 50%'); break;
    case 'right': place2(launcher, W - dw - off - lw, H / 2 - lh / 2, '100% 50%'); break;
  }
  const qx = tr.left + tr.width / 2 > W / 2 ? tr.right - qw : tr.left;
  const qy = tr.top + tr.height / 2 > H / 2 ? tr.top - qh - GAP : tr.bottom + GAP;
  // Panel rapido y calendario salen junto a la bandeja
  for (const p of [quick, $('#calpanel')]) {
    const pw = p.offsetWidth, ph = p.offsetHeight;
    const px = tr.left + tr.width / 2 > W / 2 ? tr.right - pw : tr.left;
    const py = tr.top + tr.height / 2 > H / 2 ? tr.top - ph - GAP : tr.bottom + GAP;
    if (S.edge === 'left') place2(p, tr.right + GAP, tr.bottom - ph);
    else if (S.edge === 'right') place2(p, tr.left - GAP - pw, tr.bottom - ph);
    else place2(p, px, py);
  }
  place2(settings, W / 2 - settings.offsetWidth / 2, H / 2 - settings.offsetHeight / 2, '50% 50%');
}
let openP = null;
function openPanel(p, btn, near) {
  const was = openP === p;
  closePanels(false, true);
  if (was) { U.panel(false, true); return; }
  if (p === ctx) {
    const r = near.getBoundingClientRect();
    p.classList.add('open');
    const w = p.offsetWidth, h = p.offsetHeight;
    let x = r.left + r.width / 2 - w / 2, y = r.top - h - 12;
    if (S.edge === 'top') y = r.bottom + 12;
    if (S.edge === 'left') { x = r.right + 12; y = r.top + r.height / 2 - h / 2; }
    if (S.edge === 'right') { x = r.left - w - 12; y = r.top + r.height / 2 - h / 2; }
    p.style.left = Math.max(GAP, Math.min(innerWidth - w - GAP, x)) + 'px';
    p.style.top = Math.max(GAP, Math.min(innerHeight - h - GAP, y)) + 'px';
  } else {
    positionPanels();
    p.classList.add('open');
  }
  openP = p;
  if (btn) { btn.setAttribute('aria-expanded', 'true'); btn.classList.add('open', 'on'); }
  document.body.classList.add('panel-open');
  U.panel(true);
  whoosh(true);
  if (p === launcher) { $('#q').value = ''; view = 'pinned'; syncSeg(); renderLauncher(); setTimeout(() => $('#q').focus(), 40); }
  if (p === quick) refreshQuick();
}
function closePanels(restore = true, silent = false) {
  $('#powerMenu').classList.remove('open');
  if (!openP) return;
  $$('.panel.open, .menu.open').forEach((p) => p.classList.remove('open'));
  $$('[aria-expanded=true]').forEach((b) => { b.setAttribute('aria-expanded', 'false'); b.classList.remove('open', 'on'); });
  openP = null;
  document.body.classList.remove('panel-open');
  inside = false;
  if (!silent) U.panel(false, restore);
}
$('#launcherBtn').addEventListener('click', (e) => { if (!suppressClick) openPanel(launcher, e.currentTarget); });
$('#quickBtn').addEventListener('click', (e) => openPanel(quick, e.currentTarget));
$('#clockBtn').addEventListener('click', (e) => openPanel($('#calpanel'), e.currentTarget));
$('#backdrop').addEventListener('pointerdown', () => closePanels(true));
$('#backdrop').addEventListener('contextmenu', (e) => e.preventDefault());
U.on('close-panels', () => closePanels(false));
U.on('toggle-launcher', () => { if (openP === launcher) closePanels(true); else openPanel(launcher, $('#launcherBtn')); });

/* ---------- Inicio ---------- */
let view = 'pinned', sel = 0;
const seg = $('#lSeg');
function syncSeg() {
  $$('button', seg).forEach((x) => x.setAttribute('aria-pressed', x.dataset.v === view));
  const b = $('[aria-pressed=true]', seg), pill = $('.pill', seg);
  pill.style.left = b.offsetLeft + 'px'; pill.style.width = b.offsetWidth + 'px';
}
seg.addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  view = b.dataset.v; syncSeg(); tick(); renderLauncher();
});
const ACTIONS = [
  ['Mover dock a la izquierda', 'dock', () => set({ edge: 'left' })],
  ['Mover dock arriba', 'dock', () => set({ edge: 'top' })],
  ['Mover dock a la derecha', 'dock', () => set({ edge: 'right' })],
  ['Mover dock abajo', 'dock', () => set({ edge: 'bottom' })],
  ['Alto contraste', 'contrast', () => set({ contrast: !S.contrast })],
  ['Menos movimiento', 'motion', () => set({ reduceMotion: !S.reduceMotion })],
  ['Texto más grande', 'text', () => set({ bigText: !S.bigText })],
  ['Ajustes de Antuan', 'dock', () => openSettings('look')],
  ['Ajustes de Windows', 'gear', () => U.openUri('ms-settings:')],
  ['Pantalla', 'sun', () => U.openUri('ms-settings:display')],
  ['Sonido', 'volume', () => U.openUri('ms-settings:sound')],
  ['Wi-Fi', 'wifi', () => U.openUri('ms-settings:network-wifi')],
  ['Bluetooth', 'bluetooth', () => U.openUri('ms-settings:bluetooth')],
  ['Fondo de pantalla', 'image', () => U.openUri('ms-settings:personalization-background')],
  ['Accesibilidad de Windows', 'access', () => U.openUri('ms-settings:easeofaccess')],
  ['Administrador de tareas', 'grid', () => U.keys([0x11, 0x10, 0x1B])],
  ['Bloquear', 'lock', () => U.power('lock')],
  ['Suspender', 'moon', () => U.power('sleep')],
  ['Reiniciar', 'restart', () => U.power('restart')],
  ['Apagar', 'power', () => U.power('shutdown')]
];
if (LINUX) for (const a of ACTIONS) {
  if (a[0] === 'Ajustes de Windows') { a[0] = 'Ajustes del sistema'; a[2] = () => U.cmd('centro', 'resumen'); }
  if (a[0] === 'Accesibilidad de Windows') a[0] = 'Accesibilidad';
}
function renderLauncher() {
  const q = $('#q').value.trim().toLowerCase(), body = $('#lBody');
  $('#lTitle').textContent = q ? 'Resultados' : view === 'pinned' ? 'Fijadas' : 'Todas las apps';
  seg.style.visibility = q ? 'hidden' : 'visible';
  if (q) {
    const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const nq = norm(q);
    const appsF = catalog.filter((a) => norm(appName(a)).includes(nq) || norm(a.name).includes(nq))
      .sort((a, b) => norm(appName(a)).indexOf(nq) - norm(appName(b)).indexOf(nq)).slice(0, 8);
    const acts = ACTIONS.filter((a) => norm(a[0]).includes(nq)).slice(0, 5);
    body.innerHTML = `<div class="list stagger">${
      appsF.map((a, i) => `<button class="row" style="--i:${i}" data-launch="${esc(a.id)}">${tile(a)}<span>${esc(appName(a))}</span><small>App</small></button>`).join('') +
      acts.map((a, i) => `<button class="row" style="--i:${i + appsF.length}" data-action="${ACTIONS.indexOf(a)}"><span class="act">${icon(a[1])}</span><span>${esc(a[0])}</span><small>Acción</small></button>`).join('')
    }${appsF.length + acts.length ? '' : `<div class="empty">Nada por aquí con «${esc(q)}»</div>`}</div>`;
    sel = 0; markSel();
  } else if (view === 'pinned') {
    const pins = S.pinned.map((id) => byId.get(id)).filter(Boolean);
    body.innerHTML = `<div class="grid stagger">${pins.map((a, i) => `<button class="app-cell" style="--i:${i}" data-launch="${esc(a.id)}" title="${esc(appName(a))}">${tile(a)}<span>${esc(appName(a))}</span></button>`).join('')}</div>`;
  } else {
    let last = '';
    body.innerHTML = `<div class="list stagger">${catalog.map((a, i) => {
      const l = appName(a)[0].toUpperCase(), h = l !== last ? `<div class="letter-h" style="--i:${i}">${esc(l)}</div>` : ''; last = l;
      return h + `<button class="row" style="--i:${i}" data-launch="${esc(a.id)}">${tile(a)}<span>${esc(appName(a))}</span></button>`;
    }).join('')}</div>`;
  }
  requestAnimationFrame(positionPanels);
}
function markSel() { $$('#lBody .row').forEach((r, i) => r.classList.toggle('sel', i === sel)); $$('#lBody .row')[sel]?.scrollIntoView({ block: 'nearest' }); }
$('#q').addEventListener('input', renderLauncher);
$('#q').addEventListener('keydown', (e) => {
  const rows = $$('#lBody .row');
  if (e.key === 'ArrowDown') { sel = Math.min(rows.length - 1, sel + 1); markSel(); e.preventDefault(); }
  if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); markSel(); e.preventDefault(); }
  if (e.key === 'Enter') (rows[sel] || $('#lBody [data-launch]'))?.click();
});
document.addEventListener('click', (e) => {
  const l = e.target.closest('[data-launch]');
  if (l) {
    closePanels(false);
    U.launch(l.dataset.launch);
    const d = $(`.dock-item[data-key="a:${CSS.escape(l.dataset.launch)}"]`);
    if (d) { d.classList.remove('bounce'); void d.offsetWidth; d.classList.add('bounce'); }
    whoosh(true);
    return;
  }
  const a = e.target.closest('[data-action]');
  if (a) { closePanels(false); ACTIONS[+a.dataset.action][2](); return; }
  const u = e.target.closest('[data-uri]');
  if (u) { closePanels(false); U.openUri(u.dataset.uri); return; }
  const m = e.target.closest('[data-media]');
  if (m) { U.keys([+m.dataset.media]); tick(); }
});
$('#lBody').addEventListener('contextmenu', (e) => {
  e.preventDefault();
  const b = e.target.closest('[data-launch]'); if (!b) return;
  const id = b.dataset.launch, pinned = S.pinned.includes(id);
  set({ pinned: pinned ? S.pinned.filter((p) => p !== id) : [...S.pinned, id] });
  toast(icon(pinned ? 'unpin' : 'pin') + (pinned ? 'Quitada del dock' : 'Fijada en el dock'));
  renderDock(); renderLauncher();
});

/* Energia */
$('#powerBtn').addEventListener('click', (e) => { e.stopPropagation(); $('#powerMenu').classList.toggle('open'); tick(); });
let confirmPower = null;
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-power]'); if (!b) return;
  const what = b.dataset.power;
  if (['restart', 'shutdown', 'signout'].includes(what) && confirmPower !== what) {
    confirmPower = what;
    const t = b.lastChild; const old = t.textContent; t.textContent = '¿Seguro? Pulsa otra vez';
    setTimeout(() => { if (confirmPower === what) { confirmPower = null; t.textContent = old; } }, 2600);
    return;
  }
  confirmPower = null;
  closePanels(false);
  U.power(what);
});

/* ---------- Panel rapido ---------- */
const vol = $('#vol'), bri = $('#bri');
let muted = false;
async function refreshQuick() {
  const v = await U.volume();
  if (v) { vol.value = v.level; muted = v.muted; paintRange(vol); syncMute(); }
  const b = await U.brightness();
  $('#briRow').style.display = b < 0 ? 'none' : '';
  if (b >= 0) { bri.value = b; paintRange(bri); }
}
function syncMute() {
  const ic = muted || +vol.value === 0 ? 'mute' : 'volume';
  $('#muteBtn').innerHTML = icon(ic);
  $('#trayVol').innerHTML = icon(ic);
}
let volT, briT;
vol.addEventListener('input', () => { paintRange(vol); muted = false; syncMute(); clearTimeout(volT); volT = setTimeout(() => U.setVolume(+vol.value), 30); });
bri.addEventListener('input', () => { paintRange(bri); clearTimeout(briT); briT = setTimeout(() => U.setBrightness(+bri.value), 60); });
$('#muteBtn').addEventListener('click', () => { muted = !muted; U.mute(muted); syncMute(); tick(); });
$('#quickUmbra').addEventListener('click', () => openSettings('look'));
U.volume().then((v) => { if (v) { vol.value = v.level; muted = v.muted; paintRange(vol); syncMute(); } });
if (navigator.getBattery) navigator.getBattery().then((b) => {
  const upd = () => { $('#battPct').textContent = Math.round(b.level * 100) + ' %' + (b.charging ? ' · cargando' : ''); };
  upd(); b.addEventListener('levelchange', upd); b.addEventListener('chargingchange', upd);
});

/* ---------- Ajustes de Antuan ---------- */
const SECTIONS = [['look', 'Apariencia', 'palette'], ['dock', 'Dock', 'dock'], ['access', 'Accesibilidad', 'access'], ['sound', 'Sonido', 'volume'], ['system', 'Sistema', 'windows']];
const sw = (k) => `<button class="switch" role="switch" data-setting="${k}" aria-label="${k}"></button>`;
const ACC = ['#9db4ff', '#7ee0d2', '#c5a3ff', '#ff9fb4', '#ffc978', '#e9ebf1'];
const PANES = {
  look: () => `<h1>Apariencia</h1><p class="sub">Un único tema oscuro, afinado. Elige el acento y cuánto cristal quieres.</p>
    <div class="card"><div class="opt"><div class="lbl"><b>Color de acento</b><span>Indicadores, foco, interruptores</span></div>
    <div class="swatches">${ACC.map((c) => `<button class="swatch" style="--c:${c}" data-setting="accent" data-v="${c}" aria-label="Acento ${c}"></button>`).join('')}</div></div>
    <div class="opt"><div class="lbl"><b>Opacidad del cristal</b><span>Más bajo = más transparente</span></div><input type="range" min="25" max="95" data-setting="glass" aria-label="Opacidad del cristal"></div></div>`,
  dock: () => `<h1>Dock</h1><p class="sub">También puedes arrastrarlo: se ancla al borde más cercano. Atajo: Ctrl + Win + Alt + flechas.</p>
    <div class="card"><div class="opt" style="display:block;padding-bottom:34px"><div class="lbl" style="margin-bottom:12px"><b>Posición</b></div>
    <div class="edge-pick">${[['bottom', 'Abajo'], ['top', 'Arriba'], ['left', 'Izquierda'], ['right', 'Derecha']].map(([v, n]) => `<button data-setting="edge" data-v="${v}" aria-label="${n}"><small>${n}</small></button>`).join('')}</div></div></div>
    <div class="card"><div class="opt"><div class="lbl"><b>Tamaño de iconos</b></div><input type="range" min="36" max="64" data-setting="dockSize" aria-label="Tamaño del dock"></div>
    <div class="opt"><div class="lbl"><b>Ampliación al pasar</b><span>Los iconos crecen bajo el cursor</span></div>${sw('magnify')}</div>
    <div class="opt"><div class="lbl"><b>Apps fijadas</b><span>Clic derecho en un icono del dock o del inicio para fijar o quitar</span></div></div></div>`,
  access: () => `<h1>Accesibilidad</h1><p class="sub">Todo lo que importa, en un sitio y a un clic.</p>
    <div class="card"><div class="opt"><div class="lbl"><b>Alto contraste</b><span>Superficies opacas, bordes y texto más marcados</span></div>${sw('contrast')}</div>
    <div class="opt"><div class="lbl"><b>Menos movimiento</b><span>Quita rebotes, desenfoques y ampliación</span></div>${sw('reduceMotion')}</div>
    <div class="opt"><div class="lbl"><b>Texto más grande</b><span>Escala la interfaz de Antuan</span></div>${sw('bigText')}</div>
    <div class="opt"><div class="lbl"><b>Anillos de foco siempre visibles</b><span>Para quien navega con teclado</span></div>${sw('focusRings')}</div>
    <div class="opt"><div class="lbl"><b>Más opciones de Windows</b><span>Lupa, narrador, subtítulos…</span></div><button class="btn" data-uri="ms-settings:easeofaccess">Abrir</button></div></div>`,
  sound: () => `<h1>Sonido</h1><p class="sub">Microsonidos suaves que confirman cada acción.</p>
    <div class="card"><div class="opt"><div class="lbl"><b>Sonidos de interfaz</b><span>Clics, anclaje del dock, aperturas</span></div>${sw('sounds')}</div>
    <div class="opt"><div class="lbl"><b>Sonido del sistema</b></div><button class="btn" data-uri="ms-settings:sound">Abrir</button></div></div>`,
  system: () => `<h1>Sistema</h1><p class="sub">Antuan sustituye la barra de Windows. Todo es reversible.</p>
    <div class="card"><div class="opt"><div class="lbl"><b>Iniciar Antuan con Windows</b></div><button class="switch" role="switch" id="loginSw" aria-label="Iniciar con Windows"></button></div>
    <div class="opt"><div class="lbl"><b>Ocultar la barra de Windows</b><span>Desactívalo si necesitas los iconos de la bandeja de Windows</span></div>${sw('hideWindowsTaskbar')}</div>
    <div class="opt"><div class="lbl"><b>Ajustes de Windows</b></div><button class="btn" data-uri="ms-settings:">Abrir</button></div>
    <div class="opt"><div class="lbl"><b>Salir de Antuan</b><span>Vuelve la barra de Windows al momento</span></div><button class="btn danger" id="quitBtn">Salir</button></div></div>`
};
// Los ajustes viven ahora en el Centro Antuan (una sola app para todo).
function openSettings(section) {
  closePanels(false);
  U.cmd('centro', { look: 'look', dock: 'look', access: 'access', sound: 'look', system: 'sistema' }[section] || 'look');
}
function openSettingsOld(section) {
  $('#setSide').innerHTML = `<div class="cap">Antuan</div>` + SECTIONS.map(([k, n, i]) => `<button data-sec="${k}">${icon(i)}${n}</button>`).join('');
  if (openP !== settings) openPanel(settings, null);
  goto(section);
}
async function goto(k) {
  $$('#setSide button').forEach((b) => b.setAttribute('aria-current', b.dataset.sec === k));
  const pane = $('#setPane');
  pane.innerHTML = `<div class="stagger">${PANES[k]()}</div>`;
  $$('.stagger > *', pane).forEach((c, i) => c.style.setProperty('--i', i));
  apply();
  if (k === 'system') {
    const ls = $('#loginSw');
    ls.setAttribute('aria-checked', await U.loginItem());
    ls.onclick = () => { const on = ls.getAttribute('aria-checked') !== 'true'; ls.setAttribute('aria-checked', on); U.config({ startWithWindows: on }); tick(); };
    $('#quitBtn').onclick = () => U.quit();
  }
}
$('#setSide').addEventListener('click', (e) => { const b = e.target.closest('[data-sec]'); if (b) { goto(b.dataset.sec); tick(); } });
$('#settingsClose').addEventListener('click', () => closePanels(true));
$('#umbraSettingsBtn').addEventListener('click', () => openSettings('look'));
$('#centroBtn').addEventListener('click', () => { closePanels(false); U.cmd('centro', 'resumen'); });
$('#meBtn').addEventListener('click', () => U.openUri('ms-settings:accounts'));

/* ---------- Toasts ---------- */
function toast(html) {
  const t = document.createElement('div'); t.className = 'toast glass'; t.innerHTML = html;
  $('#toasts').appendChild(t);
  setTimeout(() => { t.classList.add('out'); t.addEventListener('animationend', () => t.remove(), { once: true }); }, 2200);
}

/* ---------- Teclado ---------- */
addEventListener('keydown', (e) => { if (e.key === 'Escape') closePanels(true); });

/* ---------- Reloj ---------- */
function clock() {
  const d = new Date();
  $('#time').textContent = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  $('#date').textContent = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}
setInterval(clock, 5000); clock();

/* ---------- Antuan OS ---------- */
if (LINUX) {
  // Sin centro de notificaciones ni calendario de Windows; "Silencio" no tiene equivalente
  for (const s of ['#cpNotif', '#cpCal', '#quick [data-uri="ms-settings:notifications"]']) { const el = $(s); if (el) el.style.display = 'none'; }
  const g = $('#quick .q-foot [data-uri="ms-settings:"]');
  if (g) { g.setAttribute('aria-label', 'Ajustes'); g.dataset.tip = 'Ajustes'; }
  // Luz nocturna real (gamma calida con xrandr): interruptor con estado
  const nl = $('#quick [data-uri="ms-settings:nightlight"]');
  if (nl) {
    nl.removeAttribute('data-uri'); nl.setAttribute('aria-pressed', !!S.luzNocturna);
    nl.addEventListener('click', () => { S.luzNocturna = !S.luzNocturna; nl.setAttribute('aria-pressed', S.luzNocturna); U.cmd('luzNocturna'); tick(); });
  }
}

/* ---------- Arranque ---------- */
$('#userName').textContent = boot.user;
$('#avatar').textContent = boot.user[0];
document.body.classList.add('booting');
apply(); renderDock();
requestAnimationFrame(() => requestAnimationFrame(() => { layout(); document.body.classList.remove('booting'); }));
if (new URLSearchParams(location.search).get('login') === '1') {
  document.body.classList.add('login');
  setTimeout(() => { $('#boot').classList.add('gone'); whoosh(true); }, S.reduceMotion ? 200 : 1900);
}

/* ---------- API para los modulos (spotlight, mision, extras...) ---------- */
window.UMB = {
  get S() { return S; }, get catalog() { return catalog; }, get running() { return running; }, get openP() { return openP; },
  byId, set, apply, tick, whoosh, toast, openPanel, closePanels, tile, appName, esc, hydrateIcons, layout, renderDock,
  positionPanels, openSettings, $, $$, GAP, U
};
window.dispatchEvent(new Event('umbra-ready'));
})();
