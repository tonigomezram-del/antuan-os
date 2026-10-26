#!/bin/bash
# Pone el arrancador de Antuan (shim + GRUB firmados de Debian: valen con Secure Boot) en una particion EFI.
# GRUB abre la ISO que esta dentro de la particion de Windows y arranca Antuan en la RAM ("toram"),
# asi el instalador puede borrar el disco entero sin pisarse a si mismo.
# Uso: arrancador-esp.sh <ruta-de-la-iso> <punto-de-montaje-EFI>
set -euo pipefail
ISO="$1"; ESP="$2"
umount /mnt/riso 2>/dev/null || true; mkdir -p /mnt/riso /tmp/arr
mount -o loop,ro "$ISO" /mnt/riso
KER=$(cd /mnt/riso/live && ls vmlinuz-* | head -n1); INI=$(cd /mnt/riso/live && ls initrd.img-* | head -n1)
rm -rf /tmp/arr/*
unsquashfs -q -f -d /tmp/arr /mnt/riso/live/filesystem.squashfs \
  usr/lib/shim/shimx64.efi.signed usr/lib/shim/mmx64.efi.signed usr/lib/grub/x86_64-efi-signed/grubx64.efi.signed
umount /mnt/riso
mkdir -p "$ESP/EFI/debian"
cp /tmp/arr/usr/lib/shim/shimx64.efi.signed "$ESP/EFI/debian/shimx64.efi"
cp /tmp/arr/usr/lib/shim/mmx64.efi.signed "$ESP/EFI/debian/mmx64.efi"
cp /tmp/arr/usr/lib/grub/x86_64-efi-signed/grubx64.efi.signed "$ESP/EFI/debian/grubx64.efi"
sed "s/@KER@/$KER/; s/@INI@/$INI/" > "$ESP/EFI/debian/grub.cfg" <<'EOF'
# Antuan OS: instalar sin pendrive (la ISO esta en \antuan\antuan.iso del disco de Windows)
set default=0
set timeout=5
search --no-floppy --file --set=disco /antuan/antuan.iso
loopback loop ($disco)/antuan/antuan.iso
menuentry "Instalar Antuan OS" {
  linux (loop)/live/@KER@ boot=live components toram findiso=/antuan/antuan.iso quiet splash loglevel=3 username=umbra hostname=antuan locales=es_ES.UTF-8 keyboard-layouts=es
  initrd (loop)/live/@INI@
}
menuentry "Volver a Windows" {
  search --no-floppy --file --set=w /EFI/Microsoft/Boot/bootmgfw.efi
  chainloader ($w)/EFI/Microsoft/Boot/bootmgfw.efi
}
EOF
echo "arrancador listo ($KER)"
