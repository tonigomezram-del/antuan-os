<#
  Antuan Shell - instalador.
  Prepara Antuan en este PC: dependencias, accesos directos en el menu Inicio y arranque con Windows.
  Uso:  powershell -ExecutionPolicy Bypass -File instalar-umbra.ps1            (instalar y abrir)
        powershell -ExecutionPolicy Bypass -File instalar-umbra.ps1 -Quitar    (desinstalar y volver a Windows)
#>
param([switch]$Quitar)
$ErrorActionPreference = "Stop"
$shell = Join-Path $PSScriptRoot "shell"
$electron = Join-Path $shell "node_modules\electron\dist\electron.exe"
$menu = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs"
$run = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"

function Say($m, $c = "Gray") { Write-Host "  $m" -ForegroundColor $c }
Write-Host ""; Write-Host "  antuan" -ForegroundColor White; Write-Host ""

if ($Quitar) {
  Get-Process electron -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "$shell*" -and $_.MainWindowHandle -ne 0 } | ForEach-Object { taskkill /PID $_.Id | Out-Null }
  Start-Sleep 3
  foreach ($n in "Antuan", "Umbra") { Remove-ItemProperty $run -Name $n -ErrorAction SilentlyContinue }
  Remove-Item (Join-Path $menu "Antuan.lnk"), (Join-Path $menu "Centro Antuan.lnk"), (Join-Path $menu "Umbra.lnk"), (Join-Path $menu "Centro Umbra.lnk") -ErrorAction SilentlyContinue
  Say "Antuan desinstalado. La barra de Windows ha vuelto." Green
  return
}

# 1. Dependencias (Node.js + paquetes)
$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node -and (Test-Path "C:\Program Files\nodejs\node.exe")) { $env:Path = "C:\Program Files\nodejs;" + $env:Path; $node = "C:\Program Files\nodejs\node.exe" }
if (-not (Test-Path $electron)) {
  if (-not $node) { Say "Falta Node.js. Instálalo con:  winget install OpenJS.NodeJS.LTS --source winget" Yellow; exit 1 }
  Say "Instalando componentes (una sola vez)..." DarkGray
  Push-Location $shell; npm.cmd install --no-fund --no-audit | Out-Null; Pop-Location
}

# 2. Accesos directos en el menu Inicio
# (fuera los accesos con el nombre antiguo, Umbra)
Remove-Item (Join-Path $menu "Umbra.lnk"), (Join-Path $menu "Centro Umbra.lnk") -ErrorAction SilentlyContinue
$ws = New-Object -ComObject WScript.Shell
foreach ($a in @(@("Antuan", "`"$shell`""), @("Centro Antuan", "`"$shell`" --centro"))) {
  $lnk = $ws.CreateShortcut((Join-Path $menu ($a[0] + ".lnk")))
  $lnk.TargetPath = $electron; $lnk.Arguments = $a[1]; $lnk.WorkingDirectory = $shell
  $lnk.Description = $a[0]; $lnk.Save()
}
Say "Accesos directos creados: Antuan y Centro Antuan." Green

# 3. Arranque con Windows (Antuan lo gestiona tambien desde Centro > Sistema)
Remove-ItemProperty $run -Name "Umbra" -ErrorAction SilentlyContinue
New-ItemProperty $run -Name "Antuan" -Value "`"$electron`" `"$shell`" --login" -PropertyType String -Force | Out-Null
Say "Antuan arrancará con Windows." Green

# 4. Abrir
Start-Process $electron -ArgumentList "`"$shell`"" -WorkingDirectory $shell
Say "Listo. Disfrútalo." White
Write-Host ""
