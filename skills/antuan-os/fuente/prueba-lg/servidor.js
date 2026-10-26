// Servidor estatico minimo para probar el Liquid Glass en el navegador
const http = require('http'), fs = require('fs'), path = require('path');
const raiz = path.join(__dirname, '..');
const tipos = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg' };
http.createServer((q, r) => {
  const p = path.join(raiz, decodeURIComponent(q.url.split('?')[0]));
  if (!p.startsWith(raiz)) { r.writeHead(403); return r.end(); }
  fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': tipos[path.extname(p)] || 'application/octet-stream' }); r.end(d); });
}).listen(5173, () => console.log('http://localhost:5173/prueba-lg/'));
