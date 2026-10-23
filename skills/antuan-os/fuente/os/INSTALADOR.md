# Instalador Antuan

Asistente que instala Antuan desde el pendrive al disco. Es Calamares 3.3 (paquete `calamares` de
Debian 13) con configuración, marca, estilos y diapositivas propios. No muestra "Debian" en ningún sitio.

## Pasos

Bienvenida → Región y zona horaria (Europa/Madrid) → Teclado (es) → Disco → Usuario → Resumen →
Instalación con diapositivas → Fin (con "Reiniciar ahora" marcado).

- **Disco**: borrar disco, instalar junto a otro sistema, reemplazar partición o manual. ext4 por
  defecto, btrfs opcional (subvolúmenes `@`, `@home`, `@cache`, `@log`), cifrado opcional (LUKS1 para
  que GRUB abra `/boot`). Intercambio: ZRAM siempre, archivo de intercambio opcional.
- **Usuario**: sin contraseña de root (administra con `sudo`), inicio automático opcional, equipo
  `umbra` por defecto. El nombre `umbra` está reservado (es el usuario de la sesión de prueba).
- **Requisitos**: 25 GB de disco y ser root son obligatorios; 4 GB de RAM e internet solo avisan.

## Archivos (`build/config/`)

| Ruta | Qué es |
|---|---|
| `includes.chroot/etc/calamares/settings.conf` | Orden de pasos y trabajos |
| `includes.chroot/etc/calamares/modules/*.conf` | Ajustes de cada módulo |
| `.../modules/shellprocess-arranque.conf` | Ejecuta `preparar-arranque.sh` (núcleo en `/boot`, GRUB sin red) |
| `.../modules/shellprocess-limpieza.conf` | Ejecuta `limpieza.sh` dentro del sistema instalado |
| `includes.chroot/usr/lib/umbra/instalador/` | Esos dos scripts y el estilo del diálogo de bienvenida (`gtk-4.0/gtk.css`) |
| `includes.chroot/usr/share/calamares/branding/umbra/` | `branding.desc`, `stylesheet.qss`, `show.qml`, imágenes y `diapositivas/1-5.png` |
| `includes.chroot/usr/bin/umbra-instalar` | Abre Calamares con `pkexec` (o `sudo` si no puede) |
| `includes.chroot/usr/bin/umbra-bienvenida` | Diálogo "Instalar Antuan / Probar Antuan sin instalar" |
| `includes.chroot/usr/share/applications/umbra-instalar.desktop` | Icono "Instalar Antuan" |
| `includes.chroot/etc/systemd/user/umbra-instalador.service` | Lanza la bienvenida al entrar (solo con `boot=live`) |
| `includes.chroot/etc/xdg/autostart/umbra-instalador.desktop` | Lo mismo para escritorios que lean el autoarranque XDG |
| `includes.chroot/etc/polkit-1/rules.d/49-umbra-instalador.rules` | El usuario de prueba abre el instalador sin contraseña |

El hook `9000-umbra.hook.chroot` borra la marca y los lanzadores de Calamares de la base, da permisos
a los scripts y activa el servicio de bienvenida. Al terminar de instalar, `limpieza.sh` quita del
sistema instalado todo lo anterior y el módulo `packages` desinstala `live-boot`, `live-config` y
`calamares`.

## Diapositivas

Las imágenes (1200×700, bienvenida 1200×480) se generan con HTML. Para cambiarlas, edita los HTML y
vuelve a renderizar con Electron (`electron <carpeta del script> entrada.html salida.png 1200 700`).
`show.qml` las alterna cada 7 s con fundido; se puede hacer clic para avanzar o retroceder.

## Probarlo

1. Construir la ISO (`sudo ./construir.sh` en `os/build`, Debian/WSL).
2. Arrancarla en una máquina virtual (Hyper-V de 2.ª generación para UEFI con el arranque seguro
   desactivado, o 1.ª generación para BIOS) con un disco virtual de 30 GB o más.
3. A los pocos segundos aparece la bienvenida; "Instalar Antuan" abre el instalador. También desde el
   icono "Instalar Antuan" o con `umbra-instalar` en una terminal.
4. Para ver errores: `sudo calamares -d` (registro en `~/.cache/calamares/session.log`; en el sistema
   instalado queda en `/var/log/installation.log`).
5. Probar las dos variantes de disco (ext4 y btrfs + cifrado) y comprobar que el sistema instalado
   arranca con el logo Antuan, sin el instalador ni la bienvenida.
