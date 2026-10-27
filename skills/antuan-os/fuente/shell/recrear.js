// Recrea un logo con el estilo de linea de Antuan:
// 1) separa el logo en sus colores principales (k-medias),
// 2) traza cada forma con potrace (curvas y vertices limpios),
// 3) devuelve los contornos como trazos y el color dominante para la baldosa.
const Jimp = require('jimp');
const { Potrace } = require('potrace');

const SIZE = 128;

function kmeans(pixels, k) {
  // Semillas por punto mas lejano: capta colores minoritarios pero importantes del logo.
  const centers = [pixels[0].slice(0, 3)];
  while (centers.length < k) {
    let best = null, bestD = -1;
    for (let i = 0; i < pixels.length; i += 7) {
      const p = pixels[i];
      const d = Math.min(...centers.map((c) => dist(p, c)));
      if (d > bestD) { bestD = d; best = p; }
    }
    if (bestD < 900) break;
    centers.push(best.slice(0, 3));
  }
  const assign = new Int32Array(pixels.length);
  for (let it = 0; it < 12; it++) {
    const sum = centers.map(() => [0, 0, 0, 0]);
    pixels.forEach((p, i) => {
      let bi = 0, bd = Infinity;
      centers.forEach((c, j) => { const d = dist(p, c); if (d < bd) { bd = d; bi = j; } });
      assign[i] = bi; const s = sum[bi]; s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; s[3]++;
    });
    sum.forEach((s, j) => { if (s[3]) centers[j] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]]; });
  }
  return { centers, assign };
}
const dist = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

function hsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min, s = l > .5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s, l };
}

function trace(img) {
  return new Promise((resolve, reject) => {
    const p = new Potrace({ turdSize: 22, alphaMax: 1.1, optCurve: true, optTolerance: 0.35, threshold: 128, blackOnWhite: true });
    p.loadImage(img, (err) => {
      if (err) return reject(err);
      const m = /\sd="([^"]+)"/.exec(p.getPathTag());
      resolve(m ? m[1].trim() : '');
    });
  });
}

async function recrear(pngPath) {
  const img = await Jimp.read(pngPath);
  img.contain(SIZE, SIZE);
  const { data } = img.bitmap;
  const px = [], idx = [];
  for (let i = 0; i < SIZE * SIZE; i++) {
    if (data[i * 4 + 3] > 150) { px.push([data[i * 4], data[i * 4 + 1], data[i * 4 + 2]]); idx.push(i); }
  }
  if (px.length < 60) return null;

  const { centers, assign } = kmeans(px, 4);
  const groups = centers.map((c, j) => ({ color: c, pixels: [], edge: 0 }));
  assign.forEach((g, n) => {
    const i = idx[n], x = i % SIZE, y = (i / SIZE) | 0;
    groups[g].pixels.push(i);
    if (x < 6 || y < 6 || x > SIZE - 7 || y > SIZE - 7) groups[g].edge++;
  });
  const total = px.length;
  const useful = groups.filter((g) => g.pixels.length / total > 0.02);

  // El "contenedor" (fondo cuadrado o circular del logo) no se traza: da el color de la baldosa.
  const opaqueShare = total / (SIZE * SIZE);
  // Contenedor: forma grande y maciza que ocupa casi todo el cuadrado (iconos tipo baldosa).
  // Su silueta no se dibuja porque la baldosa de Antuan ya hace ese papel.
  for (const g of useful) {
    let x0 = SIZE, y0 = SIZE, x1 = 0, y1 = 0;
    for (const i of g.pixels) { const x = i % SIZE, y = (i / SIZE) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    g.span = Math.min(x1 - x0, y1 - y0) / SIZE;
    g.fill = g.pixels.length / Math.max(1, (x1 - x0 + 1) * (y1 - y0 + 1));
  }
  const container = useful.filter((g) => g.span > 0.78 && g.fill > 0.62 && g.pixels.length / total > 0.35)
    .sort((a, b) => b.pixels.length - a.pixels.length)[0] || null;
  const shapes = useful.filter((g) => g !== container || useful.length === 1);

  const paths = [], capas = [];
  for (const g of shapes) {
    const mask = new Jimp(SIZE, SIZE, 0xffffffff);
    for (const i of g.pixels) mask.bitmap.data.writeUInt32BE(0x000000ff, i * 4);
    const d = await trace(mask);
    if (d) { paths.push(d); capas.push({ d, color: g.color, n: g.pixels.length }); }
  }
  if (!paths.length) return null;

  // Color de la baldosa: el contenedor si existe; si no, el grupo con mas color.
  const pick = container || useful.slice().sort((a, b) => {
    const ha = hsl(a.color), hb = hsl(b.color);
    return hb.s * Math.sqrt(b.pixels.length) - ha.s * Math.sqrt(a.pixels.length);
  })[0];
  const c = hsl(pick.color);
  // Logos multicolor (Chrome, Gemini...): baldosa grafito neutra, el dibujo manda.
  const vivid = useful.map((g) => hsl(g.color)).filter((x) => x.s > 0.4 && x.l > 0.2 && x.l < 0.85);
  let spread = 0;
  for (const a of vivid) for (const b of vivid) { const d = Math.abs(a.h - b.h); spread = Math.max(spread, Math.min(d, 360 - d)); }
  const multicolor = !container && vivid.length >= 2 && spread >= 100;
  // Estilo a color: cada forma rellena con su color real, algo mas vivo y limpio (logo plano y minimalista)
  const vivo = ([r, g, b]) => { const x = hsl([r, g, b]); return `hsl(${Math.round(x.h)} ${Math.round(Math.min(1, x.s * 1.15) * 100)}% ${Math.round(Math.min(0.92, Math.max(0.12, x.l)) * 100)}%)`; };
  const cont = container ? vivo(container.color) : null;
  const svgColor = `<svg viewBox="0 0 ${SIZE} ${SIZE}" xmlns="http://www.w3.org/2000/svg">${capas.sort((a, b) => b.n - a.n).map((k) => `<path d="${k.d}" fill="${vivo(k.color)}" fill-rule="evenodd"/>`).join('')}</svg>`;
  return {
    svgColor, fondo: cont,
    svg: `<svg viewBox="0 0 ${SIZE} ${SIZE}" xmlns="http://www.w3.org/2000/svg"><path d="${paths.join(' ')}" fill="none" stroke="#fff" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"/></svg>`,
    hue: multicolor ? 228 : Math.round(c.h),
    sat: multicolor || c.s < 0.18 ? 10 : 55
  };
}

module.exports = { recrear };
