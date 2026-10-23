// Procesos ayudantes de PowerShell que hablan por lineas (stdin/stdout).
// Se arrancan al primer uso y se cierran solos tras un rato sin trabajo: cero memoria en reposo.
const { spawn } = require('child_process');
const path = require('path');

class Ayudante {
  constructor(script, { idleMs = 180000, timeoutMs = 8000 } = {}) {
    this.script = path.join(__dirname, script);
    this.idleMs = idleMs;
    this.timeoutMs = timeoutMs;
    this.proc = null;
    this.queue = [];
    this.buf = '';
    this.idle = null;
  }

  start() {
    this.proc = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', this.script], { windowsHide: true });
    this.proc.stdout.setEncoding('utf8');
    this.proc.stdout.on('data', (d) => {
      this.buf += d;
      let i;
      while ((i = this.buf.indexOf('\n')) >= 0) {
        const line = this.buf.slice(0, i).trim();
        this.buf = this.buf.slice(i + 1);
        const w = this.queue.shift();
        if (w) { clearTimeout(w.t); w.resolve(line); }
      }
    });
    const dead = () => { this.proc = null; for (const w of this.queue.splice(0)) { clearTimeout(w.t); w.resolve(''); } };
    this.proc.on('exit', dead);
    this.proc.on('error', dead);
  }

  // Envia una orden y devuelve la linea de respuesta ('' si falla o tarda demasiado).
  ask(cmd, timeoutMs = this.timeoutMs) {
    if (!this.proc) this.start();
    this.touch();
    return new Promise((resolve) => {
      const w = { resolve };
      // Si una orden se atasca, se reinicia el ayudante para no desordenar las respuestas siguientes.
      w.t = setTimeout(() => { const i = this.queue.indexOf(w); if (i >= 0) this.queue.splice(i, 1); resolve(''); this.stop(); }, timeoutMs);
      this.queue.push(w);
      this.proc.stdin.write(cmd + '\n');
    });
  }

  async json(cmd, timeoutMs) {
    const line = await this.ask(cmd, timeoutMs);
    try { return JSON.parse(line); } catch { return null; }
  }

  touch() {
    clearTimeout(this.idle);
    this.idle = setTimeout(() => this.stop(), this.idleMs);
  }

  stop() {
    clearTimeout(this.idle);
    if (this.proc) { try { this.proc.stdin.end(); this.proc.kill(); } catch { } }
    this.proc = null;
  }
}

module.exports = { Ayudante };
