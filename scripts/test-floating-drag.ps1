# Floating-ball OS-level drag integration test.
#
# Spins up `npm run dev` with PROMPTHUB_DEBUG_DRAG=1, locates the floating
# window via Win32 FindWindow (its title is "JoeyPrompthubFloatingBall"),
# synthesises a real mouse-down/move/up sequence using user32 mouse_event, and
# checks whether the window's bounding rect actually moved. Then it kills the
# dev process. Run from the repo root: `powershell -File scripts/test-floating-drag.ps1`.

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
Set-Location $root

# --- Win32 P/Invoke ---------------------------------------------------------
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class Win32 {
  [StructLayout(LayoutKind.Sequential)]
  public struct RECT { public int Left, Top, Right, Bottom; }

  [StructLayout(LayoutKind.Sequential)]
  public struct POINT { public int X, Y; }

  [DllImport("user32.dll", SetLastError = true)]
  public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);

  [DllImport("user32.dll", SetLastError = true)]
  [return: MarshalAs(UnmanagedType.Bool)]
  public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

  [DllImport("user32.dll", SetLastError = true)]
  [return: MarshalAs(UnmanagedType.Bool)]
  public static extern bool SetCursorPos(int x, int y);

  [DllImport("user32.dll")]
  public static extern IntPtr WindowFromPoint(POINT p);

  [DllImport("user32.dll", SetLastError = true)]
  [return: MarshalAs(UnmanagedType.Bool)]
  public static extern bool GetCursorPos(out POINT lpPoint);

  [DllImport("user32.dll", SetLastError = true)]
  [return: MarshalAs(UnmanagedType.Bool)]
  public static extern bool SetForegroundWindow(IntPtr hWnd);

  [DllImport("user32.dll", SetLastError = true)]
  [return: MarshalAs(UnmanagedType.Bool)]
  public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int x, int y, int cx, int cy, uint flags);

  public static readonly IntPtr HWND_TOPMOST = new IntPtr(-1);
  public const uint SWP_NOMOVE = 0x0002;
  public const uint SWP_NOSIZE = 0x0001;
  public const uint SWP_NOACTIVATE = 0x0010;
  public const uint SWP_SHOWWINDOW = 0x0040;

  [DllImport("user32.dll")]
  public static extern void mouse_event(uint dwFlags, int dx, int dy, uint dwData, UIntPtr dwExtraInfo);

  public const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
  public const uint MOUSEEVENTF_LEFTUP   = 0x0004;
  public const uint MOUSEEVENTF_MOVE     = 0x0001;
  public const uint MOUSEEVENTF_ABSOLUTE = 0x8000;
}
"@

function Find-FloatingWindow {
  $handleFile = Join-Path $env:TEMP 'prompthub-floating.hwnd'
  for ($i = 0; $i -lt 80; $i++) {
    if (Test-Path $handleFile) {
      $raw = (Get-Content $handleFile -Raw).Trim()
      if ($raw) {
        # Verify the window is alive by getting its rect.
        $h = [IntPtr]::new([int64]$raw)
        $r = New-Object Win32+RECT
        if ([Win32]::GetWindowRect($h, [ref]$r)) { return $h }
      }
    }
    # Fallback: title search (covers cases where the debug file hasn't been written yet).
    $h = [Win32]::FindWindow($null, 'JoeyPrompthubFloatingBall')
    if ($h -ne [IntPtr]::Zero) {
      $r = New-Object Win32+RECT
      if ([Win32]::GetWindowRect($h, [ref]$r)) { return $h }
    }
    Start-Sleep -Milliseconds 500
  }
  throw 'Floating ball window not found after 40s'
}

function Get-WindowRect([IntPtr]$h) {
  $r = New-Object Win32+RECT
  if (-not [Win32]::GetWindowRect($h, [ref]$r)) { throw 'GetWindowRect failed' }
  return $r
}

function Send-MouseDown {
  [Win32]::mouse_event([Win32]::MOUSEEVENTF_LEFTDOWN, 0, 0, 0, [UIntPtr]::Zero)
}
function Send-MouseUp {
  [Win32]::mouse_event([Win32]::MOUSEEVENTF_LEFTUP, 0, 0, 0, [UIntPtr]::Zero)
}

# --- Spawn dev server -------------------------------------------------------
$logPath = Join-Path $root 'scripts\test-floating-drag.log'
if (Test-Path $logPath) { Remove-Item $logPath -Force }

$handleFile = Join-Path $env:TEMP 'prompthub-floating.hwnd'
if (Test-Path $handleFile) { Remove-Item $handleFile -Force }

$debugFile = Join-Path $env:TEMP 'prompthub-floating-debug.log'
if (Test-Path $debugFile) { Remove-Item $debugFile -Force }

Write-Host '>> launching electron-vite dev (PROMPTHUB_DEBUG_DRAG=1) ...'
$env:PROMPTHUB_DEBUG_DRAG = '1'
$proc = Start-Process -FilePath 'cmd.exe' `
  -ArgumentList '/c','npm','run','dev' `
  -PassThru -WindowStyle Hidden `
  -RedirectStandardOutput $logPath `
  -RedirectStandardError (Join-Path $root 'scripts\test-floating-drag.err.log')

