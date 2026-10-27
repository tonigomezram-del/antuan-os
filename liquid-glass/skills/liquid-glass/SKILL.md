---
name: liquid-glass
description: Cristal líquido tipo iOS 26 (el de Antuan OS que le gusta a Toni) para cualquier web, app Electron o interfaz HTML. Refracción real con lupa y efecto cromático, brillo fino en el canto, sliders e interruptores con bola de cristal, botones y paneles con muelle, y ajustes en vivo. Úsala siempre que Toni quiera algo con "liquid glass", "cristal líquido", "estilo iPhone/iOS 26", "glassmorphism" o el estilo de Antuan, o cuando haga una interfaz nueva y quiera que se vea así.
---

# Liquid Glass (el de Antuan)

Responde a Toni **en español**, directo y sin tecnicismos. Este es el cristal que eligió tras muchas pruebas: respétalo tal cual y no inventes variantes "propias" (ver Reglas).

## Qué hay en `kit/`

| Archivo | Para qué |
| --- | --- |
| `liquid.js` | El motor: mapas de refracción (perfil de bisel con la ley de Snell), filtros SVG con efecto cromático R/G/B, muelles físicos y controles. Expone `window.LiquidGlass`. |
| `liquid.css` | La bola de cristal de los sliders (`.lg-thumb`) y de los interruptores (`.lg-knob`). |
| `liquid-kit.css` | Piezas listas: `.lg-cristal`, `.lg-panel`, `.lg-boton`, `.lg-icono`, `.lg-dock`, y la base de sliders e interruptores. Variables `--lg-tinte` y `--lg-acento`. |
| `fondos.js` | 24 fondos generados (paisajes, espacio, minimalistas, cintas): `FondosAntuan.pintar(id, W, H)` devuelve un canvas. |
| `demo.html` | Todo junto y funcionando: ábrelo para ver cada pieza y copiar el patrón. |

Copia la carpeta `kit/` al proyecto y parte de `demo.html`.

## Uso en 4 pasos

```html
<link rel="stylesheet" href="liquid.css">
<link rel="stylesheet" href="liquid-kit.css">
<section class="lg-cristal lg-panel">...</section>
<button class="lg-boton lg-cristal">Aceptar</button>
<input type="range"> <button class="switch" aria-checked="true"></button>
<script src="liquid.js"></script>
<script>
  LiquidGlass.iniciar();       // activa el modo cristal (clase html.lg)
  LiquidGlass.controles();     // sliders, interruptores y piezas .glass.liquid (también las que se añadan luego)
  document.querySelectorAll('.lg-cristal').forEach((el) => LiquidGlass.cristal(el));
</script>
```

1. **Detrás tiene que haber algo con formas.** Un degradado liso no deja ver la refracción: no hay nada que doblar. Usa una foto o `FondosAntuan.pintar('montanas', innerWidth, innerHeight)`.
2. El cristal refracta lo que hay detrás **en la misma página**, con `backdrop-filter: url(#filtro)`. En una ventana transparente (un dock de Electron) no ve el escritorio. Allí se pone una copia del fondo de pantalla dentro del elemento, como hace Antuan con `.wp` y `LiquidGlass.iniciar('.wp')`.
3. Cada elemento con `LiquidGlass.cristal(el)` recibe una lente a su medida, que se rehace sola si cambia de tamaño o de ajustes.
4. Los ajustes se cambian en vivo con `LiquidGlass.ajustar({...})`.

## API

- `LiquidGlass.cristal(el, { radio, contenido, muelle, activo, pieza })`
  - Convierte el elemento en cristal.
  - `contenido: true` dobla también el primer hijo cerca del canto (texto e iconos "detrás del vidrio").
  - `muelle` (activado por defecto) hace que crezca al apretarlo (`activo`, 1,04) y rebote.
  - Devuelve `{ actualizar, muelle }`.
- `LiquidGlass.controles()`:
  - Cada `input[type=range]` recibe una bola píldora blanca que, al pulsarla, crece con muelle y se vuelve lente (el borde toma los colores de debajo, saturados ×7).
  - Los `.switch` hacen lo mismo con su bola, y saltan con muelle al cambiar `aria-checked`.
  - Las piezas `.glass.liquid` reciben el efecto gelatina.
