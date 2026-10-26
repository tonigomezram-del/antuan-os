// Copia del escritorio de Antuan con window.umbra simulado (iconos de ejemplo y la config real de Toni)
const fs = require('fs'), path = require('path');
const ui = path.join(__dirname, '..', 'UmbraOS', 'shell', 'ui');
let s = fs.readFileSync(path.join(ui, 'escritorio.html'), 'utf8');
s = s.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, '');
s = s.replace(/(src|href)="([^":]+\.(js|css))"/g, '$1="../UmbraOS/shell/ui/$2"');
const cfg = JSON.parse(fs.readFileSync(path.join(process.env.APPDATA, 'Antuan', 'config.json'), 'utf8'));
const nombres = { Apps: ['Antigravity', 'Chrome', 'Gemini', 'Edge', 'P', 'Reinos', 'AiPPT', 'Google Chrome', 'VS Code', 'VLC', 'Windhawk'], Juegos: ['AntuanLauncher', 'Minecraft', 'Roblox Player', 'Roblox Studio', 'Steam'], Carpetas: ['Capturas', 'CapturasInfo', 'Opensource ai'], Sistema: ['Papelera'] };
const colores = ['#ef4444', '#f59e0b', '#3b82f6', '#22c55e', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];
const icono = (c) => 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="6" y="6" width="52" height="52" rx="14" fill="${c}"/><circle cx="32" cy="32" r="12" fill="#fff" opacity=".85"/></svg>`);
const items = []; let k = 0;
for (const [g, l] of Object.entries(nombres)) for (const n of l) items.push({ id: 'i' + k, name: n, group: g, path: 'C:/x/' + n, icon: icono(colores[k++ % colores.length]) });
const stub = `<script>window.__errores=[];addEventListener('error',e=>__errores.push(e.message+' @'+(e.filename||'').split('/').pop()+':'+e.lineno));
window.__cfg=${JSON.stringify(cfg)};window.__oy={};
window.umbra={plataforma:'win32',desktopInfo:async()=>({wallpaper:'../UmbraOS/os/build/config/includes.chroot/usr/share/umbra/fondo-antuan.png',config:__cfg}),desktopItems:async()=>${JSON.stringify(items)},
ask:async()=>null,cmd(){},config:(p)=>Object.assign(__cfg,p),on:(c,f)=>{(__oy[c]=__oy[c]||[]).push(f)},openUri(){},desktopOpen(){},desktopReveal(){},desktopTrash(){},desktopNewFolder(){},launcher(){},umbraSettings(){}};</script>`;
s = s.replace('<script src="../UmbraOS/shell/ui/icons.js"></script>', stub + '<script src="../UmbraOS/shell/ui/icons.js"></script>');
fs.writeFileSync(path.join(__dirname, 'escritorio.html'), s);
console.log('ok', items.length);
