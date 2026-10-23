// Buscador de archivos de Antuan OS para el Spotlight: indice ligero en memoria de la carpeta personal,
// que se rehace en segundo plano cada pocos minutos. Misma interfaz que el ayudante de Windows (json).
const fsp = require('fs/promises');
const os = require('os');
const path = require('path');

const HOME = os.homedir();
const SKIP = new Set(['node_modules', '.git', '.cache', '.local', '.var', '.steam', 'snap', '.npm', '.cargo', '.rustup', 'Trash']);
let indice = [], fecha = 0, construyendo = null;

async function construir() {
  const out = [], fin = Date.now() + 8000;
  async function walk(d, depth) {
    if (depth > 7 || Date.now() > fin || out.length > 200000) return;
    let ents = []; try { ents = await fsp.readdir(d, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      if (e.name.startsWith('.') || SKIP.has(e.name) || e.isSymbolicLink()) continue;
      const p = path.join(d, e.name);
      out.push({ n: e.name.toLowerCase(), path: p, name: e.name, dir: e.isDirectory() });
      if (e.isDirectory()) await walk(p, depth + 1);
    }
  }
  await walk(HOME, 0);
  indice = out; fecha = Date.now(); construyendo = null;
}

async function buscar(q) {
  if (!indice.length || Date.now() - fecha > 300000) { construyendo = construyendo || construir(); if (!indice.length) await construyendo; }
  const s = q.toLowerCase();
  return indice.filter((x) => x.n.includes(s))
    .sort((a, b) => (a.n.startsWith(s) ? 0 : 1) - (b.n.startsWith(s) ? 0 : 1) || a.n.length - b.n.length)
    .slice(0, 14).map((x) => ({ path: x.path, name: x.name, type: x.dir ? 'Directory' : path.extname(x.name), date: '' }));
}

module.exports = {
  json: async (cmd) => (cmd.startsWith('q ') ? buscar(Buffer.from(cmd.slice(2), 'base64').toString('utf8')) : []),
  stop: () => { }
};
