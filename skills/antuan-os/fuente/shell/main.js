// Antuan Shell: dock, inicio y panel propios en lugar de la barra de Windows.
const { app, BrowserWindow, ipcMain, screen, shell, globalShortcut, clipboard, desktopCapturer, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, execFile } = require('child_process');
// Antuan funciona sobre Windows y como escritorio de Antuan OS: cada sistema tiene su motor.
const LINUX = process.platform === 'linux';
// Conversion entre pixeles logicos y fisicos: solo existe en Windows; en X11 ya coinciden.
const aPixeles = (r) => (LINUX ? r : require('electron').screen.dipToScreenRect(null, r));
const aDip = (r) => (LINUX ? r : require('electron').screen.screenToDipRect(null, r));
const native = LINUX ? require('./native-linux') : require('./native');
const apps = LINUX ? require('./apps-linux') : require('./apps');
const logos = require('./logos');
const escritorio = require('./escritorio');

if (!app.requestSingleInstanceLock()) { app.quit(); return; }
// Menos memoria: sin procesos de reserva ni servicios que Antuan no usa.
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion,SpareRendererForSitePerProcess,MediaSessionService,HardwareMediaKeyHandling,Translate,SpellCheck');
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=192');
app.commandLine.appendSwitch('disable-http-cache');

// Migracion: los datos de versiones anteriores pasan a la carpeta actual (%APPDATA%\Antuan).
// Antes se llamaba Umbra (%APPDATA%\Umbra) y, en las primeras versiones, umbra-shell.
try {
  const nuevo = app.getPath('userData');
  for (const nombre of ['Umbra', 'umbra-shell']) {
    const viejo = path.join(app.getPath('appData'), nombre);
    if (path.resolve(viejo).toLowerCase() === path.resolve(nuevo).toLowerCase()) continue;
    if (fs.existsSync(path.join(viejo, 'config.json')) && !fs.existsSync(path.join(nuevo, 'config.json'))) {
      fs.mkdirSync(nuevo, { recursive: true });
      for (const f of ['config.json', 'portapapeles.json', 'sesion.json', 'notas.txt']) if (fs.existsSync(path.join(viejo, f))) fs.copyFileSync(path.join(viejo, f), path.join(nuevo, f));
      // Fondos generados (Linux los guarda dentro de la carpeta de datos)
      const fondos = path.join(viejo, 'fondos');
      if (fs.existsSync(fondos) && fs.cpSync) fs.cpSync(fondos, path.join(nuevo, 'fondos'), { recursive: true });
      break;
    }
  }
} catch { }
const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json');
const DEFAULT_PINNED = ['archivos', 'google chrome', 'visual studio code', 'antigravity', 'claude', 'gemini', 'roblox studio', 'configuración'];
let config = {
  edge: 'bottom', dockSize: 46, magnify: true, accent: '#9db4ff', glass: 62,
  contrast: false, reduceMotion: false, bigText: false, focusRings: false, sounds: true,
  hideWindowsTaskbar: true, desktop: true, pinned: null
};
try { Object.assign(config, JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'))); } catch { }
const saveConfig = () => { try { fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true }); fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2)); } catch { } };

let win = null, catalog = [], originalWorkArea = null, prevForeground = null, panelOpen = false;
const ownPids = () => [process.pid, ...app.getAppMetrics().map((m) => m.pid)];

// ---------------------------------------------------------------- Area reservada para el dock
function reserveWorkArea() {
  const d = screen.getPrimaryDisplay();
  const thick = config.dockSize + 14 + 24; // dock + relleno + margenes
  const b = d.bounds;
  // El trozo de borde que ocupa el dock, en pixeles fisicos.
  const strip = { ...b };
  if (config.edge === 'bottom') { strip.y = b.y + b.height - thick; strip.height = thick; }
  if (config.edge === 'top') strip.height = thick;
  if (config.edge === 'left') strip.width = thick;
  if (config.edge === 'right') { strip.x = b.x + b.width - thick; strip.width = thick; }
  const p = aPixeles(strip);
  if (win) native.appbarSet(win.getNativeWindowHandle(), config.edge, { left: p.x, top: p.y, right: p.x + p.width, bottom: p.y + p.height }, APPBAR_MSG);
}
const APPBAR_MSG = 0x8007;

function applyShellMode() {
  if (config.hideWindowsTaskbar) native.hideTaskbar(); else native.showTaskbar();
  reserveWorkArea();
}

// ---------------------------------------------------------------- Ventana Antuan
// La capa de Antuan deja pasar los clics salvo donde hay algo suyo (dock, paneles).
// En Windows el sistema reenvia el movimiento del raton y la pagina decide (U.hit).
// En Antuan OS (X11) la ventana solo recibe el raton dentro de las zonas que la pagina declara
// (dock, barra, avisos): fuera de ellas los clics van a las ventanas de debajo, como en cualquier dock.
let atraviesa = true, zonas = [];
function aplicarZonas() {
  if (!win || win.isDestroyed()) return;
  const f = screen.getPrimaryDisplay().scaleFactor || 1;
  const r = zonas.map(([x, y, w, h]) => [Math.round(x * f), Math.round(y * f), Math.round(w * f), Math.round(h * f)]);
  native.clickThrough(win.getNativeWindowHandle(), atraviesa ? r : null);
}
function atravesar(si) {
  atraviesa = si;
  if (LINUX) { aplicarZonas(); return; }
  win.setIgnoreMouseEvents(si, si ? { forward: true } : undefined);
}
ipcMain.on('zonas', (_, r) => { if (!LINUX || !Array.isArray(r)) return; zonas = r.slice(0, 64); if (atraviesa) aplicarZonas(); });

function createWindow() {
  const d = screen.getPrimaryDisplay();
  win = new BrowserWindow({
    ...d.bounds, frame: false, transparent: true, resizable: false, movable: false,
    skipTaskbar: true, alwaysOnTop: true, hasShadow: false, show: false, focusable: true,
    backgroundColor: '#00000000', thickFrame: false, roundedCorners: false,
    // En Antuan OS es la barra del sistema: el gestor de ventanas la trata como dock (siempre encima, sin marco)
    ...(LINUX ? { type: 'dock' } : {}),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), backgroundThrottling: false }
  });
  win.setAlwaysOnTop(true, 'pop-up-menu');
  atravesar(true);
  win.loadFile(path.join(__dirname, 'ui', 'index.html'), { query: { login: process.argv.includes('--login') ? '1' : '0' } });
  win.once('ready-to-show', () => { win.showInactive(); if (LINUX) setTimeout(() => atravesar(atraviesa), 600); });
  // Historial del portapapeles: Windows avisa de cada copia (sin sondeos).
  if (!LINUX) {
    win.once('ready-to-show', () => { native.clipboardListen(win.getNativeWindowHandle(), true); });
    win.hookWindowMessage(0x031D, () => { try { onClipboard(); } catch (e) { log('portapapeles', e); } });
    // Windows avisa cuando otra barra o la resolucion cambian: se vuelve a reservar el borde.
    win.hookWindowMessage(APPBAR_MSG, (wParam) => { if (wParam.readUInt32LE(0) === 1) reserveWorkArea(); });
  } else {
    // Antuan OS: se comprueba el portapapeles con un temporizador muy ligero
    let ultimo = '';
    setInterval(() => {
      try {
        const sig = clipboard.availableFormats().join() + '|' + clipboard.readText().slice(0, 200);
        if (sig !== ultimo) { if (ultimo) onClipboard(); ultimo = sig; }
      } catch { }
    }, 1200);
  }
  win.on('blur', () => { if (panelOpen) win.webContents.send('close-panels'); });
  // El dock es la ventana principal: si se cierra (taskkill, cierre de sesion), Antuan termina limpio.
  win.on('closed', () => { win = null; app.quit(); });
  screen.on('display-metrics-changed', () => { if (!win || win.isDestroyed() || cleaned) return; const b = screen.getPrimaryDisplay().bounds; win.setBounds(b); reserveWorkArea(); win.webContents.send('layout'); });
}

// ---------------------------------------------------------------- Ordenes y consultas genericas
const { Ayudante } = require('./ayudante');
const CMDS = {}, ASKS = {};
ipcMain.on('cmd', (_, name, ...a) => { try { CMDS[name] && CMDS[name](...a); } catch (e) { log('cmd ' + name, e && e.stack || e); } });
ipcMain.handle('ask', async (_, name, ...a) => { try { return ASKS[name] ? await ASKS[name](...a) : null; } catch (e) { log('ask ' + name, e && e.stack || e); return null; } });

