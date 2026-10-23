// Puente con Win32: barra de Windows, area de trabajo, ventanas abiertas y tecla Windows.
const koffi = require('koffi');

const user32 = koffi.load('user32.dll');
const shell32 = koffi.load('shell32.dll');
const kernel32 = koffi.load('kernel32.dll');
const dwmapi = koffi.load('dwmapi.dll');

const HWND = koffi.alias('HWND', 'void *');
const RECT = koffi.struct('RECT', { left: 'long', top: 'long', right: 'long', bottom: 'long' });
const APPBARDATA = koffi.struct('APPBARDATA', {
  cbSize: 'uint32', hWnd: 'void *', uCallbackMessage: 'uint32', uEdge: 'uint32', rc: RECT, lParam: 'intptr'
});
const KBDLLHOOKSTRUCT = koffi.struct('KBDLLHOOKSTRUCT', {
  vkCode: 'uint32', scanCode: 'uint32', flags: 'uint32', time: 'uint32', dwExtraInfo: 'uintptr'
});

const FindWindowW = user32.func('void * __stdcall FindWindowW(str16 cls, str16 name)');
const FindWindowExW = user32.func('void * __stdcall FindWindowExW(void *parent, void *after, str16 cls, str16 name)');
const ShowWindow = user32.func('bool __stdcall ShowWindow(void *hwnd, int cmd)');
const IsWindowVisible = user32.func('bool __stdcall IsWindowVisible(void *hwnd)');
const IsIconic = user32.func('bool __stdcall IsIconic(void *hwnd)');
const IsZoomed = user32.func('bool __stdcall IsZoomed(void *hwnd)');
const GetForegroundWindow = user32.func('void * __stdcall GetForegroundWindow()');
const SetForegroundWindow = user32.func('bool __stdcall SetForegroundWindow(void *hwnd)');
const BringWindowToTop = user32.func('bool __stdcall BringWindowToTop(void *hwnd)');
const GetWindowTextW = user32.func('int __stdcall GetWindowTextW(void *hwnd, _Out_ uint16_t *buf, int max)');
const GetWindowTextLengthW = user32.func('int __stdcall GetWindowTextLengthW(void *hwnd)');
const GetClassNameW = user32.func('int __stdcall GetClassNameW(void *hwnd, _Out_ uint16_t *buf, int max)');
const GetWindow = user32.func('void * __stdcall GetWindow(void *hwnd, uint32 cmd)');
const GetWindowLongPtrW = user32.func('intptr __stdcall GetWindowLongPtrW(void *hwnd, int index)');
const GetWindowThreadProcessId = user32.func('uint32 __stdcall GetWindowThreadProcessId(void *hwnd, _Out_ uint32 *pid)');
const GetWindowRect = user32.func('bool __stdcall GetWindowRect(void *hwnd, _Out_ RECT *rc)');
const PostMessageW = user32.func('bool __stdcall PostMessageW(void *hwnd, uint32 msg, uintptr w, intptr l)');
const SystemParametersInfoW = user32.func('bool __stdcall SystemParametersInfoW(uint32 action, uint32 param, _Inout_ RECT *rc, uint32 flags)');
const SystemParametersInfoStr = user32.func('__stdcall', 'SystemParametersInfoW', 'bool',
  ['uint32', 'uint32', koffi.out(koffi.pointer('uint16_t')), 'uint32']);
const keybd_event = user32.func('void __stdcall keybd_event(uint8 vk, uint8 scan, uint32 flags, uintptr extra)');
const GetAsyncKeyState = user32.func('int16 __stdcall GetAsyncKeyState(int vk)');
const SHAppBarMessage = shell32.func('uintptr __stdcall SHAppBarMessage(uint32 msg, _Inout_ APPBARDATA *data)');
const OpenProcess = kernel32.func('void * __stdcall OpenProcess(uint32 access, bool inherit, uint32 pid)');
const CloseHandle = kernel32.func('bool __stdcall CloseHandle(void *h)');
const QueryFullProcessImageNameW = kernel32.func('bool __stdcall QueryFullProcessImageNameW(void *h, uint32 flags, _Out_ uint16_t *buf, _Inout_ uint32 *size)');
const GetModuleHandleW = kernel32.func('void * __stdcall GetModuleHandleW(str16 name)');
const DwmGetWindowAttribute = dwmapi.func('int32 __stdcall DwmGetWindowAttribute(void *hwnd, uint32 attr, _Out_ int32 *value, uint32 size)');

