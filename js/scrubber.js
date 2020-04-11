const margin = 60;
const BLUE = "#0f89f5";

function secondsToTimestamp(seconds) {
  let h = Math.floor(seconds/3600 % 60).toString();
  h = h.length==1?`0${h}`:h;
  let m = Math.floor(seconds/60 % 60).toString();
  m = m.length==1?`0${m}`:m;
  let s = Math.floor(seconds % 60).toString();
  s = s.length==1?`0${s}`:s;
  let ms = ((seconds%1)).toFixed(2).split(".")[1];
  return `${h}:${m}:${s}.${ms}`;
}

function calculateTimelinePos(s,time) {
  return (time/s.length)*(s.width-(margin*2))+margin;
}

function calculateTimelinePosFromX(s,x) {
  return (x-margin)/(s.width-(margin*2))*s.length;
}

function calcPlaybackHeadX(s) {
  return calculateTimelinePos(s,s.currentTime);
}

function drawPlaybackHead(s) {
  let ctx = s.context;

  let x = calcPlaybackHeadX(s);

  ctx.fillStyle = BLUE;
  ctx.strokeStyle = BLUE;
  ctx.beginPath();
  ctx.moveTo(x-20,margin-20);
  ctx.lineTo(x+20,margin-20);
  ctx.lineTo(x,margin);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(x,margin);
  ctx.lineTo(x,s.height);
  ctx.closePath();
  ctx.stroke();
}

function drawTrim(s) {
  let ctx = s.context;

  let tWidth = 40; //trimmer width
  let tHeight = s.height-(margin*2); //trimmer height

  let beginTrimX = calculateTimelinePos(s,s.beginTime)-tWidth;
  let endTrimX = calculateTimelinePos(s,s.endTime);

  let borderThickness = 5;
  let borderRadius = 15;

  ctx.fillStyle = "#f2a427";
  ctx.strokeStyle = "#f2a427";

  ctx.beginPath();

  //Left trim marker


  ctx.arc(beginTrimX+borderRadius,margin+borderRadius,borderRadius,Math.PI,Math.PI*1.5); //Top left
  ctx.lineTo(beginTrimX+tWidth,margin); //Top right
  ctx.lineTo(beginTrimX+tWidth,margin+tHeight); //Bottom right
  ctx.arc(beginTrimX+borderRadius,margin+tHeight-borderRadius,borderRadius,Math.PI*0.5,Math.PI); //Bottom left
  ctx.closePath();

  //Top and bottom borders

  if(!s.trimming) {
    ctx.rect(beginTrimX+tWidth,margin,endTrimX-beginTrimX-tWidth,borderThickness);
    ctx.rect(beginTrimX+tWidth,margin+tHeight-borderThickness,endTrimX-beginTrimX-tWidth,borderThickness);
  }

  ctx.moveTo(endTrimX,margin);
  ctx.arc(endTrimX+tWidth-borderRadius,margin+borderRadius,borderRadius,Math.PI*1.5,0);
  ctx.arc(endTrimX+tWidth-borderRadius,margin+tHeight-borderRadius,borderRadius,0,Math.PI*0.5);
  ctx.lineTo(endTrimX,margin+tHeight);

  ctx.closePath();

  if(!s.trimming) ctx.fill();
  else ctx.stroke();

  ctx.fillStyle = "#000";
}

function isOverHead(s,x,y) {
  let minX = margin;
  let minY = 0;
  let maxX = s.width-margin;
  let maxY = margin;

  return x >= minX && x <= maxX && y >= minY && y <= maxY;
}

function clamp(num,min,max) {
  return Math.max(min,Math.min(num,max));
}

class Scrubber {
  constructor(ctx,length,width,height,video) {
    this.context = ctx;
    this.length = length;
    this.currentTime = 0;

    this.width = width;
    this.height = height;

    this.beginTime = 0;
    this.endTime = this.length;

    this.draggingHead = false;
    this.draggingTrim1 = false;
    this.draggingTrim2 = false;

    this.video = video;
    this.dragOffset = 0;
  }

  setTime(time) {
    this.currentTime = time;
  }

  getPlaybackHead() {
    return this.currentTime;
  }

  onUserScrubbed(time) {}

  onClick(x,y) {
  }

