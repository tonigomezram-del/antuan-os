// Modo Juego Antuan: optimiza mientras juegas y lo deshace todo al salir.
// Solo cambios reales y reversibles; nada de "trucos" que no hacen nada.
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const koffi = require('koffi');

const LINUX = process.platform === 'linux';
const run = (file, args, opts = {}) => new Promise((res) => execFile(file, args, { windowsHide: true, timeout: 15000, ...opts }, (e, out) => res(e ? null : String(out))));
const ps = (script) => run('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', Buffer.from('[Console]::OutputEncoding=[Text.Encoding]::UTF8;' + script, 'utf16le').toString('base64')]);
// El registro de Windows no existe en Antuan OS: alli estas optimizaciones las hace gamemode.
const reg = (args) => (LINUX ? Promise.resolve(null) : run('reg.exe', args));

let OpenProcess, CloseHandle, SetPriorityClass, GetPriorityClass;
if (!LINUX) {
  const kernel32 = koffi.load('kernel32.dll');
  OpenProcess = kernel32.func('void * __stdcall OpenProcess(uint32 access, bool inherit, uint32 pid)');
  CloseHandle = kernel32.func('bool __stdcall CloseHandle(void *h)');
  SetPriorityClass = kernel32.func('bool __stdcall SetPriorityClass(void *h, uint32 cls)');
  GetPriorityClass = kernel32.func('uint32 __stdcall GetPriorityClass(void *h)');
}

function setPriority(pid, high) {
  if (LINUX) {
    // gamemode sube la prioridad del juego (sin necesitar permisos de administrador)
    // -r<PID> (pegado): con un espacio gamemoded se quedaria esperando para si mismo
    execFile('gamemoded', ['-r' + Number(pid)], () => { });
    return 0;
  }
  const h = OpenProcess(0x0200 | 0x0400, false, pid); // SET_INFORMATION | QUERY_INFORMATION
  if (!h) return null;
  try { const before = GetPriorityClass(h); SetPriorityClass(h, high ? 0x80 : 0x20); return before; } finally { CloseHandle(h); }
}

// Procesos en marcha con su ruta
async function processList() {
  if (LINUX) {
    const out = [];
    for (const d of fs.readdirSync('/proc')) {
      if (!/^\d+$/.test(d)) continue;
      try { const p = fs.readlinkSync(`/proc/${d}/exe`); out.push({ pid: +d, name: path.basename(p).toLowerCase(), path: p }); } catch { }
    }
    return out;
  }
  const out = await ps('Get-Process | Where-Object { $_.Path } | Select-Object Id,ProcessName,Path | ConvertTo-Json -Compress');
  try { return [].concat(JSON.parse(out || '[]')).map((p) => ({ pid: p.Id, name: (p.ProcessName + '.exe').toLowerCase(), path: p.Path })); } catch { return []; }
}

const ONEDRIVE = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'OneDrive', 'OneDrive.exe');
const ONEDRIVE2 = 'C:\\Program Files\\Microsoft OneDrive\\OneDrive.exe';

class ModoJuego {
  constructor({ sis, log, notify }) {
    this.sis = sis; this.log = log; this.notify = notify;
    this.activo = null;   // { juego, pid, deshacer: [] }
    this.vigilancia = null;
  }

  // Comprobaciones previas: lo que mas rendimiento quita sin que lo sepas.
  async revisar() {
    const avisos = [];
    const [pw, rf, bat] = await Promise.all([this.sis.json('power?'), this.sis.json('refresh?'), this.sis.json('battery?')]);
    if (bat && bat.ok && bat.present && !bat.ac) avisos.push({ nivel: 'alto', texto: 'Estás con batería: enchufa el cargador. El portátil limita mucho la potencia sin él.' });
    if (rf && rf.ok && rf.max > rf.current) avisos.push({ nivel: 'alto', texto: `Tu pantalla va a ${rf.current} Hz pero admite ${rf.max} Hz.`, ...(LINUX ? {} : { accion: 'ms-settings:display-advanced' }) });
    if (pw && pw.ok && pw.mode !== 'rendimiento') avisos.push({ nivel: 'medio', texto: 'El modo de energía no es "Rendimiento" (Antuan lo cambia al jugar).' });
    const libre = os.freemem() / os.totalmem();
    if (libre < .15) avisos.push({ nivel: 'medio', texto: `Te queda poca RAM libre (${Math.round(libre * 100)} %). Cierra apps pesadas antes de jugar.` });
    const dvr = await reg(['query', 'HKCU\\System\\GameConfigStore', '/v', 'GameDVR_Enabled']);
    if (dvr && /0x1/.test(dvr)) avisos.push({ nivel: 'medio', texto: 'La grabación en segundo plano de Xbox Game Bar está activa (Antuan la apaga al jugar).' });
    return avisos;
  }

