<#
  Antuan - instalador de un solo uso.
  Instala los mods necesarios en Windhawk (sin abrir Windhawk) y escribe el diseno Antuan
  en su configuracion. Todo se aplica en caliente: no reinicia Windows ni la barra.
  Despues no queda nada ejecutandose: Windhawk lo carga solo en cada arranque.

  Ejemplos:
    .\instalar.ps1                          # Antuan Cristal, barra abajo, fondo Antuan
    .\instalar.ps1 -Posicion left           # barra a la izquierda (top | left | right | bottom)
    .\instalar.ps1 -Estilo contraste        # variante accesible de alto contraste
    .\instalar.ps1 -Restaurar               # vuelve a Windows original
    .\instalar.ps1 -Prueba                  # solo muestra lo que haria, sin tocar nada
#>
param(
  [ValidateSet("cristal", "contraste")] [string]$Estilo = "cristal",
  [ValidateSet("bottom", "top", "left", "right")] [string]$Posicion = "bottom",
  [switch]$SinFondo,
  [switch]$SinAjustesWindows,
  [switch]$Restaurar,
  [switch]$ReiniciarBarra,
  [switch]$SinPausa,
  [switch]$Prueba
)
$ErrorActionPreference = "Stop"
$Temas = Join-Path $PSScriptRoot "temas"
$ModsKey = "HKLM:\SOFTWARE\Windhawk\Engine\Mods"

$TaskbarStyler = "windows-11-taskbar-styler"
$StartStyler   = "windows-11-start-menu-styler"
$OnTop         = "taskbar-on-top"
$Vertical      = "taskbar-vertical"
$DockAnim      = "taskbar-dock-animation"

function Say($msg, $color = "Gray") { Write-Host "  $msg" -ForegroundColor $color }

