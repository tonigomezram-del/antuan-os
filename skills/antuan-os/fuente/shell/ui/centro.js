// Centro Antuan: estado del PC, rendimiento, juegos, inicio, disco, actualizaciones, energia, red,
// sonido, privacidad, modos y personalizacion. Todo en una ventana, ordenado y sin rodeos.
(async () => {
'use strict';
const U = window.umbra;
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const G = (fn, ...a) => U.ask('gestion', fn, ...a);
const S = (cmd) => U.ask('sys', cmd);
let C = await U.ask('config');
const root = document.documentElement;
// Antuan OS: se ocultan las opciones que solo existen en Windows y se cambian sus textos
const LINUX = U.plataforma === 'linux', SO = LINUX ? 'Antuan OS' : 'Windows';
const soloWin = (html) => (LINUX ? '' : html);

function applyLook() {
  root.style.setProperty('--accent', C.accent);
  const n = parseInt(C.accent.slice(1), 16);
  root.style.setProperty('--accent-rgb', [(n >> 16) & 255, (n >> 8) & 255, n & 255].join(', '));
  root.classList.toggle('reduce-motion', !!C.reduceMotion);
  if (window.LiquidGlass) LiquidGlass.ajustar(LiquidGlass.desdeConfig(C));
}
// Vista previa del cristal liquido (Personalizacion): una lente que se arrastra sobre rayas y texto, como la web
function vistaLiquida() {
  const caja = document.getElementById('lgVista'), lente = document.getElementById('lgLente');
  if (!caja || !lente || !window.LiquidGlass) return;
  const pon = () => {
    lente.style.backdropFilter = `url(#${LiquidGlass.filtroFijo(180, 110, 55, {}, 'lente')})`;
    lente.style.filter = '';
    const dentro = lente.querySelector('.in');
    dentro.style.setProperty('--lg-cont', LiquidGlass.ajustes.contenido > 0 ? `url(#${LiquidGlass.filtroFijo(180, 110, 55, {}, 'contenido')})` : 'none');
  };
  pon(); LiquidGlass.alCambiar(pon);
  const mu = LiquidGlass.muelle(lente, { reposo: 0.9, activo: 1, estira: 0.0005 });
  let ag = null;
  lente.addEventListener('pointerdown', (e) => { ag = { x: e.clientX - lente.offsetLeft, y: e.clientY - lente.offsetTop }; lente.setPointerCapture(e.pointerId); mu.tocar(); });
  lente.addEventListener('pointermove', (e) => {
    if (!ag) return;
    lente.style.left = Math.max(-60, Math.min(caja.clientWidth - 120, e.clientX - ag.x)) + 'px';
    lente.style.top = Math.max(-40, Math.min(caja.clientHeight - 70, e.clientY - ag.y)) + 'px';
    mu.mover();
  });
  const fin = () => { if (ag) { ag = null; mu.soltar(); } };
  lente.addEventListener('pointerup', fin); lente.addEventListener('pointercancel', fin);
}
applyLook();
function setC(patch) { Object.assign(C, patch); U.config(patch); applyLook(); }
U.on('config-changed', (p) => { Object.assign(C, p); applyLook(); });

let toastT;
function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 2600); }
const loading = (t = 'Cargando…') => `<div class="loading"><i class="spin"></i>${t}</div>`;
const sw = (on, attrs = '') => `<button class="switch" role="switch" aria-checked="${!!on}" ${attrs}></button>`;
const paint = (r) => r.style.setProperty('--v', ((r.value - r.min) / (r.max - r.min) * 100) + '%');

/* ---------------- Secciones ---------------- */
const NAV = [
  ['General'], ['resumen', 'Resumen', 'home'], ['rendimiento', 'Rendimiento', 'motion'],
  ['Juegos'], ['juegos', 'Juegos', 'game'],
  ['Tu PC'], ['inicio', 'Apps al inicio', 'power'], ['disco', 'Almacenamiento', 'folder'], ['updates', 'Actualizaciones', 'restart'],
  ['energia', 'Energía y batería', 'battery'], ['red', 'Red', 'wifi'], ['sonido', 'Sonido', 'volume'], ['privacidad', 'Privacidad', 'eye'],
  ['Antuan'], ['modos', 'Modos', 'spark'], ['look', 'Personalización', 'palette'], ['access', 'Accesibilidad', 'access'], ['atajos', 'Atajos', 'grid'], ['sistema', 'Sistema', 'windows']
];
window.ICONS.home = window.ICONS.home || '<path d="m3 11 9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>';
window.ICONS.eye = window.ICONS.eye || '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>';
$('#nav').innerHTML = NAV.map((n) => n.length === 1 ? `<div class="cap">${n[0]}</div>` : `<button class="nav-b" data-s="${n[0]}">${icon(n[2])}<span>${n[1]}</span></button>`).join('');
$('#nav').addEventListener('click', (e) => { const b = e.target.closest('.nav-b'); if (b) go(b.dataset.s); });
U.on('goto', (s) => go(s));

let current = null, timers = [];
const every = (fn, ms) => { fn(); timers.push(setInterval(fn, ms)); };
function go(s) {
  timers.forEach(clearInterval); timers = [];
  current = s;
  $$('.nav-b').forEach((b) => b.setAttribute('aria-current', b.dataset.s === s));
  const sec = SECTIONS[s] || SECTIONS.resumen;
  $('#title').textContent = sec.t; $('#sub').textContent = sec.d;
  const pane = $('#pane');
  pane.innerHTML = '';
  pane.scrollTop = 0;
  sec.render(pane);
}
function mount(pane, html) {
  pane.innerHTML = `<div class="stagger">${html}</div>`;
  $$('.stagger > *', pane).forEach((c, i) => c.style.setProperty('--i', i));
}

/* ---------------- Graficas ---------------- */
function spark(canvas, data, color) {
  const dpr = devicePixelRatio || 1, w = canvas.clientWidth, h = canvas.clientHeight;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const g = canvas.getContext('2d'); g.scale(dpr, dpr);
  if (data.length < 2) return;
  const step = w / (30 - 1), pts = data.slice(-30).map((v, i, a) => [w - (a.length - 1 - i) * step, h - 4 - (Math.min(100, v) / 100) * (h - 8)]);
  const grad = g.createLinearGradient(0, 0, 0, h); grad.addColorStop(0, color + '55'); grad.addColorStop(1, color + '00');
  g.beginPath(); g.moveTo(pts[0][0], h);
  pts.forEach(([x, y], i) => { if (i === 0) g.lineTo(x, y); else { const [px, py] = pts[i - 1]; g.bezierCurveTo((px + x) / 2, py, (px + x) / 2, y, x, y); } });
  g.lineTo(pts[pts.length - 1][0], h); g.closePath(); g.fillStyle = grad; g.fill();
  g.beginPath(); pts.forEach(([x, y], i) => { if (i === 0) g.moveTo(x, y); else { const [px, py] = pts[i - 1]; g.bezierCurveTo((px + x) / 2, py, (px + x) / 2, y, x, y); } });
  g.strokeStyle = color; g.lineWidth = 2; g.stroke();
}
const hist = { cpu: [], ram: [], gpu: [], disco: [] };