// Spotlight: busqueda de archivos en el indice de Windows
const buscador = LINUX ? require('./buscador-linux') : new Ayudante('buscador.ps1', { idleMs: 240000, timeoutMs: 4000 });
ASKS.files = async (q) => {
  if (!q || q.length < 2) return [];
  const r = await buscador.json('q ' + Buffer.from(q, 'utf8').toString('base64'));
  return Array.isArray(r) ? r : [];
};
ASKS.fileIcon = async (p) => { try { return (await app.getFileIcon(p, { size: 'normal' })).toDataURL(); } catch { return null; } };
CMDS.openPath = (p) => (LINUX ? abrirRuta(p) : shell.openPath(p));
// Antuan OS: nada de .exe/.msc/.cpl ni rutas de Windows; solo ordenes que existen en el sistema
CMDS.exec = (f, args = []) => (LINUX ? (typeof f === 'string' && !/\.(exe|msc|cpl)$|\\/i.test(f) && existeCmd(f) ? herramienta(f, [].concat(args).map(String)) : noDisponible(f)) : execFile(f, args, { windowsHide: false }));
CMDS.reveal = (p) => (LINUX ? mostrarEnArchivos(p) : shell.showItemInFolder(p));
CMDS.web = (q) => shell.openExternal('https://www.google.com/search?q=' + encodeURIComponent(String(q)));
CMDS.copy = (t) => clipboard.writeText(String(t));
// Antuan OS: "shutdown +N" pide permisos de administrador; el temporizador lo lleva Antuan y apaga con systemctl
let apagadoT = null;
CMDS.shutdownIn = (min) => (LINUX ? (clearTimeout(apagadoT), apagadoT = setTimeout(() => execFile('systemctl', ['poweroff']), Math.max(0, Math.round(min)) * 60000)) : execFile('shutdown.exe', ['/s', '/t', String(Math.max(0, Math.round(min * 60)))]));
CMDS.cancelShutdown = () => (LINUX ? (clearTimeout(apagadoT), apagadoT = null) : execFile('shutdown.exe', ['/a']));
CMDS.emptyBin = () => LINUX ? execFile('gio', ['trash', '--empty']) : execFile('powershell.exe', ['-NoProfile', '-Command', 'Clear-RecycleBin -Force -ErrorAction SilentlyContinue'], { windowsHide: true });
ASKS.workArea = () => screen.getPrimaryDisplay().workArea;

// Gestion del PC (Centro Antuan) y juegos
const gestion = LINUX ? require('./gestion-linux') : require('./gestion');
const juegos = require('./juegos');
ASKS.netInfo = () => gestion.red();
// Uso de CPU y RAM sin lanzar procesos (para widgets: coste cero)
let cpuPrev = null;
ASKS.sysLite = () => {
  const os = require('os');
  const t = os.cpus().reduce((a, c) => { for (const k in c.times) a[k === 'idle' ? 'idle' : 'busy'] += c.times[k]; return a; }, { idle: 0, busy: 0 });
  let cpu = null;
  if (cpuPrev) { const di = t.idle - cpuPrev.idle, db = t.busy - cpuPrev.busy; cpu = Math.round(db / Math.max(1, di + db) * 100); }
  cpuPrev = t;
  const tot = os.totalmem(), free = os.freemem();
  return { cpu, ram: Math.round((tot - free) / tot * 100), ramGB: +((tot - free) / 1073741824).toFixed(1), totGB: Math.round(tot / 1073741824), up: os.uptime() };
};
ASKS.saveNotes = (t) => { try { fs.writeFileSync(path.join(app.getPath('userData'), 'notas.txt'), String(t)); } catch { } return true; };
ASKS.notes = () => { try { return fs.readFileSync(path.join(app.getPath('userData'), 'notas.txt'), 'utf8'); } catch { return ''; } };
ASKS.gestion = (fn, ...a) => (typeof gestion[fn] === 'function' ? gestion[fn](...a) : null);

// ---------------------------------------------------------------- Juegos y Modo Juego
const { ModoJuego, servidoresDe, warp } = require('./juego');
const notifyUI = (ic, text) => { if (win && !win.isDestroyed()) win.webContents.send('toast', ic, text); broadcast('game-state', modoJuego.estado()); };
const modoJuego = new ModoJuego({ sis: { json: (c) => sis.json(c) }, log: (...a) => log(...a), notify: notifyUI });
let gamesCache = null, gamesAt = 0;
async function listaJuegos(force) {
  if (!gamesCache || force || Date.now() - gamesAt > 600000) {
    gamesCache = await juegos.detectar(); gamesAt = Date.now();
    // Icono: el de la app de la Store si se lanza asi; si no, el del acceso directo o el exe.
    const src = (g) => (g.lanzar && /^shell:AppsFolder\\/i.test(g.lanzar.valor) ? g.lanzar.valor : g.icono || g.exe);
    await logos.enrich(gamesCache.map((g) => Object.assign(g, { kind: undefined, path: src(g), exe: /^shell:/i.test(src(g)) ? undefined : g.exe, _exe: g.exe }))).catch(() => { });
    for (const g of gamesCache) if (g._exe) g.exe = g._exe;
  }
  return gamesCache;
}
ASKS.games = async (force) => (await listaJuegos(force)).map((g) => ({ ...g, png: g.png ? require('url').pathToFileURL(g.png).href : null }));
ASKS.gameCheck = () => modoJuego.revisar();
ASKS.gameState = () => modoJuego.estado();
ASKS.gamePlay = async (id, opts) => {
  const g = (await listaJuegos()).find((x) => x.id === id); if (!g) return null;
  const hechos = config.gameAuto === false && !opts ? [] : await modoJuego.activar(g, Object.assign({}, config.gameOpts || {}, opts || {}));
  const l = g.lanzar || {};
  // Antuan OS: steam://, heroic://... van a xdg-open (sin explorer.exe de reserva)
  if (LINUX && typeof l.valor !== 'string') noDisponible(l.valor);
  else if (l.tipo === 'uri' && LINUX) { if (/^(ms-|shell:|[a-z]:\\)/i.test(l.valor)) noDisponible(l.valor); else shell.openExternal(l.valor).catch(() => noDisponible(l.valor)); }
  else if (l.tipo === 'uri') shell.openExternal(l.valor).catch(() => execFile('explorer.exe', [l.valor]));
  else if (l.tipo === 'lnk') (LINUX ? abrirRuta(l.valor) : shell.openPath(l.valor));
  else if (l.tipo === 'exe') { const m = /^"([^"]+)"\s*(.*)$/.exec(l.valor); if (m) spawn(m[1], m[2] ? m[2].split(' ') : [], { detached: true, stdio: 'ignore' }).unref(); else shell.openPath(l.valor); }
  broadcast('game-state', modoJuego.estado());
  return hechos;
};
ASKS.gameStop = async () => { await modoJuego.desactivar(true); return true; };
ASKS.gameServers = async () => { const e = modoJuego.estado(); return e && e.pid ? servidoresDe(e.pid) : []; };
ASKS.warp = (accion) => warp(accion);
// Deteccion automatica: si la ventana activa es un juego conocido, se activa el Modo Juego.
async function autoGame(groups) {
  if (config.gameAuto === false || modoJuego.estado() || !gamesCache) return;
  const fg = groups.find((g) => g.windows.some((w) => w.active));
  if (!fg || !fg.exe) return;
  const exe = fg.exe.toLowerCase(), base = path.basename(exe);
  const g = gamesCache.find((j) => (j.exe && j.exe.toLowerCase() === exe) || (j.procesos || []).includes(base) || (j.carpeta && exe.startsWith(j.carpeta.toLowerCase())));
  if (g) { await modoJuego.activar(g, config.gameOpts || {}); notifyUI('game', 'Modo Juego activado · ' + g.nombre); }
}

