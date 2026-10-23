// Antuan Shell - Centro de Control: gestión del PC (rendimiento, inicio, almacenamiento,
// Windows Update y red). Módulo CommonJS sin dependencias externas.
// Ninguna función lanza: ante fallos devuelven null/[] y un campo `error`.
'use strict';

const { execFile, spawn } = require('child_process');
const os = require('os');
const path = require('path');

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

// Ejecuta un script de PowerShell y devuelve { datos, error }. Se pasa codificado
// (-EncodedCommand) para evitar problemas de comillas; la salida es JSON en UTF-8.
function ps(script, timeout = 15000) {
  const pre = "$ProgressPreference='SilentlyContinue';[Console]::OutputEncoding=[Text.Encoding]::UTF8;";
  const b64 = Buffer.from(pre + script, 'utf16le').toString('base64');
  return new Promise((resolve) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', b64],
      { windowsHide: true, timeout, maxBuffer: 64 * 1024 * 1024, encoding: 'utf8' },
      (err, stdout) => {
        const txt = (stdout || '').trim();
        if (txt) {
          try { return resolve({ datos: JSON.parse(txt) }); } catch (e) { /* sigue abajo */ }
        }
        if (err) return resolve({ error: err.killed ? 'tiempo agotado' : (err.message || String(err)).split('\n')[0] });
        resolve({ error: 'salida no válida' });
      });
  });
}

