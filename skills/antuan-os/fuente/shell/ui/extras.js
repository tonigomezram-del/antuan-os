// Panel rapido completo, portapapeles, esquinas activas, localizar raton, restaurar sesion y avisos.
(() => {
const ready = (fn) => (window.UMB ? fn(window.UMB) : addEventListener('umbra-ready', () => fn(window.UMB), { once: true }));
ready((M) => {
const { $, $$, esc, U } = M;

/* =================== Avisos desde el nucleo =================== */
U.on('toast', (ic, text) => M.toast(icon(ic) + esc(text)));
U.on('wallpaper', (url) => { document.documentElement.style.setProperty('--wp-img', `url("${url}")`); });
U.on('config-changed', (patch) => {
  Object.assign(M.S, patch); M.apply(); syncAwake();
  if ('edge' in patch) M.set({ edge: patch.edge }, true);
  if ('pinned' in patch || 'dockSize' in patch || 'logoStyle' in patch) M.renderDock();
});

/* =================== Panel rapido =================== */
const quick = $('#quick');
let mixOpen = false, mediaT = null;
const POWER = { eficiencia: 'Ahorro', equilibrado: 'Equilibrado', rendimiento: 'Rendimiento' };
const NEXT_POWER = { eficiencia: 'equilibrado', equilibrado: 'rendimiento', rendimiento: 'eficiencia' };

function syncAwake() { $('#tglAwake').setAttribute('aria-pressed', !!M.S.keepAwake); }
$('#tglAwake').addEventListener('click', () => { U.cmd('toggleAwake'); M.S.keepAwake = !M.S.keepAwake; syncAwake(); M.tick(); });
let powerMode = null;
$('#tglPower').addEventListener('click', async () => {
  const next = NEXT_POWER[powerMode] || 'equilibrado';
  const r = await U.ask('sys', 'power-set ' + next);
  if (r && r.ok) { powerMode = r.mode; paintPower(r); M.tick(); }
});
function paintPower(r) {
  powerMode = r.mode;
  $('#powerName').textContent = (POWER[r.mode] || 'Equilibrado') + (r.ac ? '' : ' · batería');
  $('#tglPower').setAttribute('aria-pressed', r.mode === 'rendimiento');
}

async function refreshQuickPlus() {
  syncAwake();
  U.ask('sys', 'power?').then((r) => r && r.ok && paintPower(r));
  U.ask('sys', 'battery?').then((b) => {
    if (!b || !b.ok || !b.present) { $('#batt').style.display = 'none'; return; }
    $('#battPct').textContent = b.percent + ' %' + (b.charging ? ' · cargando' : '');
    $('#battHealth').textContent = b.health ? ' · salud ' + b.health + ' %' : '';
  });
  U.ask('netInfo').then((n) => {
    $('#wifiName').textContent = n && n.ssid ? n.ssid : n && n.tipo === 'ethernet' ? 'Cable' : 'Sin conexión';
    $('#tglWifi').setAttribute('aria-pressed', !!(n && (n.ssid || n.tipo)));
  });
  refreshMedia();
  clearInterval(mediaT);
  mediaT = setInterval(() => { if (M.openP === quick) refreshMedia(); else clearInterval(mediaT); }, 2500);
  if (mixOpen) renderMixer();
}
new MutationObserver(() => { if (quick.classList.contains('open')) refreshQuickPlus(); }).observe(quick, { attributes: true, attributeFilter: ['class'] });

/* Musica real (lo que suene en Spotify, el navegador, etc.) */
let lastCover = null;
async function refreshMedia() {
  const m = await U.ask('sys', 'media?');
  const box = $('#media');
  if (!m || !m.ok || m.none) {
    box.classList.remove('has', 'playing');
    $('#mTitle').textContent = 'Nada sonando'; $('#mArtist').textContent = 'Pon música y aparecerá aquí';
    return;
  }
  box.classList.add('has');
  box.classList.toggle('playing', !!m.playing);
  $('#mTitle').textContent = m.title || 'Sin título';
  $('#mArtist').textContent = [m.artist, m.app && m.app.replace(/\.exe$/i, '').replace(/^.*!/, '')].filter(Boolean).join(' · ');
  $('#mPlay').innerHTML = icon(m.playing ? 'pause' : 'play');
  if (m.cover !== lastCover) {
    lastCover = m.cover;
    const img = m.cover ? await U.ask('mediaCover', m.cover) : null;
    $('#mCover').style.backgroundImage = img ? `url("${img}")` : '';
    $('#mCover').classList.toggle('img', !!img);
  }
}
$('#media').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-mcmd]'); if (!b) return;
  await U.ask('sys', 'media-cmd ' + b.dataset.mcmd); M.tick();
  setTimeout(refreshMedia, 350);
});

/* Volumen por app y salida de audio */
$('#mixBtn').addEventListener('click', () => {
  mixOpen = !mixOpen;
  $('#mixer').classList.toggle('open', mixOpen);
  $('#mixBtn').classList.toggle('on', mixOpen);
  if (mixOpen) renderMixer();
  M.tick(); setTimeout(M.positionPanels, 20);
});
async function renderMixer() {
  const [s, o] = await Promise.all([U.ask('sys', 'apps-audio?'), U.ask('sys', 'outputs?')]);
  const sessions = (s && s.sessions || []).filter((x) => !x.system || x.active);
  const devs = o && o.devices || [];
  $('#mixer').innerHTML =
    (devs.length > 1 ? `<div class="mx-cap">Salida</div><div class="mx-outs">${devs.map((d) => `<button class="mx-out ${d.default ? 'on' : ''}" data-dev="${esc(d.id)}">${icon('volume')}<span>${esc(d.name)}</span></button>`).join('')}</div>`
      : devs.length ? `<div class="mx-cap">Salida · ${esc(devs[0].name)}</div>` : '') +
    `<div class="mx-cap">Apps</div>` +
    (sessions.length ? sessions.map((x) => `<div class="mx-row" data-pid="${x.pid}"><span class="mx-n">${esc(x.name)}</span><input type="range" min="0" max="100" value="${x.level}" aria-label="Volumen de ${esc(x.name)}"></div>`).join('')
      : '<div class="mx-empty">Ninguna app está sonando</div>');
  $$('#mixer input[type=range]').forEach((r) => { M.$('#mixer'); r.style.setProperty('--v', r.value + '%'); });
  setTimeout(M.positionPanels, 10);
}
$('#mixer').addEventListener('input', (e) => {
  const r = e.target; if (r.type !== 'range') return;
  r.style.setProperty('--v', r.value + '%');
  const pid = r.closest('.mx-row').dataset.pid;
  clearTimeout(r._t); r._t = setTimeout(() => U.ask('sys', `app-vol ${pid} ${r.value}`), 40);
});
$('#mixer').addEventListener('click', async (e) => {
  const d = e.target.closest('.mx-out'); if (!d) return;
  await U.ask('outputSet', d.dataset.dev); M.tick(); renderMixer();
});

/* Calendario del mes */
function renderCal() {
  const now = new Date(), y = now.getFullYear(), m = now.getMonth();
  const first = (new Date(y, m, 1).getDay() + 6) % 7, days = new Date(y, m + 1, 0).getDate();
  const head = ['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => `<i>${d}</i>`).join('');
  let cells = '';
  for (let i = 0; i < first; i++) cells += '<span></span>';
  for (let d = 1; d <= days; d++) cells += `<span class="${d === now.getDate() ? 'today' : ''}">${d}</span>`;
  $('#cal').innerHTML = `<div class="cal-h">${now.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</div><div class="cal-g">${head}${cells}</div>`;
}
const calp = $('#calpanel');
new MutationObserver(() => {
  if (!calp.classList.contains('open')) return;
  const d = new Date();
  $('#cpDay').textContent = d.toLocaleDateString('es-ES', { weekday: 'long' });
  $('#cpDate').textContent = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  renderCal();
}).observe(calp, { attributes: true, attributeFilter: ['class'] });
$('#cpNotif').addEventListener('click', () => { M.closePanels(false); U.keys([0x5B, 0x4E]); });
$('#cpCal').addEventListener('click', () => { M.closePanels(false); U.openUri('outlookcal:'); });
$('#quickUmbra').replaceWith($('#quickUmbra').cloneNode(true));
$('#quickUmbra').addEventListener('click', () => { M.closePanels(false); U.cmd('centro'); });

/* =================== Portapapeles (Win+Alt+V) =================== */
const clip = document.createElement('section');
clip.id = 'clip';
clip.className = 'panel glass';
clip.innerHTML = `<div class="clip-h"><b>Portapapeles</b><span class="spacer"></span>
  <label class="search mini">${icon('search')}<input id="clipq" placeholder="Buscar" autocomplete="off"></label>
  <button class="icon-btn" id="clipClear" data-tip="Borrar todo menos lo fijado">${icon('x')}</button></div>
  <div class="clip-list" id="clipList"></div>
  <div class="sp-foot"><span><b>↵</b> pegar</span><span><b>Mayús ↵</b> solo copiar</span><span>Fija lo importante con ${icon('pin')}</span></div>`;
document.body.appendChild(clip);
let clipItems = [], clipSel = 0;
async function openClip() {
  if (M.openP === clip) { M.closePanels(true); return; }
  clipItems = await U.ask('clipboard') || [];
  M.openPanel(clip, null);
  $('#clipq').value = ''; clipSel = 0; renderClip();
  setTimeout(() => $('#clipq').focus(), 30);
}
const ago = (t) => { const s = (Date.now() - t) / 1000; return s < 60 ? 'ahora' : s < 3600 ? Math.round(s / 60) + ' min' : s < 86400 ? Math.round(s / 3600) + ' h' : Math.round(s / 86400) + ' d'; };
function renderClip() {
  const q = $('#clipq').value.toLowerCase();
  const list = clipItems.map((c, i) => ({ c, i })).filter(({ c }) => !q || (c.type === 'text' && c.text.toLowerCase().includes(q)));
  $('#clipList').innerHTML = list.length ? list.map(({ c, i }, n) => `<div class="clip-it ${n === clipSel ? 'sel' : ''}" data-i="${i}">
      ${c.type === 'img' ? `<img src="${c.thumb}" alt="">` : `<div class="clip-t">${esc(c.text.slice(0, 400))}</div>`}
      <div class="clip-m"><span>${c.type === 'img' ? `Imagen ${c.w}×${c.h}` : c.text.length + ' caracteres'} · ${ago(c.time)}</span>
      <button class="clip-pin ${c.pin ? 'on' : ''}" data-pin>${icon('pin')}</button><button data-del>${icon('x')}</button></div></div>`).join('')
    : '<div class="mx-empty">Lo que copies aparecerá aquí</div>';
}
$('#clipq').addEventListener('input', () => { clipSel = 0; renderClip(); });
$('#clipq').addEventListener('keydown', (e) => {
  const n = $$('.clip-it', clip).length;
  if (e.key === 'ArrowDown') { clipSel = Math.min(n - 1, clipSel + 1); renderClip(); $('.clip-it.sel', clip)?.scrollIntoView({ block: 'nearest' }); e.preventDefault(); }
  if (e.key === 'ArrowUp') { clipSel = Math.max(0, clipSel - 1); renderClip(); $('.clip-it.sel', clip)?.scrollIntoView({ block: 'nearest' }); e.preventDefault(); }
  if (e.key === 'Enter') { const it = $('.clip-it.sel', clip); if (it) pasteClip(+it.dataset.i, !e.shiftKey); }
});
function pasteClip(i, paste) {
  M.closePanels(true);
  U.cmd('clipPaste', i, paste);
  if (!paste) M.toast(icon('note') + 'Copiado');
}
$('#clipList').addEventListener('click', async (e) => {
  const it = e.target.closest('.clip-it'); if (!it) return;
  const i = +it.dataset.i;
  if (e.target.closest('[data-pin]')) { U.cmd('clipPin', i); clipItems[i].pin = !clipItems[i].pin; renderClip(); return; }
  if (e.target.closest('[data-del]')) { U.cmd('clipDelete', i); clipItems.splice(i, 1); renderClip(); return; }
  pasteClip(i, true);
});
$('#clipClear').addEventListener('click', () => { U.cmd('clipClear'); clipItems = clipItems.filter((c) => c.pin); renderClip(); M.tick(); });
U.on('clipboard', openClip);
addEventListener('umbra-clipboard', openClip);

U.on('quick', () => $('#quickBtn').click());
/* Atajos que vienen del nucleo */
U.on('color-picker', () => U.cmd('colorPicker'));
U.on('ocr', () => U.cmd('ocr'));
U.on('reopen', () => U.cmd('reopen'));

/* =================== Esquinas activas =================== */
const CORNER_ACTIONS = {
  mission: () => window.dispatchEvent(new Event('umbra-mission')),
  launcher: () => $('#launcherBtn').click(),
  spotlight: () => window.dispatchEvent(new Event('umbra-spotlight')),
  desktop: () => U.keys([0x5B, 0x44]),
  lock: () => U.power('lock'),
  none: () => {}
};
const cornerCfg = () => Object.assign({ tl: 'mission', tr: 'none', bl: 'none', br: 'desktop' }, M.S.corners || {});
let cornerT = null, cornerAt = null, cornerLock = 0;
document.addEventListener('mousemove', (e) => {
  const x = e.clientX, y = e.clientY, W = innerWidth - 1, H = innerHeight - 1, c = 3;
  const k = x <= c && y <= c ? 'tl' : x >= W - c && y <= c ? 'tr' : x <= c && y >= H - c ? 'bl' : x >= W - c && y >= H - c ? 'br' : null;
  if (k !== cornerAt) {
    cornerAt = k; clearTimeout(cornerT);
    if (k && Date.now() > cornerLock && cornerCfg()[k] !== 'none') {
      cornerT = setTimeout(() => { cornerLock = Date.now() + 900; (CORNER_ACTIONS[cornerCfg()[k]] || CORNER_ACTIONS.none)(); }, 180);
    }
  }
  findMouse(e);
});

/* =================== Localizar el raton (agitarlo) =================== */
const ring = document.createElement('div');
ring.id = 'findmouse';
document.body.appendChild(ring);
let mv = [], lastShake = 0;
function findMouse(e) {
  if (M.S.findMouse === false) return;
  const t = performance.now();
  mv.push({ x: e.clientX, t });
  mv = mv.filter((p) => t - p.t < 550);
  if (mv.length < 6 || t - lastShake < 1500) return;
  let turns = 0, dist = 0;
  for (let i = 2; i < mv.length; i++) {
    const d1 = mv[i - 1].x - mv[i - 2].x, d2 = mv[i].x - mv[i - 1].x;
    dist += Math.abs(d2);
    if (d1 * d2 < 0 && Math.abs(d1) > 8 && Math.abs(d2) > 8) turns++;
  }
  if (turns >= 4 && dist > 900) {
    lastShake = t;
    ring.style.left = e.clientX + 'px'; ring.style.top = e.clientY + 'px';
    ring.classList.remove('go'); void ring.offsetWidth; ring.classList.add('go');
  }
}

/* =================== Restaurar sesion al encender =================== */
setTimeout(async () => {
  const items = await U.ask('sessionOffer');
  if (!items || !items.length) return;
  const card = document.createElement('div');
  card.id = 'session'; card.className = 'glass hit';
  card.innerHTML = `<div class="ss-icons">${items.slice(0, 5).map((a) => M.tile(a)).join('')}</div>
    <div class="ss-t"><b>¿Continuar donde lo dejaste?</b><span>${items.length} ${items.length === 1 ? 'app' : 'apps'}: ${esc(items.map((a) => a.name).slice(0, 3).join(', '))}${items.length > 3 ? '…' : ''}</span></div>
    <button class="btn primary" data-a="yes">Restaurar</button><button class="icon-btn" data-a="no">${icon('x')}</button>`;
  document.body.appendChild(card);
  requestAnimationFrame(() => card.classList.add('show'));
  const bye = () => { card.classList.remove('show'); setTimeout(() => card.remove(), 400); };
  card.addEventListener('click', (e) => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    if (b.dataset.a === 'yes') { U.cmd('restoreSession'); M.toast(icon('restart') + 'Restaurando tu sesión'); M.whoosh(true); }
    bye();
  });
  setTimeout(bye, 25000);
}, new URLSearchParams(location.search).get('login') === '1' ? 5000 : 1500);
});
})();
