/**
 * @file scripts/patch-electron-vite-hide-console.js
 * @description 给 electron-vite 的 startElectron 加 windowsHide，避免 Windows 下拉起 Electron 时闪控制台。
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
const from = "{ stdio: 'inherit' }";
const to = "{ stdio: 'inherit', windowsHide: true }";

if (text.includes(to)) {
  console.log('[patch] already applied');
  process.exit(0);
}
if (!text.includes(from)) {
  console.log('[patch] spawn options not found, skip');
  process.exit(0);
}

text = text.replace(from, to);
fs.writeFileSync(file, text, 'utf-8');
console.log('[patch] electron-vite windowsHide applied:', file);