// Literal de cadena seguro para PowerShell ('...' con comillas duplicadas).
const psStr = (s) => "'" + String(s).replace(/'/g, "''") + "'";
// PowerShell 5.1 convierte arrays de 1 elemento en objeto: normalizamos.
const arr = (x) => (x == null ? [] : Array.isArray(x) ? x : [x]);
const r1 = (n) => Math.round(n * 10) / 10;
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// Ejecuta un programa de consola y devuelve su salida en latin1 (páginas OEM: los
// acentos pueden salir mal, por eso los regex de análisis toleran cualquier carácter).
function ejecutar(cmd, args, timeout = 15000, opciones = {}) {
  return new Promise((resolve) => {
    execFile(cmd, args, { windowsHide: true, timeout, encoding: 'latin1', maxBuffer: 16 * 1024 * 1024, ...opciones },
      (err, stdout, stderr) => resolve({ err, salida: (stdout || '') + (stderr || '') }));
  });
}

// Función PowerShell común: recorre un árbol sin seguir enlaces/uniones y suma bytes.
// $limite = Stopwatch-ms máximo (corta y devuelve lo medido).
const PS_MEDIR = `
$global:reloj=[Diagnostics.Stopwatch]::StartNew()
function Medir([string]$raiz,[int]$limite){
  $tot=[long]0; if(-not $raiz -or -not [IO.Directory]::Exists($raiz)){return $tot}
  $pila=New-Object System.Collections.Stack; $pila.Push((New-Object IO.DirectoryInfo $raiz))
  while($pila.Count -gt 0){
    if($global:reloj.ElapsedMilliseconds -gt $limite){break}
    $d=$pila.Pop()
    try{ foreach($e in $d.EnumerateFileSystemInfos()){
      if($e.Attributes -band 16){ if(-not ($e.Attributes -band 1024)){$pila.Push($e)} } else { $tot+=$e.Length } } }catch{}
  }
  return $tot
}`;

// ---------------------------------------------------------------------------
// 1. Rendimiento
// ---------------------------------------------------------------------------

let cpuPrevia = null; // { t, muestra } de la llamada anterior (para %CPU sin esperar)

function muestraCpu() {
  let ocupado = 0, total = 0;
  for (const c of os.cpus()) {
    const t = c.times;
    const sum = t.user + t.nice + t.sys + t.idle + t.irq;
    total += sum; ocupado += sum - t.idle;
  }
  return { ocupado, total };
}
function pctCpu(a, b) {
  const dt = b.total - a.total;
  return dt > 0 ? Math.max(0, Math.min(100, r1(((b.ocupado - a.ocupado) / dt) * 100))) : null;
}

// Script único: dos muestras de procesos, GPU (3D), disco y CPU separadas ~500 ms,
// y temperatura entre ambas (MSAcpi requiere admin; se recurre al contador térmico).
let msacpiDenegado = false; // tras el primer 'acceso denegado' no se reintenta
const PS_RENDIMIENTO = (msacpi) => `
$sw=[Diagnostics.Stopwatch]::StartNew()
function Procs(){ $h=@{}; foreach($p in [Diagnostics.Process]::GetProcesses()){ $t=$null; try{$t=$p.TotalProcessorTime.TotalMilliseconds}catch{}; $h[$p.Id]=@($p.ProcessName,$t,$p.WorkingSet64) }; $h }
function LeerCat($n){ try{ return ,((New-Object Diagnostics.PerformanceCounterCategory $n).ReadCategory()) }catch{ return $null } }
$g1=LeerCat 'GPU Engine'; if($sw.ElapsedMilliseconds -gt 1500){$g1=$null}; $d1=LeerCat 'PhysicalDisk'; $c1=LeerCat 'Processor Information'
$p1=Procs; $t1=$sw.Elapsed.TotalMilliseconds
$temp=$null; $acpi=$false
${msacpi ? '' : '<#'}try{ $z=Get-CimInstance -Namespace root/wmi -ClassName MSAcpi_ThermalZoneTemperature -ErrorAction Stop | Select-Object -First 1; $temp=$z.CurrentTemperature/10-273.15 }catch{ $acpi=$true }${msacpi ? '' : '#>'}
if($temp -eq $null){ try{ $tz=LeerCat 'Thermal Zone Information'; if($tz){ $col=$tz['high precision temperature']; $m=0; foreach($k in $col.Keys){ $v=$col[$k].RawValue/10-273.15; if($v -gt $m){$m=$v} }; if($m -gt 0){$temp=$m} } }catch{} }
$falta=500-($sw.Elapsed.TotalMilliseconds-$t1); if($falta -gt 0){ Start-Sleep -Milliseconds ([int]$falta) }
$g2=$null; if($g1){$g2=LeerCat 'GPU Engine'}; $d2=LeerCat 'PhysicalDisk'; $c2=LeerCat 'Processor Information'
$p2=Procs; $t2=$sw.Elapsed.TotalMilliseconds
function CalcCont($a,$b,$cnt,$inst){ try{ [Diagnostics.CounterSample]::Calculate($a[$cnt][$inst].Sample,$b[$cnt][$inst].Sample) }catch{ $null } }
$gpu=$null
if($g1 -and $g2){ $mot=@{}; $u1=$g1['utilization percentage']; $u2=$g2['utilization percentage']
  foreach($k in $u2.Keys){ if($k -like '*engtype_3D' -and $u1.Contains($k)){ $e=($k -replace '^.*?_luid','luid'); $v=[Diagnostics.CounterSample]::Calculate($u1[$k].Sample,$u2[$k].Sample); if($mot.ContainsKey($e)){$mot[$e]+=$v}else{$mot[$e]=$v} } }
  $gpu=0; foreach($v in $mot.Values){ if($v -gt $gpu){$gpu=$v} }; if($gpu -gt 100){$gpu=100} }
$disco=$null; if($d1 -and $d2){ $i=CalcCont $d1 $d2 '% idle time' '_Total'; if($i -ne $null){ $disco=100-$i; if($disco -lt 0){$disco=0}; if($disco -gt 100){$disco=100} } }
$cpu=$null; if($c1 -and $c2){ $cpu=CalcCont $c1 $c2 '% processor utility' '_Total'; if($cpu -ne $null -and $cpu -gt 100){$cpu=100} }
$nuc=[Environment]::ProcessorCount; $ms=$t2-$t1; $lista=New-Object System.Collections.ArrayList
foreach($id in $p2.Keys){ if($id -eq 0){continue}; $b=$p2[$id]; $a=$p1[$id]; $c=0
  if($a -and $a[1] -ne $null -and $b[1] -ne $null -and $ms -gt 0){ $c=($b[1]-$a[1])/$ms/$nuc*100; if($c -lt 0){$c=0} }
  [void]$lista.Add(@{pid=$id;nombre=$b[0];cpu=[math]::Round($c,1);ramMB=[math]::Round($b[2]/1MB,1)}) }
@{gpu=$gpu;disco=$disco;cpu=$cpu;temp=$temp;acpiDenegado=$acpi;procesos=$lista;ms=[int]$ms} | ConvertTo-Json -Depth 4 -Compress`;

async function rendimiento() {
  const ahora = Date.now();
  const m0 = muestraCpu();
  const r = await ps(PS_RENDIMIENTO(!msacpiDenegado), 8000);
  if (r.datos && r.datos.acpiDenegado) msacpiDenegado = true;
  const m1 = muestraCpu();
  const totalB = os.totalmem(), libreB = os.freemem();
  const ram = { usadaGB: r1((totalB - libreB) / 2 ** 30), totalGB: r1(totalB / 2 ** 30), pct: r1(((totalB - libreB) / totalB) * 100) };

  // CPU total con os.cpus(): delta respecto a la llamada anterior si es reciente (0.4–15 s,
  // como hace el Administrador de tareas); si no, contador "% Processor Utility" medido en el
  // propio script; en último caso, delta durante la ejecución del script.
  let cpu = null;
  if (cpuPrevia && ahora - cpuPrevia.t >= 400 && ahora - cpuPrevia.t <= 15000) cpu = pctCpu(cpuPrevia.muestra, m0);
  if (cpu == null && r.datos && typeof r.datos.cpu === 'number') cpu = r1(r.datos.cpu);
  if (cpu == null) cpu = pctCpu(m0, m1);
  cpuPrevia = { t: Date.now(), muestra: m1 };

  const out = { cpu, ram, gpu: null, discoActividad: null, temperatura: null, procesos: [] };
  if (!r.datos) return { ...out, error: r.error };
  const d = r.datos;
  out.gpu = typeof d.gpu === 'number' ? r1(d.gpu) : null;
  out.discoActividad = typeof d.disco === 'number' ? r1(d.disco) : null;
  out.temperatura = typeof d.temp === 'number' && d.temp > 0 && d.temp < 150 ? r1(d.temp) : null;

  // Top 12 combinando CPU y RAM: puntuación = %CPU + %RAM del sistema.
  const totalMB = totalB / 2 ** 20;
  out.procesos = arr(d.procesos)
    .map((p) => ({ pid: p.pid, nombre: p.nombre, cpu: p.cpu, ramMB: p.ramMB }))
    .sort((a, b) => (b.cpu + (b.ramMB / totalMB) * 100) - (a.cpu + (a.ramMB / totalMB) * 100))
    .slice(0, 12);
  return out;
}

// ---------------------------------------------------------------------------
// 2. Cerrar proceso
// ---------------------------------------------------------------------------

function vivo(pid) {
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
}

async function cerrarProceso(pid) {
  pid = parseInt(pid, 10);
  if (!(pid > 4) || pid === process.pid) return { ok: false, error: 'PID no válido' };
  if (!vivo(pid)) return { ok: true, yaCerrado: true };
  await ejecutar('taskkill.exe', ['/PID', String(pid)], 5000); // cierre amable (WM_CLOSE)
  for (let i = 0; i < 10 && vivo(pid); i++) await espera(200);
  if (!vivo(pid)) return { ok: true, forzado: false };
  const r = await ejecutar('taskkill.exe', ['/F', '/PID', String(pid)], 5000);
  for (let i = 0; i < 10 && vivo(pid); i++) await espera(100);
  const ok = !vivo(pid);
  return ok ? { ok, forzado: true } : { ok, error: r.salida.trim().split(/\r?\n/)[0] || 'no se pudo cerrar' };
}

// ---------------------------------------------------------------------------
// 3-4. Aplicaciones de inicio
// ---------------------------------------------------------------------------

const SA = 'Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved';

const PS_INICIO = `
$sa='${SA}'
$res=New-Object System.Collections.ArrayList
function Aprob($hive,$sub,$n){ try{ $k=[Microsoft.Win32.Registry]::$hive.OpenSubKey("$sa\\$sub"); if($k){ $b=$k.GetValue($n); $k.Close(); if($b -is [byte[]] -and $b.Length -gt 0){ return [int]$b[0] } } }catch{}; return $null }
function Run($hive,$ruta,$ambito,$sub){ try{ $k=[Microsoft.Win32.Registry]::$hive.OpenSubKey($ruta); if(-not $k){return}
  foreach($n in $k.GetValueNames()){ if($n -eq ''){continue}; $v=[string]$k.GetValue($n)
    [void]$res.Add(@{ambito=$ambito;sub=$sub;nombre=$n;comando=$v;origen=$ambito;b=(Aprob $hive $sub $n)}) }; $k.Close() }catch{} }
Run 'CurrentUser' 'Software\\Microsoft\\Windows\\CurrentVersion\\Run' 'HKCU' 'Run'
Run 'LocalMachine' 'SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run' 'HKLM' 'Run'
Run 'LocalMachine' 'SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Run' 'HKLM' 'Run32'
$sh=New-Object -ComObject WScript.Shell
foreach($par in @(@('Startup','HKCU','CurrentUser'),@('CommonStartup','HKLM','LocalMachine'))){
  $dir=[Environment]::GetFolderPath($par[0]); if(-not $dir -or -not (Test-Path -LiteralPath $dir)){continue}
  foreach($f in (Get-ChildItem -LiteralPath $dir -File -Force -ErrorAction SilentlyContinue)){
    if($f.Name -ieq 'desktop.ini'){continue}; $cmd=$f.FullName
    if($f.Extension -ieq '.lnk'){ try{ $l=$sh.CreateShortcut($f.FullName); if($l.TargetPath){ $cmd='"'+$l.TargetPath+'"'; if($l.Arguments){$cmd+=' '+$l.Arguments} } }catch{} }
    [void]$res.Add(@{ambito=$par[1];sub='StartupFolder';nombre=$f.Name;comando=$cmd;origen='carpeta';archivo=$f.FullName;b=(Aprob $par[2] 'StartupFolder' $f.Name)}) } }
ConvertTo-Json -InputObject @($res) -Depth 3 -Compress`;

// Deduce la ruta del ejecutable a partir de una línea de comandos.
function exeDeComando(cmd) {
  if (!cmd) return null;
  const c = cmd.trim().replace(/%([^%]+)%/g, (m, v) => process.env[v] || m);
  let ruta = null;
  const q = c.match(/^"([^"]+)"/);
  if (q) ruta = q[1];
  else {
    const m = c.match(/^(.+?\.(exe|bat|cmd|com|vbs|ps1|lnk|msc|scr))(\s|$)/i);
    ruta = m ? m[1] : c.split(/\s+/)[0];
  }
  return ruta || null;
}