// ---------------------------------------------------------------- Centro Antuan (ventana propia, se crea al abrirla)
let centro = null;
function abrirCentro(seccion) {
  if (centro && !centro.isDestroyed()) {
    if (centro.isMinimized()) centro.restore();
    centro.show(); centro.focus();
    if (seccion) centro.webContents.send('goto', seccion);
    return;
  }
  const wa = screen.getPrimaryDisplay().workArea;
  const w = Math.min(1180, wa.width - 60), h = Math.min(760, wa.height - 40);
  centro = new BrowserWindow({
    width: w, height: h, x: wa.x + Math.round((wa.width - w) / 2), y: wa.y + Math.round((wa.height - h) / 2),
    minWidth: 860, minHeight: 560, show: false, title: 'Centro Antuan', backgroundColor: '#0b0d12',
    titleBarStyle: 'hidden', titleBarOverlay: { color: '#0b0d12', symbolColor: '#c9cdd8', height: 46 },
    backgroundMaterial: 'acrylic',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), spellcheck: false }
  });
  centro.loadFile(path.join(__dirname, 'ui', 'centro.html'), { query: { s: seccion || 'resumen' } });
  centro.once('ready-to-show', () => { centro.show(); centro.focus(); });
  for (const ev of ['focus', 'blur', 'show', 'hide', 'minimize', 'restore']) centro.on(ev, () => schedulePoll(30));
  // Al cerrarse se destruye: cero memoria cuando no lo usas.
  centro.on('closed', () => { centro = null; schedulePoll(30); });
}
CMDS.centro = (s) => abrirCentro(s);

