// Formato de paquete .umbra: un ZIP normal con umbra.json (manifiesto), icono.png y la carga.
// Todo con modulos de Node: lector y escritor ZIP minimos (zlib.inflateRaw/deflateRaw + CRC32).
// Ver UmbraOS/os/FORMATO-UMBRA.md para la especificacion completa.
'use strict';
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const os = require('os');
const zlib = require('zlib');
const { spawn, execFile } = require('child_process');

const TIPOS = ['appimage', 'archivos', 'flatpakref', 'winget', 'exe'];
const PERMISOS = ['red', 'archivos', 'descargas', 'camara', 'microfono', 'pantalla', 'notificaciones', 'inicio', 'administrador', 'dispositivos'];
const VERSION_FORMATO = 1;

/* ------------------------------------------------------------------ CRC32 */
let TABLA = null;
function crc32(buf, previo = 0) {
  if (typeof zlib.crc32 === 'function') return zlib.crc32(buf, previo) >>> 0; // Node >= 22.2
  if (!TABLA) {
    TABLA = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; TABLA[n] = c >>> 0; }
  }
  let c = (previo ^ 0xFFFFFFFF) >>> 0;
  for (let i = 0; i < buf.length; i++) c = TABLA[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

/* ------------------------------------------------------------------ Lector ZIP */
// Lee solo el directorio central (al final del archivo); el contenido de cada entrada se lee bajo demanda.
function abrirZip(ruta) {
  const fd = fs.openSync(ruta, 'r');
  try {
    const tam = fs.fstatSync(fd).size;
    if (tam < 22) throw new Error('No es un paquete .umbra válido (archivo demasiado pequeño).');
    const cola = Math.min(tam, 22 + 0xFFFF);
    const fin = Buffer.alloc(cola);
    fs.readSync(fd, fin, 0, cola, tam - cola);
    let eocd = -1;
    for (let i = cola - 22; i >= 0; i--) if (fin.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('No es un paquete .umbra válido (no es un ZIP).');
    const total = fin.readUInt16LE(eocd + 10), cdTam = fin.readUInt32LE(eocd + 12), cdPos = fin.readUInt32LE(eocd + 16);
    if (cdPos === 0xFFFFFFFF || total === 0xFFFF) throw new Error('ZIP64 no soportado: el paquete supera 4 GB o 65535 archivos.');
    const cd = Buffer.alloc(cdTam);
    fs.readSync(fd, cd, 0, cdTam, cdPos);
    const entradas = [];
    let p = 0;
    for (let n = 0; n < total; n++) {
      if (cd.readUInt32LE(p) !== 0x02014b50) throw new Error('Directorio central dañado.');
      const flags = cd.readUInt16LE(p + 8), metodo = cd.readUInt16LE(p + 10), crc = cd.readUInt32LE(p + 16);
      const comp = cd.readUInt32LE(p + 20), orig = cd.readUInt32LE(p + 24);
      const ln = cd.readUInt16LE(p + 28), le = cd.readUInt16LE(p + 30), lc = cd.readUInt16LE(p + 32);
      const hecho = cd.readUInt16LE(p + 4) >> 8, attr = cd.readUInt32LE(p + 38), local = cd.readUInt32LE(p + 42);
      const nombre = cd.toString(flags & 0x800 ? 'utf8' : 'latin1', p + 46, p + 46 + ln).replace(/\\/g, '/');
      entradas.push({ nombre, metodo, crc, comp, orig, local, dir: nombre.endsWith('/'), modo: hecho === 3 ? (attr >>> 16) & 0o7777 : 0, cifrado: !!(flags & 1) });
      p += 46 + ln + le + lc;
    }
    return { ruta, tam, entradas };
  } finally { fs.closeSync(fd); }
}

function inicioDatos(fd, e) {
  const h = Buffer.alloc(30);
  fs.readSync(fd, h, 0, 30, e.local);
  if (h.readUInt32LE(0) !== 0x04034b50) throw new Error('Cabecera local dañada: ' + e.nombre);
  return e.local + 30 + h.readUInt16LE(26) + h.readUInt16LE(28);
}

// Lee una entrada completa a memoria (para archivos pequenos: manifiesto, icono).
function leerEntrada(zip, nombre) {
  const e = zip.entradas.find((x) => x.nombre === nombre);
  if (!e) return null;
  if (e.cifrado) throw new Error('Entradas cifradas no soportadas.');
  const fd = fs.openSync(zip.ruta, 'r');
  try {
    const datos = Buffer.alloc(e.comp);
    fs.readSync(fd, datos, 0, e.comp, inicioDatos(fd, e));
    const buf = e.metodo === 0 ? datos : e.metodo === 8 ? zlib.inflateRawSync(datos) : null;
    if (!buf) throw new Error(`Método de compresión ${e.metodo} no soportado (${nombre}).`);
    if (crc32(buf) !== e.crc) throw new Error('El paquete está dañado (CRC incorrecto en ' + nombre + ').');
    return buf;
  } finally { fs.closeSync(fd); }
}

// Extrae una entrada a disco en streaming (sirve para AppImages grandes sin cargarlas en RAM).
function extraerEntrada(zip, e, destino) {
  return new Promise((resolve, reject) => {
    let fd = null, inicio;
    try { fd = fs.openSync(zip.ruta, 'r'); inicio = inicioDatos(fd, e); } catch (err) { return reject(err); } finally { if (fd !== null) fs.closeSync(fd); }
    if (e.metodo !== 0 && e.metodo !== 8) return reject(new Error(`Método de compresión ${e.metodo} no soportado (${e.nombre}).`));
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    const lectura = e.comp ? fs.createReadStream(zip.ruta, { start: inicio, end: inicio + e.comp - 1 }) : null;
    const salida = fs.createWriteStream(destino, e.modo ? { mode: e.modo } : undefined);
    let crc = 0;
    const fallo = (err) => { salida.destroy(); reject(err); };
    salida.on('error', fallo);
    salida.on('finish', () => {
      if (crc !== e.crc) return reject(new Error('El paquete está dañado (CRC incorrecto en ' + e.nombre + ').'));
      if (e.modo && process.platform !== 'win32') { try { fs.chmodSync(destino, e.modo); } catch {} }
      resolve();
    });
    if (!lectura) return salida.end();
    const flujo = e.metodo === 8 ? lectura.pipe(zlib.createInflateRaw()) : lectura;
    lectura.on('error', fallo); flujo.on('error', fallo);
    flujo.on('data', (c) => { crc = crc32(c, crc); });
    flujo.pipe(salida);
  });
}

/* ------------------------------------------------------------------ Manifiesto */
function validar(m) {
  const err = [];
  if (!m || typeof m !== 'object') return ['umbra.json no es un objeto JSON.'];
  if (!/^[a-z0-9][a-z0-9._-]{1,127}$/i.test(m.id || '')) err.push('id inválido (usa letras, números, punto, guion; p. ej. "org.ejemplo.MiApp").');
  if (!m.nombre) err.push('Falta "nombre".');
  if (!m.version) err.push('Falta "version".');
  if (!TIPOS.includes(m.tipo)) err.push(`"tipo" debe ser uno de: ${TIPOS.join(', ')}.`);
  if ((m.tipo === 'archivos' || m.tipo === 'exe') && !m.ejecutable) err.push('Falta "ejecutable" (ruta relativa dentro del paquete, p. ej. "app/mi-app").');
  if (m.tipo === 'winget' && !m.winget) err.push('Falta "winget" (id del paquete de winget).');
  if (m.ejecutable && (path.isAbsolute(m.ejecutable) || m.ejecutable.split(/[\\/]/).includes('..'))) err.push('"ejecutable" debe ser una ruta relativa sin "..".');
  if (m.permisos && !Array.isArray(m.permisos)) err.push('"permisos" debe ser una lista.');
  return err;
}

function normalizar(m) {
  return {
    formato: m.formato || VERSION_FORMATO,
    id: m.id, nombre: m.nombre, version: String(m.version), autor: m.autor || 'Desconocido', descripcion: m.descripcion || '',
    icono: m.icono || 'icono.png', tipo: m.tipo, ejecutable: m.ejecutable || (m.tipo === 'appimage' ? 'app.AppImage' : null),
    argumentos: Array.isArray(m.argumentos) ? m.argumentos : [], categorias: Array.isArray(m.categorias) ? m.categorias : [],
    permisos: Array.isArray(m.permisos) ? m.permisos.filter((x) => typeof x === 'string') : [],
    web: m.web || null, licencia: m.licencia || null, color: /^#[0-9a-f]{6}$/i.test(m.color || '') ? m.color : null,
    sistemas: Array.isArray(m.sistemas) ? m.sistemas : null, winget: m.winget || null, instalador: !!m.instalador
  };
}

const MIME = { png: 'image/png', svg: 'image/svg+xml', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', ico: 'image/x-icon' };

/** Lee un .umbra sin extraerlo: manifiesto + icono como dataURL + resumen de la carga. */
function leer(ruta) {
  const zip = abrirZip(ruta);
  const crudo = leerEntrada(zip, 'umbra.json');
  if (!crudo) throw new Error('El paquete no contiene umbra.json.');
  let m;
  try { m = JSON.parse(crudo.toString('utf8').replace(/^\uFEFF/, '')); } catch (e) { throw new Error('umbra.json no es JSON válido: ' + e.message); }
  const errores = validar(m);
  if (errores.length) throw new Error('Manifiesto inválido: ' + errores.join(' '));
  const manifiesto = normalizar(m);
  let icono = null;
  try {
    const b = leerEntrada(zip, manifiesto.icono) || leerEntrada(zip, 'icono.png');
    if (b && b.length < 4 * 1024 * 1024) icono = `data:${MIME[path.extname(manifiesto.icono).slice(1).toLowerCase()] || 'image/png'};base64,${b.toString('base64')}`;
  } catch {}
  const archivos = zip.entradas.filter((e) => !e.dir);
  return {
    ruta: path.resolve(ruta), manifiesto, icono,
    tamano: zip.tam, tamanoInstalado: archivos.reduce((s, e) => s + e.orig, 0), archivos: archivos.length,
    compatible: !manifiesto.sistemas || manifiesto.sistemas.includes(process.platform === 'win32' ? 'windows' : process.platform),
    carga: manifiesto.tipo === 'appimage' ? 'app.AppImage' : manifiesto.tipo === 'flatpakref' ? 'app.flatpakref' : manifiesto.tipo === 'winget' ? 'winget:' + manifiesto.winget : 'app/'
  };
}

/* ------------------------------------------------------------------ Instalacion */
function baseApps() {
  return process.platform === 'win32'
    ? path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'Umbra', 'apps')
    : path.join(process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share'), 'umbra', 'apps');
}
function carpetaMenu() {
  return process.platform === 'win32'
    ? path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Umbra')
    : path.join(process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share'), 'applications');
}
const nombreSeguro = (s) => String(s).replace(/[<>:"/\\|?*\x00-\x1f]/g, '').trim().slice(0, 80) || 'App';

// ICO que envuelve un PNG tal cual (Windows Vista+ lo admite): sirve de icono para el .lnk.
function pngAIco(png) {
  const w = png.readUInt32BE(16), h = png.readUInt32BE(20);
  const cab = Buffer.alloc(22);
  cab.writeUInt16LE(0, 0); cab.writeUInt16LE(1, 2); cab.writeUInt16LE(1, 4);
  cab.writeUInt8(w >= 256 ? 0 : w, 6); cab.writeUInt8(h >= 256 ? 0 : h, 7);
  cab.writeUInt16LE(1, 10); cab.writeUInt16LE(32, 12); cab.writeUInt32LE(png.length, 14); cab.writeUInt32LE(22, 18);
  return Buffer.concat([cab, png]);
}

function ejecutar(cmd, args, alLinea) {
  return new Promise((resolve) => {
    let todo = '';
    const p = spawn(cmd, args, { windowsHide: true });
    const linea = (d) => { const t = d.toString(); todo += t; if (alLinea) t.split(/[\r\n]+/).forEach((l) => l.trim() && alLinea(l)); };
    p.stdout.on('data', linea); p.stderr.on('data', linea);
    p.on('error', (e) => resolve({ codigo: -1, salida: String(e.message) }));
    p.on('close', (codigo) => resolve({ codigo, salida: todo }));
  });
}

function psComillas(s) { return "'" + String(s).replace(/'/g, "''") + "'"; }

async function crearAcceso(m, dir, exe) {
  fs.mkdirSync(carpetaMenu(), { recursive: true });
  if (process.platform === 'win32') {
    const lnk = path.join(carpetaMenu(), nombreSeguro(m.nombre) + '.lnk');
    let ico = '';
    try { const png = fs.readFileSync(path.join(dir, m.icono)); if (png.readUInt32BE(0) === 0x89504e47) { ico = path.join(dir, 'icono.ico'); fs.writeFileSync(ico, pngAIco(png)); } } catch {}
    const ps = `$s=(New-Object -ComObject WScript.Shell).CreateShortcut(${psComillas(lnk)});$s.TargetPath=${psComillas(exe)};` +
      `$s.WorkingDirectory=${psComillas(path.dirname(exe))};$s.Arguments=${psComillas(m.argumentos.map((a) => /\s/.test(a) ? `"${a}"` : a).join(' '))};` +
      `$s.Description=${psComillas(m.descripcion.slice(0, 250))};${ico ? `$s.IconLocation=${psComillas(ico + ',0')};` : ''}$s.Save()`;
    const r = await ejecutar('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', ps]);
    if (r.codigo !== 0) throw new Error('No se pudo crear el acceso del menú: ' + r.salida.trim());
    return lnk;
  }
  const esc = (s) => /[\s"'\\$`]/.test(s) ? '"' + s.replace(/(["\\$`])/g, '\\$1') + '"' : s;
  const desktop = path.join(carpetaMenu(), `umbra-${m.id}.desktop`);
  const cats = m.categorias.length ? m.categorias.join(';') + ';' : 'Utility;';
  fs.writeFileSync(desktop, [
    '[Desktop Entry]', 'Type=Application', `Name=${m.nombre}`, `Comment=${m.descripcion.replace(/\n/g, ' ')}`,
    `Exec=${[exe, ...m.argumentos].map(esc).join(' ')} %U`, `Path=${path.dirname(exe)}`, `Icon=${path.join(dir, m.icono)}`,
    `Categories=${cats}`, 'Terminal=false', `X-Umbra-Id=${m.id}`, `X-Umbra-Version=${m.version}`, ''
  ].join('\n'), { mode: 0o755 });
  ejecutar('update-desktop-database', [carpetaMenu()]);
  return desktop;
}

/**
 * Instala un .umbra.
 * opciones: { destino, alProgreso(pct, mensaje), simular, sinAcceso (no crea acceso en el menú) }
 * Devuelve { ok, id, nombre, version, carpeta, ejecutable, acceso }.
 */
async function instalar(ruta, opciones = {}) {
  const info = leer(ruta);
  const m = info.manifiesto;
  const avisa = (pct, msg) => { try { opciones.alProgreso && opciones.alProgreso(pct, msg); } catch {} };
  if (!info.compatible) throw new Error(`Este paquete no es para este sistema (${m.sistemas.join(', ')}).`);
  const dir = path.resolve(opciones.destino || path.join(baseApps(), m.id));
  const zip = abrirZip(ruta);

  if (opciones.simular) {
    for (let i = 1; i <= 10; i++) { await new Promise((r) => setTimeout(r, 120)); avisa(i * 10, 'Simulando instalación…'); }
    return { ok: true, simulado: true, id: m.id, nombre: m.nombre, version: m.version, carpeta: dir, ejecutable: m.ejecutable ? path.join(dir, m.ejecutable) : null, acceso: null };
  }

  // Extraer (versión anterior fuera primero).
  await fsp.rm(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const archivos = zip.entradas.filter((e) => !e.dir);
  const total = archivos.reduce((s, e) => s + e.orig, 0) || 1;
  let hecho = 0;
  for (const e of archivos) {
    const destino = path.resolve(dir, e.nombre);
    if (destino !== dir && !destino.startsWith(dir + path.sep)) throw new Error('Ruta peligrosa dentro del paquete: ' + e.nombre);
    await extraerEntrada(zip, e, destino);
    hecho += e.orig;
    avisa(Math.round((hecho / total) * (m.tipo === 'flatpakref' || m.tipo === 'winget' || m.instalador ? 30 : 90)), 'Extrayendo ' + e.nombre);
  }

  let exe = m.ejecutable ? path.join(dir, m.ejecutable) : null;
  let acceso = null;
  if (m.tipo === 'flatpakref') {
    if (process.platform !== 'linux') throw new Error('Los paquetes flatpakref solo se instalan en Linux.');
    avisa(40, 'Instalando con Flatpak…');
    const r = await ejecutar('flatpak', ['install', '-y', '--noninteractive', '--user', '--from', path.join(dir, 'app.flatpakref')], (l) => { const p = /(\d{1,3})%/.exec(l); if (p) avisa(40 + Math.round(+p[1] * 0.55), l.trim()); });
    if (r.codigo !== 0) throw new Error('Flatpak falló: ' + r.salida.trim().split('\n').pop());
    exe = null;
  } else if (m.tipo === 'winget') {
    if (process.platform !== 'win32') throw new Error('Los paquetes winget solo se instalan en Windows.');
    avisa(40, 'Instalando con winget…');
    const r = await ejecutar('winget', ['install', '--id', m.winget, '--exact', '--silent', '--accept-package-agreements', '--accept-source-agreements', '--disable-interactivity'], (l) => { const p = /(\d{1,3})\s*%/.exec(l); if (p) avisa(40 + Math.round(+p[1] * 0.55), 'Descargando…'); });
    if (r.codigo !== 0 && !/already installed|ya está instalado/i.test(r.salida)) throw new Error('winget falló (código ' + r.codigo + ').');
    exe = null;
  } else if (m.tipo === 'exe' && m.instalador) {
    if (process.platform !== 'win32') throw new Error('Los instaladores .exe solo funcionan en Windows.');
    avisa(50, 'Ejecutando el instalador…');
    const r = await ejecutar(exe, m.argumentos);
    if (r.codigo !== 0) throw new Error('El instalador terminó con código ' + r.codigo + '.');
    exe = null;
  } else {
    if (!exe || !fs.existsSync(exe)) throw new Error('El ejecutable indicado no está en el paquete: ' + m.ejecutable);
    if (process.platform !== 'win32') { try { fs.chmodSync(exe, 0o755); } catch {} }
    if (!opciones.sinAcceso) { avisa(94, 'Creando acceso en el menú…'); acceso = await crearAcceso(m, dir, exe); }
  }
  fs.writeFileSync(path.join(dir, '.umbra-instalado.json'), JSON.stringify({ ...m, instaladoEl: new Date().toISOString(), origen: info.ruta, acceso, ejecutableAbs: exe }, null, 2));
  avisa(100, 'Listo');
  return { ok: true, id: m.id, nombre: m.nombre, version: m.version, carpeta: dir, ejecutable: exe, acceso };
}

/** Apps instaladas desde paquetes .umbra. */
function instalados() {
  const base = baseApps();
  let dirs = [];
  try { dirs = fs.readdirSync(base); } catch { return []; }
  return dirs.map((d) => {
    try {
      const m = JSON.parse(fs.readFileSync(path.join(base, d, '.umbra-instalado.json'), 'utf8'));
      let icono = null;
      try { icono = 'data:image/png;base64,' + fs.readFileSync(path.join(base, d, m.icono)).toString('base64'); } catch {}
      return { ...m, carpeta: path.join(base, d), icono };
    } catch { return null; }
  }).filter(Boolean);
}

async function desinstalar(id) {
  const dir = path.join(baseApps(), id);
  let m = null;
  try { m = JSON.parse(fs.readFileSync(path.join(dir, '.umbra-instalado.json'), 'utf8')); } catch {}
  if (m && m.acceso) await fsp.rm(m.acceso, { force: true });
  await fsp.rm(dir, { recursive: true, force: true });
  return { ok: true };
}

function lanzar(id) {
  const m = instalados().find((x) => x.id === id);
  if (!m || !m.ejecutableAbs) return false;
  const p = spawn(m.ejecutableAbs, m.argumentos || [], { cwd: path.dirname(m.ejecutableAbs), detached: true, stdio: 'ignore' });
  p.on('error', () => {}); p.unref();
  return true;
}

/* ------------------------------------------------------------------ Escritor ZIP */
function listar(dir, base = dir, out = []) {
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, d.name);
    if (d.isDirectory()) listar(abs, base, out);
    else if (d.isFile()) out.push(abs);
  }
  return out;
}

/** Empaqueta una carpeta (con umbra.json en la raiz) en un .umbra. */
function crear(carpetaOrigen, rutaSalida) {
  const origen = path.resolve(carpetaOrigen);
  let m;
  try { m = JSON.parse(fs.readFileSync(path.join(origen, 'umbra.json'), 'utf8').replace(/^\uFEFF/, '')); } catch (e) { throw new Error('La carpeta necesita un umbra.json válido: ' + e.message); }
  const errores = validar(m);
  if (errores.length) throw new Error('Manifiesto inválido: ' + errores.join(' '));
  const n = normalizar(m);
  if (n.tipo === 'appimage' && !fs.existsSync(path.join(origen, 'app.AppImage'))) throw new Error('Falta app.AppImage en la carpeta.');
  if (n.tipo === 'flatpakref' && !fs.existsSync(path.join(origen, 'app.flatpakref'))) throw new Error('Falta app.flatpakref en la carpeta.');
  if (n.ejecutable && !fs.existsSync(path.join(origen, n.ejecutable))) throw new Error('No existe el ejecutable: ' + n.ejecutable);

  // umbra.json primero (lectura rapida), luego el icono, luego el resto.
  const todos = listar(origen).map((a) => path.relative(origen, a).split(path.sep).join('/'));
  const orden = ['umbra.json', n.icono].filter((x) => todos.includes(x));
  const lista = [...orden, ...todos.filter((x) => !orden.includes(x)).sort()];
  if (lista.length > 0xFFFE) throw new Error('Demasiados archivos (máx. 65534).');

  const salida = path.resolve(rutaSalida);
  fs.mkdirSync(path.dirname(salida), { recursive: true });
  const fd = fs.openSync(salida, 'w');
  const central = [];
  let pos = 0;
  const escribe = (b) => { fs.writeSync(fd, b); pos += b.length; };
  const ahora = new Date();
  const hora = (ahora.getHours() << 11) | (ahora.getMinutes() << 5) | (ahora.getSeconds() >> 1);
  const fecha = ((ahora.getFullYear() - 1980) << 9) | ((ahora.getMonth() + 1) << 5) | ahora.getDate();
  try {
    for (const rel of lista) {
      const abs = path.join(origen, ...rel.split('/'));
      const datos = fs.readFileSync(abs);
      if (datos.length > 0xFFFFFFFE) throw new Error('Archivo demasiado grande para ZIP sin ZIP64: ' + rel);
      const crc = crc32(datos);
      const comp = zlib.deflateRawSync(datos, { level: 9 });
      const usa = comp.length < datos.length ? comp : datos, metodo = usa === comp ? 8 : 0;
      const nombre = Buffer.from(rel, 'utf8');
      let modo = 0o644;
      try { modo = fs.statSync(abs).mode & 0o777; } catch {}
      if (rel === n.ejecutable || rel === 'app.AppImage' || /\.(AppImage|sh)$/i.test(rel)) modo |= 0o755;
      const local = Buffer.alloc(30);
      local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x800, 6); local.writeUInt16LE(metodo, 8);
      local.writeUInt16LE(hora, 10); local.writeUInt16LE(fecha, 12); local.writeUInt32LE(crc, 14);
      local.writeUInt32LE(usa.length, 18); local.writeUInt32LE(datos.length, 22); local.writeUInt16LE(nombre.length, 26); local.writeUInt16LE(0, 28);
      const offset = pos;
      escribe(local); escribe(nombre); escribe(usa);
      const c = Buffer.alloc(46);
      c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE((3 << 8) | 20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x800, 8); c.writeUInt16LE(metodo, 10);
      c.writeUInt16LE(hora, 12); c.writeUInt16LE(fecha, 14); c.writeUInt32LE(crc, 16); c.writeUInt32LE(usa.length, 20); c.writeUInt32LE(datos.length, 24);
      c.writeUInt16LE(nombre.length, 28); c.writeUInt32LE(((0o100000 | modo) << 16) >>> 0, 38); c.writeUInt32LE(offset, 42);
      central.push(Buffer.concat([c, nombre]));
      if (pos > 0xFFFFFFFF) throw new Error('El paquete supera 4 GB (ZIP64 no soportado).');
    }
    const cdPos = pos;
    for (const c of central) escribe(c);
    const fin = Buffer.alloc(22);
    fin.writeUInt32LE(0x06054b50, 0); fin.writeUInt16LE(central.length, 8); fin.writeUInt16LE(central.length, 10);
    fin.writeUInt32LE(pos - cdPos, 12); fin.writeUInt32LE(cdPos, 16);
    escribe(fin);
  } finally { fs.closeSync(fd); }
  return { ruta: salida, archivos: lista.length, bytes: pos, manifiesto: n };
}

module.exports = { leer, instalar, crear, desinstalar, instalados, lanzar, validar, baseApps, carpetaMenu, TIPOS, PERMISOS, VERSION_FORMATO, _zip: { abrirZip, leerEntrada, crc32 } };
