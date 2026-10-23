const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('umbra', {
  // 'linux' en Antuan OS: la interfaz oculta o traduce lo que solo existe en Windows
  plataforma: process.platform,
  init: () => ipcRenderer.invoke('init'),
  hit: (inside) => ipcRenderer.send('hit', inside),
  zonas: (rects) => ipcRenderer.send('zonas', rects),
  panel: (open, restore) => ipcRenderer.send('panel', open, restore),
  config: (patch) => ipcRenderer.send('config', patch),
  launch: (id) => ipcRenderer.send('launch', id),
  window: (id, action) => ipcRenderer.send('window', id, action),
  openUri: (uri) => ipcRenderer.send('open-uri', uri),
  keys: (vks) => ipcRenderer.send('keys', vks),
  volume: () => ipcRenderer.invoke('volume'),
  setVolume: (v) => ipcRenderer.send('set-volume', v),
  mute: (m) => ipcRenderer.send('mute', m),
  brightness: () => ipcRenderer.invoke('brightness'),
  setBrightness: (v) => ipcRenderer.send('set-brightness', v),
  loginItem: () => ipcRenderer.invoke('login-item'),
  power: (what) => ipcRenderer.send('power', what),
  quit: () => ipcRenderer.send('quit'),
  desktopItems: () => ipcRenderer.invoke('desktop-items'),
  desktopInfo: () => ipcRenderer.invoke('desktop-info'),
  desktopOpen: (p) => ipcRenderer.send('desktop-open', p),
  desktopReveal: (p) => ipcRenderer.send('desktop-reveal', p),
  desktopTrash: (p) => ipcRenderer.invoke('desktop-trash', p),
  desktopNewFolder: () => ipcRenderer.invoke('desktop-new-folder'),
  umbraSettings: () => ipcRenderer.send('desktop-umbra-settings'),
  launcher: () => ipcRenderer.send('desktop-launcher'),
  // Terminal Antuan
  term: {
    disponible: () => ipcRenderer.invoke('term.disponible'),
    crear: (o) => ipcRenderer.invoke('term.crear', o),
    escribir: (id, d) => ipcRenderer.send('term.escribir', id, d),
    tamano: (id, c, r) => ipcRenderer.send('term.tamano', id, c, r),
    cerrar: (id) => ipcRenderer.send('term.cerrar', id)
  },
  // Canal generico: ordenes (sin respuesta) y consultas (con respuesta) registradas en main.js
  cmd: (name, ...a) => ipcRenderer.send('cmd', name, ...a),
  ask: (name, ...a) => ipcRenderer.invoke('ask', name, ...a),
  on: (ch, fn) => ipcRenderer.on(ch, (_, ...a) => fn(...a))
});
