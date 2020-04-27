const { app, BrowserWindow, ipcMain, globalShortcut } = require("electron");
const { createWorker, setLogging } = require("@ffmpeg/ffmpeg");
setLogging(true);
const fs = require("fs");

if(!fs.existsSync("./video")) {
  fs.mkdirSync("./video");
}

function secondsToTimestamp(seconds) {
  let h = Math.floor(seconds/3600 % 60).toString();
  h = h.length==1?`0${h}`:h;
  let m = Math.floor(seconds/60 % 60).toString();
  m = m.length==1?`0${m}`:m;
  let s = Math.floor(seconds % 60).toString();
  s = s.length==1?`0${s}`:s;
  let ms = ((seconds%1)).toFixed(4).split(".")[1];
  return `${h}:${m}:${s}.${ms}`;
}

ipcMain.handle("ffmpeg:job", async (event, message)=>{

  let crop = message.crop;

  let cropX = Math.floor(crop.x)+1; //Pixel 0 doesn't exist
  let cropY = Math.floor(crop.y)+1;
  let cropW = Math.floor(crop.width)+1;
  let cropH = Math.floor(crop.height)+1;

  const worker = createWorker();

  let cropStr = cropW === message.width && cropH === message.height ? `` : `-filter:video crop=${cropW}:${cropH}:${cropX}:${cropY}`;

  await worker.load();
  await worker.write(`${message.file}`,`./video/${message.file}`);
  await worker.run(`-i ${message.file} -ss ${secondsToTimestamp(message.scrubber.begin)} -t ${secondsToTimestamp(message.scrubber.end)} ${cropStr} -preset ultrafast ${message.id}-final.${message.type}`);

  const { data } = await worker.read(`${message.id}-final.${message.type}`);
  fs.writeFileSync(`${__dirname}/./video/${message.id}.${message.type}`,data);
  await worker.terminate();

  return `${__dirname}/./video/${message.id}.${message.type}`;
});

function generateFFfilter(inputs) {
  /*
    Inputs = {
      x: int,
      y: int,
      width: int,
      height: int
    }[]
  */

  let outStr = "";
}

ipcMain.handle("ffmpeg:splice", async (event,message)=>{
  let inputs = message.inputs;

  const worker = createWorker();
  await worker.load();

  let inputStr = ``;
  for(i=0;i<inputs.length;i++) {
    inputStr += `-i ${inputs[i].file} `;
    await worker.write(`${inputs[i].file}`,`./video/${inputs[i].file}`);
  }

  await worker.run(`${inputStr} `);
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 300,
    height: 70,
    webPreferences: {
      nodeIntegration: true
    },
    frame: false,
    transparent: true,
    //resizable: false
  });

  mainWindow.loadURL(`file://${__dirname}/html/index.html`);
  global.mainWindow = mainWindow;
  globalShortcut.register("Super+Shift+D",()=>{
    mainWindow.webContents.send("do-crop","");
  });
}

app.whenReady().then(()=>setTimeout(createWindow,1000));