// ---------------------------------------------------------------- Apps propias de Antuan (Archivos, Tienda...)
// Cada una es una ventana de Antuan que aparece en el dock como cualquier app.
const APPS_UMBRA = {
  archivos: { name: 'Archivos', glyph: 'folder', hue: 220, html: 'archivos.html', minW: 720, minH: 460, w: 1180, h: 740 },
  tienda: { name: 'Antuan Tienda', glyph: 'bag', hue: 200, html: 'tienda.html', minW: 860, minH: 560, w: 1240, h: 780, unica: true },
  terminal: { name: 'Terminal', glyph: 'terminal', hue: 240, html: 'terminal.html', minW: 520, minH: 320, w: 980, h: 620 }
};
require('./terminal-core').registrar();
const appWins = new Set();
function abrirAppUmbra(tipo, query = {}) {
  const def = APPS_UMBRA[tipo]; if (!def) return;
  if (def.unica) {
    const ya = [...appWins].find((w) => w._tipo === tipo && !w.isDestroyed());
    if (ya) {
      if (ya.isMinimized()) ya.restore(); ya.show(); ya.focus();
      if (query.paquete) ya.webContents.send('tienda-paquete', query.paquete);
      return;
    }
  }
  const wa = screen.getPrimaryDisplay().workArea;
  const w = Math.min(def.w, wa.width - 60), h = Math.min(def.h, wa.height - 40);
  const off = [...appWins].filter((x) => x._tipo === tipo).length * 28;
  const v = new BrowserWindow({
    width: w, height: h, x: wa.x + Math.round((wa.width - w) / 2) + off, y: wa.y + Math.round((wa.height - h) / 2) + off,
    minWidth: def.minW, minHeight: def.minH, show: false, title: def.name, backgroundColor: '#0b0d12', backgroundMaterial: 'acrylic',
    titleBarStyle: 'hidden', titleBarOverlay: { color: '#0b0d12', symbolColor: '#c9cdd8', height: 46 },
    webPreferences: { preload: path.join(__dirname, 'preload.js'), spellcheck: false }
  });
  v._tipo = tipo;
  appWins.add(v);
  v.loadFile(path.join(__dirname, 'ui', def.html), { query });
  v.once('ready-to-show', () => { v.show(); v.focus(); });
  for (const ev of ['focus', 'blur', 'show', 'hide', 'minimize', 'restore']) v.on(ev, () => schedulePoll(30));
  v.on('closed', () => { appWins.delete(v); schedulePoll(30); });
}
CMDS.archivos = (dir) => abrirAppUmbra('archivos', dir ? { dir } : {});
CMDS.tienda = (paquete) => abrirAppUmbra('tienda', paquete ? { paquete } : {});
require('./archivos-core')({ ASKS, CMDS, app, shell, clipboard, nativeImage, log: (...a) => log(...a) });
require('./tienda-core')({
  ASKS, CMDS, app, shell, log: (...a) => log(...a),
  abrirTerminal: (orden) => abrirAppUmbra('terminal', { orden }),
  enviar: (c, ...d) => { for (const v of appWins) if (v._tipo === 'tienda' && !v.isDestroyed()) v.webContents.send(c, ...d); }
});
// Apps propias que aparecen en el Inicio, el Spotlight y el dock como cualquier otra
const APPS_PROPIAS = [
  { id: 'umbra:tienda', name: 'Antuan Tienda', kind: 'umbra', glyph: 'bag', hue: 200 },
  { id: 'umbra:centro', name: 'Centro Antuan', kind: 'umbra', glyph: 'dock', hue: 228 },
  { id: 'umbra:terminal', name: 'Terminal Antuan', kind: 'umbra', glyph: 'terminal', hue: 240 }
];
CMDS.terminal = (dir) => abrirAppUmbra('terminal', dir ? { dir } : {});
// Antuan OS: las apps de consola de los .desktop (Terminal=true) se abren en la Terminal Antuan
if (LINUX) apps.setTerminal((argv) => abrirAppUmbra('terminal', { orden: argv.map((a) => "'" + String(a).replace(/'/g, "'\\''") + "'").join(' ') }));

// ---------------------------------------------------------------- Antuan OS: abrir direcciones sin sorpresas
// xdg-open manda al navegador todo lo que no entiende (ms-settings:, shell:, objetos convertidos en texto...).
// Solo pasan direcciones web reales y rutas que existen; lo de Windows se traduce a Antuan o se descarta con aviso.
ASKS.plataforma = () => process.platform;
const existeCmd = (c) => LINUX && typeof c === 'string' && (c.startsWith('/') ? fs.existsSync(c) : ['/usr/bin/', '/usr/local/bin/', '/bin/', '/usr/sbin/'].some((d) => fs.existsSync(d + c)));
const avisar = (ic, t) => { if (win && !win.isDestroyed()) win.webContents.send('toast', ic, t); };
const noDisponible = (que) => { log('no disponible en Antuan OS:', typeof que === 'string' ? que.slice(0, 200) : typeof que); avisar('info', 'No disponible en Antuan OS'); };
function herramienta(cmd, args = [], alternativa) {
  if (existeCmd(cmd)) { try { const p = spawn(cmd, args, { detached: true, stdio: 'ignore' }); p.on('error', (e) => log('herramienta', cmd, e.message)); p.unref(); return true; } catch (e) { log('herramienta', cmd, e.message); } }
  if (alternativa) return alternativa();
  noDisponible(cmd); return false;
}
// Carpetas: Archivos Antuan; lanzadores .desktop: se arrancan; el resto, con su app predeterminada
function abrirRuta(p) {
  if (typeof p !== 'string' || !p || !path.isAbsolute(p) || !fs.existsSync(p)) return noDisponible(p);
  try { if (fs.statSync(p).isDirectory()) return abrirAppUmbra('archivos', { dir: p }); } catch { }
  if (/\.desktop$/i.test(p)) return apps.launchDesktopFile(p) || noDisponible(p);
  return shell.openPath(p);
}
function mostrarEnArchivos(p) {
  if (typeof p !== 'string' || !path.isAbsolute(p) || !fs.existsSync(p)) return noDisponible(p);
  abrirAppUmbra('archivos', { dir: path.dirname(p) });
}
// Luz nocturna sin programas extra: gamma calida con xrandr en todas las pantallas conectadas
function luzNocturna(on) {
  execFile('xrandr', ['--query'], { encoding: 'utf8' }, (e, out) => {
    for (const m of String(out || '').matchAll(/^(\S+) connected/gm)) execFile('xrandr', ['--output', m[1], '--gamma', on ? '1:0.84:0.68' : '1:1:1'], () => { });
  });
}
CMDS.luzNocturna = () => {
  config.luzNocturna = !config.luzNocturna; saveConfig(); luzNocturna(config.luzNocturna);
  avisar('sun', config.luzNocturna ? 'Luz nocturna activada' : 'Luz nocturna desactivada');
};
const centroEn = (s) => () => abrirCentro(s);
// ms-settings:<pagina> -> su sitio en Antuan OS (null = no existe aqui)
const AJUSTES_LINUX = [
  [/^(home|about)?$/, centroEn('resumen')],
  [/^(display|project|screenrotation)/, () => herramienta('arandr')],
  [/^(sound|apps-volume)/, centroEn('sonido')],
  [/^(network|proxy|datausage|airplanemode)/, centroEn('red')],
  [/^(bluetooth|devices$|connecteddevices)/, () => herramienta('blueman-manager')],
  [/^(personalization|colors|themes|lockscreen|taskbar|fonts)/, centroEn('look')],
  [/^(powersleep|batterysaver|power)/, centroEn('energia')],
  [/^storage/, centroEn('disco')],
  [/^(windowsupdate|delivery-optimization)/, centroEn('updates')],
  [/^(appsfeatures|optionalfeatures)/, () => abrirAppUmbra('tienda')],
  [/^startupapps/, centroEn('inicio')],
  [/^privacy/, centroEn('privacidad')],
  [/^(easeofaccess|accessibility)/, centroEn('access')],
  [/^gaming/, centroEn('juegos')],
  [/^nightlight/, () => CMDS.luzNocturna()],
  [/^printers/, () => herramienta('system-config-printer', [], () => shell.openExternal('http://localhost:631/'))],
  [/^(accounts|yourinfo)/, centroEn('sistema')]
];
function ajusteLinux(uri) {
  const k = String(uri).replace(/^ms-settings:/i, '').split('?')[0].toLowerCase();
  const r = AJUSTES_LINUX.find(([re]) => re.test(k));
  return r ? r[1] : null;
}
// El Spotlight pregunta que ajustes existen en Antuan OS para no ofrecer los que no
ASKS.ajustesLinux = (uris) => [].concat(uris || []).filter((u) => typeof u === 'string' && /^ms-settings:/i.test(u) && ajusteLinux(u));
const CARPETAS_SHELL = { desktop: 'desktop', personal: 'documents', 'my documents': 'documents', downloads: 'downloads', 'my pictures': 'pictures', 'my music': 'music', 'my video': 'videos', profile: 'home' };
function abrirSeguro(x) {
  if (typeof x !== 'string' || !x.trim()) return noDisponible(x);
  const u = x.trim();
  if (/^(https?:\/\/|mailto:)/i.test(u)) return shell.openExternal(u);
  if (/^file:\/\//i.test(u)) { try { return abrirRuta(require('url').fileURLToPath(u)); } catch { return noDisponible(u); } }
  if (/^ms-settings:/i.test(u)) { const f = ajusteLinux(u); return f ? f() : noDisponible(u); }
  if (/^shell:/i.test(u)) {
    const k = u.slice(6).split(/[\\/]/)[0].toLowerCase();
    if (k === 'recyclebinfolder') return abrirAppUmbra('archivos', { dir: 'umbra:papelera' });
    const d = CARPETAS_SHELL[k]; if (d) { try { return abrirAppUmbra('archivos', { dir: app.getPath(d) }); } catch { } }
    return noDisponible(u);
  }
  if (u.startsWith('/')) return abrirRuta(u);
  noDisponible(u);
}
ASKS.config = () => config;
ASKS.loginItem = () => app.getLoginItemSettings(loginArgs()).openAtLogin;
// Antuan OS: no hay scripts de PowerShell que elevar (la interfaz oculta esas opciones); se responde que no se aplico
ASKS.elevated = (script) => LINUX ? Promise.resolve(false) : new Promise((resolve) => {
  // Acciones de administrador que pide el usuario desde el Centro: Windows muestra su aviso de permiso.
  const enc = Buffer.from(script, 'utf16le').toString('base64');
  execFile('powershell.exe', ['-NoProfile', '-Command', `Start-Process powershell -Verb RunAs -Wait -WindowStyle Hidden -ArgumentList '-NoProfile','-EncodedCommand','${enc}'`],
    { windowsHide: true }, (e) => resolve(!e));
});
ASKS.setWallpaper = (dataUrl) => {
  const dir = LINUX ? path.join(app.getPath('userData'), 'fondos') : path.join(process.env.LOCALAPPDATA, 'UmbraOS'); fs.mkdirSync(dir, { recursive: true });
  // Nombre nuevo cada vez: Windows no recarga un fondo con la misma ruta.
  for (const f of fs.readdirSync(dir)) if (/^umbra-fondo-\d+\.png$/.test(f)) { try { fs.unlinkSync(path.join(dir, f)); } catch { } }
  const p = path.join(dir, `umbra-fondo-${Date.now()}.png`);
  fs.writeFileSync(p, Buffer.from(dataUrl.split(',')[1], 'base64'));
  const ok = native.setWallpaper(p);
  if (LINUX) { config.wallpaperPath = p; saveConfig(); }
  broadcast('wallpaper', require('url').pathToFileURL(p).href);
  return ok;
};
ASKS.exportConfig = async () => {
  const { dialog } = require('electron');
  const r = await dialog.showSaveDialog(centro || win, { title: 'Guardar configuración de Antuan', defaultPath: path.join(app.getPath('documents'), 'umbra-config.json'), filters: [{ name: 'Antuan', extensions: ['json'] }] });
  if (r.canceled || !r.filePath) return false;
  fs.writeFileSync(r.filePath, JSON.stringify(config, null, 2)); return true;
};
ASKS.importConfig = async () => {
  const { dialog } = require('electron');
  const r = await dialog.showOpenDialog(centro || win, { title: 'Importar configuración de Antuan', filters: [{ name: 'Antuan', extensions: ['json'] }], properties: ['openFile'] });
  if (r.canceled || !r.filePaths[0]) return false;
  try {
    const c = JSON.parse(fs.readFileSync(r.filePaths[0], 'utf8'));
    for (const k of ['taskbarWasAutoHide', 'loginItemSet']) delete c[k];
    Object.assign(config, c); saveConfig(); broadcast('config-changed', c); reserveWorkArea(); return true;
  } catch { return false; }
};
// Antuan OS: salir con exito cerraria la sesion; con un codigo de error umbra-session vuelve a abrir Antuan
CMDS.relaunch = () => { if (LINUX) { cleanup(); app.exit(75); return; } app.relaunch(); app.quit(); };
CMDS['keep-awake-set'] = (on) => { config.keepAwake = !!on; saveConfig(); native.keepAwake(!!on); };
function broadcast(ch, ...a) { for (const w of [win, desk, centro]) if (w && !w.isDestroyed()) w.webContents.send(ch, ...a); }

// Miniaturas reales de las ventanas (Mission Control y vistas previas del dock)
ASKS.thumbs = async (keys, w = 480, h = 300) => {
  const want = keys ? new Set(keys) : null;
  const srcs = await desktopCapturer.getSources({ types: ['window'], thumbnailSize: { width: w, height: h }, fetchWindowIcons: false });
  const out = {};
  for (const s of srcs) {
    const m = /^window:(\d+):/.exec(s.id);
    if (!m || (want && !want.has(m[1]))) continue;
    if (!s.thumbnail.isEmpty()) out[m[1]] = s.thumbnail.toJPEG(82).toString('base64');
  }
  return out;
};
// Posicion de cada ventana en coordenadas de la interfaz (para animarlas desde donde estan)
ASKS.windowRects = (keys) => {
  const out = {};
  for (const k of keys) {
    const rc = native.windowRect(k);
    if (rc) { const d = aDip({ x: rc.left, y: rc.top, width: rc.right - rc.left, height: rc.bottom - rc.top }); out[k] = d; }
  }
  return out;
};
CMDS.placeWindow = (key, r) => { const p = aPixeles(r); native.placeWindow(key, { left: p.x, top: p.y, right: p.x + p.width, bottom: p.y + p.height }); };
CMDS.topmost = (key, on) => native.setTopmost(key, on);
ASKS.isTopmost = (key) => native.isTopmost(key);

// ---------------------------------------------------------------- Portapapeles con historial
const CLIP_PATH = () => path.join(app.getPath('userData'), 'portapapeles.json');
let clipHist = [];
try { clipHist = JSON.parse(fs.readFileSync(CLIP_PATH(), 'utf8')); } catch { }
let clipSaveT = null, clipIgnore = false;
function onClipboard() {
  if (clipIgnore || config.clipboardPaused) return;
  const fmts = clipboard.availableFormats();
  let item = null;
  if (fmts.some((f) => f.startsWith('image/'))) {
    const img = clipboard.readImage();
    if (!img.isEmpty()) {
      const s = img.getSize();
      item = { type: 'img', thumb: img.resize({ width: Math.min(320, s.width) }).toDataURL(), w: s.width, h: s.height };
    }
  } else {
    const t = clipboard.readText();
    if (t && t.trim()) item = { type: 'text', text: t.length > 20000 ? t.slice(0, 20000) : t };
  }
  if (!item) return;
  item.time = Date.now();
  if (item.type === 'text') clipHist = clipHist.filter((c) => !(c.type === 'text' && c.text === item.text));
  clipHist.unshift(item);
  const pinned = clipHist.filter((c) => c.pin), rest = clipHist.filter((c) => !c.pin).slice(0, 60);
  clipHist = [...pinned, ...rest];
  clearTimeout(clipSaveT);
  // Solo el texto se guarda en disco (las imagenes viven en memoria).
  clipSaveT = setTimeout(() => { try { fs.writeFileSync(CLIP_PATH(), JSON.stringify(clipHist.filter((c) => c.type === 'text'))); } catch { } }, 1500);
}
ASKS.clipboard = () => clipHist;
CMDS.clipPaste = (i, paste = true) => {
  const c = clipHist[i]; if (!c) return;
  clipIgnore = true;
  if (c.type === 'text') clipboard.writeText(c.text); else clipboard.writeImage(nativeImage.createFromDataURL(c.thumb));
  setTimeout(() => { clipIgnore = false; }, 300);
  // Pega en la app que tenia el foco (Ctrl+V tras devolverle el foco)
  if (paste) setTimeout(() => native.sendKeys([0x11, 0x56]), 260);
};
CMDS.clipPin = (i) => { if (clipHist[i]) { clipHist[i].pin = !clipHist[i].pin; onClipboardSave(); } };
CMDS.clipDelete = (i) => { clipHist.splice(i, 1); onClipboardSave(); };
CMDS.clipClear = () => { clipHist = clipHist.filter((c) => c.pin); onClipboardSave(); };
function onClipboardSave() { try { fs.writeFileSync(CLIP_PATH(), JSON.stringify(clipHist.filter((c) => c.type === 'text'))); } catch { } }

// ---------------------------------------------------------------- Reabrir lo cerrado y restaurar sesion
const closedStack = [];
let lastGroups = new Map();
function trackClosed(groups) {
  const now = new Map(groups.map((g) => [g.id, g]));
  for (const [id, g] of lastGroups) if (!now.has(id) && (g.appId || g.exe)) closedStack.push({ appId: g.appId, exe: g.exe, name: g.name || path.basename(g.exe || '') });
  if (closedStack.length > 20) closedStack.splice(0, closedStack.length - 20);
  lastGroups = now;
  saveSessionSoon(groups);
}
// Antuan OS: un ejecutable se arranca (xdg-open lo abriria como archivo); en Windows, como siempre
function abrirExe(p) {
  if (!LINUX) return shell.openPath(p);
  if (typeof p === 'string' && p.startsWith('/') && fs.existsSync(p)) { try { const c = spawn(p, [], { detached: true, stdio: 'ignore', cwd: require('os').homedir() }); c.on('error', () => { }); c.unref(); return; } catch { } }
  noDisponible(p);
}
CMDS.reopen = () => {
  const c = closedStack.pop();
  if (!c) return win && win.webContents.send('toast', 'restart', 'No hay nada que reabrir');
  const a = c.appId && catalog.find((x) => x.id === c.appId);
  if (a) apps.launch(a); else if (c.exe) abrirExe(c.exe);
  if (win) win.webContents.send('toast', 'restart', 'Reabriendo ' + ((a && (a.display || a.name)) || c.name));
};
const SESSION_PATH = () => path.join(app.getPath('userData'), 'sesion.json');
let previousSession = null;
try { previousSession = JSON.parse(fs.readFileSync(SESSION_PATH(), 'utf8')); } catch { }
let sessionT = null;
function saveSessionSoon(groups) {
  clearTimeout(sessionT);
  sessionT = setTimeout(() => {
    const items = groups.filter((g) => g.exe && !/\\(explorer|ApplicationFrameHost|SystemSettings|TextInputHost)\.exe$/i.test(g.exe)).map((g) => {
      const w = g.windows.find((x) => !x.minimized) || g.windows[0];
      return { appId: g.appId || null, exe: g.exe, name: g.name || null, rect: native.windowRect(w.id) };
    });
    try { fs.writeFileSync(SESSION_PATH(), JSON.stringify({ time: Date.now(), items })); } catch { }
  }, 4000);
}
ASKS.sessionOffer = () => {
  const s = previousSession;
  if (!s || !s.items || !s.items.length || Date.now() - s.time > 7 * 864e5) return null;
  const running = new Set([...lastGroups.values()].map((g) => (g.exe || '').toLowerCase()));
  const items = s.items.filter((i) => !running.has((i.exe || '').toLowerCase()));
  return items.length ? items.map((i) => {
    const a = i.appId && catalog.find((x) => x.id === i.appId);
    return { name: a ? (a.display || a.name) : (i.name || path.basename(i.exe, '.exe')), appId: i.appId, logo: a && a.logo, glyph: a && a.glyph, hue: a && a.hue };
  }) : null;
};
CMDS.restoreSession = () => {
  const s = previousSession; previousSession = null;
  if (!s) return;
  const running = new Set([...lastGroups.values()].map((g) => (g.exe || '').toLowerCase()));
  const todo = s.items.filter((i) => !running.has((i.exe || '').toLowerCase()));
  for (const i of todo) {
    const a = i.appId && catalog.find((x) => x.id === i.appId);
    if (a) apps.launch(a); else if (i.exe) abrirExe(i.exe);
  }
  // Cuando aparecen sus ventanas, vuelven a su sitio.
  const placeAll = () => {
    for (const i of todo) {
      if (!i.rect) continue;
      const g = [...lastGroups.values()].find((x) => (x.exe || '').toLowerCase() === (i.exe || '').toLowerCase());
      if (g && !i.placed) { native.placeWindow(g.windows[0].id, i.rect); i.placed = true; }
    }
  };
  setTimeout(placeAll, 6000); setTimeout(placeAll, 12000); setTimeout(placeAll, 20000);
};

// ---------------------------------------------------------------- Mantener despierto
CMDS.toggleAwake = () => {
  config.keepAwake = !config.keepAwake; saveConfig(); native.keepAwake(config.keepAwake);
  if (win) win.webContents.send('toast', 'sun', config.keepAwake ? 'El PC se mantendrá despierto' : 'El PC vuelve a suspenderse normal');
  if (win) win.webContents.send('config-changed', { keepAwake: config.keepAwake });
};

// ---------------------------------------------------------------- Captura: selector de color y OCR
let capWin = null;
async function openCapture(mode) {
  if (capWin) return;
  const d = screen.getPrimaryDisplay();
  const phys = { width: Math.round(d.bounds.width * d.scaleFactor), height: Math.round(d.bounds.height * d.scaleFactor) };
  if (win) win.webContents.send('close-panels');
  await new Promise((r) => setTimeout(r, 120));
  const srcs = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: phys });
  const src = srcs.find((s) => s.display_id === String(d.id)) || srcs[0];
  if (!src) return;
  const file = path.join(app.getPath('temp'), 'umbra-captura.png');
  fs.writeFileSync(file, src.thumbnail.toPNG());
  capWin = new BrowserWindow({
    ...d.bounds, frame: false, show: false, skipTaskbar: true, alwaysOnTop: true, resizable: false, movable: false,
    hasShadow: false, backgroundColor: '#000000', webPreferences: { preload: path.join(__dirname, 'preload.js') }
  });
  capWin.setAlwaysOnTop(true, 'screen-saver');
  capWin.loadFile(path.join(__dirname, 'ui', 'captura.html'), { query: { modo: mode, img: require('url').pathToFileURL(file).href + '?' + Date.now() } });
  capWin.once('ready-to-show', () => { capWin.show(); capWin.focus(); });
  capWin.on('closed', () => { capWin = null; });
}
CMDS.colorPicker = () => openCapture('color');
CMDS.ocr = () => openCapture('ocr');
CMDS.captureDone = (kind, value) => {
  if (capWin) capWin.close();
  if (!value) return;
  clipboard.writeText(value);
  if (win) win.webContents.send('toast', kind === 'color' ? 'palette' : 'text', kind === 'color' ? 'Color copiado: ' + value : 'Texto copiado (' + value.length + ' caracteres)');
};
ASKS.ocrImage = async (dataUrl) => {
  const file = path.join(app.getPath('temp'), 'umbra-ocr.png');
  fs.writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
  return new Promise((resolve) => {
    // Antuan OS: Tesseract (espanol + ingles), sin internet
    if (LINUX) return execFile('tesseract', [file, '-', '-l', 'spa+eng'], { encoding: 'utf8', timeout: 20000 }, (err, out) => resolve(err ? '' : String(out).trim()));
    execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'ocr.ps1'), '-Ruta', file],
      { windowsHide: true, encoding: 'utf8', timeout: 15000 }, (err, out) => resolve(err ? '' : String(out).trim()));
  });
};

// ---------------------------------------------------------------- Escritorio Antuan
let desk = null;
function createDesktop() {
  if (!config.desktop || cleaned) return;
  const d = screen.getPrimaryDisplay();
  desk = new BrowserWindow({
    ...d.bounds, frame: false, show: false, skipTaskbar: true, resizable: false, movable: false,
    hasShadow: false, thickFrame: false, roundedCorners: false, backgroundColor: '#07080b',
    ...(LINUX ? { type: 'desktop' } : {}),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), backgroundThrottling: true, spellcheck: false }
  });
  desk.loadFile(path.join(__dirname, 'ui', 'escritorio.html'));
  desk.once('ready-to-show', () => {
    const p = aPixeles(screen.getPrimaryDisplay().bounds);
    native.attachToDesktop(desk.getNativeWindowHandle(), { left: p.x, top: p.y, right: p.x + p.width, bottom: p.y + p.height });
    desk.showInactive();
  });
  // Si el Explorador se reinicia, la capa del fondo se recrea: se vuelve a colgar el escritorio.
  desk.on('closed', () => { desk = null; if (!cleaned && config.desktop) setTimeout(createDesktop, 3000); });
}
const sendDesktop = (ch, ...a) => { if (desk && !desk.isDestroyed()) desk.webContents.send(ch, ...a); };
escritorio.watch(() => sendDesktop('desktop-changed'));

