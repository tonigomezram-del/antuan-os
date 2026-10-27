---
name: antuan-os
description: Antuan OS (antes "Umbra"), el sistema operativo y escritorio propio de Toni sobre Debian 13. Úsala cuando Toni mencione Antuan, Antuan OS, Umbra, su sistema operativo, su escritorio/HUD/dock, la ISO, el pendrive de instalación, la Tienda, el Centro o quiera reconstruir, instalar, arreglar o mejorar su sistema en cualquier PC. Trae todo el código fuente en fuente/ y cómo reconstruir la ISO idéntica.
---

# Antuan OS

Sistema operativo propio de Toni (toni.gomez.ram@gmail.com). Responde **siempre en español**, directo y sin tecnicismos innecesarios: Toni no es programador de sistemas, quiere resultados y que se le diga cuánto falta (con porcentajes reales, nunca estimaciones optimistas).

## Qué es

- **Escritorio Antuan** (`fuente/shell`): app Electron 38 que sustituye la interfaz. Funciona en **Windows 10/11** (encima de Windows, con koffi/Win32) y en **Linux/X11** (Antuan OS). Dock flotante de cristal oscuro arrastrable a cualquier borde, menú de inicio, Spotlight, Mission Control, panel rápido (wifi, sonido, brillo, energía, luz nocturna), widgets (tiempo, música, sistema, notas), escritorio con grupos en tarjetas, Centro de configuración (personalización, rendimiento, optimizador de juegos con FPS/ping/rutas), Archivos, Tienda (tipo Ninite: Flathub/apt en Linux, winget en Windows), Terminal propia (xterm.js + node-pty) y formato de paquetes `.umbra`.
- **Antuan OS** (`fuente/os`): distribución sobre **Debian 13 trixie** construida con live-build. Marca total: arranque GRUB y Plymouth con la luna y "antuan", login propio (nody-greeter + tema HTML), instalador Calamares con marca propia (términos, crear usuario, "Borrar disco"/"Instalar junto a"), sesión `umbra-session` (picom + openbox + escritorio Antuan), `.exe` con Wine, firmware amplio de wifi/gráficas.
- Nombres internos que se quedan como "umbra" a propósito (no cambiarlos, rompería cosas): rutas `/opt/umbra`, órdenes `umbra-*`, `.umbra`, carpeta `UmbraOS`, ids `umbra:*`, `window.umbra`.
- Configuración de Toni (tema "Brasa", acento #ff9466, cristal 66, dock abajo 46 px, tiempo de Olot) en `fuente/os/build/config/includes.chroot/etc/skel/.config/Antuan/config.json`; su fondo en `usr/share/umbra/fondo-antuan.png`.

## Primer uso en un PC nuevo

1. Copia `fuente/` a `%USERPROFILE%\Desktop\Opensource ai\UmbraOS` (o donde diga Toni). Esa carpeta es el proyecto.
2. Escritorio en Windows: instala Node.js LTS si falta, luego en `UmbraOS\shell`: `npm install`, y para usarlo `npx electron . --login`; para el instalador portable `npx electron-builder --win nsis` (sale `dist\Antuan-Instalar.exe`).
3. Para Linux hace falta además `npm install --no-save --force @lydell/node-pty-linux-x64@1` (no está en package.json; un `npm install` normal lo quita) y `npx electron-builder --linux dir` → `dist/linux-unpacked`, que la ISO copia a `/opt/umbra`.

## Reconstruir la ISO idéntica (~25 min)

Necesita WSL con Debian (Toni debe ejecutar como administrador `wsl --install -d Debian` y reiniciar; si WSL ya está, `wsl --install -d Debian --no-launch` funciona sin admin). Se trabaja como root: `wsl -d Debian -u root`.

1. Compila antes `dist/linux-unpacked` (paso 3 de arriba) y, si se quiere la carpeta "Antuan Portable" dentro, `dist/Antuan-Instalar.exe`.
2. En WSL: `cd "/mnt/c/.../UmbraOS/os/build" && sed 's/\r$//' lanzar.sh > /root/lanzar.sh && bash /root/lanzar.sh > construir-log.txt 2>&1` (en segundo plano). `lanzar.sh` ejecuta una **copia** de `construir.sh` (editar un script de bash mientras corre lo rompe). `construir.sh` instala live-build, descarga nody-greeter de GitHub a `os/paquetes/`, renombra los .deb a `paquete_version_arq.deb` (live-build lo exige), copia marca y textos del menú de arranque, `lb build`, y al final `parchear-iso.sh` (textos del menú GRUB y espera de 3 s). Resultado: `os/build/antuan-AAAAMMDD.iso`.
3. Progreso: `grep -E '^(P: |E: )' construir-log.txt | tail`. Las fases: debootstrap → install pass (la larga) → hooks → squashfs → ISO.

### Arreglos rápidos sin reconstruir (~8 min)

`remendar-iso.sh <iso> origen:destino ...` abre la ISO, sustituye archivos, opcionalmente `APP=<dist/linux-unpacked>` (reemplaza /opt/umbra entero) y `PAQUETES="a b"` (apt-get dentro, con red), recomprime con la misma compresión y reescribe la ISO conservando el arranque. Úsalo para cualquier cambio pequeño; añade también el cambio a `config/` para que la próxima construcción completa lo lleve.

### Probar en máquina virtual

`prueba-vm.sh <iso> <carpeta-capturas> <segundos> [disco.qcow2]` (QEMU + KVM en WSL, UEFI OVMF; instalar `qemu-system-x86 qemu-system-gui qemu-utils ovmf netpbm socat`). Con `PANTALLA=gtk,zoom-to-fit=off` Toni la ve en una ventana (nunca pantalla completa; Ctrl+Alt+G suelta el ratón). `vm-teclas.sh` y `vm-clic.sh` mandan teclas y clics por QMP (teclado español en la VM; Ctrl+Alt+F2 da consola con el usuario de prueba `umbra`, Ctrl+Alt+F7 vuelve al escritorio). `revisar-iso.sh` y `revisar-drivers.sh` listan piezas y firmware dentro de la ISO. Copia la ISO a `/root/prueba.iso` antes de arrancarla si vas a remendar la original a la vez.

## Versiones

- **1.0** (2026-10-20/22, `antuan-20261020.iso`): todo lo de arriba más los arreglos de la lista de abajo. Probada en VM y en PCs reales del trabajo de su padre (arranca, instala, login).
- **1.1** (2026-10-23, `antuan-1.1.iso`, hecha con `os/build/hacer-1.1.sh` remendando la 1.0):
  - **IAs en la Tienda** (categoría "Inteligencia artificial" y pack "ias"): Claude, ChatGPT, Gemini, Copilot, Perplexity, Le Chat, DeepSeek y NotebookLM son **apps web** (`fuentes.web` en `tienda-catalogo.js`). `shell/webapps.js` crea `~/.local/share/applications/antuan-web-<id>.desktop` con `Exec=/opt/umbra/umbra --webapp=<id>` y su icono. La instancia que ya corre lo recibe por `second-instance` y abre una ventana sin barras con su propia sesión (`persist:web-<id>`), agente de Chrome normal (si no, Google bloquea el login) y ventanas emergentes de inicio de sesión permitidas.
  - **Claude Code**: `fuentes.script: 'claude-code'` ejecuta el instalador oficial (`curl -fsSL https://claude.ai/install.sh | bash`; en Windows `irm https://claude.ai/install.ps1 | iex`). Queda en `~/.local/bin/claude` con un lanzador que lo abre en la Terminal Antuan.
  - **Alpaca** (Flathub `com.jeffser.Alpaca`): IA local sin internet.
  - **Descargas al Escritorio**: `umbra-session` hace una vez por usuario `xdg-user-dirs-update --set DOWNLOAD <Escritorio>` (Firefox, Chrome y Flatpak lo respetan) y `webapps.js` guarda las descargas de las apps web en el Escritorio.
  - **Buscador al instante**: `buscador-linux.js` indexa al arrancar y vigila la carpeta personal con `fs.watch` (inotify, recursivo por carpeta de primer nivel). Lo nuevo, renombrado o borrado entra o sale del índice en ~1 s; además se rehace entero cada 10 min.
  - Verificado en VM: instalar Claude desde la Tienda y abrirlo en su ventana (pantalla de login de claude.ai). Probado en Windows: el buscador ve un archivo nuevo del Escritorio en 1,5 s.

## Dónde vive todo esto

- Repositorio público: **https://github.com/tonigomezram-del/antuan-os** (cuenta de GitHub de Toni: `tonigomezram-del`). Es a la vez marketplace de Claude Code: `/plugin marketplace add tonigomezram-del/antuan-os` y `/plugin install antuan-os@antuan-os`.
- Al cambiar algo: copia los archivos tocados de `UmbraOS/` a `skills/antuan-os/fuente/`, sube `version` en `.claude-plugin/plugin.json` (1.1 → 1.2...), apunta los cambios en "Versiones", y haz `git commit` + `git tag vX.Y` + `git push --tags`. Las ISO no van en git (2 GB): se regeneran con los scripts.
- La publicación en la biblioteca de la organización (herramienta PublishPlugin) falló el 2026-10-23 porque Claude Code no cargaba la política de la organización; por eso se usa GitHub.

## Fallos ya encontrados y arreglados (no repetirlos)

- `--hostname/--username` ya no existen en lb config; `policykit-1` → `polkitd pkexec`.
- Falta `user-setup` → la sesión de prueba no tenía usuario (pantalla negra, "Authentication failure").
- `nody-greeter` hay que listarlo en la lista de paquetes y con nombre `_amd64.deb`.
- picom con GLX en equipos sin aceleración pinta negro → `umbra-session` detecta llvmpipe con `glxinfo` (mesa-utils) y usa xrender sin desenfoque.
- La capa del dock es una ventana transparente a pantalla completa: excluirla del blur de picom (`window_type = 'dock'`) o todo se ve borroso.
- Clics en Linux: no hay `forward` en setIgnoreMouseEvents. La página manda las zonas `.hit` (`U.zonas`) y `native-linux.clickThrough` pone la forma de entrada XShape de la ventana y de su marco de openbox.
- `screen.dipToScreenRect` no existe en Linux (usar `aPixeles`/`aDip` de main.js).
- `gtk-launch` no viene: apps-linux.js ejecuta el `Exec` del .desktop; nunca `xdg-open` sobre un .desktop ni sobre URIs de Windows (`abrirSeguro` en main.js traduce `ms-settings:`/`shell:` al Centro/Archivos).
- Instalador: hacían falta `ntfs-3g` (para "Instalar junto a"), `squashfs-tools` (unpackfs), `shim-signed grub-efi-amd64-signed mokutil parted` (Secure Boot).
- **Placa colgada sin logo ni señal (HP, 2026-10-22)** tras reinstalar encima: entradas de arranque viejas/duplicadas en la NVRAM. Se arregló reseteando la placa (Windows+B al encender o quitando la pila). Desde entonces el instalador usa `/usr/local/sbin/antuan-grub-install` (`grub-install --removable --no-nvram`, arranque en `\EFI\BOOT\BOOTX64.EFI`) y `installEFIFallback: false`: **nunca escribe en la placa**. No volver a quitarlo.
- Login: nody-greeter usa señales (`lightdm.authentication_complete.connect`) y `window.lightdm` llega con el evento `GreeterReady`.
- Escritorio en Windows: al renombrar a Antuan la carpeta de datos pasó de `%APPDATA%\Umbra` a `%APPDATA%\Antuan` (los logos recreados están en `logos\`).

## Limitaciones que Toni ya sabe

- **Fortnite, Valorant y juegos con antitrampas** no funcionan en Linux (Epic anunció EAC Linux v2 en oct-2026, sin fecha). No ayudar a saltarse antitrampas.
- No hay app de escritorio oficial de Claude para Linux: desde la 1.1 la Tienda la instala como app web en ventana propia (igual que ChatGPT, Gemini...). Office de escritorio y Adobe tampoco (OnlyOffice / Office web).
- En su portátil Windows no deja encoger C: porque `$MFT` está al final del disco: instalar junto a Windows requiere MiniTool/AOMEI o usar "Borrar disco".

## Reglas con Toni

- Se cabrea con las estimaciones optimistas ("2 min" que son 20): da porcentajes reales mirando el progreso de verdad.
- La máquina virtual siempre en ventana pequeña (`PANTALLA=gtk,zoom-to-fit=off`), nunca a pantalla completa.
- No le reinicies el PC ni le propongas reiniciar a Windows para jugar: lo descartó.
- Pendiente de 2026-10-22: dijo que en un PC instalado veía "todo gris"; pedirle foto si vuelve a pasar. Chrome (Flatpak) está en `/var/lib/flatpak/exports/share/applications/com.google.Chrome.desktop`.

- Antes de que borre Windows de un PC suyo, recuérdale **copiar la carpeta `UmbraOS`** (código e ISO) a un disco externo o Drive.
- Las órdenes de administrador las ejecuta él (dáselas en un bloque para copiar); no reinicies su PC sin que lo pida.
- Antes de dar una ISO por buena, pruébala en la VM; cuéntale qué está probado y qué no.

## Instalar sin pendrive (2026-10-26)

`Instalar-Antuan-sin-pendrive.cmd` (doble clic, pide administrador) hace lo mismo que Rufus + pendrive desde el propio disco:
1. Comprueba UEFI y que C: **no esté cifrado** (el cifrado del dispositivo de Windows 11 viene activado: Configuración → Privacidad y seguridad → Cifrado del dispositivo → Desactivado, y esperar).
2. Copia la ISO más nueva a `C:\antuan\antuan.iso`.
3. Copia `os/arrancador/EFI/debian/` (shim + GRUB firmados de Debian sacados de la ISO con `arrancador-esp.sh`, y un grub.cfg que abre la ISO con `loopback` y arranca con `findiso=/antuan/antuan.iso toram`) a la partición EFI.
4. Crea con `bcdedit` una entrada "Antuan OS" y la pone solo para el siguiente arranque (`bootsequence`), quita la hibernación y reinicia.

Antuan se copia entero a la RAM, live-boot desmonta la partición de Windows y el instalador puede "Borrar disco". Para eso el initrd necesita `ntfs3`: va en `usr/share/initramfs-tools/modules.d/antuan-ntfs`, y `remendar-iso.sh` con `INITRD=1` regenera el initrd y lo cambia también en la ISO. Probado en VM con `disco-sin-pendrive.sh`, que crea un disco igual al de un PC con Windows: arranca hasta el escritorio con el instalador.

## Liquid Glass tipo iOS (2026-10-26)

`shell/ui/liquid.js` (basado en el artículo de kube.io): para cada capa `.wp` (la copia del fondo de pantalla que hay detrás del dock y de la bandeja), crea un mapa de desplazamiento con un bisel "squircle" convexo (refracción de Snell, n=1,5) y un mapa especular del canto. Un filtro SVG desplaza el fondo con aberración cromática (R, G y B con fuerzas ±10 %) y suma el brillo. Con alto contraste se apaga; `S.liquidGlass === false` también lo apaga. Los ajustes van en `LiquidGlass.ajustar({ bisel, grosor, refraccion, cromatica, desenfoque, especular, saturacion })`. Solo refracta el fondo de pantalla, no las ventanas que haya detrás (la ventana del dock es transparente y no las ve).
- Controles líquidos (`LiquidGlass.controles()` + `ui/liquid.css`, en el panel rápido y el Centro):
  - Cada `input[type=range]` se envuelve en `.lg-range` con una bola `.lg-thumb` de 48x30 que en reposo se ve a escala 0,625 (píldora blanca). Al pulsar crece con muelle y pasa a `backdrop-filter: url(#filtro)` (lente que refracta la barra).
  - Los `.switch` hacen lo mismo con su `::after`.
  - El dock y la bandeja se aplastan como gelatina al pulsarlos (animación de la propiedad `scale`).
  - Prueba visual: `Opensource ai/prueba-lg/` con el servidor `prueba-lg` de `.claude/launch.json`.
- Animación de la lente (`LiquidGlass.muelle(el, { reposo, activo, x, estira })`) copiada de la demo:
  - Usa tres muelles amortiguados: tamaño, posición x y estiramiento.
  - Al tocar crece con rebote. Al moverse se estira en la dirección del movimiento según la velocidad medida en pantalla (máximo ×1,22), y la sombra se queda atrás (`--lg-dx`/`--lg-dy`). Al soltar vuelve oscilando.
  - La usan la bola de los sliders (0,625 → 1) y la de los interruptores (`.lg-knob`, 0,667 → 1; salta 14 px con muelle al cambiar `aria-checked`).
  - `LiquidGlass.filtroFijo(w, h, r, ajustes, 'lente')` da el filtro para usar con `backdrop-filter` en una lente suelta, como en `prueba-lg/comparar.html`.
- Escritorio (`escritorio.html`):
  - Los widgets (Tiempo, Música, Sistema, Notas) llevan `backdrop-filter: url(#filtro a su medida)`. Están en la misma ventana que el fondo y los iconos, así que los refractan de verdad.
  - Al arrastrarlos por el título usan `LiquidGlass.muelle` (crecen a 1,045, se estiran con la velocidad y rebotan), y el texto se deforma con ellos.
  - La animación de entrada `fadeUp` se quita al terminar (`animationend`), porque si no, fija el transform.
  - Las tarjetas de grupos son "cristal sólido": rebotan al apretar su fondo (`solido()`), igual que los paneles `.panel.glass`.
- Dock: `gelatina(dock)` usa el muelle con la propiedad `scale` (el transform ya lo usa para colocarse). Crece al apretar y, al arrastrarlo entre bordes, se estira en el eje del movimiento (`dock._lgGel.mover()` en el pointermove de `umbra.js`).
- Ajustes (Centro > Personalización > Cristal líquido). Claves de config.json, en enteros:
  - `liquidGlass` (activar o desactivar), `lgRefraccion` (150 → 1,5), `lgCromatica` (6 → 0,06), `lgGrosor` (110), `lgDesenfoque` (12 → 1,2), `lgBrillo` (90 → 0,9), `lgTinte` (16 → 0,16) y `lgContenido` (40 → 0,4: cuánto se doblan el texto y los iconos de dentro de los widgets, filtro modo `contenido` sobre `.wd-in`).
  - `LiquidGlass.desdeConfig(cfg)` los convierte y `LiquidGlass.ajustar()` rehace capas y filtros (`alCambiar`).
  - Los valores de fábrica son la versión que Toni eligió (la "segunda"): línea de brillo fina, grosor 110, desenfoque 1,2 y tinte 0,16. NO volver al brillo ancho en todo el bisel: no le gustó.
- Forma de la curva (`lgSuperficie`: squircle, circulo, concavo o labio, como "Surface Type" de la demo) y ancho del borde (`lgBisel`, 5–70). En el Centro hay una vista previa con una lente que se arrastra sobre rayas y texto (`vistaLiquida()` en centro.js), para ver qué hace cada ajuste.
- **Ojo al editar con `String.replace` de JS:** en el texto de reemplazo, `$$` se convierte en `$`. Así se rompió el Centro (`$$('#pane input')` pasó a ser `$(...)` y daba un error que cortaba todos los ajustes). Usa una función como reemplazo o el editor.
- Prueba sin tocar la pantalla de Toni: `prueba-lg/app` (Electron oculto). `orden.json` lleva la URL, el prefijo y los pasos; cada paso ejecuta JS y guarda una captura con `capturePage`. La página `prueba-lg/centro.html` es el Centro con un `window.umbra` simulado (se sirve con el servidor `prueba-lg`).
- El cristal escala con su tamaño. Los ajustes valen para una pieza de 100 px de lado corto: el bisel y el grosor se multiplican por `lado corto / 100` (entre 0,6 y 3). Así un widget grande es una lente gruesa y no "una pequeña estirada".
  - Los controles y el filtro del contenido no escalan, para que el texto se lea.
  - La curva se calcula con esquinas al menos tan redondas como el bisel, para que no salgan pliegues en diagonal. El brillo usa la esquina real.
  - El contenido doblado se recorta con `clip-path: inset(0 round 22px)`.
- Aumento tipo lupa (`lgLupa`, 0–50 %, por defecto 12 %): a la curva del borde se suma un aumento centrado en todo el cristal. Así lo de detrás se ve más grande y curvado por toda la superficie, y no solo en el borde (con el centro plano, Toni no veía que se deformara lo de fuera). El mapa se calcula en píxeles y luego se normaliza (`escala = 2 × desplazamiento máximo`). El contenido y los controles no llevan lupa.
- Tarjetas de grupos del escritorio en cristal líquido:
  - `.group.lg` lleva radio de 34 px y un filtro a su medida (`grupoLiquido()` y `ponTarjeta()` tras cada `render()`).
  - Los iconos son "gotitas" con un filtro pequeño compartido (`--lg-gota`).
  - El filtro del contenido dobla como mucho `bisel × contenido` px, así que no repite la nube ni la portada en el borde.
  - Copia del escritorio para pruebas: `node prueba-lg/hacer-escritorio.js` (crea `prueba-lg/escritorio.html` con la config real y datos simulados) y la captura con `prueba-lg/app`. Los scripts de prueba están en `fuente/prueba-lg/`.
- Cada tipo de pieza tiene su propio diseño de cristal (`PIEZAS` en `liquid.js`, multiplica los ajustes del Centro):
  - `gota` (iconos): bisel ×1,5, sin lupa, refracción ×0,7.
  - `tarjeta`: más fina y plana (grosor ×0,6, lupa ×0,4).
  - `widget`: tal cual.
  - `dock` (capas del dock y la bandeja): bisel ×1,15, lupa ×0,6.
  - Se pasa con `filtroFijo(w, h, r, { pieza: 'tarjeta' }, 'lente')`.
  - A Toni le molesta que se note "el mismo cristal estirado": cada pieza nueva debe tener su propio diseño.
- Rendimiento ("va petadísimo", 2026-10-26):
  - Los iconos ya no llevan lente propia (eran más de 20 `backdrop-filter` a la vez); el canto de gota se pinta con sombras.
  - Los filtros se rehacen 160 ms después de que la pieza deje de cambiar de tamaño (la ampliación del dock lo cambiaba en cada fotograma y se regeneraba el mapa píxel a píxel).
  - Con el efecto cromático por debajo de 0,015 se usa una sola refracción en vez de tres.
  - El vigilante de controles revisa la página como mucho una vez por fotograma.
- Dock: mientras cambia de tamaño (arrastrarlo, ampliarlo) su cristal se rehace en cada fotograma con un mapa a media resolución (barato) y, cuando se para, a resolución completa (`seguirTamano`). El tamaño se mide con `offsetWidth` para que el rebote del muelle no cuente.
- Forma (`lgForma`: `redondo` o `cuadrado`): la clase `html.lg-cuadrado` baja los radios (dock y bandeja 16 px, widgets 22, tarjetas 20). Las piezas leen su radio del CSS.
- Encender y apagar: el interruptor "Cristal" del panel rápido (`data-setting="liquidGlass"`, activado por defecto) y el del Centro. El escritorio aplica o quita el cristal al momento.
- Actualizar Windows: `irm https://raw.githubusercontent.com/tonigomezram-del/antuan-os/main/actualizar.ps1 | iex` (Antuan instalado o carpeta `UmbraOS\shell`). Cierra Antuan, copia `fuente/shell` (guarda una copia en `.anterior`) y lo vuelve a abrir con los mismos argumentos.
- Arrastres fluidos (2026-10-26):
  - El dock y los widgets se mueven una vez por fotograma (se guarda el último evento del ratón y se aplica en `requestAnimationFrame`). El dock se mueve con `transform: translate3d`, que no recalcula la página.
  - El muelle toma la velocidad del ratón (`mover(x, y)`) en vez de medir la pieza en cada fotograma.
  - El estiramiento va solo en un eje, el del movimiento dominante (nunca en diagonal; a Toni le parecía feísimo): máximo +13 % (8 % con la propiedad `scale` del dock), y vuelve en unos 0,5 s.
- Fondos para el cristal líquido (`ui/fondos.js`, `FondosAntuan.pintar(estilo, W, H)`):
  - Estilos Brasa, Aurora, Oceano, Lavanda y Bosque: cintas de color anchas y curvas sobre negro, con sombra, bandas marcadas (a Toni le gustan más que el volumen suavizado) y un brillo fino en el canto.
  - Un degradado liso no deja ver la refracción. Se generan en el propio PC, sin descargas.
  - En el Centro: Personalización > "Fondos para cristal líquido".
  - Ojo: `setWallpaper` borra los `umbra-fondo-*.png` anteriores. El fondo antiguo de Toni está guardado en `%LOCALAPPDATA%\UmbraOS\fondos-guardados\`.
- Logos "A color" (por defecto, `logoStyle: 'color'`):
  - `recrear.js` ya trazaba cada color del icono real con potrace; ahora además devuelve `svgColor` (cada forma rellena con su color, algo más vivo) y `fondo` (el color del contenedor si el logo lo tiene).
  - `tile()` lo pinta sobre una baldosa de ese color o blanca suave (`.tile.color`, `.tile.color.claro`).
  - Vale para cualquier app, no una lista: se genera de su icono al instalarla (caché en `userData/logos`, versión `v3`).
  - Sin icono: el glifo de Antuan o la letra. Otros estilos: "Líneas" (`umbra`) y "Originales".
- Dock "Líquido" (por defecto, `dockEstilo`; "Clásico" es el de antes): más redondo (30 px), más aire, iconos al 92 % sin recuadro al pasar el ratón, separadores degradados y un punto blanco con brillo debajo de las apps abiertas. Al cambiar de estilo se recoloca (`layout`).
- Dock "Gota" (experimento, `dockEstilo: 'gota'`, `ui/gota.js`):
  - El dock es una gota de cristal pegada al borde, con silueta plana arriba y faldas en curva en S, como el menisco.
  - Recorre el perímetro de la pantalla (`gotaPos` es la fracción en sentido horario desde la esquina de arriba a la izquierda).
  - **Ctrl+Win+Alt + flechas** la deslizan con un muelle: se alarga y adelgaza con la velocidad. Al llegar a una esquina se dobla en L, con la esquina interior redondeada (suavizado de Chaikin).
  - Los iconos van por la línea central (se salta el bucle de la esquina) en orden de lectura.
  - El cristal es el fondo desenfocado una sola vez, recortado con `clip-path: path()`, más un trazo de brillo SVG.
  - En este modo `#dock` es una capa de toda la pantalla con `pointer-events: none`; los iconos son las zonas `.hit`.
  - Sin arrastre ni ampliación con el ratón.
  - `positionPanels` usa el grosor de la gota.
  - El borde donde está el centro es `S.edge`.
  - Prueba: `node prueba-lg/hacer-dock.js` y luego `prueba-lg/app`.
- Gota, mejoras:
  - **Esquina:** el líquido "se encharca". La franja de cada borde se une con un cuarto de círculo de radio 1,55 × grosor, centrado en la esquina (`paralela()`), y después `curvar()` (media móvil cada 3 px) suaviza las uniones. Los iconos van por la paralela a media altura, con radio 0,55 × el del charco.
  - **Cristal:** bisel de luz (trazo ancho difuminado recortado por la gota) y refracción real al pararse (`refractar()`: silueta a 1/3, difuminada; la pendiente da el mapa de `feDisplacementMap`). Mientras se mueve, sin filtro.
- Selección líquida del dock (`ui/seleccion.js`, todos los estilos): un cuadrito de cristal detrás del icono con el ratón encima, o de la app con el foco si el ratón no está encima de ninguno. Se desliza con un muelle de cuatro valores y se estira solo en el eje del movimiento.
- **Un solo cristal para todo** (Toni, 2026-10-27: "la configuración se debería aplicar a todo"):
  - Tarjetas, dock y widgets usan la misma lente (`PIEZAS` vacías) y el mismo radio (`--lg-r-widget`).
  - La Gota ya no usa fondo desenfocado: deja ver el fondo nítido con el mismo filtro que los widgets (desenfoque, refracción R/G/B, saturación y ajustes del Centro).
  - Su mapa sale de la silueta: desenfoque corto para el canto y largo para la lupa; la pendiente da la dirección; el desplazamiento se calcula en píxeles como en `mapas()`.
  - En movimiento, el mapa se desplaza con la gota (`moverMapa`, atributos x/y del `feImage`). Solo se recalcula al doblar una esquina (cada 150 ms como mucho, a 1/6) y al parar (a 1/3: unos 50 ms).
  - Ojo: en la ventana oculta de `prueba-lg/app` los fotogramas caen a 1 por segundo al moverse; es cosa de la prueba, no de la gota (en pantalla real va bien).
