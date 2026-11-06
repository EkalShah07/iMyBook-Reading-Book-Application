// main.js - Electron main process: creates the application window.
const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    title: 'iMyBook - Reading Book Application',
    webPreferences: {
      nodeIntegration: false, // renderer is plain web code (safer)
      contextIsolation: true
    }
  });

  Menu.setApplicationMenu(null); // simple clean window, navigation is inside the app
  win.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
