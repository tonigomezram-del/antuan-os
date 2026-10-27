# Antuan OS

**Demo en vivo del cristal líquido:** https://tonigomezram-del.github.io/antuan-os/liquid-glass/skills/liquid-glass/kit/demo.html (ábrelo en Chrome, Edge o Brave)


## Actualizar un Antuan ya instalado

Abre la Terminal Antuan, pega esto y pon tu contraseña:

```
curl -fsSL https://raw.githubusercontent.com/tonigomezram-del/antuan-os/main/actualizar.sh | sudo bash
```

Se baja lo último y reinicia el escritorio. No hace falta pendrive ni ISO.

Desde la versión 1.2 también se puede actualizar desde **Centro → Actualizaciones → Antuan**: avisa cuando hay versión nueva aquí y la instala con un botón.

## Actualizar Antuan en Windows

Abre PowerShell y pega:

```
irm https://raw.githubusercontent.com/tonigomezram-del/antuan-os/main/actualizar.ps1 | iex
```

Vale para el Antuan instalado con Antuan-Instalar.exe y para la carpeta de código (UmbraOSshell). Cierra Antuan, cambia los archivos (guarda la versión anterior en una carpeta `.anterior`) y lo vuelve a abrir.

Sistema operativo y escritorio propio de Toni Gomez, sobre **Debian 13 "trixie"**. Este repositorio es a la vez:

- **El código completo** (`skills/antuan-os/fuente/`):
  - `shell/`: el escritorio Antuan (Electron), que funciona en Windows y en Linux.
  - `os/`: la distribución, construida con live-build: arranque, login, instalador Calamares, Tienda, Terminal...
- **Una skill para Claude Code** (`skills/antuan-os/SKILL.md`). Le da a Claude todo el contexto para reconstruir la ISO idéntica, instalarla y seguir mejorándola en cualquier PC.

## Usarlo en otro PC con Claude Code

```
/plugin marketplace add tonigomezram-del/antuan-os
/plugin install antuan-os@antuan-os
```

Y la skill de Liquid Glass (el cristal de Antuan para cualquier proyecto):

```
/plugin install liquid-glass@antuan-os
```

Después basta con decirle a Claude «Antuan OS» o «reconstruye mi ISO».

## Construir la ISO a mano

Los pasos están en [`skills/antuan-os/SKILL.md`](skills/antuan-os/SKILL.md) (WSL Debian + `os/build/lanzar.sh`).