async function appsInicio() {
  const r = await ps(PS_INICIO, 15000);
  if (!r.datos) return { apps: [], error: r.error };
  const apps = arr(r.datos).map((e) => {
    const ruta = exeDeComando(e.comando);
    const b = e.b == null ? null : e.b;
    return {
      id: `${e.ambito}|${e.sub}|${e.nombre}`,
      nombre: e.origen === 'carpeta' ? e.nombre.replace(/\.(lnk|url)$/i, '') : e.nombre,
      comando: e.comando,
      origen: e.origen,
      ambito: e.ambito, // HKCU = usuario actual, HKLM = todos los usuarios
      activa: b == null ? true : (b & 1) === 0, // 02/06 = activa, 03 (impar) = desactivada
      editable: e.ambito === 'HKCU',
      exe: ruta ? path.win32.basename(ruta) : null,
      ruta,
    };
  });
  return apps;
}

// FILETIME actual (100 ns desde 1601) en 8 bytes little-endian, en hex.
function filetimeHex() {
  const ft = BigInt(Date.now()) * 10000n + 116444736000000000n;
  const b = Buffer.alloc(8); b.writeBigUInt64LE(ft);
  return b.toString('hex');
}

// _prueba.clave permite redirigir la escritura a una clave de pruebas (p.ej. HKCU\Software\UmbraPrueba).
async function cambiarInicio(id, activa, _prueba) {
  const partes = String(id || '').split('|');
  if (partes.length < 3) return { ok: false, error: 'id no válido' };
  const [ambito, sub] = partes;
  const nombre = partes.slice(2).join('|');
  if (!['Run', 'Run32', 'StartupFolder'].includes(sub)) return { ok: false, error: 'id no válido' };
  if (ambito !== 'HKCU') return { ok: false, necesitaAdmin: true };
  const base = (_prueba && _prueba.clave) || ('HKCU\\' + SA);
  const datos = activa ? '020000000000000000000000' : '03000000' + filetimeHex();
  const r = await ejecutar('reg.exe', ['add', `${base}\\${sub}`, '/v', nombre, '/t', 'REG_BINARY', '/d', datos, '/f'], 5000);
  return r.err ? { ok: false, error: r.salida.trim() || String(r.err.message) } : { ok: true };
}

