const MARGIN = 60;
const BLUE = "#0f89f5";

function secondsToTimestamp(seconds) {
  let h = Math.floor(seconds/3600 % 60).toString();
  h = h.length===1?`0${h}`:h;
  let m = Math.floor(seconds/60 % 60).toString();
  m = m.length===1?`0${m}`:m;
  let s = Math.floor(seconds % 60).toString();
  s = s.length===1?`0${s}`:s;
  let ms = ((seconds%1)).toFixed(2).split(".")[1];
  return `${h}:${m}:${s}.${ms}`;
}

function calculateTimelinePos(s,time) {
  return (time/s.length)*(s.width-(MARGIN*2))+MARGIN;
}

function calculateTimeFromX(s,x) {
  return (x-MARGIN)/(s.width-(MARGIN*2))*s.length;
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
  ctx.moveTo(x-20,MARGIN-20);
  ctx.lineTo(x+20,MARGIN-20);
  ctx.lineTo(x,MARGIN);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(x,MARGIN);
  ctx.lineTo(x,s.height);
  ctx.closePath();
  ctx.stroke();
}

function drawTrimmers(s) {
  let ctx = s.context;

  let tWidth = 40; //trimmer width
  let tHeight = s.height-(MARGIN*2); //trimmer height

  let beginTrimX = calculateTimelinePos(s,s.beginTime)-tWidth;
  let endTrimX = calculateTimelinePos(s,s.endTime);

  let borderThickness = 5;
  let borderRadius = 15;

  ctx.fillStyle = "#f2a427";
  ctx.strokeStyle = "#f2a427";

  ctx.beginPath();

  //Left trim marker


  ctx.arc(beginTrimX+borderRadius,MARGIN+borderRadius,borderRadius,Math.PI,Math.PI*1.5); //Top left
  ctx.lineTo(beginTrimX+tWidth,MARGIN); //Top right
  ctx.lineTo(beginTrimX+tWidth,MARGIN+tHeight); //Bottom right
  ctx.arc(beginTrimX+borderRadius,MARGIN+tHeight-borderRadius,borderRadius,Math.PI*0.5,Math.PI); //Bottom left
  ctx.closePath();

  //Top and bottom borders

  if(!s.trimming) {
    ctx.rect(beginTrimX+tWidth,MARGIN,endTrimX-beginTrimX-tWidth,borderThickness);
    ctx.rect(beginTrimX+tWidth,MARGIN+tHeight-borderThickness,endTrimX-beginTrimX-tWidth,borderThickness);
  }

  ctx.moveTo(endTrimX,MARGIN);
  ctx.arc(endTrimX+tWidth-borderRadius,MARGIN+borderRadius,borderRadius,Math.PI*1.5,0);
  ctx.arc(endTrimX+tWidth-borderRadius,MARGIN+tHeight-borderRadius,borderRadius,0,Math.PI*0.5);
  ctx.lineTo(endTrimX,MARGIN+tHeight);

  ctx.closePath();

  if(!s.trimming) ctx.fill();
  else ctx.stroke();

  ctx.fillStyle = "#000";
}

function isOverHead(s,x,y) {
  let minX = MARGIN;
  let minY = 0;
  let maxX = s.width-MARGIN;
  let maxY = MARGIN;

  return x >= minX && x <= maxX && y >= minY && y <= maxY;
}

function clamp(num,min,max) {
  return Math.max(min,Math.min(num,max));
}

class Region {
  constructor(minX,minY,maxX,maxY) {
    this.minX = minX;
    this.minY = minY;
    this.maxX = maxX;
    this.maxY = maxY;
    this.dragging = false;

    this.offsetX = 0;
    this.offsetY = 0;
  }

  intersects(x,y) {
    return x >= this.getMinY() && x <= this.getMaxX() && y >= this.getMinY() && y <= this.getMaxY();
  }

  isDragging() {
    return this.dragging;
  }

