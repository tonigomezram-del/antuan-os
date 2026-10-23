# Arrancar Antuan sin pendrive: crea una particion "ANTUAN" de 8 GB en el disco con el instalador,
# la anade al menu de arranque, hace que el proximo arranque vaya directo a ella y reinicia.
# Windows no se toca (solo se reduce C: en 8 GB, que siguen libres para el instalador).
#Requires -RunAsAdministrator
$ErrorActionPreference = 'Stop'
$TAM = 8GB
$PASOS = 6
function Paso($n, $t) {
  Write-Progress -Id 1 -Activity 'Preparando Antuan OS' -Status "Paso $n de $PASOS  ·  $t" -PercentComplete ([int](($n - 1) / $PASOS * 100))
  Write-Host ("`n  [{0,3}%]  Paso {1}/{2}  ●  {3}" -f [int](($n - 1) / $PASOS * 100), $n, $PASOS, $t) -ForegroundColor Cyan
}
function Info($t) { Write-Host "          $t" -ForegroundColor DarkGray }

# 1. ISO
Paso 1 'Buscando la ISO de Antuan'
$iso = Get-ChildItem "$PSScriptRoot\os\build\antuan-*.iso", "$PSScriptRoot\antuan-*.iso", "$PSScriptRoot\os\build\umbra-*.iso", "$PSScriptRoot\umbra-*.iso" -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $iso) { throw 'No encuentro la ISO de Antuan (os\build\antuan-*.iso).' }
Info ("{0}  ({1:N2} GB)" -f $iso.Name, ($iso.Length / 1GB))

# 2. Particion ANTUAN (si ya existe de otra vez, se reutiliza; tambien la antigua "UMBRA")
Paso 2 'Comprobando el hueco para Antuan en el disco'
$part = Get-Partition | Where-Object { (Get-Volume -Partition $_ -ErrorAction SilentlyContinue).FileSystemLabel -in 'ANTUAN', 'UMBRA' } | Select-Object -First 1
if ($part) { Info 'Ya existe la particion ANTUAN de otra vez: se reutiliza' }
else {
  $c = Get-Partition -DriveLetter C
  $sz = Get-PartitionSupportedSize -DriveLetter C
  $libre = [math]::Floor(($c.Size - $sz.SizeMin) / 1GB)
  Info "Windows deja quitar $libre GB de C: (hacen falta 8)"
  if (($c.Size - $sz.SizeMin) -lt $TAM) {
    # Lo habitual: la tabla del disco de Windows ($MFT) esta al final de C: y Windows no puede moverla.
    $ev = Get-WinEvent -FilterHashtable @{ LogName = 'Application'; ProviderName = 'Microsoft-Windows-Defrag'; Id = 259, 261 } -MaxEvents 1 -ErrorAction SilentlyContinue
    $culpable = if ($ev) { [regex]::Match($ev.Message, '\\\S+').Value } else { 'desconocido' }
    Write-Host "`n  No se puede: el archivo $culpable esta al final de C: y Windows no puede moverlo." -ForegroundColor Yellow
    Write-Host '  No se ha cambiado nada del disco. Opciones: un pendrive, o reducir C: con MiniTool/AOMEI Partition.' -ForegroundColor Yellow
    exit 1
  }
  Paso 3 'Haciendo hueco de 8 GB en C: (sin borrar nada)'
  Resize-Partition -DriveLetter C -Size ($c.Size - $TAM)
  $part = New-Partition -DiskNumber $c.DiskNumber -Size ($TAM - 16MB) -AssignDriveLetter
  Format-Volume -Partition $part -FileSystem FAT32 -NewFileSystemLabel 'ANTUAN' -Confirm:$false | Out-Null
  $part = Get-Partition -DiskNumber $c.DiskNumber -PartitionNumber $part.PartitionNumber
  Info 'Particion ANTUAN creada'
}
if (-not $part.DriveLetter -or $part.DriveLetter -eq "`0") { $part | Add-PartitionAccessPath -AssignDriveLetter; $part = Get-Partition -DiskNumber $part.DiskNumber -PartitionNumber $part.PartitionNumber }
$U = "$($part.DriveLetter):"
Set-Volume -DriveLetter $part.DriveLetter -NewFileSystemLabel 'ANTUAN' -ErrorAction SilentlyContinue

