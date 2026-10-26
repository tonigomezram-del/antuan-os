// Catalogo de apps en Antuan OS: entradas .desktop del sistema, de Flatpak y de apps .umbra.
const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { glyphFor } = require('./apps-glifos');

const HOME = os.homedir();
const DIRS = [
  '/usr/share/applications', '/usr/local/share/applications',
  '/var/lib/flatpak/exports/share/applications', path.join(HOME, '.local/share/flatpak/exports/share/applications'),
  path.join(HOME, '.local/share/applications')
];
const ICON_DIRS = [
  path.join(HOME, '.local/share/icons'), '/usr/share/icons/hicolor', '/var/lib/flatpak/exports/share/icons/hicolor',
  path.join(HOME, '.local/share/flatpak/exports/share/icons/hicolor'), '/usr/share/icons/Adwaita', '/usr/share/pixmaps'
];
const SIZES = ['256x256', '512x512', '128x128', '96x96', '64x64', '48x48', 'scalable'];

function parseDesktop(file) {
  let txt = '';
  try { txt = fs.readFileSync(file, 'utf8'); } catch { return null; }
  const sec = /\[Desktop Entry\]([\s\S]*?)(\n\[|$)/.exec(txt);
  if (!sec) return null;
  const e = {};
  for (const l of sec[1].split('\n')) {
    const m = /^([A-Za-z0-9-]+)(\[([a-zA-Z_@]+)\])?=(.*)$/.exec(l.trim());
    if (!m) continue;
    const [, k, , loc, v] = m;
    if (!loc) e[k] = e[k] ?? v;
    else if (loc === 'es' || loc === 'es_ES') e[k] = v; // nombres en espanol si existen
  }
  return e;
}

// Busca el archivo de un icono por nombre en los temas instalados
function resolveIcon(name) {
  if (!name) return null;
  if (path.isAbsolute(name)) return fs.existsSync(name) ? name : null;
  for (const base of ICON_DIRS) {
    if (base.endsWith('pixmaps')) {
      for (const ext of ['.png', '.svg']) { const p = path.join(base, name + ext); if (fs.existsSync(p)) return p; }
      continue;
    }
    for (const s of SIZES) {
      for (const ext of ['.png', '.svg']) {
        const p = path.join(base, s, 'apps', name + ext);
        if (fs.existsSync(p)) return p;
      }
    }
  }
  return null;
}

async function scan() {
  const byName = new Map();
  for (const dir of DIRS) {
    let files = [];
    try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.desktop')); } catch { continue; }
    for (const f of files) {
      const full = path.join(dir, f);
      const e = parseDesktop(full);
      if (!e || e.Type !== 'Application' || e.NoDisplay === 'true' || e.Hidden === 'true' || !e.Exec) continue;
      if (e.OnlyShowIn && !/Umbra/.test(e.OnlyShowIn)) continue;
      if (e.NotShowIn && /Umbra/.test(e.NotShowIn)) continue;
      // TryExec: si el programa no esta instalado, el lanzador no se muestra (no fallaria en silencio)
      if (e.TryExec && !(e.TryExec.startsWith('/') ? fs.existsSync(e.TryExec) : ['/usr/bin/', '/usr/local/bin/', '/bin/', '/usr/games/'].some((d) => fs.existsSync(d + e.TryExec)))) continue;
      const name = (e.Name || f.replace(/\.desktop$/, '')).trim();
      const exe = e.Exec.split(' ')[0].replace(/^"|"$/g, '');
      byName.set(name.toLowerCase(), {
        id: f.replace(/\.desktop$/, '').toLowerCase(), name, kind: 'desktop', desktop: full, desktopId: f,
        exe: exe.startsWith('/') ? exe : '', cmd: exe, iconPath: resolveIcon(e.Icon), wmclass: (e.StartupWMClass || '').toLowerCase()
      });
    }
  }
  const list = [...byName.values()];
  for (const a of list) {
    const g = glyphFor(a.name, a.cmd);
    if (g) { a.glyph = g.glyph; a.hue = g.hue; if (g.rename) a.display = g.rename; }
    if (!a.glyph && a.iconPath && a.iconPath.endsWith('.png')) {
      try { a.icon = require('electron').nativeImage.createFromPath(a.iconPath).resize({ width: 64 }).toDataURL(); } catch { }
    }
  }
  list.sort((a, b) => (a.display || a.name).localeCompare(b.display || b.name, 'es'));
  return list;
}

async function iconForExe(exe, title) {
  const g = glyphFor(title || '', exe);
  return g ? { glyph: g.glyph, hue: g.hue } : {};
}

// Exec= de un .desktop -> [programa, ...argumentos] (comillas, escapes y codigos %f %u... segun la especificacion XDG)
function execArgs(exec) {
  // 1) escapes del valor (\s \n \t \r \\), 2) troceado como un shell (como hace GLib): comillas dobles/simples y barra invertida
  const s = String(exec || '').replace(/\\([sntr\\])/g, (_, c) => ({ s: ' ', n: '\n', t: '\t', r: '\r', '\\': '\\' })[c]);
  const out = []; let cur = '', q = '', has = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q === "'") { if (c === "'") q = ''; else cur += c; continue; }
    if (c === '\\' && i + 1 < s.length && (!q || '"`$\\'.includes(s[i + 1]))) { cur += s[++i]; has = true; continue; }
    if (c === '"' || (c === "'" && !q)) { q = q ? '' : c; has = true; continue; }
    if (/\s/.test(c) && !q) { if (has) out.push(cur); cur = ''; has = false; continue; }
    cur += c; has = true;
  }
  if (has) out.push(cur);
  // Codigos de campo: sin archivo que abrir se quitan; %% es un % literal
  return out.filter((t) => !/^%[fFuUdDnNickvm]$/.test(t)).map((t) => t.replace(/%(.)/g, (m, c) => (c === '%' ? '%' : '')));
}
// Arranca el .desktop sin depender de gtk-launch (no viene en Antuan OS) ni de xdg-open, que abriria el
// propio archivo .desktop en el navegador.
let enTerminal = null;
const setTerminal = (fn) => { enTerminal = fn; };
function launchDesktopFile(file) {
  const e = parseDesktop(file);
  if (!e || !e.Exec) return false;
  let argv = execArgs(e.Exec);
  if (!argv.length) return false;
  // Apps de consola: en la Terminal Antuan (el nucleo registra como abrirla)
  if (e.Terminal === 'true') { if (enTerminal) { enTerminal(argv); return true; } argv = ['x-terminal-emulator', '-e', ...argv]; }
  const cwd = e.Path && fs.existsSync(e.Path) ? e.Path : HOME;
  try {
    const p = spawn(argv[0], argv.slice(1), { detached: true, stdio: 'ignore', cwd });
    p.on('error', (err) => { try { fs.appendFileSync(path.join(app.getPath('userData'), 'umbra.log'), `${new Date().toISOString()} lanzar ${file} ${err.message}\n`); } catch { } });
    p.unref();
    return true;
  } catch { return false; }
}

function launch(a) {
  if (a && a.desktop && launchDesktopFile(a.desktop)) return;
  // Ultimo recurso: gtk-launch, si esta instalado (nunca xdg-open sobre el .desktop)
  if (a && a.desktopId) { const p = spawn('gtk-launch', [a.desktopId.replace(/\.desktop$/, '')], { detached: true, stdio: 'ignore' }); p.on('error', () => { }); p.unref(); }
}

module.exports = { DIRS, scan, iconForExe, launch, launchDesktopFile, parseDesktop, setTerminal, glyphFor, resolveIcon };