const EnumProc = koffi.proto('bool __stdcall EnumWindowsProc(void *hwnd, intptr lParam)');
const EnumWindows = user32.func('bool __stdcall EnumWindows(EnumWindowsProc *cb, intptr lParam)');
const HookProc = koffi.proto('intptr __stdcall LowLevelKeyboardProc(int code, uintptr wParam, void *lParam)');
const SetWindowsHookExW = user32.func('void * __stdcall SetWindowsHookExW(int id, LowLevelKeyboardProc *fn, void *mod, uint32 thread)');
const UnhookWindowsHookEx = user32.func('bool __stdcall UnhookWindowsHookEx(void *hook)');
const CallNextHookEx = user32.func('intptr __stdcall CallNextHookEx(void *hook, int code, uintptr wParam, void *lParam)');

const ptrKey = (p) => String(koffi.address(p));
const fromKey = new Map();

function text16(fn, hwnd, max = 512) {
  const buf = new Uint16Array(max);
  const n = fn(hwnd, buf, max);
  return n > 0 ? String.fromCharCode(...buf.subarray(0, n)) : '';
}

// ---------------------------------------------------------------- Barra de Windows
const ABM_GETSTATE = 4, ABM_SETSTATE = 10, ABS_AUTOHIDE = 1, ABS_ALWAYSONTOP = 2;

function trayWindows() {
  const list = [];
  const main = FindWindowW('Shell_TrayWnd', null);
  if (main) list.push(main);
  let h = null;
  while ((h = FindWindowExW(null, h, 'Shell_SecondaryTrayWnd', null))) list.push(h);
  return list;
}

const emptyRect = () => ({ left: 0, top: 0, right: 0, bottom: 0 });
const abData = (hwnd, extra = {}) => ({ cbSize: koffi.sizeof(APPBARDATA), hWnd: hwnd, uCallbackMessage: 0, uEdge: 0, rc: emptyRect(), lParam: 0, ...extra });

function taskbarAutoHide() {
  const tray = FindWindowW('Shell_TrayWnd', null);
  return tray ? (Number(SHAppBarMessage(ABM_GETSTATE, abData(tray))) & ABS_AUTOHIDE) !== 0 : false;
}

function setTaskbarAutoHide(on) {
  const tray = FindWindowW('Shell_TrayWnd', null);
  if (tray) SHAppBarMessage(ABM_SETSTATE, abData(tray, { lParam: on ? ABS_AUTOHIDE : 0 }));
}

// Autoocultar libera el espacio que reserva la barra; ademas se esconde del todo.
function hideTaskbar() {
  if (!taskbarAutoHide()) setTaskbarAutoHide(true);
  for (const h of trayWindows()) if (IsWindowVisible(h)) ShowWindow(h, 0);
}

function showTaskbar(autoHideOriginally = false) {
  setTaskbarAutoHide(autoHideOriginally);
  for (const h of trayWindows()) ShowWindow(h, 5);
}

// ---------------------------------------------------------------- Antuan como "appbar"
// Igual que la barra de Windows: reserva su borde y Windows ajusta las ventanas maximizadas.
const ABM_NEW = 0, ABM_REMOVE = 1, ABM_QUERYPOS = 2, ABM_SETPOS = 3;
const EDGE_CODE = { left: 0, top: 1, right: 2, bottom: 3 };
let appbarHwnd = null;

function appbarSet(handleBuffer, edge, rc, callbackMsg) {
  if (!appbarHwnd) {
    appbarHwnd = koffi.decode(handleBuffer, 'void *');
    SHAppBarMessage(ABM_NEW, abData(appbarHwnd, { uCallbackMessage: callbackMsg }));
  }
  const d = abData(appbarHwnd, { uEdge: EDGE_CODE[edge], rc: { ...rc } });
  SHAppBarMessage(ABM_QUERYPOS, d);
  // QUERYPOS puede recortar el rectangulo; se recoloca el grosor sobre el borde pedido.
  const t = { bottom: rc.bottom - rc.top, top: rc.bottom - rc.top, left: rc.right - rc.left, right: rc.right - rc.left }[edge];
  if (edge === 'bottom') d.rc.top = d.rc.bottom - t;
  if (edge === 'top') d.rc.bottom = d.rc.top + t;
  if (edge === 'left') d.rc.right = d.rc.left + t;
  if (edge === 'right') d.rc.left = d.rc.right - t;
  SHAppBarMessage(ABM_SETPOS, d);
}

