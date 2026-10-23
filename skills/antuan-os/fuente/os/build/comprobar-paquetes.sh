#!/bin/bash
# Comprueba que todos los paquetes de la lista tienen candidato instalable en Debian trixie
cd "$(dirname "$(readlink -f "$0")")/config/package-lists"
for f in /etc/apt/sources.list.d/*.sources; do sed -i 's/^Components:.*/Components: main contrib non-free non-free-firmware/' "$f"; done
apt-get update -qq
for p in $(sed 's/\r$//;s/#.*//' *.list.chroot); do
  c=$(apt-cache policy "$p" | awk '/Candidate:/ {print $2}')
  if [ -z "$c" ] || [ "$c" = "(none)" ]; then echo "FALTA $p"; fi
done
echo FIN
