const { remote, ipcRenderer } = require("electron");
const mainWindow = remote.getGlobal("mainWindow");

ipcRenderer.on("do-crop",(event,message)=>{

let display = message.browser.display; //Get the screen that this window represents
let otherScreens = message.wcIds; //webContent id's of the other renderers to communicate with

function broadcast(channel,message) {
  otherScreens.forEach(id=>{
    ipcRenderer.sendTo(id, channel, message);
  });
}

let region = {};
let dragging = false;

$("body").on("mousedown",e=>{
  dragging = true;

  x1 = e.pageX;
  y1 = e.pageY;
});

$("body").on("mouseup",e=>{ //We done
  dragging = false;

  let minX = Math.min(x1,x2);
  let minY = Math.min(y1,y2);
  let maxX = Math.max(x1,x2);
  let maxY = Math.max(y1,y2);

  if(e.pageX != x1 && e.pageY != y1) {
    mainWindow.webContents.send("crop-size",{x:minX,y:minY,width:maxX-minX,height:maxY-minY});
  } else {
    mainWindow.webContents.send("crop-failed");
  }
  remote.getCurrentWindow().close();
});

function updateRegion() {
  let minX = region.x1+display.bounds.x;
  let minY = region.y1+display.bounds.y;

  let maxX = region.x2+display.bounds.x;
  let maxY = region.y2+display.bounds.y;

  $("#left").css("width",`${minX}px`);

  $("#right").css("left",`${maxX}px`);
  $("#right").css("width",`${w-maxX}px`);

  $("#top").css("width",`${maxX-minX}px`);
  $("#top").css("height",`${minY}px`);

  $("#bottom").css("width",`${maxX-minX}px`);
  $("#bottom").css("height",`${h-maxY}px`);
  $("#bottom").css("left",`${minX}px`);
  $("#bottom").css("top",`${maxY}px`);

  $("#selection").css("width",`${maxX-minX}px`);
  $("#selection").css("height",`${maxY-minY}px`);

  $("#top").css("left",`${minX}px`);
  $("#bottom").css("left",`${minX}px`);

  $("#selection").css("left",`${minX}px`);
  $("#selection").css("top",`${minY}px`);
}

ipcRenderer.on("crop:state",(event,message)=>{
  dragging = message.dragging;
  region = message.region;
  updateRegion();
});

$("body").on("mousemove",e=>{
  if()

  updateRegion();
});

});
