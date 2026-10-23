// Detector de juegos instalados: Steam, Epic, Riot, GOG, EA, Ubisoft, Battle.net, Xbox, Roblox, Minecraft y accesos directos.
// Uso: require('./juegos').detectar() -> Promise<Juego[]>. Solo modulos nativos de Node.
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');

const LOCALAPPDATA = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
const PROGRAMDATA = process.env.ProgramData || 'C:\\ProgramData';

// ---------- utilidades ----------
const leer = (p) => fsp.readFile(p, 'utf8').then((t) => t.replace(/^\uFEFF/, '')).catch(() => null);
const existe = (p) => fsp.access(p).then(() => true, () => false);
const dir = (p) => fsp.readdir(p, { withFileTypes: true }).catch(() => []);
const gb = (bytes) => (bytes > 0 ? Math.round((bytes / 1073741824) * 100) / 100 : null);
const norm = (s) => String(s || '').toLowerCase().replace(/[™®©]/g, '').replace(/[^a-z0-9]+/g, '');
const base = (p) => (p ? path.basename(p).toLowerCase() : null);
const seguro = (fn) => Promise.resolve().then(fn).catch(() => []);

function ejecutar(cmd, args, timeout = 2800) {
  return new Promise((res) => {
    execFile(cmd, args, { windowsHide: true, timeout, maxBuffer: 32 * 1024 * 1024, encoding: 'utf8' },
      (err, out) => res(err && !out ? '' : out || ''));
  });
}

function juego(o) {
  return {
    id: o.id, nombre: o.nombre, plataforma: o.plataforma || 'Otro',
    exe: o.exe || null, procesos: [...new Set((o.procesos || []).filter(Boolean).map((p) => p.toLowerCase()))],
    carpeta: o.carpeta || null, lanzar: o.lanzar, portada: o.portada || null,
    icono: o.icono || o.exe || null, tamanoGB: o.tamanoGB == null ? null : o.tamanoGB,
  };
}

// Parser VDF/KeyValues simple (formato texto de Valve).
function parseVDF(txt) {
  const tok = []; const re = /"((?:\\.|[^"\\])*)"|([{}])|\/\/[^\n]*/g; let m;
  while ((m = re.exec(txt))) {
    if (m[1] !== undefined) tok.push({ s: m[1].replace(/\\(.)/g, (_, c) => (c === 'n' ? '\n' : c === 't' ? '\t' : c)) });
    else if (m[2]) tok.push(m[2]);
  }
  let i = 0;
  const obj = () => {
    const o = {};
    while (i < tok.length) {
      const t = tok[i++];
      if (t === '}') break;
      if (typeof t !== 'object') continue;
      const v = tok[i++];
      if (v === '{') o[t.s.toLowerCase()] = obj();
      else if (v && typeof v === 'object') o[t.s.toLowerCase()] = v.s;
    }
    return o;
  };
  return obj();
}

// Exes "basura" que no son el juego.
const EXE_RUIDO = /unins|crash|redist|setup|install|vc_?redist|dxsetup|dotnet|prereq|easyanticheat|battleye|^be(service|launcher)|report|helper|updater|cef|uploader/i;

async function exesDe(carpeta) {
  const ents = (await dir(carpeta)).filter((e) => e.isFile() && /\.exe$/i.test(e.name) && !EXE_RUIDO.test(e.name));
  const conTam = await Promise.all(ents.map(async (e) => {
    const p = path.join(carpeta, e.name);
    const st = await fsp.stat(p).catch(() => null);
    return { p, t: st ? st.size : 0 };
  }));
  return conTam.sort((a, b) => b.t - a.t).map((x) => x.p);
}