  async activar(juego, opciones = {}) {
    if (this.activo) await this.desactivar();
    const o = Object.assign({ energia: true, gpu: true, prioridad: true, onedrive: true, grabacion: true, cerrar: [] }, opciones);
    const deshacer = [];
    const hechos = [];

    if (o.energia) {
      const antes = await this.sis.json('power?');
      const r = await this.sis.json('power-set rendimiento');
      if (r && r.ok) { hechos.push('Energía al máximo'); if (antes && antes.ok && antes.mode !== 'rendimiento') deshacer.push(() => this.sis.json('power-set ' + antes.mode)); }
    }
    // GPU por app, grabacion de Xbox y OneDrive solo existen en Windows (en Antuan OS lo cubre gamemode)
    if (o.gpu && juego.exe && !LINUX) {
      // Preferencia de GPU de alto rendimiento para este juego (igual que en Ajustes > Graficos)
      await reg(['add', 'HKCU\\Software\\Microsoft\\DirectX\\UserGpuPreferences', '/v', juego.exe, '/t', 'REG_SZ', '/d', 'GpuPreference=2;', '/f']);
      hechos.push('GPU de alto rendimiento');
    }
    if (o.grabacion && !LINUX) {
      const q = await reg(['query', 'HKCU\\System\\GameConfigStore', '/v', 'GameDVR_Enabled']);
      if (q && /0x1/.test(q)) {
        await reg(['add', 'HKCU\\System\\GameConfigStore', '/v', 'GameDVR_Enabled', '/t', 'REG_DWORD', '/d', '0', '/f']);
        await reg(['add', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\GameDVR', '/v', 'AppCaptureEnabled', '/t', 'REG_DWORD', '/d', '0', '/f']);
        deshacer.push(() => reg(['add', 'HKCU\\System\\GameConfigStore', '/v', 'GameDVR_Enabled', '/t', 'REG_DWORD', '/d', '1', '/f']));
        deshacer.push(() => reg(['add', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\GameDVR', '/v', 'AppCaptureEnabled', '/t', 'REG_DWORD', '/d', '1', '/f']));
        hechos.push('Grabación de fondo apagada');
      }
    }
    const procs = await processList();
    if (o.onedrive && !LINUX && procs.some((p) => p.name === 'onedrive.exe')) {
      const exe = fs.existsSync(ONEDRIVE) ? ONEDRIVE : ONEDRIVE2;
      await run(exe, ['/shutdown']);
      deshacer.push(() => run(exe, ['/background']));
      hechos.push('OneDrive en pausa');
    }
    for (const nombre of o.cerrar || []) {
      const vivos = procs.filter((p) => p.name === nombre.toLowerCase());
      if (vivos.length) { if (LINUX) vivos.forEach((p) => { try { process.kill(p.pid, 'SIGTERM'); } catch { } }); else await run('taskkill.exe', ['/IM', nombre]); hechos.push('Cerrado ' + nombre.replace(/\.exe$/i, '')); }
    }
    this.activo = { juego, pid: null, deshacer, hechos, inicio: Date.now(), opciones: o };
    this.log && this.log('modo juego', juego.nombre, hechos.join(', '));
    this.vigilar();
    return hechos;
  }

  // Espera a que arranque el proceso del juego (prioridad alta) y detecta cuando se cierra.
  vigilar() {
    clearInterval(this.vigilancia);
    let visto = false, ausente = 0;
    this.vigilancia = setInterval(async () => {
      if (!this.activo) return clearInterval(this.vigilancia);
      const j = this.activo.juego;
      const nombres = new Set((j.procesos || []).map((p) => p.toLowerCase()).concat(j.exe ? [path.basename(j.exe).toLowerCase()] : []));
      const procs = await processList();
      const vivo = procs.find((p) => nombres.has(p.name) || (j.carpeta && p.path && p.path.toLowerCase().startsWith(j.carpeta.toLowerCase())));
      if (vivo) {
        ausente = 0;
        if (!visto) {
          visto = true; this.activo.pid = vivo.pid;
          if (this.activo.opciones.prioridad) {
            const antes = setPriority(vivo.pid, true);
            if (antes !== null) this.activo.hechos.push('Prioridad alta');
          }
          this.notify && this.notify('game', `Modo Juego activo · ${j.nombre}`);
        }
      } else if (visto || Date.now() - this.activo.inicio > 180000) {
        // Cerrado el juego (o no llego a arrancar en 3 min): se deshace todo.
        if (++ausente >= 2) await this.desactivar(true);
      }
    }, 5000);
  }

  async desactivar(avisar) {
    clearInterval(this.vigilancia);
    if (!this.activo) return;
    const a = this.activo; this.activo = null;
    for (const fn of a.deshacer.reverse()) { try { await fn(); } catch { } }
    if (avisar && this.notify) this.notify('game', `Modo Juego terminado · ${a.juego.nombre} (${Math.round((Date.now() - a.inicio) / 60000)} min)`);
  }

  estado() { return this.activo ? { juego: this.activo.juego.nombre, id: this.activo.juego.id, hechos: this.activo.hechos, desde: this.activo.inicio, pid: this.activo.pid } : null; }
}

// Servidores a los que esta conectado el juego (TCP); UDP no expone destino sin permisos de administrador.
async function servidoresDe(pid) {
  if (!pid) return [];
  if (LINUX) return servidoresLinux(pid);
  const out = await ps(`Get-NetTCPConnection -OwningProcess ${Number(pid)} -State Established -ErrorAction SilentlyContinue | Select-Object RemoteAddress,RemotePort | ConvertTo-Json -Compress`);
  let list = [];
  try { list = [].concat(JSON.parse(out || '[]')); } catch { }
  const priv = /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1|fe80|0\.0\.0\.0)/i;
  const seen = new Set();
  return list.filter((c) => c && c.RemoteAddress && !priv.test(c.RemoteAddress) && !seen.has(c.RemoteAddress) && seen.add(c.RemoteAddress))
    .map((c) => ({ ip: c.RemoteAddress, puerto: c.RemotePort }));
}

// Antuan OS: ss (iproute2) lista las conexiones TCP establecidas del proceso
async function servidoresLinux(pid) {
  const out = await run('ss', ['-Htnp', 'state', 'established']);
  const priv = /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1|fe80|0\.0\.0\.0|\[::1\])/i, seen = new Set(), res = [];
  for (const l of String(out || '').split('\n')) {
    if (!l.includes('pid=' + Number(pid) + ',')) continue;
    const m = /\s(\S+):(\d+)\s+users:/.exec(l); if (!m) continue;
    const ip = m[1].replace(/^\[|\]$/g, '').replace(/^::ffff:/, '');
    if (priv.test(ip) || seen.has(ip)) continue;
    seen.add(ip); res.push({ ip, puerto: +m[2] });
  }
  return res;
}

// Cloudflare WARP (tunel gratuito) si esta instalado: permite comparar ruta directa vs tunel.
const WARP = LINUX ? '/usr/bin/warp-cli' : 'C:\\Program Files\\Cloudflare\\Cloudflare WARP\\warp-cli.exe';
async function warp(accion) {
  if (!fs.existsSync(WARP)) return { instalado: false };
  if (accion === 'conectar') await run(WARP, ['connect']);
  if (accion === 'desconectar') await run(WARP, ['disconnect']);
  const st = await run(WARP, ['status']);
  return { instalado: true, conectado: /Connected/i.test(st || '') && !/Disconnected/i.test(st || ''), estado: (st || '').trim() };
}

module.exports = { ModoJuego, servidoresDe, warp, processList };
