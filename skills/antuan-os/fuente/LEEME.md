# Antuan

Tu escritorio propio para Windows: flujo tipo Mac, oscuro, de cristal y mucho más cómodo.
Sustituye la barra de Windows, arranca solo al encender el PC y todo es reversible.

## Instalar en cualquier PC (Windows 10 u 11)

Basta con **`dist\Antuan-Instalar.exe`** (97 MB). No necesita nada instalado: doble clic, se instala en tu usuario
(sin permisos de administrador), arranca y queda puesto al iniciar Windows. Se desinstala desde
Configuración > Aplicaciones como cualquier programa, y la barra de Windows vuelve.

Al no estar firmado, Windows puede avisar: *Más información → Ejecutar de todos modos*.

Para trabajar sobre el código: `instalar-umbra.ps1` (necesita Node.js) o `npm run dist` en `shell` para regenerar el instalador.

## Lo que tienes

| | |
|---|---|
| **Dock** | Flotante, de cristal, arrastrable a cualquier borde; ampliación, vistas previas de ventanas al pasar, clic derecho para fijar, cerrar o ver ventanas |
| **Logos recreados** | Cada app redibujada en línea a partir de su logo original (`recrear.js`) |
| **Inicio** (tecla Win) | Apps fijadas y todas las apps, con búsqueda |
| **Spotlight** (Win + S) | Apps, archivos al instante, ajustes, acciones, calculadora, conversiones ("10 km a millas"), "apagar en 30 min" |
| **Mission Control** (Win + Tab o esquina sup. izq.) | Todas las ventanas en cuadrícula, cerrar con la X, cambiar de escritorio |
| **Zonas de anclaje** | Arrastra una ventana con Mayús pulsado: mitades, cuartos, tercios, centrada |
| **Panel rápido** | Wi-Fi, energía, mantener despierto, brillo, volumen por app, salida de audio, música con portada |
| **Calendario** | Al tocar el reloj |
| **Portapapeles** (Win + Alt + V) | Historial con búsqueda, fijar y pegar |
| **Selector de color** (Win + Alt + C) · **Texto de la pantalla** (Win + Alt + O) | Lupa con código de color · OCR sin internet |
| **Reabrir lo cerrado** (Win + Alt + Z) · **Restaurar sesión** | Al encender te ofrece volver a abrir tus apps donde estaban |
| **Escritorio Antuan** | Iconos ordenados por grupos, reloj, widgets (tiempo, música, sistema, notas) |
| **Centro Antuan** | Resumen con nota del PC, rendimiento en vivo, apps al inicio, limpieza segura, actualizaciones sin reinicios sorpresa, energía y batería, red (ping y ruta), sonido, privacidad, modos, personalización, accesibilidad, atajos |
| **Antuan Juego** | Detecta tus juegos; Modo Juego automático (energía, GPU, prioridad, OneDrive en pausa, sin grabación de fondo) que se deshace al cerrar; ping al servidor, ruta, comparador directo vs túnel WARP |

## Rendimiento

En reposo: ~0,1 % de CPU y ~430 MB de memoria privada (antes de optimizar: 871 MB y 1,3 %). Reacciona a eventos de Windows en vez de sondear; los ayudantes de PowerShell se cierran solos cuando no se usan. Si Antuan se cae, el vigilante lo reabre; si lo cierras, te devuelve la barra de Windows.

## Pendiente / ideas siguientes

- Contador de FPS en partida (necesita PresentMon de Intel con permiso de administrador).
- Mod propio de Windhawk para bordes y esquinas Antuan en todas las ventanas y barras de título oscuras.
- Núcleo nativo para bajar a ~100 MB.
- `limpiar-windhawk.ps1`: quita los mods de Windhawk que ya no hacen falta (pide administrador).
