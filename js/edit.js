const { remote, ipcRenderer } = require("electron");
const mainWindow = remote.getGlobal("mainWindow");
const { createWorker } = FFmpeg;
const fs = require("fs");

console.log("UHYUHUHUUHH");


ipcRenderer.on("vid-src",(event,message)=>{
const Scrubber = require("./scrubber.js");

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

function updateCropRegion() {
  let rect = $("#video-preview")[0].getBoundingClientRect();
  let wScale = rect.width/1920;
  let hScale = rect.height/1080;
  let crop = message.crop;

  $("#left").css("left",`${rect.x}px`);
  $("#left").css("top",`${rect.y}px`);
  $("#left").css("width",`${crop.x*wScale}`);
  $("#left").css("height",`${rect.height}px`);

  $("#top").css("left",`${rect.x+crop.x*wScale}px`);
  $("#top").css("top",`${rect.y}px`);
  $("#top").css("width",`${crop.width*wScale}px`);
  $("#top").css("height",`${crop.y*hScale}px`);

  $("#bottom").css("left",`${rect.x+crop.x*wScale}px`);
  $("#bottom").css("top",`${rect.y+crop.height*hScale}px`);
  $("#bottom").css("width",`${crop.width*wScale}px`);
  $("#bottom").css("height",`${rect.height-crop.height*hScale}px`);

  $("#right").css("left",`${rect.x+((crop.width+crop.x)*wScale)}px`);
  $("#right").css("top",`${rect.y}px`);
  $("#right").css("width",`${rect.width-((crop.width+crop.x)*wScale)}px`);
  $("#right").css("height",`${rect.height}px`);
}

updateCropRegion();

$(window).resize(()=>{
  updateScreenSize();
});

setInterval(()=>scrubber.render(),1000/100);
setInterval(()=>updateCropRegion(),1000/10);

updateScreenSize();

let draggingScrubber = false;
let mousedownScrubber = false;

let x1;
let y1;

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
  ipcRenderer.invoke("ffmpeg:job",{
    ...message,
    scrubber: {
      begin: scrubber.beginTime,
      end: scrubber.endTime
    }
  })
    .then(e=>alert(e)).catch(()=>{});
});

});