// ---------- PowerShell en lote: accesos directos, Appx, registro ----------
const PS_SCRIPT = `
$ErrorActionPreference='SilentlyContinue'
[Console]::OutputEncoding=[Text.Encoding]::UTF8
$r=@{}
$sh=New-Object -ComObject WScript.Shell
$dirs=@([Environment]::GetFolderPath('Desktop'),[Environment]::GetFolderPath('CommonDesktopDirectory'),[Environment]::GetFolderPath('Programs'),[Environment]::GetFolderPath('CommonPrograms')) | Where-Object { $_ }
$r.lnk=@($(foreach($d in $dirs){ try { [IO.Directory]::GetFiles($d,'*.lnk','AllDirectories') } catch { (Get-ChildItem -LiteralPath $d -Recurse -Filter *.lnk).FullName } }) | ForEach-Object {
  $l=$sh.CreateShortcut($_); [pscustomobject]@{p=$_;t=$l.TargetPath;i=$l.IconLocation} })
$keys='HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*','HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*','HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'
$r.unins=@(Get-ItemProperty $keys | Where-Object { $_.Publisher -match 'Electronic Arts|Ubisoft|Blizzard' -and $_.DisplayName } | ForEach-Object { [pscustomobject]@{k=$_.PSChildName;n=$_.DisplayName;p=$_.Publisher;l=$_.InstallLocation;i=$_.DisplayIcon;s=$_.EstimatedSize} })
$r.gog=@(Get-ItemProperty 'HKLM:\\SOFTWARE\\WOW6432Node\\GOG.com\\Games\\*' | ForEach-Object { [pscustomobject]@{id=$_.gameID;n=$_.gameName;e=$_.exe;l=$_.path} })
$r.ubi=@(Get-ItemProperty 'HKLM:\\SOFTWARE\\WOW6432Node\\Ubisoft\\Launcher\\Installs\\*' | ForEach-Object { [pscustomobject]@{id=$_.PSChildName;l=$_.InstallDir} })
$r | ConvertTo-Json -Depth 4 -Compress
`;

async function powershell() {
  const enc = Buffer.from(PS_SCRIPT, 'utf16le').toString('base64');
  const out = await ejecutar('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', enc], 2900);
  const arr = (x) => (x == null ? [] : Array.isArray(x) ? x : [x]);
  try {
    const j = JSON.parse(out.trim().replace(/^\uFEFF/, ''));
    return { lnk: arr(j.lnk), unins: arr(j.unins), gog: arr(j.gog), ubi: arr(j.ubi) };
  } catch { return { lnk: [], unins: [], gog: [], ubi: [] }; }
}

// Paquetes Appx del usuario leidos del registro (mucho mas rapido que Get-AppxPackage).
// PackageFullName = Nombre_Version_Arq_Recurso_PublisherId -> FamilyName = Nombre_PublisherId
async function paquetesAppx() {
  const out = await ejecutar('reg', ['query', 'HKCU\\Software\\Classes\\Local Settings\\Software\\Microsoft\\Windows\\CurrentVersion\\AppModel\\Repository\\Packages', '/s', '/v', 'PackageRootFolder'], 2500);
  const res = []; let full = null;
  for (const linea of out.split(/\r?\n/)) {
    const k = linea.match(/\\Packages\\([^\\]+)$/);
    if (k) { full = k[1].trim(); continue; }
    const v = linea.match(/PackageRootFolder\s+REG_\w+\s+(.+)/);
    if (v && full) {
      const p = full.split('_');
      if (p.length >= 5) res.push({ n: p[0], f: `${p[0]}_${p[p.length - 1]}`, l: v[1].trim() });
    }
  }
  return res;
}

// ---------- 1. Steam ----------
const STEAM_EXCLUIR = /Redistributable|Proton|Dedicated Server|SDK|Steam Linux Runtime|SteamVR|Steamworks/i;

const LINUX = process.platform === 'linux';
async function steam() {
  let raiz;
  if (LINUX) {
    // Antuan OS: Steam nativo o Flatpak
    const h = require('os').homedir();
    raiz = [path.join(h, '.local/share/Steam'), path.join(h, '.steam/steam'), path.join(h, '.var/app/com.valvesoftware.Steam/.local/share/Steam')]
      .find((p) => require('fs').existsSync(path.join(p, 'steamapps'))) || path.join(h, '.local/share/Steam');
  } else {
    const q = await ejecutar('reg', ['query', 'HKCU\\Software\\Valve\\Steam', '/v', 'SteamPath'], 1500);
    const m = q.match(/SteamPath\s+REG_\w+\s+(.+)/);
    raiz = m ? path.normalize(m[1].trim()) : 'C:\\Program Files (x86)\\Steam';
  }
  const libs = new Set([raiz.toLowerCase()]);
  const libsReal = [raiz];
  const vdf = await leer(path.join(raiz, 'steamapps', 'libraryfolders.vdf'));
  if (vdf) {
    const lf = parseVDF(vdf).libraryfolders || {};
    for (const v of Object.values(lf)) {
      const p = typeof v === 'string' ? v : v && v.path;
      if (p && !libs.has(path.normalize(p).toLowerCase())) { libs.add(path.normalize(p).toLowerCase()); libsReal.push(path.normalize(p)); }
    }
  }
  const res = [];
  await Promise.all(libsReal.map(async (lib) => {
    const sa = path.join(lib, 'steamapps');
    const acfs = (await dir(sa)).filter((e) => /^appmanifest_\d+\.acf$/i.test(e.name));
    await Promise.all(acfs.map(async (e) => {
      const st = (parseVDF((await leer(path.join(sa, e.name))) || '').appstate) || {};
      const appid = st.appid; const nombre = st.name;
      if (!appid || !nombre || appid === '228980' || STEAM_EXCLUIR.test(nombre)) return;
      const carpeta = st.installdir ? path.join(sa, 'common', st.installdir) : null;
      const exes = carpeta ? await exesDe(carpeta) : [];
      res.push(juego({
        id: `steam:${appid}`, nombre, plataforma: 'Steam', exe: exes[0] || null,
        procesos: exes.map(base), carpeta,
        lanzar: { tipo: 'uri', valor: `steam://rungameid/${appid}` },
        portada: `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`,
        tamanoGB: gb(Number(st.sizeondisk)),
      }));
    }));
  }));
  return res;
}