try {
  Write-Host '>> waiting for floating window to appear ...'
  $hwnd = Find-FloatingWindow
  Write-Host ('   hwnd = 0x{0:X}' -f $hwnd.ToInt64())

  # Let the window settle for a beat after first paint.
  Start-Sleep -Milliseconds 800

  $before = Get-WindowRect $hwnd
  $w = $before.Right - $before.Left
  $h = $before.Bottom - $before.Top
  $cx = [int]($before.Left + $w / 2)
  $cy = [int]($before.Top + $h / 2)
  Write-Host ('   before: ({0},{1}) size {2}x{3}; centre ({4},{5})' -f $before.Left,$before.Top,$w,$h,$cx,$cy)

  # Move cursor onto the ball, press, then drag in 24 small steps to (cx-300, cy-200),
  # then release. mouse_event delivers genuine OS-level input that reaches both the
  # renderer (pointer events) AND `screen.getCursorScreenPoint()` simultaneously.
  # Force the ball to the very top of the Z-order. On Windows 11 there are
  # invisible system overlays (LockScreenBackstopFrame etc.) that intercept
  # synthetic mouse_event input even above always-on-top apps. SetWindowPos
  # with HWND_TOPMOST + SetForegroundWindow puts our ball above them so the
  # synthetic clicks reach the renderer. This does not affect real users.
  [void][Win32]::SetWindowPos(
    $hwnd, [Win32]::HWND_TOPMOST, 0, 0, 0, 0,
    [Win32]::SWP_NOMOVE -bor [Win32]::SWP_NOSIZE -bor [Win32]::SWP_SHOWWINDOW
  )
  [void][Win32]::SetForegroundWindow($hwnd)
  Start-Sleep -Milliseconds 80

  [void][Win32]::SetCursorPos($cx, $cy)
  Start-Sleep -Milliseconds 160

  $cursorNow = New-Object Win32+POINT
  [void][Win32]::GetCursorPos([ref]$cursorNow)
  $pt = New-Object Win32+POINT
  $pt.X = $cx
  $pt.Y = $cy
  $hitHwnd = [Win32]::WindowFromPoint($pt)
  Write-Host ('   cursor reports: ({0},{1})  WindowFromPoint=0x{2:X}  ball hwnd=0x{3:X}' -f `
    $cursorNow.X, $cursorNow.Y, $hitHwnd.ToInt64(), $hwnd.ToInt64())

  Send-MouseDown
  Start-Sleep -Milliseconds 40

  $targetX = [Math]::Max(80, $cx - 300)
  $targetY = [Math]::Max(80, $cy - 200)
  $steps = 24
  for ($i = 1; $i -le $steps; $i++) {
    $t = $i / [double]$steps
    $px = [int]($cx + ($targetX - $cx) * $t)
    $py = [int]($cy + ($targetY - $cy) * $t)
    [void][Win32]::SetCursorPos($px, $py)
    Start-Sleep -Milliseconds 16
  }

  Start-Sleep -Milliseconds 60
  Send-MouseUp
  Write-Host '>> mouseup sent, ball should drop in place ...'
  Start-Sleep -Milliseconds 200

  $after = Get-WindowRect $hwnd
  $dx = $after.Left - $before.Left
  $dy = $after.Top  - $before.Top
  Write-Host ('   after:  ({0},{1})  delta=({2},{3})' -f $after.Left,$after.Top,$dx,$dy)

  # Expect:
  # - window moved (delta non-zero in both axes since we dragged diagonally)
  # - vertical drop is honoured (no snap back to original y)
  $movedX = ($dx -ne 0)
  $movedY = ($dy -ne 0)
  $ok = $movedX -and $movedY
  if (-not $movedY) {
    Write-Host '   (vertical did not change — ball appears to have snapped back)' -ForegroundColor Yellow
  }

  $debugFile = Join-Path $env:TEMP 'prompthub-floating-debug.log'
  if (Test-Path $debugFile) {
    Write-Host ''
    Write-Host '--- main-process drag telemetry ---'
    Get-Content $debugFile | ForEach-Object { Write-Host $_ }
    Write-Host '--- end telemetry ---'
  } else {
    Write-Host '(no debug telemetry file written; main process did not see PROMPTHUB_DEBUG_DRAG=1)'
  }

  if ($ok) {
    Write-Host ''
    Write-Host ('PASS: window moved by ({0},{1})' -f $dx,$dy) -ForegroundColor Green
    exit 0
  } else {
    Write-Host ''
    Write-Host 'FAIL: window did not move during simulated drag.' -ForegroundColor Red
    exit 1
  }
}
finally {
  Write-Host ''
  Write-Host '>> killing dev tree ...'
  if ($proc -and -not $proc.HasExited) {
    try { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue } catch {}
  }
  Get-Process electron -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  Get-Process node     -ErrorAction SilentlyContinue | Where-Object { $_.Path -and $_.Path -like '*Joey Prompthub*' } |
    Stop-Process -Force -ErrorAction SilentlyContinue
}
