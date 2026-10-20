const DEFAULT_CONFIG=Object.freeze({deltaDb:6,bassDeltaDb:3.8,minTargetRms:.003,minInterHitMs:100,baselineAlpha:.12,highPassHz:180,transientDeltaDb:4,transientFloorDb:-75,bassActiveDb:-45});
const windowCache=new Map();

function getHannWindow(length){
  let entry=windowCache.get(length);if(entry)return entry;
  const values=new Float32Array(length);let sum=0;
  for(let i=0;i<length;i++){values[i]=.5-.5*Math.cos(2*Math.PI*i/(length-1));sum+=values[i]}
  entry={values,sum};windowCache.set(length,entry);return entry;
}

function targetToneRms(buffer,sampleRate,targetFrequency){
  if(!buffer?.length||!Number.isFinite(sampleRate)||!Number.isFinite(targetFrequency)||targetFrequency<=0)return 0;
  const length=buffer.length,step=17.5,frequencies=Array.from({length:5},(_,index)=>targetFrequency*2**(((index-2)*step)/1200));
  const {values:window, sum:windowSum}=getHannWindow(length);
  let strongest=0;
  for(const frequency of frequencies){
    const omega=2*Math.PI*frequency/sampleRate,coefficient=2*Math.cos(omega);let q1=0,q2=0;
    for(let i=0;i<length;i++){const q0=buffer[i]*window[i]+coefficient*q1-q2;q2=q1;q1=q0}
    const power=Math.max(0,q1*q1+q2*q2-coefficient*q1*q2),rms=Math.sqrt(power)*Math.SQRT2/windowSum;
    if(rms>strongest)strongest=rms;
  }
  return strongest;
}

function highPassBuffer(buffer,sampleRate,cutoffHz){
  const output=new Float32Array(buffer.length),omega=2*Math.PI*cutoffHz/sampleRate,cos=Math.cos(omega),alpha=Math.sin(omega)/(2*Math.SQRT1_2),a0=1+alpha,b0=(1+cos)/(2*a0),b1=-(1+cos)/a0,b2=b0,a1=-2*cos/a0,a2=(1-alpha)/a0;
  let x1=0,x2=0,y1=0,y2=0;
  for(let i=0;i<buffer.length;i++){const x=buffer[i],y=b0*x+b1*x1+b2*x2-a1*y1-a2*y2;output[i]=y;x2=x1;x1=x;y2=y1;y1=y}
  return output;
}

function highPassMagnitude(frequency,sampleRate,cutoffHz){
  const omega=2*Math.PI*cutoffHz/sampleRate,cos=Math.cos(omega),alpha=Math.sin(omega)/(2*Math.SQRT1_2),a0=1+alpha,b0=(1+cos)/(2*a0),b1=-(1+cos)/a0,b2=b0,a1=-2*cos/a0,a2=(1-alpha)/a0,w=2*Math.PI*frequency/sampleRate,cosW=Math.cos(w),sinW=Math.sin(w),cos2W=Math.cos(2*w),sin2W=Math.sin(2*w),nr=b0+b1*cosW+b2*cos2W,ni=-b1*sinW-b2*sin2W,dr=1+a1*cosW+a2*cos2W,di=-a1*sinW-a2*sin2W;
  return Math.max(1e-4,Math.hypot(nr,ni)/Math.hypot(dr,di));
}

function bandDb(spectrum,sampleRate,fftSize,lowHz,highHz){
  const binHz=sampleRate/fftSize,first=Math.max(1,Math.ceil(lowHz/binHz)),last=Math.min(spectrum.length-1,Math.floor(highHz/binHz));let power=0,count=0;
  for(let bin=first;bin<=last;bin++){const db=spectrum[bin];if(Number.isFinite(db)){power+=10**(db/10);count++}}
  return count?10*Math.log10(Math.max(1e-12,power/count)):-120;
}

export class ArpeggioAudioMonitor{
  constructor(config={}){this.config={...DEFAULT_CONFIG,...config};this.transientBaseline=null;this.lastTransientAt=-Infinity}
  reset(){this.transientBaseline=null;this.lastTransientAt=-Infinity}
  push(spectrum,sampleRate,fftSize,now=performance.now()){
    const bassDb=bandDb(spectrum,sampleRate,fftSize,45,180),transientDb=bandDb(spectrum,sampleRate,fftSize,2000,5000),baseline=this.transientBaseline,transientDeltaDb=baseline===null?0:transientDb-baseline,transient=baseline!==null&&transientDb>=this.config.transientFloorDb&&transientDeltaDb>=this.config.transientDeltaDb&&now-this.lastTransientAt>=25;
    if(transient){this.lastTransientAt=now;this.transientBaseline=transientDb}else if(baseline===null)this.transientBaseline=transientDb;else this.transientBaseline+=Math.min(0,transientDb-baseline)*.35+(Math.max(0,transientDb-baseline)*.08);
    return {bassActive:bassDb>=this.config.bassActiveDb,bassDb,transient,transientDb,transientDeltaDb};
  }
}

export class TargetFrequencyDeltaDetector{
  constructor(config={}){this.config={...DEFAULT_CONFIG,...config};this.baselines=new Map();this.lastHitAt=new Map()}
  reset(){this.baselines.clear();this.lastHitAt.clear()}
  push(buffer,sampleRate,targets=[],now=performance.now(),audioState={}){
    let best=null;
    for(const target of targets){
      if(!Number.isInteger(target?.index)||!Number.isFinite(target.frequency))continue;
      const string=String(target.string),id=target.id??target.index,upperString=['G','B','e','1','2','3'].includes(string),filtered=upperString?highPassBuffer(buffer,sampleRate,this.config.highPassHz):buffer,filterGain=upperString?highPassMagnitude(target.frequency,sampleRate,this.config.highPassHz):1,rms=targetToneRms(filtered,sampleRate,target.frequency)/filterGain,db=20*Math.log10(Math.max(1e-7,rms)),entry=this.baselines.get(id),baseline=entry?.db,deltaDb=baseline===undefined?0:db-baseline,lastHit=this.lastHitAt.get(id)??-Infinity,requiredDelta=audioState.bassActive?this.config.bassDeltaDb:this.config.deltaDb,hasAttack=!upperString||audioState.transient===true;
      const attack=target.eligible!==false&&baseline!==undefined&&rms>=this.config.minTargetRms&&deltaDb>=requiredDelta&&hasAttack&&now-lastHit>=this.config.minInterHitMs;
      if(attack){this.lastHitAt.set(id,now);this.baselines.set(id,{db,lastSeenAt:now});const candidate={index:target.index,frequency:target.frequency,deltaDb,rms};if(!best||candidate.deltaDb>best.deltaDb)best=candidate}
      else if(baseline===undefined)this.baselines.set(id,{db,lastSeenAt:now});
      else this.baselines.set(id,{db:baseline+(db-baseline)*this.config.baselineAlpha,lastSeenAt:now});
    }
    for(const [id,entry] of this.baselines)if(now-entry.lastSeenAt>2000){this.baselines.delete(id);this.lastHitAt.delete(id)}
    return best;
  }
}
