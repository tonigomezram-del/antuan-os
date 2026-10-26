#!/bin/bash
# Prueba de "instalar sin pendrive": crea un disco virtual como el de un PC con Windows
# (particion EFI + particion NTFS con \antuan\antuan.iso) y el arrancador de Antuan en la particion EFI.
# Uso: disco-sin-pendrive.sh <iso> <disco.img>
set -euo pipefail
ISO="$1"; IMG="$2"
apt-get install -y -qq ntfs-3g dosfstools gdisk squashfs-tools >/dev/null
rm -f "$IMG"; truncate -s 12G "$IMG"
sgdisk -o -n1:2048:+100M -t1:ef00 -n2:0:0 -t2:0700 "$IMG" >/dev/null
L=$(losetup -fP --show "$IMG")
mkfs.vfat -F32 -n SYSTEM "${L}p1" >/dev/null
mkntfs -Q -L Windows "${L}p2" >/dev/null
mkdir -p /mnt/esp /mnt/win /mnt/riso
mount "${L}p1" /mnt/esp; mount -t ntfs-3g "${L}p2" /mnt/win
mkdir -p /mnt/win/antuan /mnt/win/Windows; cp "$ISO" /mnt/win/antuan/antuan.iso
# El arrancador sale de la propia ISO: el script de Windows hace exactamente lo mismo
sed 's/\r$//' "$(dirname "$0")/arrancador-esp.sh" > /tmp/arrancador-esp.sh
bash /tmp/arrancador-esp.sh /mnt/win/antuan/antuan.iso /mnt/esp
# Sin entradas en la placa, el firmware virtual arranca \EFI\BOOT\BOOTX64.EFI: ahi va una copia
mkdir -p /mnt/esp/EFI/BOOT
cp /mnt/esp/EFI/debian/shimx64.efi /mnt/esp/EFI/BOOT/BOOTX64.EFI
cp /mnt/esp/EFI/debian/grubx64.efi /mnt/esp/EFI/BOOT/grubx64.efi
find /mnt/esp -type f | sort
umount /mnt/esp /mnt/win; losetup -d "$L"
echo "disco listo: $IMG"