// ---------------------------------------------------------------------------
// 5-7. Almacenamiento, limpieza y archivos grandes
// ---------------------------------------------------------------------------

function rutasLimpiables() {
  const la = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  return {
    temporales: [process.env.TEMP || path.join(la, 'Temp')],
    cache: ['Microsoft\\Windows\\INetCache', 'CrashDumps', 'D3DSCache', 'NVIDIA\\DXCache', 'NVIDIA\\GLCache']
      .map((p) => path.join(la, p)),
  };
}

async function almacenamiento() {
  const rl = rutasLimpiables();
  const script = PS_MEDIR + `
$u=New-Object System.Collections.ArrayList
foreach($d in [IO.DriveInfo]::GetDrives()){ try{ if($d.IsReady -and ($d.DriveType -eq 'Fixed' -or $d.DriveType -eq 'Removable')){
  [void]$u.Add(@{letra=$d.Name.Substring(0,2);nombre=$d.VolumeLabel;total=$d.TotalSize;libre=$d.AvailableFreeSpace;fija=($d.DriveType -eq 'Fixed')}) } }catch{} }
$tmp=[long]0; foreach($r in @(${rl.temporales.map(psStr).join(',')})){ $tmp+=Medir $r 1800 }
$cache=[long]0; foreach($r in @(${rl.cache.map(psStr).join(',')})){ $cache+=Medir $r 2800 }
$sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value; $pap=[long]0
foreach($x in $u){ if($x.fija){ $pap+=Medir ($x.letra+'\\$Recycle.Bin\\'+$sid) 3500 } }
@{unidades=$u;tmp=$tmp;cache=$cache;pap=$pap;corto=($global:reloj.ElapsedMilliseconds -gt 3500)} | ConvertTo-Json -Depth 3 -Compress`;
  const r = await ps(script, 10000);
  if (!r.datos) return { unidades: [], limpiable: null, error: r.error };
  const d = r.datos, MB = 2 ** 20, GB = 2 ** 30;
  return {
    unidades: arr(d.unidades).map((x) => ({
      letra: x.letra, nombre: x.nombre || '', totalGB: r1(x.total / GB), libreGB: r1(x.libre / GB),
      pct: x.total ? r1(((x.total - x.libre) / x.total) * 100) : null,
    })),
    limpiable: { temporalesMB: Math.round(d.tmp / MB), papeleraMB: Math.round(d.pap / MB), cacheMinMB: Math.round(d.cache / MB) },
    ...(d.corto ? { aviso: 'medición parcial por tiempo' } : {}),
  };
}

