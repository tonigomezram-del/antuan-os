// Apps web de Antuan (Claude, ChatGPT, Gemini...): cada una en su propia ventana, con su sesion guardada
// aparte, sin barras de navegador. En Antuan OS se instalan como lanzador .desktop (menu Inicio, Spotlight, dock)
// que abre "/opt/umbra/umbra --webapp=<id>"; lo que se descarga va directo al Escritorio.
'use strict';
const { BrowserWindow, app, shell, session } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');

const LINUX = process.platform === 'linux';
const DIR_APPS = path.join(os.homedir(), '.local/share/applications');
const DIR_ICONOS = path.join(os.homedir(), '.local/share/icons/antuan-web');
const LISTA = () => path.join(app.getPath('userData'), 'webapps.json');
const abiertas = new Map();
let catalogo = new Map();

// Chrome normal: Google y otros bloquean el inicio de sesion si ven "Electron" en el agente
const agente = () => session.defaultSession.getUserAgent().replace(/\s(Electron|Antuan|Umbra|umbra-shell)\/\S+/gi, '');

function leerLista() { try { return JSON.parse(fs.readFileSync(LISTA(), 'utf8')); } catch { return []; } }
function guardarLista(l) { try { fs.writeFileSync(LISTA(), JSON.stringify([...new Set(l)])); } catch { } }
const instalada = (id) => leerLista().includes(id);

function bajar(url, destino, saltos = 4) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (r) => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location && saltos) { r.resume(); return resolve(bajar(new URL(r.headers.location, url).href, destino, saltos - 1)); }
      if (r.statusCode !== 200) { r.resume(); return resolve(false); }
      const f = fs.createWriteStream(destino); r.pipe(f);
      f.on('finish', () => f.close(() => resolve(true))); f.on('error', () => resolve(false));
    }).on('error', () => resolve(false));
  });
}
const iconoUrl = (a) => /^https?:/.test(a.icono || '') ? a.icono : `https://www.google.com/s2/favicons?domain=${new URL(a.fuentes.web).hostname}&sz=128`;

async function instalar(a) {
  if (LINUX) {
    fs.mkdirSync(DIR_APPS, { recursive: true }); fs.mkdirSync(DIR_ICONOS, { recursive: true });
    const ico = path.join(DIR_ICONOS, a.id + '.png');
    await bajar(iconoUrl(a), ico);
    const exe = process.execPath;
    fs.writeFileSync(path.join(DIR_APPS, `antuan-web-${a.id}.desktop`), [
      '[Desktop Entry]', 'Type=Application', `Name=${a.nombre}`, `Comment=${a.descripcion}`,
      `Exec=${exe} --webapp=${a.id}`, `Icon=${fs.existsSync(ico) ? ico : 'web-browser'}`,
      'Categories=Network;Office;', `StartupWMClass=antuan-web-${a.id}`, 'Terminal=false', ''
    ].join('\n'), { mode: 0o755 });
  }
  guardarLista([...leerLista(), a.id]);
  return { ok: true, mensaje: 'Instalada' };
}
function desinstalar(a) {
  try { fs.unlinkSync(path.join(DIR_APPS, `antuan-web-${a.id}.desktop`)); } catch { }
  try { fs.unlinkSync(path.join(DIR_ICONOS, a.id + '.png')); } catch { }
  try { session.fromPartition('persist:web-' + a.id).clearStorageData(); } catch { }
  guardarLista(leerLista().filter((x) => x !== a.id));
  return { ok: true, mensaje: 'Desinstalada' };
}

function prepararSesion(ses) {
  if (ses._antuan) return; ses._antuan = true;
  ses.setUserAgent(agente());
  // Las descargas van directas al Escritorio, sin preguntar
  ses.on('will-download', (_, item) => {
    const esc = app.getPath('desktop');
    let destino = path.join(esc, item.getFilename()), n = 1;
    const { name, ext } = path.parse(destino);
    while (fs.existsSync(destino)) destino = path.join(esc, `${name} (${n++})${ext}`);
    item.setSavePath(destino);
  });
  ses.setPermissionRequestHandler((_, permiso, cb) => cb(['media', 'clipboard-read', 'clipboard-sanitized-write', 'notifications', 'fullscreen'].includes(permiso)));
}

function ventana(a, url, padre) {
  const ses = session.fromPartition('persist:web-' + a.id);
  prepararSesion(ses);
  const w = new BrowserWindow({
    width: 1180, height: 800, minWidth: 420, minHeight: 360, title: a.nombre, show: false,
    backgroundColor: '#14161c', autoHideMenuBar: true, parent: padre || undefined,
    webPreferences: { session: ses, contextIsolation: true, sandbox: true, spellcheck: false }
  });
  w.setMenuBarVisibility(false);
  const ico = path.join(DIR_ICONOS, a.id + '.png');
  if (fs.existsSync(ico)) try { w.setIcon(ico); } catch { }
  // En Linux, otra clase de ventana antes de mostrarla: si no, Openbox le quita el marco (como a Antuan) y la barra la esconde
  w.once('ready-to-show', () => {
    if (process.platform === 'linux') try {
      const xid = w.getNativeWindowHandle().readUInt32LE(0);
      require('child_process').spawnSync('xdotool', ['set_window', '--classname', 'antuan-web', '--class', 'AntuanWeb', String(xid)], { timeout: 1500 });
    } catch { }
    w.show(); w.focus();
  });
  // Ventanas emergentes (inicio de sesion con Google/Apple) dentro de la misma sesion; los enlaces de otras webs, al navegador
  const base = new URL(a.fuentes.web).hostname.split('.').slice(-2).join('.');
  w.webContents.setWindowOpenHandler(({ url: u, disposition }) => {
    if (!/^https?:/i.test(u)) return { action: 'deny' };
    const host = new URL(u).hostname;
    if (disposition === 'new-window' || host.endsWith(base) || /accounts\.google|appleid\.apple|login\.microsoftonline|login\.live/.test(host)) {
      return { action: 'allow', overrideBrowserWindowOptions: { parent: w, autoHideMenuBar: true, webPreferences: { session: ses } } };
    }
    shell.openExternal(u); return { action: 'deny' };
  });
  w.webContents.on('page-title-updated', (e) => { e.preventDefault(); w.setTitle(a.nombre); });
  w.loadURL(url, { userAgent: agente() });
  return w;
}

function abrir(id) {
  const a = catalogo.get(id);
  if (!a || !a.fuentes || !a.fuentes.web) return { ok: false, error: 'App web desconocida' };
  const ya = abiertas.get(id);
  if (ya && !ya.isDestroyed()) { if (ya.isMinimized()) ya.restore(); ya.show(); ya.focus(); return { ok: true }; }
  const w = ventana(a, a.fuentes.web);
  abiertas.set(id, w); w.on('closed', () => abiertas.delete(id));
  return { ok: true };
}

module.exports = {
  registrar(apps) { catalogo = new Map(apps.filter((a) => a.fuentes && a.fuentes.web).map((a) => [a.id, a])); },
  instalar, desinstalar, instalada, abrir
};
