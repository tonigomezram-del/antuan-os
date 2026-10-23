# Formato de paquete `.umbra`

Un `.umbra` es la forma nativa de distribuir una app para Antuan OS: **un solo archivo** que se abre con
doble clic, muestra una ficha bonita en la Tienda Antuan (icono, nombre, versión, autor, permisos) y se
instala con un botón. Funciona en Antuan OS (Linux) y en Antuan sobre Windows.

Implementación de referencia: `shell/umbra-paquete.js` (solo módulos de Node, sin dependencias).

---

## 1. Contenedor

Un `.umbra` es un **archivo ZIP normal** (PKWARE APPNOTE, sin cifrar) con la extensión `.umbra`.

| Requisito | Valor |
|---|---|
| Métodos de compresión | `0` (stored) o `8` (deflate) |
| Nombres | UTF-8 (bit 11 activado), separador `/`, rutas relativas sin `..` |
| ZIP64 | **No** (máx. 4 GB por paquete y 65 534 archivos) |
| Orden recomendado | `umbra.json` primero, luego el icono, luego la carga |
| Permisos Unix | se guardan en los atributos externos (`version made by` = 3); los ejecutables con `0755` |

Cualquier herramienta ZIP puede crear o inspeccionar un `.umbra` (`unzip -l app.umbra`), pero lo
recomendable es usar `crear()` de `umbra-paquete.js`, que ordena las entradas y valida el manifiesto.

## 2. Estructura

```
mi-app.umbra
├── umbra.json        ← manifiesto (obligatorio)
├── icono.png         ← icono cuadrado, 256×256 recomendado (PNG)
└── carga, según "tipo":
    ├── app/…             tipo "archivos" o "exe"  (carpeta con la app portátil)
    ├── app.AppImage      tipo "appimage"
    └── app.flatpakref    tipo "flatpakref"
                          tipo "winget": sin carga, solo el manifiesto
```

## 3. Manifiesto `umbra.json`

```json
{
  "formato": 1,
  "id": "org.ejemplo.LunaNotas",
  "nombre": "Luna Notas",
  "version": "1.2.0",
  "autor": "Estudio Ejemplo",
  "descripcion": "Notas rápidas con modo nocturno y etiquetas.",
  "icono": "icono.png",
  "color": "#e0609a",
  "tipo": "archivos",
  "ejecutable": "app/luna-notas",
  "argumentos": [],
  "categorias": ["Office", "Utility"],
  "permisos": ["red", "archivos", "notificaciones"],
  "sistemas": ["linux", "windows"],
  "licencia": "MIT",
  "web": "https://ejemplo.org/luna"
}
```

| Campo | Oblig. | Descripción |
|---|---|---|
| `id` | sí | Identificador inverso tipo DNS: `[a-zA-Z0-9][a-zA-Z0-9._-]{1,127}`. Da nombre a la carpeta de instalación. |
| `nombre` | sí | Nombre visible. |
| `version` | sí | Texto libre (se recomienda SemVer). |
| `tipo` | sí | `appimage` · `archivos` · `flatpakref` · `winget` · `exe` (ver §4). |
| `ejecutable` | según tipo | Ruta **relativa** dentro del paquete. Obligatorio en `archivos` y `exe`; en `appimage` vale por defecto `app.AppImage`. |
| `autor` | no | Persona u organización. |
| `descripcion` | no | Una o dos frases, se muestra en la ficha. |
| `icono` | no | Ruta del icono dentro del ZIP (por defecto `icono.png`). PNG, SVG, JPG o WebP. |
| `color` | no | `#rrggbb`: tiñe el fondo de la ficha. |
| `argumentos` | no | Lista de argumentos al lanzar. |
| `categorias` | no | Categorías freedesktop (`Office`, `Game`, `AudioVideo`…). Se copian al `.desktop`. |
| `permisos` | no | Lo que la app declara que usa (ver §5). Informativo: se muestra antes de instalar. |
| `sistemas` | no | `["linux"]`, `["windows"]` o ambos. Si no coincide, la Tienda muestra «No compatible». |
| `winget` | en `winget` | Id exacto del paquete de winget. |
| `instalador` | no | Solo `exe`: `true` si `ejecutable` es un instalador (se ejecuta con `argumentos`, p. ej. `["/S"]`) en vez de una app portátil. |
| `licencia`, `web` | no | Se muestran en la ficha. |
| `formato` | no | Versión del formato; hoy `1`. |

