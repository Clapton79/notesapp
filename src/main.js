const { app, BrowserWindow, ipcMain, shell } = require('electron');
const fs = require('fs');
const path = require('path');

const file = () => path.join(app.getPath('userData'), 'notes.json');

ipcMain.handle('load', () => {
  try { return JSON.parse(fs.readFileSync(file(), 'utf8')); } catch (e) { return null; }
});
ipcMain.handle('save', (_e, data) => {
  fs.mkdirSync(path.dirname(file()), { recursive: true });
  const tmp = file() + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data));
  fs.renameSync(tmp, file());
  return true;
});
ipcMain.handle('open-external', (_e, url) => {
  if (/^(https?:\/\/|mailto:)/i.test(url)) return shell.openExternal(url);
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1200, height: 800, title: 'Notes App',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  win.setMenuBarVisibility(false);
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
