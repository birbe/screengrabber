const { remote, ipcRenderer } = require("electron");
const mainWindow = remote.getGlobal("mainWindow");
const { createWorker } = FFmpeg;
const path = require("path");
const fs = require("fs");
const shell = remote.shell;

ipcRenderer.on("vid-src",(event,message)=>{
const Scrubber = require("./scrubber.js");

$("#video-preview").attr("src",`${__dirname}/../video/${message.file}`);

console.log(message);

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
  let wScale = rect.width/message.width;
  let hScale = rect.height/message.height;
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
  $("#bottom").css("top",`${rect.y+(crop.height+crop.y)*hScale}px`);
  $("#bottom").css("width",`${crop.width*wScale}px`);
  $("#bottom").css("height",`${rect.height-((crop.height+crop.y)*hScale)}px`);

  $("#right").css("left",`${rect.x+((crop.width+crop.x)*wScale)}px`);
  $("#right").css("top",`${rect.y}px`);
  $("#right").css("width",`${rect.width-((crop.width+crop.x)*wScale)}px`);
  $("#right").css("height",`${rect.height}px`);

  $("#crop-selection").css("left",`${rect.x+crop.x*wScale}px`);
  $("#crop-selection").css("top",`${rect.y+crop.y*hScale}px`);
  $("#crop-selection").css("width",`${crop.width*wScale}px`);
  $("#crop-selection").css("height",`${crop.height*hScale}px`);

  $("#crop-top-left").css("top",`${rect.y+crop.y*hScale-20}px`);
  $("#crop-top-left").css("left",`${rect.x+crop.x*wScale-20}px`);

  $("#crop-bottom-right").css("top",`${rect.y+(crop.y+crop.height)*hScale+1}px`);
  $("#crop-bottom-right").css("left",`${rect.x+(crop.x+crop.width)*wScale+1}px`);
}

function clamp(num,min,max) {
  return Math.max(min,Math.min(num,max));
}


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

(function() { //Keep the scope clean
  let offsetX = 0;
  let offsetY = 0;
  let draggingTL = false; //Top left
  let draggingBR = false; //Bottom right
  let dragging = false;

  $("#crop-top-left").mousedown(e=>{
    dragging = true;
    draggingTL = true;
    draggingBR = false;

    let rect = $("#crop-top-left")[0].getBoundingClientRect();
    offsetX = e.pageX-rect.x;
    offsetY = e.pageY-rect.y;
  });

  $("#crop-bottom-right").mousedown(e=>{
    dragging = true;
    draggingBR = true;
    draggingTL = false;

    let rect = $("#crop-bottom-right")[0].getBoundingClientRect();
    offsetX = rect.x-e.pageX;
    offsetY = rect.y-e.pageY;
  });

  $(document).on("mousemove",e=>{
    let rect = $("#video-preview")[0].getBoundingClientRect();
    let crop = message.crop;

    let relX = e.pageX+offsetX-rect.x; //Relative x & y coords, adjusted to the video frame
    let relY = e.pageY+offsetY-rect.y;

    let wScale = rect.width/message.width;
    let hScale = rect.height/message.height;

    let cropX = relX / wScale;
    let cropY = relY / hScale;

    let x1 = crop.x;
    let y1 = crop.y;
    let x2 = crop.x+crop.width;
    let y2 = crop.y+crop.height;

    if(dragging) {
      if(draggingTL) {
        x1 = clamp(cropX-offsetX,0,x2-1);
        y1 = clamp(cropY-offsetY,0,y2-1);
      } else if(draggingBR) {
        x2 = clamp(cropX-offsetX,x1+1,message.width);
        y2 = clamp(cropY-offsetY,y1+1,message.height);
      }
    }

    crop.x = x1;
    crop.y = y1;
    crop.width = x2-x1;
    crop.height = y2-y1;

    updateCropRegion();
  });

  $(document).on("mouseup",e=>{
    dragging = false;
    draggingBR = false;
    draggingTR = false;
  });
})();

function saveVideo(ext) {
  ipcRenderer.invoke("ffmpeg:job",{
    ...message,
    scrubber: {
      begin: scrubber.beginTime,
      end: scrubber.endTime
    },
    type: ext,
    width: message.width,
    height: message.height
  })
  .then(e=>{
    alert("Exported");
  }).catch(()=>{});
}

$("#close-btn").click(()=>{
  remote.getCurrentWindow().close();
});

$("#min-btn").click(()=>{
  remote.getCurrentWindow().minimize();
});

$(".mp4").click(async ()=>{
  console.log("mp4");
  saveVideo("mp4");
});

$(".gif").click(async ()=>{
  saveVideo("gif");
});

$(window).resize(()=>{
  updateScreenSize();
});

updateCropRegion();
setInterval(()=>scrubber.render(),1000/100);
setInterval(()=>updateCropRegion(),1000/10);

updateScreenSize();

});