// ---------- 2. Epic ----------
async function epic() {
  const d = path.join(PROGRAMDATA, 'Epic', 'EpicGamesLauncher', 'Data', 'Manifests');
  const items = (await dir(d)).filter((e) => /\.item$/i.test(e.name));
  const res = [];
  await Promise.all(items.map(async (e) => {
    let j; try { j = JSON.parse(await leer(path.join(d, e.name))); } catch { return; }
    if (!j || j.bIsIncompleteInstall || !j.DisplayName || !j.AppName) return;
    if ((j.AppCategories || []).some((c) => /plugins|engine/i.test(c)) && !(j.AppCategories || []).includes('games')) return;
    const exe = j.InstallLocation && j.LaunchExecutable ? path.join(j.InstallLocation, j.LaunchExecutable) : null;
    const procs = [base(exe)];
    if (/fortnite/i.test(j.DisplayName)) procs.push('fortniteclient-win64-shipping.exe', 'fortnitelauncher.exe');
    res.push(juego({
      id: `epic:${j.AppName}`, nombre: j.DisplayName, plataforma: 'Epic', exe, procesos: procs,
      carpeta: j.InstallLocation || null,
      lanzar: { tipo: 'uri', valor: `com.epicgames.launcher://apps/${encodeURIComponent(j.CatalogNamespace ? `${j.CatalogNamespace}:${j.CatalogItemId}:${j.AppName}` : j.AppName)}?action=launch&silent=true` },
      tamanoGB: gb(Number(j.InstallSize)),
    }));
  }));
  return res;
}

// ---------- 3. Riot ----------
const RIOT = {
  valorant: { nombre: 'VALORANT', exe: ['live', 'ShooterGame', 'Binaries', 'Win64', 'VALORANT-Win64-Shipping.exe'], procs: ['valorant-win64-shipping.exe', 'valorant.exe'] },
  league_of_legends: { nombre: 'League of Legends', exe: ['Game', 'League of Legends.exe'], procs: ['league of legends.exe', 'leagueclient.exe'] },
  bacon: { nombre: 'Legends of Runeterra', exe: null, procs: ['lor.exe'] },
};

async function riot() {
  const rd = path.join(PROGRAMDATA, 'Riot Games');
  let cliente = null;
  try {
    const j = JSON.parse(await leer(path.join(rd, 'RiotClientInstalls.json')));
    cliente = j.rc_default || j.rc_live || null;
    if (cliente) cliente = path.normalize(cliente);
  } catch { /* sin cliente */ }
  if (!cliente && await existe('C:\\Riot Games\\Riot Client\\RiotClientServices.exe')) cliente = 'C:\\Riot Games\\Riot Client\\RiotClientServices.exe';
  const res = [];
  const meta = path.join(rd, 'Metadata');
  for (const e of await dir(meta)) {
    if (!e.isDirectory()) continue;
    const [prod, linea] = e.name.split('.');
    if (!prod || prod === 'riot_client' || (linea && linea !== 'live')) continue;
    const yaml = (await dir(path.join(meta, e.name))).find((f) => /product_settings\.yaml$/i.test(f.name));
    if (!yaml) continue;
    const txt = (await leer(path.join(meta, e.name, yaml.name))) || '';
    const m = txt.match(/product_install_full_path:\s*"?([^"\r\n]+)"?/);
    const carpeta = m ? path.normalize(m[1].trim()) : null;
    if (carpeta && !(await existe(carpeta))) continue;
    const info = RIOT[prod] || { nombre: prod.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()), exe: null, procs: [] };
    const exe = carpeta && info.exe ? path.join(carpeta, ...info.exe) : null;
    res.push(juego({
      id: `riot:${prod}`, nombre: info.nombre, plataforma: 'Riot', exe, procesos: info.procs, carpeta,
      lanzar: cliente
        ? { tipo: 'exe', valor: `"${cliente}" --launch-product=${prod} --launch-patchline=live` }
        : { tipo: 'exe', valor: exe || '' },
      icono: cliente || exe,
    }));
  }
  return res.filter((j) => j.lanzar.valor);
}

