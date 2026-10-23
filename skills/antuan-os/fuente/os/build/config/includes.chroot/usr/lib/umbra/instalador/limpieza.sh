#!/bin/sh
# Instalador Antuan: se ejecuta DENTRO del sistema instalado al final.
# Quita todo lo que solo tiene sentido en la sesion de prueba del pendrive.

# Bienvenida automatica y lanzador "Instalar Antuan"
systemctl --global disable umbra-instalador.service 2>/dev/null || true
rm -f /etc/systemd/user/umbra-instalador.service
rm -f /etc/systemd/user/default.target.wants/umbra-instalador.service
rm -f /etc/xdg/autostart/umbra-instalador.desktop
rm -f /usr/share/applications/umbra-instalar.desktop
rm -f /usr/bin/umbra-instalar /usr/bin/umbra-bienvenida

# Permiso especial del usuario de prueba para abrir el instalador
rm -f /etc/polkit-1/rules.d/49-umbra-instalador.rules

# Configuracion y marca del instalador (el paquete calamares ya se ha quitado)
rm -rf /etc/calamares /usr/share/calamares

# Por ultimo, estos mismos scripts
rm -rf /usr/lib/umbra/instalador

exit 0