/* ================================================================ */
const SECTIONS = {
  resumen: {
    t: 'Resumen', d: 'Cómo está tu PC ahora mismo y qué mejorar.',
    async render(pane) {
      mount(pane, `<div class="hero"><div class="score" style="--s:0"><svg viewBox="0 0 92 92"><circle class="bg" cx="46" cy="46" r="39"/><circle class="fg" cx="46" cy="46" r="39"/></svg><b id="scoreN">–</b></div>
        <div><h2 id="heroT">Analizando tu PC…</h2><p id="heroD">Un momento.</p></div></div>
        <div class="grid g4 section" id="stats">${loading()}</div>
        <div class="section"><h2>Recomendaciones</h2><div class="tips" id="tips">${loading('Revisando…')}</div></div>`);
      const [r, bat, st, ups, ini, net] = await Promise.all([G('rendimiento'), S('battery?'), G('almacenamiento'), G('actualizaciones'), G('appsInicio'), G('red')]);
      if (current !== 'resumen') return;
      const tips = [];
      let score = 100;
      if (r && r.ram && r.ram.pct > 85) { score -= 15; tips.push(['alto', 'ram', `La RAM está al ${Math.round(r.ram.pct)} %: el PC irá lento. Mira qué la gasta.`, 'rendimiento', 'Ver']); }
      const disk = st && st.unidades && st.unidades[0];
      if (disk && disk.pct > 85) { score -= 15; tips.push(['alto', 'folder', `El disco ${disk.letra} está al ${disk.pct} %.`, 'disco', 'Liberar']); }
      const limpiable = st && st.limpiable ? st.limpiable.temporalesMB + st.limpiable.papeleraMB + st.limpiable.cacheMinMB : 0;
      if (limpiable > 200) { score -= 5; tips.push(['medio', 'folder', `Puedes liberar ${(limpiable / 1024).toFixed(1)} GB de temporales y papelera.`, 'disco', 'Limpiar']); }
      if (ups && ups.reinicioPendiente) { score -= 8; tips.push(['medio', 'restart', 'Hay actualizaciones esperando un reinicio. Elige tú cuándo.', 'updates', 'Ver']); }
      const activas = (ini || []).filter((x) => x.activa).length;
      if (activas > 6) { score -= 8; tips.push(['medio', 'power', `${activas} apps arrancan con ${SO}: el encendido es más lento.`, 'inicio', 'Revisar']); }
      if (bat && bat.ok && bat.health && bat.health < 80) { score -= 4; tips.push(['medio', 'battery', `La batería conserva el ${bat.health} % de su capacidad original.`, 'energia', 'Ver']); }
      if (net && net.banda === '2.4 GHz') { score -= 4; tips.push(['medio', 'wifi', 'Tu Wi-Fi va por 2,4 GHz. Si tu router tiene 5 GHz, tendrás menos ping y más velocidad.', 'red', 'Ver']); }
      if (!tips.length) tips.push(['ok', 'spark', 'Todo en orden. Tu PC está en forma.', null, '']);
      score = Math.max(20, score);
      $('.score').style.setProperty('--s', score); $('#scoreN').textContent = score;
      $('#heroT').textContent = score >= 85 ? 'Tu PC está en muy buena forma' : score >= 65 ? 'Tu PC va bien, con margen de mejora' : 'Tu PC necesita un repaso';
      $('#heroD').textContent = `${tips.filter((t) => t[0] !== 'ok').length} ${tips.length === 1 ? 'cosa' : 'cosas'} que puedes mejorar en un clic.`;
      $('#stats').innerHTML = [
        ['CPU', r ? Math.round(r.cpu) + ' %' : '–', r ? r.cpu : 0, 'Procesador'],
        ['RAM', r ? r.ram.usadaGB.toFixed(1) + ' GB' : '–', r ? r.ram.pct : 0, r ? `de ${r.ram.totalGB.toFixed(0)} GB` : ''],
        ['Disco', disk ? disk.libreGB.toFixed(0) + ' GB' : '–', disk ? disk.pct : 0, 'libres'],
        ['Batería', bat && bat.ok && bat.present ? bat.percent + ' %' : 'Enchufado', bat && bat.ok && bat.present ? bat.percent : 100, bat && bat.health ? 'salud ' + bat.health + ' %' : '']
      ].map(([n, v, p, s]) => `<div class="card stat"><small>${n}</small><b>${v}</b><small>${s}</small><div class="bar" style="--p:${Math.min(100, p)}%;--c:${p > 85 && n !== 'Batería' ? 'var(--bad)' : 'var(--accent)'}"><i></i></div></div>`).join('');
      $('#tips').innerHTML = tips.map(([lvl, ic, t, s, b]) => `<div class="tip ${lvl}"><span class="ic">${icon(ic)}</span><span>${esc(t)}</span>${s ? `<button class="btn" data-go="${s}">${b}</button>` : ''}</div>`).join('');
      $('#tips').addEventListener('click', (e) => { const b = e.target.closest('[data-go]'); if (b) go(b.dataset.go); });
      const dot = (s, on) => { const nb = $(`.nav-b[data-s="${s}"]`); if (nb && on && !$('.dot', nb)) nb.insertAdjacentHTML('beforeend', '<i class="dot"></i>'); };
      tips.forEach((t) => t[3] && t[0] !== 'ok' && dot(t[3], true));
    }
  },

  rendimiento: {
    t: 'Rendimiento', d: 'En vivo. Cierra lo que te sobra con un clic.',
    render(pane) {
      mount(pane, `<div class="grid g4">${['cpu|CPU|#9db4ff', 'ram|RAM|#c5a3ff', 'gpu|Gráficos|#7ee0d2', 'disco|Disco|#ffc978'].map((x) => { const [k, n] = x.split('|'); return `<div class="card stat"><small>${n}</small><b id="v-${k}">–</b><canvas class="spark" id="c-${k}"></canvas></div>`; }).join('')}</div>
        <div class="card section"><h3>Lo que más consume <span class="r faint" id="temp"></span></h3><div class="proc h"><span>App</span><span>CPU</span><span>RAM</span><span></span></div><div id="procs">${loading()}</div></div>`);
      const colors = { cpu: '#9db4ff', ram: '#c5a3ff', gpu: '#7ee0d2', disco: '#ffc978' };
      let busy = false;
      every(async () => {
        if (busy) return; busy = true;
        const r = await G('rendimiento'); busy = false;
        if (current !== 'rendimiento' || !r) return;
        const vals = { cpu: r.cpu, ram: r.ram.pct, gpu: r.gpu ?? 0, disco: r.discoActividad ?? 0 };
        for (const k in vals) {
          hist[k].push(vals[k]); if (hist[k].length > 30) hist[k].shift();
          $('#v-' + k).textContent = k === 'ram' ? `${r.ram.usadaGB.toFixed(1)} / ${r.ram.totalGB.toFixed(0)} GB` : (r[k === 'disco' ? 'discoActividad' : k] == null && k !== 'cpu' ? 'n/d' : Math.round(vals[k]) + ' %');
          spark($('#c-' + k), hist[k], colors[k]);
        }
        $('#temp').textContent = r.temperatura ? `Temperatura ${Math.round(r.temperatura)} °C` : '';
        $('#procs').innerHTML = r.procesos.map((p) => `<div class="proc"><span class="n">${esc(p.nombre)}</span><span>${p.cpu.toFixed(1)} %</span><span>${p.ramMB >= 1024 ? (p.ramMB / 1024).toFixed(1) + ' GB' : Math.round(p.ramMB) + ' MB'}</span><button class="x" data-pid="${p.pid}" title="Cerrar">${icon('x')}</button></div>`).join('');
      }, 2600);
      pane.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-pid]'); if (!b) return;
        b.closest('.proc').style.opacity = .4;
        const r = await G('cerrarProceso', +b.dataset.pid);
        toast(r && r.ok ? 'Cerrado' : 'No se pudo cerrar (puede ser del sistema)');
      });
    }
  },

  juegos: {
    t: 'Juegos', d: 'Tu biblioteca. Pulsa Jugar y Antuan prepara el PC para el máximo rendimiento.',
    async render(pane) {
      mount(pane, `<div id="gstate"></div><div id="glist">${loading('Buscando tus juegos en Steam, Epic, Riot, Xbox, Roblox…')}</div>`);
      const [list, st] = await Promise.all([U.ask('games'), U.ask('gameState')]);
      if (current !== 'juegos') return;
      paintGameState(st);
      if (!list || !list.length) { $('#glist').innerHTML = '<div class="empty">No he encontrado juegos instalados.</div>'; return; }
      $('#glist').innerHTML = `<div class="games">${list.map((g) => {
        const live = st && st.id === g.id;
        const art = g.portada ? `style="background-image:url('${g.portada}')"` : `style="background:linear-gradient(135deg, hsl(${(g.nombre.length * 47) % 360} 45% 30%), #0b0d12)"`;
        return `<button class="game" data-id="${esc(g.id)}"><div class="art" ${art}>${g.portada ? '' : g.png ? `<img src="${g.png}" alt="">` : ''}</div>
          ${live ? '<span class="pill ok live">● Jugando</span>' : ''}<div class="meta"><b>${esc(g.nombre)}</b><span>${esc(g.plataforma)}${g.tamanoGB ? ' · ' + g.tamanoGB.toFixed(1) + ' GB' : ''}</span></div></button>`;
      }).join('')}</div>
      <div class="card section"><div class="row" style="padding:0"><div class="lbl"><b>Modo Juego automático</b><span>Al abrir cualquiera de estos juegos, Antuan optimiza solo y lo deshace al cerrarlo.</span></div>${sw(C.gameAuto !== false, 'id="gAuto"')}</div></div>`;
      $('#gAuto').addEventListener('click', (e) => { const on = e.currentTarget.getAttribute('aria-checked') !== 'true'; e.currentTarget.setAttribute('aria-checked', on); setC({ gameAuto: on }); });
      $('#glist').addEventListener('click', (e) => { const g = e.target.closest('.game'); if (g) gameDetail(list.find((x) => x.id === g.dataset.id)); });
    }
  },

  inicio: {
    t: 'Apps al inicio', d: `Lo que arranca con ${SO}. Cuantas menos, antes estás listo.`,
    async render(pane) {
      mount(pane, `<div class="card" id="ini">${loading()}</div>`);
      const list = await G('appsInicio');
      if (current !== 'inicio') return;
      if (!list || !list.length) { $('#ini').innerHTML = `<div class="empty">Nada arranca con ${SO}.</div>`; return; }
      $('#ini').innerHTML = list.map((a) => `<div class="row"><span class="ic">${icon('power')}</span><div class="lbl"><b>${esc(a.nombre)}</b><span>${esc(a.ruta || a.comando)}</span></div>
        ${a.editable ? sw(a.activa, `data-id="${esc(a.id)}"`) : `<span class="pill" title="Necesita permisos de administrador">${a.activa ? 'Activa' : 'Desactivada'} · admin</span>`}</div>`).join('');
      $('#ini').addEventListener('click', async (e) => {
        const b = e.target.closest('.switch[data-id]'); if (!b) return;
        const on = b.getAttribute('aria-checked') !== 'true';
        const r = await G('cambiarInicio', b.dataset.id, on);
        if (r && r.ok) { b.setAttribute('aria-checked', on); toast(on ? `Arrancará con ${SO}` : `Ya no arrancará con ${SO}`); } else toast('No se pudo cambiar');
      });
    }
  },

  disco: {
    t: 'Almacenamiento', d: 'Qué ocupa tu disco y qué puedes liberar sin riesgo.',
    async render(pane) {
      mount(pane, `<div id="drives">${loading()}</div><div class="card section" id="clean"></div><div class="card section"><h3>Archivos grandes olvidados</h3><div id="big">${loading('Buscando archivos de más de 300 MB…')}</div></div>`);
      const st = await G('almacenamiento');
      if (current !== 'disco') return;
      if (st) {
        $('#drives').innerHTML = `<div class="grid g2">${st.unidades.map((d) => `<div class="card stat"><small>Disco ${esc(d.letra)} ${esc(d.nombre || '')}</small><b>${d.libreGB.toFixed(0)} GB libres</b><small>de ${d.totalGB.toFixed(0)} GB · ${d.pct} % usado</small><div class="bar" style="--p:${d.pct}%;--c:${d.pct > 85 ? 'var(--bad)' : 'var(--accent)'}"><i></i></div></div>`).join('')}</div>`;
        const l = st.limpiable;
        $('#clean').innerHTML = `<h3>Limpieza segura</h3>
          <div class="row"><div class="lbl"><b>Archivos temporales</b><span>Restos de instaladores y apps (se respetan los de la última hora)</span></div><b>${l.temporalesMB} MB</b>${sw(true, 'data-k="temporales"')}</div>
          <div class="row"><div class="lbl"><b>Cachés del sistema</b><span>Miniaturas, informes de errores y caché de sombreadores</span></div><b>${l.cacheMinMB} MB</b>${sw(true, 'data-k="cache"')}</div>
          <div class="row"><div class="lbl"><b>Papelera</b><span>Se vacía de forma permanente</span></div><b>${l.papeleraMB} MB</b>${sw(false, 'data-k="papelera"')}</div>
          <div class="btns" style="margin-top:12px"><button class="btn primary" id="doClean">${icon('spark')}Limpiar ahora</button></div>`;
        $('#clean').addEventListener('click', (e) => { const s = e.target.closest('.switch'); if (s) s.setAttribute('aria-checked', s.getAttribute('aria-checked') !== 'true'); });
        $('#doClean').addEventListener('click', async (e) => {
          const o = {}; $$('#clean .switch').forEach((s) => { o[s.dataset.k] = s.getAttribute('aria-checked') === 'true'; });
          e.currentTarget.disabled = true; e.currentTarget.innerHTML = '<i class="spin"></i>Limpiando…';
          const r = await G('limpiar', o);
          toast(r ? `Liberados ${r.liberadoMB} MB` : 'No se pudo limpiar'); go('disco');
        });
      }
      const big = await G('archivosGrandes', 15);
      if (current !== 'disco') return;
      $('#big').innerHTML = big && big.length ? big.map((f) => `<div class="row"><span class="ic">${icon('file')}</span><div class="lbl"><b>${esc(f.nombre)}</b><span>${esc(f.ruta)}</span></div><b>${f.MB >= 1024 ? (f.MB / 1024).toFixed(1) + ' GB' : f.MB + ' MB'}</b><button class="btn" data-reveal="${esc(f.ruta)}">Mostrar</button></div>`).join('') : '<div class="empty">Nada grande por aquí.</div>';
      $('#big').addEventListener('click', (e) => { const b = e.target.closest('[data-reveal]'); if (b) U.cmd('reveal', b.dataset.reveal); });
    }
  },

  updates: {
    t: 'Actualizaciones', d: 'Tú decides cuándo. Nunca más un reinicio por sorpresa.',
    async render(pane) {
      // Antuan OS nunca reinicia solo: sin protección ni pausa (son de Windows Update); se actualiza desde la Tienda
      if (LINUX) mount(pane, `<div class="card"><h3>Pendientes <span class="r"><button class="btn" id="abrirTienda">Actualizar en la Tienda</button></span></h3><div id="ups">${loading('Consultando actualizaciones…')}</div></div>`);
      else mount(pane, `<div class="card"><h3>Protección contra reinicios</h3>
          <div class="row"><div class="lbl"><b>No reiniciar nunca solo mientras uso el PC</b><span>Horas activas de 6:00 a 24:00 y sin reinicios automáticos con la sesión abierta. Windows pedirá permiso de administrador.</span></div><button class="btn primary" id="protect">Activar</button></div>
          <div class="row"><div class="lbl"><b>Pausar actualizaciones</b><span>Útil antes de un examen, una partida importante o un viaje.</span></div>
            <select id="pdays"><option value="7">1 semana</option><option value="14">2 semanas</option><option value="35">5 semanas</option><option value="0">Reanudar</option></select><button class="btn" id="pause">Aplicar</button></div></div>
        <div class="card section"><h3>Pendientes <span class="r"><button class="btn" data-uri="ms-settings:windowsupdate">Abrir Windows Update</button></span></h3><div id="ups">${loading('Consultando Windows Update…')}</div></div>`);
      $('#abrirTienda')?.addEventListener('click', () => U.cmd('tienda'));
      if (!LINUX) $('#protect').addEventListener('click', async () => { const s = await G('comandoProteccionReinicios'); const ok = await U.ask('elevated', s); toast(ok ? 'Protección activada' : 'No se aplicó'); });
      if (!LINUX) $('#pause').addEventListener('click', async () => { const d = +$('#pdays').value; const s = await G('pausarActualizaciones', d); const ok = await U.ask('elevated', s); toast(ok ? (d ? `Pausadas ${d} días` : 'Reanudadas') : 'No se aplicó'); });
      pane.addEventListener('click', (e) => { const b = e.target.closest('[data-uri]'); if (b) U.openUri(b.dataset.uri); });
      const u = await G('actualizaciones');
      if (current !== 'updates') return;
      if (!u) { $('#ups').innerHTML = '<div class="empty">No se pudo consultar.</div>'; return; }
      $('#ups').innerHTML = (u.reinicioPendiente ? `<div class="tip medio" style="margin-bottom:8px"><span class="ic">${icon('restart')}</span><span>Hay actualizaciones instaladas que esperan un reinicio. Hazlo cuando te venga bien.</span></div>` : '') +
        (u.pausadoHasta ? `<div class="tip ok" style="margin-bottom:8px"><span class="ic">${icon('spark')}</span><span>En pausa hasta el ${new Date(u.pausadoHasta).toLocaleDateString('es-ES')}.</span></div>` : '') +
        ((u.pendientes || []).length ? u.pendientes.map((p) => `<div class="row"><span class="ic">${icon('down')}</span><div class="lbl"><b>${esc(p.titulo)}</b><span>${p.KB || ''}${p.tamanoMB ? ' · ' + p.tamanoMB + ' MB' : ''}${p.descargada ? ' · descargada' : ''}</span></div></div>`).join('') : '<div class="empty">Estás al día.</div>');
    }
  },

  energia: {
    t: 'Energía y batería', d: 'Rendimiento cuando lo necesitas, autonomía cuando no.',
    async render(pane) {
      mount(pane, `<div class="modes" id="pmodes">${loading()}</div><div class="grid g2 section" id="batt"></div>`);
      const [p, b] = await Promise.all([S('power?'), S('battery?')]);
      if (current !== 'energia') return;
      const M = [['eficiencia', 'Ahorro', 'leaf', 'Más batería, menos calor y ruido'], ['equilibrado', 'Equilibrado', 'spark', 'Lo justo en cada momento'], ['rendimiento', 'Rendimiento', 'motion', 'Toda la potencia (ideal para jugar)']];
      window.ICONS.leaf = '<path d="M11 20A7 7 0 0 1 4 13c0-6 7-9 16-9 0 9-3 16-9 16z"/><path d="M4 20c4-4 7-6 11-8"/>';
      const paintModes = (cur) => { $('#pmodes').innerHTML = M.map(([k, n, ic, d]) => `<button class="mode ${cur === k ? 'on' : ''}" data-m="${k}"><span class="ic">${icon(ic)}</span><b>${n}</b><span>${d}</span></button>`).join(''); };
      paintModes(p && p.mode);
      $('#pmodes').addEventListener('click', async (e) => { const m = e.target.closest('[data-m]'); if (!m) return; const r = await S('power-set ' + m.dataset.m); if (r && r.ok) { paintModes(r.mode); toast('Modo ' + m.querySelector('b').textContent); } });
      if (b && b.ok && b.present) {
        $('#batt').innerHTML = `<div class="card stat"><small>Carga</small><b>${b.percent} %</b><small>${b.charging ? 'Cargando' : b.ac ? 'Enchufado' : 'Con batería'}</small><div class="bar" style="--p:${b.percent}%"><i></i></div></div>
          <div class="card stat"><small>Salud de la batería</small><b>${b.health ?? '–'} %</b><small>${b.fullMWh && b.designMWh ? `${(b.fullMWh / 1000).toFixed(1)} de ${(b.designMWh / 1000).toFixed(1)} Wh originales` : ''}</small><div class="bar" style="--p:${b.health || 0}%;--c:${b.health < 70 ? 'var(--warn)' : 'var(--ok)'}"><i></i></div></div>`;
      } else $('#batt').innerHTML = '<div class="card"><span class="muted">Este equipo no tiene batería.</span></div>';
    }
  },

  red: {
    t: 'Red', d: 'Tu conexión, redes cercanas y un test de ping de verdad.',
    async render(pane) {
      mount(pane, `<div class="card" id="net">${loading()}</div>
        <div class="grid g2 section"><div class="card"><h3>Test de ping <span class="r"><button class="btn" id="ptest">Medir</button></span></h3><div id="pres" class="muted">Mide la latencia a Cloudflare, Google y tu router.</div></div>
        <div class="card"><h3>Ruta hasta Internet <span class="r"><button class="btn" id="rtest">Trazar</button></span></h3><div id="rres" class="muted">Muestra cada salto y dónde aparece el retraso.</div></div></div>
        <div class="card section"><h3>Redes Wi-Fi</h3><div id="wifis">${loading()}</div></div>`);
      const n = await G('red');
      if (current !== 'red') return;
      $('#net').innerHTML = n && n.tipo ? `<div class="row" style="padding-top:0"><span class="ic">${icon('wifi')}</span><div class="lbl"><b>${esc(n.ssid || 'Cable')}</b><span>${n.tipo === 'wifi' ? `Señal ${n.senal} % · ${n.banda || ''}` : 'Ethernet'} · IP ${esc(n.ip)} · DNS ${esc((n.dns || []).join(', '))}</span></div><span class="pill ok">Conectado</span></div>` +
        (n.banda === '2.4 GHz' ? `<div class="tip medio"><span class="ic">${icon('wifi')}</span><span>Estás en 2,4 GHz. Si tu router emite en 5 GHz, conéctate a esa red: menos ping y menos cortes.</span></div>` : '') : '<div class="empty">Sin conexión</div>';
      $('#ptest').addEventListener('click', async (e) => {
        e.currentTarget.disabled = true; $('#pres').innerHTML = loading('Midiendo…');
        const hosts = [['Cloudflare', '1.1.1.1'], ['Google', '8.8.8.8'], ['Router', n && n.puerta]].filter((h) => h[1]);
        const rs = await Promise.all(hosts.map((h) => G('ping', h[1], 6)));
        $('#pres').innerHTML = hosts.map(([name], i) => { const r = rs[i]; const c = !r || r.media == null ? 'bad' : r.media < 40 ? 'ok' : r.media < 80 ? 'warn' : 'bad'; return `<div class="row"><div class="lbl"><b>${name}</b><span>mín ${r?.min ?? '–'} · máx ${r?.max ?? '–'} ms · pérdida ${r?.perdida ?? 100} %</span></div><span class="pill ${c}">${r?.media ?? '–'} ms</span></div>`; }).join('');
        e.target.disabled = false;
      });
      $('#rtest').addEventListener('click', async (e) => {
        e.currentTarget.disabled = true; $('#rres').innerHTML = loading('Trazando ruta (unos segundos)…');
        const hops = await G('rutaHasta', '1.1.1.1');
        $('#rres').innerHTML = hopsHtml(hops);
      });
      const w = await G('redesWifi');
      if (current !== 'red') return;
      $('#wifis').innerHTML = w && w.length ? w.map((x) => `<div class="row"><span class="ic">${icon('wifi')}</span><div class="lbl"><b>${esc(x.ssid)}</b><span>Señal ${x.senal} % · ${x.segura ? 'Protegida' : 'Abierta'}${x.conocida ? ' · conocida' : ''}</span></div>${n && n.ssid === x.ssid ? '<span class="pill ok">Conectado</span>' : x.conocida ? `<button class="btn" data-ssid="${esc(x.ssid)}">Conectar</button>` : LINUX ? `<button class="btn" data-nueva="${esc(x.ssid)}" data-segura="${x.segura ? 1 : 0}">Conectar</button>` : `<button class="btn" data-uri="ms-settings:network-wifi">Configurar</button>`}</div>`).join('') : '<div class="empty">No hay redes Wi-Fi a la vista.</div>';
      $('#wifis').addEventListener('click', async (e) => {
        const b = e.target.closest('[data-ssid]'); if (b) { const r = await G('conectarWifi', b.dataset.ssid); toast(r && r.ok ? 'Conectando…' : 'No se pudo conectar'); setTimeout(() => go('red'), 3000); }
        const u = e.target.closest('[data-uri]'); if (u) U.openUri(u.dataset.uri);
        // Antuan OS: red nueva con NetworkManager (contraseña aquí mismo si está protegida)
        const nv = e.target.closest('[data-nueva]');
        if (nv) {
          const ssid = nv.dataset.nueva;
          const conectar = async (clave) => { toast('Conectando…'); const r = await G('conectarWifiNueva', ssid, clave || ''); toast(r && r.ok ? 'Conectado a ' + ssid : (r && r.error) || 'No se pudo conectar'); setTimeout(() => go('red'), 1500); };
          if (nv.dataset.segura !== '1') return conectar();
          const row = nv.closest('.row');
          nv.outerHTML = `<input type="password" class="wclave" placeholder="Contraseña" autocomplete="off" style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);color:inherit;border-radius:8px;padding:6px 10px;width:170px;font:inherit"><button class="btn" data-clave>Conectar</button>`;
          const inp = $('.wclave', row);
          inp.focus();
          const ir = () => { if (inp.value) conectar(inp.value); };
          inp.addEventListener('keydown', (k) => { if (k.key === 'Enter') ir(); });
          $('[data-clave]', row).addEventListener('click', ir);
        }
      });
    }
  },

  sonido: {
    t: 'Sonido', d: 'Salida de audio y volumen de cada app, en un solo sitio.',
    async render(pane) {
      mount(pane, `<div class="card"><h3>Salida</h3><div id="outs">${loading()}</div></div><div class="card section"><h3>Volumen por app</h3><div id="apps">${loading()}</div></div>`);
      const paintAll = async () => {
        const [o, s] = await Promise.all([S('outputs?'), S('apps-audio?')]);
        if (current !== 'sonido') return;
        $('#outs').innerHTML = (o && o.devices || []).map((d) => `<div class="row"><span class="ic">${icon('volume')}</span><div class="lbl"><b>${esc(d.name)}</b></div>${d.default ? '<span class="pill ok">En uso</span>' : `<button class="btn" data-dev="${esc(d.id)}">Usar</button>`}</div>`).join('') || '<div class="empty">Sin dispositivos</div>';
        $('#apps').innerHTML = (s && s.sessions || []).map((x) => `<div class="row"><span class="ic">${icon(x.system ? 'bell' : 'music')}</span><div class="lbl"><b>${esc(x.name)}</b><span>${x.active ? 'Sonando' : 'En silencio'}</span></div><input type="range" min="0" max="100" value="${x.level}" data-pid="${x.pid}"></div>`).join('') || '<div class="empty">Ninguna app usa el audio</div>';
        $$('#apps input').forEach(paint);
      };
      await paintAll();
      pane.addEventListener('click', async (e) => { const b = e.target.closest('[data-dev]'); if (b) { await U.ask('outputSet', b.dataset.dev); toast('Salida cambiada'); paintAll(); } });
      pane.addEventListener('input', (e) => { const r = e.target; if (r.dataset.pid == null) return; paint(r); clearTimeout(r._t); r._t = setTimeout(() => S(`app-vol ${r.dataset.pid} ${r.value}`), 40); });
    }
  },

  privacidad: {
    t: 'Privacidad', d: 'Quién usa tu cámara, micrófono y ubicación ahora mismo.',
    render(pane) {
      // Los permisos por app son de Windows; en Antuan OS solo se ve quién usa cada cosa
      mount(pane, `<div class="grid g3" id="priv">${loading()}</div>` + soloWin(`<div class="card section"><div class="row" style="padding:0"><div class="lbl"><b>Permisos de cada app</b><span>Decide qué apps pueden usar cámara, micro o ubicación.</span></div><button class="btn" data-uri="ms-settings:privacy-webcam">Cámara</button><button class="btn" data-uri="ms-settings:privacy-microphone">Micrófono</button><button class="btn" data-uri="ms-settings:privacy-location">Ubicación</button></div></div>`));
      pane.addEventListener('click', (e) => { const b = e.target.closest('[data-uri]'); if (b) U.openUri(b.dataset.uri); });
      every(async () => {
        const p = await S('privacy?');
        if (current !== 'privacidad' || !p) return;
        $('#priv').innerHTML = [['webcam', 'Cámara', 'image'], ['microphone', 'Micrófono', 'volume'], ['location', 'Ubicación', 'globe']].map(([k, n, ic]) => {
          const l = p[k] || [];
          return `<div class="card stat"><small>${n}</small><b>${l.length ? 'En uso' : 'Libre'}</b><small>${l.length ? esc(l.join(', ')) : 'Nadie la está usando'}</small><div class="bar" style="--p:${l.length ? 100 : 0}%;--c:var(--warn)"><i></i></div></div>`;
        }).join('');
      }, 3000);
    }
  },

  modos: {
    t: 'Modos', d: 'Un clic cambia energía, avisos, animaciones y escritorio a la vez.',
    render(pane) {
      const MODES = [
        ['normal', 'Normal', 'home', 'Todo como siempre.', { reduceMotion: false, sounds: true, desktop: true, keepAwake: false }, 'equilibrado'],
        ['foco', 'Concentración', 'eye', 'Sin sonidos ni distracciones y el PC no se suspende.', { sounds: false, keepAwake: true, desktop: true }, 'equilibrado'],
        ['juego', 'Juego', 'game', 'Potencia máxima y Modo Juego automático.', { sounds: false, gameAuto: true }, 'rendimiento'],
        ['ahorro', 'Ahorro', 'battery', 'Máxima batería: sin animaciones y consumo mínimo.', { reduceMotion: true, sounds: false, keepAwake: false }, 'eficiencia']
      ];
      const paintM = () => { $('#modes').innerHTML = MODES.map(([k, n, ic, d]) => `<button class="mode ${C.mode === k || (!C.mode && k === 'normal') ? 'on' : ''}" data-m="${k}"><span class="ic">${icon(ic)}</span><b>${n}</b><span>${d}</span></button>`).join(''); };
      mount(pane, `<div class="modes" id="modes"></div><p class="faint section">Los modos solo cambian ajustes de Antuan y el modo de energía; todo vuelve con el modo Normal.</p>`);
      paintM();
      $('#modes').addEventListener('click', async (e) => {
        const b = e.target.closest('[data-m]'); if (!b) return;
        const m = MODES.find((x) => x[0] === b.dataset.m);
        setC({ ...m[4], mode: m[0] });
        if ('keepAwake' in m[4]) U.cmd('keep-awake-set', m[4].keepAwake);
        await S('power-set ' + m[5]);
        paintM(); toast('Modo ' + m[1]);
      });
    }
  },

  look: {
    t: 'Personalización', d: 'Hazlo tuyo. Los cambios se ven al instante.',
    render(pane) {
      const ACC = ['#9db4ff', '#7ee0d2', '#c5a3ff', '#ff9fb4', '#ffc978', '#8ee08a', '#ff9466', '#e9ebf1'];
      const WALLS = [['Medianoche', 230, 260, 190], ['Aurora', 160, 200, 280], ['Brasa', 15, 340, 40], ['Bosque', 140, 100, 180], ['Lavanda', 270, 300, 220], ['Océano', 200, 185, 240]];
      const THEMES = [
        ['Medianoche', '#9db4ff', 230, 260, 190, 62], ['Aurora', '#7ee0d2', 160, 200, 280, 58], ['Brasa', '#ff9466', 15, 340, 40, 66],
        ['Bosque', '#8ee08a', 140, 100, 180, 60], ['Lavanda', '#c5a3ff', 270, 300, 220, 58], ['Océano', '#6fc3ff', 200, 185, 240, 60]
      ];
      const seg = (k, opts, cur) => `<div class="segw">${opts.map(([v, t]) => `<button data-seg="${k}" data-v="${v}" aria-pressed="${cur === v}">${t}</button>`).join('')}</div>`;
      mount(pane, `<div class="card"><h3>Temas <span class="r faint">Acento, fondo y cristal de una vez</span></h3><div class="themes">${THEMES.map(([n, acc, a, b, c, gl]) =>
          `<button class="theme ${C.theme === n ? 'on' : ''}" data-theme="${n}" data-acc="${acc}" data-wall="${a},${b},${c}" data-glass="${gl}" style="--c:${acc}"><span class="tprev" style="background:${wallCss(a, b, c)}"><i></i><i></i><i></i></span><b>${n}</b></button>`).join('')}</div></div>
        <div class="card section"><h3>Iconos</h3>
          <div class="row"><div class="lbl"><b>Estilo de los logos</b><span>Recreados en línea por Antuan o los originales de cada app</span></div>${seg('logoStyle', [['umbra', 'Antuan'], ['original', 'Originales']], C.logoStyle || 'umbra')}</div>
          <div class="row"><div class="lbl"><b>Escritorio</b><span>Grupos en tarjetas de cristal o iconos sueltos</span></div>${seg('deskStyle', [['tarjetas', 'Tarjetas'], ['libre', 'Libre']], C.deskStyle || 'tarjetas')}</div>
          <div class="row"><div class="lbl"><b>Tamaño de los iconos del escritorio</b></div>${seg('deskIcons', [['s', 'Pequeños'], ['m', 'Medianos'], ['l', 'Grandes']], C.deskIcons || 'm')}</div></div>
        <div class="card section"><h3>Color de acento</h3><div class="swatches">${ACC.map((c) => `<button class="swatch" style="--c:${c}" data-acc="${c}" aria-pressed="${C.accent === c}"></button>`).join('')}<input type="color" id="accCustom" value="${C.accent}" title="Otro color" style="width:34px;height:30px;border:0;background:none"></div></div>
        <div class="card section"><h3>Cristal y dock</h3>
          <div class="row"><div class="lbl"><b>Opacidad del cristal</b><span>Más bajo, más transparente</span></div><input type="range" min="25" max="95" value="${C.glass}" data-k="glass"></div>
          <div class="row"><div class="lbl"><b>Tamaño de los iconos del dock</b></div><input type="range" min="36" max="64" value="${C.dockSize}" data-k="dockSize"></div>
          <div class="row"><div class="lbl"><b>Ampliación al pasar el ratón</b></div>${sw(C.magnify !== false, 'data-b="magnify"')}</div>
          <div class="row" style="display:block"><div class="lbl" style="margin-bottom:10px"><b>Posición del dock</b><span>También puedes arrastrarlo directamente.</span></div><div class="edge-pick">${[['bottom', 'Abajo'], ['top', 'Arriba'], ['left', 'Izquierda'], ['right', 'Derecha']].map(([v, n]) => `<button data-edge="${v}" aria-pressed="${C.edge === v}">${n}</button>`).join('')}</div></div></div>
        <div class="card section"><h3>Cristal líquido <span class="r faint">Como el de iOS: refracta lo que tiene detrás</span></h3>
          <div class="row"><div class="lbl"><b>Cristal líquido</b><span>Dock, bandeja, widgets, sliders e interruptores</span></div>${sw(C.liquidGlass !== false, 'data-b="liquidGlass"')}</div>
          <div class="lg-vista" id="lgVista"><div class="lg-vista-fondo"></div><div class="lg-vista-lente" id="lgLente"><div class="in"><b>22°</b><span>Arrástrame</span></div></div></div>
          <div class="row"><div class="lbl"><b>Forma de la curva</b><span>Cómo se dobla lo de fuera en el borde</span></div>${seg('lgSuperficie', [['squircle', 'Squircle'], ['circulo', 'Círculo'], ['concavo', 'Cóncavo'], ['labio', 'Labio']], C.lgSuperficie || 'squircle')}</div>
          ${[['lgBisel', 'Ancho del borde', 'Cuánta parte del cristal está curvada', 5, 70, 22],
              ['lgLupa', 'Aumento (lupa)', 'Lo de detrás se ve más grande y curvado en todo el cristal', 0, 50, 12],
              ['lgRefraccion', 'Refracción', 'Cuánto dobla lo que hay detrás', 0, 300, 150],
              ['lgCromatica', 'Efecto cromático', 'Separación de colores (arcoíris) en el borde', 0, 30, 6],
              ['lgGrosor', 'Grosor del cristal', 'Más grueso, más se curva el borde', 30, 200, 110],
              ['lgDesenfoque', 'Desenfoque', 'De vidrio limpio a vidrio esmerilado', 0, 60, 12],
              ['lgBrillo', 'Brillo del borde', 'El reflejo de luz en el canto', 0, 150, 90],
              ['lgTinte', 'Tinte oscuro', 'Más alto, el texto se lee mejor', 0, 60, 16],
              ['lgContenido', 'Afectar al contenido', 'El texto y los iconos de dentro también se doblan', 0, 100, 40]]
            .map(([k, n, d, mi, ma, def]) => `<div class="row"><div class="lbl"><b>${n}</b><span>${d}</span></div><input type="range" min="${mi}" max="${ma}" value="${C[k] ?? def}" data-k="${k}"></div>`).join('')}
          <div class="row"><div class="lbl"><b>Valores de fábrica</b></div><button class="btn" data-lg-reset>Restablecer</button></div></div>
        <div class="card section"><h3>Fondo de pantalla Antuan</h3><div class="walls">${WALLS.map(([n, a, b, c]) => `<button class="wall" data-wall="${a},${b},${c}" style="background:${wallCss(a, b, c)}">${n}</button>`).join('')}</div></div>
        <div class="card section"><h3>Escritorio y sonido</h3>
          <div class="row"><div class="lbl"><b>Escritorio Antuan</b><span>Iconos organizados, reloj y widgets</span></div>${sw(C.desktop !== false, 'data-b="desktop"')}</div>
          <div class="row"><div class="lbl"><b>Sonidos de interfaz</b><span>Microsonidos suaves al usar Antuan</span></div>${sw(C.sounds !== false, 'data-b="sounds"')}</div>
          <div class="row"><div class="lbl"><b>Localizar el ratón al agitarlo</b></div>${sw(C.findMouse !== false, 'data-b="findMouse"')}</div></div>
        <div class="card section"><h3>Esquinas activas</h3>${[['tl', 'Arriba a la izquierda'], ['tr', 'Arriba a la derecha'], ['bl', 'Abajo a la izquierda'], ['br', 'Abajo a la derecha']].map(([k, n]) => {
          const cur = Object.assign({ tl: 'mission', tr: 'none', bl: 'none', br: 'desktop' }, C.corners || {})[k];
          return `<div class="row"><div class="lbl"><b>${n}</b></div><select data-corner="${k}">${[['none', 'Nada'], ['mission', 'Mission Control'], ['launcher', 'Inicio'], ['spotlight', 'Buscar'], ['desktop', 'Mostrar escritorio'], ['lock', 'Bloquear']].map(([v, t]) => `<option value="${v}" ${cur === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div>`;
        }).join('')}</div>`);
      $$('#pane input[type=range]').forEach(paint);
      vistaLiquida();
      pane.addEventListener('click', async (e) => {
        const th = e.target.closest('[data-theme]');
        if (th) {
          setC({ theme: th.dataset.theme, accent: th.dataset.acc, glass: +th.dataset.glass });
          $$('.theme').forEach((x) => x.classList.toggle('on', x === th));
          toast('Tema ' + th.dataset.theme);
          await makeWallpaper(...th.dataset.wall.split(',').map(Number));
          return;
        }
        if (e.target.closest('[data-lg-reset]')) {
          const def = { lgSuperficie: 'squircle', lgBisel: 22, lgLupa: 12, lgRefraccion: 150, lgCromatica: 6, lgGrosor: 110, lgDesenfoque: 12, lgBrillo: 90, lgTinte: 16, lgContenido: 40 };
          setC(def); for (const [k, v] of Object.entries(def)) { const r = $(`#pane [data-k="${k}"]`); if (r) { r.value = v; paint(r); } }
          $$('[data-seg="lgSuperficie"]').forEach((x) => x.setAttribute('aria-pressed', x.dataset.v === 'squircle'));
          toast('Cristal líquido de fábrica'); return;
        }
        const sg = e.target.closest('[data-seg]');
        if (sg) { setC({ [sg.dataset.seg]: sg.dataset.v }); $$(`[data-seg="${sg.dataset.seg}"]`).forEach((x) => x.setAttribute('aria-pressed', x === sg)); return; }
        const a = e.target.closest('[data-acc]'); if (a) { setC({ accent: a.dataset.acc }); $$('[data-acc]').forEach((x) => x.setAttribute('aria-pressed', x === a)); }
        const b = e.target.closest('[data-b]'); if (b) { const on = b.getAttribute('aria-checked') !== 'true'; b.setAttribute('aria-checked', on); setC({ [b.dataset.b]: on }); }
        const ed = e.target.closest('[data-edge]'); if (ed) { setC({ edge: ed.dataset.edge }); $$('[data-edge]').forEach((x) => x.setAttribute('aria-pressed', x === ed)); }
        const w = e.target.closest('[data-wall]'); if (w) { w.style.opacity = .5; const ok = await makeWallpaper(...w.dataset.wall.split(',').map(Number)); w.style.opacity = 1; toast(ok ? 'Fondo aplicado' : 'No se pudo aplicar'); }
      });
      pane.addEventListener('input', (e) => {
        const r = e.target;
        if (r.id === 'accCustom') { setC({ accent: r.value }); return; }
        if (r.dataset.k) { paint(r); clearTimeout(r._t); r._t = setTimeout(() => setC({ [r.dataset.k]: +r.value }), 60); }
      });
      pane.addEventListener('change', (e) => { const s = e.target.closest('[data-corner]'); if (s) setC({ corners: Object.assign({}, C.corners || {}, { [s.dataset.corner]: s.value }) }); });
    }
  },

  access: {
    t: 'Accesibilidad', d: 'Para que Antuan se adapte a ti, no al revés.',
    render(pane) {
      const opts = [['contrast', 'Alto contraste', 'Superficies opacas, bordes y texto más marcados'], ['reduceMotion', 'Menos movimiento', 'Quita rebotes, desenfoques y ampliación'], ['bigText', 'Texto más grande', 'Escala la interfaz de Antuan'], ['focusRings', 'Foco siempre visible', 'Para navegar con teclado']];
      mount(pane, `<div class="card">${opts.map(([k, n, d]) => `<div class="row"><div class="lbl"><b>${n}</b><span>${d}</span></div>${sw(C[k], `data-b="${k}"`)}</div>`).join('')}
        ${soloWin('<div class="row"><div class="lbl"><b>Más opciones de Windows</b><span>Lupa, narrador, subtítulos, filtros de color</span></div><button class="btn" id="winAcc">Abrir</button></div>')}</div>`);
      pane.addEventListener('click', (e) => { const b = e.target.closest('[data-b]'); if (b) { const on = b.getAttribute('aria-checked') !== 'true'; b.setAttribute('aria-checked', on); setC({ [b.dataset.b]: on }); } });
      $('#winAcc')?.addEventListener('click', () => U.openUri('ms-settings:easeofaccess'));
    }
  },

  atajos: {
    t: 'Atajos', d: 'Todo a una combinación de teclas.',
    render(pane) {
      const K = [[['Win'], 'Inicio de Antuan'], [['Win', 'S'], 'Buscar (Spotlight)'], [['Win', 'Tab'], 'Mission Control'], [['Win', 'Alt', 'V'], 'Historial del portapapeles'],
        [['Win', 'Alt', 'C'], 'Selector de color'], [['Win', 'Alt', 'O'], 'Copiar texto de la pantalla'], [['Win', 'Alt', 'Z'], 'Reabrir lo último que cerraste'],
        [['Ctrl', 'Win', 'Alt', '← ↑ → ↓'], 'Mover el dock'], [['Mayús', '+ arrastrar ventana'], 'Zonas de anclaje Antuan'], [['Agitar el ratón'], 'Encontrar el cursor'], [['Esquina superior izquierda'], 'Mission Control']]
        // Antuan OS: las zonas al arrastrar son de Windows; alli Win + flechas coloca las ventanas (openbox)
        .map((x) => (LINUX && x[1] === 'Zonas de anclaje Antuan' ? [['Win', '← →'], 'Ventana a media pantalla'] : x));
      mount(pane, `<div class="card">${K.map(([k, d]) => `<div class="row"><div class="lbl"><b>${d}</b></div><span class="kbd">${k.map((x) => `<i>${x}</i>`).join('')}</span></div>`).join('')}</div>`);
    }
  },

  sistema: {
    t: 'Sistema', d: 'Antuan sustituye la barra de Windows. Todo es reversible.',
    async render(pane) {
      const login = await U.ask('loginItem');
      // Antuan OS: Antuan es la sesion (no hay barra de Windows ni "iniciar con Windows"); salir = cerrar sesion
      mount(pane, `<div class="card">
        ${soloWin(`<div class="row"><div class="lbl"><b>Iniciar Antuan con Windows</b></div>${sw(login, 'id="login"')}</div>
        <div class="row"><div class="lbl"><b>Ocultar la barra de Windows</b><span>Desactívalo si necesitas los iconos de la bandeja de otros programas</span></div>${sw(C.hideWindowsTaskbar !== false, 'data-b="hideWindowsTaskbar"')}</div>`)}
        <div class="row"><div class="lbl"><b>Copia de seguridad de tu configuración</b><span>Guárdala o llévala a otro PC</span></div><button class="btn" id="exp">Exportar</button><button class="btn" id="imp">Importar</button></div>
        <div class="row"><div class="lbl"><b>Reiniciar Antuan</b><span>Por si algo se queda raro</span></div><button class="btn" id="relaunch">Reiniciar</button></div>
        ${LINUX ? '<div class="row"><div class="lbl"><b>Cerrar sesión</b><span>Vuelve a la pantalla de inicio de sesión</span></div><button class="btn danger" id="quit">Cerrar sesión</button></div>'
          : '<div class="row"><div class="lbl"><b>Salir de Antuan</b><span>La barra de Windows vuelve al momento</span></div><button class="btn danger" id="quit">Salir</button></div>'}</div>
        <p class="faint section">Antuan 1.0 · tu escritorio, hecho a medida.</p>`);
      $('#login')?.addEventListener('click', (e) => { const on = e.currentTarget.getAttribute('aria-checked') !== 'true'; e.currentTarget.setAttribute('aria-checked', on); U.config({ startWithWindows: on }); });
      pane.addEventListener('click', (e) => { const b = e.target.closest('[data-b]'); if (b) { const on = b.getAttribute('aria-checked') !== 'true'; b.setAttribute('aria-checked', on); setC({ [b.dataset.b]: on }); } });
      $('#exp').addEventListener('click', async () => toast((await U.ask('exportConfig')) ? 'Configuración guardada' : 'Cancelado'));
      $('#imp').addEventListener('click', async () => toast((await U.ask('importConfig')) ? 'Configuración importada' : 'Cancelado'));
      $('#relaunch').addEventListener('click', () => U.cmd('relaunch'));
      $('#quit').addEventListener('click', () => U.quit());
    }
  }
};

