/* Dock "Gota" (experimento): el dock es una gota de cristal pegada al borde de la pantalla.
 * - Su silueta es la de una gota sobre una superficie: plana arriba, con los lados en curva de "montana"
 *   (convexa arriba y concava al llegar al borde, como el menisco del agua).
 * - Ctrl+Win+Alt + flechas lo deslizan por el borde. Al llegar a una esquina se dobla y sigue por el otro
 *   borde (puede quedarse en la esquina, en forma de L). Se estira con la velocidad y rebota al pararse.
 * - El dock recorre el perimetro de la pantalla; su posicion es la distancia recorrida en sentido horario
 *   desde la esquina de arriba a la izquierda.
 */
(() => {
  'use strict';
  const listo = (fn) => (window.UMB ? fn(window.UMB) : addEventListener('umbra-ready', () => fn(window.UMB), { once: true }));
  listo((M) => {
    const { S, U } = M;
    const dock = document.getElementById('dock');
    const NS = 'http://www.w3.org/2000/svg';
    let capa = null, vidrio = null, svg = null, forma = null, brillo = null, bisel = null, ultima = '';
    let W = innerWidth, H = innerHeight, P = 2 * (W + H);
    // Estado del muelle: posicion (centro en el perimetro), velocidad y objetivo
    const g = { p: 0, v: 0, obj: 0, vivo: false, t: 0 };

    const activa = () => (M.S.dockEstilo || 'liquido') === 'gota' && !M.S.reduceMotion;
    const modP = (p) => ((p % P) + P) % P;

    // Punto del borde en la posicion p, con su normal hacia dentro y su tangente (sentido horario)
    function borde(p) {
      p = modP(p);
      if (p < W) return { x: p, y: 0, nx: 0, ny: 1, tx: 1, ty: 0 };
      if (p < W + H) return { x: W, y: p - W, nx: -1, ny: 0, tx: 0, ty: 1 };
      if (p < 2 * W + H) return { x: W - (p - W - H), y: H, nx: 0, ny: -1, tx: -1, ty: 0 };
      return { x: 0, y: H - (p - 2 * W - H), nx: 1, ny: 0, tx: 0, ty: -1 };
    }
    const esquinas = () => [0, W, W + H, 2 * W + H];

    // Elementos del dock que se reparten a lo largo de la gota
    const piezas = () => [...dock.querySelectorAll('.launcher-btn, .dock-group .dock-item')];

    function crear() {
      if (capa) return;
      capa = document.createElement('div'); capa.id = 'gotaCapa';
      vidrio = document.createElement('div'); vidrio.className = 'gota-vidrio';
      svg = document.createElementNS(NS, 'svg'); svg.setAttribute('class', 'gota-svg');
      svg.innerHTML = `<defs><linearGradient id="gotaBrillo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".45" stop-color="#fff" stop-opacity=".08"/><stop offset="1" stop-color="#fff" stop-opacity=".3"/></linearGradient></defs>`;
      forma = document.createElementNS(NS, 'path'); forma.setAttribute('class', 'gota-forma');
      brillo = document.createElementNS(NS, 'path'); brillo.setAttribute('class', 'gota-brillo');
      // bisel: un trazo ancho y difuminado recortado por la propia gota (luz que entra por el canto)
      svg.querySelector('defs').insertAdjacentHTML('beforeend', '<clipPath id="gotaRecorte"><path/></clipPath>' +
        '<filter id="gotaDifumina" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="5"/></filter>');
      bisel = document.createElementNS(NS, 'path'); bisel.setAttribute('class', 'gota-bisel');
      bisel.setAttribute('clip-path', 'url(#gotaRecorte)'); bisel.setAttribute('filter', 'url(#gotaDifumina)');
      svg.append(forma, bisel, brillo);
      // refraccion: filtro SVG cuyo mapa se calcula de la silueta cuando la gota se queda quieta
      const fsvg = document.createElementNS(NS, 'svg'); fsvg.setAttribute('width', 0); fsvg.setAttribute('height', 0); fsvg.style.position = 'absolute';
      fsvg.innerHTML = '<filter id="gotaLente" x="0" y="0" width="100%" height="100%" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" color-interpolation-filters="sRGB">' +
        '<feImage result="m" preserveAspectRatio="none" x="0" y="0"/><feDisplacementMap in="SourceGraphic" in2="m" scale="0" xChannelSelector="R" yChannelSelector="G"/></filter>';
      capa.append(fsvg);
      capa.append(vidrio, svg);
      document.body.insertBefore(capa, dock);
      fondoBorroso();
    }

    // El cristal: el fondo de pantalla ya desenfocado una sola vez (recortar una imagen fija es barato)
    async function fondoBorroso() {
      const url = getComputedStyle(document.documentElement).getPropertyValue('--wp-img').trim().replace(/^url\(["']?|["']?\)$/g, '');
      if (!url || !vidrio) return;
      const img = new Image(); img.src = url;
      try { await img.decode(); } catch { return; }
      const c = document.createElement('canvas'), k = 0.35;   // a un tercio de tamano: el desenfoque lo disimula
      c.width = Math.round(W * k); c.height = Math.round(H * k);
      const x = c.getContext('2d'), s = Math.max(c.width / img.naturalWidth, c.height / img.naturalHeight);
      x.filter = 'blur(7px) saturate(1.6) brightness(1.05)';
      x.drawImage(img, (c.width - img.naturalWidth * s) / 2, (c.height - img.naturalHeight * s) / 2, img.naturalWidth * s, img.naturalHeight * s);
      vidrio.style.backgroundImage = `url(${c.toDataURL('image/jpeg', 0.9)})`;
    }

    // Curva amplia: remuestrea la linea cada 3 px y la promedia en una ventana de "radio" px. Lo recto sigue
    // recto y las esquinas pasan a ser curvas grandes y fluidas (como un liquido al doblar), no un angulo.
    function curvar(pts, radio) {
      const u = [pts[0]];
      for (let i = 1; i < pts.length; i++) {
        const [a, b] = [u[u.length - 1], pts[i]], d = Math.hypot(b[0] - a[0], b[1] - a[1]);
        for (let k = 3; k <= d; k += 3) u.push([a[0] + (b[0] - a[0]) * k / d, a[1] + (b[1] - a[1]) * k / d]);
      }
      u.push(pts[pts.length - 1]);
      const v = Math.max(1, Math.round(radio / 3)), out = [];
      for (let i = 0; i < u.length; i++) {
        const w = Math.min(v, i, u.length - 1 - i);   // en los extremos la ventana se encoge: siguen pegados al borde
        let x = 0, y = 0;
        for (let k = -w; k <= w; k++) { x += u[i + k][0]; y += u[i + k][1]; }
        out.push([x / (2 * w + 1), y / (2 * w + 1)]);
      }
      return out;
    }

    // Silueta: a lo largo del tramo del borde, una altura que es plana en el centro y baja en curva en "S"
    // (convexa arriba, concava al tocar el borde), con el pie extendido como el menisco de una gota
    function dibujar() {
      const n = piezas().length, tam = M.S.dockSize || 46;
      const v = Math.max(-1, Math.min(1, g.v / 2600));            // velocidad normalizada
      const estira = 1 + Math.abs(v) * 0.35;                       // al moverse se alarga...
      const T = (tam + 18) * (1 - Math.abs(v) * 0.22);             // ...y adelgaza (el volumen se conserva)
      const L = (n * (tam + 8) + 26) * estira;                     // largo del tramo plano + tapas
      const pie = T * 0.9;                                         // lo que se extiende la curva del menisco
      const ini = g.p - L / 2 - pie, fin = g.p + L / 2 + pie;
      // muestras del borde (incluye las esquinas para que la forma se doble justo en ellas)
      const ps = [];
      for (let p = ini; p <= fin; p += 6) ps.push(p);
      for (const e of esquinas()) for (const k of [-P, 0, P]) { const q = e + k; if (q > ini && q < fin) ps.push(q - 0.01, q, q + 0.01); }
      ps.sort((a, b) => a - b);
      const alto = (p) => {
        const d = Math.abs(p - g.p) - L / 2;                       // distancia al tramo plano
        if (d <= 0) return T;
        const x = Math.min(1, d / pie), s = x * x * (3 - 2 * x);   // curva en S
        return T * (1 - s);
      };
      // Esquinas que quedan dentro de la gota
      const enGota = [];
      for (const e of esquinas()) for (const k of [-P, 0, P]) { const q = e + k; if (q > ini && q < fin) enGota.push(q); }
      // Linea paralela al borde a la altura h(p). En cada esquina, en vez de un angulo, el liquido se encharca:
      // la linea sigue un cuarto de circulo de radio R centrado en la esquina (como el agua al doblar)
      function paralela(h, R, desde = ini, hasta = fin) {
        const pts = [];
        const salto = (p, c) => { const hh = h(c); return Math.sqrt(Math.max(0, R * R - hh * hh)); };
        let previo = -Infinity;
        for (const p of ps) {
          if (p < desde || p > hasta) continue;
          for (const c of enGota) {
            if (previo < c && p >= c) {   // se cruza la esquina c: arco
              const C = borde(c), nA = borde(c - 1), nB = borde(c + 1), hh = Math.min(h(c), R * 0.98);
              const t1 = Math.atan2(hh, Math.sqrt(R * R - hh * hh)), t2 = Math.PI / 2 - t1;
              for (let k = 0; k <= 16; k++) {
                const t = t1 + (t2 - t1) * k / 16;
                pts.push([C.x + R * (Math.cos(t) * nB.nx + Math.sin(t) * nA.nx), C.y + R * (Math.cos(t) * nB.ny + Math.sin(t) * nA.ny)]);
              }
            }
          }
          previo = p;
          if (enGota.some((c) => Math.abs(p - c) < salto(p, c))) continue;   // dentro del charco: lo dibuja el arco
          const b = borde(p), hp = h(p);
          pts.push([b.x + b.nx * hp, b.y + b.ny * hp]);
        }
        return pts;
      }
      const fuera = [];
      for (const p of ps) {
        const b = borde(p);
        if (enGota.some((c) => Math.abs(p - c) < 0.005)) { const a1 = borde(p - 1), a2 = borde(p + 1); fuera.push([b.x - (a1.nx + a2.nx) * 3, b.y - (a1.ny + a2.ny) * 3]); continue; }
        fuera.push([b.x - b.nx * 3, b.y - b.ny * 3]);              // un poco por fuera de la pantalla
      }
      const Rc = T * 1.55;                                         // radio del charco en la esquina
      let suave = curvar(paralela(alto, Rc), T * 0.7);             // cara interior: uniones suaves

      const pt = ([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`;
      const d = 'M' + fuera.map(pt).join('L') + 'L' + suave.slice().reverse().map(pt).join('L') + 'Z';
      forma.setAttribute('d', d);
      brillo.setAttribute('d', 'M' + suave.map(pt).join('L'));
      vidrio.style.clipPath = `path('${d}')`;
      bisel.setAttribute('d', 'M' + suave.map(pt).join('L'));
      svg.querySelector('#gotaRecorte path').setAttribute('d', d);
      ultima = d;
      if (g.vivo) vidrio.style.filter = '';

      // Iconos: por la linea central de la gota (a media altura). En una esquina esa linea se curva por dentro,
      // asi que se mide su largo real y los iconos se reparten por ella sin amontonarse ni salirse.
      const lista = piezas(), paso = (tam + 8) * estira;
      let linea = curvar(paralela(() => T / 2, Rc * 0.55, g.p - L / 2, g.p + L / 2), T * 0.7);
      const acum = [0];
      for (let i = 1; i < linea.length; i++) acum.push(acum[i - 1] + Math.hypot(linea[i][0] - linea[i - 1][0], linea[i][1] - linea[i - 1][1]));
      const largo = acum[acum.length - 1], sep = Math.min(paso, (largo - tam) / Math.max(1, lista.length - 1));
      const en = (d) => { let i = 1; while (i < acum.length - 1 && acum[i] < d) i++; const k = (d - acum[i - 1]) / ((acum[i] - acum[i - 1]) || 1), a = linea[i - 1], b = linea[i]; return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]; };
      // orden de lectura: de izquierda a derecha abajo y arriba; de arriba a abajo en los lados
      const e = bordeDe(g.p), alReves = e === 'bottom' || e === 'left';
      const d0 = largo / 2 - (lista.length - 1) * sep / 2;
      lista.forEach((el, i) => {
        el.classList.add('hit');
        const [x, y] = en(d0 + (alReves ? lista.length - 1 - i : i) * sep);
        el.style.left = (x - tam / 2) + 'px';
        el.style.top = (y - tam / 2) + 'px';
      });
      return { L, T };
    }

    // Refraccion de la gota: se pinta la silueta a un tercio de tamano, se difumina, y la pendiente de ese
    // relieve en cada punto dice hacia donde se dobla el fondo (el canto empuja hacia dentro, como una lente)
    function refractar() {
      if (!capa || !ultima) return;
      const k = 1 / 3, w = Math.round(W * k), h = Math.round(H * k);
      const a = document.createElement('canvas'); a.width = w; a.height = h;
      const x = a.getContext('2d'); x.scale(k, k); x.fillStyle = '#fff'; x.fill(new Path2D(ultima));
      const b = document.createElement('canvas'); b.width = w; b.height = h;
      const y = b.getContext('2d'); y.filter = 'blur(6px)'; y.drawImage(a, 0, 0);
      const al = y.getImageData(0, 0, w, h).data, mapa = y.createImageData(w, h), md = mapa.data;
      const A = (i, j) => al[((Math.min(h - 1, Math.max(0, j)) * w) + Math.min(w - 1, Math.max(0, i))) * 4] / 255;
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        const gx = A(i + 1, j) - A(i - 1, j), gy = A(i, j + 1) - A(i, j - 1), o = (j * w + i) * 4;
        md[o] = 128 + Math.max(-127, Math.min(127, gx * 380)); md[o + 1] = 128 + Math.max(-127, Math.min(127, gy * 380)); md[o + 2] = 128; md[o + 3] = 255;
      }
      y.putImageData(mapa, 0, 0);
      const img = capa.querySelector('#gotaLente feImage');
      img.setAttribute('href', b.toDataURL()); img.setAttribute('width', W); img.setAttribute('height', H);
      capa.querySelector('#gotaLente feDisplacementMap').setAttribute('scale', 46);
      if (!g.vivo) vidrio.style.filter = 'url(#gotaLente)';
    }

    // Muelle hacia el objetivo (rebota un poco al parar)
    function paso(t) {
      const dt = g.t ? Math.min(0.032, (t - g.t) / 1000) : 0.016; g.t = t;
      g.v += ((g.obj - g.p) * 90 - g.v * 13) * dt;
      g.p += g.v * dt;
      dibujar();
      if (Math.abs(g.obj - g.p) < 0.3 && Math.abs(g.v) < 3) { g.p = g.obj; g.v = 0; g.vivo = false; dibujar(); g.t = 0; guardar(); refractar(); return; }
      requestAnimationFrame(paso);
    }
    const arrancar = () => { if (!g.vivo) { g.vivo = true; requestAnimationFrame(paso); } };

    // El borde en el que esta el centro manda para el resto de Antuan (paneles, hueco reservado...)
    function bordeDe(p) { p = modP(p); return p < W ? 'top' : p < W + H ? 'right' : p < 2 * W + H ? 'bottom' : 'left'; }
    let guardado = 0;
    function guardar() {
      clearTimeout(guardado);
      guardado = setTimeout(() => {
        const e = bordeDe(g.p), patch = { gotaPos: +(modP(g.p) / P).toFixed(4) };
        if (e !== M.S.edge) patch.edge = e;
        M.set(patch, true);
      }, 300);
    }

    // Flechas: se avanza en la direccion pedida por el borde actual (y al llegar a la esquina, se dobla)
    function flecha(edge) {
      const dir = { left: [-1, 0], right: [1, 0], top: [0, -1], bottom: [0, 1] }[edge];
      const b = borde(g.obj), pr = dir[0] * b.tx + dir[1] * b.ty;
      const pasoTecla = 140;
      if (Math.abs(pr) > 0.5) g.obj += Math.sign(pr) * pasoTecla;
      else {
        // flecha perpendicular al borde (p. ej. arriba estando abajo): sube por el lado mas cercano
        const atras = borde(g.obj - 1);
        const haciaDelante = dir[0] * (b.tx) + dir[1] * (b.ty);
        g.obj += (dir[0] * atras.tx + dir[1] * atras.ty) < haciaDelante ? pasoTecla : -pasoTecla;
      }
      arrancar();
    }

    function aplicar() {
      W = innerWidth; H = innerHeight; P = 2 * (W + H);
      const on = activa();
      document.documentElement.classList.toggle('dock-gota', on);
      // zonas de clic (Antuan OS) y deteccion del raton: en modo gota solo los iconos, no la pantalla entera
      dock.classList.toggle('hit', !on);
      for (const el of piezas()) el.classList.toggle('hit', on);
      if (!on) {
        if (capa) { capa.remove(); capa = null; }
        for (const el of piezas()) { el.style.left = ''; el.style.top = ''; }
        return false;
      }
      crear();
      const ini = typeof M.S.gotaPos === 'number' ? M.S.gotaPos * P : { top: W / 2, right: W + H / 2, bottom: W + H + W / 2, left: 2 * W + H + H / 2 }[M.S.edge || 'bottom'];
      if (!g.vivo) { g.p = g.obj = ini; dibujar(); requestAnimationFrame(refractar); }
      return true;
    }

    window.GotaDock = { activa, aplicar, flecha, dibujar: () => capa && dibujar(), fondoBorroso: () => capa && fondoBorroso() };
    aplicar();
    addEventListener('resize', () => activa() && aplicar());
    U.on('wallpaper', () => setTimeout(() => window.GotaDock.fondoBorroso(), 300));
    // los iconos cambian (apps abiertas, fijadas): se recolocan
    new MutationObserver(() => { if (capa) dibujar(); }).observe(dock, { childList: true, subtree: true });
  });
})();