function appbarRemove() {
  if (appbarHwnd) SHAppBarMessage(ABM_REMOVE, abData(appbarHwnd));
  appbarHwnd = null;
}

// ---------------------------------------------------------------- Area de trabajo
const SPI_SETWORKAREA = 0x2F, SPI_GETWORKAREA = 0x30, SPIF_SENDCHANGE = 2;

function getWorkArea() {
  const rc = {};
  SystemParametersInfoW(SPI_GETWORKAREA, 0, rc, 0);
  return rc;
}

function setWorkArea(rc) {
  const cur = getWorkArea();
  if (cur.left === rc.left && cur.top === rc.top && cur.right === rc.right && cur.bottom === rc.bottom) return false;
  SystemParametersInfoW(SPI_SETWORKAREA, 0, { ...rc }, SPIF_SENDCHANGE);
  return true;
}

// ---------------------------------------------------------------- Ventanas abiertas
const GW_OWNER = 4, GWL_EXSTYLE = -20, WS_EX_TOOLWINDOW = 0x80, WS_EX_APPWINDOW = 0x40000, WS_EX_NOACTIVATE = 0x08000000;
const DWMWA_CLOAKED = 14;
const SKIP_CLASSES = new Set(['Progman', 'WorkerW', 'Shell_TrayWnd', 'Shell_SecondaryTrayWnd', 'Windows.UI.Core.CoreWindow']);
const exeCache = new Map();

function processPath(hwnd) {
  const pid = [0];
  GetWindowThreadProcessId(hwnd, pid);
  if (exeCache.has(pid[0])) return exeCache.get(pid[0]);
  let path = '';
  const h = OpenProcess(0x1000, false, pid[0]);
  if (h) {
    const buf = new Uint16Array(1024), size = [1024];
    if (QueryFullProcessImageNameW(h, 0, buf, size)) path = String.fromCharCode(...buf.subarray(0, size[0]));
    CloseHandle(h);
  }
  exeCache.set(pid[0], path);
  if (exeCache.size > 500) exeCache.clear();
  return path;
}

function listWindows(ownPids = []) {
  const out = [];
  const fg = GetForegroundWindow();
  const fgKey = fg ? ptrKey(fg) : '';
  const cb = koffi.register((hwnd) => {
    try {
      if (!IsWindowVisible(hwnd) || GetWindow(hwnd, GW_OWNER)) return true;
      const ex = Number(GetWindowLongPtrW(hwnd, GWL_EXSTYLE));
      if ((ex & WS_EX_TOOLWINDOW) && !(ex & WS_EX_APPWINDOW)) return true;
      if (ex & WS_EX_NOACTIVATE) return true;
      if (GetWindowTextLengthW(hwnd) === 0) return true;
      const cls = text16(GetClassNameW, hwnd, 256);
      if (SKIP_CLASSES.has(cls)) return true;
      const cloaked = [0];
      DwmGetWindowAttribute(hwnd, DWMWA_CLOAKED, cloaked, 4);
      if (cloaked[0]) return true;
      const pid = [0];
      GetWindowThreadProcessId(hwnd, pid);
      if (ownPids.includes(pid[0])) return true;
      const key = ptrKey(hwnd);
      fromKey.set(key, hwnd);
      out.push({ id: key, title: text16(GetWindowTextW, hwnd), cls, exe: processPath(hwnd), minimized: IsIconic(hwnd), active: key === fgKey });
    } catch (e) { /* ventana que desaparece mientras se enumera */ }
    return true;
  }, koffi.pointer(EnumProc));
  try { EnumWindows(cb, 0); } finally { koffi.unregister(cb); }
  return out;
}

function forceForeground(hwnd) {
  // Windows solo deja traer ventanas al frente tras una pulsacion: se simula una tecla sin uso.
  keybd_event(0xE8, 0, 0, 0);
  keybd_event(0xE8, 0, 2, 0);
  SetForegroundWindow(hwnd);
  BringWindowToTop(hwnd);
}