if (LINUX) SECTIONS.sistema.d = 'Tu escritorio Antuan OS: copia de seguridad, reinicio y sesión.';

/* ---------------- Juegos: detalle ---------------- */
function paintGameState(st) {
  const el = $('#gstate'); if (!el) return;
  el.innerHTML = st ? `<div class="tip ok" style="margin-bottom:14px"><span class="ic">${icon('game')}</span><span><b>Modo Juego activo · ${esc(st.juego)}</b><br><span class="muted">${esc(st.hechos.join(' · '))}</span></span><button class="btn" id="gstop">Terminar</button></div>` : '';
  if (st) $('#gstop').addEventListener('click', async () => { await U.ask('gameStop'); paintGameState(null); toast('Modo Juego terminado'); });
}
U.on('game-state', (st) => { if (current === 'juegos') paintGameState(st); });

function hopsHtml(hops) {
  if (!hops || !hops.length) return '<div class="empty">No se pudo trazar.</div>';
  const max = Math.max(60, ...hops.map((h) => h.ms || 0));
  return `<div class="hops">${hops.map((h) => `<div class="hop"><span class="faint">${h.salto}</span><span>${h.ip ? esc(h.ip) : '<span class="faint">sin respuesta</span>'}<div class="b" style="--w:${h.ms ? Math.max(2, h.ms / max * 100) : 0}%;--c:${!h.ms ? 'transparent' : h.ms < 30 ? 'var(--ok)' : h.ms < 70 ? 'var(--warn)' : 'var(--bad)'}"></div></span><span>${h.ms != null ? h.ms + ' ms' : '–'}</span></div>`).join('')}</div>
    <p class="faint" style="margin:10px 0 0;font-size:12px">Si el retraso salta en los primeros saltos, el problema es tu Wi-Fi o router; si salta más lejos, es la operadora o el servidor.</p>`;
}

