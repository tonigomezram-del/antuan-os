#!/bin/bash
# Construye la imagen ISO de Antuan OS con live-build (Debian 13 "trixie" como base).
# Uso (en WSL Debian):  sudo ./construir.sh
set -euo pipefail
AQUI="$(cd "$(dirname "$0")" && pwd)"
RAIZ="$(cd "$AQUI/../.." && pwd)"           # carpeta UmbraOS
cd "$AQUI"

if [ "$(id -u)" -ne 0 ]; then echo "Ejecuta con sudo"; exit 1; fi
apt-get install -y --no-install-recommends live-build debootstrap squashfs-tools xorriso grub-pc-bin grub-efi-amd64-bin mtools dosfstools rsync

# Se construye en el disco de Linux (mucho mas rapido y sin problemas de permisos que en /mnt/c)
TRABAJO=/var/tmp/umbra-build
rm -rf "$TRABAJO" && mkdir -p "$TRABAJO"
rsync -a --exclude '*.iso' config auto "$TRABAJO"/
# Saltos de linea de Windows fuera y permisos de ejecucion
find "$TRABAJO" -type f \( -name '*.sh' -o -name '*.chroot' -o -path '*/usr/bin/*' -o -path '*/sbin/*' -o -path '*/auto/*' \) -exec sed -i 's/\r$//' {} + -exec chmod 755 {} +

# Escritorio Antuan compilado para Antuan OS (npm run dist-linux en shell)
if [ -d "$RAIZ/dist/linux-unpacked" ]; then
  mkdir -p "$TRABAJO/config/includes.chroot/opt/umbra"
  rsync -a "$RAIZ/dist/linux-unpacked/" "$TRABAJO/config/includes.chroot/opt/umbra/"
else
  echo "Aviso: falta dist/linux-unpacked (ejecuta 'npm run dist-linux' en shell)"
fi
# Carpeta "Antuan Portable" en la carpeta personal de cada usuario: el instalador de Antuan para otros PCs con Windows
PORT="$TRABAJO/config/includes.chroot/etc/skel/Antuan Portable"
mkdir -p "$PORT"
if [ -f "$RAIZ/dist/Antuan-Instalar.exe" ]; then cp "$RAIZ/dist/Antuan-Instalar.exe" "$PORT/"
elif [ -f "$RAIZ/dist/Umbra-Instalar.exe" ]; then cp "$RAIZ/dist/Umbra-Instalar.exe" "$PORT/Antuan-Instalar.exe"; fi
[ -f "$RAIZ/LEEME.md" ] && cp "$RAIZ/LEEME.md" "$PORT/LEEME.md"
# Motor de la pantalla de inicio de sesion Antuan (nody-greeter: muestra el tema HTML de Antuan)
mkdir -p "$AQUI/../paquetes"
if ! ls "$AQUI/../paquetes/"nody-greeter*.deb >/dev/null 2>&1; then
  apt-get install -y --no-install-recommends curl jq ca-certificates
  URL="$(curl -fsSL https://api.github.com/repos/JezerM/nody-greeter/releases/latest | jq -r '.assets[] | select(.name|endswith(".deb")) | .browser_download_url' | head -n1)"
  [ -n "$URL" ] && curl -fL "$URL" -o "$AQUI/../paquetes/$(basename "$URL")" || echo "Aviso: no se pudo descargar nody-greeter"
fi
# Paquetes .deb extra (pantalla de inicio de sesion, etc.)
if ls "$AQUI/../paquetes/"*.deb >/dev/null 2>&1; then
  mkdir -p "$TRABAJO/config/packages.chroot"
  # live-build exige nombres paquete_version_arquitectura.deb
  for d in "$AQUI/../paquetes/"*.deb; do
    cp "$d" "$TRABAJO/config/packages.chroot/$(dpkg-deb -f "$d" Package)_$(dpkg-deb -f "$d" Version)_$(dpkg-deb -f "$d" Architecture).deb"
  done
fi

# Menu de arranque del pendrive: plantillas de live-build con todos los textos en Antuan y fondo propio
mkdir -p "$TRABAJO/config/bootloaders"
for b in grub-pc grub-efi; do
  [ -d "/usr/share/live/build/bootloaders/$b" ] || continue
  rm -rf "$TRABAJO/config/bootloaders/$b"
  cp -r "/usr/share/live/build/bootloaders/$b" "$TRABAJO/config/bootloaders/$b"
  find "$TRABAJO/config/bootloaders/$b" -type f \( -name '*.cfg' -o -name '*.txt' -o -name '*.in' \) -exec sed -i \
    -e 's/Debian GNU\/Linux/Antuan/g' -e 's/Debian/Antuan/g' -e 's/debian/umbra/g' \
    -e 's/Live system (@FLAVOUR@)/Probar Antuan/g' -e 's/Live system/Probar Antuan/g' \
    -e 's/fail-safe mode/modo seguro/g' -e 's/Utilities/Herramientas/g' -e 's/Advanced install options/Opciones avanzadas/g' \
    -e 's/color_normal=.*/color_normal=light-gray\/black/' {} +
  [ -f "$RAIZ/os/marca/arranque.png" ] && cp "$RAIZ/os/marca/arranque.png" "$TRABAJO/config/bootloaders/$b/splash.png"
done
# El menu se salta solo a los 3 segundos
grep -rl 'set timeout' "$TRABAJO/config/bootloaders" 2>/dev/null | xargs -r sed -i 's/set timeout=.*/set timeout=3/' || true

cd "$TRABAJO"
lb clean --purge
./auto/config
lb build 2>&1 | tee build.log

ISO="$(ls -1 *.iso | head -n1)"
DESTINO="$AQUI/antuan-$(date +%Y%m%d).iso"
mv "$ISO" "$DESTINO"
sed 's/\r$//' "$AQUI/parchear-iso.sh" > /tmp/parchear-iso.sh && bash /tmp/parchear-iso.sh "$DESTINO"
echo "Listo: $DESTINO"
