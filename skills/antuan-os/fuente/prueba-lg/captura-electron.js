// Prueba sin tocar la pantalla del usuario: abre una pagina de la prueba en una ventana oculta de Electron,
// ejecuta pasos (JS) y guarda una captura tras cada uno.
// Uso: electron captura-electron.js <url> <salida-prefijo> <pasos.json>
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const [url, prefijo, pasosArchivo] = process.argv.slice(2);
const pasos = pasosArchivo ? JSON.parse(fs.readFileSync(pasosArchivo, 'utf8')) : [{ js: '1' }];
app.whenReady().then(async () => {
  const w = new BrowserWindow({ width: 1280, height: 900, show: false, webPreferences: { offscreen: false, backgroundThrottling: false } });
  await w.loadURL(url);
  await new Promise((r) => setTimeout(r, 1500));
  let n = 0;
  for (const p of pasos) {
    let res = null;
    try { res = await w.webContents.executeJavaScript(p.js, true); } catch (e) { res = 'ERROR ' + e.message; }
    await new Promise((r) => setTimeout(r, p.espera || 700));
    const img = await w.webContents.capturePage(p.zona || undefined);
    const f = `${prefijo}-${++n}.png`;
    fs.writeFileSync(f, img.toPNG());
    console.log(f, JSON.stringify(res));
  }
  app.quit();
});