// Borra archivos (no en uso) de las carpetas indicadas. En temporales se respetan los
// archivos modificados en la última hora (instaladores en curso, etc.).
// _prueba.rutas: lista de carpetas de prueba (ignora `opciones` y no toca la papelera).
async function limpiar(opciones = {}, _prueba) {
  const rl = rutasLimpiables();
  const objetivos = []; // [ruta, horasMinimas]
  if (_prueba && Array.isArray(_prueba.rutas)) _prueba.rutas.forEach((p) => objetivos.push([p, 0]));
  else {
    if (opciones.temporales) rl.temporales.forEach((p) => objetivos.push([p, 1]));
    if (opciones.cache) rl.cache.forEach((p) => objetivos.push([p, 0]));
  }
  const papelera = !_prueba && !!opciones.papelera;
  if (!objetivos.length && !papelera) return { liberadoMB: 0, errores: 0 };
  const rutasPs = objetivos.map(([p]) => psStr(p)).join(',');
  const horasPs = objetivos.map(([, h]) => h).join(',');
  const script = PS_MEDIR + `
$lib=[long]0; $err=0
$rutas=@(${rutasPs}); $horas=@(${horasPs})
for($i=0;$i -lt $rutas.Count;$i++){ $raiz=$rutas[$i]; if(-not [IO.Directory]::Exists($raiz)){continue}
  $corte=(Get-Date).AddHours(-$horas[$i]); $dirs=New-Object System.Collections.ArrayList
  $pila=New-Object System.Collections.Stack; $pila.Push((New-Object IO.DirectoryInfo $raiz))
  while($pila.Count -gt 0){ $d=$pila.Pop()
    try{ foreach($e in @($d.EnumerateFileSystemInfos())){
      if($e.Attributes -band 16){ if(-not ($e.Attributes -band 1024)){ $pila.Push($e); [void]$dirs.Add($e.FullName) } }
      elseif($e.LastWriteTime -lt $corte){ try{ $n=$e.Length; $e.Delete(); $lib+=$n }catch{ $err++ } } } }catch{ $err++ } }
  foreach($x in ($dirs | Sort-Object Length -Descending)){ try{ [IO.Directory]::Delete($x,$false) }catch{} } }
${papelera ? `$sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value; $pap=[long]0
foreach($u in [IO.DriveInfo]::GetDrives()){ try{ if($u.IsReady -and $u.DriveType -eq 'Fixed'){ $pap+=Medir ($u.Name+'$Recycle.Bin\\'+$sid) 60000 } }catch{} }
try{ Clear-RecycleBin -Force -ErrorAction Stop; $lib+=$pap }catch{ if($pap -gt 0){$err++} }` : ''}
@{lib=$lib;err=$err} | ConvertTo-Json -Compress`;
  const r = await ps(script, 120000);
  if (!r.datos) return { liberadoMB: 0, errores: null, error: r.error };
  return { liberadoMB: r1(r.datos.lib / 2 ** 20), errores: r.datos.err };
}

async function archivosGrandes(limite = 20, _prueba) {
  const umbral = (_prueba && _prueba.umbralMB) || 300;
  const script = `
$sw=[Diagnostics.Stopwatch]::StartNew()
$rutas=@([Environment]::GetFolderPath('Desktop'),[Environment]::GetFolderPath('MyDocuments'),[Environment]::GetFolderPath('MyVideos'),[Environment]::GetFolderPath('MyPictures'),[Environment]::GetFolderPath('MyMusic'))
try{ $dl=(Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\User Shell Folders' -ErrorAction Stop).'{374DE290-123F-4565-9164-B4175D60E28E}'; if($dl){$rutas+=[Environment]::ExpandEnvironmentVariables($dl)} }catch{}
$rutas+=(Join-Path $env:USERPROFILE 'Downloads')
$umbral=${Number(umbral)}MB; $vistos=@{}; $res=New-Object System.Collections.ArrayList; $corto=$false
foreach($r in ($rutas | Where-Object {$_} | Select-Object -Unique)){ if(-not [IO.Directory]::Exists($r)){continue}
  $pila=New-Object System.Collections.Stack; $pila.Push((New-Object IO.DirectoryInfo $r))
  while($pila.Count -gt 0){ if($sw.ElapsedMilliseconds -gt 7000){$corto=$true;break}
    $d=$pila.Pop(); if($vistos.ContainsKey($d.FullName)){continue}; $vistos[$d.FullName]=1
    try{ foreach($e in $d.EnumerateFileSystemInfos()){
      if($e.Attributes -band 16){ if(-not ($e.Attributes -band 1024) -and $e.Name -ne 'AppData'){$pila.Push($e)} }
      elseif($e.Length -gt $umbral){ [void]$res.Add(@{ruta=$e.FullName;nombre=$e.Name;b=$e.Length;mod=$e.LastWriteTimeUtc.ToString('o');nube=[bool]([int]$e.Attributes -band 0x441000)}) } } }catch{} } }
@{res=$res;corto=$corto} | ConvertTo-Json -Depth 3 -Compress`;
  const r = await ps(script, 12000);
  if (!r.datos) return [];
  const vistos = new Set();
  return arr(r.datos.res)
    .filter((f) => !vistos.has(f.ruta.toLowerCase()) && vistos.add(f.ruta.toLowerCase()))
    .sort((a, b) => b.b - a.b)
    .slice(0, Math.max(1, limite | 0))
    .map((f) => ({ ruta: f.ruta, nombre: f.nombre, MB: Math.round(f.b / 2 ** 20), modificado: f.mod, enNube: f.nube }));
}

// ---------------------------------------------------------------------------
// 8-10. Windows Update
// ---------------------------------------------------------------------------

const UX = 'HKLM:\\SOFTWARE\\Microsoft\\WindowsUpdate\\UX\\Settings';

