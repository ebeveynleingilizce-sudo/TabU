const DEFAULT_RATE=1;

function normalizeRate(rate){
  return Number.isFinite(Number(rate))&&Number(rate)>0?Number(rate):DEFAULT_RATE;
}

/** One scaled musical clock for microphone practice; audio mode reads media time directly. */
export class PracticeClock{
  constructor(rate=DEFAULT_RATE){
    this.rate=normalizeRate(rate);
    this.time=0;
    this.lastRealTime=null;
    this.running=false;
  }

  start(realTime=performance.now(),musicalTime=0){
    this.time=Math.max(0,Number(musicalTime)||0);
    this.lastRealTime=realTime;
    this.running=true;
    return this.time;
  }

  resume(realTime=performance.now()){
    if(!this.running){this.lastRealTime=realTime;this.running=true}
    return this.time;
  }

  update(realTime=performance.now()){
    if(this.running&&Number.isFinite(this.lastRealTime)){
      const delta=Math.max(0,(realTime-this.lastRealTime)/1000);
      this.time+=delta*this.rate;
      this.lastRealTime=realTime;
    }
    return this.time;
  }

  getMusicalTime({mediaTime,realTime=performance.now()}={}){
    return Number.isFinite(mediaTime)?mediaTime:this.update(realTime);
  }

  pause(realTime=performance.now()){
    this.update(realTime);
    this.running=false;
    this.lastRealTime=null;
    return this.time;
  }

  setRate(rate,realTime=performance.now()){
    this.update(realTime);
    this.rate=normalizeRate(rate);
    return this.time;
  }

  seek(musicalTime,realTime=performance.now()){
    this.time=Math.max(0,Number(musicalTime)||0);
    this.lastRealTime=this.running?realTime:null;
    return this.time;
  }

  reset(){
    this.time=0;
    this.lastRealTime=null;
    this.running=false;
  }
}

