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

function clamp(num,min,max) {
  return Math.max(min,Math.min(num,max));
}

let region = {
  min: {
    x: 0,
    y: 0,
    display
  },
  max: {
    x: 0,
    y: 0,
    display
  }
};
let dragging = false;

$(document).on("mousedown",e=>{
  dragging = true;
  let cursor = remote.screen.getCursorScreenPoint();
  region = {
    min: {
      ...cursor,
      display
    },
    max: {
      ...cursor,
      display
    }
  };
  broadcast("crop:state",{
    dragging,
    region
  });
});

$(document).on("mouseup",e=>{ //We done
  dragging = false;

  let cropsize = {
    min: {
      x: Math.min(region.min.x,region.max.x),
      y: Math.min(region.min.y,region.max.y)
    },
    max: {
      x: Math.max(region.min.x,region.max.x),
      y: Math.max(region.min.y,region.max.y)
    },
    relative: {
      x: Math.min(region.min.x,region.max.x)-region.min.display.bounds.x,
      y: Math.min(region.min.y,region.max.y)-region.min.display.bounds.y,
      width: Math.max(region.min.x,region.max.x)-Math.min(region.min.x,region.max.x),
      height: Math.max(region.min.y,region.max.y)-Math.min(region.min.y,region.max.y)
    }
  };

  mainWindow.webContents.send("crop-size",cropsize);
  broadcast("close","");
});

function updateRegion() {
  let minX = clamp( Math.min(region.min.x,region.max.x)-display.bounds.x, 0, display.bounds.width );
  let minY = clamp( Math.min(region.min.y,region.max.y)-display.bounds.y, 0, display.bounds.height );

  let maxX = clamp( Math.max(region.min.x,region.max.x)-display.bounds.x, 0, display.bounds.width );
  let maxY = clamp( Math.max(region.min.y,region.max.y)-display.bounds.y, 0, display.bounds.height );

  let w = display.bounds.width;
  let h = display.bounds.height;

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

ipcRenderer.on("close",()=>remote.getCurrentWindow().close());

$(document).on("mousemove",e=>{
  if(dragging) {
    let cursor = remote.screen.getCursorScreenPoint();
    region.max = {
      ...cursor,
      display
    }
    broadcast("crop:state",{
      dragging,
      region
    });
  }
});

});
