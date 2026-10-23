#!/bin/bash
# Retoca el menu de arranque de la ISO ya construida: textos de Antuan y arranque solo a los 3 segundos.
# Uso: bash parchear-iso.sh <iso>   (reescribe la ISO en el mismo sitio, conservando el arranque UEFI/BIOS)
set -euo pipefail
ISO="$1"
T=$(mktemp -d)
xorriso -osirrox on -indev "$ISO" -extract /boot/grub/grub.cfg "$T/grub.cfg" -extract /boot/grub/live-theme/theme.txt "$T/theme.txt" 2>/dev/null
chmod u+w "$T"/*
sed -i \
  -e 's/menuentry "Live system ([^"]*fail-safe mode)"/menuentry "Antuan OS (modo seguro)"/' \
  -e 's/menuentry "Live system ([^"]*)"/menuentry "Antuan OS"/' \
  -e 's/menuentry "UEFI Firmware Settings"/menuentry "Ajustes del firmware (UEFI)"/' \
  -e 's/menuentry "Verify integrity of the boot medium"/menuentry "Comprobar el medio de arranque"/' \
  "$T/grub.cfg"
grep -q '^set timeout=' "$T/grub.cfg" || sed -i '1i set default=0\nset timeout=3\nset timeout_style=menu' "$T/grub.cfg"
sed -i -e 's/title-text: ".*"/title-text: ""/' -e 's/Press enter to boot the selected OS/Enter para arrancar/' \
  -e 's/Booting in %d seconds/Arrancando en %d s/' "$T/theme.txt"
xorriso -indev "$ISO" -outdev "$ISO.nuevo" -boot_image any replay \
  -update "$T/grub.cfg" /boot/grub/grub.cfg -update "$T/theme.txt" /boot/grub/live-theme/theme.txt 2>&1 | tail -n 2
mv -f "$ISO.nuevo" "$ISO"
rm -rf "$T"
echo "ISO retocada: $ISO"