// ---------- 4. GOG ----------
function gog(ps) {
  return ps.gog.filter((g) => g.n && (g.e || g.l)).map((g) => juego({
    id: `gog:${g.id || norm(g.n)}`, nombre: g.n, plataforma: 'GOG', exe: g.e || null,
    procesos: [base(g.e)], carpeta: g.l || null,
    lanzar: g.e ? { tipo: 'exe', valor: g.e } : { tipo: 'uri', valor: `goggalaxy://openGameView/${g.id}` },
  }));
}

// ---------- 5. EA / Ubisoft / Battle.net (registro) ----------
const LANZADORES = /^(EA app|EA|Origin|Ubisoft Connect|Uplay|Battle\.net|Blizzard Battle\.net)$|Desktop App|Overlay|Redistributable|Anti-?Cheat/i;

async function editores(ps) {
  const res = [];
  for (const u of ps.unins) {
    if (LANZADORES.test(u.n)) continue;
    const plat = /Electronic Arts/i.test(u.p) ? 'EA' : /Ubisoft/i.test(u.p) ? 'Ubisoft' : 'Battle.net';
    let exe = u.i ? String(u.i).split(',')[0].replace(/"/g, '').trim() : null;
    if (exe && (!/\.exe$/i.test(exe) || EXE_RUIDO.test(path.basename(exe)))) exe = null;
    const carpeta = u.l ? path.normalize(String(u.l).replace(/"/g, '')) : (exe ? path.dirname(exe) : null);
    if (!exe && carpeta) exe = (await exesDe(carpeta))[0] || null;
    if (!exe) continue;
    res.push(juego({
      id: `${plat.toLowerCase()}:${u.k}`, nombre: u.n, plataforma: plat, exe, procesos: [base(exe)], carpeta,
      lanzar: { tipo: 'exe', valor: exe }, tamanoGB: u.s ? Math.round((Number(u.s) / 1048576) * 100) / 100 : null,
    }));
  }
  for (const u of ps.ubi) {
    if (!u.l || !(await existe(u.l))) continue;
    const carpeta = path.normalize(u.l);
    const exe = (await exesDe(carpeta))[0] || null;
    res.push(juego({
      id: `ubisoft:${u.id}`, nombre: path.basename(carpeta), plataforma: 'Ubisoft', exe, procesos: [base(exe)], carpeta,
      lanzar: { tipo: 'uri', valor: `uplay://launch/${u.id}/0` },
    }));
  }
  return res;
}

// ---------- 6. Xbox / Microsoft Store ----------
async function xbox(paquetes) {
  const appx = new Map(paquetes.map((a) => [String(a.n).toLowerCase(), a]));
  const carpetas = new Map(); // ruta Content -> paquete o null
  // XboxGames en cualquier unidad
  const letras = 'CDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  await Promise.all(letras.map(async (l) => {
    const xg = `${l}:\\XboxGames`;
    for (const e of await dir(xg)) {
      if (e.isDirectory()) carpetas.set(path.join(xg, e.name, 'Content').toLowerCase(), { c: path.join(xg, e.name, 'Content'), a: null });
    }
  }));
  // Paquetes Appx con MicrosoftGame.config
  await Promise.all(paquetes.map(async (a) => {
    if (!a.l || /^[a-z]:\\windows\\/i.test(a.l)) return;
    const k = String(a.l).toLowerCase();
    if (carpetas.has(k)) { carpetas.get(k).a = a; return; }
    if (await existe(path.join(a.l, 'MicrosoftGame.config'))) carpetas.set(k, { c: a.l, a });
  }));
  const res = [];
  await Promise.all([...carpetas.values()].map(async ({ c, a }) => {
    const cfg = await leer(path.join(c, 'MicrosoftGame.config'));
    if (!cfg) return;
    const ident = (cfg.match(/<Identity[^>]*\bName="([^"]+)"/i) || [])[1];
    const nombre = (cfg.match(/DefaultDisplayName="([^"]+)"/i) || [])[1] || ident || path.basename(path.dirname(c));
    const exes = [...cfg.matchAll(/<Executable[^>]*\bName="([^"]+)"/gi)].map((m) => m[1]);
    if (!a && ident) a = appx.get(ident.toLowerCase()) || null;
    const man = await leer(path.join(c, 'AppxManifest.xml'));
    const appId = man ? (man.match(/<Application[^>]*\bId="([^"]+)"/i) || [])[1] : null;
    const exe = exes[0] ? path.join(c, exes[0]) : null;
    const lanzar = a && appId ? { tipo: 'uri', valor: `shell:AppsFolder\\${a.f}!${appId}` } : exe ? { tipo: 'exe', valor: exe } : null;
    if (!lanzar) return;
    res.push(juego({
      id: `xbox:${ident || norm(nombre)}`, nombre, plataforma: /minecraft/i.test(nombre) ? 'Minecraft' : 'Xbox',
      exe, procesos: exes.map((x) => path.basename(x)).concat(/minecraft/i.test(nombre) ? ['minecraftlauncher.exe', 'javaw.exe'] : []),
      carpeta: c, lanzar,
    }));
  }));
  // Mismo juego en XboxGames y en WindowsApps: se prefiere XboxGames (carpeta accesible)
  const porId = new Map();
  for (const j of res) {
    const p = porId.get(j.id);
    const uri = j.lanzar.tipo === 'uri';
    if (!p || (uri && (p.lanzar.tipo !== 'uri' || /\\xboxgames\\/i.test(j.carpeta)))) porId.set(j.id, j);
  }
  return [...porId.values()];
}