ipcMain.handle('desktop-items', () => escritorio.list());
ipcMain.handle('desktop-info', () => {
  const wp = native.wallpaperPath();
  return { config, wallpaper: wp && fs.existsSync(wp) ? require('url').pathToFileURL(wp).href : null, user: (process.env.USERNAME || process.env.USER || 'Tú').replace(/^\w/, (c) => c.toUpperCase()) };
});
ipcMain.on('desktop-open', (_, p) => {
  // Antuan OS: la papelera y las carpetas se abren en Archivos Antuan; los lanzadores .desktop se arrancan
  if (LINUX) return p === 'trash:///' ? abrirAppUmbra('archivos', { dir: 'umbra:papelera' }) : abrirRuta(p);
  escritorio.open(p);
});
ipcMain.on('desktop-reveal', (_, p) => (LINUX ? mostrarEnArchivos(p) : escritorio.reveal(p)));
ipcMain.handle('desktop-trash', async (_, p) => { try { await escritorio.trash(p); return true; } catch { return false; } });
ipcMain.handle('desktop-new-folder', () => escritorio.newFolder());
ipcMain.on('desktop-umbra-settings', () => { if (win) win.webContents.send('open-settings'); });
ipcMain.on('desktop-launcher', () => { if (win) win.webContents.send('toggle-launcher'); });

