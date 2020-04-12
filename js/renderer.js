$(document).ready(()=>{

const { desktopCapturer, remote, ipcRenderer } = require("electron");
const fs = require("fs");
const crypto = require("crypto");

let recording = false;
let state;

function getScreen(id) {
  return remote.screen.getAllDisplays().find(s=>s.id==id);
}

function getScreenDimensions(id) {
  return remote.screen.getAllDisplays().find(s=>s.id==id).size;
}

function getScreensInRegion(region) {
  let out = [];
  let screens = remote.screen.getAllDisplays();

  screens.forEach(screen=>{
    let containsMinX = region.min.x >= screen.bounds.x && region.min.x <= screen.bounds.x+screen.bounds.width;
    let containsMaxX = region.max.x >= screen.bounds.x && region.max.x <= screen.bounds.x+screen.bounds.width;
    let containsMinY = region.min.y >= screen.bounds.y && region.min.y <= screen.bounds.y+screen.bounds.height;
    let containsMaxY = region.max.y >= screen.bounds.y && region.max.y <= screen.bounds.y+screen.bounds.height;

    console.log(screen);
    console.log(containsMinX);
    console.log(containsMaxX);
    console.log(containsMinY);
    console.log(containsMaxY);
    if((containsMinX || containsMaxX) && (containsMinY || containsMaxY)) out.push(screen);
  });

  return out;
}

function getScreensIDSInRegion(region) {
  return getScreensInRegion(region).map(d=>{return d.id;});
}

async function asyncForEach(arr,cb) {
  for(let i=0;i<arr.length;i++) await cb(arr[i]);
}

function record(crop) {
  recording = true;

  let sourcesOut = [];
  let screens = getScreensInRegion(crop);
  let screenIds = getScreensIDSInRegion(crop);

  let hasId = id=>{
    let yes = false;
    screens.forEach(s=>{
      if(s.id == id) yes = true;
    });
    return yes;
  }

  return new Promise(async (res,rej)=>{

    let sources = await desktopCapturer.getSources({types:["screen"]});

    await asyncForEach(sources, async source=>{
      if(!hasId(source.display_id)) return;

      let displaySize = getScreenDimensions(source.display_id);

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            mandatory: {
              chromeMediaSource: "desktop",
              chromeMediaSourceId: source.id,
              minWidth: displaySize.width,
              maxWidth: displaySize.width,
              minHeight: displaySize.height,
              maxHeight: displaySize.height
            }
          }
        });

        sourcesOut.push({
          stream, display:getScreen(source.display_id)
        });

      } catch(e) {
        console.log("Failed getting media source!");
      }
    });

    let state = handleStreams({
      crop,
      sources: sourcesOut
    });
    res(state);
  });
}

function getVideoID() {
  return crypto.createHash("sha256").update(Date.now().toString()).digest("hex").substr(0,8);
}

function getCropSelection() {
  let cropWindows = [];
  let displays = remote.screen.getAllDisplays();
  let wcIds = [];
  for(i=0;i<displays.length;i++) {
    let browser = {
      window: new remote.BrowserWindow({
        x: displays[i].bounds.x,
        y: displays[i].bounds.y,
        width: displays[i].bounds.width,
        height: displays[i].bounds.height,
        webPreferences: {
          nodeIntegration: true
        },
        frame: false,
        transparent: true,
        resizable: false
      }),
      display: displays[i]
    }
    cropWindows.push(browser);

    browser.window.setFullScreen(true);
    browser.window.loadURL(`file://${__dirname}/../html/crop.html`);

    wcIds.push(browser.window.webContents.id);
  }

  cropWindows.forEach(info=>{
    info.window.webContents.once("dom-ready",()=>{
      info.window.webContents.send("do-crop",{
        wcIds,
        browser: info
      })
    });
  });

  cropWindows.forEach(info=>{
    info.window.webContents.once("crop-size",()=>info.window.close());
  });

}

function updateRecButton() {
  if(recording) {
    $("#stop-record").css("opacity","1");
    $("#stop-record").attr("disabled","false");

    $("#screen").css("opacity","0.4");
    $("#crop").css("opacity","0.4");
  } else {
    $("#stop-record").css("opacity","0.4");
    $("#stop-record").attr("disabled","true");

    $("#screen").css("opacity","1");
    $("#crop").css("opacity","1");
  }
}


async function beginRecording() {
  recording = true;
  updateRecButton();

  //remote.getCurrentWindow().minimize();

  if(!recording) { //not recording anymore
    state.stop();
  } else {
    state = await record();
    state.start();
  }
}