// ---------- 7. Roblox ----------
async function roblox() {
  const vd = path.join(LOCALAPPDATA, 'Roblox', 'Versions');
  const vers = (await dir(vd)).filter((e) => e.isDirectory());
  const encontrados = { player: null, studio: null };
  await Promise.all(vers.map(async (e) => {
    const c = path.join(vd, e.name);
    for (const [k, exe] of [['player', 'RobloxPlayerBeta.exe'], ['studio', 'RobloxStudioBeta.exe']]) {
      const p = path.join(c, exe);
      const st = await fsp.stat(p).catch(() => null);
      if (st && (!encontrados[k] || st.mtimeMs > encontrados[k].t)) encontrados[k] = { p, t: st.mtimeMs };
    }
  }));
  const res = [];
  if (encontrados.player) {
    const exe = encontrados.player.p;
    res.push(juego({ id: 'roblox:player', nombre: 'Roblox Player', plataforma: 'Roblox', exe, procesos: ['robloxplayerbeta.exe'], carpeta: path.dirname(exe), lanzar: { tipo: 'exe', valor: exe } }));
  }
  if (encontrados.studio) {
    const exe = encontrados.studio.p;
    res.push(juego({ id: 'roblox:studio', nombre: 'Roblox Studio', plataforma: 'Roblox', exe, procesos: ['robloxstudiobeta.exe'], carpeta: path.dirname(exe), lanzar: { tipo: 'exe', valor: exe } }));
  }
  return res;
}

// ---------- 8. Accesos directos ----------
const LNK_SI = /minecraft|roblox|launcher|game|juego|fortnite|valorant|league|steam|epic|riot|antuan/i;
const LNK_NO = /uninstall|desinstal|unins\d*\.exe|readme|manual|help|ayuda|support|soporte|website|sitio web|release notes|server|editor|crash|report|benchmark|dropbox|redeem|driver|installer|setup|bar\b|xbox game bar/i;

function plataformaDe(txt) {
  if (/roblox/i.test(txt)) return 'Roblox';
  if (/minecraft/i.test(txt)) return 'Minecraft';
  if (/\\steam(apps)?\\|steam\.exe/i.test(txt)) return 'Steam';
  if (/epic games/i.test(txt)) return 'Epic';
  if (/riot/i.test(txt)) return 'Riot';
  if (/electronic arts|ea desktop|\\origin/i.test(txt)) return 'EA';
  if (/ubisoft|uplay/i.test(txt)) return 'Ubisoft';
  if (/battle\.net|blizzard/i.test(txt)) return 'Battle.net';
  if (/gog galaxy|\\gog/i.test(txt)) return 'GOG';
  if (/xboxgames|windowsapps/i.test(txt)) return 'Xbox';
  return 'Otro';
}

