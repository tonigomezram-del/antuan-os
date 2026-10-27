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
    let capa = null, vidrio = null, svg = null, forma = null, brillo = null;
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
      svg.append(forma, brillo);
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
      const fuera = [], dentro = [];
      const esq = esquinas();
      for (const p of ps) {
        const b = borde(p), h = alto(p);
        // justo en la esquina: el punto interior es el rincon de la L (normales de los dos bordes sumadas);
        // el suavizado lo convierte en una curva, como un liquido que dobla la esquina
        if (esq.some((e) => Math.abs(modP(p) - e) < 0.005 || Math.abs(modP(p) - e - P) < 0.005)) {
          const a1 = borde(p - 1), a2 = borde(p + 1);
          fuera.push([b.x - (a1.nx + a2.nx) * 3, b.y - (a1.ny + a2.ny) * 3]);
          dentro.push([b.x + (a1.nx + a2.nx) * h, b.y + (a1.ny + a2.ny) * h]);
          continue;
        }
        fuera.push([b.x - b.nx * 3, b.y - b.ny * 3]);              // un poco por fuera de la pantalla
        dentro.push([b.x + b.nx * h, b.y + b.ny * h]);
      }
      // la cara interior se suaviza (Chaikin): esquina interior redondeada al doblarse
      let suave = dentro;
      for (let it = 0; it < 3; it++) {
        const s2 = [suave[0]];
        for (let i = 0; i < suave.length - 1; i++) {
          const [a, b] = [suave[i], suave[i + 1]];
          s2.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
        }
        s2.push(suave[suave.length - 1]); suave = s2;
      }
      const pt = ([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`;
      const d = 'M' + fuera.map(pt).join('L') + 'L' + suave.slice().reverse().map(pt).join('L') + 'Z';
      forma.setAttribute('d', d);
      brillo.setAttribute('d', 'M' + suave.map(pt).join('L'));
      vidrio.style.clipPath = `path('${d}')`;

      // Iconos: por la linea central de la gota (a media altura). En una esquina esa linea se curva por dentro,
      // asi que se mide su largo real y los iconos se reparten por ella sin amontonarse ni salirse.
      const lista = piezas(), paso = (tam + 8) * estira;
      const centro = [];
      const r2 = T / 2 + 0.5;
      for (let p = g.p - L / 2; p <= g.p + L / 2; p += 3) {
        const b = borde(p), x = b.x + b.nx * T / 2, y = b.y + b.ny * T / 2;
        // dentro del cuadrado de una esquina la linea haria un bucle: se salta y gira limpia
        if ((x < r2 || x > W - r2) && (y < r2 || y > H - r2) && !(Math.abs(x - T / 2) < 1 && Math.abs(y - T / 2) < 1)) {
          const enEsquina = (Math.abs(b.x) < 1 || Math.abs(b.x - W) < 1) && (Math.abs(b.y) < 1 || Math.abs(b.y - H) < 1);
          if (!enEsquina) continue;
          centro.push([Math.min(Math.max(x, T / 2), W - T / 2), Math.min(Math.max(y, T / 2), H - T / 2)]);
          continue;
        }
        centro.push([x, y]);
      }
      let linea = centro;
      for (let it = 0; it < 4; it++) {   // suavizado: la esquina de la linea central pasa a ser una curva
        const s2 = [linea[0]];
        for (let i = 0; i < linea.length - 1; i++) { const [a, b] = [linea[i], linea[i + 1]]; s2.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); }
        s2.push(linea[linea.length - 1]); linea = s2;
      }
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

    // Muelle hacia el objetivo (rebota un poco al parar)
    function paso(t) {
      const dt = g.t ? Math.min(0.032, (t - g.t) / 1000) : 0.016; g.t = t;
      g.v += ((g.obj - g.p) * 90 - g.v * 13) * dt;
      g.p += g.v * dt;
      dibujar();
      if (Math.abs(g.obj - g.p) < 0.3 && Math.abs(g.v) < 3) { g.p = g.obj; g.v = 0; dibujar(); g.vivo = false; g.t = 0; guardar(); return; }
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
      if (!g.vivo) { g.p = g.obj = ini; dibujar(); }
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
