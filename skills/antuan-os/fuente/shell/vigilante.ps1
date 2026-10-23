# Vigilante de Antuan.
# - Si Antuan se cierra bien (deja la marca de salida limpia): devuelve la barra de Windows.
# - Si Antuan se cae: lo vuelve a abrir en un segundo (maximo 3 veces en 2 minutos).
param([int]$ProcesoId, [int]$AutoOcultar = 0, [string]$Electron = "", [string]$App = "", [string]$Marca = "")
try { Wait-Process -Id $ProcesoId -ErrorAction Stop } catch { }
Start-Sleep -Milliseconds 700

$limpia = $Marca -and (Test-Path $Marca)
if ($limpia) { Remove-Item $Marca -Force -ErrorAction SilentlyContinue }

if (-not $limpia -and $Electron -and (Test-Path $Electron)) {
  $hist = Join-Path (Split-Path $Marca) "caidas.txt"
  $ahora = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
  $recientes = @()
  if (Test-Path $hist) { $recientes = @(Get-Content $hist | Where-Object { $_ -match '^\d+$' -and ($ahora - [int64]$_) -lt 120 }) }
  if ($recientes.Count -lt 3) {
    ($recientes + $ahora) | Set-Content $hist
    if ($App) { Start-Process -FilePath $Electron -ArgumentList "`"$App`"" -WorkingDirectory $App }
    else { Start-Process -FilePath $Electron }
    return
  }
}

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class UmbraBarra {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int l, t, r, b; }
  [StructLayout(LayoutKind.Sequential)] public struct APPBARDATA { public int cbSize; public IntPtr hWnd; public uint msg; public uint edge; public RECT rc; public IntPtr lParam; }
  [DllImport("shell32.dll")] static extern IntPtr SHAppBarMessage(uint m, ref APPBARDATA d);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern IntPtr FindWindowW(string c, string n);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern IntPtr FindWindowExW(IntPtr p, IntPtr a, string c, string n);
  [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h, int c);
  public static void Restaurar(bool autoOcultar) {
    IntPtr tray = FindWindowW("Shell_TrayWnd", null);
    if (tray == IntPtr.Zero) return;
    var d = new APPBARDATA(); d.cbSize = Marshal.SizeOf(d); d.hWnd = tray; d.lParam = (IntPtr)(autoOcultar ? 1 : 0);
    SHAppBarMessage(10, ref d);
    ShowWindow(tray, 5);
    IntPtr h = IntPtr.Zero;
    while ((h = FindWindowExW(IntPtr.Zero, h, "Shell_SecondaryTrayWnd", null)) != IntPtr.Zero) ShowWindow(h, 5);
  }
}
"@
[UmbraBarra]::Restaurar($AutoOcultar -eq 1)
