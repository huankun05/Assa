/**
 * @file scripts/patch-electron-vite-hide-console.js
 * @description 给 electron-vite 的 startElectron：
 *  1) spawn 用 windowsHide + ignore/detached，避免 Windows 闪控制台
 *  2) close 时若存在 soft-restart 标志，原地再拉 electron（不整段杀 CLI）
 * npm install 后可能被还原，故挂在 postinstall；幂等可重复执行。
 */
const fs = require('fs');
const path = require('path');

const file = path.join(
  __dirname,
  '..',
  'node_modules',
  'electron-vite',
  'dist',
  'chunks',
  'lib-q6ns0vZr.js',
);

if (!fs.existsSync(file)) {
  console.log('[patch] electron-vite chunk not found, skip');
  process.exit(0);
}

let text = fs.readFileSync(file, 'utf-8');

const spawnOld = "{ stdio: 'inherit' }";
const spawnOld2 = "{ stdio: 'inherit', windowsHide: true }";
const spawnOld3 = "{ stdio: 'ignore', windowsHide: true, detached: true }";
const spawnNew = "{ stdio: 'ignore', windowsHide: true, detached: true }";

// close 原逻辑是 process.exit；也可能已是旧补丁。
// 旧补丁根因 bug：CLI 不传 root 时 root===undefined，
// fs.realpathSync(undefined) 抛错被吞，直接 process.exit，flag 残留。
const closeOld = `ps.on('close', process.exit);`;
const closeBrokenA = `ps.on('close', (code) => {
        try {
            const rootReal = fs.realpathSync(root);
            const flag = path.join(rootReal, 'data', 'soft-restart.flag');
            if (fs.existsSync(flag)) {
                fs.unlinkSync(flag);
                setTimeout(() => {
                    try { startElectron(root); } catch (e) { console.error(e); }
                }, 1500);
                return;
            }
        } catch (e) { /* ignore */ }
        process.exit(code);
    });`;
const closeBrokenB = `ps.on('close', (code) => {
        try {
            const base = root || process.cwd();
            const candidates = [];
            try { candidates.push(path.join(fs.realpathSync(base), 'data', 'soft-restart.flag')); } catch (e) { /* ignore */ }
            try { candidates.push(path.join(base, 'data', 'soft-restart.flag')); } catch (e) { /* ignore */ }
            try { candidates.push(path.join(require('os').tmpdir(), 'assa-soft-restart.flag')); } catch (e) { /* ignore */ }
            const hit = candidates.find((flag) => {
                try { return flag && fs.existsSync(flag); } catch (e) { return false; }
            });
            if (hit) {
                try { fs.unlinkSync(hit); } catch (e) { /* ignore */ }
                try {
                    const log = path.join(require('os').tmpdir(), 'assa-dev-restart.log');
                    fs.appendFileSync(log, '[patch] soft-restart flag hit, relaunch electron\\n');
                } catch (e) { /* ignore */ }
                setTimeout(() => {
                    try { startElectron(root); } catch (e) { console.error(e); }
                }, 1500);
                return;
            }
        } catch (e) { /* ignore */ }
        process.exit(code);
    });`;

const closeNew = `ps.on('close', (code) => {
        try {
            const base = root || process.cwd();
            const tmp = process.env.TEMP || process.env.TMP || base;
            const candidates = [];
            try { candidates.push(path.join(fs.realpathSync(base), 'data', 'soft-restart.flag')); } catch (e) { /* ignore */ }
            try { candidates.push(path.join(base, 'data', 'soft-restart.flag')); } catch (e) { /* ignore */ }
            try { candidates.push(path.join(tmp, 'assa-soft-restart.flag')); } catch (e) { /* ignore */ }
            const hit = candidates.find((flag) => {
                try { return flag && fs.existsSync(flag); } catch (e) { return false; }
            });
            if (hit) {
                try { fs.unlinkSync(hit); } catch (e) { /* ignore */ }
                try {
                    fs.appendFileSync(path.join(tmp, 'assa-dev-restart.log'), '[patch] soft-restart flag hit, relaunch electron\\n');
                } catch (e) { /* ignore */ }
                setTimeout(() => {
                    try { startElectron(root); } catch (e) { console.error(e); }
                }, 1500);
                return;
            }
        } catch (e) { /* ignore */ }
        process.exit(code);
    });`;

let dirty = false;

if (text.includes(spawnOld)) {
  text = text.split(spawnOld).join(spawnNew);
  dirty = true;
} else if (text.includes(spawnOld2)) {
  text = text.split(spawnOld2).join(spawnNew);
  dirty = true;
} else if (text.includes(spawnOld3)) {
  // already spawn new
} else {
  console.log('[patch] spawn options not found');
}

if (text.includes(closeOld)) {
  text = text.split(closeOld).join(closeNew);
  dirty = true;
} else if (text.includes(closeBrokenA)) {
  text = text.split(closeBrokenA).join(closeNew);
  dirty = true;
} else if (text.includes(closeBrokenB)) {
  text = text.split(closeBrokenB).join(closeNew);
  dirty = true;
}

if (!dirty && text.includes(spawnNew) && text.includes("soft-restart flag hit")) {
  console.log('[patch] already applied');
  process.exit(0);
}

fs.writeFileSync(file, text, 'utf-8');
console.log('[patch] electron-vite hide-console + soft-restart applied:', file);