- `LiquidGlass.ajustar(ajustes)`: rehace todas las lentes. Valores de fábrica (los que eligió Toni):

  | Clave | Fábrica | Qué hace |
  | --- | --- | --- |
  | `superficie` | `'squircle'` | Forma del bisel: `squircle` (iOS, amplía), `circulo` (curva más fuerte), `concavo` (encoge), `labio` (anillo). |
  | `bisel` | 22 | Ancho del borde curvado en px (para una pieza de 100 px; escala con el tamaño). |
  | `grosor` | 110 | Grosor del vidrio: más, más se dobla el canto. |
  | `refraccion` | 1.5 | Fuerza de la refracción. |
  | `lupa` | 0.12 | Aumento de todo el cristal (lo de detrás se ve más grande y curvado). |
  | `cromatica` | 0.06 | Separación R/G/B en el canto (arcoíris). Con menos de 0,015 se calcula una sola refracción (más ligero). |
  | `desenfoque` | 1.2 | De vidrio limpio a esmerilado. |
  | `especular` | 0.9 | Brillo de la línea fina del canto. |
  | `tinte` | 0.16 | Oscuridad del cristal (también `--lg-tinte`). |
  | `contenido` | 0.4 | Cuánto se dobla el contenido con `contenido: true`. |
  | `forma` | `'redondo'` | `'cuadrado'` pone la clase `html.lg-cuadrado` para usar radios más pequeños. |

- `LiquidGlass.desdeConfig(cfg)` convierte ajustes guardados como enteros (`lgRefraccion: 150`…) en los de arriba.
- `LiquidGlass.muelle(el, { reposo, activo, x, estira, prop })`: la física de la lente de la web.
  - Devuelve `tocar()`, `soltar()`, `ir(x)` y `mover(x, y)`. Pásale la posición del puntero a `mover()` cuando arrastres: así no mide la página en cada fotograma.
  - `prop: 'scale'` usa la propiedad `scale` y no pisa un `transform` que ya tenga el elemento.
- `LiquidGlass.filtroFijo(w, h, radio, extra, modo)` devuelve el id de un filtro a medida (`'lente'`, `'control'` o `'contenido'`), por si necesitas montarlo a mano.
- `LiquidGlass.alCambiar(fn)` avisa cuando cambian los ajustes.

## Reglas de Toni (no las rompas)

- **Brillo:** una **línea fina y nítida** en el canto, fuerte arriba a la izquierda y abajo a la derecha. Nunca un halo ancho por todo el bisel: "solo brillo" le pareció horrible.
- **El mismo cristal en todo:** paneles, botones, dock, tarjetas y widgets. Nada de un diseño distinto por pieza; lo que se toca en los ajustes se aplica a todo por igual.
- **Escala con el tamaño:** una pieza grande es un cristal más grueso, no uno pequeño estirado (lo hace `mapas()` solo).
- **Animaciones con muelle:**
  - Crece al tocar.
  - Se estira con la velocidad **solo en horizontal o en vertical, nunca en diagonal** (le parece feísimo), como mucho un 13 %.
  - Vuelve en unos 0,5 s.
  - Un movimiento por fotograma: guarda el último evento del ratón y aplícalo en `requestAnimationFrame`. Mueve con `transform`.
- **Radios generosos:** 38 px en paneles y widgets, 30 px en docks y píldoras en botones. Nada cuadrado, salvo que pida el modo cuadrado.
- **Selección:** un cuadrito de cristal detrás del elemento con el ratón encima, o del activo si no hay ninguno, que salta con muelle (como `seleccion.js` de Antuan).
- **Fondos:** con formas y contraste. Le gustan las bandas marcadas, no el volumen suavizado ("parece shade smooth de Blender").

## Rendimiento

- No regeneres mapas en cada fotograma: espera a que el tamaño se quede quieto (unos 160 ms). Si algo se desplaza, mueve el `feImage` en vez de recalcularlo.
- Pocas lentes a la vez: decenas de `backdrop-filter` con SVG pesan. Los iconos pequeños mejor con un brillo de CSS que con su propia lente.
- `backdrop-filter: url()` solo funciona en Chromium (Chrome, Edge, Electron). En Safari y Firefox el kit se queda en cristal esmerilado normal; pon `backdrop-filter: blur(18px) saturate(1.6)` como alternativa si hace falta.

## Origen

Viene de Antuan OS (repositorio `tonigomezram-del/antuan-os`, `skills/antuan-os/fuente/shell/ui/`), basado en el artículo de kube.io sobre el Liquid Glass de Apple. Si cambias el motor en Antuan, copia `liquid.js`, `liquid.css` y `fondos.js` también aquí y sube la versión del plugin.
