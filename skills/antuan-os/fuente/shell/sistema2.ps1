# Ayudante de Antuan Shell (v2): audio, brillo, multimedia, energia, bateria, privacidad y pantalla.
# Proceso persistente: lee ordenes por stdin (una por linea) y responde SIEMPRE una linea JSON por orden.
# Errores: {"ok":false,"error":"..."}
#
# Ordenes:
#   ping                         -> {"ok":true}
#   vol?                         -> {"ok":true,"level":0-100,"muted":bool}
#   vol N                        -> {"ok":true,"level":N,"muted":bool}
#   mute 0|1                     -> {"ok":true,"level":N,"muted":bool}
#   bri?                         -> {"ok":true,"level":N}   (-1 si no hay control de brillo)
#   bri N                        -> {"ok":true,"level":N}
#   apps-audio?                  -> {"ok":true,"sessions":[{"pid","name","exe","level","muted","active","system"}]}
#   app-vol PID N                -> {"ok":true,"count":sesionesCambiadas}
#   app-mute PID 0|1             -> {"ok":true,"count":sesionesCambiadas}
#   outputs?                     -> {"ok":true,"devices":[{"id","name","default"}]}
#   output-set <idBase64>        -> {"ok":true}   (id en base64 UTF-8; tambien se acepta el id tal cual si empieza por "{")
#   media?                       -> {"ok":true,"app","title","artist","album","playing","position","duration","cover"} o {"ok":true,"none":true}
#   media-cmd play|pause|toggle|next|prev -> {"ok":true,"done":bool}
#   power?                       -> {"ok":true,"mode":"eficiencia"|"equilibrado"|"rendimiento"|"desconocido","guid":"...","ac":bool}
#   power-set eficiencia|equilibrado|rendimiento -> {"ok":true,"mode":...}
#   battery?                     -> {"ok":true,"present":bool,"percent":N,"charging":bool,"ac":bool,"designMWh":N|null,"fullMWh":N|null,"health":N|null}
#   privacy?                     -> {"ok":true,"webcam":[...],"microphone":[...],"location":[...]}
#   refresh?                     -> {"ok":true,"current":Hz,"max":Hz,"width":N,"height":N}
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [Text.Encoding]::UTF8
try { [Console]::InputEncoding = [Text.Encoding]::UTF8 } catch {}

Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

