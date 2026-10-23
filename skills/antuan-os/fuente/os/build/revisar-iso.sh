#!/bin/bash
# Comprueba que la ISO lleva las piezas clave de Antuan. Uso: revisar-iso.sh <iso>
mkdir -p /mnt/iso
mount -o loop,ro "$1" /mnt/iso || exit 1
unsquashfs -l /mnt/iso/live/filesystem.squashfs > /root/lista.txt
umount /mnt/iso
for p in /opt/umbra/umbra /usr/bin/umbra /usr/bin/nody-greeter /usr/bin/calamares /usr/bin/firefox-esr \
  /usr/bin/openbox /usr/bin/picom /usr/sbin/lightdm "/etc/skel/Antuan Portable/Antuan-Instalar.exe" \
  /etc/skel/.config/Antuan/config.json /usr/share/web-greeter/themes/umbra/index.html /usr/share/xsessions/umbra.desktop \
  /usr/bin/wine /opt/umbra/resources/app/node_modules/@lydell/node-pty-linux-x64 /usr/sbin/user-setup-apply /usr/lib/user-setup; do
  if grep -qxF "squashfs-root$p" /root/lista.txt; then echo "OK    $p"; else echo "FALTA $p"; fi
done
