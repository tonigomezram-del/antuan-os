// Antuan AI: un modelo de IA que corre en el propio PC (Ollama), gratis y sin limites, y que maneja el sistema
// con herramientas: apps, ventanas, ajustes, archivos, terminal, teclado, volumen, brillo y energia.
// Lo peligroso (borrar, instalar, apagar, ser administrador...) se pregunta antes en el widget.
const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { spawn, execFile } = require('child_process');
const { ipcMain, shell } = require('electron');

const LINUX = process.platform === 'linux';
const OLLAMA = { host: '127.0.0.1', port: 11434 };

// Modelos sin "modo pensar" (contestan directamente): Qwen 3 4B Instruct y Qwen 2.5. En Antuan OS lo elige la
// actualizacion segun la memoria y la grafica; esto es solo para Windows o si falta ese dato.
function modeloPorMemoria() {
  const gb = os.totalmem() / 2 ** 30;
  return gb >= 5 ? 'qwen2.5:1.5b' : 'qwen2.5:0.5b';
}
// Qwen 3 "normal" (hibrido) razona en voz alta antes de contestar: se le apaga con think:false y con /no_think
const hibrido = (m) => /^qwen3:(?!.*instruct)/.test(m);

// Nombre que se ensena al usuario y lo que ocupa (para saber que se va a descargar)
const FICHAS = {
  'qwen3:8b': ['Qwen 3 8B', '5,2 GB'], 'qwen3:4b-instruct': ['Qwen 3 4B Instruct', '2,5 GB'], 'qwen2.5:3b': ['Qwen 2.5 3B', '1,9 GB'],
  'qwen2.5:1.5b': ['Qwen 2.5 1.5B', '1 GB'], 'qwen2.5:0.5b': ['Qwen 2.5 0.5B', '0,4 GB'],
  'qwen3:4b': ['Qwen 3 4B', '2,6 GB'], 'qwen3:1.7b': ['Qwen 3 1.7B', '1,4 GB'], 'qwen3:0.6b': ['Qwen 3 0.6B', '0,5 GB']
};
function ficha(m) {
  const [nombre, peso] = FICHAS[m] || [m, ''];
  return { modelo: m, nombre, peso, ram: Math.round(os.totalmem() / 2 ** 30) };
}

let ctx = null;                // lo que pasa main.js: config, catalogo, ventanas, sistema, buscador, envio al escritorio
let historial = [];
let ocupado = false, cancelar = null, descargando = null;
const pendientes = new Map();   // confirmaciones esperando al usuario

// En Antuan OS la actualizacion elige el modelo, lo descarga y deja aqui el progreso
const DIR_IA = '/var/lib/antuan-ia';
const leer = (f) => { try { return fs.readFileSync(path.join(DIR_IA, f), 'utf8').trim(); } catch { return ''; } };
const modelo = () => (ctx.config().iaModelo || (LINUX && leer('modelo')) || modeloPorMemoria());
// Progreso de la descarga que lanzo la actualizacion (ultima linea de /api/pull), o null si no hay ninguna en marcha
function descargaDeActualizacion() {
  if (!LINUX) return null;
  const t = leer('progreso.json'); if (!t) return null;
  let l; try { l = JSON.parse(t); } catch { return null; }
  if (l.error) return { error: l.error };
  if (l.status === 'success') return null;
  let viejo = true; try { viejo = Date.now() - fs.statSync(path.join(DIR_IA, 'progreso.json')).mtimeMs > 180000; } catch { }
  if (viejo) return null;   // se corto sin avisar (apagaste el PC, por ejemplo)
  return l.total
    ? { progreso: Math.round(l.completed / l.total * 100) || 0, texto: `Descargando ${ficha(modelo()).nombre}: ${((l.completed || 0) / 2 ** 30).toFixed(1)} de ${(l.total / 2 ** 30).toFixed(1)} GB` }
    : { progreso: 0, texto: l.status === 'esperando al motor' ? 'Arrancando el motor de IA…' : 'Preparando la descarga…' };
}
const emitir = (tipo, datos = {}) => ctx.enviar('ia', Object.assign({ tipo }, datos));

