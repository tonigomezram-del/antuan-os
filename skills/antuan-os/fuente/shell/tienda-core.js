// Tienda Antuan (proceso principal): catalogo, deteccion de lo instalado, cola de instalacion tipo Ninite,
// actualizaciones y paquetes .umbra. Windows -> winget. Linux -> Flatpak (preferente) y apt (con pkexec).
//
// Uso en main.js:
//   require('./tienda-core')({ ASKS, CMDS, app, shell, log, enviar: (canal, ...d) => tienda && tienda.webContents.send(canal, ...d) });
// Opcional: simular: true (o UMBRA_TIENDA_SIMULAR=1) para probar la interfaz sin instalar nada de verdad.
'use strict';
const { spawn, execFile } = require('child_process');
const path = require('path');
const { APPS, CATEGORIAS, PACKS } = require('./tienda-catalogo');
const paquete = require('./umbra-paquete');
const webapps = require('./webapps');
const fs = require('fs');
const os = require('os');

module.exports = function registrar({ ASKS, CMDS, app, shell, log = () => {}, enviar = () => {}, abrirTerminal = null, simular = process.env.UMBRA_TIENDA_SIMULAR === '1' }) {
  const WIN = process.platform === 'win32', LINUX = process.platform === 'linux';
  const porId = new Map(APPS.map((a) => [a.id, a]));
  webapps.registrar(APPS);
  const L = (...m) => { try { log('tienda', ...m); } catch {} };

  /* ---------------------------------------------------------------- Utilidades de procesos */
  // Lanza un proceso y entrega cada linea (separando \r y \n: winget y flatpak pintan barras con \r).
  function correr(cmd, args, { alLinea, env, guardar } = {}) {
    return new Promise((resolve) => {
      let salida = '', p;
      try { p = spawn(cmd, args, { windowsHide: true, env: env ? { ...process.env, ...env } : process.env }); } catch (e) { return resolve({ codigo: -1, salida: String(e.message) }); }
      if (guardar) guardar(p);
      let resto = '';
      const trozo = (d) => {
        const t = d.toString('utf8'); salida += t;
        if (salida.length > 2e6) salida = salida.slice(-1e6);
        const partes = (resto + t).split(/[\r\n]+/); resto = partes.pop();
        if (alLinea) for (const l of partes) if (l.trim()) alLinea(l);
      };
      p.stdout && p.stdout.on('data', trozo); p.stderr && p.stderr.on('data', trozo);
      p.on('error', (e) => resolve({ codigo: -1, salida: salida + e.message }));
      p.on('close', (codigo) => { if (resto.trim() && alLinea) alLinea(resto); resolve({ codigo, salida }); });
    });
  }
  const leerCmd = (cmd, args, ms = 120000) => new Promise((resolve) => {
    execFile(cmd, args, { windowsHide: true, maxBuffer: 1 << 25, timeout: ms, encoding: 'utf8' }, (e, out) => resolve(e && !out ? null : out || ''));
  });
  const existe = async (cmd) => LINUX ? !!(await leerCmd('sh', ['-c', `command -v ${cmd}`], 5000) || '').trim() : false;
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '');

  /* ---------------------------------------------------------------- Sistema */
  let sistema = null;
  async function detectar() {
    if (sistema) return sistema;
    if (WIN) sistema = { so: 'windows', winget: !!(await leerCmd('winget', ['--version'], 15000)), flatpak: false, apt: false };
    else if (LINUX) {
      const [fp, ap] = await Promise.all([existe('flatpak'), existe('apt-get')]);
      sistema = { so: 'linux', winget: false, flatpak: fp, apt: ap };
    } else sistema = { so: process.platform, winget: false, flatpak: false, apt: false };
    sistema.gestor = sistema.winget ? 'winget' : sistema.flatpak ? 'flatpak' : sistema.apt ? 'apt' : null;
    sistema.simulado = !!simular;
    return sistema;
  }
  // Instaladores oficiales (sin gestor de paquetes). hecho(): si ya esta instalado.
  const HOME = os.homedir();
  const SCRIPTS = {
    'claude-code': {
      instalar: WIN ? ['powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', 'irm https://claude.ai/install.ps1 | iex']]
        : ['bash', ['-c', 'curl -fsSL https://claude.ai/install.sh | bash']],
      bin: WIN ? path.join(HOME, '.local', 'bin', 'claude.exe') : path.join(HOME, '.local/bin/claude'),
      borrar: [path.join(HOME, '.local', 'bin', WIN ? 'claude.exe' : 'claude'), path.join(HOME, '.local', 'share', 'claude')],
    }
  };
  const scriptHecho = (id) => !!SCRIPTS[id] && fs.existsSync(SCRIPTS[id].bin);

  function fuenteDe(a) {
    const f = a.fuentes || {};
    if (!sistema) return null;
    if (sistema.so === 'windows' && f.winget && (sistema.winget || simular)) return { tipo: 'winget', id: f.winget };
    if (sistema.so === 'linux') {
      if (f.flatpak && (sistema.flatpak || simular)) return { tipo: 'flatpak', id: f.flatpak };
      if (f.apt && (sistema.apt || simular)) return { tipo: 'apt', id: f.apt };
    }
    // Apps web (ventana propia) e instaladores oficiales: funcionan en cualquier sistema
    if (f.web) return { tipo: 'web', id: f.web };
    if (f.script && SCRIPTS[f.script]) return { tipo: 'script', id: f.script };
    return null;
  }

  /* ---------------------------------------------------------------- Tablas de winget */
  // winget pinta tablas alineadas por columnas; las cabeceras van traducidas, asi que se usan posiciones.
  function tablaWinget(texto) {
    const lineas = String(texto || '').split(/\r?\n|\r/);
    const i = lineas.findIndex((l) => /^-{10,}\s*$/.test(l));
    if (i < 1) return [];
    const cab = lineas[i - 1].replace(/^[^A-Za-zÀ-ÿ]+/, (m) => ' '.repeat(m.length));
    const ini = []; let m; const re = /\S+(?: \S+)*/g;
    while ((m = re.exec(cab))) ini.push(m.index);
    const filas = [];
    for (let k = i + 1; k < lineas.length; k++) {
      const l = lineas[k];
      if (!l.trim() || /^\d+ (upgrades?|actualizaci|paquete|package)/i.test(l.trim())) break;
      let c = ini.map((s, j) => l.slice(s, ini[j + 1]).trim());
      if (!c[1] || /\s/.test(c[1])) { // columnas desalineadas (caracteres anchos): se reconstruye desde la derecha
        const t = l.trim().split(/\s+/);
        const origen = /^(winget|msstore)$/i.test(t[t.length - 1]) ? t.pop() : '';
        const n = ini.length;
        if (n >= 5) { const disp = t.length > 3 ? t.pop() : ''; const ver = t.pop(); const id = t.pop(); c = [t.join(' '), id, ver, disp, origen]; }
        else { const ver = t.pop(); const id = t.pop(); c = [t.join(' '), id, ver, origen]; }
      }
      filas.push({ nombre: c[0], id: c[1], version: c[2], disponible: ini.length >= 5 ? c[3] : '', origen: c[ini.length - 1] || '' });
    }
    return filas;
  }

  /* ---------------------------------------------------------------- Lo instalado (cache 60 s) */
  let cache = null, cacheT = 0, cacheP = null;
  const simInstaladas = new Set();
  function invalidar() { cache = null; cacheT = 0; }
  async function instalados() {
    if (cache && Date.now() - cacheT < 60000) return cache;
    if (cacheP) return cacheP;
    cacheP = (async () => {
      await detectar();
      const r = { winget: new Map(), flatpak: new Set(), apt: new Set() };
      if (sistema.so === 'windows' && sistema.winget) {
        const out = await leerCmd('winget', ['list', '--accept-source-agreements', '--disable-interactivity'], 90000);
        for (const f of tablaWinget(out)) if (f.id) r.winget.set(f.id.toLowerCase(), f);
      } else if (sistema.so === 'linux') {
        if (sistema.flatpak) (await leerCmd('flatpak', ['list', '--app', '--columns=application'], 30000) || '').split('\n').forEach((l) => l.trim() && r.flatpak.add(l.trim()));
        if (sistema.apt) (await leerCmd('dpkg-query', ['-W', '-f=${db:Status-Abbrev} ${Package}\n'], 30000) || '').split('\n').forEach((l) => { const m = /^ii\s+(\S+)/.exec(l); if (m) r.apt.add(m[1].replace(/:.*$/, '')); });
      }
      cache = r; cacheT = Date.now(); cacheP = null;
      return r;
    })();
    return cacheP;
  }
  function estadoInstalado(a, inst) {
    if (simInstaladas.has(a.id)) return { instalado: true, via: 'simulado' };
    const f = a.fuentes || {};
    if (f.winget && inst.winget.has(f.winget.toLowerCase())) { const w = inst.winget.get(f.winget.toLowerCase()); return { instalado: true, via: 'winget', version: w.version, actualizable: !!w.disponible && w.disponible !== w.version ? w.disponible : null }; }
    if (f.flatpak && inst.flatpak.has(f.flatpak)) return { instalado: true, via: 'flatpak' };
    if (f.apt && inst.apt.has(f.apt)) return { instalado: true, via: 'apt' };
    if (f.web && webapps.instalada(a.id)) return { instalado: true, via: 'web' };
    if (f.script && scriptHecho(f.script)) return { instalado: true, via: 'script' };
    return { instalado: false };
  }

  async function catalogo(opc = {}) {
    await detectar();
    const inst = opc.rapido ? null : await instalados();
    return {
      sistema, categorias: CATEGORIAS, packs: PACKS,
      apps: APPS.map((a) => {
        const fuente = fuenteDe(a);
        return { ...a, fuente, disponible: !!fuente, ...(inst ? estadoInstalado(a, inst) : { instalado: null }), trabajo: trabajos.get(a.id) || null };
      }),
      umbra: paquete.instalados().map((m) => ({ id: m.id, nombre: m.nombre, version: m.version, autor: m.autor, descripcion: m.descripcion, icono: m.icono, color: m.color, tipo: m.tipo }))
    };
  }

  /* ---------------------------------------------------------------- Cola de trabajos */
  const cola = [];
  const trabajos = new Map(); // id -> ultimo estado emitido
  let ocupado = false, proceso = null, cancelando = false;

  function emitir(id, estado, pct = null, mensaje = '', extra = {}) {
    const a = porId.get(id);
    const ev = { id, estado, pct: pct == null ? null : Math.max(0, Math.min(100, Math.round(pct))), mensaje, nombre: extra.nombre || (a ? a.nombre : id), accion: extra.accion, t: Date.now() };
    trabajos.set(id, ev);
    try { enviar('tienda-progreso', ev); } catch {}
  }
  // Limita los eventos de progreso a ~8 por segundo por app.
  const ultimoEnvio = new Map();
  function progreso(id, estado, pct, mensaje, extra) {
    const ahora = Date.now(), prev = trabajos.get(id);
    if (prev && prev.estado === estado && ahora - (ultimoEnvio.get(id) || 0) < 120) return;
    ultimoEnvio.set(id, ahora);
    emitir(id, estado, pct, mensaje, extra);
  }

  function encolar(job) {
    return new Promise((resolve) => {
      job.resolve = resolve;
      cola.push(job);
      emitir(job.id, 'esperando', 0, 'En cola', { accion: job.accion, nombre: job.nombre });
      siguiente();
    });
  }
  async function siguiente() {
    if (ocupado) return;
    const job = cola.shift();
    if (!job) { cancelando = false; return; }
    ocupado = true;
    let r;
    try { r = await job.fn(job); } catch (e) { r = { ok: false, error: e.message || String(e) }; }
    proceso = null;
    if (r && r.ok) emitir(job.id, 'hecho', 100, r.mensaje || (job.accion === 'desinstalar' ? 'Desinstalada' : job.accion === 'actualizar' ? 'Actualizada' : 'Instalada'), { accion: job.accion, nombre: job.nombre });
    else emitir(job.id, 'error', null, (r && r.error) || 'Algo falló', { accion: job.accion, nombre: job.nombre });
    invalidar();
    ocupado = false;
    job.resolve(r);
    siguiente();
  }

  // Interpreta la salida de winget / flatpak / apt y la convierte en estado + porcentaje.
  function lector(id, tipo, extra) {
    let fase = 'descargando';
    const unidad = { KB: 1 / 1024, MB: 1, GB: 1024 };
    return (l) => {
      const t = l.trim();
      if (tipo === 'apt') {
        const m = /^(dl|pm)status:[^:]*:([\d.]+):(.*)$/.exec(t);
        if (m) { fase = m[1] === 'dl' ? 'descargando' : 'instalando'; progreso(id, fase, m[1] === 'dl' ? +m[2] * 0.6 : 60 + +m[2] * 0.4, m[3], extra); }
        return;
      }
      if (/hash|Iniciando|Starting|Instalando el paquete|Installing package|Ejecutando|Running|Installing|Instalando/i.test(t) && !/%/.test(t)) {
        fase = 'instalando'; progreso(id, fase, null, tipo === 'winget' ? 'Instalando…' : t.slice(0, 120), extra); return;
      }
      if (/^(Descargando|Downloading)\s/i.test(t)) { fase = 'descargando'; progreso(id, fase, 0, 'Descargando…', extra); return; }
      const s = /([\d.,]+)\s*(KB|MB|GB)\s*\/\s*([\d.,]+)\s*(KB|MB|GB)/i.exec(t);
      if (s) {
        const hecho = parseFloat(s[1].replace(',', '.')) * unidad[s[2].toUpperCase()], total = parseFloat(s[3].replace(',', '.')) * unidad[s[4].toUpperCase()];
        if (total > 0) progreso(id, 'descargando', (hecho / total) * 100, `${s[1]} ${s[2]} de ${s[3]} ${s[4]}`, extra);
        return;
      }
      const p = /(\d{1,3}(?:[.,]\d+)?)\s*%/.exec(t);
      if (p) progreso(id, fase, parseFloat(p[1].replace(',', '.')), fase === 'descargando' ? 'Descargando…' : 'Instalando…', extra);
    };
  }

  const YA = /ya está instalado|already installed|No se encontró ninguna actualización|No available upgrade|No applicable upgrade|No hay actualizaciones|Nothing to do|is already the newest version|ya está en su versión más reciente/i;
  function ultimaLinea(salida) {
    const ls = String(salida || '').split(/[\r\n]+/).map((x) => x.trim()).filter((x) => x && !/^[-\\|/█▒\s%\d.,KMGBkmgbs]+$/.test(x));
    return (ls.pop() || '').slice(0, 200);
  }
  const guarda = (p) => { proceso = p; };

  async function simularTrabajo(job, ms = 2600) {
    const pasos = Math.round(ms / 140);
    for (let i = 0; i <= pasos; i++) {
      if (cancelando) return { ok: false, error: 'Cancelado' };
      progreso(job.id, 'descargando', (i / pasos) * 100, `${(i / pasos * (20 + (job.id.length * 7) % 90)).toFixed(1)} MB de ${(20 + (job.id.length * 7) % 90).toFixed(1)} MB`, { accion: job.accion });
      await espera(140 + Math.random() * 60);
    }
    emitir(job.id, 'instalando', null, 'Instalando…', { accion: job.accion });
    await espera(900);
    return { ok: true, simulado: true };
  }

  async function ejecutarFuente(job, f, accion) {
    const extra = { accion, nombre: job.nombre };
    const a = porId.get(job.id) || {};
    if (f.tipo === 'winget') {
      const verbo = accion === 'desinstalar' ? 'uninstall' : accion === 'actualizar' ? 'upgrade' : 'install';
      const args = [verbo, '--id', f.id, '--exact', '--silent', '--accept-source-agreements', '--disable-interactivity'];
      if (verbo !== 'uninstall') args.push('--accept-package-agreements');
      if (a.wingetFuente) args.push('--source', a.wingetFuente);
      const r = await correr('winget', args, { alLinea: lector(job.id, 'winget', extra), guardar: guarda });
      if (r.codigo === 0 || YA.test(r.salida)) return { ok: true };
      if (/reinici|restart|reboot/i.test(r.salida) && /correctamente|successfully/i.test(r.salida)) return { ok: true, mensaje: 'Hecho (pide reiniciar)' };
      return { ok: false, error: cancelando ? 'Cancelado' : ultimaLinea(r.salida) || `winget terminó con código ${r.codigo}` };
    }
    if (f.tipo === 'flatpak') {
      const args = accion === 'desinstalar' ? ['uninstall', '-y', '--noninteractive', f.id]
        : accion === 'actualizar' ? ['update', '-y', '--noninteractive', f.id]
        : ['install', '-y', '--noninteractive', 'flathub', f.id];
      const r = await correr('flatpak', args, { alLinea: lector(job.id, 'flatpak', extra), guardar: guarda });
      return r.codigo === 0 || YA.test(r.salida) ? { ok: true } : { ok: false, error: cancelando ? 'Cancelado' : ultimaLinea(r.salida) || 'Flatpak falló' };
    }
    if (f.tipo === 'apt') {
      const verbo = accion === 'desinstalar' ? 'remove' : accion === 'actualizar' ? 'install --only-upgrade' : 'install';
      const args = ['env', 'DEBIAN_FRONTEND=noninteractive', 'apt-get', '-o', 'APT::Status-Fd=1', ...verbo.split(' '), '-y', f.id];
      const r = await correr('pkexec', args, { alLinea: lector(job.id, 'apt', extra), guardar: guarda });
      if (r.codigo === 126 || r.codigo === 127) return { ok: false, error: 'Permiso denegado' };
      return r.codigo === 0 ? { ok: true } : { ok: false, error: ultimaLinea(r.salida) || 'apt falló' };
    }
    if (f.tipo === 'web') {
      if (accion === 'desinstalar') return webapps.desinstalar(a);
      emitir(job.id, 'instalando', 60, 'Creando la app…', extra);
      return webapps.instalar(a);
    }
    if (f.tipo === 'script') {
      const sc = SCRIPTS[f.id];
      if (accion === 'desinstalar') { for (const p of sc.borrar) { try { fs.rmSync(p, { recursive: true, force: true }); } catch {} } return { ok: true }; }
      emitir(job.id, 'descargando', null, 'Descargando el instalador oficial…', extra);
      const r = await correr(sc.instalar[0], sc.instalar[1], { alLinea: (l) => progreso(job.id, 'instalando', null, l.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '').trim().slice(0, 90), extra), guardar: guarda });
      if (scriptHecho(f.id)) {
        // Lanzador en el menu Inicio: se abre en la Terminal Antuan
        if (LINUX) try {
          const dir = path.join(HOME, '.local/share/applications'); fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(path.join(dir, 'antuan-' + f.id + '.desktop'), ['[Desktop Entry]', 'Type=Application', `Name=${a.nombre}`, `Comment=${a.descripcion}`, `Exec=${sc.bin}`, 'Icon=utilities-terminal', 'Terminal=true', 'Categories=Development;', ''].join('\n'), { mode: 0o755 });
        } catch {}
        return { ok: true };
      }
      return { ok: false, error: cancelando ? 'Cancelado' : ultimaLinea(r.salida) || 'El instalador falló' };
    }
    return { ok: false, error: 'Sin fuente para este sistema' };
  }

  async function trabajoApp(job) {
    const a = porId.get(job.id);
    const f = fuenteDe(a);
    if (!f) return { ok: false, error: 'No disponible en este sistema' };
    if (simular) {
      const r = await simularTrabajo(job, job.accion === 'desinstalar' ? 900 : 2200 + Math.random() * 1800);
      if (r.ok) { if (job.accion === 'desinstalar') simInstaladas.delete(job.id); else simInstaladas.add(job.id); }
      return r;
    }
    emitir(job.id, job.accion === 'desinstalar' ? 'instalando' : 'descargando', null, job.accion === 'desinstalar' ? 'Desinstalando…' : 'Preparando…', { accion: job.accion });
    return ejecutarFuente(job, f, job.accion);
  }

  /* ---------------------------------------------------------------- Abrir apps */
  let menuInicio = null, menuT = 0;
  async function appsMenuInicio() {
    if (menuInicio && Date.now() - menuT < 60000) return menuInicio;
    const ps = '[Console]::OutputEncoding=[Text.Encoding]::UTF8; Get-StartApps | Select-Object Name,AppID | ConvertTo-Json -Compress';
    const out = await leerCmd('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], 30000);
    try { menuInicio = [].concat(JSON.parse(out || '[]')); } catch { menuInicio = []; }
    menuT = Date.now();
    return menuInicio;
  }
  async function abrir(id) {
    if (String(id).startsWith('umbra:')) return { ok: paquete.lanzar(id.slice(6)) };
    const a = porId.get(id);
    if (!a) return { ok: false, error: 'App desconocida' };
    if (simular) { L('abrir (simulado)', id); return { ok: true, simulado: true }; }
    if (a.cli) return { ok: false, error: 'Es una herramienta de línea de comandos' };
    const st0 = estadoInstalado(a, await instalados());
    if (st0.via === 'web' || (!st0.instalado && a.fuentes.web && !a.fuentes.winget)) return webapps.abrir(a.id);
    if (st0.via === 'script') {
      if (!abrirTerminal) return { ok: false, error: 'No hay terminal' };
      abrirTerminal("'" + SCRIPTS[a.fuentes.script].bin + "'"); return { ok: true };
    }
    if (WIN) {
      const lista = await appsMenuInicio();
      const objetivo = norm(a.menu || a.nombre);
      const exacta = lista.find((x) => norm(x.Name) === objetivo) || lista.find((x) => norm(x.Name).startsWith(objetivo)) || lista.find((x) => norm(x.Name).includes(norm(a.nombre)));
      if (!exacta) return { ok: false, error: 'No encuentro su acceso en el menú Inicio' };
      spawn('explorer.exe', ['shell:AppsFolder\\' + exacta.AppID], { detached: true, stdio: 'ignore' }).unref();
      return { ok: true };
    }
    if (LINUX) {
      const inst = await instalados();
      const st = estadoInstalado(a, inst);
      const [cmd, args] = st.via === 'flatpak' ? ['flatpak', ['run', a.fuentes.flatpak]] : [a.bin || a.fuentes.apt, []];
      if (!cmd) return { ok: false, error: 'No sé cómo abrirla' };
      const p = spawn(cmd, args, { detached: true, stdio: 'ignore' }); p.on('error', () => {}); p.unref();
      return { ok: true };
    }
    return { ok: false, error: 'Sistema no soportado' };
  }

  /* ---------------------------------------------------------------- Actualizaciones */
  async function actualizables() {
    await detectar();
    const lista = [];
    const deCatalogo = (campo, valor) => APPS.find((a) => a.fuentes[campo] && a.fuentes[campo].toLowerCase() === String(valor).toLowerCase());
    if (sistema.so === 'windows' && sistema.winget) {
      const out = await leerCmd('winget', ['upgrade', '--accept-source-agreements', '--disable-interactivity'], 120000);
      for (const f of tablaWinget(out)) {
        if (!f.id || !f.disponible) continue;
        const a = deCatalogo('winget', f.id);
        lista.push({ id: a ? a.id : 'winget:' + f.id, catalogo: !!a, nombre: a ? a.nombre : f.nombre, fuente: 'winget', idFuente: f.id, version: f.version, nueva: f.disponible, icono: a ? a.icono : null, color: a ? a.color : null });
      }
    } else if (sistema.so === 'linux') {
      if (sistema.flatpak) {
        const out = await leerCmd('flatpak', ['remote-ls', '--updates', '--app', '--columns=application,name,version'], 60000) || '';
        for (const l of out.split('\n')) {
          const [idF, nombre, version] = l.split('\t'); if (!idF || !idF.trim()) continue;
          const a = deCatalogo('flatpak', idF.trim());
          lista.push({ id: a ? a.id : 'flatpak:' + idF.trim(), catalogo: !!a, nombre: a ? a.nombre : nombre || idF, fuente: 'flatpak', idFuente: idF.trim(), version: '', nueva: version || '', icono: a ? a.icono : null, color: a ? a.color : null });
        }
      }
      if (sistema.apt) {
        const out = await leerCmd('apt', ['list', '--upgradable'], 60000) || '';
        for (const l of out.split('\n')) {
          const m = /^([^/\s]+)\/\S+\s+(\S+)\s+\S+\s+\[[^\]]*?([^\s\]]+)\]/.exec(l); if (!m) continue;
          const a = deCatalogo('apt', m[1]);
          lista.push({ id: a ? a.id : 'apt:' + m[1], catalogo: !!a, nombre: a ? a.nombre : m[1], fuente: 'apt', idFuente: m[1], version: m[3], nueva: m[2], icono: a ? a.icono : null, color: a ? a.color : null });
        }
      }
    }
    return { sistema, apps: lista, comprobado: new Date().toISOString() };
  }

  async function trabajoActualizarUna(job) {
    if (simular) return simularTrabajo(job, 1800);
    const [tipo, ...resto] = job.ref.split(':');
    return ejecutarFuente(job, { tipo, id: resto.join(':') }, 'actualizar');
  }
  async function trabajoActualizarTodo(job) {
    if (simular) return simularTrabajo(job, 4000);
    await detectar();
    const extra = { accion: 'actualizarTodo', nombre: job.nombre };
    if (sistema.so === 'windows') {
      emitir(job.id, 'descargando', null, 'Buscando y descargando actualizaciones…', extra);
      const r = await correr('winget', ['upgrade', '--all', '--silent', '--accept-package-agreements', '--accept-source-agreements', '--disable-interactivity'], { alLinea: lector(job.id, 'winget', extra), guardar: guarda });
      return r.codigo === 0 || YA.test(r.salida) ? { ok: true, mensaje: 'Todo al día' } : { ok: false, error: cancelando ? 'Cancelado' : ultimaLinea(r.salida) || 'winget falló' };
    }
    let ok = true, error = '';
    if (sistema.flatpak) {
      const r = await correr('flatpak', ['update', '-y', '--noninteractive'], { alLinea: lector(job.id, 'flatpak', extra), guardar: guarda });
      if (r.codigo !== 0) { ok = false; error = ultimaLinea(r.salida); }
    }
    if (sistema.apt && !cancelando) {
      const r = await correr('pkexec', ['env', 'DEBIAN_FRONTEND=noninteractive', 'sh', '-c', 'apt-get update && apt-get -o APT::Status-Fd=1 upgrade -y'], { alLinea: lector(job.id, 'apt', extra), guardar: guarda });
      if (r.codigo !== 0) { ok = false; error = error || ultimaLinea(r.salida); }
    }
    return ok ? { ok: true, mensaje: 'Todo al día' } : { ok: false, error: error || 'No se pudo actualizar todo' };
  }

  /* ---------------------------------------------------------------- Registro de ASKS / CMDS */
  ASKS['tienda.sistema'] = () => detectar();
  ASKS['tienda.catalogo'] = (opc) => catalogo(opc || {});
  ASKS['tienda.estado'] = () => ({ ocupado, cola: cola.map((j) => j.id), trabajos: [...trabajos.values()] });

  ASKS['tienda.instalar'] = async (ids) => {
    await detectar();
    const encolados = [], rechazados = [];
    for (const id of [].concat(ids || [])) {
      const a = porId.get(id);
      if (!a || !fuenteDe(a)) { rechazados.push(id); emitir(id, 'error', null, a ? 'No disponible en este sistema' : 'App desconocida'); continue; }
      if (cola.some((j) => j.id === id) || (trabajos.get(id) && ['descargando', 'instalando'].includes(trabajos.get(id).estado))) continue;
      encolados.push(id);
      encolar({ id, nombre: a.nombre, accion: 'instalar', fn: trabajoApp });
    }
    return { encolados, rechazados };
  };
  ASKS['tienda.desinstalar'] = async (id) => {
    await detectar();
    if (String(id).startsWith('umbra:')) {
      const pid = id.slice(6);
      return encolar({ id, nombre: pid, accion: 'desinstalar', fn: async () => simular ? { ok: true } : paquete.desinstalar(pid) });
    }
    const a = porId.get(id);
    if (!a || !fuenteDe(a)) return { ok: false, error: 'No disponible en este sistema' };
    return encolar({ id, nombre: a.nombre, accion: 'desinstalar', fn: trabajoApp });
  };
  ASKS['tienda.cancelar'] = async () => {
    cancelando = true;
    const pendientes = cola.splice(0);
    for (const j of pendientes) { emitir(j.id, 'error', null, 'Cancelado', { accion: j.accion, nombre: j.nombre }); j.resolve({ ok: false, error: 'Cancelado' }); }
    if (proceso && !proceso.killed) {
      try { if (WIN) execFile('taskkill', ['/pid', String(proceso.pid), '/t', '/f'], { windowsHide: true }, () => {}); else proceso.kill('SIGTERM'); } catch {}
    }
    if (!ocupado) cancelando = false;
    return { ok: true, cancelados: pendientes.length };
  };
  ASKS['tienda.actualizables'] = () => actualizables();
  ASKS['tienda.actualizar'] = async (ref, nombre) => {
    // ref: id del catalogo o "winget:Id" / "flatpak:Id" / "apt:paquete"
    await detectar();
    let r = String(ref), a = porId.get(r);
    if (a) { const f = fuenteDe(a); if (!f) return { ok: false, error: 'No disponible' }; r = f.tipo + ':' + f.id; }
    return encolar({ id: a ? a.id : r, ref: r, nombre: a ? a.nombre : nombre || r.split(':').slice(1).join(':'), accion: 'actualizar', fn: trabajoActualizarUna });
  };
  ASKS['tienda.actualizarTodo'] = () => encolar({ id: '*todo', nombre: 'Todas las apps', accion: 'actualizarTodo', fn: trabajoActualizarTodo });
  ASKS['tienda.abrir'] = (id) => abrir(id);

  // Paquetes .umbra
  ASKS['tienda.leerPaquete'] = (ruta) => { try { return paquete.leer(ruta); } catch (e) { return { error: e.message }; } };
  ASKS['tienda.instalarPaquete'] = async (ruta) => {
    let info;
    try { info = paquete.leer(ruta); } catch (e) { return { ok: false, error: e.message }; }
    const id = 'umbra:' + info.manifiesto.id;
    return encolar({
      id, nombre: info.manifiesto.nombre, accion: 'instalar',
      fn: async (job) => {
        emitir(id, 'instalando', 0, 'Preparando…', { accion: 'instalar', nombre: job.nombre });
        const r = await paquete.instalar(ruta, { simular, alProgreso: (pct, msg) => progreso(id, 'instalando', pct, msg, { accion: 'instalar', nombre: job.nombre }) });
        return { ...r, mensaje: 'Instalada' };
      }
    });
  };
  ASKS['tienda.paquetes'] = () => paquete.instalados();
  ASKS['tienda.crearPaquete'] = (carpeta, salida) => { try { return paquete.crear(carpeta, salida); } catch (e) { return { error: e.message }; } };

  CMDS['tienda.web'] = (id) => { const a = porId.get(id); if (a && a.enlace && shell) shell.openExternal(a.enlace); };
  CMDS['tienda.refrescar'] = () => { invalidar(); menuInicio = null; };

  // Calienta la deteccion en segundo plano para que la primera apertura sea rapida.
  setTimeout(() => { instalados().catch((e) => L('deteccion', e && e.message)); }, 1500);

  return { catalogo, instalados, actualizables, abrir, invalidar, tablaWinget, APPS };
};