// online=false usa la caché del último análisis de Windows (≈7 s); online=true consulta
// el servidor (más lento). Tope de 25 s: si se agota, se devuelve el resto sin `pendientes`.
async function actualizaciones({ online = false } = {}) {
  const scriptReg = `
$ux=Get-ItemProperty '${UX}' -ErrorAction SilentlyContinue
$rb=(Test-Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\WindowsUpdate\\Auto Update\\RebootRequired') -or (Test-Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Component Based Servicing\\RebootPending')
@{rb=$rb;ini=$ux.ActiveHoursStart;fin=$ux.ActiveHoursEnd;pausa=$ux.PauseUpdatesExpiryTime} | ConvertTo-Json -Compress`;
  const scriptCom = `
$s=New-Object -ComObject Microsoft.Update.Session; $s.ClientApplicationID='Antuan Shell'
$q=$s.CreateUpdateSearcher(); $q.Online=$${online ? 'true' : 'false'}
$r=$q.Search('IsInstalled=0 and IsHidden=0'); $l=New-Object System.Collections.ArrayList
foreach($u in $r.Updates){ $kb=@($u.KBArticleIDs); [void]$l.Add(@{titulo=$u.Title;KB=$(if($kb.Count){'KB'+$kb[0]}else{$null});b=[double]$u.MaxDownloadSize;dl=[bool]$u.IsDownloaded}) }
ConvertTo-Json -InputObject @($l) -Depth 3 -Compress`;
  const [reg, com] = await Promise.all([ps(scriptReg, 8000), ps(scriptCom, 25000)]);
  const out = { pendientes: null, reinicioPendiente: null, horasActivas: null, pausadoHasta: null };
  if (reg.datos) {
    const d = reg.datos;
    out.reinicioPendiente = !!d.rb;
    out.horasActivas = d.ini != null && d.fin != null ? { inicio: d.ini, fin: d.fin } : null;
    const p = d.pausa ? new Date(d.pausa) : null;
    out.pausadoHasta = p && !isNaN(p) && p > new Date() ? d.pausa : null;
  }
  if (com.datos) out.pendientes = arr(com.datos).map((u) => ({ titulo: u.titulo, KB: u.KB, tamanoMB: u.b > 0 && u.b < 8 * 2 ** 30 ? Math.round(u.b / 2 ** 20) : null, descargada: !!u.dl }));
  // (las acumulativas declaran como máximo el paquete completo de ~90 GB: entonces tamanoMB = null)
  const errores = [reg.error && 'registro: ' + reg.error, com.error && 'búsqueda: ' + com.error].filter(Boolean);
  if (errores.length) out.error = errores.join('; ');
  return out;
}

// Script (texto) para ejecutar ELEVADO: horas activas 6:00-24:00 (máximo 18 h) y sin
// reinicios automáticos con sesión iniciada.
function comandoProteccionReinicios() {
  return `# Antuan Shell - Protección contra reinicios de Windows Update (ejecutar como administrador)
$ErrorActionPreference = 'Stop'
$ux  = '${UX}'
$wu  = 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsUpdate'
$au  = "$wu\\AU"
foreach ($k in @($ux, $wu, $au)) { if (-not (Test-Path $k)) { New-Item -Path $k -Force | Out-Null } }
# Horas activas 6:00-0:00 (18 h, el máximo permitido) y sin ajuste automático
Set-ItemProperty -Path $ux -Name ActiveHoursStart -Type DWord -Value 6
Set-ItemProperty -Path $ux -Name ActiveHoursEnd -Type DWord -Value 0
Set-ItemProperty -Path $ux -Name SmartActiveHoursState -Type DWord -Value 0
# Directiva equivalente (impide que Windows las cambie)
Set-ItemProperty -Path $wu -Name SetActiveHours -Type DWord -Value 1
Set-ItemProperty -Path $wu -Name ActiveHoursStart -Type DWord -Value 6
Set-ItemProperty -Path $wu -Name ActiveHoursEnd -Type DWord -Value 0
# No reiniciar automáticamente con usuarios con sesión iniciada
Set-ItemProperty -Path $au -Name NoAutoRebootWithLoggedOnUsers -Type DWord -Value 1
# No forzar el reinicio a la hora programada (fuera de horas activas)
Set-ItemProperty -Path $au -Name AlwaysAutoRebootAtScheduledTime -Type DWord -Value 0
if (Get-ItemProperty -Path $au -Name AlwaysAutoRebootAtScheduledTimeMinutes -ErrorAction SilentlyContinue) {
  Remove-ItemProperty -Path $au -Name AlwaysAutoRebootAtScheduledTimeMinutes
}
Write-Host 'Protección contra reinicios aplicada.'
`;
}

