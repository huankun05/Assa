/**
 * @file everythingSearch.ts
 * @description 通过 voidtools Everything CLI（es.exe）做全盘文件名秒搜。
 * 引擎本体闭源免费；CLI 开源（MIT）。未安装时返回 null，由调用方回退目录遍历。
 * @author 鸡哥
 */

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { LocalFileSearchItem } from '../ipc/app/types/LocalFileSearchItem';

export interface EverythingSearchResult {
  items: LocalFileSearchItem[];
  engine: 'everything' | 'directory';
}

let cachedEsPath: string | null | undefined;

/** 常见 es.exe 安装/便携路径 */
function candidateEsPaths(): string[] {
  const localAppData = process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local');
  const programFiles = process.env['ProgramFiles'] ?? 'C:\\Program Files';
  const programFilesX86 = process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)';
  return [
    join(localAppData, 'Microsoft', 'WindowsApps', 'es.exe'),
    join(programFiles, 'Everything', 'es.exe'),
    join(programFilesX86, 'Everything', 'es.exe'),
    'C:\\Tools\\Everything\\es.exe',
    'D:\\Tools\\Everything\\es.exe',
  ];
}

/** 解析 es.exe 路径（缓存结果；未找到缓存 null） */
export function resolveEsExecutable(): string | null {
  if (cachedEsPath !== undefined) return cachedEsPath;
  for (const candidate of candidateEsPaths()) {
    try {
      if (existsSync(candidate)) {
        cachedEsPath = candidate;
        return cachedEsPath;
      }
    } catch {
      // ignore
    }
  }
  cachedEsPath = null;
  return cachedEsPath;
}

/** 测试用：清空路径缓存 */
export function resetEsExecutableCache(): void {
  cachedEsPath = undefined;
}

function runEs(esPath: string, args: string[], timeoutMs = 4000): Promise<{ code: number | null; stdout: string }> {
  return new Promise((resolve) => {
    let stdout = '';
    const child = spawn(esPath, args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const timer = setTimeout(() => {
      child.kill();
    }, timeoutMs);
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
      if (stdout.length > 2_000_000) {
        child.kill();
      }
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout });
    });
    child.on('error', () => {
      clearTimeout(timer);
      resolve({ code: null, stdout: '' });
    });
  });
}

/**
 * 用 Everything 搜索文件名
 * @returns 成功返回结果；Everything 不可用返回 null
 */
export async function searchWithEverything(
  keyword: string,
  limit = 80,
): Promise<EverythingSearchResult | null> {
  const query = keyword.trim();
  if (!query) return { items: [], engine: 'everything' };

  const esPath = resolveEsExecutable();
  if (!esPath) return null;

  const max = Math.max(1, Math.min(300, Math.floor(limit)));
  // -full-path-and-name 输出完整路径；-csv -no-header 便于解析
  const { code, stdout } = await runEs(esPath, [
    query,
    '-n', String(max),
    '-full-path-and-name',
    '-csv',
    '-no-header',
  ]);

  // exit 8：无 Everything IPC 窗口（未运行 / Lite 版）
  if (code === 8 || code === null) return null;
  if (code !== 0 && code !== 9) {
    // 9 = no results（配合 -no-result-error 时）；其它错误回退
    if (code !== 0) return null;
  }

  const lines = stdout
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^"|"$/g, ''))
    .filter(Boolean);

  const items: LocalFileSearchItem[] = [];
  for (const path of lines) {
    if (items.length >= max) break;
    const name = path.split(/[\\/]/).pop() || path;
    const isDirectory = !name.includes('.');
    items.push({ name, path, isDirectory });
  }
  return { items, engine: 'everything' };
}
