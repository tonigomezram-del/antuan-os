// Terminal Antuan: pestanas, colores Antuan, copiar/pegar comodo, enlaces, zoom.
(async () => {
const U = window.umbra;
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
$('#nueva').innerHTML = icon('plus');

// Acento del usuario
try {
  const c = await U.ask('config');
  if (c && c.accent) {
    document.documentElement.style.setProperty('--accent', c.accent);
    const n = parseInt(c.accent.slice(1), 16);
    document.documentElement.style.setProperty('--accent-rgb', [(n >> 16) & 255, (n >> 8) & 255, n & 255].join(','));
  }
} catch { }
const ACC = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#9db4ff';

// Paleta Antuan (16 colores ANSI)
const TEMA = {
  background: '#00000000', foreground: '#dfe3ec', cursor: ACC, cursorAccent: '#0b0d12',
  selectionBackground: 'rgba(157,180,255,.28)', selectionInactiveBackground: 'rgba(157,180,255,.16)',
  black: '#1a1d26', red: '#ff8a8f', green: '#7ee0b5', yellow: '#ffc978', blue: '#9db4ff', magenta: '#c5a3ff', cyan: '#7ee0d2', white: '#c9cdd8',
  brightBlack: '#5a6072', brightRed: '#ffa8ac', brightGreen: '#a4f0cd', brightYellow: '#ffdb9e', brightBlue: '#bccbff', brightMagenta: '#d9c2ff', brightCyan: '#a8efe6', brightWhite: '#ffffff'
};
let tamFuente = 14;
const tabs = new Map();
let activa = null;

if (!(await U.term.disponible())) {
  $('#stage').innerHTML = '<div style="display:grid;place-items:center;height:100%;color:#8b91a3">El motor de la terminal no está disponible.</div>';
  return;
}

async function nueva(cwd, orden) {
  const el = document.createElement('div');
  el.className = 'term';
  $('#stage').appendChild(el);
  const t = new Terminal({
    fontFamily: '"Cascadia Code", "JetBrains Mono", "Cascadia Mono", Consolas, "DejaVu Sans Mono", monospace',
    fontSize: tamFuente, lineHeight: 1.25, letterSpacing: 0, cursorBlink: true, cursorStyle: 'bar', cursorWidth: 2,
    allowTransparency: true, theme: TEMA, scrollback: 8000, smoothScrollDuration: 90, macOptionIsMeta: true, rightClickSelectsWord: false,
    allowProposedApi: true
  });
  const fit = new FitAddon.FitAddon();
  t.loadAddon(fit);
  t.loadAddon(new WebLinksAddon.WebLinksAddon((ev, uri) => { ev.preventDefault(); U.openUri(uri); }));
  t.open(el);
  fit.fit();
  const r = await U.term.crear({ cols: t.cols, rows: t.rows, cwd, orden });
  if (r.error) { t.write('\x1b[38;2;255;138;143m' + r.error + '\x1b[0m'); return; }
  const bonito = (s) => (!s || /powershell|pwsh|bash|zsh|cmd\.exe|system32/i.test(s) ? 'Terminal' : s);
  const tab = { id: r.id, t, fit, el, titulo: 'Terminal', vivo: true };
  tabs.set(r.id, tab);
  t.onData((d) => U.term.escribir(r.id, d));
  t.onResize(({ cols, rows }) => U.term.tamano(r.id, cols, rows));
  t.onTitleChange((s) => { tab.titulo = bonito((s || '').replace(/^.*[\\/]/, '')); pintarTabs(); });
  // Copiar al seleccionar (comodo como en Antuan OS); Ctrl+C sin seleccion sigue siendo "interrumpir"
  t.onSelectionChange(() => { const s = t.getSelection(); if (s && C.copiarAlSeleccionar !== false) navigator.clipboard.writeText(s).catch(() => { }); });
  t.attachCustomKeyEventHandler((e) => atajos(e, tab));
  activar(r.id);
  return tab;
}
const C = {};

function activar(id) {
  activa = id;
  for (const [k, tb] of tabs) tb.el.classList.toggle('on', k === id);
  const tb = tabs.get(id);
  if (tb) { requestAnimationFrame(() => { tb.fit.fit(); tb.t.focus(); }); document.title = tb.titulo + ' — Terminal'; }
  pintarTabs();
}

function cerrar(id) {
  const tb = tabs.get(id); if (!tb) return;
  U.term.cerrar(id);
  tb.t.dispose(); tb.el.remove(); tabs.delete(id);
  if (!tabs.size) { window.close(); return; }
  if (activa === id) activar([...tabs.keys()].pop());
  else pintarTabs();
}

function pintarTabs() {
  $('#tabs').innerHTML = [...tabs.values()].map((tb) =>
    `<div class="tab ${tb.id === activa ? 'on' : ''} ${tb.vivo ? '' : 'done'}" data-id="${tb.id}" title="${esc(tb.titulo)}"><i class="dot"></i><span class="t">${esc(tb.titulo)}</span><button class="x" data-x="${tb.id}">${icon('x')}</button></div>`).join('');
}
$('#tabs').addEventListener('mousedown', (e) => {
  const x = e.target.closest('[data-x]'); if (x) { e.stopPropagation(); cerrar(+x.dataset.x); return; }
  const t = e.target.closest('.tab'); if (!t) return;
  if (e.button === 1) cerrar(+t.dataset.id); else activar(+t.dataset.id);
});
$('#nueva').addEventListener('click', () => nueva());

U.on('term.datos', (id, d) => { const tb = tabs.get(id); if (tb) tb.t.write(d); });
U.on('term.fin', (id) => {
  const tb = tabs.get(id); if (!tb) return;
  tb.vivo = false;
  tb.t.write('\r\n\x1b[38;2;90;96;114m· proceso terminado · pulsa una tecla para cerrar la pestaña\x1b[0m');
  tb.t.onKey(() => cerrar(id));
  pintarTabs();
});

function aviso(t) { const a = $('#aviso'); a.textContent = t; a.classList.add('show'); clearTimeout(aviso.t); aviso.t = setTimeout(() => a.classList.remove('show'), 1400); }
function zoom(d) {
  tamFuente = d === 0 ? 14 : Math.max(9, Math.min(28, tamFuente + d));
  for (const tb of tabs.values()) { tb.t.options.fontSize = tamFuente; tb.fit.fit(); }
  aviso(`Tamaño ${tamFuente}`);
}
async function pegar(tb) { const t = await navigator.clipboard.readText().catch(() => ''); if (t) tb.t.paste(t); }

function atajos(e, tb) {
  if (e.type !== 'keydown') return true;
  const k = e.key.toLowerCase(), cs = e.ctrlKey && e.shiftKey;
  if (cs && k === 't') { nueva(); return false; }
  if (cs && k === 'w') { cerrar(tb.id); return false; }
  if (cs && k === 'c') { const s = tb.t.getSelection(); if (s) { navigator.clipboard.writeText(s); aviso('Copiado'); } return false; }
  if (cs && k === 'v') { pegar(tb); return false; }
  if (e.ctrlKey && !e.shiftKey && k === 'v') { pegar(tb); return false; }
  if (e.ctrlKey && k === 'tab') { const ids = [...tabs.keys()]; const i = ids.indexOf(activa); activar(ids[(i + (e.shiftKey ? ids.length - 1 : 1)) % ids.length]); return false; }
  if (e.ctrlKey && (k === '=' || k === '+')) { zoom(1); return false; }
  if (e.ctrlKey && k === '-') { zoom(-1); return false; }
  if (e.ctrlKey && k === '0') { zoom(0); return false; }
  if (e.ctrlKey && !e.shiftKey && k === 'c' && tb.t.hasSelection()) { navigator.clipboard.writeText(tb.t.getSelection()); tb.t.clearSelection(); aviso('Copiado'); return false; }
  return true;
}

// Clic derecho: menu propio
const menu = $('#menu');
document.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  const tb = tabs.get(activa); if (!tb) return;
  menu.innerHTML = `<button data-a="copiar">Copiar <kbd>Ctrl+Mayús+C</kbd></button><button data-a="pegar">Pegar <kbd>Ctrl+V</kbd></button>
    <button data-a="todo">Seleccionar todo</button><button data-a="limpiar">Limpiar pantalla</button>
    <button data-a="nueva">Nueva pestaña <kbd>Ctrl+Mayús+T</kbd></button>`;
  menu.classList.add('open');
  menu.style.left = Math.min(e.clientX, innerWidth - 220) + 'px';
  menu.style.top = Math.min(e.clientY, innerHeight - 200) + 'px';
  menu.onclick = (ev) => {
    const a = ev.target.closest('[data-a]')?.dataset.a; menu.classList.remove('open');
    if (a === 'copiar') { const s = tb.t.getSelection(); if (s) navigator.clipboard.writeText(s); }
    if (a === 'pegar') pegar(tb);
    if (a === 'todo') tb.t.selectAll();
    if (a === 'limpiar') tb.t.clear();
    if (a === 'nueva') nueva();
    tb.t.focus();
  };
});
document.addEventListener('mousedown', (e) => { if (!e.target.closest('#menu')) menu.classList.remove('open'); });

addEventListener('resize', () => { const tb = tabs.get(activa); if (tb) tb.fit.fit(); });
const q = new URLSearchParams(location.search);
await nueva(q.get('dir') || undefined, q.get('orden') || undefined);
})();