  setDragging(offsetX,offsetY,bool) {
    this.offsetX = offsetX-this.getMinX();
    this.offsetY = offsetY-this.getMinY();

    this.dragging = bool;
  }

  getMinX() {
    return this.minX;
  }

  getMinY() {
    return this.minY;
  }

  getMaxX() {
    return this.maxX;
  }

  getMaxY() {
    return this.maxY;
  }
}

class DynamicRegion extends Region {
  constructor(intersects,getMinX,getMinY,getMaxX,getMaxY) {
    super(0,0,0,0);

    this.intersects = intersects || this.intersects;
    this.getMinX = getMinX || this.getMinX;
    this.getMinY = getMinY || this.getMinY;
    this.getMaxX = getMaxX || this.getMaxX;
    this.getMaxY = getMaxY || this.getMaxY;
  }
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

    this.video = video;
    this.dragOffset = 0;

    let $this = this;

    this.clickBoxes = {
      "head": new DynamicRegion(null,()=>MARGIN,()=>0,()=>this.getWidth()-MARGIN,()=>MARGIN),
      "trimmer-1": new DynamicRegion(function(x,y) { //Set the this scope to the Region class and not inherit
        return x >= this.getMinX() && x <= this.getMaxX() && y >= this.getMinY() && y <= this.getMaxY();
      },()=>calculateTimelinePos(this,this.beginTime)-this.getTrimmerWidth(),()=>MARGIN,()=>calculateTimelinePos(this,this.beginTime), ()=>MARGIN+this.getTrimmerHeight()),
      "trimmer-2": new DynamicRegion(function(x,y) {
        return x >= this.getMinX() && x <= this.getMaxX() && y >= this.getMinY() && y <= this.getMaxY();
      }, ()=>calculateTimelinePos(this,this.endTime),()=>MARGIN,()=>calculateTimelinePos(this,this.endTime)+$this.getTrimmerWidth(),()=>MARGIN+this.getTrimmerHeight()),
      "trim": new DynamicRegion(function (x,y) {
        return x >= this.getMinX() && x <= this.getMaxX() && y >= this.getMinY() && y <= this.getMaxY();
      },()=>calculateTimelinePos(this,this.beginTime),()=>MARGIN,()=>calculateTimelinePos(this,this.endTime),()=>MARGIN+this.getTrimmerHeight())

    };
  }

  setTime(time) {
    this.currentTime = time;
  }

  getPlaybackHead() {
    return this.currentTime;
  }

  getTrimmerHeight() {
    return this.trimmerHeight;
  }

  getTrimmerWidth() {
    return this.trimmerWidth;
  }

  getWidth() {
    return this.width;
  }

  getHeight() {
    return this.height;
  }

  onClick(x,y) {
  }

  onMousedown(x,y) {
    for(let key in this.clickBoxes) {
      let box = this.clickBoxes[key];
      console.log(`${key}: ${box.intersects(x,y)}`);
      box.setDragging(x,y,box.intersects(x,y));
    }
  }

  onMouseup(x,y) {
    for(let key in this.clickBoxes) this.clickBoxes[key].setDragging(false);
  }

  onDrag(x1,y1,x2,y2) {
    let head = this.clickBoxes["head"];
    let trimmer_1 = this.clickBoxes["trimmer-1"];
    let trimmer_2 = this.clickBoxes["trimmer-2"];
    let trim = this.clickBoxes["trim"];

    if(head.isDragging()) {
      console.log("head");
      this.currentTime = clamp(calculateTimeFromX(this,x2),this.beginTime,this.endTime);
      this.onUserScrubbed(this.currentTime);
    }

    if(trimmer_1.isDragging())
      this.beginTime = clamp(calculateTimeFromX(this,x2+trimmer_1.offsetX),0,this.endTime);
    else if(trimmer_2.isDragging())
      this.endTime = clamp(calculateTimeFromX(this,x2-trimmer_2.offsetX),this.beginTime,this.length);
    else if(trim.isDragging()) {
      let timeChange = Math.max(-this.beginTime, Math.min(calculateTimeFromX(this, x2-trim.offsetX),this.beginTime+(this.length-this.endTime))-this.beginTime);
      this.beginTime += timeChange;
      this.endTime += timeChange;
    }

    this.currentTime = clamp(this.currentTime,this.beginTime,this.endTime);
    this.onUserScrubbed(this.currentTime);

    this.trimming = this.clickBoxes["trimmer-1"].isDragging() || this.clickBoxes["trimmer-2"].isDragging();
  }

  setDimensions(width,height) {
    this.width = width;
    this.height = height;
  }

  onUserScrubbed() {}

  render() {
    this.trimmerWidth = 40; //trimmer width
    this.trimmerHeight = this.height-(MARGIN*2); //trimmer height

    this.context.clearRect(0,0,this.width,this.height); //Reset the screen for drawing

    this.context.save(); //Save the unclipped state

    this.context.rect(MARGIN,MARGIN,this.width-MARGIN*2,this.height - (MARGIN*2)); //Define the clip region
    this.context.clip(); //Set the clip

    this.context.fillStyle = "#191919";
    this.context.rect(0,0,this.width,this.height); //Draw the timeline fill
    this.context.fill();

    this.context.restore(); //Restore the normal "un-clipped" state
    this.context.save(); //Save the unclipped state again

    this.context.beginPath(); //Clear the path
    this.context.rect(MARGIN,MARGIN,this.width-MARGIN*2,this.height - (MARGIN*2)); //Clip everything outside the timeline
    this.context.clip();

    //Draw timeline elements here.

    let timelineHeight = this.getHeight()-MARGIN*2;
    let timelineWidth = this.getWidth()-MARGIN*2;

    let vertScale = timelineHeight/this.video.videoHeight;
    let horizScale = timelineWidth/this.video.videoWidth;

    this.context.scale(horizScale,vertScale); //Scale the video

    this.context.filter = "blur(5px)"; //Blur it
    this.context.drawImage(this.video,MARGIN/horizScale,MARGIN/vertScale); //Draw the preview of the video
    this.context.filter = "none"; //Remove the blur


    this.context.setTransform(1, 0, 0, 1, 0, 0); //Reset transformation matrix

    this.context.beginPath(); //Reset the path
    this.context.fillStyle = "rgba(0, 0, 0, 0.7)";
    this.context.rect(MARGIN,MARGIN,calculateTimelinePos(this,this.beginTime)-MARGIN,timelineHeight); //Dim the parts to the left of the trim
    this.context.rect(calculateTimelinePos(this,this.endTime),MARGIN,timelineWidth,timelineHeight); //To the right
    this.context.fill(); //Fill

    this.context.restore(); //Restore the unclipped state

    this.context.beginPath(); //Reset the path
    drawTrimmers(this); //Draw the trimmers

    drawPlaybackHead(this);

    this.context.font = "30px Quicksand-Medium";

    this.context.fillStyle = BLUE;
    this.context.fillText(secondsToTimestamp(this.currentTime),20,40);

    this.context.fillStyle = "#fff";
    this.context.fillText(secondsToTimestamp(this.endTime-this.beginTime),250,40);

    if(this.trimming) { //Draw the timestamp of the currently-being-dragged trimmer
      let time = this.clickBoxes["trimmer-1"].isDragging() ? this.beginTime : this.endTime;

      let x = calculateTimelinePos(this,time)+this.trimmerWidth+5;
      let str = secondsToTimestamp(time);
      x = Math.min(timelineWidth+MARGIN-this.context.measureText(str).width,x); //Keep the timestamp inside the timeline
      this.context.fillStyle = "#f2a427"; //Orange
      this.context.fillText(str,x,MARGIN+this.trimmerHeight/2); //Draw the text
    }

  }
}

module.exports = Scrubber;
