// Gestion del PC en Antuan OS. Misma API que gestion.js (Windows).
const { execFile } = require('child_process');
const fs = require('fs');
const fsp = require('fs/promises');
const os = require('os');
const path = require('path');

const run = (cmd, args, t = 8000) => new Promise((res) => execFile(cmd, args, { timeout: t, encoding: 'utf8', maxBuffer: 16 << 20 }, (e, out) => res(e && !out ? '' : String(out || ''))));
const HOME = os.homedir();

function cpuTimes() { return os.cpus().reduce((a, c) => { const t = c.times; a.busy += t.user + t.nice + t.sys + t.irq; a.idle += t.idle; return a; }, { busy: 0, idle: 0 }); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function rendimiento() {
  const a = cpuTimes(); await sleep(500); const b = cpuTimes();
  const cpu = Math.round((b.busy - a.busy) / Math.max(1, (b.busy - a.busy) + (b.idle - a.idle)) * 1000) / 10;
  const tot = os.totalmem(), free = os.freemem();
  // Top de procesos por CPU y memoria
  const ps = await run('ps', ['-eo', 'pid,comm,%cpu,rss', '--sort=-%cpu', '--no-headers']);
  const procesos = ps.split('\n').filter(Boolean).slice(0, 40).map((l) => { const [pid, nombre, c, rss] = l.trim().split(/\s+/); return { pid: +pid, nombre, cpu: +c, ramMB: Math.round(+rss / 1024) }; })
    .sort((x, y) => (y.cpu + y.ramMB / 50) - (x.cpu + x.ramMB / 50)).slice(0, 12);
  let temperatura = null;
  try { for (const z of fs.readdirSync('/sys/class/thermal')) { if (!z.startsWith('thermal_zone')) continue; const t = +fs.readFileSync(`/sys/class/thermal/${z}/temp`, 'utf8') / 1000; if (t > 0 && (temperatura === null || t > temperatura)) temperatura = t; } } catch { }
  let gpu = null;
  try { const g = fs.readdirSync('/sys/class/drm').find((d) => /^card\d+$/.test(d) && fs.existsSync(`/sys/class/drm/${d}/device/gpu_busy_percent`)); if (g) gpu = +fs.readFileSync(`/sys/class/drm/${g}/device/gpu_busy_percent`, 'utf8'); } catch { }
  return { cpu, ram: { usadaGB: +((tot - free) / 1073741824).toFixed(1), totalGB: +(tot / 1073741824).toFixed(1), pct: Math.round((tot - free) / tot * 1000) / 10 }, gpu, discoActividad: null, temperatura, procesos };
}

async function cerrarProceso(pid) {
  if (!pid || pid <= 1 || pid === process.pid) return { ok: false, error: 'No permitido' };
  try { process.kill(pid, 'SIGTERM'); } catch (e) { return { ok: false, error: e.code }; }
  await sleep(2000);
  try { process.kill(pid, 0); process.kill(pid, 'SIGKILL'); return { ok: true, forzado: true }; } catch { return { ok: true }; }
}

// Apps al inicio: ~/.config/autostart y /etc/xdg/autostart (se desactivan con Hidden=true en la copia del usuario)
async function appsInicio() {
  const out = [];
  for (const [dir, origen] of [[path.join(HOME, '.config/autostart'), 'usuario'], ['/etc/xdg/autostart', 'sistema']]) {
    let files = []; try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.desktop')); } catch { }
    for (const f of files) {
      const t = fs.readFileSync(path.join(dir, f), 'utf8');
      const g = (k) => ((new RegExp('^' + k + '=(.*)$', 'm')).exec(t) || [])[1];
      if (g('NoDisplay') === 'true' || (g('OnlyShowIn') && !/Umbra/.test(g('OnlyShowIn')))) continue;
      const user = path.join(HOME, '.config/autostart', f);
      const ut = fs.existsSync(user) ? fs.readFileSync(user, 'utf8') : '';
      if (origen === 'sistema' && out.some((x) => x.id === f)) continue;
      out.push({ id: f, nombre: g('Name') || f, comando: g('Exec') || '', origen, activa: !/^Hidden=true/m.test(ut || t), editable: true, ruta: g('Exec') || '' });
    }
  }
  return out;
}
async function cambiarInicio(id, activa) {
  const user = path.join(HOME, '.config/autostart', id);
  let t = '';
  try { t = fs.readFileSync(user, 'utf8'); } catch { try { t = fs.readFileSync(path.join('/etc/xdg/autostart', id), 'utf8'); } catch { return { ok: false, error: 'No existe' }; } }
  t = t.replace(/^Hidden=.*\n?/m, '');
  if (!activa) t = t.replace(/\[Desktop Entry\]\n?/, '[Desktop Entry]\nHidden=true\n');
  fs.mkdirSync(path.dirname(user), { recursive: true });
  fs.writeFileSync(user, t);
  return { ok: true };
}

async function tamano(dir, limite = 3000) {
  const fin = Date.now() + limite; let total = 0;
  async function walk(d) {
    if (Date.now() > fin) return;
    let ents = []; try { ents = await fsp.readdir(d, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      const p = path.join(d, e.name);
      if (e.isSymbolicLink()) continue;
      if (e.isDirectory()) await walk(p); else { try { total += (await fsp.stat(p)).size; } catch { } }
    }
  }
  await walk(dir);
  return Math.round(total / 1048576);
}
async function almacenamiento() {
  const df = await run('df', ['-B1', '--output=target,size,avail', '-x', 'tmpfs', '-x', 'devtmpfs', '-x', 'squashfs', '-x', 'overlay']);
  const unidades = df.split('\n').slice(1).filter(Boolean).map((l) => { const [m, s, a] = l.trim().split(/\s+/); return { letra: m, nombre: m === '/' ? 'Sistema' : path.basename(m), totalGB: +(s / 1e9).toFixed(1), libreGB: +(a / 1e9).toFixed(1), pct: Math.round((1 - a / s) * 100) }; })
    .filter((u) => u.totalGB > 1 && !/^\/(boot|snap)/.test(u.letra));
  const [cache, papelera, temp] = await Promise.all([tamano(path.join(HOME, '.cache')), tamano(path.join(HOME, '.local/share/Trash')), tamano(os.tmpdir(), 1500)]);
  return { unidades, limpiable: { temporalesMB: temp, papeleraMB: papelera, cacheMinMB: cache } };
}
async function vaciar(dir, haceMs = 0) {
  let liberado = 0, errores = 0;
  let ents = []; try { ents = await fsp.readdir(dir, { withFileTypes: true }); } catch { return { liberado, errores }; }
  for (const e of ents) {
    const p = path.join(dir, e.name);
    try {
      const st = await fsp.stat(p);
      if (haceMs && Date.now() - st.mtimeMs < haceMs) continue;
      const mb = e.isDirectory() ? await tamano(p, 1500) : st.size / 1048576;
      await fsp.rm(p, { recursive: true, force: true }); liberado += mb;
    } catch { errores++; }
  }
  return { liberado, errores };
}
async function limpiar(o = {}) {
  let liberado = 0, errores = 0;
  const sum = (r) => { liberado += r.liberado; errores += r.errores; };
  if (o.temporales) sum(await vaciar(os.tmpdir(), 3600000));
  if (o.cache) sum(await vaciar(path.join(HOME, '.cache'), 3600000));
  if (o.papelera) { sum(await vaciar(path.join(HOME, '.local/share/Trash/files'))); await vaciar(path.join(HOME, '.local/share/Trash/info')); }
  return { liberadoMB: Math.round(liberado), errores };
}
async function archivosGrandes(limite = 20) {
  const out = [], fin = Date.now() + 7000;
  async function walk(d, depth) {
    if (Date.now() > fin || depth > 8) return;
    let ents = []; try { ents = await fsp.readdir(d, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      if (e.name.startsWith('.') || e.isSymbolicLink()) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) await walk(p, depth + 1);
      else { try { const s = await fsp.stat(p); if (s.size > 300 * 1048576) out.push({ ruta: p, nombre: e.name, MB: Math.round(s.size / 1048576), modificado: s.mtime.toISOString() }); } catch { } }
    }
  }
  await walk(HOME, 0);
  return out.sort((a, b) => b.MB - a.MB).slice(0, limite);
}
async function actualizaciones() {
  const o = await run('apt', ['list', '--upgradable'], 15000);
  const pendientes = o.split('\n').filter((l) => l.includes('/')).map((l) => ({ titulo: l.split('/')[0], KB: null, tamanoMB: null, descargada: false }));
  const fl = await run('flatpak', ['remote-ls', '--updates', '--columns=name'], 15000);
  for (const n of fl.split('\n').filter(Boolean)) pendientes.push({ titulo: n + ' (app)', KB: null, tamanoMB: null });
  return { pendientes, reinicioPendiente: fs.existsSync('/var/run/reboot-required'), horasActivas: null, pausadoHasta: null };
}
// En Antuan OS las actualizaciones nunca reinician solas: estas funciones devuelven una orden informativa.
const comandoProteccionReinicios = () => 'true';
const pausarActualizaciones = () => 'true';

async function red() {
  const o = await run('nmcli', ['-t', '-f', 'TYPE,STATE,CONNECTION,DEVICE', 'device']);
  const act = o.split('\n').map((l) => l.split(':')).find((p) => p[1] === 'connected' && (p[0] === 'wifi' || p[0] === 'ethernet'));
  if (!act) return { tipo: null };
  const ip = Object.values(os.networkInterfaces()).flat().find((i) => i && i.family === 'IPv4' && !i.internal);
  const gw = /default via (\S+)/.exec(await run('ip', ['route']));
  const dns = (await run('nmcli', ['-t', '-f', 'IP4.DNS', 'device', 'show', act[3]])).split('\n').map((l) => l.split(':')[1]).filter(Boolean);
  const r = { tipo: act[0], ssid: act[0] === 'wifi' ? act[2] : null, senal: null, banda: null, ip: ip && ip.address, puerta: gw && gw[1], dns };
  if (act[0] === 'wifi') {
    const w = (await run('nmcli', ['-t', '-f', 'ACTIVE,SIGNAL,FREQ', 'dev', 'wifi'])).split('\n').find((l) => l.startsWith('yes') || l.startsWith('sí'));
    if (w) { const [, s, f] = w.split(':'); r.senal = +s; r.banda = +parseInt(f) >= 5900 ? '6 GHz' : +parseInt(f) >= 5000 ? '5 GHz' : '2.4 GHz'; }
  }
  return r;
}
async function redesWifi() {
  const o = await run('nmcli', ['-t', '-f', 'SSID,SIGNAL,SECURITY', 'dev', 'wifi', 'list']);
  const known = new Set((await run('nmcli', ['-t', '-f', 'NAME', 'connection'])).split('\n').filter(Boolean));
  const seen = new Set();
  return o.split('\n').map((l) => l.split(':')).filter((p) => p[0] && !seen.has(p[0]) && seen.add(p[0])).map(([ssid, s, sec]) => ({ ssid, senal: +s, segura: !!sec && sec !== '--', conocida: known.has(ssid) }));
}
async function conectarWifi(ssid) { const o = await run('nmcli', ['connection', 'up', 'id', ssid], 20000); return o ? { ok: true } : { ok: false, sinPerfil: true }; }
// Red nueva: NetworkManager crea el perfil (la contraseña va como argumento, nunca por la consola)
function conectarWifiNueva(ssid, clave = '') {
  if (typeof ssid !== 'string' || !ssid) return { ok: false, error: 'Red no válida' };
  const args = ['device', 'wifi', 'connect', ssid];
  if (clave) args.push('password', String(clave));
  return new Promise((res) => execFile('nmcli', args, { timeout: 30000, encoding: 'utf8' }, (e, out, err) =>
    res(e ? { ok: false, error: /secrets|password|contrase/i.test(String(err || '')) ? 'Contraseña incorrecta' : 'No se pudo conectar' } : { ok: true })));
}

async function ping(host, n = 4) {
  if (!/^[\w.:-]+$/.test(String(host))) return { min: null, media: null, max: null, perdida: 100 };
  const o = await run('ping', ['-c', String(n), '-i', '0.3', '-W', '2', host], (n + 3) * 2000);
  const loss = /(\d+(?:\.\d+)?)% packet loss/.exec(o), rtt = /= ([\d.]+)\/([\d.]+)\/([\d.]+)/.exec(o);
  return { min: rtt ? Math.round(+rtt[1]) : null, media: rtt ? Math.round(+rtt[2]) : null, max: rtt ? Math.round(+rtt[3]) : null, perdida: loss ? Math.round(+loss[1]) : 100 };
}
async function rutaHasta(host) {
  if (!/^[\w.:-]+$/.test(String(host))) return [];
  const o = await run('tracepath', ['-n', '-m', '20', host], 25000);
  const out = [];
  for (const l of o.split('\n')) {
    const m = /^\s*(\d+)\??:\s+(\S+)\s+([\d.]+)ms/.exec(l);
    if (m && !out.some((x) => x.salto === +m[1])) out.push({ salto: +m[1], ip: m[2] === 'no' ? null : m[2], ms: +m[3] });
    else { const n = /^\s*(\d+):\s+no reply/.exec(l); if (n && !out.some((x) => x.salto === +n[1])) out.push({ salto: +n[1], ip: null, ms: null }); }
  }
  return out;
}

module.exports = { rendimiento, cerrarProceso, appsInicio, cambiarInicio, almacenamiento, limpiar, archivosGrandes, actualizaciones,
  comandoProteccionReinicios, pausarActualizaciones, red, redesWifi, conectarWifi, conectarWifiNueva, ping, rutaHasta };
