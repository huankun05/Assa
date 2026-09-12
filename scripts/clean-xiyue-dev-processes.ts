/**
 * @file scripts/clean-xiyue-dev-processes.ts
 * @description 只清理「本项目路径」的 dev 残留进程（electron-vite / node / electron / xiyue-dev-restart）。
 * 按命令行包含 F:\Work\Create\Assa\Xiyue 匹配，不会误杀其它项目。
 * 用法：node scripts/clean-xiyue-dev-processes.ts
 */

import { execSync } from 'child_process';
import { join } from 'path';

const PROJECT_ROOT = join(__dirname, '..', '..').replace(/\\/g, '/');
/** 也可显式：const PROJECT_ROOT = 'F:/Work/Create/Assa/Xiyue'; */

interface WinProc {
  ProcessId: number;
  Name: string;
  CommandLine: string | null;
}

function listProcesses(): WinProc[] {
  const json = execSync(
    'powershell -NoProfile -Command "Get-CimInstance Win32_Process | Select-Object ProcessId,Name,CommandLine | ConvertTo-Json -Compress"',
    { encoding: 'utf-8', maxBuffer: 16 * 1024 * 1024 },
  );
  const data = JSON.parse(json) as WinProc | WinProc[];
  return Array.isArray(data) ? data : [data];
}

function isXiyueProc(p: WinProc): boolean {
  if (!p.CommandLine) return false;
  const cmd = p.CommandLine.toLowerCase();
  const root = PROJECT_ROOT.toLowerCase();
  // 仅本项目路径相关
  return (
    cmd.includes(root)
    || cmd.includes('xiyue-dev-restart')
    || (cmd.includes('electron') && cmd.includes('assaxiyue'))
  );
}

function main(): void {
  console.log(`[clean-xiyue] project root: ${PROJECT_ROOT}`);
  const procs = listProcesses();
  const targets = procs.filter((p) => isXiyueProc(p) && p.ProcessId !== process.pid);
  if (!targets.length) {
    console.log('[clean-xiyue] nothing to kill');
    return;
  }
  for (const p of targets) {
    try {
      execSync(`taskkill /PID ${p.ProcessId} /T /F`, { stdio: 'ignore' });
      console.log(`[clean-xiyue] killed ${p.ProcessId} ${p.Name}`);
    } catch {
      console.log(`[clean-xiyue] skip ${p.ProcessId} ${p.Name}`);
    }
  }
  console.log('[clean-xiyue] done');
}

main();
