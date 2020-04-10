$(document).ready(()=>{

const { desktopCapturer, remote, ipcRenderer } = require("electron");
const fs = require("fs");
const crypto = require("crypto");

let recording = false;
let state;

function record(x,y,width,height) {

  x = x || 0;
  y = y || 0;
  width = width || 1920;
  height = height || 1080;

  return new Promise((res,rej)=>{

    desktopCapturer.getSources({types:["screen"]}).then(async sources=>{
      const source = sources[0];
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            mandatory: {
              chromeMediaSource: "desktop",
              chromeMediaSourceId: source.id,
              minWidth: 1920,
              maxWidth: 1920,
              minHeight: 1080,
              maxHeight: 1080
            }
          }
        });

        let state = handleStream(stream);
        recording = true;
        res(state);

      } catch(e) {
        rej(e);
      }
    });
  });
}

ipcRenderer.on("crop-size",async (event,message)=>{
  let size = JSON.parse(message);
  state = await record();

});

function getVideoID() {
  return crypto.createHash("sha256").update(Date.now().toString()).digest("hex").substr(0,8);
}

function getCropSelection() {
  let cropWindow = new remote.BrowserWindow({
    width: 1920,
    height: 1080,
    webPreferences: {
      nodeIntegration: true
    },
    frame: false,
    transparent: true,
    resizable: false
  });

  cropWindow.setFullScreen(true);
  cropWindow.loadURL(`file://${__dirname}/../html/crop.html`);

  cropWindow.webContents.once("dom-ready",()=>cropWindow.webContents.send("do-crop",""));
}

$("#record").click(async ()=>{

  recording = !recording;

  remote.getCurrentWindow().minimize();

  let src = recording ? "../assets/stop.svg" : "../assets/dot.svg";

  if(!recording) { //not recording anymore
    state.stop();
  } else {
    state = await record();
    state.start();
  }

  $("#record-btn").attr("src",src);
});

$("#crop").click(()=>{
  getCropSelection();
});

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
    editingWindow.webContents.send("vid-src",info)
  });
}

class StreamState {
  constructor(stream) {
    this.stream = stream;
    this.recorder = new MediaRecorder(stream,{
      videoBitsPerSecond: 12*1000*1000,
      mimeType: "video/x-matroska"
    });
    this.startTime = 0;
    this.stopTime = 0;
    this.recorder.onstart = ()=>{
      this.startTime = Date.now();
    }
    this.recorder.onstop = ()=>{
      this.stopTime = Date.now();
    }
  }

  start() {
    this.blobs = [];

    this.recorder.start();
  }

  stop() {
    this.recorder.ondataavailable = event=>{
      this.blobs.push(event.data);

      let bigblob = new Blob(this.blobs, {type: "video/x-matroska"});
      let id = `${getVideoID()}`;
      let file = `${id}.mkv`;
      let fileReader = new FileReader();
      let $this = this;
      fileReader.onload = function() {
        let buf = Buffer.from(new Uint8Array(this.result));
        fs.writeFileSync(`./video/${file}`, buf);
        createEditingWindow({id,file,duration:$this.stopTime-$this.startTime});
      }
      fileReader.readAsArrayBuffer(bigblob);
    }
    this.recorder.stop();

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

function handleStream(stream) {
  return new StreamState(stream);

  // const video = document.querySelector("video");
  // video.srcObject = stream;
  // video.onloadedmetadata = (e) => video.play();
}

});
