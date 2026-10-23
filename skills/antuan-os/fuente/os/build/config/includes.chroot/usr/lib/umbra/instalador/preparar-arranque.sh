#!/bin/sh
# Instalador Antuan: prepara el arranque del sistema recien copiado.
# Uso: preparar-arranque.sh <raiz del sistema instalado>
# Se ejecuta en la sesion de prueba (fuera del chroot) desde Calamares.
set -u
ROOT="${1:?falta la raiz del sistema instalado}"
MEDIO=/run/live/medium/live

echo "Antuan: preparando el arranque en $ROOT"

# 1) Nucleo en /boot. live-build lo deja en la imagen, pero si faltara se copia
#    del pendrive con el nombre de version que esperan GRUB e initramfs-tools.
if ! ls "$ROOT"/boot/vmlinuz-* >/dev/null 2>&1; then
    VER=$(ls "$ROOT/lib/modules" 2>/dev/null | sort -V | tail -n 1)
    ORIGEN=$(ls "$MEDIO"/vmlinuz* 2>/dev/null | head -n 1)
    if [ -n "$VER" ] && [ -n "$ORIGEN" ]; then
        echo "Antuan: copiando el nucleo $VER desde el pendrive"
        cp "$ORIGEN" "$ROOT/boot/vmlinuz-$VER"
    else
        echo "Antuan: no se encuentra el nucleo" >&2
        exit 1
    fi
fi

# 2) GRUB para UEFI (x86_64-efi) y BIOS (i386-pc). Vienen en la imagen
#    (grub-efi-amd64-bin y grub-pc-bin); si faltase alguno se intenta instalar
#    con red, sin detener la instalacion si no la hay.
FALTAN=""
[ -d "$ROOT/usr/lib/grub/x86_64-efi" ] || FALTAN="$FALTAN grub-efi-amd64-bin"
[ -d "$ROOT/usr/lib/grub/i386-pc" ]    || FALTAN="$FALTAN grub-pc-bin"
if [ -n "$FALTAN" ]; then
    echo "Antuan: intentando instalar$FALTAN"
    chroot "$ROOT" sh -c "DEBIAN_FRONTEND=noninteractive apt-get -y -q update && DEBIAN_FRONTEND=noninteractive apt-get -y -q install$FALTAN" || \
        echo "Antuan: sin red; se usara lo que ya trae la imagen" >&2
fi

# 3) Tema de arranque: si la sesion de prueba tiene el tema de GRUB de Antuan
#    y el sistema instalado no, se copia.
if [ -d /boot/grub/themes/umbra ] && [ ! -d "$ROOT/boot/grub/themes/umbra" ]; then
    mkdir -p "$ROOT/boot/grub/themes"
    cp -a /boot/grub/themes/umbra "$ROOT/boot/grub/themes/"
fi

exit 0