// Script (texto) para ejecutar ELEVADO que pausa las actualizaciones `dias` días (1-35).
// Con dias <= 0 genera el script que reanuda (quita la pausa).
function pausarActualizaciones(dias) {
  dias = Math.min(35, Math.floor(Number(dias) || 0));
  const nombres = ['PauseUpdatesStartTime', 'PauseUpdatesExpiryTime', 'PauseFeatureUpdatesStartTime',
    'PauseFeatureUpdatesEndTime', 'PauseQualityUpdatesStartTime', 'PauseQualityUpdatesEndTime'];
  if (dias <= 0) {
    return `# Antuan Shell - Reanudar Windows Update (ejecutar como administrador)
$ux = '${UX}'
foreach ($n in @(${nombres.map((n) => `'${n}'`).join(', ')})) { Remove-ItemProperty -Path $ux -Name $n -ErrorAction SilentlyContinue }
Write-Host 'Actualizaciones reanudadas.'
`;
  }
  return `# Antuan Shell - Pausar Windows Update ${dias} días (ejecutar como administrador)
$ErrorActionPreference = 'Stop'
$ux = '${UX}'
if (-not (Test-Path $ux)) { New-Item -Path $ux -Force | Out-Null }
$ahora = (Get-Date).ToUniversalTime()
$ini = $ahora.ToString('yyyy-MM-ddTHH:mm:ssZ', [Globalization.CultureInfo]::InvariantCulture)
$fin = $ahora.AddDays(${dias}).ToString('yyyy-MM-ddTHH:mm:ssZ', [Globalization.CultureInfo]::InvariantCulture)
Set-ItemProperty -Path $ux -Name PauseUpdatesStartTime -Value $ini
Set-ItemProperty -Path $ux -Name PauseUpdatesExpiryTime -Value $fin
Set-ItemProperty -Path $ux -Name PauseFeatureUpdatesStartTime -Value $ini
Set-ItemProperty -Path $ux -Name PauseFeatureUpdatesEndTime -Value $fin
Set-ItemProperty -Path $ux -Name PauseQualityUpdatesStartTime -Value $ini
Set-ItemProperty -Path $ux -Name PauseQualityUpdatesEndTime -Value $fin
Write-Host "Actualizaciones pausadas hasta $fin"
`;
}

// ---------------------------------------------------------------------------
// 11-14. Red
// ---------------------------------------------------------------------------

// Busca "clave : valor" en salida de netsh; `etiqueta` es un regex (es/en, tolerante a acentos).
function campo(texto, etiqueta) {
  const m = texto.match(new RegExp('^\\s*(?:' + etiqueta + ')\\s*:\\s*(.*?)\\s*$', 'im'));
  return m ? m[1] : null;
}
function bandaDe(banda, canal) {
  if (banda) {
    const n = parseFloat(banda.replace(',', '.'));
    if (n >= 2 && n < 3) return '2.4 GHz';
    if (n >= 5 && n < 6) return '5 GHz';
    if (n >= 6 && n < 7) return '6 GHz';
  }
  const c = parseInt(canal, 10);
  if (c >= 1 && c <= 14) return '2.4 GHz';
  if (c >= 32 && c <= 177) return '5 GHz';
  return null;
}

async function red() {
  const script = `
$w=(netsh wlan show interfaces) -join [char]10
$sel=$null
foreach($n in [Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces()){
  if($n.OperationalStatus -ne 'Up' -or $n.NetworkInterfaceType -eq 'Loopback' -or $n.NetworkInterfaceType -eq 'Tunnel'){continue}
  $p=$n.GetIPProperties(); $gw=@($p.GatewayAddresses | Where-Object { $_.Address.AddressFamily -eq 'InterNetwork' -and $_.Address.ToString() -ne '0.0.0.0' })
  if(-not $gw.Count){continue}
  $ip=@($p.UnicastAddresses | Where-Object { $_.Address.AddressFamily -eq 'InterNetwork' } | ForEach-Object { $_.Address.ToString() })
  $sel=@{tipo=[string]$n.NetworkInterfaceType;nombre=$n.Name;desc=$n.Description;ip=$ip[0];puerta=$gw[0].Address.ToString();dns=@($p.DnsAddresses | ForEach-Object { $_.ToString() })}; break }
@{wlan=$w;nic=$sel} | ConvertTo-Json -Depth 3 -Compress`;
  const r = await ps(script, 10000);
  const out = { tipo: null, ssid: null, senal: null, banda: null, ip: null, puerta: null, dns: [] };
  if (!r.datos) return { ...out, error: r.error };
  const nic = r.datos.nic, w = r.datos.wlan || '';
  if (nic) {
    out.tipo = /wireless/i.test(nic.tipo) ? 'wifi' : 'ethernet';
    out.ip = nic.ip || null; out.puerta = nic.puerta || null;
    out.dns = arr(nic.dns).filter((d) => !/^fec0:/i.test(d));
    out.adaptador = nic.nombre;
  }
  const conectado = /^\s*(Estado|State)\s*:\s*(conectado|connected)\s*$/im.test(w);
  if (conectado && (!nic || out.tipo === 'wifi')) {
    out.tipo = 'wifi';
    out.ssid = campo(w, 'SSID');
    const s = campo(w, 'Se.{1,2}al|Signal');
    out.senal = s ? parseInt(s, 10) : null;
    out.banda = bandaDe(campo(w, 'Banda|Band'), campo(w, 'Canal|Channel'));
  }
  return out;
}

