// Archivos Antuan: nucleo del gestor de archivos (proceso principal).
// Registra consultas 'fs.*' en ASKS/CMDS. Nada lanza: los errores vuelven como { error }.
'use strict';
const fs = require('fs/promises');
const fss = require('fs');
const path = require('path');
const os = require('os');
const { pathToFileURL } = require('url');
const { spawn } = require('child_process');

const WIN = process.platform === 'win32';
const TRASH = 'umbra:papelera';
const IMG = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'avif', 'svg', 'tif', 'tiff', 'heic', 'jfif']);
const VID = new Set(['mp4', 'webm', 'mkv', 'mov', 'avi', 'm4v', 'ogv', 'wmv']);
const AUD = new Set(['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'opus', 'wma']);
const TXT = new Set(['txt', 'md', 'markdown', 'log', 'json', 'js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx', 'css', 'scss', 'html', 'htm', 'xml', 'yml', 'yaml',
  'ini', 'cfg', 'conf', 'toml', 'csv', 'tsv', 'py', 'rb', 'go', 'rs', 'c', 'h', 'cpp', 'hpp', 'cs', 'java', 'kt', 'php', 'sh', 'bash', 'ps1', 'psm1',
  'bat', 'cmd', 'sql', 'lua', 'vue', 'svelte', 'gitignore', 'env', 'reg', 'srt', 'vtt', 'nfo']);
// Archivos de sistema que Windows oculta aunque no empiecen por punto
const SYS_HIDDEN = /^(desktop\.ini|thumbs\.db|\$recycle\.bin|system volume information|ntuser\..*|pagefile\.sys|hiberfil\.sys|swapfile\.sys|dumpstack\.log.*|\$winreagent|config\.msi|recovery)$/i;
const SKIP_SEARCH = new Set(['node_modules', '.git', 'appdata', '$recycle.bin', 'system volume information', 'windows', '.cache']);

const extOf = (n) => { const i = n.lastIndexOf('.'); return i > 0 ? n.slice(i + 1).toLowerCase() : ''; };
const kindOf = (ext) => IMG.has(ext) ? 'image' : VID.has(ext) ? 'video' : AUD.has(ext) ? 'audio' : ext === 'pdf' ? 'pdf' : TXT.has(ext) ? 'text' : 'other';
const err = (e) => ({ error: (e && (e.code || e.message)) || String(e) });
const exists = (p) => fs.access(p).then(() => true, () => false);

// Nombre libre en destino: "nombre (2).ext", "nombre (3).ext"...
async function freeName(dir, name) {
  let target = path.join(dir, name);
  if (!(await exists(target))) return target;
  const ext = path.extname(name), base = ext && name !== ext ? name.slice(0, -ext.length) : name, e = base === name ? '' : ext;
  for (let i = 2; i < 10000; i++) {
    target = path.join(dir, `${base} (${i})${e}`);
    if (!(await exists(target))) return target;
  }
  return path.join(dir, `${base} (${Date.now()})${e}`);
}

// Windows: nombres con atributo oculto/sistema de una carpeta (Node no expone atributos).
// "dir /a:h" en UTF-8 es rapido; si falla se usa solo la heuristica por nombre.
const { execFile } = require('child_process');
function winHidden(dir) {
  if (!WIN) return Promise.resolve(null);
  return new Promise((resolve) => {
    // /u: los comandos internos escriben UTF-16LE (nombres con tildes intactos)
    execFile('cmd.exe', ['/d', '/u', '/s', '/c', `"dir /a:h /b "${dir.replace(/["%^&|<>]/g, '')}""`],
      { timeout: 2000, windowsHide: true, encoding: 'buffer', maxBuffer: 8 << 20, windowsVerbatimArguments: true },
      (e, out) => resolve(out && out.length ? new Set(out.toString('utf16le').split(/\r?\n/).filter(Boolean).map((s) => s.toLowerCase())) : null));
  });
}

async function itemOf(dir, name, dirent, hiddenSet) {
  const p = path.join(dir, name);
  let st = null;
  try { st = await fs.stat(p); } catch { try { st = await fs.lstat(p); } catch { /* inaccesible */ } }
  const isDir = st ? st.isDirectory() : !!(dirent && dirent.isDirectory());
  const ext = isDir ? '' : extOf(name);
  return {
    name, path: p, isDir, ext, kind: isDir ? 'folder' : kindOf(ext),
    size: st && !isDir ? st.size : null, mtime: st ? st.mtimeMs : 0,
    hidden: name.startsWith('.') || (WIN && SYS_HIDDEN.test(name)) || !!(hiddenSet && hiddenSet.has(name.toLowerCase())),
    link: !!(dirent && dirent.isSymbolicLink())
  };
}

module.exports = function registrar({ ASKS, CMDS, app, shell, clipboard, nativeImage, log = () => {} }) {
  const home = os.homedir();
  const linuxTrash = path.join(home, '.local', 'share', 'Trash', 'files');

  /* ---------------- Lugares ---------------- */
  ASKS['fs.places'] = async () => {
    try {
      const get = (k) => { try { return app.getPath(k); } catch { return null; } };
      const favs = [
        ['home', 'Inicio', home, 'home'], ['desktop', 'Escritorio', get('desktop'), 'desktop'], ['documents', 'Documentos', get('documents'), 'doc'],
        ['downloads', 'Descargas', get('downloads'), 'down'], ['pictures', 'Imágenes', get('pictures'), 'image'], ['music', 'Música', get('music'), 'music'],
        ['videos', 'Vídeos', get('videos'), 'video']
      ].filter((f) => f[2] && fss.existsSync(f[2])).map(([id, name, p, ic]) => ({ id, name, path: p, icon: ic }));

      let roots = [];
      if (WIN) {
        roots = 'CDEFGHIJKLMNOPQRSTUVWXYZAB'.split('').map((l) => l + ':\\');
      } else {
        const user = os.userInfo().username;
        roots = ['/'];
        for (const base of [`/media/${user}`, `/run/media/${user}`, '/mnt']) {
          try { for (const d of await fs.readdir(base)) roots.push(path.join(base, d)); } catch { /* no existe */ }
        }
      }
      // statfs en paralelo, con tope de tiempo por si hay unidades de red dormidas
      const timeout = (ms) => new Promise((r) => setTimeout(() => r(null), ms));
      const drives = (await Promise.all(roots.map(async (r) => {
        const st = await Promise.race([fs.statfs(r).catch(() => null), timeout(1500)]);
        if (!st || !st.blocks) return null;
        const total = st.blocks * st.bsize, free = st.bavail * st.bsize;
        const name = WIN ? `Disco local (${r.slice(0, 2)})` : r === '/' ? 'Sistema' : path.basename(r);
        return { id: 'drive:' + r, name, path: r, icon: 'drive', total, free };
      }))).filter(Boolean);
      if (WIN) for (const d of drives) if (!d.path.toUpperCase().startsWith((process.env.SystemDrive || 'C:').toUpperCase())) d.name = `Unidad (${d.path.slice(0, 2)})`;
      return { favs, drives, trash: { id: 'trash', name: 'Papelera', path: TRASH, icon: 'trash' }, sep: path.sep };
    } catch (e) { return err(e); }
  };

  /* ---------------- Listado ---------------- */
  ASKS['fs.list'] = async (dir, opts = {}) => {
    try {
      if (dir === TRASH) {
        if (WIN) return { dir, items: [], external: true };
        dir = linuxTrash;
      }
      dir = path.resolve(String(dir || home));
      const [ents, hid] = await Promise.all([fs.readdir(dir, { withFileTypes: true }), winHidden(dir)]);
      let items = await Promise.all(ents.map((d) => itemOf(dir, d.name, d, hid)));
      if (!opts.hidden) items = items.filter((i) => !i.hidden);
      return { dir, parent: path.dirname(dir) === dir ? null : path.dirname(dir), items };
    } catch (e) { return { dir, items: [], ...err(e) }; }
  };

  /* ---------------- Miniaturas (cache LRU en memoria) ---------------- */
  const thumbs = new Map();
  const remember = (k, v) => { thumbs.delete(k); thumbs.set(k, v); if (thumbs.size > 300) thumbs.delete(thumbs.keys().next().value); return v; };
  // opts.icon === false: si no hay miniatura real devuelve null (la UI pinta su propio glifo)
  ASKS['fs.thumb'] = async (p, size = 160, opts = {}) => {
    try {
      const st = await fs.stat(p);
      const key = `${p}|${size}|${st.mtimeMs}|${opts.icon !== false}`;
      if (thumbs.has(key)) { const v = thumbs.get(key); return remember(key, v); }
      let ext = extOf(p), img = null;
      const px = Math.round(size);
      // Accesos directos: el icono interesante es el de su destino
      if (WIN && ext === 'lnk') {
        try { const t = shell.readShortcutLink(p); const src = t.icon || t.target; if (src && fss.existsSync(src)) { p = src; ext = extOf(p); } } catch { /* enlace roto */ }
      }
      if (size > 48 && nativeImage.createThumbnailFromPath && (WIN || process.platform === 'darwin')) {
        try { img = await nativeImage.createThumbnailFromPath(p, { width: px, height: px }); } catch { img = null; }
      }
      if ((!img || img.isEmpty()) && IMG.has(ext) && ext !== 'svg' && st.size < 60e6) {
        const full = nativeImage.createFromPath(p);
        if (!full.isEmpty()) {
          const { width: w, height: h } = full.getSize(), k = Math.min(1, px / Math.max(w, h));
          img = full.resize({ width: Math.max(1, Math.round(w * k)), height: Math.max(1, Math.round(h * k)), quality: 'good' });
        }
      }
      if (ext === 'svg' && st.size < 2e6) return remember(key, pathToFileURL(p).href);
      if ((!img || img.isEmpty()) && opts.icon === false) return remember(key, null);
      if (!img || img.isEmpty()) img = await app.getFileIcon(p, { size: size > 32 ? 'large' : 'normal' });
      return remember(key, img && !img.isEmpty() ? img.toDataURL() : null);
    } catch (e) { return null; }
  };

  /* ---------------- Acciones ---------------- */
  ASKS['fs.open'] = async (p) => {
    try {
      // Antuan OS: un lanzador .desktop se arranca (xdg-open lo abriria como texto en el navegador)
      if (process.platform === 'linux' && /\.desktop$/i.test(String(p))) return require('./apps-linux').launchDesktopFile(p) ? { ok: true } : { error: 'No se pudo abrir' };
      const r = await shell.openPath(p); return r ? { error: r } : { ok: true };
    } catch (e) { return err(e); }
  };
  // Antuan OS: "mostrar en carpeta" abre Archivos Antuan en su carpeta (no hay gestor de archivos por D-Bus)
  ASKS['fs.reveal'] = async (p) => { try { if (process.platform === 'linux' && CMDS.archivos) CMDS.archivos(path.dirname(String(p))); else shell.showItemInFolder(p); return { ok: true }; } catch (e) { return err(e); } };
  CMDS['fs.openTrash'] = () => {
    try { if (WIN) spawn('explorer.exe', ['shell:RecycleBinFolder'], { detached: true, stdio: 'ignore' }).unref(); else if (CMDS.archivos) CMDS.archivos(TRASH); else shell.openPath(linuxTrash); } catch (e) { log('fs.openTrash', e); }
  };

  ASKS['fs.trash'] = async (paths = []) => {
    const done = [], errors = [];
    for (const p of [].concat(paths)) { try { await shell.trashItem(p); done.push(p); } catch (e) { errors.push({ path: p, error: e.message || String(e) }); } }
    return { ok: !errors.length, done, errors };
  };

  ASKS['fs.rename'] = async (p, nuevo) => {
    try {
      nuevo = String(nuevo || '').trim();
      if (!nuevo || /[\\/]/.test(nuevo) || (WIN && /[<>:"|?*]/.test(nuevo))) return { error: 'Nombre no válido' };
      const target = path.join(path.dirname(p), nuevo);
      if (target === p) return { ok: true, path: p };
      // En Windows cambiar solo mayusculas apunta al mismo archivo: no es conflicto
      if (target.toLowerCase() !== p.toLowerCase() && (await exists(target))) return { error: 'Ya existe un elemento con ese nombre' };
      await fs.rename(p, target);
      return { ok: true, path: target };
    } catch (e) { return err(e); }
  };

  ASKS['fs.mkdir'] = async (dir, nombre = 'Nueva carpeta') => {
    try { const target = await freeName(dir, nombre); await fs.mkdir(target); return { ok: true, path: target }; } catch (e) { return err(e); }
  };

  const inside = (child, parent) => { const r = path.relative(parent, child); return r === '' || (!r.startsWith('..') && !path.isAbsolute(r)); };

  ASKS['fs.copy'] = async (paths = [], dest) => {
    const done = [], errors = [];
    for (const src of [].concat(paths)) {
      try {
        if (inside(dest, src)) throw new Error('No se puede copiar una carpeta dentro de sí misma');
        const target = await freeName(dest, path.basename(src));
        await fs.cp(src, target, { recursive: true, errorOnExist: true, force: false, preserveTimestamps: true });
        done.push(target);
      } catch (e) { errors.push({ path: src, error: e.message || String(e) }); }
    }
    return { ok: !errors.length, done, errors };
  };

  ASKS['fs.move'] = async (paths = [], dest) => {
    const done = [], errors = [];
    for (const src of [].concat(paths)) {
      try {
        if (path.dirname(src) === path.resolve(dest)) { done.push(src); continue; }
        if (inside(dest, src)) throw new Error('No se puede mover una carpeta dentro de sí misma');
        const target = await freeName(dest, path.basename(src));
        try { await fs.rename(src, target); } catch (e) {
          if (e.code !== 'EXDEV' && e.code !== 'EPERM') throw e;
          // Entre unidades: copiar y borrar el original
          await fs.cp(src, target, { recursive: true, errorOnExist: true, force: false, preserveTimestamps: true });
          await fs.rm(src, { recursive: true, force: true });
        }
        done.push(target);
      } catch (e) { errors.push({ path: src, error: e.message || String(e) }); }
    }
    return { ok: !errors.length, done, errors };
  };

  ASKS['fs.copyPaths'] = async (paths = []) => { try { clipboard.writeText([].concat(paths).join(os.EOL)); return { ok: true }; } catch (e) { return err(e); } };

  /* ---------------- Busqueda recursiva por nombre ---------------- */
  ASKS['fs.search'] = async (dir, q, opts = {}) => {
    try {
      const needle = String(q || '').trim().toLowerCase();
      if (!needle) return { dir, items: [] };
      const deadline = Date.now() + 4000, out = [], queue = [path.resolve(dir)];
      while (queue.length && out.length < 200 && Date.now() < deadline) {
        const d = queue.shift();
        let ents;
        try { ents = await fs.readdir(d, { withFileTypes: true }); } catch { continue; }
        for (const e of ents) {
          const low = e.name.toLowerCase();
          if (!opts.hidden && (low.startsWith('.') || (WIN && SYS_HIDDEN.test(low)))) continue;
          if (low.includes(needle)) { out.push(await itemOf(d, e.name, e)); if (out.length >= 200) break; }
          if (e.isDirectory() && !SKIP_SEARCH.has(low)) queue.push(path.join(d, e.name));
        }
      }
      return { dir, items: out, partial: queue.length > 0 };
    } catch (e) { return { dir, items: [], ...err(e) }; }
  };

  /* ---------------- Vista rapida ---------------- */
  ASKS['fs.preview'] = async (p) => {
    try {
      const st = await fs.stat(p), ext = extOf(p);
      const base = { path: p, name: path.basename(p), size: st.size, mtime: st.mtimeMs, url: pathToFileURL(p).href };
      if (st.isDirectory()) {
        let count = null; try { count = (await fs.readdir(p)).length; } catch { /* sin permiso */ }
        return { ...base, kind: 'folder', count };
      }
      let kind = kindOf(ext);
      if (kind === 'other' && st.size < 2e6) {
        // Sin extension conocida: si los primeros bytes no tienen NUL, se trata como texto
        const fh = await fs.open(p, 'r');
        try { const b = Buffer.alloc(Math.min(4096, st.size)); await fh.read(b, 0, b.length, 0); if (b.length && !b.includes(0)) kind = 'text'; } finally { await fh.close(); }
      }
      if (kind === 'text') {
        const fh = await fs.open(p, 'r');
        try {
          const b = Buffer.alloc(Math.min(65536, st.size)); await fh.read(b, 0, b.length, 0);
          return { ...base, kind, text: b.toString('utf8'), truncated: st.size > 65536 };
        } finally { await fh.close(); }
      }
      return { ...base, kind };
    } catch (e) { return err(e); }
  };

  ASKS['fs.home'] = async () => home;
};