function createPreviewWindow() {
  let previewWindow = new remote.BrowserWindow({
    width: 1920/4,
    height: 1080/4+20,
    frame: false
  });
  previewWindow.loadURL(`file://${__dirname}/../html/preview.html`);
  previewWindow.webContent.once("dom-ready",()=>previewWindow.webContent.send());
}

function createEditingWindow(info) {
  let editingWindow = new remote.BrowserWindow({
    width: 800,
    height: 500,
    webPreferences: {
      nodeIntegration: true
    },
    frame: false,
  });

  editingWindow.loadURL(`file://${__dirname}/../html/edit.html`);

  editingWindow.webContents.once("dom-ready",()=>{
    editingWindow.webContents.send("vid-src",info);
  });
}

class StreamState {
  constructor(data) {
    this.sources = data.sources;
    this.recorders = [];
    this.crop = data.crop;
    this.active = false;
    this.videoId = getVideoID();

    this.startTime = 0;
    this.stopTime = 0;
  }

  init() {
    let num = 0;
    this.sources.forEach(source=>{
      let tId = num++;
      let recorderInfo = {
        recorder: new MediaRecorder(source.stream,{
          videoBitsPerSecond: 6*1000*1000,
          mimeType: "video/x-matroska"
        }),
        blobs: [],
        id:tId,
        fileId: `${this.videoId+tId}`,
        fileName: `${this.videoId+tId}.mkv`,
        display: source.display
      };

      recorderInfo.recorder.ondataavailable = event=>{
        recorderInfo.blobs.push(event.data);

        let bigblob = new Blob(recorderInfo.blobs, {type: "video/x-matroska"});
        let id = `${this.videoId+tId}`;
        let file = `${id}.mkv`;
        let fileReader = new FileReader();
        let $this = this;
        fileReader.onload = function() {
          let buf = Buffer.from(new Uint8Array(this.result));
          fs.writeFileSync(`./video/${file}`, buf);
        }
        fileReader.readAsArrayBuffer(bigblob);
      }
      this.recorders.push(recorderInfo);
    });
  }

  start() {
    this.startTime = Date.now();

    recording = true; //music makes me lose control
    this.recorders.forEach(r=>r.recorder.start());

    this.active = true;
  }

  stop() {
    this.stopTime = Date.now();
    this.active = false;

    let stopped = 0;
    this.recorders.forEach(recInfo=>{
      recInfo.recorder.onstop = async ()=>{
        stopped++;
        if(stopped == this.recorders.length) {
          //createEditingWindow({id,file,duration:$this.stopTime-$this.startTime,crop:$this.crop,width:$this.width,height:$this.height});
          await this.saveMedia();
          recording = false;
          updateRecButton();
        }
      };

      recInfo.recorder.stop();
    });
  }

  async saveMedia() {
    if(this.recorders.length > 1) {
      ipcMain.invoke("ffmpeg:splice",);
    } else {
      createEditingWindow({
        crop: {
          x: this.crop.relative.x,
          y: this.crop.relative.y,
          width: this.crop.relative.width,
          height: this.crop.relative.height
        },
        duration: this.stopTime-this.startTime,
        width: this.recorders[0].display.bounds.width,
        height: this.recorders[0].display.bounds.height,
        file: this.recorders[0].fileName,
        id: this.recorders[0].fileId
      });
    }
  }
}

function toArrayBuffer(blob, cb) {
    let fileReader = new FileReader();
    fileReader.onload = function() {
        let arrayBuffer = this.result;
        cb(arrayBuffer);
    };
    fileReader.readAsArrayBuffer(blob);
}

function toBuffer(ab) {
    let buffer = new Buffer(ab.byteLength);
    let arr = new Uint8Array(ab);
    for (let i = 0; i < arr.byteLength; i++) {
        buffer[i] = arr[i];
    }
    return buffer;
}

function handleStreams(data) {
  let state = new StreamState(data);
  state.init();
  return state;

  // const video = document.querySelector("video");
  // video.srcObject = stream;
  // video.onloadedmetadata = (e) => video.play();
}

ipcRenderer.on("docrop",()=>{
  getCropSelection();
});

ipcRenderer.on("crop-size",async (event,size)=>{
  state = await record(size);
  state.start();

  updateRecButton();
});

$("#screen").click(async ()=>{
  if(!recording) beginRecording();
});

$("#stop-record").click(()=>{
  if(recording) {
    state.stop();
    recording = false;
  }
  updateRecButton();
});
//MUSIC MAKES ME LOSE CONTROL
$("#crop").click(()=>{
  if(!recording) getCropSelection();
});

updateRecButton();

});