  onMousedown(x,y) {
    this.draggingHead = isOverHead(this,x,y);

    let trimPos1 = calculateTimelinePos(this,this.beginTime);
    let trimPos2 = calculateTimelinePos(this,this.endTime);

    this.draggingTrim1 = x >= trimPos1-this.tWidth && x <= trimPos1 && y >= margin && y <= margin+this.tHeight;
    this.draggingTrim2 = x >= trimPos2 && x <= trimPos2 + this.tWidth && y >= margin && y <= margin+this.tHeight;

    if(this.draggingTrim1) {
      this.dragOffset = trimPos1-x;
    } else if(this.draggingTrim2) {
      this.dragOffset = trimPos2-x;
    }
  }

  onMouseup(x,y) {
    this.draggingHead = false;
    this.draggingTrim1 = false;
    this.draggingTrim2 = false;
  }

  onDrag(x1,y1,x2,y2) {
    if(this.draggingHead) {
      this.currentTime = clamp(calculateTimelinePosFromX(this,x2),this.beginTime,this.endTime);
      this.onUserScrubbed(this.currentTime);
    }
    if(this.draggingTrim1) {
      this.beginTime = clamp(calculateTimelinePosFromX(this,x2+this.dragOffset),0,this.endTime);
      this.currentTime = clamp(this.currentTime,this.beginTime,this.endTime);
      this.onUserScrubbed(this.currentTime);
    } else if(this.draggingTrim2) {
      this.endTime = clamp(calculateTimelinePosFromX(this,x2+this.dragOffset),this.beginTime,this.length);
      this.currentTime = clamp(this.currentTime,this.beginTime,this.endTime);
      this.onUserScrubbed(this.currentTime);
    }
    this.trimming = this.draggingTrim1 || this.draggingTrim2;
  }

  setDimensions(width,height) {
    this.width = width;
    this.height = height;
  }

  render() {
    this.tWidth = 40; //trimmer width
    this.tHeight = this.height-(margin*2); //trimmer height

    this.context.clearRect(0,0,this.width,this.height);

    this.context.save();

    this.context.rect(margin,margin,this.width-margin*2,this.height - (margin*2)); //Clip everything outside the timeline
    this.context.clip();

    this.context.fillStyle = "#191919";
    this.context.rect(0,0,this.width,this.height); //Draw the timeline fill
    this.context.fill();

    this.context.restore(); //Restore the normal "un-clipped" state
    this.context.save(); //Save the unclipped state

    this.context.beginPath(); //clear the path just in case?
    this.context.rect(margin,margin,this.width-margin*2,this.height - (margin*2)); //Clip everything outside the timeline
    this.context.clip();

    //Draw timeline elements here.
    let timelineHeight = this.height-margin*2;
    let timelineWidth = this.width-margin*2;

    let vertScale = timelineHeight/this.video.videoHeight;
    let horizScale = timelineWidth/this.video.videoWidth;

    this.context.scale(horizScale,vertScale);

    this.context.filter = "blur(5px)";
    this.context.drawImage(this.video,margin/horizScale,margin/vertScale);
    this.context.filter = "none";


    this.context.setTransform(1, 0, 0, 1, 0, 0); //Reset transformation matrix

    this.context.beginPath();
    this.context.fillStyle = "rgba(0, 0, 0, 0.7)";
    this.context.rect(margin,margin,calculateTimelinePos(this.beginTime)-margin,timelineHeight);
    this.context.rect(margin+calculateTimelinePos(this.endTime),margin,timelineWidth-calculateTimelinePos(this.beginTime)-margin,timelineHeight);
    this.context.fill();

    this.context.restore(); //Restore the unclipped state

    this.context.beginPath(); //Reset the path
    drawTrim(this);

    drawPlaybackHead(this);

    this.context.font = "30px Quicksand-Medium";

    this.context.fillStyle = BLUE;
    this.context.fillText(secondsToTimestamp(this.currentTime),20,40);

    this.context.fillStyle = "#fff";
    this.context.fillText(secondsToTimestamp(this.endTime-this.beginTime),250,40);

    if(this.trimming) {
      let time = this.draggingTrim1 ? this.beginTime : this.endTime;
      let x = calculateTimelinePos(this,time)+this.tWidth+5;
      let str = secondsToTimestamp(time);
      x = Math.min(timelineWidth+margin-this.context.measureText(str).width,x);
      this.context.fillStyle = "#f2a427";
      this.context.fillText(str,x,margin+this.tHeight/2);
    }

  }
}

module.exports = Scrubber;
