const { remote, ipcRenderer } = require("electron");
const mainWindow = remote.getGlobal("mainWindow");

ipcRenderer.on("do-crop",()=>{

let x1 = 0;
let y1 = 0;
let x2 = 0;
let y2 = 0;

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

$("body").on("mousemove",e=>{
  x2 = e.pageX;
  y2 = e.pageY;

  let w = $(window).width();
  let h = $(window).height();

  let minX = Math.min(x1,e.pageX);
  let minY = Math.min(y1,e.pageY);

  let maxX = Math.max(x1,e.pageX);
  let maxY = Math.max(y1,e.pageY);

  if(dragging) {
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

});

});

// });
