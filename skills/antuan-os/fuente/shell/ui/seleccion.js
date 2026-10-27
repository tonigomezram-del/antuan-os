/* Seleccion liquida del dock: un cuadrito de cristal liquido detras del icono que tiene el raton encima.
 * Si el raton no esta sobre ningun icono, se queda en la app que se esta usando (la que tiene el foco).
 * Se desliza de un icono a otro con un muelle: se estira en la direccion en que va y rebota al llegar.
 * Vale para todos los estilos de dock (Liquido, Gota y Clasico).
 */
(() => {
  'use strict';
  const listo = (fn) => (window.UMB ? fn(window.UMB) : addEventListener('umbra-ready', () => fn(window.UMB), { once: true }));
  listo((M) => {
    const dock = document.getElementById('dock');
    const sel = document.createElement('div');
    sel.id = 'dockSel'; sel.setAttribute('aria-hidden', 'true');
    // delante del cristal del dock y detras de los iconos
    const wp = dock.querySelector('.wp');
    if (wp && wp.nextSibling) dock.insertBefore(sel, wp.nextSibling); else dock.prepend(sel);

    // muelle de 4 valores: x, y (centro) y ancho/alto; el estiramiento sale de la velocidad
    const m = { x: 0, y: 0, w: 0, h: 0, vx: 0, vy: 0, vw: 0, vh: 0, X: 0, Y: 0, Wd: 0, Hd: 0, vivo: false, t: 0, visible: false };
    let objetivo = null, encima = null;

    function medir(el) {
      const r = el.getBoundingClientRect(), d = dock.getBoundingClientRect();
      // en modo Gota el dock es una capa de toda la pantalla: las coordenadas valen igual
      return { x: r.left - d.left + r.width / 2, y: r.top - d.top + r.height / 2, w: r.width, h: r.height };
    }
    function pinta() {
      const ax = Math.abs(m.vx), ay = Math.abs(m.vy);
      const est = Math.min(0.35, Math.max(ax, ay) / 2600);      // estira en el eje del movimiento, nunca en diagonal
      const sx = ax >= ay ? 1 + est : 1 - est * 0.5, sy = ax >= ay ? 1 - est * 0.5 : 1 + est;
      const pad = 7;
      sel.style.width = (m.w + pad * 2) + 'px'; sel.style.height = (m.h + pad * 2) + 'px';
      sel.style.transform = `translate(${(m.x - m.w / 2 - pad).toFixed(1)}px, ${(m.y - m.h / 2 - pad).toFixed(1)}px) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`;
    }
    function paso(t) {
      const dt = m.t ? Math.min(0.032, (t - m.t) / 1000) : 0.016; m.t = t;
      const k = 340, c = 24;
      m.vx += ((m.X - m.x) * k - m.vx * c) * dt; m.x += m.vx * dt;
      m.vy += ((m.Y - m.y) * k - m.vy * c) * dt; m.y += m.vy * dt;
      m.vw += ((m.Wd - m.w) * k - m.vw * c) * dt; m.w += m.vw * dt;
      m.vh += ((m.Hd - m.h) * k - m.vh * c) * dt; m.h += m.vh * dt;
      pinta();
      if (Math.abs(m.X - m.x) + Math.abs(m.Y - m.y) + Math.abs(m.Wd - m.w) < 0.3 && Math.abs(m.vx) + Math.abs(m.vy) < 2) { m.vivo = false; m.t = 0; m.vx = m.vy = 0; pinta(); return; }
      requestAnimationFrame(paso);
    }
    function ir(el, saltar) {
      objetivo = el;
      if (!el) { sel.classList.remove('on'); m.visible = false; return; }
      const r = medir(el);
      m.X = r.x; m.Y = r.y; m.Wd = r.w; m.Hd = r.h;
      if (!m.visible || saltar || M.S.reduceMotion) { m.x = r.x; m.y = r.y; m.w = r.w; m.h = r.h; m.vx = m.vy = 0; pinta(); }
      m.visible = true; sel.classList.add('on');
      sel.classList.toggle('encima', el === encima);
      if (!m.vivo && !M.S.reduceMotion) { m.vivo = true; requestAnimationFrame(paso); }
    }
    const enfocado = () => dock.querySelector('.dock-item.focused');
    const recolocar = () => ir(encima && encima.isConnected ? encima : enfocado(), false);

    dock.addEventListener('pointerover', (e) => {
      const it = e.target.closest('.dock-item');
      if (!it || it === encima) return;
      encima = it; ir(it);
    });
    dock.addEventListener('pointerleave', () => { encima = null; ir(enfocado()); });
    document.addEventListener('pointerover', (e) => { if (encima && !e.target.closest('#dock')) { encima = null; ir(enfocado()); } });

    // la app activa cambia, los iconos se mueven (ampliacion, Gota, otro borde): se vuelve a medir
    let pend = false;
    new MutationObserver((rs) => { if (pend || rs.every((r) => r.target === sel)) return; pend = true; requestAnimationFrame(() => { pend = false; recolocar(); }); }).observe(dock, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
    addEventListener('resize', () => requestAnimationFrame(recolocar));
    requestAnimationFrame(recolocar);
  });
})();
