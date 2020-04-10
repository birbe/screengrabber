const { remote, ipcRenderer } = require("electron");
const mainWindow = remote.getGlobal("mainWindow");
const { createWorker } = FFmpeg;
const fs = require("fs");

const Scrubber = require("./scrubber.js");

ipcRenderer.on("vid-src",(event,message)=>{

  console.log(message);

$("#video-preview").attr("src",`${__dirname}/../video/${message.file}`);

let scrub_ctx = $("#scrubber")[0].getContext("2d");
let video = $("#video-preview")[0];

let scrubber = new Scrubber(scrub_ctx, message.duration/1000, 0, 0, video);

scrubber.onUserScrubbed = t=>{
  video.currentTime = t;
}

function updateScreenSize() {
  let rect = $("#scrubber-panel")[0].getBoundingClientRect();
  let { width, height } = rect;

  scrubber.setDimensions(width, height);
  scrub_ctx.canvas.width = width;
  scrub_ctx.canvas.height = height;
}

$(window).resize(()=>{
  updateScreenSize()
});

setInterval(()=>scrubber.render(),1000/100);

updateScreenSize();

let draggingScrubber = false;
let mousedownScrubber = false;

let x1;
let y1;

function secondsToTimestamp(seconds) {
  let h = Math.floor(seconds/3600 % 60);
  h = h.length==1?`0${h}`:h;
  let m = Math.floor(seconds/60 % 60);
  m = m.length==1?`0${m}`:h;
  let s = Math.floor(seconds % 60);
  let ms = ((seconds%1)).toFixed(4).split(".")[1];
  return `${h}:${m}:${s}.${ms}`;
}

$("#scrubber").mousedown(e=>{
  mousedownScrubber = true;
  let pos = $("#scrubber").position();
  x1 = e.pageX-pos.left;
  y1 = e.pageY-pos.top;

  scrubber.onMousedown(x1,y1);
})
.mousemove(e=>{
  if(mousedownScrubber) draggingScrubber = true;
  let pos = $("#scrubber").position();
  let x2 = e.pageX-pos.left;
  let y2 = e.pageY-pos.top;

  scrubber.onDrag(x1,y1,x2,y2);
})
.mouseup(e=>{
  let pos = $("#scrubber").position();
  let x = e.pageX-pos.left;
  let y = e.pageY-pos.top;
  scrubber.onMouseup(x,y);
  if(!draggingScrubber) {
    scrubber.onClick(x,y);
  }

  draggingScrubber = false;
  mousedownScrubber = false;
});

$("#close-btn").click(()=>{
  remote.getCurrentWindow().close();
});

$("#min-btn").click(()=>{
  remote.getCurrentWindow().minimize();
});

$("#export-mp4").click(async ()=>{
  const worker = createWorker();

  await worker.load();
  await worker.write(`${message.file}`,`../video/${message.file}`);
  await worker.run(`-i ${message.file} -codec copy ${message.id}.mp4`);
  await worker.run(`-i ${message.id}.mp4 -ss ${secondsToTimestamp(scrubber.beginTime)} -t ${secondsToTimestamp(scrubber.endTime)} -c copy ${message.id}-trimmed.mp4`);
  
  const { data } = await worker.read(`${message.id}-trimmed.mp4`);
  fs.writeFileSync(`${__dirname}/../video/${message.id}.mp4`,data);
  await worker.terminate();
  alert("Exported!");
});

});
