#!/bin/bash
# Lanza construir.sh desde una copia (asi editar el original no afecta a la construccion en marcha)
AQUI="$(pwd)"   # se ejecuta desde la carpeta os/build
pkill -f "construir-copia.sh"; pkill -f "lb build"; pkill -f "lb chroot" 2>/dev/null; pkill -f debootstrap 2>/dev/null; sleep 2
mount | awk '{print $3}' | grep '^/var/tmp/umbra-build' | sort -r | while read -r m; do umount -lf "$m"; done
sed 's/\r$//' "$AQUI/construir.sh" > /root/construir-copia.sh
# La copia debe creer que vive en la carpeta original
sed -i "s#^AQUI=.*#AQUI=\"$AQUI\"#" /root/construir-copia.sh
cd "$AQUI" && exec bash /root/construir-copia.sh