// ---------------------------------------------------------------- Ollama
function peticion(ruta, cuerpo, alLinea, { timeout = 0, parable = false } = {}) {
  return new Promise((resolve, reject) => {
    const datos = cuerpo ? JSON.stringify(cuerpo) : null;
    let fallo = null;
    // cada linea es un JSON; si quien la recibe falla, se corta la peticion con ese error
    const linea = (l) => { let o; try { o = JSON.parse(l); } catch { return; } try { alLinea(o); } catch (e) { fallo = e; req.destroy(e); } };
    const req = http.request({ ...OLLAMA, path: ruta, method: datos ? 'POST' : 'GET', headers: datos ? { 'Content-Type': 'application/json' } : {} }, (r) => {
      r.setEncoding('utf8');
      let buf = '', todo = '';
      r.on('data', (c) => {
        if (!alLinea || r.statusCode >= 400) { todo += c; return; }
        buf += c; let i;
        while (!fallo && (i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (l) linea(l); }
      });
      r.on('end', () => {
        if (fallo) return reject(fallo);
        if (r.statusCode >= 400) { let m = todo; try { m = JSON.parse(todo).error || todo; } catch { } return reject(new Error(m || 'Error ' + r.statusCode)); }
        if (alLinea) { if (buf.trim()) linea(buf.trim()); return fallo ? reject(fallo) : resolve(); }
        try { resolve(JSON.parse(todo)); } catch { resolve(todo); }
      });
    });
    if (timeout) req.setTimeout(timeout, () => req.destroy(new Error('Sin respuesta')));
    req.on('error', reject);
    if (datos) req.write(datos);
    req.end();
    if (parable) cancelar = () => req.destroy(new Error('cancelado'));
  });
}

const ollamaInstalado = () => LINUX
  ? ['/usr/local/bin/ollama', '/usr/bin/ollama'].some((f) => fs.existsSync(f))
  : fs.existsSync(path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Ollama', 'ollama.exe'));

async function estado() {
  const m = modelo();
  if (descargando) return { estado: 'descargando', ...ficha(m), ...descargando };
  let tags = null;
  try { tags = await peticion('/api/tags', null, null, { timeout: 2500 }); } catch { }
  if (!tags) {
    // instalado pero parado (en Windows no siempre arranca solo): se intenta arrancar
    if (ollamaInstalado()) { arrancarOllama(); return { estado: 'arrancando', ...ficha(m) }; }
    return { estado: 'sin-ollama', ...ficha(m), linux: LINUX };
  }
  const tiene = (tags.models || []).some((x) => x.name === m || x.name === m + ':latest');
  if (!tiene) {
    // lo normal: lo esta bajando la actualizacion. Si no hay ninguna descarga en marcha, la empieza el widget (no pide contrasena)
    const act = descargaDeActualizacion();
    if (act && act.error) return { estado: 'error', ...ficha(m), texto: act.error };
    if (act) return { estado: 'descargando', ...ficha(m), ...act };
    descargar(); return { estado: 'descargando', ...ficha(m), ...(descargando || {}) };
  }
  if (!calentado) precalentar();
  return { estado: 'listo', ...ficha(m) };
}

let arrancado = 0;
function arrancarOllama() {
  if (Date.now() - arrancado < 15000) return; arrancado = Date.now();
  const exe = LINUX ? 'ollama' : path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Ollama', 'ollama.exe');
  try { const p = spawn(exe, ['serve'], { detached: true, stdio: 'ignore', windowsHide: true }); p.on('error', () => { }); p.unref(); } catch { }
}

// El modelo se baja solo la primera vez (unos GB), con el progreso en el widget
function descargar() {
  if (descargando) return;
  descargando = { progreso: 0, texto: 'Preparando…' };
  const m = modelo();
  peticion('/api/pull', { model: m, stream: true }, (l) => {
    if (l.error) throw new Error(l.error);
    if (l.total) descargando = { progreso: Math.round(l.completed / l.total * 100) || 0, texto: `Descargando ${ficha(m).nombre}: ${(l.completed / 2 ** 30).toFixed(1)} de ${(l.total / 2 ** 30).toFixed(1)} GB` };
    else descargando = { progreso: descargando.progreso, texto: l.status || '…' };
    emitir('estado', { estado: 'descargando', ...ficha(m), ...descargando });
  }).then(() => { descargando = null; emitir('estado', { estado: 'listo', recien: true, ...ficha(m) }); precalentar(); })
    .catch((e) => { descargando = null; emitir('estado', { estado: 'error', ...ficha(m), texto: 'No se pudo descargar el modelo: ' + e.message }); });
}

function instalarOllama() {
  // Linux: la actualizacion de Antuan, que instala el motor y descarga el modelo (pide la contrasena y reinicia el escritorio).
  // Windows: winget instala Ollama y el widget baja el modelo.
  const p = LINUX
    ? spawn('pkexec', ['bash', '-c', 'curl -fsSL https://raw.githubusercontent.com/tonigomezram-del/antuan-os/main/actualizar.sh | bash'], { stdio: 'ignore' })
    : spawn('winget', ['install', '-e', '--id', 'Ollama.Ollama', '--accept-source-agreements', '--accept-package-agreements'], { stdio: 'ignore', windowsHide: true });
  p.on('error', () => emitir('estado', { estado: 'error', texto: 'No se pudo lanzar el instalador' }));
  p.on('exit', (c) => {
    if (c === 0) return estado().then((e) => emitir('estado', e));
    // pkexec: 126 = has cancelado la contrasena, 127 = contrasena incorrecta
    emitir('estado', { estado: 'error', texto: c === 126 || c === 127 ? 'No se ha puesto la contraseña. Vuelve a intentarlo.' : 'La instalación no terminó. Prueba desde Centro > Actualizaciones.' });
  });
  return true;
}

// ---------------------------------------------------------------- Herramientas
const sh = (cmd, timeout = 60000) => new Promise((resolve) => {
  const [exe, args] = LINUX ? ['bash', ['-lc', cmd]] : ['powershell.exe', ['-NoProfile', '-Command', cmd]];
  execFile(exe, args, { timeout, maxBuffer: 4 << 20, cwd: os.homedir(), windowsHide: true }, (e, out, err) => {
    resolve({ ok: !e, salida: String(out || '').slice(-3500), error: e ? String(err || e.message).slice(-1500) : undefined });
  });
});
const ruta = (r) => path.resolve(os.homedir(), String(r || '').replace(/^~(?=$|[\\/])/, os.homedir()));

// Lo que se pregunta antes de hacer: borrar, mover, permisos, instalar, matar procesos, apagar, administrador
const PELIGROSO = /(^|[\s;&|(`])(rm|rmdir|mv|dd|mkfs\S*|shred|wipefs|fdisk|parted|chmod|chown|kill|pkill|killall|reboot|shutdown|poweroff|halt|apt|apt-get|dpkg|flatpak|snap|pip|npm|sudo|pkexec|su|systemctl|truncate|crontab|Remove-Item|Stop-Process|winget|Format-\w+)\b|>|curl[^|]*\|\s*(ba)?sh/i;

function confirmar(texto) {
  return new Promise((resolve) => {
    const id = Math.random().toString(36).slice(2);
    const t = setTimeout(() => { pendientes.delete(id); resolve(false); }, 120000);
    pendientes.set(id, (si) => { clearTimeout(t); pendientes.delete(id); resolve(!!si); });
    emitir('confirmar', { id, texto });
  });
}

// Ajustes de Antuan que la IA puede cambiar (los mismos que el Centro)
const AJUSTES = {
  dockEstilo: ['liquido', 'barra', 'gota', 'clasico'], edge: ['bottom', 'left', 'right', 'top'], dockSize: 'número 32-80',
  magnify: 'true/false', liquidGlass: 'true/false', logoStyle: ['color', 'umbra', 'original'], accent: 'color #rrggbb',
  lgRefraccion: '0-300', lgCromatica: '0-30', lgDesenfoque: '0-60', lgTinte: '0-60', lgLupa: '0-50', lgForma: ['redondo', 'cuadrado'],
  keepAwake: 'true/false', desktop: 'true/false'
};

const HERRAMIENTAS = [
  // Descripciones cortas a proposito: en un PC sin grafica cada palabra de aqui se lee antes de contestar
  ['ejecutar_comando', LINUX ? 'Ejecuta un comando bash y devuelve la salida (para administrador: pkexec).' : 'Ejecuta un comando de PowerShell y devuelve la salida.', { comando: '' }, ['comando']],
  ['abrir_app', 'Abre una app instalada por su nombre.', { nombre: '' }, ['nombre']],
  ['controlar_ventana', 'Enfoca, minimiza, maximiza o cierra una ventana abierta, buscándola por su título.', { titulo: '', accion: ['enfocar', 'minimizar', 'maximizar', 'cerrar'] }, ['titulo', 'accion']],
  ['volumen', 'Pone el volumen (0-100) o lo silencia.', { nivel: '', silencio: ['true', 'false'] }, []],
  ['brillo', 'Pone el brillo de la pantalla (0-100).', { nivel: '' }, ['nivel']],
  ['cambiar_ajuste', 'Cambia un ajuste de Antuan: dockEstilo (liquido/barra/gota/clasico), edge (bottom/left/right/top), dockSize (32-80), liquidGlass, magnify, keepAwake (true/false), logoStyle (color/umbra/original), accent (#rrggbb).', { clave: '', valor: '' }, ['clave', 'valor']],
  ['buscar_archivos', 'Busca archivos y carpetas por nombre.', { texto: '' }, ['texto']],
  ['abrir', 'Abre un archivo, una carpeta o una web.', { destino: '' }, ['destino']],
  ...(LINUX ? [
    ['pulsar_teclas', 'Pulsa teclas en la ventana activa (como xdotool: ctrl+c, alt+F4, Return).', { teclas: '' }, ['teclas']],
    ['escribir_texto', 'Escribe texto en la ventana activa.', { texto: '' }, ['texto']]
  ] : []),
  ['energia', 'Bloquea, suspende, reinicia o apaga el PC.', { accion: ['bloquear', 'suspender', 'reiniciar', 'apagar'] }, ['accion']],
  ['buscar_info', 'Busca información sobre un tema en internet (Wikipedia), abre la página en el navegador y devuelve el texto.', { tema: '', navegador: ['predeterminado', 'chrome', 'firefox'] }, ['tema']],
  ['anadir_nota', 'Añade texto al widget de Notas. Con pegar_resultado=true pega lo último que encontró buscar_info.', { texto: '', pegar_resultado: ['true', 'false'] }, []],
  ['info_sistema', 'Estado del PC: memoria, disco, batería, red y lo que más gasta.', {}, []]
].map(([name, description, props, required]) => ({
  type: 'function',
  function: { name, description, parameters: { type: 'object', properties: Object.fromEntries(Object.entries(props).map(([k, d]) => [k, Array.isArray(d) ? { type: 'string', enum: d } : { type: 'string' }])), required } }
}));

const buscarApp = (nombre) => {
  const n = String(nombre || '').toLowerCase().trim();
  const propias = { tienda: 'umbra:tienda', centro: 'umbra:centro', ajustes: 'umbra:centro', configuracion: 'umbra:centro', configuración: 'umbra:centro', terminal: 'umbra:terminal' };
  if (propias[n]) return { id: propias[n], name: nombre };
  const lista = ctx.catalogo();
  const nom = (a) => String(a.display || a.name || '').toLowerCase();
  return lista.find((a) => nom(a) === n) || lista.find((a) => nom(a).startsWith(n)) || lista.find((a) => nom(a).includes(n));
};

async function usar(nombre, a = {}) {
  switch (nombre) {
    case 'ejecutar_comando': {
      const c = String(a.comando || '').trim(); if (!c) return { error: 'Falta el comando' };
      if (PELIGROSO.test(c) && !(await confirmar(`Ejecutar: ${c}`))) return { error: 'El usuario no lo ha permitido' };
      return sh(c);
    }
    case 'abrir_app': {
      const ap = buscarApp(a.nombre); if (!ap) return { error: 'No encuentro esa app instalada', apps_instaladas: ctx.catalogo().map((x) => x.display || x.name).filter(Boolean).slice(0, 60) };
      ipcMain.emit('launch', {}, ap.id); return { ok: true, abierta: ap.display || ap.name };
    }
    case 'listar_apps': {
      const f = String(a.filtro || '').toLowerCase();
      return { apps: ctx.catalogo().map((x) => x.display || x.name).filter((x) => x && x.toLowerCase().includes(f)).slice(0, 80) };
    }
    case 'listar_ventanas': return { ventanas: (await ctx.ventanas()).map((w) => ({ titulo: w.title, activa: w.active, minimizada: w.minimized })) };
    case 'controlar_ventana': {
      const t = String(a.titulo || '').toLowerCase();
      const ventanas = await ctx.ventanas();
      const w = ventanas.find((x) => `${x.title} ${x.exe} ${x.cls || ''}`.toLowerCase().includes(t));
      if (!w) return { error: 'No hay ninguna ventana así abierta', ventanas_abiertas: ventanas.map((x) => x.title) };
      const acc = { enfocar: 'focus', minimizar: 'minimize', cerrar: 'close', maximizar: 'maximize' }[String(a.accion).toLowerCase()];
      if (!acc) return { error: 'Acción no válida' };
      if (acc === 'maximize') {
        if (LINUX) { const hex = '0x' + Number(w.id).toString(16).padStart(8, '0'); execFile('wmctrl', ['-ir', hex, '-b', 'add,maximized_vert,maximized_horz'], () => { }); }
        else return { error: 'Maximizar solo está disponible en Antuan OS' };
      } else ipcMain.emit('window', {}, w.id, acc);
      return { ok: true, ventana: w.title };
    }
    case 'volumen': {
      if (a.silencio === 'true' || a.silencio === true) { await ctx.sis.ask('mute 1'); return { ok: true, silenciado: true }; }
      if (a.silencio === 'false' || a.silencio === false) await ctx.sis.ask('mute 0');
      if (a.nivel != null && a.nivel !== '') { const v = Math.max(0, Math.min(100, Math.round(+a.nivel))); await ctx.sis.ask('vol ' + v); if (v > 0) await ctx.sis.ask('mute 0'); return { ok: true, volumen: v }; }
      return { ok: true };
    }
    case 'brillo': { const v = Math.max(5, Math.min(100, Math.round(+a.nivel || 0))); await ctx.sis.ask('bri ' + v); return { ok: true, brillo: v }; }
    case 'cambiar_ajuste': {
      const k = a.clave; if (!(k in AJUSTES)) return { error: 'Ese ajuste no existe. Claves: ' + Object.keys(AJUSTES).join(', ') };
      let v = a.valor;
      if (v === 'true' || v === 'false') v = v === 'true';
      else if (/^-?\d+(\.\d+)?$/.test(String(v))) v = +v;
      if (Array.isArray(AJUSTES[k]) && !AJUSTES[k].includes(v)) return { error: `Valores posibles: ${AJUSTES[k].join(', ')}` };
      ipcMain.emit('config', { sender: null }, { [k]: v }); return { ok: true, [k]: v };
    }
    case 'buscar_archivos': {
      const r = await ctx.buscador.json('q ' + Buffer.from(String(a.texto || ''), 'utf8').toString('base64'));
      return { resultados: (r || []).map((x) => x.path) };
    }
    case 'abrir': {
      const d = String(a.destino || '').trim();
      if (/^https?:\/\//i.test(d)) { shell.openExternal(d); return { ok: true }; }
      const p = ruta(d); if (!fs.existsSync(p)) return { error: 'No existe: ' + p };
      const e = await shell.openPath(p); return e ? { error: e } : { ok: true, abierto: p };
    }
    case 'leer_archivo': {
      const p = ruta(a.ruta);
      try { const s = fs.statSync(p); if (s.isDirectory()) return { carpeta: p, contenido: fs.readdirSync(p).slice(0, 200) }; return { ruta: p, contenido: fs.readFileSync(p, 'utf8').slice(0, 8000) }; }
      catch (e) { return { error: e.message }; }
    }
    case 'escribir_archivo': {
      const p = ruta(a.ruta);
      if (fs.existsSync(p) && !(await confirmar(`Reescribir el archivo ${p}`))) return { error: 'El usuario no lo ha permitido' };
      try { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, String(a.contenido ?? '')); return { ok: true, ruta: p }; }
      catch (e) { return { error: e.message }; }
    }
    case 'pulsar_teclas': return sh(`xdotool key --clearmodifiers ${JSON.stringify(String(a.teclas || ''))}`, 5000);
    case 'escribir_texto': return sh(`xdotool type --delay 8 -- ${JSON.stringify(String(a.texto || ''))}`, 30000);
    case 'energia': {
      const acc = { bloquear: 'lock', suspender: 'sleep', reiniciar: 'restart', apagar: 'shutdown' }[String(a.accion).toLowerCase()];
      if (!acc) return { error: 'Acción no válida' };
      if ((acc === 'restart' || acc === 'shutdown') && !(await confirmar(acc === 'restart' ? 'Reiniciar el PC' : 'Apagar el PC'))) return { error: 'El usuario no lo ha permitido' };
      setTimeout(() => ipcMain.emit('power', {}, acc), 600); return { ok: true };
    }
    case 'buscar_info': {
      const r = await buscarWikipedia(String(a.tema || ''));
      if (!r) return { error: 'No he encontrado nada sobre eso' };
      ultimo = r; abrirWeb(r.url, a.navegador);
      // al modelo solo le llega un trozo: para pegarlo entero en notas no tiene que reescribirlo (es lo lento)
      return { titulo: r.titulo, resumen: r.texto.slice(0, 280), url: r.url };
    }
    case 'anadir_nota': {
      const pegar = a.pegar_resultado === 'true' || a.pegar_resultado === true || !a.texto;
      if (pegar && !ultimo) return { error: 'No hay nada buscado todavía: usa buscar_info primero' };
      const nuevo = pegar ? `${ultimo.titulo}\n${ultimo.texto}\n(${ultimo.url})` : String(a.texto);
      const antes = String(await ASKS_.notes() || '').trimEnd();
      const todo = (antes ? antes + '\n\n' : '') + nuevo;
      await ASKS_.saveNotes(todo);
      emitir('notas', { texto: todo });
      return { ok: true, nota_añadida: pegar ? ultimo.titulo : nuevo.slice(0, 60) };
    }
    case 'info_sistema': {
      const r = { sistema: LINUX ? 'Antuan OS' : 'Windows', procesador: os.cpus()[0]?.model, nucleos: os.cpus().length, memoria_gb: +(os.totalmem() / 2 ** 30).toFixed(1), memoria_libre_gb: +(os.freemem() / 2 ** 30).toFixed(1), encendido_horas: +(os.uptime() / 3600).toFixed(1), modelo_ia: modelo() };
      if (LINUX) Object.assign(r, { disco: (await sh('df -h / /home 2>/dev/null', 5000)).salida, bateria: (await sh('cat /sys/class/power_supply/BAT*/capacity 2>/dev/null', 3000)).salida.trim() || 'sin batería', red: (await sh("nmcli -t -f NAME,TYPE connection show --active 2>/dev/null", 5000)).salida, procesos_que_mas_gastan: (await sh('ps -eo comm,%cpu,%mem --sort=-%cpu | head -8', 5000)).salida });
      return r;
    }
  }
  return { error: 'Herramienta desconocida' };
}

// ---------------------------------------------------------------- Internet
let ultimo = null, ASKS_ = null;   // lo ultimo que encontro buscar_info; ASKS de main.js (notas)
const https = require('https');
const getJSON = (url) => new Promise((resolve) => {
  const req = https.get(url, { headers: { 'User-Agent': 'AntuanAI/1.0 (Antuan OS)' }, timeout: 8000 }, (r) => {
    let d = ''; r.setEncoding('utf8'); r.on('data', (c) => { d += c; });
    r.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(null); } });
  });
  req.on('timeout', () => req.destroy()); req.on('error', () => resolve(null));
});
// Wikipedia en espanol: busca el articulo y saca su resumen (la introduccion entera, sin formato)
async function buscarWikipedia(tema) {
  if (!tema.trim()) return null;
  const b = await getJSON(`https://es.wikipedia.org/w/api.php?action=query&list=search&srlimit=1&format=json&srsearch=${encodeURIComponent(tema)}`);
  const titulo = b && b.query && b.query.search && b.query.search[0] && b.query.search[0].title;
  if (!titulo) return null;
  const p = await getJSON(`https://es.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&redirects=1&format=json&titles=${encodeURIComponent(titulo)}`);
  const pag = p && p.query && Object.values(p.query.pages || {})[0];
  const texto = (pag && pag.extract || '').replace(/\n{2,}/g, '\n').trim();
  if (!texto) return null;
  return { titulo, texto: texto.slice(0, 1500), url: 'https://es.wikipedia.org/wiki/' + encodeURIComponent(titulo.replace(/ /g, '_')) };
}
function abrirWeb(url, navegador) {
  const cmds = { chrome: ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'], firefox: ['firefox', 'firefox-esr'] }[navegador];
  if (LINUX && cmds) for (const c of cmds) {
    if (['/usr/bin/', '/usr/local/bin/', '/snap/bin/'].some((d) => fs.existsSync(d + c))) { const p = spawn(c, [url], { detached: true, stdio: 'ignore' }); p.on('error', () => { }); p.unref(); return; }
  }
  shell.openExternal(url);
}

// ---------------------------------------------------------------- Conversacion
// Los modelos pequenos, con las "tools" normales, DICEN lo que van a hacer y no lo hacen. Por eso Ollama obliga a
// contestar siempre con este JSON (format): lo que dice y la lista de acciones, con los nombres exactos de las
// herramientas. Si hay que hacer algo, tiene que estar en "acciones", y Antuan lo ejecuta.
const NOMBRES_H = HERRAMIENTAS.map((h) => h.function.name);
const ESQUEMA = {
  type: 'object',
  properties: {
    respuesta: { type: 'string' },
    acciones: { type: 'array', maxItems: 6, items: { type: 'object', properties: { herramienta: { type: 'string', enum: NOMBRES_H }, args: { type: 'object' } }, required: ['herramienta', 'args'] } }
  },
  required: ['respuesta', 'acciones']
};
// Herramientas que solo hacen algo (no traen datos que haya que contar): si todas salen bien, no hace falta otra vuelta
const SOLO_HACEN = new Set(['abrir_app', 'controlar_ventana', 'volumen', 'brillo', 'cambiar_ajuste', 'abrir', 'pulsar_teclas', 'escribir_texto', 'energia', 'anadir_nota']);
const firma = (h) => {
  const p = h.function.parameters.properties;
  return `${h.function.name}(${Object.entries(p).map(([k, v]) => (v.enum ? `${k}: ${v.enum.join('|')}` : k)).join(', ')}): ${h.function.description}`;
};

// El texto del sistema no cambia nunca (la hora va en cada mensaje): asi Ollama reutiliza lo ya leido y
// en un PC lento no vuelve a procesar las instrucciones en cada pregunta.
function sistema() {
  return `Eres Antuan AI, el asistente de ${LINUX ? 'Antuan OS (Debian Linux)' : 'Antuan en Windows'}. Usuario: ${os.userInfo().username}, carpeta personal: ${os.homedir()}.
Contestas SIEMPRE con JSON: "respuesta" (lo que dices, en español, de tú, una frase corta y segura) y "acciones" (lo que haces en el PC).
Si te piden hacer algo, pon YA en "acciones" todas las acciones necesarias, en orden. Nunca digas que lo vas a hacer sin ponerlas. Si solo es charla, "acciones": [].
Después de hacer las acciones recibirás sus resultados: si falta algo, pon más acciones; si ya está, "acciones": [] y di en una frase qué has hecho. No inventes resultados.
Herramientas:
${HERRAMIENTAS.map((h) => '- ' + firma(h)).join('\n')}
Información de internet: buscar_info; para guardarla en Notas, después anadir_nota con pegar_resultado "true".${LINUX ? ' Instalar programas: ejecutar_comando con "pkexec apt-get install -y <paquete>".' : ''}
Ejemplos:
"hola" -> {"respuesta":"¡Hola! ¿Qué hago por ti?","acciones":[]}
"abre firefox y sube el volumen" -> {"respuesta":"Abro Firefox y subo el volumen.","acciones":[{"herramienta":"abrir_app","args":{"nombre":"firefox"}},{"herramienta":"volumen","args":{"nivel":"80"}}]}
"busca info de los gatos y ponla en notas" -> {"respuesta":"Busco sobre los gatos y lo pego en tus notas.","acciones":[{"herramienta":"buscar_info","args":{"tema":"gatos"}},{"herramienta":"anadir_nota","args":{"pegar_resultado":"true"}}]}${hibrido(modelo()) ? '\n/no_think' : ''}`;
}
// "think" solo se manda a los modelos que lo entienden (a los demas Ollama les da error)
const pensar = () => (hibrido(modelo()) ? { think: false } : {});
const conHora = (t) => `${t}\n\n(${new Date().toLocaleString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })})`;

// En un PC lento se gana mucho dejando el modelo cargado y con las instrucciones ya leidas antes de la primera pregunta
const OPCIONES = { temperature: 0.2, num_ctx: 4096, num_predict: 500 };
const pedido = (messages, extra = {}) => ({ model: modelo(), messages, format: ESQUEMA, ...pensar(), keep_alive: '2h', options: OPCIONES, ...extra });
let calentado = false;
async function precalentar() {
  if (calentado || ocupado) return;
  try {
    calentado = true;
    await peticion('/api/chat', pedido([{ role: 'system', content: sistema() }, { role: 'user', content: 'hola' }], { stream: false, options: { ...OPCIONES, num_predict: 1 } }));
  } catch { calentado = false; }
}

// Saca lo que va escrito en "respuesta" mientras llega el JSON, para ensenarlo palabra a palabra
function respuestaParcial(json) {
  const m = /"respuesta"\s*:\s*"((?:[^"\\]|\\.)*)/.exec(json);
  if (!m) return '';
  try { return JSON.parse('"' + m[1].replace(/\\$/, '') + '"'); } catch { return ''; }
}

async function enviar(texto) {
  if (ocupado) return { error: 'Espera a que termine' };
  calentado = true;   // la pregunta ya carga el modelo: no hace falta precalentar a la vez
  const e = await estado();
  if (e.estado !== 'listo') { emitir('estado', e); return { error: 'Antuan AI aún no está lista' }; }
  ocupado = true;
  if (!historial.length) historial.push({ role: 'system', content: '' });
  historial[0].content = sistema();
  historial.push({ role: 'user', content: conHora(String(texto)) });
  const hechas = new Set();
  try {
    for (let paso = 0; paso < 6; paso++) {
      let crudo = '', dicho = '';
      emitir('pensando');
      await peticion('/api/chat', pedido(historial, { stream: true }), (l) => {
        if (l.error) throw new Error(l.error);
        const c = l.message && l.message.content;
        if (!c) return;
        crudo += c;
        const r = respuestaParcial(crudo);
        if (r.length > dicho.length && r.startsWith(dicho)) { emitir('texto', { texto: r.slice(dicho.length) }); dicho = r; }
      }, { parable: true });
      let j; try { j = JSON.parse(crudo.replace(/^[\s\S]*?(?=\{)/, '')); } catch { j = { respuesta: dicho || crudo.trim(), acciones: [] }; }
      if (!dicho && j.respuesta) emitir('texto', { texto: j.respuesta });
      historial.push({ role: 'assistant', content: JSON.stringify({ respuesta: j.respuesta || '', acciones: j.acciones || [] }) });
      // las que ya se hicieron en esta peticion no se repiten (el modelo a veces las vuelve a poner)
      const acciones = (Array.isArray(j.acciones) ? j.acciones : []).filter((a) => a && NOMBRES_H.includes(a.herramienta) && !hechas.has(JSON.stringify(a)));
      if (!acciones.length) break;
      const resultados = [];
      for (const a of acciones) {
        hechas.add(JSON.stringify(a));
        const args = a.args && typeof a.args === 'object' ? a.args : {};
        emitir('herramienta', { nombre: a.herramienta, args });
        let res; try { res = await usar(a.herramienta, args); } catch (err) { res = { error: err.message }; }
        emitir('resultado', { nombre: a.herramienta, ok: !res.error, error: res.error });
        resultados.push({ herramienta: a.herramienta, resultado: res });
      }
      // si solo eran acciones de hacer y han salido todas bien, ya esta: lo dicho al principio vale ("Abro Firefox...")
      const pega = resultados.some((r) => r.herramienta === 'anadir_nota');   // buscar y pegar en Notas: ya esta todo
      if (resultados.every((r) => (SOLO_HACEN.has(r.herramienta) || (pega && r.herramienta === 'buscar_info')) && !r.resultado.error)) {
        historial.push({ role: 'user', content: 'Resultados: todo hecho.' });
        historial.push({ role: 'assistant', content: JSON.stringify({ respuesta: 'Hecho.', acciones: [] }) });
        break;
      }
      historial.push({ role: 'user', content: `Resultados (ya están hechas, no las repitas): ${JSON.stringify(resultados).slice(0, 5000)}\nSi falta algo, pon las acciones que faltan; si no, "acciones": [] y di en una frase qué has hecho o lo que has encontrado.` });
      emitir('texto', { texto: '\n' });
    }
  } catch (err) {
    if (err.message !== 'cancelado') emitir('error', { texto: err.message });
  } finally {
    ocupado = false; cancelar = null;
    // memoria corta: el sistema y los ultimos mensajes
    if (historial.length > 31) historial = [historial[0], ...historial.slice(-30)];
    emitir('fin');
  }
  return { ok: true };
}

module.exports = {
  registrar(c, ASKS) {
    ctx = c; ASKS_ = ASKS;
    ASKS['ia.estado'] = () => estado();
    ASKS['ia.enviar'] = (t) => { enviar(t); return true; };   // la respuesta llega por el canal 'ia'
    ASKS['ia.confirmar'] = (id, si) => { const f = pendientes.get(id); if (f) f(si); return true; };
    ASKS['ia.parar'] = () => { if (cancelar) cancelar(); for (const f of pendientes.values()) f(false); return true; };
    ASKS['ia.olvidar'] = () => { historial = []; return true; };
    ASKS['ia.instalar'] = () => instalarOllama();
    // en cuanto Antuan arranca se comprueba: si falta el modelo se empieza a bajar solo
    // y si ya esta lista, se carga el modelo en memoria para que la primera respuesta no espere
    setTimeout(() => estado().then((e) => { if (e.estado === 'listo') precalentar(); }).catch(() => { }), 20000);
  }
};
