#!/bin/bash
# Cuenta los archivos de firmware (drivers) de wifi, bluetooth y graficas que lleva la ISO.
# Uso: revisar-drivers.sh <iso>
mkdir -p /mnt/iso
mount -o loop,ro "$1" /mnt/iso || exit 1
unsquashfs -l /mnt/iso/live/filesystem.squashfs > /root/lista.txt
umount /mnt/iso
for d in iwlwifi rtw88 rtw89 rtl_nic rtlwifi ath10k ath11k ath12k mediatek brcm intel/ibt amdgpu i915 xe nvidia radeon; do
  printf '%-10s %s archivos\n' "$d" "$(grep -c "firmware/$d" /root/lista.txt)"
done
echo "paquetes de firmware:"
grep -oE 'usr/share/doc/firmware-[^/]+' /root/lista.txt | sort -u | sed 's#usr/share/doc/#  #'