// Foco para la propia ventana de Antuan (al abrir el inicio) y devolucion al cerrar.
let savedForeground = null;
function focusOwn(handleBuffer) {
  const fg = GetForegroundWindow();
  const own = koffi.decode(handleBuffer, 'void *');
  if (fg && koffi.address(fg) !== koffi.address(own)) savedForeground = fg;
  forceForeground(own);
}
function restoreForeground() {
  if (savedForeground && IsWindowVisible(savedForeground)) forceForeground(savedForeground);
  savedForeground = null;
}

function windowAction(id, action) {
  const hwnd = fromKey.get(id);
  if (!hwnd) return;
  if (action === 'focus') {
    if (IsIconic(hwnd)) ShowWindow(hwnd, 9);
    forceForeground(hwnd);
  } else if (action === 'minimize') {
    ShowWindow(hwnd, 6);
  } else if (action === 'close') {
    PostMessageW(hwnd, 0x0010, 0, 0);
  }
}

function foregroundIsFullscreen(screenBounds, ownPids) {
  const fg = GetForegroundWindow();
  if (!fg) return false;
  const pid = [0];
  GetWindowThreadProcessId(fg, pid);
  if (ownPids.includes(pid[0])) return false;
  const cls = text16(GetClassNameW, fg, 256);
  if (SKIP_CLASSES.has(cls) || !IsWindowVisible(fg)) return false;
  const cloaked = [0];
  DwmGetWindowAttribute(fg, DWMWA_CLOAKED, cloaked, 4);
  if (cloaked[0]) return false;
  const ex = Number(GetWindowLongPtrW(fg, GWL_EXSTYLE));
  if (ex & (WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE)) return false;
  // Una ventana maximizada normal tiene barra de titulo; los juegos y videos a pantalla completa no.
  const WS_CAPTION = 0x00C00000;
  if ((Number(GetWindowLongPtrW(fg, -16)) & WS_CAPTION) === WS_CAPTION) return false;
  const rc = {};
  GetWindowRect(fg, rc);
  const b = screenBounds;
  return rc.left <= b.x && rc.top <= b.y && rc.right >= b.x + b.width && rc.bottom >= b.y + b.height;
}

// ---------------------------------------------------------------- Capa del escritorio
// La ventana del escritorio Antuan se cuelga de Progman (la capa del fondo de Windows),
// por encima de los iconos de Windows: no tapa ventanas y Win+D no la esconde.
const SetParent = user32.func('void * __stdcall SetParent(void *child, void *parent)');
const SetWindowLongPtrW = user32.func('intptr __stdcall SetWindowLongPtrW(void *h, int index, intptr value)');
const SetWindowPos = user32.func('bool __stdcall SetWindowPos(void *h, void *after, int x, int y, int cx, int cy, uint32 flags)');
const SendMessageTimeoutW = user32.func('intptr __stdcall SendMessageTimeoutW(void *h, uint32 msg, uintptr w, intptr l, uint32 flags, uint32 timeout, _Out_ uintptr *result)');

// Ventana que contiene los iconos del escritorio:
// - Windows 11 24H2+: Progman (con SHELLDLL_DefView y WorkerW como hijos)
// - Windows 10 y 11 antiguo: un WorkerW de primer nivel que contiene SHELLDLL_DefView
function desktopHost() {
  const progman = FindWindowW('Progman', null);
  if (!progman) return null;
  SendMessageTimeoutW(progman, 0x052C, 0xD, 1, 0, 1000, [0]);
  if (FindWindowExW(progman, null, 'SHELLDLL_DefView', null)) return progman;
  let w = null;
  while ((w = FindWindowExW(null, w, 'WorkerW', null))) {
    if (FindWindowExW(w, null, 'SHELLDLL_DefView', null)) return w;
  }
  return progman;
}

function attachToDesktop(handleBuffer, rc) {
  const h = koffi.decode(handleBuffer, 'void *');
  const host = desktopHost();
  if (!host) return false;
  const style = Number(GetWindowLongPtrW(h, -16));
  SetWindowLongPtrW(h, -16, (style & ~0x80000000 & ~0x00C00000 & ~0x00040000) | 0x40000000); // sin POPUP/CAPTION/THICKFRAME, con CHILD
  SetParent(h, host);
  const pr = {};
  GetWindowRect(host, pr);
  // HWND_TOP dentro de Progman: por encima de los iconos de Windows.
  SetWindowPos(h, null, rc.left - pr.left, rc.top - pr.top, rc.right - rc.left, rc.bottom - rc.top, 0x0040 | 0x0020 | 0x0010);
  return true;
}

