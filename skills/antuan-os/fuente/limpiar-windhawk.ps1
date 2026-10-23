<#
  Quita de Windhawk los mods que ya no hacen falta con Antuan Shell:
  los estilos de la barra y el inicio, la posicion de la barra y las animaciones
  tipo macOS (apuntaban a la barra de Windows, que Antuan oculta).
  Se pueden volver a instalar cuando quieras desde Windhawk.
#>
$ErrorActionPreference = "Continue"
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
  Start-Process powershell.exe -Verb RunAs -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "`"$PSCommandPath`""
  return
}

$mods = @("windows-11-taskbar-styler", "windows-11-start-menu-styler", "taskbar-on-top", "taskbar-vertical", "macos-minimize-animation", "taskbar-dock-animation")
$key = "HKLM:\SOFTWARE\Windhawk\Engine\Mods"
$data = Join-Path $env:ProgramData "Windhawk"

# 1. Apagar (Windhawk los descarga en caliente)
foreach ($m in $mods) { if (Test-Path "$key\$m") { Set-ItemProperty "$key\$m" -Name Disabled -Value 1 -Type DWord } }
Start-Sleep -Seconds 3

# 2. Borrar registro, DLLs y codigo fuente
foreach ($m in $mods) {
  if (Test-Path "$key\$m") { Remove-Item "$key\$m" -Recurse -Force }
  foreach ($sub in "32", "64", "arm64") {
    Get-ChildItem (Join-Path $data "Engine\Mods\$sub") -Filter "${m}_*.dll" -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
  }
  Remove-Item (Join-Path $data "ModsSource\$m.wh.cpp") -Force -ErrorAction SilentlyContinue
  Write-Host "  quitado: $m" -ForegroundColor Green
}

# 3. Que la interfaz de Windhawk tampoco los liste
try {
  $pf = Join-Path $data "userprofile.json"
  $prof = Get-Content $pf -Raw | ConvertFrom-Json
  foreach ($m in $mods) { $prof.mods.PSObject.Properties.Remove($m) }
  [IO.File]::WriteAllText($pf, ($prof | ConvertTo-Json -Depth 10), (New-Object Text.UTF8Encoding $false))
} catch { }

Write-Host ""
Write-Host "  Listo. Windhawk queda limpio para tus futuros mods propios." -ForegroundColor White
Start-Sleep -Seconds 3
