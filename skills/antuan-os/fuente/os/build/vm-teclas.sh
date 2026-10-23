#!/bin/bash
# Envia teclas a la VM de prueba y guarda una captura. Uso: vm-teclas.sh <captura.png> [combo...] [-- texto]
# combo: p.ej. ctrl-alt-f2 ; texto: se escribe letra a letra y termina en Enter
OUT="$1"; shift
q() { printf '{"execute":"qmp_capabilities"}\n%s\n' "$1" | socat - UNIX-CONNECT:/tmp/qmp.sock >/dev/null; }
tecla() { local ks=""; IFS=- read -ra p <<< "$1"; for k in "${p[@]}"; do ks="$ks{\"type\":\"qcode\",\"data\":\"$k\"},"; done; q "{\"execute\":\"send-key\",\"arguments\":{\"keys\":[${ks%,}]}}"; sleep 0.15; }
while [ $# -gt 0 ]; do
  if [ "$1" = "--" ]; then shift; t="$*"; set --
    for ((i = 0; i < ${#t}; i++)); do c="${t:i:1}"
      case "$c" in
        ' ') tecla spc ;; '/') tecla shift-7 ;; '-') tecla slash ;; '.') tecla dot ;; '|') tecla alt_r-1 ;; '_') tecla shift-slash ;; '>') tecla shift-less ;; '*') tecla shift-bracket_right ;; ';') tecla shift-comma ;; ':') tecla shift-dot ;; '&') tecla shift-6 ;; '"') tecla shift-2 ;; '=') tecla shift-0 ;; "'") tecla minus ;; ',') tecla comma ;; '~') tecla alt_r-4 ;;
        [A-Z]) tecla "shift-${c,,}" ;; *) tecla "$c" ;;
      esac
    done; tecla ret
  else tecla "$1"; shift; fi
done
sleep 2
q "{\"execute\":\"screendump\",\"arguments\":{\"filename\":\"/tmp/x.ppm\"}}"; sleep 0.5
pnmtopng /tmp/x.ppm > "$OUT"