namespace Umbra {

[StructLayout(LayoutKind.Sequential)] public struct PropKey { public Guid fmtid; public int pid; }
[StructLayout(LayoutKind.Sequential)] public struct PropVar { public ushort vt; public ushort r1; public ushort r2; public ushort r3; public IntPtr p; public IntPtr p2; }

[ComImport, Guid("886d8eeb-8cf2-4446-8d02-cdba1dbdcf99"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IPropertyStore {
  [PreserveSig] int GetCount(out int c);
  [PreserveSig] int GetAt(int i, out PropKey k);
  [PreserveSig] int GetValue(ref PropKey k, out PropVar v);
  [PreserveSig] int SetValue(ref PropKey k, ref PropVar v);
  [PreserveSig] int Commit();
}

[ComImport, Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioEndpointVolume {
  [PreserveSig] int RegisterControlChangeNotify(IntPtr n);
  [PreserveSig] int UnregisterControlChangeNotify(IntPtr n);
  [PreserveSig] int GetChannelCount(out int c);
  [PreserveSig] int SetMasterVolumeLevel(float db, ref Guid ctx);
  [PreserveSig] int SetMasterVolumeLevelScalar(float level, ref Guid ctx);
  [PreserveSig] int GetMasterVolumeLevel(out float db);
  [PreserveSig] int GetMasterVolumeLevelScalar(out float level);
  [PreserveSig] int SetChannelVolumeLevel(int ch, float db, ref Guid ctx);
  [PreserveSig] int SetChannelVolumeLevelScalar(int ch, float l, ref Guid ctx);
  [PreserveSig] int GetChannelVolumeLevel(int ch, out float db);
  [PreserveSig] int GetChannelVolumeLevelScalar(int ch, out float l);
  [PreserveSig] int SetMute([MarshalAs(UnmanagedType.Bool)] bool mute, ref Guid ctx);
  [PreserveSig] int GetMute([MarshalAs(UnmanagedType.Bool)] out bool mute);
}

[ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDevice {
  [PreserveSig] int Activate(ref Guid iid, int ctx, IntPtr p, [MarshalAs(UnmanagedType.IUnknown)] out object o);
  [PreserveSig] int OpenPropertyStore(int access, out IPropertyStore ps);
  [PreserveSig] int GetId([MarshalAs(UnmanagedType.LPWStr)] out string id);
  [PreserveSig] int GetState(out int s);
}

[ComImport, Guid("0BD7A1BE-7A1A-44DB-8397-CC5392387B5E"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceCollection {
  [PreserveSig] int GetCount(out int c);
  [PreserveSig] int Item(int i, out IMMDevice d);
}

[ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceEnumerator {
  [PreserveSig] int EnumAudioEndpoints(int flow, int mask, out IMMDeviceCollection c);
  [PreserveSig] int GetDefaultAudioEndpoint(int flow, int role, out IMMDevice dev);
  [PreserveSig] int GetDevice([MarshalAs(UnmanagedType.LPWStr)] string id, out IMMDevice dev);
  [PreserveSig] int RegisterEndpointNotificationCallback(IntPtr c);
  [PreserveSig] int UnregisterEndpointNotificationCallback(IntPtr c);
}
[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class MMDeviceEnumeratorCom { }

[ComImport, Guid("87CE5498-68D6-44E5-9215-6DA47EF883D8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface ISimpleAudioVolume {
  [PreserveSig] int SetMasterVolume(float l, ref Guid ctx);
  [PreserveSig] int GetMasterVolume(out float l);
  [PreserveSig] int SetMute([MarshalAs(UnmanagedType.Bool)] bool m, ref Guid ctx);
  [PreserveSig] int GetMute([MarshalAs(UnmanagedType.Bool)] out bool m);
}

[ComImport, Guid("bfb7ff88-7239-4fc9-8fa2-07c950be9c6d"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioSessionControl2 {
  [PreserveSig] int GetState(out int s);
  [PreserveSig] int GetDisplayName([MarshalAs(UnmanagedType.LPWStr)] out string n);
  [PreserveSig] int SetDisplayName([MarshalAs(UnmanagedType.LPWStr)] string n, ref Guid ctx);
  [PreserveSig] int GetIconPath([MarshalAs(UnmanagedType.LPWStr)] out string p);
  [PreserveSig] int SetIconPath([MarshalAs(UnmanagedType.LPWStr)] string p, ref Guid ctx);
  [PreserveSig] int GetGroupingParam(out Guid g);
  [PreserveSig] int SetGroupingParam(ref Guid g, ref Guid ctx);
  [PreserveSig] int RegisterAudioSessionNotification(IntPtr n);
  [PreserveSig] int UnregisterAudioSessionNotification(IntPtr n);
  [PreserveSig] int GetSessionIdentifier([MarshalAs(UnmanagedType.LPWStr)] out string s);
  [PreserveSig] int GetSessionInstanceIdentifier([MarshalAs(UnmanagedType.LPWStr)] out string s);
  [PreserveSig] int GetProcessId(out uint pid);
  [PreserveSig] int IsSystemSoundsSession();
  [PreserveSig] int SetDuckingPreference([MarshalAs(UnmanagedType.Bool)] bool o);
}

[ComImport, Guid("E2F5BB11-0570-40CA-ACDD-3AA01277DEE8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioSessionEnumerator {
  [PreserveSig] int GetCount(out int c);
  [PreserveSig] int GetSession(int i, out IAudioSessionControl2 s);
}

[ComImport, Guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioSessionManager2 {
  [PreserveSig] int GetAudioSessionControl(IntPtr g, int f, out IntPtr c);
  [PreserveSig] int GetSimpleAudioVolume(IntPtr g, int f, out IntPtr v);
  [PreserveSig] int GetSessionEnumerator(out IAudioSessionEnumerator e);
  [PreserveSig] int RegisterSessionNotification(IntPtr n);
  [PreserveSig] int UnregisterSessionNotification(IntPtr n);
  [PreserveSig] int RegisterDuckNotification([MarshalAs(UnmanagedType.LPWStr)] string id, IntPtr n);
  [PreserveSig] int UnregisterDuckNotification(IntPtr n);
}

[ComImport, Guid("f8679f50-850a-41cf-9c72-430f290290c8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IPolicyConfig {
  [PreserveSig] int GetMixFormat(); [PreserveSig] int GetDeviceFormat(); [PreserveSig] int ResetDeviceFormat();
  [PreserveSig] int SetDeviceFormat(); [PreserveSig] int GetProcessingPeriod(); [PreserveSig] int SetProcessingPeriod();
  [PreserveSig] int GetShareMode(); [PreserveSig] int SetShareMode(); [PreserveSig] int GetPropertyValue();
  [PreserveSig] int SetPropertyValue();
  [PreserveSig] int SetDefaultEndpoint([MarshalAs(UnmanagedType.LPWStr)] string id, int role);
  [PreserveSig] int SetEndpointVisibility([MarshalAs(UnmanagedType.LPWStr)] string id, int visible);
}
[ComImport, Guid("870af99c-171d-4f9e-af0d-e63df40c2bc9")] class PolicyConfigCom { }

public class AudioSession {
  public int Pid; public string DisplayName; public string Exe; public int Level; public bool Muted; public bool Active; public bool System;
}
public class AudioDevice { public string Id; public string Name; public bool IsDefault; }

[StructLayout(LayoutKind.Sequential)]
public struct SystemPowerStatus { public byte ACLineStatus; public byte BatteryFlag; public byte BatteryLifePercent; public byte SystemStatusFlag; public int BatteryLifeTime; public int BatteryFullLifeTime; }

[StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
public struct DevMode {
  [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string dmDeviceName;
  public short dmSpecVersion; public short dmDriverVersion; public short dmSize; public short dmDriverExtra;
  public int dmFields; public int dmPositionX; public int dmPositionY; public int dmDisplayOrientation; public int dmDisplayFixedOutput;
  public short dmColor; public short dmDuplex; public short dmYResolution; public short dmTTOption; public short dmCollate;
  [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string dmFormName;
  public short dmLogPixels; public int dmBitsPerPel; public int dmPelsWidth; public int dmPelsHeight;
  public int dmDisplayFlags; public int dmDisplayFrequency; public int dmICMMethod; public int dmICMIntent;
  public int dmMediaType; public int dmDitherType; public int dmReserved1; public int dmReserved2;
  public int dmPanningWidth; public int dmPanningHeight;
}

public static class Native {
  [DllImport("ole32.dll")] public static extern int PropVariantClear(ref PropVar v);
  [DllImport("kernel32.dll")] public static extern IntPtr OpenProcess(int access, bool inherit, int pid);
  [DllImport("kernel32.dll")] public static extern bool CloseHandle(IntPtr h);
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] public static extern bool QueryFullProcessImageName(IntPtr h, int flags, StringBuilder sb, ref int size);
  [DllImport("kernel32.dll")] public static extern bool GetSystemPowerStatus(out SystemPowerStatus s);
  [DllImport("powrprof.dll")] public static extern uint PowerGetEffectiveOverlayScheme(out Guid g);
  [DllImport("powrprof.dll")] public static extern uint PowerSetActiveOverlayScheme(Guid g);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern bool EnumDisplaySettings(string dev, int mode, ref DevMode dm);

  public static string ExePath(int pid) {
    IntPtr h = OpenProcess(0x1000, false, pid);
    if (h == IntPtr.Zero) return null;
    try {
      StringBuilder sb = new StringBuilder(1024); int n = sb.Capacity;
      if (QueryFullProcessImageName(h, 0, sb, ref n)) return sb.ToString();
      return null;
    } finally { CloseHandle(h); }
  }

  public static int[] Refresh() {
    DevMode dm = new DevMode(); dm.dmSize = (short)Marshal.SizeOf(typeof(DevMode));
    if (!EnumDisplaySettings(null, -1, ref dm)) return null;
    int cur = dm.dmDisplayFrequency, w = dm.dmPelsWidth, h = dm.dmPelsHeight, max = cur;
    for (int i = 0; i < 10000; i++) {
      DevMode m = new DevMode(); m.dmSize = (short)Marshal.SizeOf(typeof(DevMode));
      if (!EnumDisplaySettings(null, i, ref m)) break;
      if (m.dmPelsWidth == w && m.dmPelsHeight == h && m.dmDisplayFrequency > max) max = m.dmDisplayFrequency;
    }
    return new int[] { cur, max, w, h };
  }
}

public static class Audio {
  static Guid IID_EndpointVolume = new Guid("5CDF2C82-841E-4546-9722-0CF74078229A");
  static Guid IID_SessionManager2 = new Guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F");

  static IMMDeviceEnumerator Enum() { return (IMMDeviceEnumerator)(new MMDeviceEnumeratorCom()); }
  static IMMDevice DefaultDev() {
    IMMDevice d; Marshal.ThrowExceptionForHR(Enum().GetDefaultAudioEndpoint(0, 1, out d)); return d;
  }
  static IAudioEndpointVolume Vol() {
    object o; Guid id = IID_EndpointVolume;
    Marshal.ThrowExceptionForHR(DefaultDev().Activate(ref id, 23, IntPtr.Zero, out o));
    return (IAudioEndpointVolume)o;
  }
  public static int Get() { float f; Marshal.ThrowExceptionForHR(Vol().GetMasterVolumeLevelScalar(out f)); return (int)Math.Round(f * 100); }
  public static void Set(int v) { Guid g = Guid.Empty; Marshal.ThrowExceptionForHR(Vol().SetMasterVolumeLevelScalar(Math.Max(0, Math.Min(100, v)) / 100f, ref g)); }
  public static bool Muted() { bool m; Marshal.ThrowExceptionForHR(Vol().GetMute(out m)); return m; }
  public static void Mute(bool m) { Guid g = Guid.Empty; Marshal.ThrowExceptionForHR(Vol().SetMute(m, ref g)); }

  static List<IAudioSessionControl2> Sessions() {
    List<IAudioSessionControl2> r = new List<IAudioSessionControl2>();
    object o; Guid id = IID_SessionManager2;
    Marshal.ThrowExceptionForHR(DefaultDev().Activate(ref id, 23, IntPtr.Zero, out o));
    IAudioSessionManager2 mgr = (IAudioSessionManager2)o;
    IAudioSessionEnumerator en; Marshal.ThrowExceptionForHR(mgr.GetSessionEnumerator(out en));
    int n; en.GetCount(out n);
    for (int i = 0; i < n; i++) { IAudioSessionControl2 s; if (en.GetSession(i, out s) == 0 && s != null) r.Add(s); }
    return r;
  }

  public static List<AudioSession> ListSessions() {
    List<AudioSession> r = new List<AudioSession>();
    foreach (IAudioSessionControl2 s in Sessions()) {
      int state; s.GetState(out state);
      if (state == 2) continue; // expirada
      uint pid; s.GetProcessId(out pid);
      AudioSession a = new AudioSession();
      a.Pid = (int)pid; a.Active = state == 1; a.System = s.IsSystemSoundsSession() == 0;
      string dn = null; s.GetDisplayName(out dn); a.DisplayName = dn;
      ISimpleAudioVolume v = s as ISimpleAudioVolume;
      if (v != null) { float l; bool m; v.GetMasterVolume(out l); v.GetMute(out m); a.Level = (int)Math.Round(l * 100); a.Muted = m; }
      if (!a.System && pid != 0) a.Exe = Native.ExePath((int)pid);
      r.Add(a);
    }
    return r;
  }

  public static int SetApp(int pid, int level, int mute) {
    int c = 0;
    foreach (IAudioSessionControl2 s in Sessions()) {
      uint p; s.GetProcessId(out p);
      if ((int)p != pid) continue;
      ISimpleAudioVolume v = s as ISimpleAudioVolume; if (v == null) continue;
      Guid g = Guid.Empty;
      if (level >= 0) Marshal.ThrowExceptionForHR(v.SetMasterVolume(Math.Max(0, Math.Min(100, level)) / 100f, ref g));
      if (mute >= 0) Marshal.ThrowExceptionForHR(v.SetMute(mute == 1, ref g));
      c++;
    }
    return c;
  }

  public static List<AudioDevice> Outputs() {
    List<AudioDevice> r = new List<AudioDevice>();
    IMMDeviceEnumerator e = Enum();
    string def = null;
    IMMDevice dd; if (e.GetDefaultAudioEndpoint(0, 1, out dd) == 0 && dd != null) dd.GetId(out def);
    IMMDeviceCollection col; Marshal.ThrowExceptionForHR(e.EnumAudioEndpoints(0, 1, out col));
    int n; col.GetCount(out n);
    PropKey fn = new PropKey(); fn.fmtid = new Guid("a45c254e-df1c-4efd-8020-67d146a850e0"); fn.pid = 14;
    for (int i = 0; i < n; i++) {
      IMMDevice d; if (col.Item(i, out d) != 0 || d == null) continue;
      AudioDevice a = new AudioDevice(); string id; d.GetId(out id); a.Id = id; a.IsDefault = id == def;
      IPropertyStore ps;
      if (d.OpenPropertyStore(0, out ps) == 0 && ps != null) {
        PropVar pv;
        if (ps.GetValue(ref fn, out pv) == 0) {
          if (pv.vt == 31 && pv.p != IntPtr.Zero) a.Name = Marshal.PtrToStringUni(pv.p);
          Native.PropVariantClear(ref pv);
        }
      }
      if (a.Name == null) a.Name = id;
      r.Add(a);
    }
    return r;
  }

  public static void SetDefault(string id) {
    IPolicyConfig pc = (IPolicyConfig)(new PolicyConfigCom());
    for (int role = 0; role < 3; role++) Marshal.ThrowExceptionForHR(pc.SetDefaultEndpoint(id, role));
  }
}
}
"@

# ---------- utilidades ----------
function Send($obj) {
  [Console]::Out.WriteLine((ConvertTo-Json -InputObject $obj -Compress -Depth 6))
  [Console]::Out.Flush()
}
function Ok([hashtable]$h) { $o = [ordered]@{ ok = $true }; if ($h) { foreach ($k in $h.Keys) { $o[$k] = $h[$k] } }; return $o }
function Arr($x) { if ($null -eq $x) { return ,@() }; return ,@($x) }

# ---------- brillo ----------
function Get-Bri {
  try {
    $b = Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightness -ErrorAction Stop | Select-Object -First 1
    if ($b) { return [int]$b.CurrentBrightness }
  } catch {}
  return -1
}
function Set-Bri([int]$v) {
  $v = [Math]::Max(0, [Math]::Min(100, $v))
  $m = Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightnessMethods -ErrorAction Stop | Select-Object -First 1
  if (-not $m) { throw "Sin control de brillo" }
  Invoke-CimMethod -InputObject $m -MethodName WmiSetBrightness -Arguments @{ Timeout = [uint32]1; Brightness = [byte]$v } -ErrorAction Stop | Out-Null
}

# ---------- audio por app ----------
function Get-AppsAudio {
  $byPid = [ordered]@{}
  foreach ($s in [Umbra.Audio]::ListSessions()) {
    $key = if ($s.System) { "sys" } else { [string]$s.Pid }
    if ($byPid.Contains($key)) {
      $e = $byPid[$key]
      if ($s.Active -and -not $e.active) { $e.active = $true; $e.level = $s.Level; $e.muted = $s.Muted }
      continue
    }
    $name = $null
    if ($s.System) { $name = "Sonidos del sistema" }
    else {
      if ($s.DisplayName -and -not $s.DisplayName.StartsWith("@")) { $name = $s.DisplayName }
      if (-not $name -and $s.Exe) {
        try { $fd = [Diagnostics.FileVersionInfo]::GetVersionInfo($s.Exe).FileDescription; if ($fd) { $name = $fd.Trim() } } catch {}
      }
      if (-not $name) { try { $name = (Get-Process -Id $s.Pid -ErrorAction Stop).ProcessName } catch {} }
      if (-not $name -and $s.Exe) { $name = [IO.Path]::GetFileNameWithoutExtension($s.Exe) }
      if (-not $name) { $name = "pid " + $s.Pid }
    }
    $byPid[$key] = [ordered]@{ pid = $s.Pid; name = $name; exe = $s.Exe; level = $s.Level; muted = $s.Muted; active = $s.Active; system = $s.System }
  }
  return ,@($byPid.Values)
}

# ---------- multimedia (WinRT) ----------
$script:mediaMgr = $null
$script:asTaskOp = $null
$script:asTaskAction = $null
function Init-WinRT {
  if ($script:asTaskOp) { return }
  Add-Type -AssemblyName System.Runtime.WindowsRuntime
  $null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
  $null = [Windows.Storage.Streams.IRandomAccessStreamWithContentType, Windows.Storage.Streams, ContentType = WindowsRuntime]
  $ms = [System.WindowsRuntimeSystemExtensions].GetMethods()
  $script:asTaskOp = $ms | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' } | Select-Object -First 1
  $script:asTaskAction = $ms | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncAction' } | Select-Object -First 1
}
function Await($op, [Type]$t) {
  $task = $script:asTaskOp.MakeGenericMethod($t).Invoke($null, @($op))
  if (-not $task.Wait(5000)) { throw "Tiempo de espera agotado (WinRT)" }
  return $task.Result
}
function Get-MediaMgr {
  Init-WinRT
  if (-not $script:mediaMgr) {
    $script:mediaMgr = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
  }
  return $script:mediaMgr
}
function Get-Hash([string]$s) {
  $sha = [Security.Cryptography.SHA1]::Create()
  $b = $sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($s))
  return ([BitConverter]::ToString($b) -replace '-', '').Substring(0, 16).ToLower()
}
function Save-Cover($props, [string]$key) {
  if (-not $props.Thumbnail) { return $null }
  $path = Join-Path $env:TEMP ("umbra-portada-" + (Get-Hash $key) + ".png")
  if (Test-Path -LiteralPath $path) { return $path }
  $stream = Await ($props.Thumbnail.OpenReadAsync()) ([Windows.Storage.Streams.IRandomAccessStreamWithContentType])
  try {
    $net = [System.IO.WindowsRuntimeStreamExtensions]::AsStreamForRead($stream)
    $mem = New-Object IO.MemoryStream
    $net.CopyTo($mem)
    $bytes = $mem.ToArray()
  } finally { try { $stream.Dispose() } catch {} }
  if (-not $bytes -or $bytes.Length -eq 0) { return $null }
  # borra portadas antiguas para no llenar %TEMP%
  Get-ChildItem -Path $env:TEMP -Filter "umbra-portada-*.png" -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
  $tmp = $path + ".tmp"
  try {
    Add-Type -AssemblyName System.Drawing
    $img = [System.Drawing.Image]::FromStream((New-Object IO.MemoryStream(, $bytes)))
    $img.Save($tmp, [System.Drawing.Imaging.ImageFormat]::Png); $img.Dispose()
  } catch { [IO.File]::WriteAllBytes($tmp, $bytes) }
  Move-Item -LiteralPath $tmp -Destination $path -Force
  return $path
}
function Get-Media {
  $s = (Get-MediaMgr).GetCurrentSession()
  if (-not $s) { return Ok @{ none = $true } }
  $props = Await ($s.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
  $pb = $s.GetPlaybackInfo()
  $tl = $s.GetTimelineProperties()
  $playing = [string]$pb.PlaybackStatus -eq "Playing"
  $pos = $tl.Position.TotalSeconds
  $dur = ($tl.EndTime - $tl.StartTime).TotalSeconds
  if ($playing -and $tl.LastUpdatedTime.Year -gt 2000) {
    $rate = 1.0; if ($pb.PlaybackRate) { $rate = [double]$pb.PlaybackRate }
    $pos += ([DateTimeOffset]::Now - $tl.LastUpdatedTime).TotalSeconds * $rate
  }
  if ($dur -gt 0 -and $pos -gt $dur) { $pos = $dur }
  if ($pos -lt 0) { $pos = 0 }
  $app = $s.SourceAppUserModelId
  $cover = $null
  try { $cover = Save-Cover $props ("$app|$($props.Title)|$($props.Artist)|$($props.AlbumTitle)") } catch { $cover = $null }
  return Ok @{
    app = $app; title = [string]$props.Title; artist = [string]$props.Artist; album = [string]$props.AlbumTitle
    playing = $playing; position = [Math]::Round($pos, 1); duration = [Math]::Round($dur, 1); cover = $cover
  }
}
function Invoke-MediaCmd([string]$c) {
  $s = (Get-MediaMgr).GetCurrentSession()
  if (-not $s) { throw "No hay sesion multimedia" }
  $op = switch ($c) {
    "play"   { $s.TryPlayAsync() }
    "pause"  { $s.TryPauseAsync() }
    "toggle" { $s.TryTogglePlayPauseAsync() }
    "next"   { $s.TrySkipNextAsync() }
    "prev"   { $s.TrySkipPreviousAsync() }
    default  { throw "Comando multimedia desconocido: $c" }
  }
  return [bool](Await $op ([bool]))
}

# ---------- energia ----------
$PowerModes = [ordered]@{
  eficiencia  = [Guid]"961cc777-2547-4f9d-8174-7d86181b8a7a"
  equilibrado = [Guid]"00000000-0000-0000-0000-000000000000"
  rendimiento = [Guid]"ded574b5-45a0-4f42-8737-46345c09c238"
}
function Get-PowerStatus { $st = New-Object Umbra.SystemPowerStatus; [void][Umbra.Native]::GetSystemPowerStatus([ref]$st); return $st }
function Get-Power {
  $g = [Guid]::Empty
  $r = [Umbra.Native]::PowerGetEffectiveOverlayScheme([ref]$g)
  if ($r -ne 0) { throw "PowerGetEffectiveOverlayScheme fallo ($r)" }
  $mode = "desconocido"
  foreach ($k in $PowerModes.Keys) { if ($PowerModes[$k] -eq $g) { $mode = $k } }
  $st = Get-PowerStatus
  return Ok @{ mode = $mode; guid = $g.ToString(); ac = ($st.ACLineStatus -eq 1) }
}
function Set-Power([string]$m) {
  if (-not $PowerModes.Contains($m)) { throw "Modo desconocido: $m" }
  $r = [Umbra.Native]::PowerSetActiveOverlayScheme($PowerModes[$m])
  if ($r -ne 0) { throw "PowerSetActiveOverlayScheme fallo ($r)" }
  return Get-Power
}

# ---------- bateria ----------
function Get-Battery {
  $st = Get-PowerStatus
  $present = -not (($st.BatteryFlag -band 128) -or $st.BatteryFlag -eq 255)
  $pct = if ($st.BatteryLifePercent -le 100) { [int]$st.BatteryLifePercent } else { -1 }
  $design = $null; $full = $null; $health = $null
  if ($present) {
    try { $design = [long](Get-CimInstance -Namespace root/wmi -ClassName BatteryStaticData -ErrorAction Stop | Select-Object -First 1).DesignedCapacity } catch {}
    try { $full = [long](Get-CimInstance -Namespace root/wmi -ClassName BatteryFullChargedCapacity -ErrorAction Stop | Select-Object -First 1).FullChargedCapacity } catch {}
    if ($design -le 0 -or $full -le 0) {
      # Respaldo sin admin: informe de bateria de powercfg (lento, ~1 s; se cachea 10 min)
      if (-not $script:batReportTime -or ((Get-Date) - $script:batReportTime).TotalMinutes -gt 10) {
        $script:batReport = $null
        try {
          $f = Join-Path $env:TEMP ("umbra-bateria-" + $PID + ".xml")
          & powercfg.exe /batteryreport /xml /output $f 2>&1 | Out-Null
          if (Test-Path -LiteralPath $f) {
            $b = @(([xml](Get-Content -LiteralPath $f -Raw)).BatteryReport.Batteries.Battery)[0]
            Remove-Item -LiteralPath $f -Force -ErrorAction SilentlyContinue
            if ($b) { $script:batReport = @{ design = [long]$b.DesignCapacity; full = [long]$b.FullChargeCapacity } }
          }
        } catch {}
        $script:batReportTime = Get-Date
      }
      if ($script:batReport) {
        if ($design -le 0) { $design = $script:batReport.design }
        if ($full -le 0) { $full = $script:batReport.full }
      }
    }
    if ($design -le 0) { $design = $null }
    if ($full -le 0) { $full = $null }
    if ($design -and $full) { $health = [int][Math]::Min(100, [Math]::Round($full * 100.0 / $design)) }
  }
  return Ok @{
    present = [bool]$present; percent = $pct; charging = [bool]($st.BatteryFlag -band 8); ac = ($st.ACLineStatus -eq 1)
    designMWh = $design; fullMWh = $full; health = $health
  }
}

# ---------- privacidad ----------
function Get-InUse([string]$cap) {
  $res = New-Object System.Collections.Generic.List[string]
  $base = "HKCU:\Software\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\$cap"
  if (-not (Test-Path -LiteralPath $base)) { return ,$res.ToArray() }
  $check = {
    param($key, [string]$label)
    try {
      $p = Get-ItemProperty -LiteralPath $key.PSPath -ErrorAction Stop
      if ($null -ne $p.LastUsedTimeStart -and $null -ne $p.LastUsedTimeStop -and [long]$p.LastUsedTimeStart -gt 0 -and [long]$p.LastUsedTimeStop -eq 0) {
        if (-not $res.Contains($label)) { $res.Add($label) }
      }
    } catch {}
  }
  foreach ($k in (Get-ChildItem -LiteralPath $base -ErrorAction SilentlyContinue)) {
    if ($k.PSChildName -eq "NonPackaged") {
      foreach ($n in (Get-ChildItem -LiteralPath $k.PSPath -ErrorAction SilentlyContinue)) {
        $path = $n.PSChildName -replace '#', '\'
        & $check $n ([IO.Path]::GetFileName($path))
      }
    } else {
      $name = $k.PSChildName; $i = $name.IndexOf('_'); if ($i -gt 0) { $name = $name.Substring(0, $i) }
      & $check $k $name
    }
  }
  return ,$res.ToArray()
}

# ---------- bucle principal ----------
function Handle([string]$line) {
  $p = $line.Trim() -split '\s+'
  $cmd = $p[0]
  switch ($cmd) {
    "ping" { return Ok @{} }
    "vol?" { return Ok @{ level = [Umbra.Audio]::Get(); muted = [Umbra.Audio]::Muted() } }
    "vol"  { [Umbra.Audio]::Set([int]$p[1]); return Ok @{ level = [Umbra.Audio]::Get(); muted = [Umbra.Audio]::Muted() } }
    "mute" { [Umbra.Audio]::Mute($p[1] -eq "1"); return Ok @{ level = [Umbra.Audio]::Get(); muted = [Umbra.Audio]::Muted() } }
    "bri?" { return Ok @{ level = (Get-Bri) } }
    "bri"  { Set-Bri ([int]$p[1]); return Ok @{ level = (Get-Bri) } }
    "apps-audio?" { return Ok @{ sessions = (Get-AppsAudio) } }
    "app-vol"  { if ($p.Count -lt 3) { throw "Uso: app-vol PID N" }; return Ok @{ count = [Umbra.Audio]::SetApp([int]$p[1], [int]$p[2], -1) } }
    "app-mute" { if ($p.Count -lt 3) { throw "Uso: app-mute PID 0|1" }; return Ok @{ count = [Umbra.Audio]::SetApp([int]$p[1], -1, [int]($p[2] -eq "1")) } }
    "outputs?" {
      $list = foreach ($d in [Umbra.Audio]::Outputs()) { [ordered]@{ id = $d.Id; name = $d.Name; default = $d.IsDefault } }
      return Ok @{ devices = (Arr $list) }
    }
    "output-set" {
      if ($p.Count -lt 2) { throw "Uso: output-set <idBase64>" }
      $id = if ($p[1].StartsWith("{")) { $p[1] } else { [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($p[1])) }
      [Umbra.Audio]::SetDefault($id); return Ok @{}
    }
    "media?"    { return Get-Media }
    "media-cmd" { return Ok @{ done = (Invoke-MediaCmd $p[1]) } }
    "power?"    { return Get-Power }
    "power-set" { return Set-Power $p[1] }
    "battery?"  { return Get-Battery }
    "privacy?"  { return Ok @{ webcam = (Get-InUse "webcam"); microphone = (Get-InUse "microphone"); location = (Get-InUse "location") } }
    "refresh?"  {
      $r = [Umbra.Native]::Refresh(); if (-not $r) { throw "EnumDisplaySettings fallo" }
      return Ok @{ current = $r[0]; max = $r[1]; width = $r[2]; height = $r[3] }
    }
    default { throw "Orden desconocida: $cmd" }
  }
}

while ($true) {
  $line = [Console]::In.ReadLine()
  if ($null -eq $line) { break }
  if ($line.Trim() -eq "") { continue }
  try { Send (Handle $line) }
  catch {
    $msg = $_.Exception.Message
    if ($_.Exception.InnerException) { $msg = $_.Exception.InnerException.Message }
    $msg = ([string]$msg -replace '\s+', ' ').Trim()
    Send ([ordered]@{ ok = $false; error = $msg })
  }
}
