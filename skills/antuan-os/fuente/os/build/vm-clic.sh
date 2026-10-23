#!/bin/bash
# Clic en la VM de prueba. Uso: vm-clic.sh <captura.png> <x> <y> <ancho-pantalla> <alto-pantalla> [espera]
OUT="$1"; X=$(( $2 * 32767 / $4 )); Y=$(( $3 * 32767 / $5 )); ESPERA="${6:-3}"
q() { printf '{"execute":"qmp_capabilities"}\n%s\n' "$1" | socat - UNIX-CONNECT:/tmp/qmp.sock >/dev/null; }
q "{\"execute\":\"input-send-event\",\"arguments\":{\"events\":[{\"type\":\"abs\",\"data\":{\"axis\":\"x\",\"value\":$X}},{\"type\":\"abs\",\"data\":{\"axis\":\"y\",\"value\":$Y}}]}}"
sleep 1.2
q '{"execute":"input-send-event","arguments":{"events":[{"type":"btn","data":{"down":true,"button":"left"}}]}}'
sleep 0.1
q '{"execute":"input-send-event","arguments":{"events":[{"type":"btn","data":{"down":false,"button":"left"}}]}}'
sleep "$ESPERA"
q "{\"execute\":\"screendump\",\"arguments\":{\"filename\":\"/tmp/x.ppm\"}}"; sleep 0.5
pnmtopng /tmp/x.ppm > "$OUT"