function desktopHostAlive() { return !!FindWindowW('Progman', null); }

const SystemParametersInfoSet = user32.func('__stdcall', 'SystemParametersInfoW', 'bool', ['uint32', 'uint32', 'str16', 'uint32']);
function setWallpaper(p) { return SystemParametersInfoSet(0x14, 0, p, 3); }

function wallpaperPath() {
  const buf = new Uint16Array(1024);
  SystemParametersInfoStr(0x73, 1024, buf, 0);
  const n = buf.indexOf(0);
  return String.fromCharCode(...buf.subarray(0, n < 0 ? 1024 : n));
}

// ---------------------------------------------------------------- Eventos de ventanas
// Windows avisa de cada cambio (abrir, cerrar, foco, minimizar, titulo, mover): sin sondeos.
const WinEventProc = koffi.proto('void __stdcall WinEventProc(void *hook, uint32 event, void *hwnd, long idObject, long idChild, uint32 thread, uint32 time)');
const SetWinEventHook = user32.func('void * __stdcall SetWinEventHook(uint32 min, uint32 max, void *mod, WinEventProc *fn, uint32 pid, uint32 tid, uint32 flags)');
const UnhookWinEvent = user32.func('bool __stdcall UnhookWinEvent(void *hook)');
const EV = { FOREGROUND: 0x0003, MOVESIZESTART: 0x000A, MOVESIZEEND: 0x000B, MINIMIZESTART: 0x0016, MINIMIZEEND: 0x0017,
  CREATE: 0x8000, DESTROY: 0x8001, SHOW: 0x8002, HIDE: 0x8003, NAMECHANGE: 0x800C, CLOAKED: 0x8017, UNCLOAKED: 0x8018 };
let winEventHooks = [], winEventCb = null;

function watchWindows(onEvent) {
  winEventCb = koffi.register((hook, event, hwnd, idObject, idChild) => {
    try {
      // Solo ventanas completas (no cada boton o elemento interno).
      if (idObject !== 0 || idChild !== 0) return;
      onEvent(event, hwnd ? ptrKey(hwnd) : null);
    } catch { }
  }, koffi.pointer(WinEventProc));
  const ranges = [[EV.FOREGROUND, EV.FOREGROUND], [EV.MOVESIZESTART, EV.MOVESIZEEND], [EV.MINIMIZESTART, EV.MINIMIZEEND],
    [EV.CREATE, EV.HIDE], [EV.NAMECHANGE, EV.NAMECHANGE], [EV.CLOAKED, EV.UNCLOAKED]];
  // WINEVENT_OUTOFCONTEXT (0) | WINEVENT_SKIPOWNPROCESS (2)
  winEventHooks = ranges.map(([a, b]) => SetWinEventHook(a, b, null, winEventCb, 0, 0, 2)).filter(Boolean);
  return winEventHooks.length;
}

function unwatchWindows() {
  for (const h of winEventHooks) UnhookWinEvent(h);
  winEventHooks = [];
  if (winEventCb) koffi.unregister(winEventCb);
  winEventCb = null;
}

function windowRect(id) {
  const h = fromKey.get(id);
  if (!h) return null;
  const rc = {};
  return GetWindowRect(h, rc) ? rc : null;
}

// Coloca una ventana ajena (zonas de anclaje). Si esta maximizada, primero se restaura.
function placeWindow(id, rc) {
  const h = fromKey.get(id);
  if (!h) return false;
  if (IsIconic(h) || IsZoomed(h)) ShowWindow(h, 9);
  return SetWindowPos(h, null, rc.left, rc.top, rc.right - rc.left, rc.bottom - rc.top, 0x0004 | 0x0010 | 0x0040);
}

function setTopmost(id, on) {
  const h = fromKey.get(id);
  if (!h) return false;
  return SetWindowPos(h, on ? -1 : -2, 0, 0, 0, 0, 0x0001 | 0x0002 | 0x0010);
}

function isTopmost(id) {
  const h = fromKey.get(id);
  return h ? (Number(GetWindowLongPtrW(h, GWL_EXSTYLE)) & 0x8) !== 0 : false;
}

