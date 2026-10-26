/* Liquid Glass de Antuan: refraccion real tipo iOS 26 sobre el fondo de pantalla.
 * Por cada capa .wp (dock, bandeja...) se genera un mapa de desplazamiento con el perfil de un borde
 * "squircle" convexo (ley de Snell, vidrio n=1.5) y un mapa especular del canto. Un filtro SVG desplaza el
 * fondo con esos mapas, separando rojo, verde y azul con fuerzas distintas (aberracion cromatica), y
 * suma el brillo del canto. Basado en el articulo de kube.io sobre el Liquid Glass de Apple.
 */
(() => {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const MARGEN = 40;           // la capa del fondo sobresale 40 px (igual que .wp::before)
  const N = 128;               // muestras del perfil del bisel
  const AJUSTES = { bisel: 22, grosor: 70, refraccion: 1, cromatica: 0.10, desenfoque: 0.6, especular: 0.9, saturacion: 1.35 };

  // Perfil del borde: superficie convexa tipo squircle, altura 0 en el canto y 1 donde acaba el bisel
  const altura = (x) => Math.pow(1 - Math.pow(1 - x, 4), 1 / 4);

  // Desplazamiento (en px) que sufre la luz en cada punto del bisel: un rayo vertical entra en una superficie
  // inclinada y se tuerce segun Snell. Devuelve la tabla normalizada (0..1) y el maximo en px.
  function perfil(bisel, grosor) {
    const n1 = 1, n2 = 1.5, t = new Float32Array(N + 1);
    let max = 0;
    for (let i = 0; i <= N; i++) {
      const x = Math.min(Math.max(i / N, 0.0005), 0.9995), dx = 0.001;
      const pendiente = (altura(Math.min(x + dx, 1)) - altura(Math.max(x - dx, 0))) / (2 * dx) * (grosor / bisel);
      const incid = Math.atan(pendiente);                       // angulo entre el rayo y la normal
      const refr = Math.asin(Math.min(1, (n1 / n2) * Math.sin(incid)));
      const d = Math.tan(incid - refr) * grosor * (1 - altura(x) * 0.5);
      t[i] = d; if (d > max) max = d;
    }
    for (let i = 0; i <= N; i++) t[i] = max ? t[i] / max : 0;
    return { tabla: t, max };
  }

  // Distancia al canto y normal hacia fuera de un rectangulo redondeado (w x h, radio r) en el punto (x, y)
  function campo(x, y, w, h, r) {
    const cx = x - w / 2, cy = y - h / 2, sx = Math.sign(cx) || 1, sy = Math.sign(cy) || 1;
    const qx = Math.abs(cx) - (w / 2 - r), qy = Math.abs(cy) - (h / 2 - r);
    if (qx > 0 && qy > 0) {
      const l = Math.hypot(qx, qy) || 1;
      return { d: r - l, nx: sx * qx / l, ny: sy * qy / l };
    }
    if (qx > qy) return { d: r - qx, nx: sx, ny: 0 };
    return { d: r - qy, nx: 0, ny: sy };
  }

  function mapas(w, h, r, a) {
    const bisel = Math.max(4, Math.min(a.bisel, r, w / 2, h / 2));
    const { tabla, max } = perfil(bisel, a.grosor);
    const cd = document.createElement('canvas'), cs = document.createElement('canvas');
    cd.width = cs.width = w; cd.height = cs.height = h;
    const gd = cd.getContext('2d'), gs = cs.getContext('2d');
    const id = gd.createImageData(w, h), is = gs.createImageData(w, h);
    const L = { x: -0.55, y: -0.83 };           // luz arriba a la izquierda, como en iOS
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4, c = campo(x + 0.5, y + 0.5, w, h, r);
      let dx = 0, dy = 0;
      if (c.d >= 0 && c.d < bisel) {
        const m = tabla[Math.round((c.d / bisel) * N)];
        // se toma la imagen de mas hacia fuera: el fondo que rodea el cristal se curva hacia dentro del canto
        dx = c.nx * m; dy = c.ny * m;
      }
      id.data[o] = 128 + dx * 127; id.data[o + 1] = 128 + dy * 127; id.data[o + 2] = 128; id.data[o + 3] = 255;
      // brillo del canto: fino, mas fuerte donde la normal mira a la luz (y un reflejo suave en el lado opuesto)
      if (c.d >= 0 && c.d < 3.2) {
        const cara = c.nx * L.x + c.ny * L.y, k = Math.pow(Math.max(cara, 0), 1.6) + 0.35 * Math.pow(Math.max(-cara, 0), 2);
        const f = 1 - c.d / 3.2, al = Math.min(1, k * f * f * 1.15);
        is.data[o] = is.data[o + 1] = is.data[o + 2] = 255; is.data[o + 3] = al * 255;
      }
    }
    gd.putImageData(id, 0, 0); gs.putImageData(is, 0, 0);
    return { desp: cd.toDataURL(), espec: cs.toDataURL(), escala: max * 2 * a.refraccion };
  }

  let defs = null, cuenta = 0;
  function contenedor() {
    if (defs) return defs;
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    defs = document.createElementNS(NS, 'defs'); svg.appendChild(defs);
    document.body.appendChild(svg);
    return defs;
  }
  const el = (tag, at, padre) => { const e = document.createElementNS(NS, tag); for (const k in at) e.setAttribute(k, at[k]); if (padre) padre.appendChild(e); return e; };

  // Filtro con aberracion cromatica: tres desplazamientos (R, G, B) con fuerzas un poco distintas
  function crearFiltro(idF) {
    const f = el('filter', { id: idF, x: '0', y: '0', width: '100%', height: '100%', 'color-interpolation-filters': 'sRGB', filterUnits: 'objectBoundingBox', primitiveUnits: 'userSpaceOnUse' }, contenedor());
    el('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: '0.6', result: 'b', 'data-k': 'blur' }, f);
    el('feImage', { result: 'm', preserveAspectRatio: 'none', 'data-k': 'desp' }, f);
    const canales = [['r', '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0'], ['g', '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0'], ['bl', '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0']];
    for (const [c, m] of canales) {
      el('feDisplacementMap', { in: 'b', in2: 'm', xChannelSelector: 'R', yChannelSelector: 'G', result: 'd' + c, 'data-k': 'esc-' + c }, f);
      el('feColorMatrix', { in: 'd' + c, type: 'matrix', values: m, result: 'c' + c }, f);
    }
    el('feBlend', { in: 'cr', in2: 'cg', mode: 'screen', result: 'rg' }, f);
    el('feBlend', { in: 'rg', in2: 'cbl', mode: 'screen', result: 'rgb' }, f);
    el('feColorMatrix', { in: 'rgb', type: 'saturate', values: '1.35', result: 'sat', 'data-k': 'sat' }, f);
    el('feImage', { result: 'e', preserveAspectRatio: 'none', 'data-k': 'espec' }, f);
    const ct = el('feComponentTransfer', { in: 'e', result: 'ef' }, f);
    el('feFuncA', { type: 'linear', slope: '0.9', 'data-k': 'alfa' }, ct);
    el('feBlend', { in: 'ef', in2: 'sat', mode: 'screen' }, f);
    return f;
  }

  const capas = new Set();
  function actualizar(c) {
    const r0 = c.wp.getBoundingClientRect();
    const w = Math.round(r0.width), h = Math.round(r0.height);
    if (w < 8 || h < 8) return;
    const radio = Math.min(parseFloat(getComputedStyle(c.wp).borderTopLeftRadius) || 0, w / 2, h / 2);
    const clave = `${w}x${h}r${radio}`;
    if (clave === c.clave) return;
    c.clave = clave;
    const a = AJUSTES, m = mapas(w, h, radio, a), q = (k) => c.filtro.querySelector(`[data-k="${k}"]`);
    for (const k of ['desp', 'espec']) {
      const im = q(k);
      im.setAttribute('href', m[k]); im.setAttribute('x', MARGEN); im.setAttribute('y', MARGEN);
      im.setAttribute('width', w); im.setAttribute('height', h);
    }
    q('esc-r').setAttribute('scale', (m.escala * (1 + a.cromatica)).toFixed(2));
    q('esc-g').setAttribute('scale', m.escala.toFixed(2));
    q('esc-bl').setAttribute('scale', (m.escala * (1 - a.cromatica)).toFixed(2));
    q('blur').setAttribute('stdDeviation', a.desenfoque);
    q('sat').setAttribute('values', a.saturacion);
    q('alfa').setAttribute('slope', a.especular);
  }

  function engancha(wp) {
    if (wp._liquid) return;
    const idF = 'antuan-lg-' + (++cuenta);
    const lente = document.createElement('div');
    lente.className = 'wp-lente';
    lente.style.filter = `url(#${idF})`;
    wp.appendChild(lente);
    const c = { wp, lente, filtro: crearFiltro(idF), clave: '' };
    wp._liquid = c; capas.add(c);
    new ResizeObserver(() => actualizar(c)).observe(wp);
    actualizar(c);
  }

  window.LiquidGlass = {
    ajustes: AJUSTES,
    iniciar(sel = '.wp') { document.documentElement.classList.add('lg'); document.querySelectorAll(sel).forEach(engancha); },
    ajustar(nuevos) { Object.assign(AJUSTES, nuevos); for (const c of capas) { c.clave = ''; actualizar(c); } },
    apagar() { document.documentElement.classList.remove('lg'); }
  };
})();
