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
  // Mismos valores que la demo de kube.io: bisel 30, grosor 150, refraccion 1.5, desenfoque 0.5, saturacion 1.3
  const AJUSTES = { bisel: 30, grosor: 150, refraccion: 1.5, cromatica: 0.06, desenfoque: 0.5, especular: 1, saturacion: 1.3 };

  // Perfil del borde: superficie convexa tipo squircle, altura 0 en el canto y 1 donde acaba el bisel
  const altura = (x) => Math.pow(1 - Math.pow(1 - x, 4), 1 / 4);

  // Desplazamiento (en px) que sufre la luz en cada punto del bisel: un rayo vertical entra en una superficie
  // inclinada y se tuerce segun Snell. Devuelve la tabla normalizada (0..1) y el maximo en px.
  function perfil(bisel, grosor) {
    const n2 = 1.5, t = new Float32Array(N + 1);
    let max = 0;
    for (let i = 0; i <= N; i++) {
      const x = Math.min(Math.max(i / N, 0.0005), 0.9995), dx = 0.0005;
      const pendiente = (altura(Math.min(x + dx, 1)) - altura(Math.max(x - dx, 0))) / (2 * dx);
      const incid = Math.atan(pendiente);                       // angulo entre el rayo vertical y la normal
      const refr = Math.asin(Math.sin(incid) / n2);
      const d = Math.tan(incid - refr) * (grosor + bisel * (1 - altura(x)));
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
    // el grosor de la demo (150) es para una lente de 140 px de alto: en piezas mas bajas (el dock) se reduce igual
    const { tabla, max } = perfil(bisel, a.grosor * Math.min(1, Math.min(w, h) / 140));
    const cd = document.createElement('canvas'), cs = document.createElement('canvas');
    cd.width = cs.width = w; cd.height = cs.height = h;
    const gd = cd.getContext('2d'), gs = cs.getContext('2d');
    const id = gd.createImageData(w, h), is = gs.createImageData(w, h);
    const L = { x: -0.6, y: -0.8 };             // luz arriba a la izquierda, como en iOS
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4, c = campo(x + 0.5, y + 0.5, w, h, r);
      let dx = 0, dy = 0;
      if (c.d >= 0 && c.d < bisel) {
        const m = tabla[Math.round((c.d / bisel) * N)];
        // hacia dentro: la lente amplia lo que tiene debajo, como en iOS (y en la demo con backdrop-filter)
        dx = -c.nx * m; dy = -c.ny * m;
      }
      id.data[o] = 128 + dx * 127; id.data[o + 1] = 128 + dy * 127; id.data[o + 2] = 128; id.data[o + 3] = 255;
      // brillo especular: resplandor a lo largo del bisel donde la normal mira a la luz (y al lado opuesto),
      // mas un canto fino y nitido
      if (c.d >= 0 && c.d < bisel) {
        const t = c.d / bisel, cara = Math.abs(c.nx * L.x + c.ny * L.y);
        const bloom = Math.pow(cara, 2) * Math.pow(1 - t, 3) * 0.85;
        const canto = c.d < 1.5 ? 0.55 + 0.45 * cara : 0;
        const al = Math.min(1, bloom + canto * (1 - c.d / 1.5));
        is.data[o] = is.data[o + 1] = is.data[o + 2] = 255; is.data[o + 3] = al * 255;
      }
    }
    gd.putImageData(id, 0, 0); gs.putImageData(is, 0, 0);
    return { desp: cd.toDataURL(), espec: cs.toDataURL(), escala: max * a.refraccion };
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
  // modo 'lente' (dock, paneles): el brillo se suma en pantalla. modo 'control' (sliders, interruptores):
  // como en la demo, el canto toma los colores de debajo muy saturados y encima va el brillo suave.
  function crearFiltro(idF, modo = 'lente') {
    const f = el('filter', { id: idF, x: '0', y: '0', width: '100%', height: '100%', 'color-interpolation-filters': 'sRGB', filterUnits: 'objectBoundingBox', primitiveUnits: 'userSpaceOnUse' }, contenedor());
    el('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: '0.5', result: 'b', 'data-k': 'blur' }, f);
    el('feImage', { result: 'm', preserveAspectRatio: 'none', 'data-k': 'desp' }, f);
    const canales = [['r', '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0'], ['g', '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0'], ['bl', '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0']];
    for (const [c, m] of canales) {
      el('feDisplacementMap', { in: 'b', in2: 'm', xChannelSelector: 'R', yChannelSelector: 'G', result: 'd' + c, 'data-k': 'esc-' + c }, f);
      el('feColorMatrix', { in: 'd' + c, type: 'matrix', values: m, result: 'c' + c }, f);
    }
    el('feBlend', { in: 'cr', in2: 'cg', mode: 'screen', result: 'rg' }, f);
    el('feBlend', { in: 'rg', in2: 'cbl', mode: 'screen', result: 'disp' }, f);
    el('feColorMatrix', { in: 'disp', type: 'saturate', values: '1.3', result: 'sat', 'data-k': 'sat' }, f);
    el('feImage', { result: 'e', preserveAspectRatio: 'none', 'data-k': 'espec' }, f);
    const ct = el('feComponentTransfer', { in: 'e', result: 'ef' }, f);
    el('feFuncA', { type: 'linear', slope: '1', 'data-k': 'alfa' }, ct);
    if (modo === 'control') {
      el('feComposite', { in: 'sat', in2: 'e', operator: 'in', result: 'borde' }, f);
      el('feBlend', { in: 'borde', in2: 'disp', mode: 'normal', result: 'conBorde' }, f);
      el('feBlend', { in: 'ef', in2: 'conBorde', mode: 'normal' }, f);
    } else {
      el('feBlend', { in: 'ef', in2: 'sat', mode: 'screen' }, f);
    }
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

  // Filtro para un tamano fijo (lentes de sliders e interruptores con backdrop-filter): se cachea por tamano
  const fijos = new Map();
  function filtroFijo(w, h, r, extra = {}) {
    const a = { ...AJUSTES, ...extra }, clave = [w, h, r, JSON.stringify(extra)].join('|');
    if (fijos.has(clave)) return fijos.get(clave);
    const idF = 'antuan-lgf-' + (++cuenta), f = crearFiltro(idF, 'control'), m = mapas(w, h, r, a), q = (k) => f.querySelector(`[data-k="${k}"]`);
    for (const k of ['desp', 'espec']) { const im = q(k); im.setAttribute('href', m[k]); im.setAttribute('x', 0); im.setAttribute('y', 0); im.setAttribute('width', w); im.setAttribute('height', h); }
    q('esc-r').setAttribute('scale', (m.escala * (1 + a.cromatica)).toFixed(2));
    q('esc-g').setAttribute('scale', m.escala.toFixed(2));
    q('esc-bl').setAttribute('scale', (m.escala * (1 - a.cromatica)).toFixed(2));
    q('blur').setAttribute('stdDeviation', a.desenfoque); q('sat').setAttribute('values', a.saturacion); q('alfa').setAttribute('slope', a.especular);
    fijos.set(clave, idF);
    return idF;
  }

  /* ---------- Controles liquidos: sliders e interruptores como en iOS 26 ---------- */
  // Slider: la bolita blanca (pildora) se convierte al pulsar en una lente de cristal que refracta la barra.
  const TW = 30, TH = 19;            // pildora en reposo; pulsada crece x1.6
  function sliderLiquido(inp) {
    if (inp._lg || inp.closest('.lg-range')) return;
    inp._lg = true;
    const caja = document.createElement('span'); caja.className = 'lg-range';
    inp.parentNode.insertBefore(caja, inp); caja.appendChild(inp);
    const bola = document.createElement('span'); bola.className = 'lg-thumb'; caja.appendChild(bola);
    const id = filtroFijo(Math.round(TW * 1.6), Math.round(TH * 1.6), Math.round(TH * 0.8), { bisel: 10, grosor: 40, cromatica: 0.1, desenfoque: 0, especular: 0.4, saturacion: 7 });
    bola.style.setProperty('--lg-filtro', `url(#${id})`);
    const sitio = () => {
      const min = +inp.min || 0, max = inp.max === '' ? 100 : +inp.max, v = (+inp.value - min) / ((max - min) || 1);
      const w = inp.clientWidth; bola.style.left = (TW / 2 + v * Math.max(0, w - TW)) + 'px';
    };
    const on = () => { caja.classList.add('activo'); sitio(); };
    const off = () => caja.classList.remove('activo');
    inp.addEventListener('input', sitio);
    inp.addEventListener('pointerdown', on);
    window.addEventListener('pointerup', off); window.addEventListener('pointercancel', off);
    new ResizeObserver(sitio).observe(inp);
    // los valores que se ponen desde el codigo (volumen, brillo...) tambien mueven la bola
    const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    Object.defineProperty(inp, 'value', { get() { return d.get.call(this); }, set(v) { d.set.call(this, v); sitio(); } });
    sitio();
  }
  // Interruptor: la bola crece al pulsar y se vuelve cristal; al soltar salta con muelle al otro lado
  function interruptorLiquido(sw) {
    if (sw._lg) return; sw._lg = true;
    const id = filtroFijo(30, 24, 12, { bisel: 9, grosor: 34, cromatica: 0.1, desenfoque: 0.2, especular: 0.5, saturacion: 6 });
    sw.style.setProperty('--lg-filtro', `url(#${id})`);
  }
  // Pulsar un cristal (dock, bandeja): se aplasta un poco hacia el dedo y vuelve con rebote, como gelatina
  function gelatina(el) {
    if (el._lgGel) return; el._lgGel = true;
    el.addEventListener('pointerdown', () => {
      if (document.documentElement.classList.contains('reduce-motion')) return;
      // propiedad "scale" aparte: no pisa el transform con el que el dock se coloca en su borde
      el.animate([{ scale: '1' }, { scale: '1.025 0.97', offset: 0.35 }, { scale: '0.995 1.008', offset: 0.7 }, { scale: '1' }],
        { duration: 520, easing: 'cubic-bezier(.22,1,.36,1)' });
    });
  }
  function controles(raiz = document) {
    raiz.querySelectorAll('input[type=range]').forEach(sliderLiquido);
    raiz.querySelectorAll('.switch').forEach(interruptorLiquido);
    raiz.querySelectorAll('.glass.liquid, #tray').forEach(gelatina);
  }
  let vigia = null;
  function vigilarControles() {
    controles();
    if (vigia) return;
    vigia = new MutationObserver(() => controles());
    vigia.observe(document.body, { childList: true, subtree: true });
  }

  window.LiquidGlass = {
    filtroFijo, controles: vigilarControles,
    ajustes: AJUSTES,
    iniciar(sel = '.wp') { document.documentElement.classList.add('lg'); document.querySelectorAll(sel).forEach(engancha); },
    ajustar(nuevos) { Object.assign(AJUSTES, nuevos); for (const c of capas) { c.clave = ''; actualizar(c); } },
    apagar() { document.documentElement.classList.remove('lg'); }
  };
})();
