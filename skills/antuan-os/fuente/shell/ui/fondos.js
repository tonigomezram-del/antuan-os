/* Fondos de Antuan, hechos para el cristal liquido.
 * Un degradado liso no deja ver la refraccion (no hay nada que doblar): todos estos fondos tienen siluetas,
 * lineas, bordes y contraste. Se generan aqui mismo (sin descargas ni derechos de autor), a la resolucion de la
 * pantalla, y siempre salen iguales (cada uno con su semilla).
 *   FondosAntuan.catalogo -> [{ id, nombre, categoria }]
 *   FondosAntuan.pintar(id, W, H) -> canvas
 */
(() => {
  'use strict';

  /* ---------------- Utilidades ---------------- */
  const azar = (s) => () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  const mezcla = (a, b, t) => a + (b - a) * t;
  const suave = (t) => t * t * (3 - 2 * t);
  const hex = (c) => { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const rgba = (c, a) => { const [r, g, b] = hex(c); return `rgba(${r},${g},${b},${a})`; };
  const mezclaColor = (c1, c2, t) => { const a = hex(c1), b = hex(c2); return `rgb(${a.map((v, i) => Math.round(mezcla(v, b[i], t))).join(',')})`; };

  // Ruido de valor 1D y 2D con octavas (relieves de montanas, nubes, nebulosas, topografia)
  function ruido1(seed) {
    const r = azar(seed), tabla = Array.from({ length: 512 }, r);
    const v = (x) => { const i = Math.floor(x), f = x - i; return mezcla(tabla[i & 511], tabla[(i + 1) & 511], suave(f)); };
    return (x, oct = 5) => { let s = 0, a = 0.5, f = 1, n = 0; for (let o = 0; o < oct; o++) { s += v(x * f) * a; n += a; a *= 0.5; f *= 2.03; } return s / n; };
  }
  function ruido2(seed) {
    const r = azar(seed), N = 256, tabla = Array.from({ length: N * N }, r);
    const t = (x, y) => tabla[((y & (N - 1)) * N) + (x & (N - 1))];
    const v = (x, y) => { const i = Math.floor(x), j = Math.floor(y), fx = suave(x - i), fy = suave(y - j); return mezcla(mezcla(t(i, j), t(i + 1, j), fx), mezcla(t(i, j + 1), t(i + 1, j + 1), fx), fy); };
    return (x, y, oct = 5) => { let s = 0, a = 0.5, f = 1, n = 0; for (let o = 0; o < oct; o++) { s += v(x * f, y * f) * a; n += a; a *= 0.5; f *= 2.01; } return s / n; };
  }

  function cielo(g, W, H, paradas) {
    const gr = g.createLinearGradient(0, 0, 0, H);
    paradas.forEach(([p, c]) => gr.addColorStop(p, c));
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
  }
  function brillo(g, x, y, r, color, a = 1) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, rgba(color, a)); gr.addColorStop(1, rgba(color, 0));
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  function estrellas(g, W, H, r, n, alto = 1) {
    for (let i = 0; i < n; i++) {
      const x = r() * W, y = r() * H * alto, t = r();
      const s = t > 0.985 ? 1.6 : t > 0.9 ? 1.1 : 0.7;
      g.fillStyle = `rgba(255,255,255,${0.25 + r() * 0.75})`;
      g.beginPath(); g.arc(x, y, s * Math.max(1, W / 1920), 0, Math.PI * 2); g.fill();
      if (t > 0.993) brillo(g, x, y, 10 * W / 1920, '#ffffff', 0.35);
    }
  }
  // Cordillera: silueta con ruido, rellena con degradado vertical; "nitidez" controla lo recortado del perfil
  function cordillera(g, W, H, n, { base, alto, escala, color, color2, semilla, nitidez = 1 }) {
    g.beginPath(); g.moveTo(0, H);
    for (let x = 0; x <= W; x += 3) {
      const t = x / W, rid = 1 - Math.abs(n(t * escala + semilla) * 2 - 1);   // crestas afiladas
      const y = base - alto * mezcla(n(t * escala * 0.6 + semilla * 1.7), rid, nitidez * 0.6);
      g.lineTo(x, y);
    }
    g.lineTo(W, H); g.closePath();
    const gr = g.createLinearGradient(0, base - alto, 0, H);
    gr.addColorStop(0, color); gr.addColorStop(1, color2 || color);
    g.fillStyle = gr; g.fill();
  }
  function niebla(g, W, y, alto, color, a) {
    const gr = g.createLinearGradient(0, y - alto, 0, y + alto);
    gr.addColorStop(0, rgba(color, 0)); gr.addColorStop(0.5, rgba(color, a)); gr.addColorStop(1, rgba(color, 0));
    g.fillStyle = gr; g.fillRect(0, y - alto, W, alto * 2);
  }
  function vineta(g, W, H, a = 0.5) {
    const v = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.78);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(0,0,0,${a})`);
    g.fillStyle = v; g.fillRect(0, 0, W, H);
  }
  function grano(g, W, H, r, a = 9) {
    const n = document.createElement('canvas'); n.width = n.height = 180;
    const ng = n.getContext('2d'), id = ng.createImageData(180, 180);
    for (let k = 0; k < id.data.length; k += 4) { const v = r() * 255; id.data[k] = id.data[k + 1] = id.data[k + 2] = v; id.data[k + 3] = a; }
    ng.putImageData(id, 0, 0); g.fillStyle = g.createPattern(n, 'repeat'); g.fillRect(0, 0, W, H);
  }
  // Campo 2D pintado a baja resolucion y escalado con suavizado (nubes, nebulosas)
  function campo(g, W, H, k, fn) {
    const w = Math.ceil(W * k), h = Math.ceil(H * k), c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'), id = x.createImageData(w, h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const [r, gg, b, a] = fn(i / w, j / h); const o = (j * w + i) * 4; id.data[o] = r; id.data[o + 1] = gg; id.data[o + 2] = b; id.data[o + 3] = a; }
    x.putImageData(id, 0, 0);
    g.save(); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(c, 0, 0, W, H); g.restore();
  }
  function pino(g, x, base, alto, ancho) {
    g.beginPath(); g.moveTo(x, base - alto);
    const capas = 5;
    for (let k = 1; k <= capas; k++) { const y = base - alto + alto * k / capas, w = ancho * (k / capas) * 0.5; g.lineTo(x + w, y); g.lineTo(x + w * 0.45, y); }
    g.lineTo(x + ancho * 0.06, base); g.lineTo(x - ancho * 0.06, base);
    for (let k = capas; k >= 1; k--) { const y = base - alto + alto * k / capas, w = ancho * (k / capas) * 0.5; g.lineTo(x - w * 0.45, y); g.lineTo(x - w, y); }
    g.closePath(); g.fill();
  }

  /* ---------------- Cintas (los primeros) ---------------- */
  const CINTAS = {
    Brasa: { fondo: '#060406', cintas: [['#4a0d1e', '#b3261e'], ['#ff5a1f', '#ff9466'], ['#c2185b', '#ff6f61'], ['#ffb347', '#ff7a2f'], ['#7a1236', '#e0452f']], semilla: 7 },
    Aurora: { fondo: '#04070a', cintas: [['#0b3d3a', '#1fa38f'], ['#5b2ca0', '#9b6bff'], ['#00c2a8', '#7ee0d2'], ['#2d1b69', '#6c4cf0'], ['#0f766e', '#34d399']], semilla: 3 },
    Oceano: { fondo: '#03060c', cintas: [['#0a2547', '#1e5fae'], ['#0ea5e9', '#6fc3ff'], ['#1e3a8a', '#4f7cff'], ['#22d3ee', '#a5f3fc'], ['#172554', '#3b82f6']], semilla: 11 },
    Lavanda: { fondo: '#07050b', cintas: [['#2e1065', '#7c3aed'], ['#c084fc', '#f0abfc'], ['#6d28d9', '#a78bfa'], ['#f472b6', '#fbcfe8'], ['#4c1d95', '#c4b5fd']], semilla: 5 },
    Bosque: { fondo: '#040805', cintas: [['#0f3d1f', '#1f7a3f'], ['#65a30d', '#bef264'], ['#166534', '#4ade80'], ['#a3e635', '#ecfccb'], ['#14532d', '#22c55e']], semilla: 9 }
  };
  function cintas(e) {
    return (g, W, H, r, u) => {
      g.fillStyle = e.fondo; g.fillRect(0, 0, W, H);
      e.cintas.forEach(([c1, c2]) => {
        const grosor = (170 + r() * 230) * u;
        const y0 = H * (0.15 + r() * 0.85), y1 = H * (r() * 0.85);
        const p = [[-W * 0.15, y0], [W * (0.2 + r() * 0.2), H * (r() * 1.2 - 0.1)], [W * (0.6 + r() * 0.2), H * (r() * 1.2 - 0.1)], [W * 1.15, y1]];
        const camino = () => { g.beginPath(); g.moveTo(...p[0]); g.bezierCurveTo(...p[1], ...p[2], ...p[3]); };
        const gr = g.createLinearGradient(p[0][0], p[0][1], p[3][0], p[3][1]);
        gr.addColorStop(0, c1); gr.addColorStop(0.55, c2); gr.addColorStop(1, c1);
        g.lineCap = 'round';
        g.save(); g.shadowColor = 'rgba(0,0,0,.75)'; g.shadowBlur = 90 * u; g.shadowOffsetY = 30 * u;
        camino(); g.strokeStyle = gr; g.lineWidth = grosor; g.stroke(); g.restore();
        // bandas marcadas (a Toni le gustan mas que el volumen suavizado)
        camino(); g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = grosor; g.stroke();
        camino(); g.strokeStyle = gr; g.lineWidth = grosor * 0.86; g.stroke();
        camino(); g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = grosor * 0.45; g.stroke();
        g.save(); g.translate(0, -grosor * 0.4); camino(); g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = 2.2 * u; g.stroke(); g.restore();
        g.save(); g.translate(0, -grosor * 0.33); camino(); g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 14 * u; g.stroke(); g.restore();
      });
      const luz = g.createRadialGradient(W * 0.7, -H * 0.1, 0, W * 0.7, -H * 0.1, W * 0.7);
      luz.addColorStop(0, 'rgba(255,255,255,.08)'); luz.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = luz; g.fillRect(0, 0, W, H);
      vineta(g, W, H, 0.5);
    };
  }

  /* ---------------- Paisajes ---------------- */
  function montanasAtardecer(g, W, H, r) {
    cielo(g, W, H, [[0, '#1b1036'], [0.35, '#6b2a6e'], [0.6, '#e0566b'], [0.78, '#ffa25c'], [1, '#ffd08a']]);
    brillo(g, W * 0.62, H * 0.6, H * 0.75, '#ffb070', 0.55);
    g.fillStyle = '#ffe2b0'; g.beginPath(); g.arc(W * 0.62, H * 0.6, H * 0.075, 0, Math.PI * 2); g.fill();
    brillo(g, W * 0.62, H * 0.6, H * 0.16, '#fff1d0', 0.8);
    const n = ruido1(101), capas = [
      ['#c4577a', '#d77a7a', 0.62, 0.16], ['#9b3f6e', '#b25a72', 0.68, 0.2], ['#6e2a5e', '#86385f', 0.75, 0.22],
      ['#46194a', '#531f4b', 0.82, 0.2], ['#2a0f33', '#2f1236', 0.9, 0.18], ['#150818', '#150818', 0.97, 0.14]];
    capas.forEach(([c1, c2, b, a], i) => {
      cordillera(g, W, H, n, { base: H * b, alto: H * a, escala: 2.2 + i * 0.7, color: c1, color2: c2, semilla: i * 13.7, nitidez: 0.6 + i * 0.1 });
      if (i < capas.length - 1) niebla(g, W, H * b, H * 0.05, '#ff9a7a', 0.18);
    });
  }
  function montanasNoche(g, W, H, r) {
    cielo(g, W, H, [[0, '#02040c'], [0.5, '#0b1736'], [0.85, '#1e3a6e'], [1, '#2c4f86']]);
    estrellas(g, W, H, r, 900, 0.7);
    brillo(g, W * 0.24, H * 0.22, H * 0.4, '#9ec5ff', 0.25);
    g.fillStyle = '#f2f6ff'; g.beginPath(); g.arc(W * 0.24, H * 0.22, H * 0.05, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(160,180,220,.35)'; g.beginPath(); g.arc(W * 0.24 + H * 0.015, H * 0.22 - H * 0.008, H * 0.012, 0, Math.PI * 2); g.fill();
    const n = ruido1(77);
    [['#24406f', 0.62, 0.22], ['#1b3159', 0.7, 0.24], ['#132443', 0.78, 0.22], ['#0b1730', 0.87, 0.2], ['#050b1a', 0.96, 0.16]].forEach(([c, b, a], i) => {
      cordillera(g, W, H, n, { base: H * b, alto: H * a, escala: 2.4 + i * 0.6, color: mezclaColor(c, '#9ec5ff', 0.12), color2: c, semilla: i * 9.1, nitidez: 0.9 });
      niebla(g, W, H * b, H * 0.04, '#9ec5ff', 0.08);
    });
  }
  function aurora(g, W, H, r) {
    cielo(g, W, H, [[0, '#010409'], [0.6, '#03121a'], [1, '#062226']]);
    estrellas(g, W, H, r, 700, 0.8);
    // cortinas de aurora: franjas verticales a lo largo de una curva, transparentes arriba
    const n = ruido1(311);
    [['#34f5c5', 0.28, 0.9], ['#7b6cff', 0.18, 0.55], ['#38e0a0', 0.36, 0.7]].forEach(([c, y0, a], k) => {
      for (let x = -40; x < W + 40; x += 3) {
        const t = x / W, y = H * (y0 + 0.12 * Math.sin(t * 5 + k * 2) + 0.08 * (n(t * 3 + k * 7) - 0.5));
        const largo = H * (0.18 + 0.22 * n(t * 9 + k * 3)), i = a * (0.35 + 0.65 * n(t * 14 + k));
        const gr = g.createLinearGradient(0, y - largo, 0, y + 8);
        gr.addColorStop(0, rgba(c, 0)); gr.addColorStop(0.75, rgba(c, i * 0.45)); gr.addColorStop(1, rgba(c, i * 0.9));
        g.fillStyle = gr; g.fillRect(x, y - largo, 3.2, largo + 8);
      }
    });
    brillo(g, W * 0.5, H * 0.45, W * 0.5, '#2dd4bf', 0.08);
    // suelo nevado y bosque de pinos
    const s = ruido1(5);
    g.fillStyle = '#0d1c22'; g.beginPath(); g.moveTo(0, H);
    for (let x = 0; x <= W; x += 6) g.lineTo(x, H * (0.8 + 0.03 * s(x / W * 3))); g.lineTo(W, H); g.fill();
    g.fillStyle = '#020608';
    for (let i = 0; i < 70; i++) { const x = r() * W, base = H * (0.82 + 0.03 * s(x / W * 3)) + r() * H * 0.12, al = H * (0.08 + r() * 0.14); pino(g, x, base, al, al * 0.5); }
    g.fillStyle = 'rgba(160,240,220,.06)'; g.fillRect(0, H * 0.78, W, H * 0.22);
  }
  function dunas(g, W, H, r) {
    cielo(g, W, H, [[0, '#f3b27a'], [0.4, '#f7cf9a'], [0.55, '#fde4bf'], [1, '#fde4bf']]);
    brillo(g, W * 0.78, H * 0.3, H * 0.5, '#fff4dd', 0.7);
    g.fillStyle = '#fff6e6'; g.beginPath(); g.arc(W * 0.78, H * 0.3, H * 0.06, 0, Math.PI * 2); g.fill();
    // dunas: cada una con cara iluminada y cara en sombra separadas por una cresta nitida
    const capas = [[0.52, '#e7a76a', '#b86b3d'], [0.6, '#df9455', '#a3552c'], [0.7, '#d27e40', '#8d4321'], [0.82, '#c36a30', '#76351a'], [0.95, '#a9541f', '#5e2911']];
    capas.forEach(([b, luz, sombra], i) => {
      const fase = r() * 6, amp = H * (0.05 + i * 0.012), fr = 1.2 + r() * 1.4;
      const y = (x) => H * b - amp * Math.sin(x / W * Math.PI * fr + fase) - amp * 0.4 * Math.sin(x / W * Math.PI * fr * 2.3 + fase * 2);
      g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= W; x += 4) g.lineTo(x, y(x)); g.lineTo(W, H); g.closePath();
      const gr = g.createLinearGradient(0, H * b - amp * 1.4, 0, H); gr.addColorStop(0, luz); gr.addColorStop(1, sombra);
      g.fillStyle = gr; g.fill();
      // cara de sombra: en la ladera que baja (sotavento) una cuna oscura que sigue la curva; su grosor depende
      // de la pendiente, asi la cresta queda nitida y la sombra se funde suave hacia abajo
      g.save(); g.clip();
      const pend = (x) => (y(x + 3) - y(x - 3)) / 6;
      g.beginPath(); g.moveTo(0, y(0));
      for (let x = 0; x <= W; x += 3) g.lineTo(x, y(x));
      for (let x = W; x >= 0; x -= 3) g.lineTo(x, y(x) + Math.max(0, pend(x)) * amp * 3.2);
      g.closePath();
      const so = g.createLinearGradient(0, H * b - amp, 0, H * b + amp * 2.5);
      so.addColorStop(0, rgba(sombra, 0.75)); so.addColorStop(1, rgba(sombra, 0.25));
      g.fillStyle = so; g.fill(); g.restore();
      g.strokeStyle = 'rgba(255,240,220,.35)'; g.lineWidth = 1.2; g.beginPath(); for (let x = 0; x <= W; x += 4) x ? g.lineTo(x, y(x)) : g.moveTo(x, y(x)); g.stroke();
    });
  }
  function oceano(g, W, H, r) {
    const hor = H * 0.56;
    cielo(g, W, hor, [[0, '#030714'], [0.7, '#14244a'], [1, '#2f4a7c']]);
    estrellas(g, W, hor, r, 500, 0.9);
    const mx = W * 0.5, my = H * 0.3;
    brillo(g, mx, my, H * 0.45, '#cfe0ff', 0.25);
    g.fillStyle = '#f6f8ff'; g.beginPath(); g.arc(mx, my, H * 0.065, 0, Math.PI * 2); g.fill();
    const mar = g.createLinearGradient(0, hor, 0, H); mar.addColorStop(0, '#16274d'); mar.addColorStop(1, '#03070f');
    g.fillStyle = mar; g.fillRect(0, hor, W, H - hor);
    // camino de luz de la luna: rayas horizontales cortas que se ensanchan hacia abajo
    for (let i = 0; i < 1400; i++) {
      const t = Math.pow(r(), 1.6), y = hor + t * (H - hor), ancho = (0.03 + t * 0.22) * W;
      const x = mx + (r() - 0.5) * ancho * 1.6, l = (6 + t * 60) * (0.4 + r());
      g.fillStyle = `rgba(220,232,255,${(1 - t) * 0.5 * r() + 0.05})`; g.fillRect(x - l / 2, y, l, 1 + t * 2);
    }
    // olas: lineas finas que el cristal dobla muy bien
    g.strokeStyle = 'rgba(160,190,255,.12)'; g.lineWidth = 1;
    for (let k = 0; k < 40; k++) { const y = hor + Math.pow(k / 40, 1.8) * (H - hor); g.beginPath(); for (let x = 0; x <= W; x += 8) { const yy = y + Math.sin(x / (40 + k * 6) + k) * (1 + k * 0.15); x ? g.lineTo(x, yy) : g.moveTo(x, yy); } g.stroke(); }
    g.fillStyle = 'rgba(200,220,255,.35)'; g.fillRect(0, hor - 1, W, 1.5);
  }
  function lago(g, W, H, r) {
    const hor = H * 0.58;
    cielo(g, W, hor, [[0, '#3a5a8c'], [0.5, '#e8a9a0'], [1, '#ffd6a5']]);
    brillo(g, W * 0.35, hor, H * 0.5, '#fff0cf', 0.5);
    const n = ruido1(41), lejos = document.createElement('canvas'); lejos.width = W; lejos.height = H;
    const l = lejos.getContext('2d');
    cordillera(l, W, hor + 2, n, { base: hor, alto: H * 0.28, escala: 2.6, color: '#7c6fa0', color2: '#5b5384', semilla: 1, nitidez: 1 });
    cordillera(l, W, hor + 2, n, { base: hor, alto: H * 0.16, escala: 3.5, color: '#4c4870', color2: '#3a375a', semilla: 9, nitidez: 0.8 });
    g.drawImage(lejos, 0, 0);
    // reflejo en el agua, oscurecido y con ondas
    g.save(); g.translate(0, hor * 2); g.scale(1, -1); g.globalAlpha = 0.6; g.drawImage(lejos, 0, 0); g.restore();
    const agua = g.createLinearGradient(0, hor, 0, H); agua.addColorStop(0, 'rgba(40,50,90,.15)'); agua.addColorStop(1, 'rgba(10,12,30,.85)');
    g.fillStyle = agua; g.fillRect(0, hor, W, H - hor);
    g.strokeStyle = 'rgba(255,230,210,.18)'; g.lineWidth = 1.2;
    for (let i = 0; i < 260; i++) { const y = hor + Math.pow(r(), 1.3) * (H - hor), x = r() * W, l2 = 20 + r() * 120; g.beginPath(); g.moveTo(x, y); g.lineTo(x + l2, y); g.stroke(); }
    g.fillStyle = '#ffe7c4'; g.fillRect(0, hor - 0.5, W, 1);
  }
  function bosqueNiebla(g, W, H, r) {
    cielo(g, W, H, [[0, '#8fa9a6'], [0.5, '#c4d2c9'], [1, '#e1e8df']]);
    brillo(g, W * 0.7, H * 0.25, H * 0.4, '#ffffff', 0.5);
    const capas = ['#a7b9b0', '#8aa197', '#6d877d', '#506c63', '#34504a', '#1d3631', '#0e211d'];
    capas.forEach((c, i) => {
      g.fillStyle = c;
      const base = H * (0.45 + i * 0.085), cuantos = 26 + i * 6;
      for (let k = 0; k < cuantos; k++) { const x = (k + r() * 0.8) / cuantos * W * 1.05 - 20, al = H * (0.14 + r() * 0.1 + i * 0.02); pino(g, x, base + r() * H * 0.03, al, al * 0.42); }
      g.fillRect(0, base, W, H - base);
      niebla(g, W, base - H * 0.02, H * 0.06, '#e8efe8', 0.5 - i * 0.05);
    });
  }
  function ciudad(g, W, H, r) {
    cielo(g, W, H, [[0, '#0b0820'], [0.45, '#3b1d5c'], [0.7, '#c2477a'], [0.86, '#ff8a5b'], [1, '#ffbd73']]);
    estrellas(g, W, H, r, 250, 0.35);
    brillo(g, W * 0.5, H * 0.85, W * 0.6, '#ff8a5b', 0.35);
    const capas = [[0.62, '#3a2353', 0.5], [0.72, '#251638', 0.7], [0.84, '#120a1e', 1]];
    capas.forEach(([b, c, lucesA], k) => {
      let x = -10;
      while (x < W) {
        const w = (28 + r() * 70) * (1 + k * 0.4), h = H * (0.08 + r() * (0.22 + k * 0.08));
        g.fillStyle = c; g.fillRect(x, H * b - h, w, H);
        if (r() < 0.25) { g.fillRect(x + w * 0.4, H * b - h - H * 0.03, w * 0.08, H * 0.03); }
        // ventanas
        for (let wy = H * b - h + 8; wy < H * b - 6; wy += 9 + k * 3) for (let wx = x + 5; wx < x + w - 5; wx += 8 + k * 3) {
          if (r() < 0.32) { g.fillStyle = `rgba(255,${200 + r() * 40 | 0},${120 + r() * 60 | 0},${(0.4 + r() * 0.6) * lucesA})`; g.fillRect(wx, wy, 3 + k, 4 + k); }
        }
        g.fillStyle = c; x += w + r() * 6;
      }
    });
    g.fillStyle = '#07040d'; g.fillRect(0, H * 0.84, W, H * 0.16);
    // reflejos de las luces en el agua
    for (let i = 0; i < 700; i++) { const x = r() * W, y = H * 0.85 + r() * H * 0.15; g.fillStyle = `rgba(255,170,110,${r() * 0.35})`; g.fillRect(x, y, 2 + r() * 14, 1.2); }
  }

  /* ---------------- Espacio ---------------- */
  function planeta(g, W, H, r) {
    g.fillStyle = '#020309'; g.fillRect(0, 0, W, H);
    const n2 = ruido2(808);
    campo(g, W, H, 0.12, (x, y) => { const v = n2(x * 4, y * 4); const a = Math.max(0, v - 0.45) * 2; return [90 + 120 * a, 60, 160 + 60 * a, 110 * a]; });
    estrellas(g, W, H, r, 1100, 1);
    const cx = W * 0.66, cy = H * 0.58, R = H * 0.32;
    // anillo trasero
    const anillo = (frente) => {
      g.save(); g.translate(cx, cy); g.rotate(-0.32); g.scale(1, 0.24);
      for (let k = 0; k < 40; k++) {
        const rr = R * (1.35 + k * 0.022), a = 0.08 + 0.25 * Math.abs(Math.sin(k * 1.7));
        g.strokeStyle = `rgba(${230 - k * 2},${200 - k},${170},${a})`; g.lineWidth = R * 0.02;
        g.beginPath(); g.arc(0, 0, rr, frente ? 0 : Math.PI, frente ? Math.PI : Math.PI * 2); g.stroke();
      }
      g.restore();
    };
    anillo(false);
    // esfera con bandas y luz lateral
    g.save(); g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.clip();
    const base = g.createLinearGradient(cx - R, cy - R, cx + R, cy + R); base.addColorStop(0, '#f2c58a'); base.addColorStop(0.5, '#c9824f'); base.addColorStop(1, '#5b2c1c');
    g.fillStyle = base; g.fillRect(cx - R, cy - R, R * 2, R * 2);
    const n = ruido1(9);
    for (let y = -R; y < R; y += 3) { const t = (y + R) / (2 * R); g.fillStyle = `rgba(${n(t * 8) > 0.5 ? '255,235,200' : '90,40,20'},${Math.abs(n(t * 8) - 0.5) * 0.5})`; g.fillRect(cx - R, cy + y, R * 2, 3); }
    const sombra = g.createRadialGradient(cx - R * 0.45, cy - R * 0.45, R * 0.2, cx, cy, R * 1.15); sombra.addColorStop(0, 'rgba(0,0,0,0)'); sombra.addColorStop(0.7, 'rgba(0,0,0,.35)'); sombra.addColorStop(1, 'rgba(0,0,0,.92)');
    g.fillStyle = sombra; g.fillRect(cx - R, cy - R, R * 2, R * 2);
    g.restore();
    anillo(true);
    brillo(g, cx - R * 0.6, cy - R * 0.6, R * 0.9, '#ffe2b8', 0.12);
  }
  function nebulosa(g, W, H, r) {
    g.fillStyle = '#03020a'; g.fillRect(0, 0, W, H);
    const n2 = ruido2(4242);
    campo(g, W, H, 0.25, (x, y) => {
      const a = n2(x * 2.2 + 3, y * 2.2), b = n2(x * 3.5 + 11, y * 3.5 + 5), c = n2(x * 6, y * 6 + 9);
      const v = Math.max(0, a - 0.38) * 2.2, w = Math.max(0, b - 0.45) * 2.4, polvo = Math.max(0, 0.55 - c) * 1.4;
      const R_ = 30 + 220 * v + 40 * w, G_ = 10 + 60 * v + 160 * w, B_ = 60 + 200 * v + 120 * w;
      return [R_ * (1 - polvo * 0.6), G_ * (1 - polvo * 0.6), B_ * (1 - polvo * 0.5), 255 * Math.min(1, v * 0.9 + w * 0.7)];
    });
    estrellas(g, W, H, r, 1500, 1);
    for (let i = 0; i < 6; i++) { const x = r() * W, y = r() * H; brillo(g, x, y, 40 * W / 1920, '#ffffff', 0.5); g.fillStyle = '#fff'; g.fillRect(x - 0.5, y - 14, 1, 28); g.fillRect(x - 14, y - 0.5, 28, 1); }
  }
  function eclipse(g, W, H, r) {
    g.fillStyle = '#010103'; g.fillRect(0, 0, W, H);
    estrellas(g, W, H, r, 500, 1);
    const cx = W * 0.5, cy = H * 0.45, R = H * 0.17;
    brillo(g, cx, cy, R * 4, '#ff9d5c', 0.18);
    brillo(g, cx, cy, R * 2.2, '#ffd9a8', 0.4);
    // corona: rayos finos alrededor
    for (let i = 0; i < 520; i++) {
      const a = r() * Math.PI * 2, l = R * (1.05 + Math.pow(r(), 3) * 1.6);
      g.strokeStyle = `rgba(255,${200 + r() * 50 | 0},${150 + r() * 80 | 0},${0.05 + r() * 0.12})`; g.lineWidth = 1;
      g.beginPath(); g.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); g.lineTo(cx + Math.cos(a) * l, cy + Math.sin(a) * l); g.stroke();
    }
    g.strokeStyle = 'rgba(255,240,220,.95)'; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, R * 1.01, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#000'; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();
    brillo(g, cx + R * 0.7, cy - R * 0.7, R * 0.25, '#ffffff', 0.9);
  }

  /* ---------------- Minimalistas ---------------- */
  function orbes(g, W, H, r) {
    g.fillStyle = '#07070c'; g.fillRect(0, 0, W, H);
    const esferas = [[0.28, 0.62, 0.3, '#ff6a3d', '#7a1f6e'], [0.7, 0.36, 0.22, '#4f8cff', '#1b1550'], [0.82, 0.78, 0.12, '#ffd166', '#c2410c'], [0.12, 0.2, 0.08, '#34d399', '#065f46']];
    esferas.forEach(([x, y, rr, c1, c2]) => {
      const cx = W * x, cy = H * y, R = H * rr;
      g.save(); g.shadowColor = rgba(c1, 0.5); g.shadowBlur = R * 0.6;
      const gr = g.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.05, cx, cy, R);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.12, c1); gr.addColorStop(1, c2);
      g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill(); g.restore();
      g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 1.5; g.beginPath(); g.arc(cx, cy, R - 1, Math.PI * 1.05, Math.PI * 1.55); g.stroke();
    });
    vineta(g, W, H, 0.4);
  }
  function arcos(g, W, H, r) {
    g.fillStyle = '#f1e7d8'; g.fillRect(0, 0, W, H);
    const colores = ['#1f2a44', '#e2725b', '#f4b860', '#3f7d6e', '#c94f6d', '#f1e7d8'];
    const centros = [[W * 0.18, H], [W * 0.74, H * 0.05]];
    centros.forEach(([cx, cy], k) => {
      for (let i = 0; i < 9; i++) {
        const R = H * (0.95 - i * 0.1) * (k ? 0.7 : 1);
        g.fillStyle = colores[(i + k * 2) % colores.length];
        g.beginPath(); g.arc(cx, cy, Math.max(4, R), k ? 0 : Math.PI, k ? Math.PI : Math.PI * 2); g.fill();
      }
    });
    g.fillStyle = '#1f2a44'; g.beginPath(); g.arc(W * 0.62, H * 0.7, H * 0.07, 0, Math.PI * 2); g.fill();
  }
  function topografia(g, W, H, r) {
    // relieve con color por altura y curvas de nivel suaves (cada 5, una mas marcada)
    const n2 = ruido2(1337), k = 0.6, w = Math.ceil(W * k), h = Math.ceil(H * k), niveles = 22;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'), id = x.createImageData(w, h), val = new Float32Array(w * h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) val[j * w + i] = n2(i / w * 3.2, j / h * 1.8, 4) * niveles;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const v = val[j * w + i], t = v / niveles, o = (j * w + i) * 4;
      // fondo: azul noche que se aclara con la altura
      let R = 8 + 30 * t, G = 16 + 50 * t, B = 32 + 90 * t, A = 255;
      // linea: distancia al nivel entero mas cercano, en unidades de pixel (gradiente local)
      const gx = (val[j * w + Math.min(w - 1, i + 1)] - val[j * w + Math.max(0, i - 1)]) / 2, gy = (val[Math.min(h - 1, j + 1) * w + i] - val[Math.max(0, j - 1) * w + i]) / 2;
      const d = Math.abs(v - Math.round(v)) / Math.max(0.02, Math.hypot(gx, gy)), fuerte = Math.round(v) % 5 === 0;
      const linea = Math.max(0, 1 - d / (fuerte ? 1.4 : 0.9));
      R = mezcla(R, 120 + 120 * t, linea * (fuerte ? 1 : 0.7)); G = mezcla(G, 190 + 50 * t, linea * (fuerte ? 1 : 0.7)); B = mezcla(B, 255, linea * (fuerte ? 1 : 0.7));
      id.data[o] = R; id.data[o + 1] = G; id.data[o + 2] = B; id.data[o + 3] = A;
    }
    x.putImageData(id, 0, 0);
    g.save(); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(c, 0, 0, W, H); g.restore();
    brillo(g, W * 0.3, H * 0.4, W * 0.5, '#3b82f6', 0.12);
    vineta(g, W, H, 0.5);
  }
  function ondas(g, W, H, r) {
    // haz de lineas de luz que ondulan; con brillo para que se vean bien y el cristal las doble
    g.fillStyle = '#04050b'; g.fillRect(0, 0, W, H);
    const lineas = 64, u = W / 1920;
    g.save(); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < lineas; i++) {
      const t = i / lineas, y0 = H * (0.2 + t * 0.62), env = Math.sin(t * Math.PI);
      const gr = g.createLinearGradient(0, 0, W, 0);
      gr.addColorStop(0, `hsla(${190 + t * 130},95%,60%,0)`); gr.addColorStop(0.35, `hsla(${190 + t * 130},95%,62%,${0.7 * Math.pow(env, 1.6)})`);
      gr.addColorStop(0.7, `hsla(${230 + t * 110},95%,66%,${0.6 * Math.pow(env, 1.6)})`); gr.addColorStop(1, `hsla(${260 + t * 80},95%,60%,0)`);
      const camino = () => {
        g.beginPath();
        for (let x = 0; x <= W; x += 5) {
          const p = x / W, y = y0 + Math.sin(p * 5.2 + t * 3.4) * H * 0.11 * env + Math.sin(p * 13 + t * 8) * H * 0.018 * env;
          x ? g.lineTo(x, y) : g.moveTo(x, y);
        }
      };
      // brillo: el mismo trazo ancho y muy tenue debajo del fino (sin sombras, que se recortan en caja)
      g.strokeStyle = gr; g.globalAlpha = 0.18; g.lineWidth = 9 * u; camino(); g.stroke();
      g.globalAlpha = 1; g.lineWidth = 1.8 * u; camino(); g.stroke();
    }
    g.restore();
    vineta(g, W, H, 0.45);
  }
  function bauhaus(g, W, H, r) {
    g.fillStyle = '#ece4d4'; g.fillRect(0, 0, W, H);
    const u = H / 10;
    const formas = [
      () => { g.fillStyle = '#d9483b'; g.beginPath(); g.arc(W * 0.32, H * 0.5, u * 3, 0, Math.PI * 2); g.fill(); },
      () => { g.fillStyle = '#1c3d6e'; g.fillRect(W * 0.5, H * 0.18, u * 4, u * 6); },
      () => { g.fillStyle = '#f2b134'; g.beginPath(); g.arc(W * 0.5, H * 0.18 + u * 6, u * 2, Math.PI, Math.PI * 2); g.fill(); },
      () => { g.fillStyle = '#222'; g.beginPath(); g.moveTo(W * 0.68, H * 0.82); g.lineTo(W * 0.82, H * 0.82); g.lineTo(W * 0.68, H * 0.35); g.fill(); },
      () => { g.strokeStyle = '#222'; g.lineWidth = u * 0.12; g.beginPath(); g.arc(W * 0.32, H * 0.5, u * 3.6, -0.4, 1.2); g.stroke(); },
      () => { g.fillStyle = '#3f7d6e'; g.beginPath(); g.arc(W * 0.2, H * 0.22, u * 0.8, 0, Math.PI * 2); g.fill(); },
      () => { g.fillStyle = '#222'; for (let i = 0; i < 6; i++) g.fillRect(W * 0.86, H * 0.2 + i * u * 0.6, u * 1.4, u * 0.18); }
    ];
    formas.forEach((f) => f());
    grano(g, W, H, r, 14);
  }
  function colinas(g, W, H, r) {
    cielo(g, W, H, [[0, '#fbe3d0'], [0.6, '#f8c9b8'], [1, '#f5b5a8']]);
    g.fillStyle = '#fff3e8'; g.beginPath(); g.arc(W * 0.7, H * 0.32, H * 0.11, 0, Math.PI * 2); g.fill();
    const capas = ['#f2a7a0', '#e48b95', '#c9708c', '#a35a85', '#7c4a7c', '#553a6b'];
    capas.forEach((c, i) => {
      const base = H * (0.5 + i * 0.09), amp = H * (0.06 + i * 0.01), fase = r() * 6, fr = 1 + r() * 1.5;
      g.beginPath(); g.moveTo(0, H);
      for (let x = 0; x <= W; x += 4) g.lineTo(x, base - amp * Math.sin(x / W * Math.PI * fr + fase));
      g.lineTo(W, H); g.closePath(); g.fillStyle = c; g.fill();
    });
  }
  function prismas(g, W, H, r) {
    // triangulos de una malla deformada, cada uno con su tono: como un cristal tallado
    const cols = 22, filas = 13, pts = [];
    for (let j = 0; j <= filas; j++) for (let i = 0; i <= cols; i++) {
      const borde = i === 0 || j === 0 || i === cols || j === filas;
      pts.push([(i + (borde ? 0 : (r() - 0.5) * 0.8)) / cols * W, (j + (borde ? 0 : (r() - 0.5) * 0.8)) / filas * H]);
    }
    const P = (i, j) => pts[j * (cols + 1) + i];
    const tono = (x, y) => { const t = (x / W) * 0.6 + (y / H) * 0.4; return [mezcla(36, 280, t), 70, mezcla(28, 58, Math.sin(t * Math.PI))]; };
    for (let j = 0; j < filas; j++) for (let i = 0; i < cols; i++) {
      const a = P(i, j), b = P(i + 1, j), c = P(i, j + 1), d = P(i + 1, j + 1);
      [[a, b, c], [b, d, c]].forEach((tri) => {
        const cx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3, cy = (tri[0][1] + tri[1][1] + tri[2][1]) / 3, [h, s, l] = tono(cx, cy);
        g.fillStyle = `hsl(${h} ${s}% ${l + (r() - 0.5) * 14}%)`;
        g.beginPath(); g.moveTo(...tri[0]); g.lineTo(...tri[1]); g.lineTo(...tri[2]); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = 1; g.stroke();
      });
    }
    vineta(g, W, H, 0.45);
  }
  function metal(g, W, H, r) {
    g.fillStyle = '#0a0b0f'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 9; i++) {
      const y0 = H * (0.1 + i * 0.11), amp = H * (0.05 + r() * 0.05), fase = r() * 6, alto = H * 0.13;
      const y = (x) => y0 + amp * Math.sin(x / W * Math.PI * 2 + fase) + amp * 0.3 * Math.sin(x / W * Math.PI * 5 + fase * 2);
      g.beginPath(); g.moveTo(0, y(0));
      for (let x = 0; x <= W; x += 6) g.lineTo(x, y(x));
      for (let x = W; x >= 0; x -= 6) g.lineTo(x, y(x) + alto);
      g.closePath();
      const gr = g.createLinearGradient(0, y0 - amp, 0, y0 + alto + amp);
      gr.addColorStop(0, '#f5f7fa'); gr.addColorStop(0.18, '#9aa3b2'); gr.addColorStop(0.45, '#2a2f3a'); gr.addColorStop(0.7, '#c9d1dc'); gr.addColorStop(1, '#1a1d24');
      g.save(); g.shadowColor = 'rgba(0,0,0,.8)'; g.shadowBlur = 30; g.shadowOffsetY = 18; g.fillStyle = gr; g.fill(); g.restore();
      g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1.2; g.beginPath(); for (let x = 0; x <= W; x += 6) x ? g.lineTo(x, y(x)) : g.moveTo(x, y(x)); g.stroke();
    }
    vineta(g, W, H, 0.55);
  }

  /* ---------------- Catalogo ---------------- */
  const CATALOGO = [
    ['montanas', 'Montañas al atardecer', 'Paisajes', montanasAtardecer, 21],
    ['noche', 'Noche en la montaña', 'Paisajes', montanasNoche, 22],
    ['auroraBoreal', 'Aurora boreal', 'Paisajes', aurora, 23],
    ['dunas', 'Dunas', 'Paisajes', dunas, 24],
    ['mar', 'Océano de noche', 'Paisajes', oceano, 25],
    ['lago', 'Lago al amanecer', 'Paisajes', lago, 26],
    ['niebla', 'Bosque con niebla', 'Paisajes', bosqueNiebla, 27],
    ['ciudad', 'Ciudad al anochecer', 'Paisajes', ciudad, 28],
    ['planeta', 'Planeta con anillos', 'Espacio', planeta, 31],
    ['nebulosa', 'Nebulosa', 'Espacio', nebulosa, 32],
    ['eclipse', 'Eclipse', 'Espacio', eclipse, 33],
    ['orbes', 'Orbes', 'Minimalistas', orbes, 41],
    ['arcos', 'Arcos', 'Minimalistas', arcos, 42],
    ['topografia', 'Topografía', 'Minimalistas', topografia, 43],
    ['ondas', 'Ondas', 'Minimalistas', ondas, 44],
    ['bauhaus', 'Bauhaus', 'Minimalistas', bauhaus, 45],
    ['colinas', 'Colinas', 'Minimalistas', colinas, 46],
    ['prismas', 'Prismas', 'Minimalistas', prismas, 47],
    ['metal', 'Metal líquido', 'Minimalistas', metal, 48],
    ...Object.entries(CINTAS).map(([n, e]) => [n, 'Cintas ' + (n === 'Oceano' ? 'Océano' : n), 'Cintas', cintas(e), e.semilla])
  ];
  const porId = new Map(CATALOGO.map((c) => [c[0], c]));

  function pintar(id, W, H) {
    const c = porId.get(id) || porId.get('Brasa');
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d'), r = azar(c[4] * 7919 + 1), u = Math.min(W, H) / 1000;
    // las figuras se dibujan en una base de 1920x1080 escalada (mismo aspecto en cualquier pantalla)
    c[3](g, W, H, r, u);
    grano(g, W, H, azar(c[4] + 99), 8);
    return cv;
  }

  window.FondosAntuan = {
    catalogo: CATALOGO.map(([id, nombre, categoria]) => ({ id, nombre, categoria })),
    estilos: CATALOGO.map((c) => c[0]),
    pintar
  };
})();