# --- Permisos: Windhawk guarda los ajustes de los mods en HKLM -----------------
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin -and -not $Prueba) {
  $argList = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "`"$PSCommandPath`"")
  foreach ($k in $PSBoundParameters.Keys) {
    $v = $PSBoundParameters[$k]
    if ($v -is [switch]) { if ($v.IsPresent) { $argList += "-$k" } } else { $argList += "-$k"; $argList += "$v" }
  }
  Start-Process powershell.exe -Verb RunAs -ArgumentList $argList
  return
}

# --- Lector de temas (subconjunto de YAML que usan los archivos Antuan) --------
function Read-Theme([string[]]$files) {
  $consts = New-Object System.Collections.Generic.List[string]
  $styles = New-Object System.Collections.Generic.List[object]
  foreach ($f in $files) {
    $section = $null; $current = $null
    foreach ($raw in [IO.File]::ReadAllLines($f, [Text.Encoding]::UTF8)) {
      $t = $raw.Trim()
      if ($t.Length -eq 0 -or $t.StartsWith("#")) { continue }
      if (-not [char]::IsWhiteSpace($raw[0])) { $section = $t.TrimEnd(":"); $current = $null; continue }
      if ($section -eq "styleConstants" -and $t.StartsWith("- ")) { $consts.Add($t.Substring(2).Trim()) }
      elseif ($section -eq "controlStyles") {
        if ($t.StartsWith("- target:")) {
          $current = New-Object System.Collections.Generic.List[string]
          $styles.Add([pscustomobject]@{ Target = $t.Substring(9).Trim(); Styles = $current })
        } elseif ($t.StartsWith("- ") -and $null -ne $current) { $current.Add($t.Substring(2).Trim()) }
      }
    }
  }
  $out = [ordered]@{ "theme" = "" }
  for ($i = 0; $i -lt $consts.Count; $i++) { $out["styleConstants[$i]"] = $consts[$i] }
  for ($i = 0; $i -lt $styles.Count; $i++) {
    $out["controlStyles[$i].target"] = $styles[$i].Target
    for ($j = 0; $j -lt $styles[$i].Styles.Count; $j++) { $out["controlStyles[$i].styles[$j]"] = $styles[$i].Styles[$j] }
  }
  return $out
}

# --- Acceso a la configuracion de Windhawk -----------------------------------
function Test-Mod($id) { Test-Path "$ModsKey\$id" }
function Touch-Mod($id) {
  $now = [int][DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
  Set-ItemProperty "$ModsKey\$id" -Name SettingsChangeTime -Value $now -Type DWord
}
function Set-ModEnabled($id, [bool]$on) {
  if (-not (Test-Mod $id)) { return }
  if ($Prueba) { Say "[prueba] $id -> $(if ($on) {'activado'} else {'desactivado'})"; return }
  Set-ItemProperty "$ModsKey\$id" -Name Disabled -Value ([int](-not $on)) -Type DWord
}
function Set-ModSetting($id, $name, $value) {
  if (-not (Test-Mod $id)) { return }
  if ($Prueba) { Say "[prueba] $id.$name = $value"; return }
  $s = "$ModsKey\$id\Settings"
  if (-not (Test-Path $s)) { New-Item $s | Out-Null }
  $type = if ($value -is [int]) { "DWord" } else { "String" }
  New-ItemProperty $s -Name $name -Value $value -PropertyType $type -Force | Out-Null
  Touch-Mod $id
}
# Instala un mod igual que lo hace Windhawk: DLL precompilada del catalogo oficial,
# codigo fuente, entrada en el registro y ajustes por defecto. El motor de Windhawk
# lo carga en caliente, sin reiniciar nada.
function Install-WindhawkMod($id) {
  if (Test-Mod $id) { return }
  $base = "https://mods.windhawk.net/mods/$id"
  $wc = New-Object Net.WebClient
  $ver = (Invoke-RestMethod "$base/versions.json" -UseBasicParsing)[-1].version
  if ($Prueba) { Say "[prueba] instalar $id $ver desde mods.windhawk.net"; return }
  $src = [Text.Encoding]::UTF8.GetString($wc.DownloadData("$base/$ver.wh.cpp"))

  $meta = @{ include = @(); exclude = @(); architecture = @() }
  $block = [regex]::Match($src, '(?ms)^//[ \t]+==WindhawkMod==[ \t]*$(.+?)^//[ \t]+==/WindhawkMod==').Groups[1].Value
  foreach ($line in $block -split "`n") {
    $m = [regex]::Match($line.TrimEnd(), '^//[ \t]+@(include|exclude|architecture)[ \t]+(.*)$')
    if ($m.Success) { $meta[$m.Groups[1].Value] += $m.Groups[2].Value.Trim() }
  }
  $subs = New-Object System.Collections.Generic.List[string]
  if ($meta.architecture.Count -eq 0) { $subs.Add("32"); $subs.Add("64") }
  foreach ($a in $meta.architecture) { if ($a -eq "x86") { $subs.Add("32") } elseif ($a -in "x86-64", "amd64") { $subs.Add("64") } }

  $dll = "{0}_{1}_{2}.dll" -f $id, $ver, (Get-Random -Minimum 100000 -Maximum 999999)
  foreach ($sub in ($subs | Select-Object -Unique)) {
    $dir = Join-Path $env:ProgramData "Windhawk\Engine\Mods\$sub"
    New-Item -ItemType Directory -Force $dir | Out-Null
    $wc.DownloadFile("$base/${ver}_$sub.dll", (Join-Path $dir $dll))
  }
  $srcDir = Join-Path $env:ProgramData "Windhawk\ModsSource"
  New-Item -ItemType Directory -Force $srcDir | Out-Null
  [IO.File]::WriteAllText((Join-Path $srcDir "$id.wh.cpp"), $src, (New-Object Text.UTF8Encoding $false))

  # Ajustes por defecto declarados por el mod (solo los valores simples de primer nivel)
  $defaults = [ordered]@{}
  $sblock = [regex]::Match($src, '(?ms)^//[ \t]+==WindhawkModSettings==[ \t]*$\s*/\*(.+?)\*/').Groups[1].Value
  foreach ($line in $sblock -split "`n") {
    $m = [regex]::Match($line.TrimEnd(), '^- ([A-Za-z_][\w]*): (.+)$')
    if (-not $m.Success -or $m.Groups[2].Value.StartsWith("[")) { continue }
    $v = $m.Groups[2].Value.Trim().Trim('"').Trim("'")
    if ($v -eq "true") { $defaults[$m.Groups[1].Value] = 1 }
    elseif ($v -eq "false") { $defaults[$m.Groups[1].Value] = 0 }
    elseif ($v -match '^-?\d+$') { $defaults[$m.Groups[1].Value] = [int]$v }
    else { $defaults[$m.Groups[1].Value] = $v }
  }

  $key = "$ModsKey\$id"
  New-Item $key -Force | Out-Null
  # Se crea apagado: el resto del instalador decide si se enciende.
  New-ItemProperty $key -Name Disabled -Value 1 -PropertyType DWord -Force | Out-Null
  New-ItemProperty $key -Name LibraryFileName -Value $dll -PropertyType String -Force | Out-Null
  New-ItemProperty $key -Name Include -Value ($meta.include -join "|") -PropertyType String -Force | Out-Null
  New-ItemProperty $key -Name Exclude -Value ($meta.exclude -join "|") -PropertyType String -Force | Out-Null
  New-ItemProperty $key -Name Architecture -Value ($meta.architecture -join "|") -PropertyType String -Force | Out-Null
  New-ItemProperty $key -Name Version -Value $ver -PropertyType String -Force | Out-Null
  New-Item "$key\Settings" -Force | Out-Null
  foreach ($k in $defaults.Keys) {
    $type = if ($defaults[$k] -is [int]) { "DWord" } else { "String" }
    New-ItemProperty "$key\Settings" -Name $k -Value $defaults[$k] -PropertyType $type -Force | Out-Null
  }
  Touch-Mod $id

  try {
    $pf = Join-Path $env:ProgramData "Windhawk\userprofile.json"
    $prof = if (Test-Path $pf) { Get-Content $pf -Raw | ConvertFrom-Json } else { New-Object psobject }
    if (-not $prof.mods) { $prof | Add-Member -NotePropertyName mods -NotePropertyValue (New-Object psobject) -Force }
    $prof.mods | Add-Member -NotePropertyName $id -NotePropertyValue ([pscustomobject]@{ version = $ver }) -Force
    [IO.File]::WriteAllText($pf, ($prof | ConvertTo-Json -Depth 10), (New-Object Text.UTF8Encoding $false))
  } catch { }
  Say "Mod instalado: $id $ver" Green
}

