/* Fondos de Antuan para el cristal liquido.
 * Un degradado liso no deja ver la refraccion (no hay nada que doblar). Estos fondos tienen cintas de color
 * anchas y curvadas sobre negro, con sombra entre ellas y un brillo en el canto: bordes y contraste en toda la
 * pantalla, como los fondos de iOS 26. Se generan aqui (sin descargas), a la resolucion de la pantalla.
 */
(() => {
  'use strict';
  // Cada estilo: colores de las cintas (de atras a delante) y semilla de la composicion
  const ESTILOS = {
    Brasa: { fondo: '#060406', cintas: [['#4a0d1e', '#b3261e'], ['#ff5a1f', '#ff9466'], ['#c2185b', '#ff6f61'], ['#ffb347', '#ff7a2f'], ['#7a1236', '#e0452f']], semilla: 7 },
    Aurora: { fondo: '#04070a', cintas: [['#0b3d3a', '#1fa38f'], ['#5b2ca0', '#9b6bff'], ['#00c2a8', '#7ee0d2'], ['#2d1b69', '#6c4cf0'], ['#0f766e', '#34d399']], semilla: 3 },
    Oceano: { fondo: '#03060c', cintas: [['#0a2547', '#1e5fae'], ['#0ea5e9', '#6fc3ff'], ['#1e3a8a', '#4f7cff'], ['#22d3ee', '#a5f3fc'], ['#172554', '#3b82f6']], semilla: 11 },
    Lavanda: { fondo: '#07050b', cintas: [['#2e1065', '#7c3aed'], ['#c084fc', '#f0abfc'], ['#6d28d9', '#a78bfa'], ['#f472b6', '#fbcfe8'], ['#4c1d95', '#c4b5fd']], semilla: 5 },
    Bosque: { fondo: '#040805', cintas: [['#0f3d1f', '#1f7a3f'], ['#65a30d', '#bef264'], ['#166534', '#4ade80'], ['#a3e635', '#ecfccb'], ['#14532d', '#22c55e']], semilla: 9 }
  };

  // Aleatorio repetible: el mismo estilo siempre da el mismo fondo
  function azar(s) { return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

  function pintar(estilo, W, H) {
    const e = ESTILOS[estilo] || ESTILOS.Brasa, r = azar(e.semilla * 7919 + 1);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d'), u = Math.min(W, H) / 1000;
    g.fillStyle = e.fondo; g.fillRect(0, 0, W, H);

    // Cintas: curvas anchas que cruzan la pantalla en diagonal, de atras a delante
    e.cintas.forEach(([c1, c2], i) => {
      const grosor = (170 + r() * 230) * u;
      const y0 = H * (0.15 + r() * 0.85), y1 = H * (r() * 0.85);
      const p = [[-W * 0.15, y0], [W * (0.2 + r() * 0.2), H * (r() * 1.2 - 0.1)], [W * (0.6 + r() * 0.2), H * (r() * 1.2 - 0.1)], [W * 1.15, y1]];
      const camino = () => { g.beginPath(); g.moveTo(...p[0]); g.bezierCurveTo(...p[1], ...p[2], ...p[3]); };
      const gr = g.createLinearGradient(p[0][0], p[0][1], p[3][0], p[3][1]);
      gr.addColorStop(0, c1); gr.addColorStop(0.55, c2); gr.addColorStop(1, c1);
      g.lineCap = 'round';
      // sombra debajo: separa cada cinta de la de atras (borde con contraste)
      g.save(); g.shadowColor = 'rgba(0,0,0,.75)'; g.shadowBlur = 90 * u; g.shadowOffsetY = 30 * u;
      camino(); g.strokeStyle = gr; g.lineWidth = grosor; g.stroke(); g.restore();
      // volumen por bandas marcadas (estilo facetado, que a Toni le gusta mas que el suavizado):
      // borde oscuro, cuerpo y franja clara en el centro, cada una con su linea definida
      camino(); g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = grosor; g.stroke();
      camino(); g.strokeStyle = gr; g.lineWidth = grosor * 0.86; g.stroke();
      camino(); g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = grosor * 0.45; g.stroke();
      // brillo en el canto superior: una linea fina que el cristal dobla muy bien
      g.save(); g.translate(0, -grosor * 0.4);
      camino(); g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = 2.2 * u; g.stroke();
      g.restore();
      g.save(); g.translate(0, -grosor * 0.33);
      camino(); g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 14 * u; g.stroke();
      g.restore();
    });

    // Luz suave arriba y vineta en los bordes (el reloj y los widgets se leen bien)
    const luz = g.createRadialGradient(W * 0.7, -H * 0.1, 0, W * 0.7, -H * 0.1, W * 0.7);
    luz.addColorStop(0, 'rgba(255,255,255,.08)'); luz.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = luz; g.fillRect(0, 0, W, H);
    const vi = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    vi.addColorStop(0, 'rgba(0,0,0,0)'); vi.addColorStop(1, 'rgba(0,0,0,.5)');
    g.fillStyle = vi; g.fillRect(0, 0, W, H);

    // Grano fino para que no haya bandas en los degradados
    const n = document.createElement('canvas'); n.width = n.height = 180;
    const ng = n.getContext('2d'), id = ng.createImageData(180, 180);
    for (let k = 0; k < id.data.length; k += 4) { const v = r() * 255; id.data[k] = id.data[k + 1] = id.data[k + 2] = v; id.data[k + 3] = 9; }
    ng.putImageData(id, 0, 0); g.fillStyle = g.createPattern(n, 'repeat'); g.fillRect(0, 0, W, H);
    return cv;
  }

  window.FondosAntuan = { estilos: Object.keys(ESTILOS), pintar };
})();