function keyForHandle(hwnd) { const k = ptrKey(hwnd); fromKey.set(k, hwnd); return k; }
function keyFromBuffer(buf) { return keyForHandle(koffi.decode(buf, 'void *')); }

// ---------------------------------------------------------------- Portapapeles
const AddClipboardFormatListener = user32.func('bool __stdcall AddClipboardFormatListener(void *hwnd)');
const RemoveClipboardFormatListener = user32.func('bool __stdcall RemoveClipboardFormatListener(void *hwnd)');
function clipboardListen(handleBuffer, on) {
  const h = koffi.decode(handleBuffer, 'void *');
  return on ? AddClipboardFormatListener(h) : RemoveClipboardFormatListener(h);
}

// ---------------------------------------------------------------- Mantener despierto
const SetThreadExecutionState = kernel32.func('uint32 __stdcall SetThreadExecutionState(uint32 flags)');
function keepAwake(on) {
  // ES_CONTINUOUS | ES_SYSTEM_REQUIRED | ES_DISPLAY_REQUIRED
  SetThreadExecutionState(on ? (0x80000000 | 0x1 | 0x2) >>> 0 : 0x80000000 >>> 0);
}

// ---------------------------------------------------------------- Tecla Windows
// Win suelta sola -> abre Antuan. Win + otra tecla (Win+E, Win+D...) sigue funcionando igual.
let hook = null, hookCb = null;
// winCombos: { vk: fn } -> Win + esa tecla la gestiona Antuan (p.ej. Win+S = Spotlight, Win+Tab = Mission Control).
function installWinKeyHook(onWin, winCombos = {}) {
  let winDown = false, combo = false, swallowed = false;
  hookCb = koffi.register((code, wParam, lParam) => {
    // Solo se "come" una tecla si es un atajo de Antuan; el resto sigue su camino siempre.
    let eat = false;
    try { if (code >= 0) eat = handleKey(wParam, koffi.decode(lParam, KBDLLHOOKSTRUCT)); } catch { }
    return eat ? 1 : CallNextHookEx(null, code, wParam, lParam);
  }, koffi.pointer(HookProc));
  const suppressStart = () => { keybd_event(0xE8, 0, 0, 0); keybd_event(0xE8, 0, 2, 0); };
  function handleKey(wp, k) {
    const wParam = Number(wp);
    const injected = (k.flags & 0x10) !== 0;
    const down = wParam === 0x100 || wParam === 0x104;
    const up = wParam === 0x101 || wParam === 0x105;
    const isWin = k.vkCode === 0x5B || k.vkCode === 0x5C;
    if (injected) return false;
    if (isWin && down) { if (!winDown) { winDown = true; combo = false; swallowed = false; } return false; }
    if (!isWin && winDown && winCombos[k.vkCode]) {
      if (down) { combo = true; swallowed = true; setImmediate(winCombos[k.vkCode]); }
      return true;
    }
    if (!isWin && down && winDown) { combo = true; return false; }
    if (isWin && up && winDown) {
      winDown = false;
      // Una pulsacion falsa "consume" la tecla Win para que no se abra el Inicio de Windows.
      if (!combo) { suppressStart(); setImmediate(onWin); }
      else if (swallowed) suppressStart();
    }
    return false;
  }
  hook = SetWindowsHookExW(13, hookCb, GetModuleHandleW(null), 0);
  return !!hook;
}

function removeWinKeyHook() {
  if (hook) UnhookWindowsHookEx(hook);
  if (hookCb) koffi.unregister(hookCb);
  hook = hookCb = null;
}

function sendKeys(vks) {
  for (const vk of vks) keybd_event(vk, 0, 0, 0);
  for (const vk of [...vks].reverse()) keybd_event(vk, 0, 2, 0);
}

module.exports = {
  hideTaskbar, showTaskbar, taskbarAutoHide, appbarSet, appbarRemove, getWorkArea, setWorkArea, listWindows, windowAction, focusOwn, restoreForeground,
  foregroundIsFullscreen, wallpaperPath, attachToDesktop, desktopHostAlive,
  watchWindows, unwatchWindows, windowRect, placeWindow, setTopmost, isTopmost, keepAwake, EV, clipboardListen, keyFromBuffer, setWallpaper, installWinKeyHook, removeWinKeyHook, sendKeys, GetAsyncKeyState
};
