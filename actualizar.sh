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
cp "$NUEVO"/*.js "$NUEVO"/*.ps1 "$NUEVO"/*.json "$APP"/ 2>/dev/null || true
cp -r "$NUEVO"/ui/. "$APP"/ui/
chmod -R a+rX "$APP"
rm -rf "$T"
# Antuan AI: el motor (Ollama) y el modelo, que se elige por la memoria del PC. Ollama necesita zstd para descomprimirse.
echo "[ 75%] Antuan AI: preparando el motor de IA..."
apt-get install -y zstd xdotool >/dev/null 2>&1 || true
if ! command -v ollama >/dev/null 2>&1 && [ ! -x /usr/local/bin/ollama ]; then
  echo "[ 80%] Instalando el motor de Antuan AI (Ollama, puede tardar unos minutos)..."
  curl -fsSL https://ollama.com/install.sh | sh || echo "No se pudo instalar Ollama"
fi
systemctl enable --now ollama >/dev/null 2>&1 || true
RAM_GB=$(awk '/MemTotal/ {printf "%d", $2/1048576}' /proc/meminfo)
# Con tarjeta grafica NVIDIA (o AMD con ROCm) el modelo va en la grafica; si no, todo lo hace el procesador
# y hay que ir a uno mas pequeno para que conteste en segundos.
GRAFICA=no
{ nvidia-smi -L >/dev/null 2>&1 || [ -e /dev/kfd ]; } && GRAFICA=si
# Todos contestan directamente, sin "pensar en voz alta" antes (salvo qwen3:8b, al que Antuan le apaga ese modo).
if [ "$GRAFICA" = si ]; then
  if [ "$RAM_GB" -ge 14 ]; then MODELO=qwen3:8b; elif [ "$RAM_GB" -ge 7 ]; then MODELO=qwen3:4b-instruct; else MODELO=qwen2.5:3b; fi
else
  if [ "$RAM_GB" -ge 14 ]; then MODELO=qwen3:4b-instruct; elif [ "$RAM_GB" -ge 5 ]; then MODELO=qwen2.5:1.5b; else MODELO=qwen2.5:0.5b; fi
fi
echo "         Memoria: $RAM_GB GB, tarjeta gráfica para IA: $GRAFICA -> modelo $MODELO"
IA=/var/lib/antuan-ia; mkdir -p "$IA"; chmod 755 "$IA"; echo "$MODELO" > "$IA/modelo"
if command -v ollama >/dev/null 2>&1 || [ -x /usr/local/bin/ollama ]; then
  echo "[ 85%] Antuan AI: descargando el modelo $MODELO ($RAM_GB GB de memoria). Sigue en segundo plano; el progreso sale en el widget."
  # se descarga aparte, para que el escritorio vuelva ya; cada linea de progreso se deja en $IA/progreso.json
  cat > "$IA/descargar.sh" <<'FIN'
#!/bin/bash
IA=/var/lib/antuan-ia; M="$1"
echo "{\"status\":\"esperando al motor\",\"model\":\"$M\"}" > "$IA/progreso.json"
for i in $(seq 90); do curl -fs http://127.0.0.1:11434/api/tags >/dev/null && break; sleep 1; done
curl -sN http://127.0.0.1:11434/api/pull -d "{\"model\":\"$M\"}" | while IFS= read -r l; do printf '%s\n' "$l" >"$IA/progreso.tmp" && mv -f "$IA/progreso.tmp" "$IA/progreso.json"; done
if grep -q '"status":"success"' "$IA/progreso.json"; then
  # los modelos de Antuan AI que ya no se usan (por ejemplo uno grande que iba lento) se borran para liberar disco
  for V in qwen3:8b qwen3:4b qwen3:1.7b qwen3:0.6b qwen3:4b-instruct qwen2.5:3b qwen2.5:1.5b qwen2.5:0.5b; do
    [ "$V" = "$M" ] || curl -s -X DELETE http://127.0.0.1:11434/api/delete -d "{\"model\":\"$V\",\"name\":\"$V\"}" >/dev/null 2>&1
  done
else
  echo '{"error":"La descarga se ha cortado. Vuelve a actualizar Antuan para reintentarlo."}' > "$IA/progreso.json"
fi
chmod 644 "$IA/progreso.json"
FIN
  chmod 755 "$IA/descargar.sh"
  setsid nohup "$IA/descargar.sh" "$MODELO" >/dev/null 2>&1 < /dev/null &
else
  echo '{"error":"No se pudo instalar el motor de Antuan AI. Revisa la conexión y vuelve a actualizar."}' > "$IA/progreso.json"
fi
chmod 644 "$IA"/*.json "$IA/modelo" 2>/dev/null || true
echo "[ 90%] Reiniciando el escritorio Antuan..."
pkill -TERM -f '^/opt/umbra/umbra' || true   # la sesion lo vuelve a abrir solo en un segundo
echo "[100%] Antuan actualizado."
