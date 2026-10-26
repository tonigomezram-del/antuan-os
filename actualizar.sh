#!/bin/bash
# Actualiza el escritorio de un Antuan OS ya instalado con lo ultimo de GitHub, sin rehacer la ISO ni reinstalar.
# Uso (en la Terminal Antuan):  curl -fsSL https://raw.githubusercontent.com/tonigomezram-del/antuan-os/main/actualizar.sh | sudo bash
set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "Ejecutalo con sudo"; exit 1; }
T=$(mktemp -d)
echo "[ 10%] Descargando Antuan de GitHub..."
curl -fsSL https://codeload.github.com/tonigomezram-del/antuan-os/tar.gz/main | tar -xz -C "$T"
NUEVO="$T/antuan-os-main/skills/antuan-os/fuente/shell"
APP=/opt/umbra/resources/app
[ -d "$NUEVO" ] && [ -d "$APP" ] || { echo "No encuentro el escritorio Antuan"; exit 1; }
echo "[ 50%] Copia de seguridad en $APP.anterior"
rm -rf "$APP.anterior"; cp -a "$APP" "$APP.anterior"
echo "[ 70%] Instalando la version nueva..."
cp "$NUEVO"/*.js "$NUEVO"/*.ps1 "$NUEVO"/package.json "$APP"/ 2>/dev/null || true
cp -r "$NUEVO"/ui/. "$APP"/ui/
chmod -R a+rX "$APP"
rm -rf "$T"
echo "[ 90%] Reiniciando el escritorio Antuan..."
pkill -TERM -f '^/opt/umbra/umbra' || true   # la sesion lo vuelve a abrir solo en un segundo
echo "[100%] Antuan actualizado."