function Set-ModTheme($id, $values) {
  if (-not (Test-Mod $id)) { return }
  if ($Prueba) { Say "[prueba] $id <- $($values.Count) valores de estilo"; return }
  $s = "$ModsKey\$id\Settings"
  if (Test-Path $s) { Remove-Item $s -Recurse -Force }
  New-Item $s | Out-Null
  foreach ($k in $values.Keys) { New-ItemProperty $s -Name $k -Value $values[$k] -PropertyType String -Force | Out-Null }
  Touch-Mod $id
}

# --- Fondo de pantalla Antuan --------------------------------------------------
function New-UmbraWallpaper {
  Add-Type -AssemblyName System.Drawing, System.Windows.Forms
  $b = [Windows.Forms.Screen]::PrimaryScreen.Bounds
  $w = [Math]::Max(2560, $b.Width); $h = [int]($w * $b.Height / [Math]::Max(1, $b.Width))
  $dir = Join-Path $env:LOCALAPPDATA "UmbraOS"; New-Item -ItemType Directory -Force $dir | Out-Null
  $path = Join-Path $dir "umbra-fondo.png"
  $bmp = New-Object Drawing.Bitmap $w, $h
  $g = [Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = "HighQuality"
  $g.Clear([Drawing.Color]::FromArgb(7, 8, 11))
  $glows = @(
    @(0.20, 0.92, 0.62, 105, 72, 84, 196),
    @(0.88, 0.08, 0.48, 62, 28, 140, 150),
    @(0.62, 0.58, 0.38, 52, 124, 72, 196)
  )
  foreach ($q in $glows) {
    $cx = $w * $q[0]; $cy = $h * $q[1]; $r = $w * $q[2]
    $gp = New-Object Drawing.Drawing2D.GraphicsPath
    $gp.AddEllipse([single]($cx - $r), [single]($cy - $r * 0.85), [single]($r * 2), [single]($r * 1.7))
    $br = New-Object Drawing.Drawing2D.PathGradientBrush $gp
    $br.CenterPoint = New-Object Drawing.PointF ([single]$cx), ([single]$cy)
    $br.CenterColor = [Drawing.Color]::FromArgb($q[3], $q[4], $q[5], $q[6])
    $br.SurroundColors = @([Drawing.Color]::FromArgb(0, $q[4], $q[5], $q[6]))
    $blend = New-Object Drawing.Drawing2D.Blend
    $blend.Positions = [single[]]@(0, 0.35, 0.7, 1); $blend.Factors = [single[]]@(0, 0.35, 0.75, 1)
    $br.Blend = $blend
    $g.FillPath($br, $gp); $br.Dispose(); $gp.Dispose()
  }
  # Vineta
  $vp = New-Object Drawing.Drawing2D.GraphicsPath
  $vp.AddEllipse([single](-$w * 0.35), [single](-$h * 0.4), [single]($w * 1.7), [single]($h * 1.8))
  $vb = New-Object Drawing.Drawing2D.PathGradientBrush $vp
  $vb.CenterColor = [Drawing.Color]::FromArgb(0, 0, 0, 0)
  $vb.SurroundColors = @([Drawing.Color]::FromArgb(150, 0, 0, 0))
  $g.FillRectangle($vb, 0, 0, $w, $h)
  # Grano fino (evita bandas en los degradados)
  $n = New-Object Drawing.Bitmap 192, 192
  $rnd = New-Object Random 7
  for ($y = 0; $y -lt 192; $y++) { for ($x = 0; $x -lt 192; $x++) {
    $v = $rnd.Next(0, 256); $n.SetPixel($x, $y, [Drawing.Color]::FromArgb(9, $v, $v, $v))
  } }
  $tb = New-Object Drawing.TextureBrush $n
  $g.FillRectangle($tb, 0, 0, $w, $h)
  $g.Dispose(); $bmp.Save($path, [Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose()

  Set-ItemProperty "HKCU:\Control Panel\Desktop" -Name WallpaperStyle -Value "10"
  Set-ItemProperty "HKCU:\Control Panel\Desktop" -Name TileWallpaper -Value "0"
  $sig = '[DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern bool SystemParametersInfo(uint a, uint p, string v, uint f);'
  try {
    $api = Add-Type -MemberDefinition $sig -Name Wp -Namespace Umbra -PassThru
    [void]$api::SystemParametersInfo(0x14, 0, $path, 3)
  } catch {
    Set-ItemProperty "HKCU:\Control Panel\Desktop" -Name Wallpaper -Value $path
    Say "El fondo se vera tras cerrar sesion." DarkYellow
  }
  return $path
}

# --- Ajustes de Windows que acompanan al diseno ------------------------------
function Set-WindowsLook {
  $p = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize"
  Set-ItemProperty $p -Name AppsUseLightTheme -Value 0 -Type DWord
  Set-ItemProperty $p -Name SystemUsesLightTheme -Value 0 -Type DWord
  Set-ItemProperty $p -Name EnableTransparency -Value 1 -Type DWord
  $adv = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced"
  Set-ItemProperty $adv -Name TaskbarAl -Value 1 -Type DWord            # iconos centrados
  Set-ItemProperty $adv -Name ShowTaskViewButton -Value 0 -Type DWord   # menos ruido
  try { Set-ItemProperty $adv -Name TaskbarDa -Value 0 -Type DWord } catch { }   # widgets fuera
  $search = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Search"
  if (Test-Path $search) { Set-ItemProperty $search -Name SearchboxTaskbarMode -Value 1 -Type DWord }  # busqueda solo icono
}

# =============================================================================
Write-Host ""
Write-Host "  umbra" -ForegroundColor White
Write-Host ""

if (-not (Test-Path $ModsKey)) { Say "No encuentro Windhawk. Instalalo desde windhawk.net y vuelve a ejecutar." Red; exit 1 }

if (-not $Restaurar) {
  foreach ($id in @($TaskbarStyler, $StartStyler, $OnTop, $Vertical)) {
    try { Install-WindhawkMod $id } catch { Say "No se pudo instalar $id : $($_.Exception.Message)" Red }
  }
}

if ($Restaurar) {
  Set-ModEnabled $TaskbarStyler $false
  Set-ModEnabled $StartStyler $false
  Set-ModEnabled $OnTop $false
  Set-ModEnabled $Vertical $false
  Set-ModSetting $DockAnim "MirrorForTopTaskbar" 0
  Say "Windows original restaurado (los mods quedan instalados pero apagados)." Green
} else {
  # 1. Estilo
  Set-ModTheme $TaskbarStyler (Read-Theme @("$Temas\barra-$Estilo.yaml", "$Temas\barra-base.yaml"))
  Set-ModEnabled $TaskbarStyler $true
  Set-ModTheme $StartStyler (Read-Theme @("$Temas\inicio-$Estilo.yaml", "$Temas\inicio-base.yaml"))
  Set-ModEnabled $StartStyler $true
  if ((Test-Mod $TaskbarStyler) -or (Test-Mod $StartStyler)) { Say "Estilo Antuan $Estilo aplicado a barra, bandeja, Alt+Tab, vistas previas e inicio." Green }

  # 2. Posicion (se apaga primero el mod que sobra para que nunca coincidan)
  if ($Posicion -ne "top") { Set-ModEnabled $OnTop $false }
  if ($Posicion -notin "left", "right") { Set-ModEnabled $Vertical $false }
  if ($Posicion -eq "top") { Set-ModSetting $OnTop "taskbarLocation" "top"; Set-ModEnabled $OnTop $true }
  if ($Posicion -in "left", "right") {
    Set-ModSetting $Vertical "taskbarLocation" $Posicion
    Set-ModSetting $Vertical "TaskbarWidth" 64
    Set-ModEnabled $Vertical $true
  }
  Set-ModSetting $DockAnim "MirrorForTopTaskbar" ([int]($Posicion -eq "top"))
  Say "Barra de tareas: $Posicion." Green

  # 3. Windows en oscuro, ordenado
  if (-not $SinAjustesWindows) {
    if ($Prueba) { Say "[prueba] modo oscuro, transparencias, iconos centrados, sin widgets ni vista de tareas" }
    else { Set-WindowsLook; Say "Modo oscuro, transparencias y barra limpia." Green }
  }

  # 4. Fondo
  if (-not $SinFondo) {
    if ($Prueba) { Say "[prueba] generar fondo Antuan" }
    else { $wp = New-UmbraWallpaper; Say "Fondo Antuan: $wp" Green }
  }
}

if (-not $Prueba) {
  # Sin reinicios: Windhawk aplica los mods en caliente. Solo se avisa a las apps del cambio de tema.
  try {
    $sig = '[DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern IntPtr SendMessageTimeout(IntPtr h, uint m, UIntPtr w, string l, uint f, uint t, out UIntPtr r);'
    $api = Add-Type -MemberDefinition $sig -Name Bc -Namespace Umbra -PassThru
    $r = [UIntPtr]::Zero
    [void]$api::SendMessageTimeout([IntPtr]0xffff, 0x1A, [UIntPtr]::Zero, "ImmersiveColorSet", 2, 3000, [ref]$r)
  } catch { }
  if ($ReiniciarBarra) {
    Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 1200
    if (-not (Get-Process explorer -ErrorAction SilentlyContinue)) { Start-Process explorer.exe }
  }
  Write-Host ""
  Say "Listo. A partir de ahora Windows arranca asi solo." White
  Write-Host ""
  if (-not $SinPausa) { Read-Host "  Pulsa Enter para cerrar" | Out-Null }
}
