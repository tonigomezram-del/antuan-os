// Motor de Antuan OS (X11 + EWMH): misma API que native.js de Windows.
// Usa herramientas del sistema (wmctrl, xdotool, xprop) en vez de llamadas Win32.
const { execFileSync, execFile, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const sh = (cmd, args, opts = {}) => {
  try { return execFileSync(cmd, args, { encoding: 'utf8', timeout: 1500, stdio: ['ignore', 'pipe', 'ignore'], ...opts }); } catch { return ''; }
};
const run = (cmd, args) => { try { execFile(cmd, args, { timeout: 4000 }, () => { }); } catch { } };
const hexToKey = (hex) => String(parseInt(hex, 16));
const keyToHex = (key) => '0x' + Number(key).toString(16).padStart(8, '0');

const EV = { FOREGROUND: 0x0003, MOVESIZESTART: 0x000A, MOVESIZEEND: 0x000B, MINIMIZESTART: 0x0016, MINIMIZEEND: 0x0017,
  CREATE: 0x8000, DESTROY: 0x8001, SHOW: 0x8002, HIDE: 0x8003, NAMECHANGE: 0x800C, CLOAKED: 0x8017, UNCLOAKED: 0x8018 };

// ---------------------------------------------------------------- Barra del sistema: en Antuan OS no existe otra
const hideTaskbar = () => { };
const showTaskbar = () => { };
const taskbarAutoHide = () => false;
const getWorkArea = () => ({ left: 0, top: 0, right: 0, bottom: 0 });
const setWorkArea = () => false;
const desktopHostAlive = () => true;
const attachToDesktop = () => true; // la ventana del escritorio usa type:'desktop'

// Reserva el borde del dock (como la barra de Windows): el gestor de ventanas no tapa esa zona.
function appbarSet(handleBuffer, edge, rc) {
  const xid = handleBuffer.readUInt32LE(0);
  const scr = screenSize();
  const s = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  if (edge === 'left') { s[0] = rc.right - rc.left; s[4] = 0; s[5] = scr.h; }
  if (edge === 'right') { s[1] = rc.right - rc.left; s[6] = 0; s[7] = scr.h; }
  if (edge === 'top') { s[2] = rc.bottom - rc.top; s[8] = 0; s[9] = scr.w; }
  if (edge === 'bottom') { s[3] = rc.bottom - rc.top; s[10] = 0; s[11] = scr.w; }
  run('xprop', ['-id', String(xid), '-f', '_NET_WM_STRUT_PARTIAL', '32c', '-set', '_NET_WM_STRUT_PARTIAL', s.join(',')]);
  run('xprop', ['-id', String(xid), '-f', '_NET_WM_STRUT', '32c', '-set', '_NET_WM_STRUT', s.slice(0, 4).join(',')]);
}
const appbarRemove = () => { };

// Clics que atraviesan la capa de Antuan. Electron vacia la zona de entrada de su ventana, pero el gestor
// de ventanas la mete en un marco propio que seguiria recibiendo los clics: se vacia tambien la del marco.
let X = null;
function x11() {
  if (X !== null) return X;
  try {
    const koffi = require('koffi');
    const x = koffi.load('libX11.so.6'), e = koffi.load('libXext.so.6');
    X = {
      dpy: x.func('void *XOpenDisplay(const char *)')(null),
      queryTree: x.func('int XQueryTree(void *, unsigned long, _Out_ unsigned long *, _Out_ unsigned long *, _Out_ void **, _Out_ unsigned int *)'),
      free: x.func('int XFree(void *)'),
      flush: x.func('int XFlush(void *)'),
      rects: e.func('void XShapeCombineRectangles(void *, unsigned long, int, int, int, void *, int, int, int)'),
      mask: e.func('void XShapeCombineMask(void *, unsigned long, int, int, int, unsigned long, int)')
    };
    if (!X.dpy) X = false;
  } catch { X = false; }
  return X;
}
const marcos = new Map();
function marcoDe(xid) {
  if (marcos.has(xid)) return marcos.get(xid);
  const x = x11(); if (!x) return 0;
  const root = [0], parent = [0], kids = [null], n = [0];
  x.queryTree(x.dpy, xid, root, parent, kids, n);
  if (kids[0]) x.free(kids[0]);
  const p = parent[0] && parent[0] !== root[0] ? Number(parent[0]) : 0;
  if (p) marcos.set(xid, p);
  return p;
}
// zonas: lista de [x, y, ancho, alto] en pixeles donde la ventana recibe el raton (el resto lo atraviesa);
// null = toda la ventana recibe el raton (paneles abiertos).
function clickThrough(handleBuffer, zonas) {
  const x = x11(); if (!x) return false;
  const xid = handleBuffer.readUInt32LE(0);
  const SHAPE_INPUT = 2, SHAPE_SET = 0;
  let buf = null, n = 0;
  if (Array.isArray(zonas)) {
    n = zonas.length; buf = Buffer.alloc(Math.max(n, 1) * 8);   // XRectangle: short x, y; unsigned short w, h
    zonas.forEach(([rx, ry, rw, rh], i) => {
      buf.writeInt16LE(Math.max(-32768, Math.min(32767, rx)), i * 8); buf.writeInt16LE(Math.max(-32768, Math.min(32767, ry)), i * 8 + 2);
      buf.writeUInt16LE(Math.max(0, Math.min(65535, rw)), i * 8 + 4); buf.writeUInt16LE(Math.max(0, Math.min(65535, rh)), i * 8 + 6);
    });
  }
  for (const w of [xid, marcoDe(xid)].filter(Boolean)) {
    if (zonas) x.rects(x.dpy, w, SHAPE_INPUT, 0, 0, buf, n, SHAPE_SET, 0);
    else x.mask(x.dpy, w, SHAPE_INPUT, 0, 0, 0, SHAPE_SET);
  }
  x.flush(x.dpy);
  return true;
}

let scrCache = null;
function screenSize() {
  if (scrCache) return scrCache;
  const m = /dimensions:\s+(\d+)x(\d+)/.exec(sh('xdpyinfo', []));
  scrCache = m ? { w: +m[1], h: +m[2] } : { w: 1920, h: 1080 };
  return scrCache;
}

// ---------------------------------------------------------------- Ventanas abiertas
const SKIP_CLASS = /^(umbra|Umbra|antuan|Antuan)\./;
const exeCache = new Map();
function exeOf(pid) {
  if (!pid) return '';
  if (exeCache.has(pid)) return exeCache.get(pid);
  let p = '';
  try { p = fs.readlinkSync(`/proc/${pid}/exe`); } catch { }
  // Apps Flatpak y Wine: se usa la linea de comandos para identificarlas
  if (/bwrap|wine|python|java/.test(path.basename(p))) {
    try { const c = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8').split('\0').filter(Boolean); p = c.find((x) => /\.exe$|\/app\/|\.desktop$/i.test(x)) || p; } catch { }
  }
  exeCache.set(pid, p);
  if (exeCache.size > 500) exeCache.clear();
  return p;
}
function activeId() {
  const m = /window id # (0x[0-9a-f]+)/i.exec(sh('xprop', ['-root', '_NET_ACTIVE_WINDOW']));
  return m ? hexToKey(m[1]) : '';
}
function stateOf(hex) {
  const s = sh('xprop', ['-id', hex, '_NET_WM_STATE', '_NET_WM_WINDOW_TYPE']);
  return { hidden: /HIDDEN/.test(s), above: /ABOVE/.test(s), fullscreen: /FULLSCREEN/.test(s), normal: !/_NET_WM_WINDOW_TYPE_(DOCK|DESKTOP|SPLASH|TOOLBAR|MENU|NOTIFICATION|DIALOG)/.test(s) || /DIALOG/.test(s) };
}

function listWindows(ownPids = []) {
  const act = activeId();
  const out = [];
  // wmctrl -lpx: id escritorio pid clase maquina titulo
  for (const line of sh('wmctrl', ['-lpx']).split('\n')) {
    const m = /^(0x[0-9a-f]+)\s+(-?\d+)\s+(\d+)\s+(\S+)\s+\S+\s+(.*)$/i.exec(line.trim());
    if (!m) continue;
    const [, hex, desk, pid, cls, title] = m;
    if (desk === '-1' || SKIP_CLASS.test(cls) || ownPids.includes(+pid)) continue;
    const st = stateOf(hex);
    if (!st.normal) continue;
    const key = hexToKey(hex);
    out.push({ id: key, title: title || cls.split('.').pop(), cls, exe: exeOf(+pid) || cls, minimized: st.hidden, active: key === act });
  }
  return out;
}

function windowAction(id, action) {
  const hex = keyToHex(id);
  if (action === 'focus') run('wmctrl', ['-ia', hex]);
  else if (action === 'minimize') run('xdotool', ['windowminimize', hex]);
  else if (action === 'close') run('wmctrl', ['-ic', hex]);
}

function foregroundIsFullscreen() {
  const a = activeId();
  return a ? stateOf(keyToHex(a)).fullscreen : false;
}

function windowRect(id) {
  const o = sh('xdotool', ['getwindowgeometry', '--shell', keyToHex(id)]);
  const g = (k) => +((new RegExp(k + '=(-?\\d+)')).exec(o) || [0, 0])[1];
  if (!o) return null;
  const x = g('X'), y = g('Y'), w = g('WIDTH'), h = g('HEIGHT');
  return { left: x, top: y, right: x + w, bottom: y + h };
}
function placeWindow(id, rc) {
  const hex = keyToHex(id);
  run('wmctrl', ['-ir', hex, '-b', 'remove,maximized_vert,maximized_horz']);
  setTimeout(() => run('wmctrl', ['-ir', hex, '-e', `0,${rc.left},${rc.top},${rc.right - rc.left},${rc.bottom - rc.top}`]), 60);
  return true;
}
const setTopmost = (id, on) => { run('wmctrl', ['-ir', keyToHex(id), '-b', (on ? 'add' : 'remove') + ',above']); return true; };
const isTopmost = (id) => stateOf(keyToHex(id)).above;
const keyFromBuffer = (buf) => String(buf.readUInt32LE(0));

// ---------------------------------------------------------------- Eventos: xprop -spy avisa de cada cambio
let spy = null;
function watchWindows(onEvent) {
  spy = spawn('xprop', ['-root', '-spy', '_NET_CLIENT_LIST', '_NET_ACTIVE_WINDOW']);
  spy.stdout.setEncoding('utf8');
  spy.stdout.on('data', (d) => {
    for (const line of d.split('\n')) {
      if (line.startsWith('_NET_ACTIVE_WINDOW')) onEvent(EV.FOREGROUND, null);
      else if (line.startsWith('_NET_CLIENT_LIST')) onEvent(EV.CREATE, null);
    }
  });
  spy.on('error', () => { });
  return 1;
}
function unwatchWindows() { if (spy) { try { spy.kill(); } catch { } spy = null; } }

// ---------------------------------------------------------------- Varios
let inhibit = null;
function keepAwake(on) {
  if (on && !inhibit) inhibit = spawn('systemd-inhibit', ['--what=idle:sleep', '--who=Antuan', '--why=Mantener despierto', 'sleep', 'infinity'], { stdio: 'ignore' });
  if (!on && inhibit) { try { inhibit.kill(); } catch { } inhibit = null; }
}
const clipboardListen = () => false; // en Linux el nucleo vigila el portapapeles con un temporizador ligero
let wallpaper = '/usr/share/umbra/fondo.png';
const wallpaperPath = () => wallpaper;
function setWallpaper(p) { wallpaper = p; return true; } // lo pinta el propio escritorio Antuan
const installWinKeyHook = () => true;   // los atajos los da el gestor de ventanas (umbra-cmd)
const removeWinKeyHook = () => { };
const focusOwn = () => { };
const restoreForeground = () => { };
const GetAsyncKeyState = () => 0;

// Teclas virtuales de Windows -> combinaciones equivalentes en Antuan OS
const VK = { 0x5B: 'super', 0x10: 'shift', 0x11: 'ctrl', 0x12: 'alt', 0x53: 's', 0x4E: 'n', 0x44: 'd', 0x56: 'v', 0x1B: 'Escape',
  0x25: 'Left', 0x27: 'Right', 0xB0: 'XF86AudioNext', 0xB1: 'XF86AudioPrev', 0xB3: 'XF86AudioPlay', 0xB2: 'XF86AudioStop' };
function sendKeys(vks) {
  const k = vks.map((v) => VK[v]).filter(Boolean);
  if (!k.length) return;
  const combo = k.join('+');
  // Atajos de Windows que en Antuan OS hacen otra cosa
  if (combo === 'super+shift+s') return run('umbra-captura', []);
  if (combo === 'ctrl+shift+Escape') return run('umbra-cmd', ['centro:rendimiento']);
  if (combo === 'super+d') return run('wmctrl', ['-k', 'on']);
  // Escritorios virtuales (Mission Control): openbox los cambia por EWMH
  if (combo === 'super+ctrl+Left') return run('xdotool', ['set_desktop', '--relative', '--', '-1']);
  if (combo === 'super+ctrl+Right') return run('xdotool', ['set_desktop', '--relative', '1']);
  if (combo === 'super+ctrl+d') {
    const n = +(sh('xdotool', ['get_num_desktops']).trim()) || 1;
    run('wmctrl', ['-n', String(n + 1)]);
    return setTimeout(() => run('wmctrl', ['-s', String(n)]), 150);
  }
  // Sin centro de notificaciones en Antuan OS
  if (combo === 'super+n') return;
  run('xdotool', ['key', '--clearmodifiers', combo]);
}

module.exports = {
  hideTaskbar, showTaskbar, taskbarAutoHide, appbarSet, appbarRemove, getWorkArea, setWorkArea, listWindows, windowAction, focusOwn, restoreForeground,
  foregroundIsFullscreen, wallpaperPath, attachToDesktop, desktopHostAlive,
  watchWindows, unwatchWindows, windowRect, placeWindow, setTopmost, isTopmost, keepAwake, EV, clipboardListen, keyFromBuffer, setWallpaper, clickThrough,
  installWinKeyHook, removeWinKeyHook, sendKeys, GetAsyncKeyState
};
