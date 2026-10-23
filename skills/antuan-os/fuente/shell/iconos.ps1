# Extrae iconos a 256 px con transparencia, tal como los dibuja el Explorador.
# Entrada (stdin): lineas "salida.png|ruta" (ruta = exe, lnk, carpeta, archivo o shell:AppsFolder\AUMID).
$ErrorActionPreference = "SilentlyContinue"
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class UmbraIconos {
  [ComImport, Guid("bcc18b79-ba16-442f-80c4-8a59c30c463b"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IShellItemImageFactory { [PreserveSig] int GetImage(SIZE size, int flags, out IntPtr phbm); }
  [StructLayout(LayoutKind.Sequential)] struct SIZE { public int cx, cy; public SIZE(int x, int y) { cx = x; cy = y; } }
  [DllImport("shell32.dll", CharSet = CharSet.Unicode, PreserveSig = false)]
  static extern void SHCreateItemFromParsingName(string path, IntPtr pbc, [MarshalAs(UnmanagedType.LPStruct)] Guid riid, [MarshalAs(UnmanagedType.Interface)] out IShellItemImageFactory item);
  [DllImport("gdi32.dll")] static extern bool DeleteObject(IntPtr h);

  public static bool Guardar(string ruta, string salida, int tam) {
    IShellItemImageFactory f;
    SHCreateItemFromParsingName(ruta, IntPtr.Zero, typeof(IShellItemImageFactory).GUID, out f);
    IntPtr hbm;
    // SIIGBF_ICONONLY (0x4) | SIIGBF_BIGGERSIZEOK (0x1)
    if (f.GetImage(new SIZE(tam, tam), 0x5, out hbm) != 0) return false;
    try {
      using (Bitmap src = Image.FromHbitmap(hbm)) {
        Rectangle r = new Rectangle(0, 0, src.Width, src.Height);
        BitmapData d = src.LockBits(r, ImageLockMode.ReadOnly, src.PixelFormat);
        try {
          using (Bitmap argb = new Bitmap(d.Width, d.Height, d.Stride, PixelFormat.Format32bppArgb, d.Scan0))
          using (Bitmap copia = new Bitmap(argb)) { copia.Save(salida, ImageFormat.Png); }
        } finally { src.UnlockBits(d); }
      }
      return true;
    } finally { DeleteObject(hbm); }
  }
}
"@

while ($true) {
  $line = [Console]::In.ReadLine()
  if ($null -eq $line) { break }
  $p = $line.Split("|", 2)
  $ok = $false
  try { $ok = [UmbraIconos]::Guardar($p[1], $p[0], 256) } catch { }
  [Console]::Out.WriteLine($(if ($ok) { "ok " } else { "no " }) + $p[0])
  [Console]::Out.Flush()
}
