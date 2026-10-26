# Instalar Antuan sin pendrive: hace lo mismo que Rufus + pendrive, pero desde el propio disco.
# Copia la ISO a C:\antuan\antuan.iso, pone el arrancador de Antuan (firmado, vale con Secure Boot) en la
# particion de arranque del PC y hace que el SIGUIENTE arranque vaya al instalador. Antuan se carga entero en
# la RAM, asi que en el instalador se puede elegir "Borrar disco" (Windows incluido).
# Si no se instala nada, el arranque siguiente vuelve a Windows solo. No se reduce ni se toca ninguna particion.
#Requires -RunAsAdministrator
$ErrorActionPreference = 'Stop'
$PASOS = 5
function Paso($n, $t) {
  Write-Progress -Id 1 -Activity 'Antuan sin pendrive' -Status "Paso $n de $PASOS  ·  $t" -PercentComplete ([int](($n - 1) / $PASOS * 100))
  Write-Host ("`n  [{0,3}%]  Paso {1}/{2}  ●  {3}" -f [int](($n - 1) / $PASOS * 100), $n, $PASOS, $t) -ForegroundColor Cyan
}
function Info($t) { Write-Host "          $t" -ForegroundColor DarkGray }
function Parar($t) { Write-Host "`n  $t" -ForegroundColor Yellow; Write-Host '  No se ha cambiado nada.' -ForegroundColor Yellow; exit 1 }

# 1. Comprobaciones
Paso 1 'Comprobando el PC'
$iso = Get-ChildItem "$PSScriptRoot\os\build\antuan-*.iso", "$PSScriptRoot\antuan-*.iso" -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $iso) { Parar 'No encuentro la ISO de Antuan (os\build\antuan-*.iso).' }
Info ("ISO: {0}  ({1:N2} GB)" -f $iso.Name, ($iso.Length / 1GB))
$arr = "$PSScriptRoot\os\arrancador\EFI\debian"
if (-not (Test-Path "$arr\shimx64.efi") -or -not (Test-Path "$arr\grub.cfg")) { Parar "Falta el arrancador ($arr)." }
if ($env:firmware_type -ne 'UEFI') { Parar 'Este PC no arranca en modo UEFI.' }
# El arrancador de Antuan no puede leer un disco cifrado
$bl = Get-BitLockerVolume -MountPoint C: -ErrorAction SilentlyContinue
if ($bl -and $bl.VolumeStatus -ne 'FullyDecrypted') {
  if ($bl.VolumeStatus -eq 'DecryptionInProgress') { Parar ("C: se esta descifrando: va por el {0}% descifrado. Vuelve a ejecutarme cuando llegue al 100%." -f (100 - $bl.EncryptionPercentage)) }
  Parar 'C: esta cifrado. Ve a Configuracion > Privacidad y seguridad > Cifrado del dispositivo > Desactivado, espera a que acabe y vuelve a ejecutarme.'
}
Info 'C: sin cifrar: bien'
$libre = (Get-PSDrive C).Free
if ($libre -lt ($iso.Length + 1GB)) { Parar 'No hay sitio en C: para la ISO.' }

# 2. Copiar la ISO a C:\antuan (con porcentaje, velocidad y tiempo restante)
Paso 2 'Copiando el instalador a C:\antuan'
New-Item -ItemType Directory -Force -Path 'C:\antuan' | Out-Null
$dst = 'C:\antuan\antuan.iso'
$total = $iso.Length; $hecho = 0; $reloj = [Diagnostics.Stopwatch]::StartNew(); $buf = New-Object byte[] (8MB)
$in = [IO.File]::OpenRead($iso.FullName); $out = [IO.File]::Create($dst)
try {
  while (($n = $in.Read($buf, 0, $buf.Length)) -gt 0) {
    $out.Write($buf, 0, $n); $hecho += $n
    $pct = [int]($hecho / $total * 100); $vel = $hecho / 1MB / [math]::Max($reloj.Elapsed.TotalSeconds, 0.1)
    $resta = [int](($total - $hecho) / 1MB / [math]::Max($vel, 0.1))
    Write-Progress -Id 2 -ParentId 1 -Activity 'Copiando Antuan' -Status ("{0}%  ·  {1:N0} de {2:N0} MB  ·  {3:N0} MB/s  ·  quedan {4} s" -f $pct, ($hecho / 1MB), ($total / 1MB), $vel, $resta) -PercentComplete $pct
  }
} finally { $in.Close(); $out.Close() }
Write-Progress -Id 2 -Activity 'Copiando Antuan' -Completed
Info ("Copiados {0:N0} MB en {1:N0} s" -f ($total / 1MB), $reloj.Elapsed.TotalSeconds)

# 3. Arrancador en la particion de arranque (EFI)
Paso 3 'Poniendo el arrancador de Antuan'
$L = 'S:'; foreach ($c in 'S','T','U','V','W') { if (-not (Test-Path "${c}:\")) { $L = "${c}:"; break } }
mountvol $L /S
try {
  New-Item -ItemType Directory -Force -Path "$L\EFI\debian" | Out-Null
  Copy-Item "$arr\*" "$L\EFI\debian\" -Force
  Info "Arrancador copiado a la particion EFI (\EFI\debian)"

  # 4. El siguiente arranque va a Antuan (una sola vez; despues Windows sigue como siempre)
  Paso 4 'Preparando el siguiente arranque'
  $o = bcdedit /copy '{bootmgr}' /d 'Antuan OS'
  $id = [regex]::Match(($o -join ' '), '\{[0-9a-fA-F-]{36}\}').Value
  if (-not $id) { throw "bcdedit no devolvio identificador: $o" }
  bcdedit /set $id device "partition=$L" | Out-Null
  bcdedit /set $id path '\EFI\debian\shimx64.efi' | Out-Null
  bcdedit /set '{fwbootmgr}' bootsequence $id | Out-Null
} finally { mountvol $L /D }
# Windows con "inicio rapido" deja el disco a medio cerrar y Antuan no podria leer la ISO
powercfg /h off
Info 'Listo: el proximo arranque abre el instalador de Antuan'

# 5. Reinicio
Paso 5 'Reiniciando en el instalador de Antuan'
Write-Host "`n  En el instalador: elige 'Borrar disco' para quitar Windows y dejar solo Antuan." -ForegroundColor Green
for ($s = 20; $s -gt 0; $s--) {
  Write-Progress -Id 1 -Activity 'Antuan sin pendrive' -Status "100%  ·  Reinicio en $s s  (Ctrl+C para cancelar)" -PercentComplete 100
  Start-Sleep 1
}
Restart-Computer -Force
