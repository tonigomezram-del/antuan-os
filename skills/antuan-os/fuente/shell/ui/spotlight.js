// Spotlight Antuan (Alt+Espacio): apps, archivos, ajustes, acciones, calculadora y conversiones.
(() => {
const ready = (fn) => (window.UMB ? fn(window.UMB) : addEventListener('umbra-ready', () => fn(window.UMB), { once: true }));
ready((M) => {
const { $, $$, esc, U } = M;
const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const box = document.createElement('section');
box.id = 'spotlight';
box.className = 'panel glass';
box.setAttribute('role', 'dialog');
box.setAttribute('aria-label', 'Buscar');
box.innerHTML = `
  <label class="sp-field">${icon('search')}<input id="spq" placeholder="Buscar en Antuan" autocomplete="off" spellcheck="false" aria-label="Buscar"><span class="sp-hint" id="sphint"></span></label>
  <div class="sp-results" id="spres" role="listbox"></div>
  <div class="sp-foot"><span><b>↵</b> abrir</span><span><b>Ctrl ↵</b> mostrar en carpeta</span><span><b>↑↓</b> moverse</span><span><b>Esc</b> cerrar</span></div>`;
document.body.appendChild(box);
const input = $('#spq'), res = $('#spres');

/* ---------- Ajustes de Windows con nombres que se entienden ---------- */
const LINUX = U.plataforma === 'linux';
let SETTINGS = [
  ['Pantalla', 'ms-settings:display', 'resolucion escala brillo monitor'], ['Sonido', 'ms-settings:sound', 'audio altavoces microfono'],
  ['Wi-Fi', 'ms-settings:network-wifi', 'red internet inalambrica'], ['Bluetooth y dispositivos', 'ms-settings:bluetooth', 'cascos raton teclado'],
  ['Fondo de pantalla', 'ms-settings:personalization-background', 'wallpaper imagen'], ['Colores', 'ms-settings:colors', 'modo oscuro acento'],
  ['Batería y energía', 'ms-settings:powersleep', 'suspension apagar pantalla'], ['Almacenamiento', 'ms-settings:storagesense', 'disco espacio'],
  ['Windows Update', 'ms-settings:windowsupdate', 'actualizaciones'], ['Aplicaciones instaladas', 'ms-settings:appsfeatures', 'desinstalar programas'],
  ['Aplicaciones predeterminadas', 'ms-settings:defaultapps', 'navegador por defecto'], ['Apps al inicio', 'ms-settings:startupapps', 'arranque'],
  ['Cuentas', 'ms-settings:accounts', 'usuario perfil'], ['Contraseña e inicio de sesión', 'ms-settings:signinoptions', 'pin windows hello'],
  ['Fecha y hora', 'ms-settings:dateandtime', 'reloj zona horaria'], ['Idioma y región', 'ms-settings:regionlanguage', 'teclado'],
  ['Ratón', 'ms-settings:mousetouchpad', 'cursor puntero'], ['Panel táctil', 'ms-settings:devices-touchpad', 'gestos touchpad'],
  ['Impresoras', 'ms-settings:printers', 'escaner'], ['Notificaciones', 'ms-settings:notifications', 'no molestar'],
  ['Privacidad', 'ms-settings:privacy', 'permisos camara ubicacion'], ['Cámara (permisos)', 'ms-settings:privacy-webcam', 'webcam'],
  ['Micrófono (permisos)', 'ms-settings:privacy-microphone', 'micro'], ['Seguridad de Windows', 'windowsdefender:', 'antivirus defender'],
  ['Accesibilidad', 'ms-settings:easeofaccess', 'lupa narrador texto'], ['Modo juego', 'ms-settings:gaming-gamemode', 'gaming'],
  ['Gráficos (GPU por app)', 'ms-settings:display-advancedgraphics', 'gpu tarjeta'], ['VPN', 'ms-settings:network-vpn', 'proxy'],
  ['Luz nocturna', 'ms-settings:nightlight', 'filtro azul'], ['Proyectar a otra pantalla', 'ms-settings:project', 'segunda pantalla'],
  ['Acerca del PC', 'ms-settings:about', 'especificaciones nombre equipo'], ['Recuperación', 'ms-settings:recovery', 'restablecer'],
  ['Panel de control', 'control', 'clasico'], ['Administrador de dispositivos', 'devmgmt.msc', 'drivers controladores']
];
// Antuan OS: solo los ajustes que tienen sitio alli (el nucleo dice cuales); fuera Panel de control, Defender...
if (LINUX) {
  const todos = SETTINGS; SETTINGS = [];
  U.ask('ajustesLinux', todos.map((s) => s[1])).then((ok) => {
    SETTINGS = todos.filter((s) => (ok || []).includes(s[1])).map((s) => (s[1] === 'ms-settings:windowsupdate' ? ['Actualizaciones', s[1], s[2]] : s));
  });
}

/* ---------- Acciones ---------- */
const go = (fn) => () => { M.closePanels(false); fn(); };
const ACTIONS = [
  ['Captura de pantalla', 'image', go(() => U.keys([0x5B, 0x10, 0x53])), 'recorte screenshot'],
  ['Selector de color', 'palette', go(() => U.cmd('colorPicker')), 'cuentagotas hex'],
  ['Copiar texto de la pantalla', 'text', go(() => U.cmd('ocr')), 'ocr extraer texto imagen'],
  ['Portapapeles', 'note', go(() => window.dispatchEvent(new Event('umbra-clipboard'))), 'historial copiar pegar'],
  ['Mission Control', 'grid', go(() => window.dispatchEvent(new Event('umbra-mission'))), 'ventanas todas'],
  ['Reabrir lo último que cerraste', 'restart', go(() => U.cmd('reopen')), 'deshacer cerrar'],
  ['Mantener el PC despierto', 'sun', go(() => U.cmd('toggleAwake')), 'no suspender cafeina'],
  ['Centro Antuan', 'dock', go(() => U.cmd('centro')), 'control rendimiento'],
  ['Juegos', 'game', go(() => U.cmd('centro', 'juegos')), 'optimizar fps ping'],
  ['Vaciar papelera', 'x', go(() => { U.cmd('emptyBin'); M.toast(icon('x') + 'Papelera vaciada'); }), 'borrar'],
  ['Cancelar apagado programado', 'power', go(() => { U.cmd('cancelShutdown'); M.toast(icon('power') + 'Apagado cancelado'); }), ''],
  ['Bloquear', 'lock', go(() => U.power('lock')), ''], ['Suspender', 'moon', go(() => U.power('sleep')), 'dormir'],
  ['Reiniciar', 'restart', go(() => U.power('restart')), ''], ['Apagar', 'power', go(() => U.power('shutdown')), ''],
  ['Alto contraste', 'contrast', go(() => M.set({ contrast: !M.S.contrast })), 'accesibilidad'],
  ['Menos movimiento', 'motion', go(() => M.set({ reduceMotion: !M.S.reduceMotion })), 'animaciones'],
  ['Dock a la izquierda', 'dock', go(() => M.set({ edge: 'left' })), ''], ['Dock arriba', 'dock', go(() => M.set({ edge: 'top' })), ''],
  ['Dock a la derecha', 'dock', go(() => M.set({ edge: 'right' })), ''], ['Dock abajo', 'dock', go(() => M.set({ edge: 'bottom' })), ''],
  ['Administrador de tareas', 'grid', go(() => U.keys([0x11, 0x10, 0x1B])), 'procesos']
];

/* ---------- Calculadora (analizador propio, sin eval) ---------- */
function calc(q) {
  const s = q.replace(/,/g, '.').replace(/×/g, '*').replace(/÷/g, '/').replace(/\s+/g, '').toLowerCase();
  const pct = /^([\d.]+)%(de|of)([\d.]+)$/.exec(s);
  if (pct) return +pct[1] / 100 * +pct[3];
  if (!/^[\d.+\-*/^%()xpisqrt]+$/.test(s) || !/[\d)i][-+*/^x%]|sqrt|pi/.test(s)) return null;
  let i = 0;
  const peek = () => s[i];
  const num = () => {
    if (s.startsWith('pi', i)) { i += 2; return Math.PI; }
    if (s.startsWith('sqrt', i)) { i += 4; return Math.sqrt(unary()); }
    if (peek() === '(') { i++; const v = expr(); if (peek() !== ')') throw 0; i++; return v; }
    const m = /^\d*\.?\d+/.exec(s.slice(i)); if (!m) throw 0;
    i += m[0].length; let v = +m[0];
    if (peek() === '%') { i++; v /= 100; }
    return v;
  };
  const unary = () => (peek() === '-' ? (i++, -unary()) : peek() === '+' ? (i++, unary()) : num());
  const pow = () => { const b = unary(); if (peek() === '^') { i++; return Math.pow(b, pow()); } return b; };
  const term = () => { let v = pow(); while ('*/x'.includes(peek()) && peek()) { const o = s[i++]; const r = pow(); v = o === '/' ? v / r : v * r; } return v; };
  const expr = () => { let v = term(); while (peek() === '+' || peek() === '-') { const o = s[i++]; const r = term(); v = o === '+' ? v + r : v - r; } return v; };
  try { const v = expr(); return i === s.length && Number.isFinite(v) ? v : null; } catch { return null; }
}
const fmt = (v) => (Math.abs(v) >= 1e15 || (Math.abs(v) < 1e-6 && v !== 0) ? v.toExponential(6) : String(+v.toFixed(10))).replace('.', ',');

/* ---------- Conversiones de unidades ---------- */
const UNITS = {
  // longitud (m)
  mm: ['L', .001], cm: ['L', .01], m: ['L', 1], km: ['L', 1000], in: ['L', .0254], pulgada: ['L', .0254], pulgadas: ['L', .0254],
  ft: ['L', .3048], pie: ['L', .3048], pies: ['L', .3048], yd: ['L', .9144], mi: ['L', 1609.344], milla: ['L', 1609.344], millas: ['L', 1609.344],
  // masa (kg)
  mg: ['M', 1e-6], g: ['M', .001], kg: ['M', 1], t: ['M', 1000], lb: ['M', .45359237], libra: ['M', .45359237], libras: ['M', .45359237], oz: ['M', .028349523], onza: ['M', .028349523], onzas: ['M', .028349523],
  // datos (bytes)
  b: ['D', 1], kb: ['D', 1024], mb: ['D', 1048576], gb: ['D', 1073741824], tb: ['D', 1099511627776],
  // tiempo (s)
  s: ['T', 1], seg: ['T', 1], min: ['T', 60], h: ['T', 3600], hora: ['T', 3600], horas: ['T', 3600], dia: ['T', 86400], dias: ['T', 86400], semana: ['T', 604800], semanas: ['T', 604800],
  // velocidad (m/s)
  'km/h': ['V', 1 / 3.6], kmh: ['V', 1 / 3.6], mph: ['V', .44704], 'm/s': ['V', 1],
  // volumen (l)
  ml: ['O', .001], l: ['O', 1], litro: ['O', 1], litros: ['O', 1], gal: ['O', 3.785411784], galon: ['O', 3.785411784], galones: ['O', 3.785411784],
  // temperatura (especial)
  c: ['C'], '°c': ['C'], celsius: ['C'], f: ['C'], '°f': ['C'], fahrenheit: ['C'], k: ['C'], kelvin: ['C']
};
function convert(q) {
  const m = /^(-?[\d.,]+)\s*([a-zA-Z°/µ]+)\s+(?:a|en|to|in|->)\s+([a-zA-Z°/µ]+)$/.exec(q.trim());
  if (!m) return null;
  const v = +m[1].replace(',', '.'), a = m[2].toLowerCase(), b = m[3].toLowerCase();
  const ua = UNITS[a], ub = UNITS[b];
  if (!ua || !ub || ua[0] !== ub[0] || !Number.isFinite(v)) return null;
  if (ua[0] === 'C') {
    const k = { c: (x) => x + 273.15, f: (x) => (x - 32) * 5 / 9 + 273.15, k: (x) => x }, back = { c: (x) => x - 273.15, f: (x) => (x - 273.15) * 9 / 5 + 32, k: (x) => x };
    const key = (u) => (u.replace('°', '')[0]);
    return { v: back[key(b)](k[key(a)](v)), unit: b.replace('°', '°').toUpperCase().replace('CELSIUS', '°C') };
  }
  return { v: v * ua[1] / ub[1], unit: b };
}

/* ---------- Busqueda ---------- */
let rows = [], sel = 0, seq = 0;
const usage = () => M.S.usage || {};
function score(name, q) {
  const n = norm(name), i = n.indexOf(q);
  if (i < 0) {
    // iniciales: "vsc" -> Visual Studio Code
    const ini = n.split(/[\s\-_.]+/).map((w) => w[0]).join('');
    return ini.startsWith(q) ? 40 : -1;
  }
  return 100 - i * 3 - (n.length - q.length) * .3 + (i === 0 || n[i - 1] === ' ' ? 20 : 0);
}
function build(q) {
  const out = [];
  if (!q) {
    const top = Object.entries(usage()).sort((a, b) => b[1] - a[1]).map(([id]) => M.byId.get(id)).filter(Boolean).slice(0, 6);
    const list = top.length ? top : (M.S.pinned || []).map((id) => M.byId.get(id)).filter(Boolean).slice(0, 6);
    out.push({ group: top.length ? 'Lo que más usas' : 'Fijadas' });
    list.forEach((a) => out.push({ kind: 'app', app: a }));
    return out;
  }
  const nq = norm(q);
  const c = calc(q);
  if (c !== null) out.push({ group: 'Calculadora' }, { kind: 'calc', title: '= ' + fmt(c), sub: q, value: fmt(c) });
  const cv = convert(q);
  if (cv) out.push({ group: 'Conversión' }, { kind: 'calc', title: fmt(cv.v) + ' ' + cv.unit, sub: q, value: fmt(cv.v) });
  const shut = /^apagar en (\d+)\s*(min|minutos|m|h|horas)?$/i.exec(q.trim());
  if (shut) {
    const mins = +shut[1] * (/^h/i.test(shut[2] || '') ? 60 : 1);
    out.push({ group: 'Acción' }, { kind: 'action', icon: 'power', title: `Apagar el PC en ${mins} min`, run: go(() => { U.cmd('shutdownIn', mins); M.toast(icon('power') + `Se apagará en ${mins} min`); }) });
  }
  const apps = M.catalog.map((a) => ({ a, s: Math.max(score(M.appName(a), nq), score(a.name, nq)) + (usage()[a.id] || 0) * 2 }))
    .filter((x) => x.s >= 0).sort((x, y) => y.s - x.s).slice(0, 6);
  if (apps.length) { out.push({ group: 'Apps' }); apps.forEach((x) => out.push({ kind: 'app', app: x.a })); }
  const sets = SETTINGS.filter(([n, , k]) => norm(n).includes(nq) || norm(k).includes(nq)).slice(0, 4);
  if (sets.length) { out.push({ group: 'Ajustes' }); sets.forEach(([n, uri]) => out.push({ kind: 'setting', title: n, uri })); }
  const acts = ACTIONS.filter(([n, , , k]) => norm(n).includes(nq) || norm(k || '').includes(nq)).slice(0, 4);
  if (acts.length) { out.push({ group: 'Acciones' }); acts.forEach(([n, ic, run]) => out.push({ kind: 'action', icon: ic, title: n, run })); }
  out.push({ group: 'Archivos', files: true });
  out.push({ group: 'Web' }, { kind: 'web', title: `Buscar «${q}» en la web`, q });
  return out;
}

function rowHtml(r, i) {
  if (r.group) return `<div class="sp-group" ${r.files ? 'id="spfiles"' : ''}>${esc(r.group)}${r.files ? '<i class="sp-spin"></i>' : ''}</div>`;
  const ic = r.kind === 'app' ? M.tile(r.app) : r.kind === 'file' ? `<span class="sp-ic">${r.icon ? `<img src="${r.icon}" alt="">` : icon('file')}</span>`
    : `<span class="sp-ic ${r.kind}">${icon(r.kind === 'setting' ? 'gear' : r.kind === 'web' ? 'globe' : r.kind === 'calc' ? 'calc' : r.icon || 'arrow')}</span>`;
  const title = r.kind === 'app' ? M.appName(r.app) : r.title;
  const sub = r.kind === 'app' ? 'Aplicación' : r.kind === 'file' ? r.dir : r.kind === 'setting' ? (LINUX ? 'Ajustes' : 'Ajustes de Windows') : r.kind === 'calc' ? r.sub + ' · ↵ copiar' : r.kind === 'web' ? 'Navegador' : 'Acción';
  return `<button class="sp-row" data-i="${i}" role="option">${ic}<span class="sp-t"><b>${esc(title)}</b><small>${esc(sub || '')}</small></span><kbd>↵</kbd></button>`;
}
function render() {
  res.innerHTML = rows.map(rowHtml).join('');
  const sels = rows.map((r, i) => (r.group ? -1 : i)).filter((i) => i >= 0);
  if (!sels.includes(sel)) sel = sels[0] ?? 0;
  mark();
}
function mark() {
  $$('.sp-row', res).forEach((b) => b.classList.toggle('sel', +b.dataset.i === sel));
  const cur = $(`.sp-row[data-i="${sel}"]`, res);
  if (cur) cur.scrollIntoView({ block: 'nearest' });
  const r = rows[sel];
  $('#sphint').textContent = r && r.kind === 'app' ? 'App' : r && r.kind === 'file' ? 'Archivo' : '';
}
async function search() {
  const q = input.value.trim(), my = ++seq;
  rows = build(q); sel = 0; render();
  if (q.length < 2) { $('#spfiles')?.remove(); return; }
  const files = await U.ask('files', q);
  if (my !== seq) return;
  const idx = rows.findIndex((r) => r.files);
  if (idx < 0) return;
  if (!files || !files.length) { rows.splice(idx, 1); render(); return; }
  const frows = files.slice(0, 6).map((f) => ({ kind: 'file', title: f.name, path: f.path, dir: LINUX ? f.path.replace(/\/[^/]*$/, '') || '/' : f.path.replace(/\\[^\\]*$/, '') }));
  rows.splice(idx, 1, { group: 'Archivos' }, ...frows);
  render();
  for (const fr of frows) { U.ask('fileIcon', fr.path).then((ic) => { if (ic && my === seq) { fr.icon = ic; const b = $(`.sp-row[data-i="${rows.indexOf(fr)}"] .sp-ic`, res); if (b) b.innerHTML = `<img src="${ic}" alt="">`; } }); }
}
let deb;
input.addEventListener('input', () => { clearTimeout(deb); deb = setTimeout(search, 70); });

function run(r, reveal) {
  if (!r || r.group) return;
  if (r.kind === 'app') {
    const u = { ...usage() }; u[r.app.id] = (u[r.app.id] || 0) + 1; M.set({ usage: u }, true);
    M.closePanels(false); U.launch(r.app.id); M.whoosh(true);
  }
  if (r.kind === 'file') { M.closePanels(false); U.cmd(reveal ? 'reveal' : 'openPath', r.path); }
  if (r.kind === 'setting') {
    M.closePanels(false);
    if (r.uri.includes(':')) U.openUri(r.uri);
    else if (r.uri.endsWith('.msc')) U.cmd('exec', 'mmc.exe', [r.uri]);
    else U.cmd('exec', r.uri + '.exe', []);
  }
  if (r.kind === 'calc') { U.cmd('copy', r.value); M.toast(icon('calc') + 'Copiado: ' + esc(r.value)); M.closePanels(true); }
  if (r.kind === 'web') { M.closePanels(false); U.cmd('web', r.q); }
  if (r.kind === 'action') r.run();
}
input.addEventListener('keydown', (e) => {
  const idx = rows.map((r, i) => (r.group ? -1 : i)).filter((i) => i >= 0);
  const p = idx.indexOf(sel);
  if (e.key === 'ArrowDown') { sel = idx[Math.min(idx.length - 1, p + 1)]; mark(); e.preventDefault(); }
  if (e.key === 'ArrowUp') { sel = idx[Math.max(0, p - 1)]; mark(); e.preventDefault(); }
  if (e.key === 'Enter') { run(rows[sel], e.ctrlKey); e.preventDefault(); }
});
res.addEventListener('click', (e) => { const b = e.target.closest('.sp-row'); if (b) run(rows[+b.dataset.i], e.ctrlKey); });
res.addEventListener('mousemove', (e) => { const b = e.target.closest('.sp-row'); if (b && +b.dataset.i !== sel) { sel = +b.dataset.i; mark(); } });

function open() {
  if (M.openP === box) { M.closePanels(true); return; }
  M.openPanel(box, null);
  input.value = ''; search();
  setTimeout(() => input.focus(), 30);
}
U.on('spotlight', (q) => { open(); if (q) { input.value = q; search(); } });
window.addEventListener('umbra-spotlight', open);
});
})();
