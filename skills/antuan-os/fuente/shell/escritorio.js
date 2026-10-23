// Escritorio Antuan: lee los elementos del escritorio, los clasifica y los organiza.
const { app, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { pathToFileURL } = require('url');
const logos = require('./logos');

const GAMES = /minecraft|roblox|steam|epic games|launcher|juego|game|fortnite|valorant|league of legends|riot|battle\.net|ea app|ubisoft|gog|antuan/i;
const LINUX = process.platform === 'linux';
const RECYCLE = { id: 'papelera', name: 'Papelera', kind: 'special', path: LINUX ? 'trash:///' : 'shell:RecycleBinFolder', group: 'Sistema',
  ...(LINUX ? { iconPath: '/usr/share/icons/Adwaita/scalable/places/user-trash.svg' } : {}) };

function desktopDirs() {
  if (LINUX) return [app.getPath('desktop')];
  return [app.getPath('desktop'), path.join(process.env.PUBLIC || 'C:\\Users\\Public', 'Desktop')];
}

function classify(name, full, isDir) {
  if (isDir) return 'Carpetas';
  const ext = path.extname(full).toLowerCase();
  if (GAMES.test(name)) return 'Juegos';
  if (['.lnk', '.url', '.exe', '.appref-ms', '.desktop'].includes(ext)) return 'Apps';
  return 'Archivos';
}

async function list() {
  const items = [RECYCLE];
  const seen = new Set();
  for (const dir of desktopDirs()) {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      if (/^desktop\.ini$/i.test(e.name) || e.name.startsWith('~$')) continue;
      const full = path.join(dir, e.name);
      let name = e.isDirectory() ? e.name : e.name.replace(/\.(lnk|url|appref-ms)$/i, '');
      // Antuan OS: los lanzadores .desktop se ven con su nombre e icono reales
      let extra = {};
      if (LINUX && /\.desktop$/i.test(e.name)) {
        const al = require('./apps-linux'), d = al.parseDesktop(full);
        name = (d && d.Name) || e.name.replace(/\.desktop$/i, '');
        const ic = d && al.resolveIcon(d.Icon); if (ic) extra = { iconPath: ic };
      }
      if (seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());
      items.push({ id: full.toLowerCase(), name, kind: 'file', path: full, group: classify(name, full, e.isDirectory()), ...extra });
    }
  }
  await logos.enrich(items);
  // Antuan OS: el icono de cada archivo lo da el tema del sistema
  if (LINUX) await Promise.all(items.map(async (it) => {
    if (it.png) return;
    try { const img = await app.getFileIcon(it.path, { size: 'large' }); if (!img.isEmpty()) it.iconData = img.toDataURL(); } catch { }
  }));
  return items.map((it) => ({
    id: it.id, name: it.name, path: it.path, group: it.group,
    icon: it.png ? pathToFileURL(it.png).href : it.iconData || null
  }));
}

function open(p) {
  if (typeof p !== 'string' || !p) return;
  if (LINUX) {
    // Antuan OS: la papelera y las carpetas las abre Archivos el propio nucleo (main.js); aqui solo los lanzadores
    if (/\.desktop$/i.test(p)) return require('./apps-linux').launchDesktopFile(p);
    return shell.openPath(p);
  }
  if (p.startsWith('shell:')) return execFile('explorer.exe', [p]);
  return shell.openPath(p);
}

function reveal(p) { if (typeof p === 'string' && !p.startsWith('shell:') && p !== 'trash:///') shell.showItemInFolder(p); }

async function trash(p) { if (typeof p === 'string' && !p.startsWith('shell:') && p !== 'trash:///') await shell.trashItem(p); }

function newFolder() {
  const base = app.getPath('desktop');
  let n = 0, p;
  do { p = path.join(base, n ? `Nueva carpeta (${n + 1})` : 'Nueva carpeta'); n++; } while (fs.existsSync(p));
  fs.mkdirSync(p);
  return p;
}

function watch(onChange) {
  let t = null;
  for (const dir of desktopDirs()) {
    try { fs.watch(dir, () => { clearTimeout(t); t = setTimeout(onChange, 600); }); } catch { }
  }
}

module.exports = { list, open, reveal, trash, newFolder, watch };