function accesos(ps) {
  return ps.lnk.filter((l) => {
    const nom = path.basename(l.p, '.lnk');
    const t = l.t || '';
    if (LNK_NO.test(nom) || LNK_NO.test(path.basename(t))) return false;
    if (t && !/\.exe$/i.test(t)) return false; // documentos, carpetas, urls...
    return LNK_SI.test(nom) || LNK_SI.test(t);
  }).map((l) => {
    const nom = path.basename(l.p, '.lnk');
    const exe = l.t || null;
    const ico = l.i && !/^,?\d*$/.test(l.i) ? l.i.replace(/,-?\d+$/, '') : null;
    return juego({
      id: `lnk:${l.p}`, nombre: nom, plataforma: plataformaDe(`${nom} ${exe || ''} ${l.i || ''}`), exe,
      procesos: [base(exe)], carpeta: exe ? path.dirname(exe) : null,
      lanzar: { tipo: 'lnk', valor: l.p }, icono: exe || ico || l.p,
    });
  });
}

// ---------- Antuan OS: Heroic (Epic y GOG) ----------
async function heroic() {
  const h = require('os').homedir(), res = [];
  const bases = [path.join(h, '.config/heroic'), path.join(h, '.var/app/com.heroicgameslauncher.hgl/config/heroic')];
  for (const b of bases) {
    const epicJson = await leer(path.join(b, 'legendaryConfig/legendary/installed.json'));
    if (epicJson) { try { for (const [app, g] of Object.entries(JSON.parse(epicJson))) res.push(juego({ id: `epic:${app}`, nombre: g.title, plataforma: 'Epic', carpeta: g.install_path, exe: g.executable ? path.join(g.install_path, g.executable) : null, procesos: g.executable ? [base(g.executable)] : [], lanzar: { tipo: 'uri', valor: `heroic://launch/legendary/${app}` } })); } catch { } }
    const gogJson = await leer(path.join(b, 'gog_store/installed.json'));
    if (gogJson) { try { for (const g of JSON.parse(gogJson).installed || []) res.push(juego({ id: `gog:${g.appName}`, nombre: path.basename(g.install_path), plataforma: 'GOG', carpeta: g.install_path, lanzar: { tipo: 'uri', valor: `heroic://launch/gog/${g.appName}` } })); } catch { } }
  }
  return res;
}

// ---------- combinacion ----------
async function detectar() {
  if (LINUX) {
    const listas = await Promise.all([seguro(steam), seguro(heroic)]);
    const m = new Map();
    for (const j of listas.flat()) if (j && j.nombre && !m.has(norm(j.nombre))) m.set(norm(j.nombre), j);
    return [...m.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
  }
  const psP = powershell();
  const directos = await Promise.all([seguro(steam), seguro(epic), seguro(riot), seguro(roblox),
    seguro(paquetesAppx).then((p) => seguro(() => xbox(p)))]);
  const ps = await psP;
  const delPs = await Promise.all([seguro(() => gog(ps)), seguro(() => editores(ps))]);
  const lnks = await seguro(() => accesos(ps));

  const porNombre = new Map();
  const carpetas = [];
  const exes = new Set();
  const meter = (j) => {
    const k = norm(j.nombre);
    if (!k || !j.lanzar || !j.lanzar.valor) return;
    const prev = porNombre.get(k);
    if (prev) { for (const c of ['exe', 'carpeta', 'portada', 'icono', 'tamanoGB']) if (prev[c] == null && j[c] != null) prev[c] = j[c]; return; }
    porNombre.set(k, j);
    if (j.carpeta && j.plataforma !== 'Otro') carpetas.push(j.carpeta.toLowerCase() + '\\');
    if (j.exe) exes.add(j.exe.toLowerCase());
  };
  for (const lista of [...directos, ...delPs]) lista.forEach(meter);
  // Accesos: se descartan si apuntan dentro de un juego ya detectado (pero completan su icono/exe si coincide el nombre)
  for (const j of lnks) {
    const t = (j.exe || '').toLowerCase();
    const prev = porNombre.get(norm(j.nombre));
    if (prev) { if (!prev.exe && j.exe) prev.exe = j.exe; continue; }
    if (t && (exes.has(t) || carpetas.some((c) => t.startsWith(c)))) continue;
    meter(j);
  }
  return [...porNombre.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
}

module.exports = { detectar };
