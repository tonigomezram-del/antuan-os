// Copia del Centro de Antuan con window.umbra simulado (config real), para probarlo sin tocar la pantalla
const fs = require('fs'), path = require('path');
const ui = path.join(__dirname, '..', 'UmbraOS', 'shell', 'ui');
let s = fs.readFileSync(path.join(ui, 'centro.html'), 'utf8');
s = s.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, '');
s = s.replace(/(src|href)="([^":]+\.(js|css))"/g, '$1="../UmbraOS/shell/ui/$2"');
const cfg = JSON.parse(fs.readFileSync(path.join(process.env.APPDATA, 'Antuan', 'config.json'), 'utf8'));
const stub = `<script>window.__errores=[];addEventListener('error',e=>__errores.push(e.message+' @'+(e.filename||'').split('/').pop()+':'+e.lineno));
window.__cfg=${JSON.stringify(cfg)};window.__oy={};
window.umbra=new Proxy({plataforma:'win32',ask:async(k)=>k==='config'?__cfg:null,on:(c,f)=>{(__oy[c]=__oy[c]||[]).push(f)},config:(p)=>Object.assign(__cfg,p)},{get:(t,k)=>k in t?t[k]:(()=>Promise.resolve(null))});</script>`;
s = s.replace('<script src="../UmbraOS/shell/ui/icons.js"></script>', stub + '<script src="../UmbraOS/shell/ui/icons.js"></script>');
s = s.replace('</body>', '<script>setTimeout(()=>{const b=[...document.querySelectorAll("nav button, .nav-b")].find(x=>/Personalizaci/.test(x.textContent));if(b)b.click();},700)</script></body>');
fs.writeFileSync(path.join(__dirname, 'centro.html'), s);
console.log('ok');
