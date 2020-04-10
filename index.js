const { app, BrowserWindow } = require("electron");

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 500,
    height: 70,
    webPreferences: {
      nodeIntegration: true
    },
    frame: false,
    transparent: true,
    // resizable: false
  });
  //mainWindow.show();

  mainWindow.loadURL(`file://${__dirname}/html/index.html`);
  //mainWindow.setResizable(false);

  global.mainWindow = mainWindow;
}

app.whenReady().then(setTimeout(createWindow,1000));