// ---------------------------------------------------------------- Ventanas abiertas -> dock
const iconCache = new Map();
// Apps de la Store: ...\WindowsApps\Claude_2.1.0_x64__pzs8sxrjxfjjc\... -> claude_pzs8sxrjxfjjc
function packageFamily(exePath) {
  const m = /\\windowsapps\\([^\\]+)\\/i.exec(exePath);
  if (!m) return null;
  const parts = m[1].split('__');
  return parts.length === 2 ? (parts[0].split('_')[0] + '_' + parts[1]).toLowerCase() : null;
}
async function runningGroups() {
  const wins = native.listWindows(ownPids());
  const groups = new Map();
  for (const w of wins) {
    const key = (w.exe || w.title).toLowerCase();
    if (!groups.has(key)) groups.set(key, { id: key, exe: w.exe, windows: [] });
    groups.get(key).windows.push(w);
  }
  // Antuan OS: casi ningun .desktop trae ruta absoluta; se casa por clase de ventana (StartupWMClass) o nombre de la orden
  const linuxApp = (g, base) => {
    const cls = (g.windows[0].cls || '').toLowerCase().split('.');
    const ok = (c) => c.kind === 'desktop' && ((c.wmclass && cls.includes(c.wmclass)) || (c.cmd && path.basename(c.cmd).toLowerCase() === base) || cls.includes(c.id));
    return catalog.find((c) => ok(c) && config.pinned.includes(c.id)) || catalog.find(ok);
  };
  for (const g of groups.values()) {
    // Coincidencia exacta de ruta, y si no, por nombre del ejecutable (lanzadores tipo Squirrel).
    const base = path.basename(g.id);
    const a = catalog.find((c) => c.exe && c.exe.toLowerCase() === g.id)
      || catalog.find((c) => c.exe && path.basename(c.exe).toLowerCase() === base && config.pinned.includes(c.id))
      || catalog.find((c) => c.exe && path.basename(c.exe).toLowerCase() === base)
      || catalog.find((c) => c.aumid && packageFamily(g.id) === c.aumid.split('!')[0].toLowerCase())
      || (LINUX ? linuxApp(g, base) : null);
    if (a) { g.appId = a.id; continue; }
    if (!iconCache.has(g.id)) {
      const info = await apps.iconForExe(g.exe, g.windows[0].title);
      const [item] = await logos.enrich([{ exe: g.exe }]);
      if (item.logo) info.logo = item.logo;
      iconCache.set(g.id, info);
    }
    Object.assign(g, iconCache.get(g.id));
    g.name = g.windows[0].title.split(' - ').pop() || path.basename(g.exe || '', '.exe');
  }
  // El Centro Antuan es de Antuan (se excluye arriba), pero debe verse en el dock como una app mas.
  if (centro && !centro.isDestroyed() && centro.isVisible()) {
    groups.set('umbra:centro', {
      id: 'umbra:centro', name: 'Centro Antuan', glyph: 'dock', hue: 228, appId: 'umbra:centro',
      windows: [{ id: native.keyFromBuffer(centro.getNativeWindowHandle()), title: 'Centro Antuan', active: centro.isFocused(), minimized: centro.isMinimized() }]
    });
  }
  for (const v of appWins) {
    if (v.isDestroyed() || !v.isVisible()) continue;
    const def = APPS_UMBRA[v._tipo], gid = 'umbra:' + v._tipo;
    // Archivos Antuan ocupa el sitio del icono "Archivos" fijado en el dock
    const appId = v._tipo === 'archivos' ? catalog.find((c) => c.name === 'Archivos' || c.display === 'Archivos')?.id : 'umbra:' + v._tipo;
    if (!groups.has(gid)) groups.set(gid, { id: gid, name: def.name, glyph: def.glyph, hue: def.hue, appId, windows: [] });
    groups.get(gid).windows.push({ id: native.keyFromBuffer(v.getNativeWindowHandle()), title: v.getTitle() || def.name, active: v.isFocused(), minimized: v.isMinimized() });
  }
  return [...groups.values()];
}

let pollTimer = null, polling = false, pollAgain = false, lastPollAt = 0;
// Como mucho ~3 actualizaciones por segundo aunque una app cambie su titulo sin parar.
function schedulePoll(ms = 90) {
  if (pollTimer) return;
  const wait = Math.max(ms, 320 - (Date.now() - lastPollAt));
  pollTimer = setTimeout(() => { pollTimer = null; lastPollAt = Date.now(); pollWindows(); }, wait);
}

// Arrastrar una ventana con Mayus pulsado muestra las zonas de anclaje Antuan.
let moveSize = null;
function onWinEvent(ev, key) {
  if (ev === native.EV.MOVESIZESTART) {
    const rc = native.windowRect(key);
    moveSize = { key, rc, zones: false };
    moveSize.timer = setInterval(trackMove, 30);
    return;
  }
  if (ev === native.EV.MOVESIZEEND) { endMove(); schedulePoll(); return; }
  schedulePoll(ev === native.EV.FOREGROUND ? 30 : 90);
}
function trackMove() {
  if (!moveSize || !win) return;
  const shift = (native.GetAsyncKeyState(0x10) & 0x8000) !== 0;
  const rc = native.windowRect(moveSize.key);
  const resizing = rc && moveSize.rc && (rc.right - rc.left !== moveSize.rc.right - moveSize.rc.left || rc.bottom - rc.top !== moveSize.rc.bottom - moveSize.rc.top);
  const show = shift && !resizing && config.snapZones !== false;
  if (show !== moveSize.zones) { moveSize.zones = show; win.webContents.send('zones', show); }
  if (show) {
    const p = screen.getCursorScreenPoint(), b = screen.getPrimaryDisplay().bounds;
    win.webContents.send('zones-cursor', p.x - b.x, p.y - b.y);
  }
}
function endMove() {
  if (!moveSize) return;
  clearInterval(moveSize.timer);
  const m = moveSize; moveSize = null;
  if (m.zones && win) win.webContents.send('zones-drop', m.key);
}
ipcMain.on('place-window', (_, key, dipRect) => {
  const p = aPixeles(dipRect);
  native.placeWindow(key, { left: p.x, top: p.y, right: p.x + p.width, bottom: p.y + p.height });
});
ipcMain.on('topmost', (_, key, on) => native.setTopmost(key, on));
ipcMain.handle('is-topmost', (_, key) => native.isTopmost(key));
ipcMain.on('keep-awake', (_, on) => { config.keepAwake = !!on; native.keepAwake(!!on); saveConfig(); });

