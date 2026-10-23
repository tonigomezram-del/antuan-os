// Catalogo de apps: accesos del menu Inicio + apps de la Store, con su icono Antuan.
const { app, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const { glyphFor } = require('./apps-glifos');

const SKIP = /uninstall|desinstal|readme|l[ée]ame|help|ayuda|documentation|manual|website|sitio web|release notes|license|licencia|debug|safe mode|modo seguro/i;

function walk(dir, out = []) {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.toLowerCase().endsWith('.lnk')) out.push(p);
  }
  return out;
}

function startApps() {
  return new Promise((resolve) => {
    execFile('powershell.exe', ['-NoProfile', '-Command',
      '[Console]::OutputEncoding=[Text.Encoding]::UTF8; Get-StartApps | Select-Object Name,AppID | ConvertTo-Json -Compress'],
    { windowsHide: true, maxBuffer: 8 * 1024 * 1024 }, (err, stdout) => {
      try { resolve(err ? [] : [].concat(JSON.parse(stdout))); } catch { resolve([]); }
    });
  });
}

async function iconData(p) {
  try {
    const img = await app.getFileIcon(p, { size: 'large' });
    return img.isEmpty() ? null : img.toDataURL();
  } catch { return null; }
}

async function scan() {
  const dirs = [
    path.join(process.env.ProgramData, 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
    path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
    path.join(app.getPath('desktop'))
  ];
  const byName = new Map();

  for (const lnk of dirs.flatMap((d) => walk(d))) {
    const name = path.basename(lnk, '.lnk').trim();
    if (SKIP.test(name) || byName.has(name.toLowerCase())) continue;
    let target = '', iconSrc = lnk;
    try {
      const info = shell.readShortcutLink(lnk);
      target = info.target || '';
      if (info.icon && fs.existsSync(info.icon)) iconSrc = info.icon;
      else if (target && fs.existsSync(target)) iconSrc = target;
    } catch { /* acceso "anunciado" (Office, etc.): se lanza el .lnk tal cual */ }
    if (target && !/\.(exe|bat|cmd)$/i.test(target)) continue;
    byName.set(name.toLowerCase(), { name, kind: 'lnk', lnk, exe: target, iconSrc });
  }

  for (const s of await startApps()) {
    if (!s || !s.Name || !s.AppID || !s.AppID.includes('!')) continue;
    if (SKIP.test(s.Name) || byName.has(s.Name.toLowerCase())) continue;
    byName.set(s.Name.toLowerCase(), { name: s.Name, kind: 'uwp', aumid: s.AppID });
  }

  byName.set('archivos', { name: 'Archivos', kind: 'exe', exe: path.join(process.env.WINDIR, 'explorer.exe') });

  const list = [...byName.values()];
  await Promise.all(list.map(async (a) => {
    const g = glyphFor(a.name, a.exe);
    if (g) { a.glyph = g.glyph; a.hue = g.hue; if (g.rename) a.display = g.rename; }
    if (!a.glyph && a.iconSrc) a.icon = await iconData(a.iconSrc);
    a.id = (a.aumid || a.exe || a.lnk || a.name).toLowerCase();
  }));
  list.sort((a, b) => (a.display || a.name).localeCompare(b.display || b.name, 'es'));
  return list;
}

// Icono para una ventana abierta que no esta en el catalogo.
async function iconForExe(exe, title) {
  const g = glyphFor(title || '', exe);
  if (g) return { glyph: g.glyph, hue: g.hue };
  return { icon: exe ? await iconData(exe) : null };
}

function launch(a) {
  if (a.kind === 'uwp') return execFile('explorer.exe', ['shell:AppsFolder\\' + a.aumid]);
  if (a.kind === 'lnk') return shell.openPath(a.lnk);
  if (a.exe && /explorer\.exe$/i.test(a.exe)) return execFile('explorer.exe', []);
  return shell.openPath(a.exe);
}

module.exports = { scan, iconForExe, launch, glyphFor };