async function gameDetail(g) {
  const pane = $('#pane');
  timers.forEach(clearInterval); timers = [];
  current = 'juego:' + g.id;
  $('#title').textContent = g.nombre; $('#sub').textContent = g.plataforma + (g.carpeta ? ' · ' + g.carpeta : '');
  const ban = g.portada ? `background-image:url('${g.portada}')` : `background:linear-gradient(135deg, hsl(${(g.nombre.length * 47) % 360} 45% 30%), #0b0d12)`;
  const o = Object.assign({ energia: true, gpu: true, prioridad: true, onedrive: true, grabacion: true }, C.gameOpts || {});
  // Antuan OS: GPU por app, OneDrive y Game Bar son de Windows (registro); alli se usa gamemode
  const OPT = LINUX ? [['energia', 'Energía al máximo mientras juegas', 'Vuelve a tu modo al cerrar el juego'], ['prioridad', 'GameMode para el juego', 'Prioridad y procesador a tope mientras juegas']]
    : [['energia', 'Energía al máximo mientras juegas', 'Vuelve a tu modo al cerrar el juego'], ['gpu', 'Forzar la GPU de alto rendimiento', 'Igual que en Ajustes > Gráficos'], ['prioridad', 'Prioridad alta para el juego', 'Windows le da preferencia frente a lo demás'], ['onedrive', 'Pausar OneDrive', 'Deja de sincronizar y de usar disco y red'], ['grabacion', 'Apagar la grabación en segundo plano', 'Xbox Game Bar deja de grabar continuamente']];
  mount(pane, `<div class="gbanner" style="${ban}"><div><span class="pill">${esc(g.plataforma)}</span><h2>${esc(g.nombre)}</h2></div><button class="btn primary big" id="play">${icon('play')}Jugar optimizado</button></div>
    <div class="gdetail section"><div>
      <div class="card"><h3>Antes de jugar</h3><div class="tips" id="checks">${loading('Revisando tu PC…')}</div></div>
      <div class="card section"><h3>Optimizaciones</h3>${OPT.map(([k, n, d]) => `<div class="row"><div class="lbl"><b>${n}</b><span>${d}</span></div>${sw(o[k], `data-o="${k}"`)}</div>`).join('')}</div>
    </div><div>
      <div class="card"><h3>Ping y ruta</h3><div id="ping" class="muted">Durante la partida, Antuan detecta el servidor del juego y mide su ping.</div>
        <div class="btns" style="margin-top:12px"><button class="btn" id="srv">Servidor del juego</button><button class="btn" id="route">Ruta</button></div></div>
      <div class="card section"><h3>Gestor de rutas</h3><div id="warp" class="muted">${loading()}</div></div>
      <div class="btns section"><button class="btn" id="back">${icon('arrow')}Volver a la biblioteca</button></div>
    </div></div>`);
  $('#back').addEventListener('click', () => go('juegos'));
  pane.addEventListener('click', (e) => { const s = e.target.closest('[data-o]'); if (s) { const on = s.getAttribute('aria-checked') !== 'true'; s.setAttribute('aria-checked', on); setC({ gameOpts: Object.assign({}, C.gameOpts || {}, { [s.dataset.o]: on }) }); } });
  $('#play').addEventListener('click', async (e) => {
    e.currentTarget.innerHTML = '<i class="spin"></i>Preparando…';
    const hechos = await U.ask('gamePlay', g.id);
    e.currentTarget.innerHTML = icon('play') + 'Jugando';
    toast(hechos && hechos.length ? 'Listo: ' + hechos.join(', ') : 'Lanzando ' + g.nombre);
  });
  let target = null;
  $('#srv').addEventListener('click', async () => {
    const list = await U.ask('gameServers');
    if (!list || !list.length) { $('#ping').innerHTML = 'Abre el juego y entra en una partida; después pulsa de nuevo. <span class="faint">(Solo se ven las conexiones TCP; muchos juegos usan UDP).</span>'; return; }
    target = list[0].ip;
    const rs = await Promise.all(list.slice(0, 4).map((s) => G('ping', s.ip, 5)));
    $('#ping').innerHTML = list.slice(0, 4).map((s, i) => `<div class="row"><div class="lbl"><b>${esc(s.ip)}</b><span>puerto ${s.puerto}</span></div><span class="pill ${rs[i]?.media < 50 ? 'ok' : rs[i]?.media < 90 ? 'warn' : 'bad'}">${rs[i]?.media ?? '–'} ms</span></div>`).join('');
  });
  $('#route').addEventListener('click', async () => { $('#ping').innerHTML = loading('Trazando ruta…'); $('#ping').innerHTML = hopsHtml(await G('rutaHasta', target || '1.1.1.1')); });
  const paintWarp = (w) => {
    $('#warp').innerHTML = !w.instalado
      ? `Un túnel puede bajar el ping si tu operadora enruta mal. Con <b>Cloudflare WARP</b> (gratis) Antuan compara la ruta directa con el túnel y te dice cuál va mejor.<div class="btns" style="margin-top:10px"><button class="btn" data-uri="https://one.one.one.one/">Conseguir WARP</button></div>`
      : `<div class="row" style="padding-top:0"><div class="lbl"><b>Cloudflare WARP</b><span>${w.conectado ? 'Túnel activo' : 'Ruta directa'}</span></div><button class="btn" id="wtoggle">${w.conectado ? 'Desconectar' : 'Conectar'}</button></div><button class="btn" id="wcompare">Comparar ping directo vs túnel</button><div id="wres"></div>`;
    $('#warp [data-uri]')?.addEventListener('click', (e) => U.openUri(e.currentTarget.dataset.uri));
    $('#wtoggle')?.addEventListener('click', async () => paintWarp(await U.ask('warp', w.conectado ? 'desconectar' : 'conectar')));
    $('#wcompare')?.addEventListener('click', async () => {
      const host = target || '1.1.1.1';
      $('#wres').innerHTML = loading('Midiendo las dos rutas…');
      await U.ask('warp', 'desconectar'); await new Promise((r) => setTimeout(r, 1500));
      const d = await G('ping', host, 8);
      await U.ask('warp', 'conectar'); await new Promise((r) => setTimeout(r, 3000));
      const t = await G('ping', host, 8);
      const best = (t?.media ?? 999) < (d?.media ?? 999) ? 'túnel' : 'directa';
      if (best === 'directa') await U.ask('warp', 'desconectar');
      $('#wres').innerHTML = `<div class="row"><div class="lbl"><b>Directa</b></div><span class="pill">${d?.media ?? '–'} ms</span></div><div class="row"><div class="lbl"><b>Túnel WARP</b></div><span class="pill">${t?.media ?? '–'} ms</span></div><div class="tip ok"><span class="ic">${icon('spark')}</span><span>Mejor ruta: <b>${best}</b>. Ya está aplicada.</span></div>`;
    });
  };
  U.ask('warp').then(paintWarp);
  const avisos = await U.ask('gameCheck');
  if (!current.startsWith('juego:')) return;
  $('#checks').innerHTML = avisos && avisos.length ? avisos.map((a) => `<div class="tip ${a.nivel}"><span class="ic">${icon(a.nivel === 'alto' ? 'bell' : 'info')}</span><span>${esc(a.texto)}</span>${a.accion ? `<button class="btn" data-uri="${a.accion}">Arreglar</button>` : ''}</div>`).join('')
    : `<div class="tip ok"><span class="ic">${icon('spark')}</span><span>Todo listo para jugar al máximo.</span></div>`;
  $$('#checks [data-uri]').forEach((b) => b.addEventListener('click', () => U.openUri(b.dataset.uri)));
}