async function redesWifi() {
  const r = await ps(`@{n=((netsh wlan show networks mode=bssid) -join [char]10);p=((netsh wlan show profiles) -join [char]10)} | ConvertTo-Json -Compress`, 10000);
  if (!r.datos) return [];
  const perfiles = perfilesDe(r.datos.p || '');
  const redes = [];
  // Cada red empieza con "SSID n : nombre" (sin espacios delante; BSSID va indentado).
  for (const bloque of (r.datos.n || '').split(/\n(?=SSID \d+\s*:)/)) {
    const m = bloque.match(/^SSID \d+\s*:\s?(.*)$/m);
    if (!m) continue;
    const ssid = m[1].trim();
    const senales = [...bloque.matchAll(/^\s*(?:Se.{1,2}al|Signal)\s*:\s*(\d+)/gim)].map((x) => +x[1]);
    const aut = campo(bloque, 'Autenticaci.{1,2}n|Authentication') || '';
    redes.push({
      ssid, senal: senales.length ? Math.max(...senales) : null,
      segura: !/^(abierta|open)/i.test(aut), conocida: perfiles.includes(ssid),
    });
  }
  return redes.filter((x) => x.ssid).sort((a, b) => (b.senal || 0) - (a.senal || 0));
}

function perfilesDe(texto) {
  const out = [];
  for (const l of texto.split(/\r?\n/)) {
    const m = l.match(/^\s+[^:]*(?:Perfil|Profile)[^:]*:\s(.+?)\s*$/i);
    if (m) out.push(m[1]);
  }
  return out;
}

async function conectarWifi(ssid) {
  ssid = String(ssid || '');
  if (!ssid || /["\r\n]/.test(ssid)) return { ok: false, error: 'SSID no válido' };
  const p = await ejecutar('netsh.exe', ['wlan', 'show', 'profiles'], 8000);
  if (!perfilesDe(p.salida.toString()).some((x) => Buffer.from(x, 'latin1').toString('utf8') === ssid || x === ssid)) {
    return { ok: false, sinPerfil: true, error: 'No hay perfil guardado para esta red' };
  }
  const r = await ejecutar('netsh.exe', ['wlan', 'connect', `name="${ssid}"`], 10000, { windowsVerbatimArguments: true });
  return r.err ? { ok: false, error: r.salida.trim() } : { ok: true, mensaje: r.salida.trim() };
}

const hostValido = (h) => /^[A-Za-z0-9._:\-]{1,253}$/.test(String(h || ''));

async function ping(host, n = 4) {
  if (!hostValido(host)) return { min: null, media: null, max: null, perdida: null, error: 'host no válido' };
  n = Math.max(1, Math.min(20, n | 0 || 4));
  const script = `
$p=New-Object Net.NetworkInformation.Ping; $t=New-Object System.Collections.ArrayList; $ok=0
for($i=0;$i -lt ${n};$i++){ try{ $r=$p.Send(${psStr(host)},2000); if($r.Status -eq 'Success'){ $ok++; [void]$t.Add([int]$r.RoundtripTime) } }catch{}; if($i -lt ${n - 1}){Start-Sleep -Milliseconds 200} }
@{t=@($t);ok=$ok} | ConvertTo-Json -Compress`;
  const r = await ps(script, n * 2500 + 5000);
  if (!r.datos) return { min: null, media: null, max: null, perdida: null, error: r.error };
  const t = arr(r.datos.t);
  return {
    min: t.length ? Math.min(...t) : null,
    media: t.length ? r1(t.reduce((a, b) => a + b, 0) / t.length) : null,
    max: t.length ? Math.max(...t) : null,
    perdida: Math.round(((n - r.datos.ok) / n) * 100),
  };
}

function rutaHasta(host) {
  return new Promise((resolve) => {
    if (!hostValido(host)) return resolve([]);
    let salida = '', fin = false;
    const parsear = () => {
      const saltos = [];
      for (const l of salida.split(/\r?\n/)) {
        const m = l.match(/^\s*(\d+)\s+(.+)$/);
        if (!m) continue;
        const tiempos = [...m[2].matchAll(/(<?)(\d+)\s*ms/g)].map((x) => (x[1] ? 0.5 : +x[2]));
        const ipm = m[2].match(/(\d{1,3}(?:\.\d{1,3}){3}|[0-9a-f]*:[0-9a-f:]+)\s*$/i);
        saltos.push({
          salto: +m[1], ip: ipm ? ipm[1] : null,
          ms: tiempos.length ? r1(tiempos.reduce((a, b) => a + b, 0) / tiempos.length) : null,
        });
      }
      return saltos;
    };
    const terminar = () => { if (!fin) { fin = true; clearTimeout(tm); resolve(parsear()); } };
    let hijo;
    try { hijo = spawn('tracert.exe', ['-d', '-h', '20', '-w', '600', host], { windowsHide: true }); }
    catch (e) { return resolve([]); }
    hijo.stdout.on('data', (d) => { salida += d.toString('latin1'); });
    hijo.on('error', terminar);
    hijo.on('close', terminar);
    const tm = setTimeout(() => { try { hijo.kill(); } catch (e) { /* nada */ } terminar(); }, 25000);
  });
}

module.exports = {
  rendimiento, cerrarProceso,
  appsInicio, cambiarInicio,
  almacenamiento, limpiar, archivosGrandes,
  actualizaciones, comandoProteccionReinicios, pausarActualizaciones,
  red, redesWifi, conectarWifi, ping, rutaHasta,
};
