// Terminal Antuan: cada pestana es una consola real (pseudoterminal) del sistema.
// Windows: PowerShell con el indicador de Antuan. Antuan OS: el shell del usuario (bash) con sesion de inicio.
const { ipcMain } = require('electron');
const os = require('os');
const fs = require('fs');
const path = require('path');

const LINUX = process.platform === 'linux';
let pty = null;
try { pty = require('@lydell/node-pty'); } catch { }

const sesiones = new Map();
let siguiente = 1;

// Indicador Antuan para PowerShell: "toni  ~\Escritorio  ›" con los colores de Antuan
const PROMPT_PS = [
  'function global:prompt {',
  '  $e = [char]27; $p = $executionContext.SessionState.Path.CurrentLocation.Path;',
  '  if ($p.StartsWith($HOME)) { $p = "~" + $p.Substring($HOME.Length) };',
  '  "$e[38;2;157;180;255m$env:USERNAME$e[0m  $e[38;2;139;145;163m$p$e[0m  $e[38;2;157;180;255m›$e[0m "',
  '}',
  'Set-PSReadLineOption -Colors @{ Command = "#9db4ff"; Parameter = "#c5a3ff"; String = "#7ee0b5"; Operator = "#8b91a3"; Variable = "#ffc978"; Number = "#ffc978" } -ErrorAction SilentlyContinue',
  'Clear-Host'
].join('; ');

function shellPorDefecto() {
  if (LINUX) return { file: process.env.SHELL || '/bin/bash', args: ['-l'] };
  const pwsh = ['C:\\Program Files\\PowerShell\\7\\pwsh.exe'].find((p) => fs.existsSync(p));
  return { file: pwsh || 'powershell.exe', args: ['-NoLogo', '-NoExit', '-Command', PROMPT_PS] };
}

function registrar() {
  ipcMain.handle('term.disponible', () => !!pty);

  ipcMain.handle('term.crear', (e, o = {}) => {
    if (!pty) return { error: 'El motor de terminal no está disponible' };
    const sh = shellPorDefecto();
    // Antuan OS: las apps de consola (Terminal=true) se abren aqui; al terminar queda el shell
    if (LINUX && typeof o.orden === 'string' && o.orden) sh.args = ['-l', '-c', o.orden + '; exec "${SHELL:-/bin/bash}" -l'];
    else if (typeof o.orden === 'string' && o.orden) sh.args = ['-NoLogo', '-NoExit', '-Command', PROMPT_PS + '; & ' + o.orden];
    const cwd = o.cwd && fs.existsSync(o.cwd) ? o.cwd : os.homedir();
    const p = pty.spawn(sh.file, sh.args, {
      name: 'xterm-256color', cols: o.cols || 100, rows: o.rows || 30, cwd,
      env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor', TERM_PROGRAM: 'Umbra' }
    });
    const id = siguiente++;
    const wc = e.sender;
    sesiones.set(id, { p, wc });
    // Se agrupan los datos que llegan muy seguidos: menos mensajes, terminal mas fluida
    let buf = '', t = null;
    p.onData((d) => {
      buf += d;
      if (!t) t = setTimeout(() => { t = null; if (!wc.isDestroyed()) wc.send('term.datos', id, buf); buf = ''; }, 8);
    });
    p.onExit(({ exitCode }) => {
      sesiones.delete(id);
      setTimeout(() => { if (!wc.isDestroyed()) wc.send('term.fin', id, exitCode); }, 20);
    });
    // Si se cierra la ventana, se cierran sus consolas
    wc.once('destroyed', () => { for (const [k, s] of sesiones) if (s.wc === wc) { try { s.p.kill(); } catch { } sesiones.delete(k); } });
    return { id, shell: path.basename(sh.file) };
  });

  ipcMain.on('term.escribir', (_, id, data) => { const s = sesiones.get(id); if (s) s.p.write(data); });
  ipcMain.on('term.tamano', (_, id, cols, rows) => { const s = sesiones.get(id); if (s && cols > 0 && rows > 0) { try { s.p.resize(cols, rows); } catch { } } });
  ipcMain.on('term.cerrar', (_, id) => { const s = sesiones.get(id); if (s) { try { s.p.kill(); } catch { } sesiones.delete(id); } });
}

module.exports = { registrar };
