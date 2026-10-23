// Buscador de archivos de Antuan OS para el Spotlight: indice en memoria de la carpeta personal.
// Se construye al arrancar y se mantiene al dia solo: vigila las carpetas (inotify) y cada archivo que
// aparece, se renombra o se borra entra o sale del indice al instante. Cada 10 minutos se rehace entero.
// Misma interfaz que el ayudante de Windows (json).
const fs = require('fs');
const fsp = require('fs/promises');
const os = require('os');
const path = require('path');

const HOME = os.homedir();
const SKIP = new Set(['node_modules', '.git', '.cache', '.local', '.var', '.steam', 'snap', '.npm', '.cargo', '.rustup', 'Trash']);
const MAX = 200000;
let indice = new Map(), fecha = 0, construyendo = null;
const vigilantes = new Map();

const entrada = (p, dir) => { const name = path.basename(p); return { n: name.toLowerCase(), path: p, name, dir }; };
const oculto = (p) => path.relative(HOME, p).split(path.sep).some((t) => t.startsWith('.') || SKIP.has(t));

// Carpetas vigiladas: la personal (solo su primer nivel) y cada carpeta de primer nivel entera
function vigilar(dir, recursivo) {
  if (vigilantes.has(dir)) return;
  try {
    const w = fs.watch(dir, { recursive: recursivo, persistent: false }, (_, nombre) => { if (nombre) cambio(path.join(dir, String(nombre))); });
    w.on('error', () => { try { w.close(); } catch { } vigilantes.delete(dir); });
    vigilantes.set(dir, w);
  } catch { }
}
function cambio(p) {
  if (oculto(p)) return;
  fs.lstat(p, (err, st) => {
    if (err) { // borrado o renombrado: fuera el y lo que tuviera dentro
      indice.delete(p);
      const pre = p + path.sep;
      for (const k of indice.keys()) if (k.startsWith(pre)) indice.delete(k);
      return;
    }
    if (st.isSymbolicLink() || indice.size > MAX) return;
    indice.set(p, entrada(p, st.isDirectory()));
    if (st.isDirectory()) {
      if (path.dirname(p) === HOME) vigilar(p, true);
      recorrer(p, path.relative(HOME, p).split(path.sep).length, indice); // carpeta copiada con cosas dentro
    }
  });
}

async function recorrer(d, depth, out, fin = Date.now() + 8000) {
  if (depth > 7 || Date.now() > fin || out.size > MAX) return;
  let ents = []; try { ents = await fsp.readdir(d, { withFileTypes: true }); } catch { return; }
  for (const e of ents) {
    if (e.name.startsWith('.') || SKIP.has(e.name) || e.isSymbolicLink()) continue;
    const p = path.join(d, e.name);
    out.set(p, entrada(p, e.isDirectory()));
    if (e.isDirectory()) await recorrer(p, depth + 1, out, fin);
  }
}

async function construir() {
  const out = new Map();
  await recorrer(HOME, 0, out);
  indice = out; fecha = Date.now(); construyendo = null;
  vigilar(HOME, false);
  for (const x of out.values()) if (x.dir && path.dirname(x.path) === HOME) vigilar(x.path, true);
}

async function buscar(q) {
  if (!indice.size || Date.now() - fecha > 600000) { construyendo = construyendo || construir(); if (!indice.size) await construyendo; }
  const s = q.toLowerCase();
  return [...indice.values()].filter((x) => x.n.includes(s))
    .sort((a, b) => (a.n.startsWith(s) ? 0 : 1) - (b.n.startsWith(s) ? 0 : 1) || a.n.length - b.n.length)
    .slice(0, 14).map((x) => ({ path: x.path, name: x.name, type: x.dir ? 'Directory' : path.extname(x.name), date: '' }));
}

// El indice se prepara al arrancar Antuan, no en la primera busqueda
setTimeout(() => { construyendo = construyendo || construir(); }, 5000);

module.exports = {
  json: async (cmd) => (cmd.startsWith('q ') ? buscar(Buffer.from(cmd.slice(2), 'base64').toString('utf8')) : []),
  stop: () => { for (const w of vigilantes.values()) try { w.close(); } catch { } vigilantes.clear(); }
};