let lastRunning = '';
async function pollWindows() {
  if (polling) { pollAgain = true; return; }
  polling = true;
  try { await pollWindowsOnce(); } finally { polling = false; if (pollAgain) { pollAgain = false; schedulePoll(40); } }
}
async function pollWindowsOnce() {
  if (!win || win.isDestroyed() || cleaned) return;
  try {
    const groups = await runningGroups();
    const json = JSON.stringify(groups.map((g) => [g.id, g.windows.map((w) => [w.id, w.active, w.minimized, w.title])]));
    if (json !== lastRunning) { lastRunning = json; win.webContents.send('running', groups); trackClosed(groups); autoGame(groups).catch(() => { }); }
    const full = native.foregroundIsFullscreen(screen.getPrimaryDisplay().bounds, ownPids());
    if (full && win.isVisible() && !panelOpen) win.hide();
    else if (!full && !win.isVisible()) win.showInactive();
    if (config.hideWindowsTaskbar) native.hideTaskbar();
  } catch (e) { log('ventanas', e && e.stack || e); }
}

// ---------------------------------------------------------------- IPC
ipcMain.handle('init', async () => {
  if (!catalog.length) {
    catalog = await apps.scan();
    for (const p of APPS_PROPIAS) if (!catalog.some((c) => c.id === p.id)) catalog.push({ ...p });
    catalog.sort((a, b) => (a.display || a.name).localeCompare(b.display || b.name, 'es'));
  }
  if (!config.pinned) {
    config.pinned = DEFAULT_PINNED.map((n) => catalog.find((a) => (a.display || a.name).toLowerCase() === n || a.name.toLowerCase() === n)).filter(Boolean).map((a) => a.id);
    saveConfig();
  }
  // La Tienda se fija en el dock una vez (luego el usuario decide)
  if (!config.tiendaFijada) { if (!config.pinned.includes('umbra:tienda')) config.pinned.push('umbra:tienda'); config.tiendaFijada = true; saveConfig(); }
  const wp = native.wallpaperPath();
  lastRunning = '';
  schedulePoll(300);
  // Los logos recreados llegan despues (la primera vez tardan unos segundos; luego salen de cache).
  if (!catalog.logosReady) {
    logos.enrich(catalog).then(() => {
      catalog.logosReady = true;
      if (win && !win.isDestroyed()) win.webContents.send('catalog', catalog);
    }).catch((e) => log('logos', e && e.stack || e));
  }
  return {
    config, catalog, plataforma: process.platform, wallpaper: wp && fs.existsSync(wp) ? 'file:///' + wp.replace(/\\/g, '/') : null,
    user: (process.env.USERNAME || process.env.USER || 'Tú').replace(/^\w/, (c) => c.toUpperCase())
  };
});
ipcMain.on('hit', (_, inside) => { if (win && !LINUX) atravesar(!inside); }); // en Antuan OS mandan las zonas
ipcMain.on('panel', (_, open, restore = true) => {
  panelOpen = open;
  if (open) {
    atravesar(false);
    native.focusOwn(win.getNativeWindowHandle());
    win.focus();
  } else {
    atravesar(true);
    if (restore) native.restoreForeground();
  }
});
ipcMain.on('config', (_, patch) => {
  const edgeChanged = patch.edge && patch.edge !== config.edge;
  const taskbarChanged = 'hideWindowsTaskbar' in patch && patch.hideWindowsTaskbar !== config.hideWindowsTaskbar;
  Object.assign(config, patch); saveConfig();
  // Todas las ventanas de Antuan se enteran del cambio (dock, escritorio, Centro).
  for (const w of [win, centro]) if (w && !w.isDestroyed() && w.webContents !== _.sender) w.webContents.send('config-changed', patch);
  if (edgeChanged || 'dockSize' in patch) reserveWorkArea();
  if (taskbarChanged) applyShellMode();
  if ('desktop' in patch) { if (patch.desktop && !desk) createDesktop(); if (!patch.desktop && desk) desk.destroy(); }
  sendDesktop('config', config);
  if ('startWithWindows' in patch) setLoginItem(patch.startWithWindows);
});
ipcMain.on('launch', (_, id) => {
  if (id === 'umbra:tienda') return abrirAppUmbra('tienda');
  if (id === 'umbra:centro') return abrirCentro();
  if (id === 'umbra:terminal') return abrirAppUmbra('terminal');
  const a = catalog.find((c) => c.id === id);
  // Antuan OS: el boton "Archivos" del Inicio usa el id 'archivos', que alli no es un .desktop
  if (!a) { if (LINUX && id === 'archivos') abrirAppUmbra('archivos'); return; }
  // "Archivos" abre el gestor de archivos propio de Antuan
  if (a.name === 'Archivos' || a.display === 'Archivos') return abrirAppUmbra('archivos');
  apps.launch(a);
});
ipcMain.on('window', (_, id, action) => { native.windowAction(id, action); schedulePoll(150); });
ipcMain.on('open-uri', (_, uri) => (LINUX ? abrirSeguro(uri) : shell.openExternal(uri)));
ipcMain.on('keys', (_, vks) => {
  if (!Array.isArray(vks)) return;
  // Antuan OS: Ctrl+Mayus+Esc (administrador de tareas) es el Rendimiento del Centro
  if (LINUX && vks.join() === [0x11, 0x10, 0x1B].join()) return abrirCentro('rendimiento');
  native.sendKeys(vks);
});
// Sistema: volumen, brillo, audio por app, salidas, musica, energia, bateria, privacidad
const sis = LINUX ? require('./sistema-linux') : new Ayudante('sistema2.ps1', { idleMs: 300000, timeoutMs: 7000 });
ipcMain.handle('volume', async () => { const r = await sis.json('vol?'); return r && r.ok ? { level: r.level, muted: r.muted } : null; });
ipcMain.on('set-volume', async (_, v) => { await sis.ask('vol ' + v); if (v > 0) sis.ask('mute 0'); });
ipcMain.on('mute', (_, m) => sis.ask('mute ' + (m ? 1 : 0)));
ipcMain.handle('brightness', async () => { const r = await sis.json('bri?'); return r && r.ok ? r.level : -1; });
ipcMain.on('set-brightness', (_, v) => sis.ask('bri ' + v));
ASKS.sys = (cmd) => sis.json(cmd);
ASKS.outputSet = (id) => sis.json('output-set ' + Buffer.from(id, 'utf8').toString('base64'));
ASKS.mediaCover = (p) => { try { return p && fs.existsSync(p) ? nativeImage.createFromPath(p).resize({ width: 160 }).toDataURL() : null; } catch { return null; } };
ipcMain.handle('login-item', () => app.getLoginItemSettings(loginArgs()).openAtLogin);
ipcMain.on('power', (_, what) => {
  if (LINUX) {
    // Cerrar sesion = salir de Antuan con exito: umbra-session termina y LightDM vuelve a la pantalla de inicio.
    if (what === 'signout') return app.quit();
    // Bloquear: LightDM bloquea la sesion con dm-tool (loginctl lock-session necesita un bloqueador que no hay)
    const m = { lock: existeCmd('dm-tool') ? ['dm-tool', ['lock']] : ['loginctl', ['lock-session']], sleep: ['systemctl', ['suspend']], restart: ['systemctl', ['reboot']], shutdown: ['systemctl', ['poweroff']] }[what];
    if (m) execFile(m[0], m[1], (e) => { if (e) { log('energia', what, e.message); avisar('info', 'No se pudo completar'); } });
    return;
  }
  if (what === 'lock') execFile('rundll32.exe', ['user32.dll,LockWorkStation']);
  if (what === 'sleep') execFile('rundll32.exe', ['powrprof.dll,SetSuspendState', '0,1,0']);
  if (what === 'restart') execFile('shutdown.exe', ['/r', '/t', '0']);
  if (what === 'shutdown') execFile('shutdown.exe', ['/s', '/t', '0']);
  if (what === 'signout') execFile('shutdown.exe', ['/l']);
});
ipcMain.on('quit', () => app.quit());