## 4. Tipos de carga

| `tipo` | Carga | Qué hace la instalación |
|---|---|---|
| `archivos` | `app/…` | Extrae y crea el acceso al `ejecutable`. Apps portátiles (Linux o Windows). |
| `appimage` | `app.AppImage` | Extrae, marca como ejecutable (`chmod 755`) y crea el acceso. |
| `flatpakref` | `app.flatpakref` | Linux: `flatpak install -y --noninteractive --user --from app.flatpakref`. |
| `winget` | — | Windows: `winget install --id <winget> --exact --silent …`. Útil como «enlace» bonito a una app de winget. |
| `exe` | `app/…` | Windows: programa portátil (`ejecutable` = el `.exe`) o, con `"instalador": true`, ejecuta el instalador. |

## 5. Permisos declarados

`red`, `archivos`, `descargas`, `camara`, `microfono`, `pantalla`, `notificaciones`, `inicio`,
`administrador`, `dispositivos`. Los marcados como sensibles (`archivos`, `camara`, `microfono`,
`pantalla`, `administrador`) se resaltan en ámbar en la ficha. En esta versión los permisos son
**declarativos** (transparencia para el usuario); el aislamiento real lo aportan Flatpak en Linux o el
propio sistema.

## 6. Instalación

| | Linux (Antuan OS) | Windows |
|---|---|---|
| Carpeta | `~/.local/share/umbra/apps/<id>/` (respeta `XDG_DATA_HOME`) | `%LOCALAPPDATA%\Umbra\apps\<id>\` |
| Acceso en el menú | `~/.local/share/applications/umbra-<id>.desktop` con `Exec`, `Icon`, `Categories`, `X-Umbra-Id` | `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Umbra\<nombre>.lnk` (vía PowerShell `WScript.Shell`; el PNG se envuelve en un `.ico`) |
| Registro | `<carpeta>/.umbra-instalado.json` (manifiesto + fecha, origen, acceso) | igual |

Reglas de seguridad del instalador:

- Cada entrada se comprueba contra *zip-slip*: ninguna ruta puede salir de la carpeta de destino.
- Se verifica el **CRC32** de cada archivo; si no coincide, la instalación se aborta.
- Reinstalar borra antes la versión anterior de esa misma `id`.
- Desinstalar = borrar la carpeta y el acceso.

## 7. Doble clic: abrir con la Tienda

Al hacer doble clic en un `.umbra` se abre la **Tienda Antuan** con la ficha del paquete
(icono grande, nombre, versión, autor, tipo, permisos, tamaño) y el botón **Instalar**.

- **Linux**: tipo MIME `application/x-umbra` (glob `*.umbra`) asociado a `umbra-tienda.desktop`
  (`Exec=umbra --tienda-paquete=%f`).
- **Windows**: asociación de `.umbra` (ProgID `Umbra.Paquete`) a
  `electron.exe <shell> --tienda-paquete="%1"`.
- El proceso principal abre la ventana `ui/tienda.html?paquete=<ruta>`. Si la Tienda ya está abierta,
  le envía el evento `tienda-paquete` con la ruta y ella muestra la ficha.

## 8. API de `umbra-paquete.js`

```js
const paquete = require('./umbra-paquete');

paquete.leer(ruta)
// → { ruta, manifiesto, icono /* dataURL */, tamano, tamanoInstalado, archivos, compatible, carga }
//   Solo lee el directorio central, umbra.json y el icono: no extrae nada.

await paquete.instalar(ruta, { destino, alProgreso: (pct, msg) => {}, sinAcceso, simular })
// → { ok, id, nombre, version, carpeta, ejecutable, acceso }

paquete.crear(carpetaOrigen, rutaSalida)
// carpetaOrigen debe tener umbra.json en la raíz → { ruta, archivos, bytes, manifiesto }

paquete.instalados()        // apps instaladas desde .umbra
await paquete.desinstalar(id)
paquete.lanzar(id)          // abre una app .umbra instalada
paquete.validar(manifiesto) // → lista de errores ([] si es válido)
```

## 9. Crear un paquete en 3 pasos

1. Carpeta `mi-app/` con `umbra.json`, `icono.png` y `app/` (o `app.AppImage`).
2. `node -e "require('./shell/umbra-paquete').crear('mi-app', 'mi-app.umbra')"`
3. Comparte `mi-app.umbra`. Doble clic → Tienda → Instalar.
