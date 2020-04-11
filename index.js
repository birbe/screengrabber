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

ipcMain.handle("ffmpeg:job",async (event, message)=>{

  let crop = message.crop;

  let cropX = Math.floor(crop.x)+1;
  let cropY = Math.floor(crop.y)+1;
  let cropW = Math.floor(crop.width)+1;
  let cropH = Math.floor(crop.height)+1;

  const worker = createWorker({
    logger: ({message})=>console.log(message)
  });

  await worker.load();
  await worker.write(`${message.file}`,`./video/${message.file}`);
  await worker.run(`-i ${message.file} -ss ${secondsToTimestamp(message.scrubber.begin)} -t ${secondsToTimestamp(message.scrubber.end)} -filter:video crop=${cropW}:${cropH}:${cropX}:${cropY} -threads 5 -preset ultrafast -strict -2 ${message.id}-final.mp4`);
  //await worker.run(`-i ${message.file} -codec copy ${message.id}.mp4`);
  //await worker.run(`-i ${message.id}.mp4 -filter:v "crop=100:100:100:100" -codec copy ${message.id}-cropped.mp4`);
  //await worker.run(`-i ${message.file} -filter:v "crop=${cropW}:${cropH}:${cropX}:${cropY}" -ss ${secondsToTimestamp(message.scrubber.begin)} -t ${secondsToTimestamp(message.scrubber.end)} ${message.id}-final.mp4`);

  const { data } = await worker.read(`${message.id}-final.mp4`);
  fs.writeFileSync(`${__dirname}/./video/${message.id}.mp4`,data);
  console.log(`${__dirname}/./video/${message.id}.mp4`);
  await worker.terminate();

  return `${__dirname}/./video/${message.id}.mp4`;
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
  //mainWindow.show();

  mainWindow.loadURL(`file://${__dirname}/html/index.html`);
  //mainWindow.setResizable(false);

  global.mainWindow = mainWindow;
  globalShortcut.register("Super+Shift+D",()=>{
    mainWindow.webContents.send("do-crop","");
  });
}

app.whenReady().then(()=>setTimeout(createWindow,1000));
