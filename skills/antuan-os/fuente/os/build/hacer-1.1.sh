#!/bin/bash
# Antuan OS 1.1 a partir de la ISO 1.0: IAs en la Tienda, descargas al Escritorio y buscador al instante.
set -euo pipefail
AQUI="${AQUI:-$(cd "$(dirname "$0")" && pwd)}"
RAIZ="$(cd "$AQUI/../.." && pwd)"
cp "$AQUI/antuan-20261020.iso" /root/antuan-1.1.iso
sed 's/\r$//' "$AQUI/remendar-iso.sh" > /tmp/remendar-iso.sh
sed 's/\r$//' "$AQUI/config/includes.chroot/usr/bin/umbra-session" > /tmp/umbra-session
APP="$RAIZ/dist/linux-unpacked" bash /tmp/remendar-iso.sh /root/antuan-1.1.iso \
  /tmp/umbra-session:/usr/bin/umbra-session \
  "$RAIZ/dist/Antuan-Instalar.exe:/etc/skel/Antuan Portable/Antuan-Instalar.exe"
cp /root/antuan-1.1.iso "$AQUI/antuan-1.1.iso"
echo "FIN 1.1"
