#!/bin/bash
# Arranca la ISO en una maquina virtual UEFI (KVM) y guarda capturas de pantalla cada pocos segundos.
# Uso: bash prueba-vm.sh <iso> <carpeta-capturas> [segundos-totales] [disco-qcow2-opcional]
ISO="$1"; OUT="$2"; TOTAL="${3:-180}"; DISCO="$4"
mkdir -p "$OUT"; rm -f "$OUT"/*.png
cp /usr/share/OVMF/OVMF_VARS_4M.fd /tmp/vars.fd; rm -f /tmp/qmp.sock
EXTRA=()
[ -n "$DISCO" ] && EXTRA=(-drive "file=$DISCO,if=virtio,format=qcow2")
qemu-system-x86_64 -enable-kvm -cpu host -smp 4 -m 4096 \
  -drive if=pflash,format=raw,readonly=on,file=/usr/share/OVMF/OVMF_CODE_4M.fd \
  -drive if=pflash,format=raw,file=/tmp/vars.fd \
  -cdrom "$ISO" -boot d "${EXTRA[@]}" \
  -device virtio-vga,xres=${ANCHO:-1024},yres=${ALTO:-640} -display ${PANTALLA:-none} -nic user,model=virtio-net-pci \
  -device qemu-xhci -device usb-tablet \
  -qmp unix:/tmp/qmp.sock,server,nowait &
PID=$!
sleep 2
n=0
for ((t = 0; t < TOTAL; t += 6)); do
  sleep 6
  kill -0 $PID 2>/dev/null || { echo "la VM se cerro"; break; }
  n=$((n + 1)); f=$(printf "%s/c%03d" "$OUT" "$n")
  printf '{"execute":"qmp_capabilities"}\n{"execute":"screendump","arguments":{"filename":"%s.ppm"}}\n' "$f" | socat - UNIX-CONNECT:/tmp/qmp.sock >/dev/null
  sleep 0.5; [ -f "$f.ppm" ] && pnmtopng "$f.ppm" > "$f.png" 2>/dev/null && rm -f "$f.ppm"
done
kill $PID 2>/dev/null
echo "capturas: $n"
