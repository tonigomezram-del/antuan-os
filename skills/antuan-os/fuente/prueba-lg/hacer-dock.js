// Copia del dock de Antuan (index.html) con window.umbra simulado, para probar el modo Gota sin tocar la pantalla
const fs = require('fs'), path = require('path');
const ui = path.join(__dirname, '..', 'UmbraOS', 'shell', 'ui');
let s = fs.readFileSync(path.join(ui, 'index.html'), 'utf8');
s = s.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, '');
s = s.replace(/(src|href)="([^":]+\.(js|css))"/g, '$1="../UmbraOS/shell/ui/$2"');
const cfg = Object.assign(JSON.parse(fs.readFileSync(path.join(process.env.APPDATA, 'Antuan', 'config.json'), 'utf8')), { dockEstilo: 'gota', edge: 'bottom' });
delete cfg.gotaPos;
const glifos = ['folder', 'globe', 'code', 'chat', 'music', 'game', 'terminal', 'bag', 'note'];
const catalog = glifos.map((g, i) => ({ id: 'a' + i, name: 'App ' + i, kind: 'desktop', glyph: g, hue: i * 40 }));
cfg.pinned = catalog.map((a) => a.id);
const stub = `<script>window.__oy={};window.__cfg=${JSON.stringify(cfg)};
const base={plataforma:'win32',init:async()=>({config:__cfg,catalog:${JSON.stringify(catalog)},plataforma:'win32',wallpaper:'../UmbraOS/os/build/config/includes.chroot/usr/share/umbra/fondo-antuan.png',user:'Toni'}),
on:(c,f)=>{(__oy[c]=__oy[c]||[]).push(f)},config:(p)=>Object.assign(__cfg,p)};
window.umbra=new Proxy(base,{get:(t,k)=>k in t?t[k]:(()=>Promise.resolve(null))});</script>`;
s = s.replace('<script src="../UmbraOS/shell/ui/icons.js"></script>', stub + '<script src="../UmbraOS/shell/ui/icons.js"></script>');
fs.writeFileSync(path.join(__dirname, 'dock.html'), s);
console.log('ok');
