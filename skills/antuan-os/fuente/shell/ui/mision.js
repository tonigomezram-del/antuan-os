// Mission Control, vistas previas del dock y zonas de anclaje.
(() => {
const ready = (fn) => (window.UMB ? fn(window.UMB) : addEventListener('umbra-ready', () => fn(window.UMB), { once: true }));
ready((M) => {
const { $, $$, esc, U } = M;

/* =================== Mission Control =================== */
const mc = document.createElement('section');
mc.id = 'mission';
mc.className = 'panel';
mc.innerHTML = `<div class="mc-bar">
    <button class="mc-desk" data-k="prev">${icon('arrow')}</button>
    <span class="mc-title">Mission Control</span>
    <button class="mc-desk" data-k="next">${icon('arrow')}</button>
    <button class="mc-desk add" data-k="new" title="Nuevo escritorio">${icon('plus')}</button>
  </div>
  <div class="mc-stage" id="mcStage"></div>
  <div class="mc-empty" id="mcEmpty">No hay ventanas abiertas</div>`;
document.body.appendChild(mc);
const stage = $('#mcStage');
let mcOpen = false;

const allWindows = () => M.running.flatMap((g) => g.windows.map((w) => ({ ...w, group: g })));
const appFor = (g) => (g.appId ? M.byId.get(g.appId) : g);

function gridLayout(items, W, H) {
  // Prueba todas las columnas posibles y se queda con la que deja las miniaturas mas grandes.
  let best = null;
  for (let cols = 1; cols <= items.length; cols++) {
    const rows = Math.ceil(items.length / cols), cw = W / cols, ch = H / rows;
    let scale = Infinity;
    for (const it of items) scale = Math.min(scale, (cw * .86) / it.w, (ch * .78) / it.h);
    scale = Math.min(scale, .62);
    if (!best || scale > best.scale) best = { cols, rows, cw, ch, scale };
  }
  return best;
}

async function openMission() {
  if (mcOpen) return closeMission();
  const wins = allWindows().filter((w) => !w.minimized).concat(allWindows().filter((w) => w.minimized));
  M.openPanel(mc, null);
  mcOpen = true;
  $('#mcEmpty').style.display = wins.length ? 'none' : 'grid';
  stage.innerHTML = '';
  if (!wins.length) return;
  const keys = wins.map((w) => w.id);
  const [rects, thumbs] = await Promise.all([U.ask('windowRects', keys), U.ask('thumbs', keys, 640, 400)]);
  if (!mcOpen) return;
  const W = innerWidth, top = 96, bottom = 40, H = innerHeight - top - bottom;
  // Las minimizadas salen desde su icono del dock y ocupan un hueco de tamano normal.
  const dockIcon = (w) => { const b = $(`#dock .dock-item[data-key="${CSS.escape('a:' + (w.group.appId || ''))}"]`) || $(`#dock .dock-item[data-key="${CSS.escape('g:' + w.group.id)}"]`) || $('#dock'); const r = b.getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; };
  const items = wins.map((w) => {
    let r = rects[w.id];
    const off = !r || w.minimized || r.x < -10000 || r.width < 120;
    if (off) r = dockIcon(w);
    return { w, r, wd: off ? 960 : Math.max(320, r.width), ht: off ? 600 : Math.max(200, r.height) };
  }).map((it) => ({ ...it, w: it.wd, h: it.ht, win: it.w }));
  const L = gridLayout(items, W - 80, H);
  const usedRows = L.rows, offY = top + (H - usedRows * L.ch) / 2;
  items.forEach((it, i) => {
    const col = i % L.cols, row = Math.floor(i / L.cols);
    const inRow = Math.min(L.cols, items.length - row * L.cols), rowOff = (L.cols - inRow) * L.cw / 2;
    const tw = it.w * L.scale, th = it.h * L.scale;
    const x = 40 + rowOff + col * L.cw + (L.cw - tw) / 2, y = offY + row * L.ch + (L.ch - th) / 2 - 10;
    const el = document.createElement('button');
    el.className = 'mc-win' + (it.win.minimized ? ' min' : '');
    el.dataset.k = it.win.id;
    const a = appFor(it.win.group);
    el.innerHTML = `<div class="mc-shot">${thumbs[it.win.id] ? `<img src="data:image/jpeg;base64,${thumbs[it.win.id]}" alt="">` : M.tile(a)}</div>
      <div class="mc-cap">${M.tile(a)}<span>${esc(it.win.title)}</span></div>
      <span class="mc-x" data-close title="Cerrar">${icon('x')}</span>`;
    // Sale desde donde esta la ventana de verdad y vuela a su hueco.
    Object.assign(el.style, { left: it.r.x + 'px', top: it.r.y + 'px', width: it.r.width + 'px', height: it.r.height + 'px', opacity: it.win.minimized ? 0 : 1 });
    el.dataset.home = JSON.stringify(it.r);
    stage.appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.style.transitionDelay = (i * 18) + 'ms';
      Object.assign(el.style, { left: x + 'px', top: y + 'px', width: tw + 'px', height: th + 'px', opacity: 1 });
    }));
  });
  M.whoosh(true);
}

function closeMission(pick) {
  if (!mcOpen) return;
  mcOpen = false;
  // Las miniaturas vuelven a su sitio; la elegida, la ultima y por encima.
  for (const el of $$('.mc-win', stage)) {
    const h = JSON.parse(el.dataset.home);
    el.style.transitionDelay = '0ms';
    Object.assign(el.style, { left: h.x + 'px', top: h.y + 'px', width: h.width + 'px', height: h.height + 'px', opacity: el.dataset.k === pick ? 1 : 0 });
    if (el.dataset.k === pick) el.style.zIndex = 5;
  }
  if (pick) U.window(pick, 'focus');
  setTimeout(() => { M.closePanels(!pick); stage.innerHTML = ''; }, pick ? 260 : 200);
}

stage.addEventListener('click', (e) => {
  const w = e.target.closest('.mc-win'); if (!w) return;
  if (e.target.closest('[data-close]')) {
    U.window(w.dataset.k, 'close');
    w.classList.add('closing'); setTimeout(() => w.remove(), 250); M.tick(600, .05);
    return;
  }
  closeMission(w.dataset.k);
});
mc.addEventListener('click', (e) => {
  const d = e.target.closest('.mc-desk');
  if (d) {
    const keys = { prev: [0x5B, 0x11, 0x25], next: [0x5B, 0x11, 0x27], new: [0x5B, 0x11, 0x44] }[d.dataset.k];
    closeMission(); setTimeout(() => U.keys(keys), 120);
    return;
  }
  if (!e.target.closest('.mc-win')) closeMission();
});
U.on('mission', openMission);
window.addEventListener('umbra-mission', openMission);
U.on('close-panels', () => { if (mcOpen) { mcOpen = false; stage.innerHTML = ''; } });
const origClose = M.closePanels;
addEventListener('keydown', (e) => { if (e.key === 'Escape' && mcOpen) closeMission(); });

/* =================== Vista previa al pasar por el dock =================== */
const pv = document.createElement('div');
pv.id = 'preview';
pv.className = 'glass hit';
document.body.appendChild(pv);
let pvTimer = null, pvFor = null, pvHide = null;

function groupOf(btn) {
  const key = btn.dataset.key || '';
  if (key.startsWith('a:')) return M.running.find((g) => g.appId === key.slice(2));
  if (key.startsWith('g:')) return M.running.find((g) => g.id === key.slice(2));
  return null;
}
async function showPreview(btn) {
  const g = groupOf(btn);
  if (!g || !g.windows.length || M.openP) return;
  pvFor = btn;
  const wins = g.windows.slice(0, 5);
  pv.innerHTML = wins.map((w) => `<button class="pv-item" data-k="${w.id}"><div class="pv-shot"><i class="sp-spin"></i></div><span>${esc(w.title)}</span></button>`).join('');
  place(btn);
  pv.classList.add('show');
  document.getElementById('tip')?.classList.remove('show');
  const thumbs = await U.ask('thumbs', wins.map((w) => w.id), 360, 220);
  if (pvFor !== btn) return;
  for (const w of wins) {
    const s = $(`.pv-item[data-k="${w.id}"] .pv-shot`, pv);
    if (s) s.innerHTML = thumbs[w.id] ? `<img src="data:image/jpeg;base64,${thumbs[w.id]}" alt="">` : M.tile(appFor(g));
  }
  place(btn);
}
function place(btn) {
  const r = btn.getBoundingClientRect(), w = pv.offsetWidth, h = pv.offsetHeight, edge = M.S.edge;
  let x = r.left + r.width / 2 - w / 2, y = r.top - h - 16;
  if (edge === 'top') y = r.bottom + 16;
  if (edge === 'left') { x = r.right + 18; y = r.top + r.height / 2 - h / 2; }
  if (edge === 'right') { x = r.left - w - 18; y = r.top + r.height / 2 - h / 2; }
  pv.style.left = Math.max(8, Math.min(innerWidth - w - 8, x)) + 'px';
  pv.style.top = Math.max(8, Math.min(innerHeight - h - 8, y)) + 'px';
}
function hidePreview() { pvFor = null; pv.classList.remove('show'); }
document.addEventListener('pointerover', (e) => {
  const btn = e.target.closest('#dock .dock-item[data-key]');
  if (btn) {
    clearTimeout(pvHide);
    if (pvFor === btn) return;
    clearTimeout(pvTimer);
    pvTimer = setTimeout(() => showPreview(btn), pvFor ? 60 : 650);
  } else if (e.target.closest('#preview')) {
    clearTimeout(pvHide);
  } else {
    clearTimeout(pvTimer);
    pvHide = setTimeout(hidePreview, 220);
  }
});
pv.addEventListener('click', (e) => {
  const it = e.target.closest('.pv-item'); if (!it) return;
  U.window(it.dataset.k, 'focus'); hidePreview(); M.tick();
});
document.addEventListener('pointerdown', (e) => { if (!e.target.closest('#preview')) { clearTimeout(pvTimer); hidePreview(); } });

/* =================== Zonas de anclaje (arrastrar ventana con Mayus) =================== */
const zones = document.createElement('div');
zones.id = 'zones';
zones.innerHTML = '<div class="zone-target"><span></span></div><div class="zone-help">Suelta para colocar · zonas Antuan</div>';
document.body.appendChild(zones);
let wa = null, zone = null;
function zoneAt(x, y) {
  const r = wa, fx = (x - r.x) / r.width, fy = (y - r.y) / r.height, g = 10;
  const L = { x: r.x + g, y: r.y + g, w: r.width - 2 * g, h: r.height - 2 * g };
  const half = (L.w - g) / 2, vhalf = (L.h - g) / 2, third = (L.w - 2 * g) / 3;
  const Z = (name, x, y, w, h) => ({ name, x, y, width: w, height: h });
  const left = fx < .2, right = fx > .8, topZ = fy < .2, bottomZ = fy > .8;
  if (left && topZ) return Z('Cuarto superior izquierdo', L.x, L.y, half, vhalf);
  if (right && topZ) return Z('Cuarto superior derecho', L.x + half + g, L.y, half, vhalf);
  if (left && bottomZ) return Z('Cuarto inferior izquierdo', L.x, L.y + vhalf + g, half, vhalf);
  if (right && bottomZ) return Z('Cuarto inferior derecho', L.x + half + g, L.y + vhalf + g, half, vhalf);
  if (left) return Z('Mitad izquierda', L.x, L.y, half, L.h);
  if (right) return Z('Mitad derecha', L.x + half + g, L.y, half, L.h);
  if (topZ) return Z('Pantalla completa', L.x, L.y, L.w, L.h);
  if (bottomZ) return Z('Tercio central', L.x + third + g, L.y, third, L.h);
  if (fx < .4) return Z('Dos tercios izquierda', L.x, L.y, third * 2 + g, L.h);
  if (fx > .6) return Z('Dos tercios derecha', L.x + third + g, L.y, third * 2 + g, L.h);
  return Z('Centrada', L.x + L.w * .15, L.y + L.h * .08, L.w * .7, L.h * .84);
}
U.on('zones', async (on) => {
  if (on) { wa = await U.ask('workArea'); zones.classList.add('on'); M.tick(1500, .02, .02); }
  else { zones.classList.remove('on'); zone = null; }
});
U.on('zones-cursor', (x, y) => {
  if (!wa) return;
  const z = zoneAt(x, y);
  if (!zone || z.name !== zone.name) { zone = z; M.tick(1700, .015, .015); }
  const t = $('.zone-target', zones);
  Object.assign(t.style, { left: z.x + 'px', top: z.y + 'px', width: z.width + 'px', height: z.height + 'px' });
  $('span', t).textContent = z.name;
});
U.on('zones-drop', (key) => {
  if (zone) { U.cmd('placeWindow', key, { x: Math.round(zone.x), y: Math.round(zone.y), width: Math.round(zone.width), height: Math.round(zone.height) }); M.whoosh(); }
  zones.classList.remove('on'); zone = null;
});
});
})();
