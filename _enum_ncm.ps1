$sig = @'
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public class WinEnum {
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumWindowsProc cb, IntPtr lParam);
  [DllImport("user32.dll")] static extern int GetWindowText(IntPtr h, StringBuilder sb, int max);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  delegate bool EnumWindowsProc(IntPtr h, IntPtr lParam);
  public static List<string> GetTitles(HashSet<uint> pids) {
    var result = new List<string>();
    EnumWindows((h, l) => {
      uint pid; GetWindowThreadProcessId(h, out pid);
      if (pids.Contains(pid)) {
        var sb = new StringBuilder(512);
        GetWindowText(h, sb, 512);
        if (sb.Length > 0) result.Add(sb.ToString());
      }
      return true;
    }, IntPtr.Zero);
    return result;
  }
}
'@
Add-Type -TypeDefinition $sig
$pids = New-Object 'HashSet[uint32]'
Get-Process cloudmusic -ErrorAction SilentlyContinue | ForEach-Object { [void]$pids.Add([uint32]$_.Id) }
if ($pids.Count -eq 0) { Write-Output 'NO_CLOUDMUSIC_PROCESS' } else {
  [WinEnum]::GetTitles($pids) | ForEach-Object { Write-Output "TITLE: $_" }
}
