#!/bin/bash
# Mete archivos corregidos dentro del sistema de una ISO ya construida (sin repetir toda la construccion).
# Uso: remendar-iso.sh <iso> <origen>:<destino-dentro-del-sistema> ...
set -euo pipefail
ISO="$1"; shift
T=/var/tmp/remiendo
umount /mnt/riso 2>/dev/null || true
rm -rf -- "$T"; mkdir -p "$T" /mnt/riso
mount -o loop,ro "$ISO" /mnt/riso
COMP=$(unsquashfs -s /mnt/riso/live/filesystem.squashfs | awk '/^Compression/ {print $2}')
echo "Compresion: $COMP"
unsquashfs -q -d "$T/raiz" /mnt/riso/live/filesystem.squashfs
umount /mnt/riso
for par in "$@"; do
  src="${par%%:*}"; dst="${par#*:}"
  case "$dst" in */bin/*|*/sbin/*) m=755 ;; *) m=644 ;; esac; install -D -m $m "$src" "$T/raiz$dst"
  echo "  $dst"
done
# Escritorio Antuan completo (variable APP=carpeta linux-unpacked): sustituye /opt/umbra entero
if [ -n "${APP:-}" ]; then
  rsync -a --delete "$APP/" "$T/raiz/opt/umbra/"
  chmod 755 "$T/raiz/opt/umbra/umbra"
  [ -f "$T/raiz/opt/umbra/chrome-sandbox" ] && chown root:root "$T/raiz/opt/umbra/chrome-sandbox" && chmod 4755 "$T/raiz/opt/umbra/chrome-sandbox"
  echo "  /opt/umbra actualizado"
fi
# Paquetes extra (variable PAQUETES="a b c"): se instalan dentro del sistema con red
if [ -n "${PAQUETES:-}" ]; then
  for m in proc sys dev dev/pts; do mount --bind "/$m" "$T/raiz/$m"; done
  cp /etc/resolv.conf "$T/raiz/etc/resolv.conf"
  chroot "$T/raiz" sh -c "DEBIAN_FRONTEND=noninteractive apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends $PAQUETES && apt-get clean"
  for m in dev/pts dev sys proc; do umount -lf "$T/raiz/$m"; done
  echo "  paquetes: $PAQUETES"
fi
# Arranque nuevo (variable INITRD=1): se regenera el initrd dentro del sistema y se cambia tambien en la ISO
EXTRA=()
if [ -n "${INITRD:-}" ]; then
  for m in proc sys dev dev/pts; do mount --bind "/$m" "$T/raiz/$m"; done
  chroot "$T/raiz" update-initramfs -u -k all
  for m in dev/pts dev sys proc; do umount -lf "$T/raiz/$m"; done
  for i in "$T"/raiz/boot/initrd.img-*; do cp "$i" "$T/$(basename "$i")"; EXTRA+=(-update "$T/$(basename "$i")" "/live/$(basename "$i")"); done
  echo "  initrd regenerado"
fi
mksquashfs "$T/raiz" "$T/filesystem.squashfs" -comp "$COMP" -noappend -no-progress -quiet
xorriso -indev "$ISO" -outdev "$ISO.nuevo" -boot_image any replay \
  -update "$T/filesystem.squashfs" /live/filesystem.squashfs "${EXTRA[@]}" 2>&1 | tail -n 1
mv -f "$ISO.nuevo" "$ISO"
rm -rf -- "$T"
echo "ISO remendada: $ISO"
