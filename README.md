# Antuan OS

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

Después basta con decirle a Claude «Antuan OS» o «reconstruye mi ISO».

## Construir la ISO a mano

Los pasos están en [`skills/antuan-os/SKILL.md`](skills/antuan-os/SKILL.md) (WSL Debian + `os/build/lanzar.sh`).
