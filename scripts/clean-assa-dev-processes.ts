/**
 * @file scripts/clean-assa-dev-processes.ts
 * @description 只清理「当前项目目录」的 dev 残留进程。
 * 项目根 = 本脚本所在目录的上级（scripts/..），随仓库移动自动变化，不写死盘符。
 * 匹配：进程命令行包含该根路径（含反斜杠/正斜杠），不会误杀其它项目。
 * 用法：npm run clean:dev-processes  或  node --experimental-strip-types scripts/clean-assa-dev-processes.ts
 */

import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename_esm = fileURLToPath(import.meta.url);
/** 当前项目根：scripts/ 的上级目录 = 仓库根（随目录移动自动变化） */
const PROJECT_ROOT = join(dirname(__filename_esm), '..');
const PROJECT_ROOT_SLASH = PROJECT_ROOT.replace(/\\/g, '/');
const PROJECT_ROOT_BACK = PROJECT_ROOT.replace(/\//g, '\\');

interface WinProc {
  ProcessId: number;
  Name: string;
  CommandLine: string | null;
}

function listProcesses(): WinProc[] {
  const json = execSync(
    'powershell -NoProfile -WindowStyle Hidden -Command "Get-CimInstance Win32_Process | Select-Object ProcessId,Name,CommandLine | ConvertTo-Json -Compress"',
    { encoding: 'utf-8', maxBuffer: 16 * 1024 * 1024, windowsHide: true },
  );
  const data = JSON.parse(json) as WinProc | WinProc[];
  return Array.isArray(data) ? data : [data];
}

function isAssaProc(p: WinProc): boolean {
  if (!p.CommandLine) return false;
  const cmd = p.CommandLine;
  const rootFwd = PROJECT_ROOT_SLASH.toLowerCase();
  const rootBack = PROJECT_ROOT_BACK.toLowerCase();
  // 仅当前项目根路径（正斜杠 / 反斜杠）
  return cmd.toLowerCase().includes(rootFwd) || cmd.toLowerCase().includes(rootBack);
}

function main(): void {
  console.log(`[clean-assa] project root: ${PROJECT_ROOT}`);
  const procs = listProcesses();
  const targets = procs.filter((p) => isAssaProc(p) && p.ProcessId !== process.pid);
  if (!targets.length) {
    console.log('[clean-assa] nothing to kill');
    return;
  }
  for (const p of targets) {
    try {
      execSync(`taskkill /PID ${p.ProcessId} /T /F`, { stdio: 'ignore', windowsHide: true });
      console.log(`[clean-assa] killed ${p.ProcessId} ${p.Name}`);
    } catch {
      console.log(`[clean-assa] skip ${p.ProcessId} ${p.Name}`);
    }
  }
  console.log('[clean-assa] done');
}

main();
