# Actualiza Antuan en Windows con lo ultimo de GitHub (sin reinstalar).
# Uso (PowerShell):  irm https://raw.githubusercontent.com/tonigomezram-del/antuan-os/main/actualizar.ps1 | iex
# Sirve para Antuan instalado con Antuan-Instalar.exe y para la carpeta de codigo (UmbraOS\shell).
$ErrorActionPreference = 'Stop'
$destinos = @(
  "$env:LOCALAPPDATA\Programs\Antuan\resources\app",
  "$env:USERPROFILE\Desktop\Opensource ai\UmbraOS\shell"
) | Where-Object { Test-Path (Join-Path $_ 'main.js') }
if (-not $destinos) { Write-Host 'No encuentro Antuan en este PC.' -ForegroundColor Yellow; return }

Write-Host '[ 10%] Descargando Antuan de GitHub...' -ForegroundColor Cyan
$tmp = Join-Path $env:TEMP ('antuan-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $tmp | Out-Null
Invoke-WebRequest 'https://codeload.github.com/tonigomezram-del/antuan-os/zip/refs/heads/main' -OutFile "$tmp\antuan.zip" -UseBasicParsing
Expand-Archive "$tmp\antuan.zip" -DestinationPath $tmp
$nuevo = Join-Path $tmp 'antuan-os-main\skills\antuan-os\fuente\shell'

# Antuan se cierra para poder cambiar sus archivos (y se apunta como estaba abierto para volver a abrirlo)
Write-Host '[ 40%] Cerrando Antuan...' -ForegroundColor Cyan
$relanzar = @()
foreach ($p in (Get-CimInstance Win32_Process -Filter "Name='electron.exe' OR Name='Antuan.exe'")) {
  if (-not $p.CommandLine -or $p.CommandLine -match '--type=') { continue }
  $esAntuan = $p.Name -eq 'Antuan.exe' -or ($destinos | Where-Object { $p.CommandLine -like "*$_*" })
  if (-not $esAntuan) { continue }
  $m = [regex]::Match($p.CommandLine, '^("[^"]+"|\S+)\s*(.*)$')
  $relanzar += [pscustomobject]@{ Exe = $p.ExecutablePath; Argumentos = $m.Groups[2].Value }
  Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Milliseconds 1500

foreach ($d in $destinos) {
  Write-Host "[ 70%] Actualizando $d" -ForegroundColor Cyan
  $copia = "$d.anterior"
  if (Test-Path $copia) { Remove-Item $copia -Recurse -Force }
  New-Item -ItemType Directory -Path $copia | Out-Null
  Copy-Item "$d\*.js", "$d\*.ps1", "$d\package.json" $copia -ErrorAction SilentlyContinue
  Copy-Item "$d\ui" $copia -Recurse
  Copy-Item "$nuevo\*.js", "$nuevo\*.ps1" $d -Force
  Copy-Item "$nuevo\ui\*" "$d\ui" -Recurse -Force
}
Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue

Write-Host '[ 90%] Abriendo Antuan otra vez...' -ForegroundColor Cyan
foreach ($r in $relanzar) {
  if ($r.Argumentos) { Start-Process -FilePath $r.Exe -ArgumentList $r.Argumentos } else { Start-Process -FilePath $r.Exe }
}
Write-Host '[100%] Antuan actualizado. La copia anterior queda en la carpeta ".anterior".' -ForegroundColor Green
