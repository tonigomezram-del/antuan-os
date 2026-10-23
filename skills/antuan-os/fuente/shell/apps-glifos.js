// Apps conocidas: se dibujan con el icono propio de Antuan (glifo + color). Igual en Windows y en Antuan OS.
const path = require('path');

const GLYPHS = [
  [/^explorer\.exe$|explorador|^umbra-archivos|^archivos$/i, 'folder', 220, 'Archivos'],
  [/chrome|google chrome|chromium/i, 'globe', 196],
  [/msedge|microsoft edge/i, 'globe', 186],
  [/firefox|brave|opera/i, 'globe', 20],
  [/^code(\.exe)?$|visual studio code/i, 'code', 210],
  [/antigravity/i, 'code', 256],
  [/cursor/i, 'code', 280],
  [/windowsterminal|^wt\.exe|powershell|^cmd\.exe|s[ií]mbolo del sistema|terminal|konsole|xterm/i, 'terminal', 240],
  [/spotify/i, 'music', 140],
  [/notepad|bloc de notas|gedit|text editor|editor de texto/i, 'note', 38],
  [/claude/i, 'spark', 18],
  [/gemini/i, 'spark', 262],
  [/chatgpt/i, 'spark', 160],
  [/discord|vesktop/i, 'chat', 235],
  [/whatsapp|telegram/i, 'chat', 150],
  [/vlc/i, 'play', 26],
  [/minecraft|prism/i, 'cube', 110],
  [/roblox studio|robloxstudio/i, 'cube', 205],
  [/roblox|sober/i, 'cube', 0],
  [/steam/i, 'game', 215],
  [/epic games|heroic|lutris/i, 'game', 230],
  [/configuraci[oó]n|^settings$|systemsettings|ajustes/i, 'gear', 230, 'Ajustes'],
  [/calculadora|calculator/i, 'calc', 160],
  [/fotos|photos|visor de im/i, 'image', 330],
  [/correo|outlook|mail|thunderbird/i, 'mail', 205],
  [/calendario|calendar/i, 'calendar', 0],
  [/microsoft store|umbra tienda|antuan tienda|^tienda$/i, 'bag', 200, null],
  [/paint|gimp|krita/i, 'palette', 300],
  [/obs/i, 'record', 0],
  [/word|writer/i, 'note', 215],
  [/excel|calc$/i, 'grid', 140],
  [/powerpoint|impress/i, 'image', 15],
  [/aippt/i, 'image', 285]
];

function glyphFor(name, exe) {
  const base = exe ? path.basename(exe) : '';
  for (const [re, glyph, hue, rename] of GLYPHS) {
    if (re.test(base) || re.test(name)) return { glyph, hue, rename };
  }
  return null;
}

module.exports = { GLYPHS, glyphFor };
