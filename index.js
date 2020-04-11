const { app, BrowserWindow, ipcMain } = require("electron");
const { createWorker } = require("@ffmpeg/ffmpeg");
const fs = require("fs");

function secondsToTimestamp(seconds) {
  let h = Math.floor(seconds/3600 % 60);
  h = h.length==1?`0${h}`:h;
  let m = Math.floor(seconds/60 % 60);
  m = m.length==1?`0${m}`:h;
  let s = Math.floor(seconds % 60);
  let ms = ((seconds%1)).toFixed(4).split(".")[1];
  return `${h}:${m}:${s}.${ms}`;
}

ipcMain.handle("ffmpeg:job",async (event, message)=>{

  let crop = message.crop;

  let cropX = Math.floor(crop.x);
  let cropY = Math.floor(crop.y);
  let cropW = Math.floor(crop.width);
  let cropH = Math.floor(crop.height);

  const worker = createWorker();

  await worker.load();
  await worker.write(`${message.file}`,`./video/${message.file}`);
  await worker.run(`-i ${message.file} -codec copy ${message.id}.mp4`);
  //await worker.run(`-i ${message.id}.mp4 -filter:v "crop=100:100:100:100" -codec copy ${message.id}-cropped.mp4`);
  await worker.run(`-i ${message.id}-cropped.mp4 -ss ${secondsToTimestamp(message.scrubber.begin)} -t ${secondsToTimestamp(message.scrubber.end)} -c copy ${message.id}-final.mp4`);

  const { data } = await worker.read(`${message.id}-final.mp4`);
  fs.writeFileSync(`${__dirname}/./video/${message.id}.mp4`,data);
  console.log(`${__dirname}/./video/${message.id}.mp4`);
  await worker.terminate();

  return `${__dirname}/./video/${message.id}.mp4`;
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 500,
    height: 70,
    webPreferences: {
      nodeIntegration: true
    },
    frame: false,
    transparent: true,
    resizable: false
  });
  //mainWindow.show();

  mainWindow.loadURL(`file://${__dirname}/html/index.html`);
  //mainWindow.setResizable(false);

  global.mainWindow = mainWindow;
}

app.whenReady().then(setTimeout(createWindow,1000));