# 4. Copiar el instalador, con porcentaje, MB, velocidad y tiempo restante
Paso 4 "Copiando Antuan a $U"
$img = Mount-DiskImage -ImagePath $iso.FullName -PassThru
$src = ($img | Get-Volume).DriveLetter + ':'
$sq = Get-Item "$src\live\filesystem.squashfs"
if ($sq.Length -ge 4GB) { Dismount-DiskImage -ImagePath $iso.FullName | Out-Null; throw 'filesystem.squashfs pasa de 4 GB (limite FAT32).' }
Get-ChildItem "$U\" -Force | Remove-Item -Recurse -Force
$archivos = Get-ChildItem "$src\" -Recurse -File -Force
$total = ($archivos | Measure-Object Length -Sum).Sum
$hecho = 0; $reloj = [Diagnostics.Stopwatch]::StartNew(); $buf = New-Object byte[] (8MB)
foreach ($f in $archivos) {
  $dst = Join-Path "$U\" $f.FullName.Substring($src.Length + 1)
  New-Item -ItemType Directory -Force -Path (Split-Path $dst) | Out-Null
  $in = [IO.File]::OpenRead($f.FullName); $out = [IO.File]::Create($dst)
  try {
    while (($n = $in.Read($buf, 0, $buf.Length)) -gt 0) {
      $out.Write($buf, 0, $n); $hecho += $n
      $pct = [int]($hecho / $total * 100); $seg = [math]::Max($reloj.Elapsed.TotalSeconds, 0.1)
      $vel = $hecho / 1MB / $seg; $resta = [int](($total - $hecho) / 1MB / [math]::Max($vel, 0.1))
      Write-Progress -Id 2 -ParentId 1 -Activity 'Copiando Antuan' -Status ("{0}%  ·  {1:N0} de {2:N0} MB  ·  {3:N0} MB/s  ·  quedan {4} s" -f $pct, ($hecho / 1MB), ($total / 1MB), $vel, $resta) -CurrentOperation $f.Name -PercentComplete $pct
    }
  } finally { $in.Close(); $out.Close() }
}
Write-Progress -Id 2 -Activity 'Copiando Antuan' -Completed
Dismount-DiskImage -ImagePath $iso.FullName | Out-Null
Info ("Copiados {0:N0} MB en {1:N0} s" -f ($total / 1MB), $reloj.Elapsed.TotalSeconds)
if (-not (Test-Path "$U\EFI\boot\bootx64.efi")) { throw 'La ISO no trae EFI\boot\bootx64.efi.' }

# 5. Entrada "Antuan OS" en el arranque del PC y siguiente arranque directo a ella
Paso 5 'Anadiendo Antuan OS al arranque'
$out = bcdedit /copy '{bootmgr}' /d 'Antuan OS'
$id = [regex]::Match(($out -join ' '), '\{[0-9a-fA-F-]{36}\}').Value
if (-not $id) { throw "bcdedit no devolvio identificador: $out" }
bcdedit /set $id device "partition=$U" | Out-Null
bcdedit /set $id path '\EFI\boot\bootx64.efi' | Out-Null
bcdedit /set '{fwbootmgr}' displayorder $id /addlast | Out-Null
bcdedit /set '{fwbootmgr}' bootsequence $id | Out-Null
# Windows con "inicio rapido" deja el disco bloqueado al apagar: con dos sistemas hay que quitarlo
powercfg /h off
Info 'Entrada creada; el proximo arranque ira directo a Antuan'

# BitLocker: pausarlo un reinicio para que no pida la clave de recuperacion
try { if ((Get-BitLockerVolume -MountPoint C:).ProtectionStatus -eq 'On') { Suspend-BitLocker -MountPoint C: -RebootCount 1 | Out-Null; Info 'BitLocker en pausa durante 1 reinicio' } } catch { }
Remove-PartitionAccessPath -DiskNumber $part.DiskNumber -PartitionNumber $part.PartitionNumber -AccessPath "$U\" -ErrorAction SilentlyContinue

# 6. Reinicio
Paso 6 'Reiniciando en Antuan'
for ($s = 20; $s -gt 0; $s--) {
  Write-Progress -Id 1 -Activity 'Preparando Antuan OS' -Status "100%  ·  Reinicio en $s s  (Ctrl+C para cancelar)" -PercentComplete 100
  Start-Sleep 1
}
Restart-Computer -Force