// Empaquetado (Antuan.exe) se arranca solo con --login; desde la carpeta hace falta pasar la ruta de la app.
function loginArgs() { return { name: 'Antuan', path: process.execPath, args: app.isPackaged ? ['--login'] : [path.resolve(__dirname), '--login'] }; }
function setLoginItem(on) { app.setLoginItemSettings({ openAtLogin: on, ...loginArgs() }); }

// Antuan OS: umbra-session no lee el autoarranque XDG, asi que lo hace Antuan una vez por sesion
// (asi "Apps al inicio" del Centro sirve de verdad). Tambien el agente de permisos: sin el, pkexec
// (Tienda, actualizaciones) falla sin llegar a pedir la contrasena.
async function autoarranqueLinux() {
  if (existeCmd('lxpolkit')) herramienta('lxpolkit');
  let lista = [];
  try { lista = await gestion.appsInicio(); } catch { }
  const HOME = require('os').homedir();
  for (const a of lista) {
    // umbra-instalador ya lo arranca su servicio de systemd; el agente de permisos, arriba
    if (!a.activa || /^(umbra-|lxpolkit)/i.test(a.id)) continue;
    const file = [path.join(HOME, '.config/autostart', a.id), path.join('/etc/xdg/autostart', a.id)].find((f) => fs.existsSync(f));
    const d = file && apps.parseDesktop(file);
    if (!d || d.Hidden === 'true' || d['X-GNOME-Autostart-enabled'] === 'false') continue;
    if (d.NotShowIn && /Umbra/.test(d.NotShowIn)) continue;
    if (d.TryExec && !existeCmd(d.TryExec)) continue;
    try { apps.launchDesktopFile(file); } catch (e) { log('autoarranque', a.id, e && e.message); }
  }
}

// ---------------------------------------------------------------- Ciclo de vida
const LOG = path.join(app.getPath('userData'), 'umbra.log');
const CLEAN_FLAG = path.join(app.getPath('userData'), 'salida-limpia');
const log = (...a) => { try { fs.appendFileSync(LOG, new Date().toISOString() + ' ' + a.map(String).join(' ') + '\n'); } catch { } };
process.on('uncaughtException', (e) => log('error', e && e.stack || e));
process.on('unhandledRejection', (e) => log('rechazo', e && e.stack || e));

app.whenReady().then(() => {
  if (config.taskbarWasAutoHide === undefined) { config.taskbarWasAutoHide = native.taskbarAutoHide(); saveConfig(); }
  // Vigilante: si Antuan se cierra de golpe, devuelve la barra de Windows (en Antuan OS lo hace la sesion).
  if (!LINUX) spawn('powershell.exe', ['-NoProfile', '-WindowStyle', 'Hidden', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'vigilante.ps1'),
    '-ProcesoId', String(process.pid), '-AutoOcultar', config.taskbarWasAutoHide ? '1' : '0',
    '-Electron', process.execPath, '-App', app.isPackaged ? '' : path.resolve(__dirname), '-Marca', CLEAN_FLAG], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
  try { fs.unlinkSync(CLEAN_FLAG); } catch { }
  if (config.keepAwake) native.keepAwake(true);
  createWindow();
  createDesktop();
  applyShellMode();
  if (!LINUX && !config.loginItemSet) { setLoginItem(true); config.loginItemSet = true; saveConfig(); }
  // Arranque con Windows: la entrada antigua "Umbra" (nombre anterior) pasa a llamarse "Antuan"
  if (!LINUX) {
    const RUN = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
    execFile('reg', ['query', RUN, '/v', 'Umbra'], { windowsHide: true }, (err) => {
      if (err) return; // no hay entrada antigua
      execFile('reg', ['delete', RUN, '/v', 'Umbra', '/f'], { windowsHide: true }, () => { try { setLoginItem(true); } catch { } });
    });
  }
  if (LINUX && config.wallpaperPath && fs.existsSync(config.wallpaperPath)) native.setWallpaper(config.wallpaperPath);
  if (LINUX && config.luzNocturna) luzNocturna(true);
  if (LINUX && process.argv.includes('--login')) setTimeout(autoarranqueLinux, 4000);
  const toUI = (ch) => () => { if (win) { if (!win.isVisible()) win.showInactive(); win.webContents.send(ch); } };
  // Win solo = Inicio Antuan · Win+S = Spotlight · Win+Tab = Mission Control
  native.installWinKeyHook(toUI('toggle-launcher'), { 0x53: toUI('spotlight'), 0x09: toUI('mission') });
  const edges = { Left: 'left', Up: 'top', Right: 'right', Down: 'bottom' };
  for (const [k, e] of Object.entries(edges)) globalShortcut.register('Control+Super+Alt+' + k, () => win && win.webContents.send('edge', e));
  // Atajos globales de Antuan
  const send = (ch) => () => { if (win) { if (!win.isVisible()) win.showInactive(); win.webContents.send(ch); } };
  const SHORTCUTS = {
    'Super+Alt+V': 'clipboard', 'Super+Alt+C': 'color-picker', 'Super+Alt+O': 'ocr', 'Super+Alt+Z': 'reopen'
  };
  for (const [acc, ch] of Object.entries(SHORTCUTS)) {
    if (!globalShortcut.register(acc, send(ch))) log('atajo ocupado', acc);
  }
  // Eventos de Windows: el dock se actualiza al instante y en reposo no se gasta CPU.
  native.watchWindows(onWinEvent);
  // Los juegos se detectan en segundo plano para el Modo Juego automatico.
  setTimeout(() => listaJuegos().catch((e) => log('juegos', e)), 15000);
  setInterval(pollWindows, 5000);
  pollWindows();
});

let cleaned = false;
function cleanup() {
  if (cleaned) return; cleaned = true;
  try { fs.writeFileSync(CLEAN_FLAG, String(Date.now())); } catch { }
  try { native.unwatchWindows(); } catch { }
  try { native.removeWinKeyHook(); } catch { }
  try { native.appbarRemove(); } catch { }
  try { modoJuego.desactivar(); } catch { }
  try { native.showTaskbar(!!config.taskbarWasAutoHide); } catch { }
  for (const h of [sis, buscador]) { try { h.stop(); } catch { } }
}
app.on('before-quit', cleanup);
app.on('will-quit', cleanup);
process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(0); });
// Abrir Antuan otra vez: "--centro[=seccion]" abre el Centro; "--captura=nombre" guarda una captura de prueba.
app.on('second-instance', (_, argv) => {
  const c = argv.find((a) => a.startsWith('--centro'));
  const ui = argv.find((a) => a.startsWith('--ui='));
  const ar = argv.find((a) => a.startsWith('--archivos'));
  const ti = argv.find((a) => a.startsWith('--tienda'));
  const te = argv.find((a) => a.startsWith('--terminal'));
  const wa = argv.find((a) => a.startsWith('--webapp='));
  if (wa) return require('./webapps').abrir(wa.slice(9));
  if (te) return abrirAppUmbra('terminal', te.includes('=') ? { dir: te.slice(te.indexOf('=') + 1) } : {});
  if (ar) return abrirAppUmbra('archivos', ar.includes('=') && ar.split('=')[1] ? { dir: ar.slice(ar.indexOf('=') + 1) } : {});
  if (ti) return abrirAppUmbra('tienda', ti.includes('=') && ti.split('=')[1] ? { paquete: ti.slice(ti.indexOf('=') + 1) } : {});
  if (c) abrirCentro(c.split('=')[1]);
  else if (ui && win) {
    const [ch, ...arg] = ui.slice(5).split(':');
    // toast:icono:texto lleva dos datos; el resto, uno solo (que puede contener ':')
    if (ch === 'toast') win.webContents.send(ch, arg[0], arg.slice(1).join(':'));
    else win.webContents.send(ch, arg.join(':'));
  }
  else if (win) win.webContents.send('toggle-launcher');
});
app.on('window-all-closed', () => app.quit());