/* ---------------- Fondos Antuan generados ---------------- */
function wallCss(a, b, c) {
  return `radial-gradient(60% 70% at 20% 90%, hsl(${a} 60% 40% / .7), transparent 70%), radial-gradient(50% 55% at 88% 10%, hsl(${b} 55% 38% / .5), transparent 70%), radial-gradient(40% 45% at 62% 58%, hsl(${c} 55% 40% / .4), transparent 70%), #07080b`;
}
async function makeWallpaper(a, b, c) {
  const W = Math.round(screen.width * devicePixelRatio), H = Math.round(screen.height * devicePixelRatio);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  g.fillStyle = '#07080b'; g.fillRect(0, 0, W, H);
  const blob = (x, y, r, h, alpha) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `hsla(${h},60%,40%,${alpha})`); gr.addColorStop(.6, `hsla(${h},60%,30%,${alpha * .35})`); gr.addColorStop(1, `hsla(${h},60%,30%,0)`); g.fillStyle = gr; g.fillRect(0, 0, W, H); };
  blob(W * .2, H * .92, W * .62, a, .55); blob(W * .88, H * .08, W * .48, b, .35); blob(W * .62, H * .58, W * .38, c, .28);
  const v = g.createRadialGradient(W / 2, H / 2, W * .3, W / 2, H / 2, W * .8); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.55)'); g.fillStyle = v; g.fillRect(0, 0, W, H);
  // grano fino para que no haya bandas
  const n = document.createElement('canvas'); n.width = n.height = 160; const ng = n.getContext('2d'), id = ng.createImageData(160, 160);
  for (let i = 0; i < id.data.length; i += 4) { const x = Math.random() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = x; id.data[i + 3] = 10; }
  ng.putImageData(id, 0, 0); g.fillStyle = g.createPattern(n, 'repeat'); g.fillRect(0, 0, W, H);
  return U.ask('setWallpaper', cv.toDataURL('image/png'));
}

go(new URLSearchParams(location.search).get('s') || 'resumen');
})();
