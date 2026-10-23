# Antuan OS

Sistema operativo propio, instalable desde un pendrive. Todo lo visible es Antuan: arranque, instalador,
inicio de sesión, escritorio, archivos, tienda y ajustes. Por debajo usa el núcleo Linux (como SteamOS,
ChromeOS o Android) para funcionar en casi cualquier PC sin escribir miles de controladores.

## Piezas

| Pieza | Qué es | Base técnica |
|---|---|---|
| Arranque | Logo Antuan y animación al encender | GRUB con tema Antuan + Plymouth (`umbra`) |
| Instalador | Asistente Antuan (idioma, disco, usuario) con diapositivas propias | Calamares con marca y QML propios |
| Inicio de sesión | Pantalla de bloqueo/inicio Antuan | Greeter HTML propio (LightDM) |
| Escritorio | Dock, inicio, Spotlight, Mission Control, Centro, widgets | Antuan Shell (el de Windows, con motor X11) + picom (cristal y esquinas reales) |
| Ventanas | Barras de título y bordes Antuan | Openbox con tema Antuan |
| Archivos | Gestor de archivos propio | App Antuan (Electron) |
| Tienda | Instalar Chrome, Discord, Steam, Spotify... de un clic (tipo Ninite) | Antuan Tienda sobre Flatpak/APT |
| Paquetes | Formato propio `.umbra` | Contenedor con manifiesto + AppImage/archivos |
| Programas de Windows | Doble clic en un `.exe` y funciona | Wine/Proton (umu) integrado, sin que se vea |
| Juegos | Modo Juego, optimizador, ping | Gamemode, MangoHud, Steam/Proton |

## Fases

1. **Imagen arrancable** con identidad Antuan y el escritorio Antuan (probada en Hyper-V).
2. **Instalador Antuan** (Calamares con marca propia) y pantalla de inicio de sesión.
3. **Archivos Antuan**, ajustes del sistema y tema de ventanas.
4. **Antuan Tienda**, formato `.umbra` y compatibilidad con `.exe`.
5. **Juego**: drivers, Steam, Proton, Modo Juego, MangoHud.
6. Pulido, rendimiento y versión descargable.

## Limitaciones reales

- Juegos con antitrampas de núcleo (Valorant, Fortnite, LoL) no funcionan en ningún sistema que no sea Windows.
- Algunos programas de Windows muy ligados al sistema (antivirus, drivers) no funcionan con Wine.

## Construir

Necesita Debian (en WSL). Desde `os/build`: `sudo ./construir.sh` -> `antuan-<fecha>.iso`.
