// Logos Antuan: extrae el icono original a 256 px y lo recrea en linea (con cache en disco).
const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { recrear } = require('./recrear');

const DIR = path.join(app.getPath('userData'), 'logos');
fs.mkdirSync(DIR, { recursive: true });
const VERSION = 'v2';

const keyFor = (src) => crypto.createHash('sha1').update(VERSION + src.toLowerCase()).digest('hex').slice(0, 16);

const LINUX = process.platform === 'linux';
function iconSource(a) {
  if (LINUX) return a.iconPath || (a.path && /\.(png|svg)$/i.test(a.path) ? a.path : null);
  if (a.kind === 'uwp') return 'shell:AppsFolder\\' + a.aumid;
  return a.lnk || a.exe || a.path || null;
}

// Antuan OS: el icono ya es un archivo (PNG o SVG) del tema de iconos; se convierte a PNG de 256 px.
function extractLinux(jobs) {
  const { execFileSync } = require('child_process');
  const ok = new Set();
  for (const j of jobs) {
    try {
      if (/\.svg$/i.test(j.src)) execFileSync('rsvg-convert', ['-w', '256', '-h', '256', '-o', j.png, j.src], { timeout: 4000 });
      else fs.copyFileSync(j.src, j.png);
      ok.add(j.png);
    } catch { }
  }
  return Promise.resolve(ok);
}

function readCache(key) {
  try { return JSON.parse(fs.readFileSync(path.join(DIR, key + '.json'), 'utf8')); } catch { return undefined; }
}

// Extrae muchos iconos de una vez con un solo PowerShell.
function extract(jobs) {
  return new Promise((resolve) => {
    if (!jobs.length) return resolve(new Set());
    const ok = new Set();
    const ps = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'iconos.ps1')], { windowsHide: true });
    let buf = '';
    ps.stdout.on('data', (d) => {
      buf += d.toString();
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (line.startsWith('ok ')) ok.add(line.slice(3));
      }
    });
    ps.on('exit', () => resolve(ok));
    ps.on('error', () => resolve(ok));
    ps.stdin.end(jobs.map((j) => `${j.png}|${j.src}`).join('\n') + '\n');
  });
}

// Rellena item.logo = { svg, hue, sat } y item.png (icono original) en cada elemento.
async function enrich(items) {
  const jobs = [];
  for (const it of items) {
    const src = iconSource(it);
    if (!src) continue;
    const key = keyFor(src);
    const png = path.join(DIR, key + '.png');
    const cached = readCache(key);
    if (cached !== undefined) { if (cached) it.logo = cached; if (fs.existsSync(png)) it.png = png; continue; }
    jobs.push({ it, key, png, src });
  }
  const ok = await (LINUX ? extractLinux(jobs) : extract(jobs));
  for (const j of jobs) {
    let logo = null;
    if (ok.has(j.png)) {
      j.it.png = j.png;
      try { logo = await recrear(j.png); } catch { logo = null; }
    }
    if (logo) j.it.logo = logo;
    try { fs.writeFileSync(path.join(DIR, j.key + '.json'), JSON.stringify(logo)); } catch { }
  }
  return items;
}

module.exports = { enrich, iconSource };
