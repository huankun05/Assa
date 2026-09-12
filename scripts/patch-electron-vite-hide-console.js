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

const closeOld = `ps.on('close', process.exit);`;
const closeNew = `ps.on('close', (code) => {
        try {
            const tmp = process.env.TEMP || process.env.TMP || process.env.TMPDIR || '.';
            const flag = path.join(tmp, 'xiyue-soft-restart.flag');
            if (fs.existsSync(flag)) {
                fs.unlinkSync(flag);
                setTimeout(() => {
                    try { startElectron(root); } catch (e) { console.error(e); }
                }, 700);
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
}

if (!dirty && text.includes(spawnNew) && text.includes('xiyue-soft-restart.flag')) {
  console.log('[patch] already applied');
  process.exit(0);
}

fs.writeFileSync(file, text, 'utf-8');
console.log('[patch] electron-vite hide-console + soft-restart applied:', file);
