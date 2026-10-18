const DEFAULT_CONFIG=Object.freeze({deltaDb:6,minTargetRms:.003,minInterHitMs:100,baselineAlpha:.12});
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

export class TargetFrequencyDeltaDetector{
  constructor(config={}){this.config={...DEFAULT_CONFIG,...config};this.baselines=new Map();this.lastHitAt=new Map()}
  reset(){this.baselines.clear();this.lastHitAt.clear()}
  push(buffer,sampleRate,targets=[],now=performance.now()){
    let best=null;
    for(const target of targets){
      if(!Number.isInteger(target?.index)||!Number.isFinite(target.frequency))continue;
      const id=target.id??target.index,rms=targetToneRms(buffer,sampleRate,target.frequency),db=20*Math.log10(Math.max(1e-7,rms)),entry=this.baselines.get(id),baseline=entry?.db,deltaDb=baseline===undefined?0:db-baseline,lastHit=this.lastHitAt.get(id)??-Infinity;
      const attack=target.eligible!==false&&baseline!==undefined&&rms>=this.config.minTargetRms&&deltaDb>=this.config.deltaDb&&now-lastHit>=this.config.minInterHitMs;
      if(attack){this.lastHitAt.set(id,now);this.baselines.set(id,{db,lastSeenAt:now});const candidate={index:target.index,frequency:target.frequency,deltaDb,rms};if(!best||candidate.deltaDb>best.deltaDb)best=candidate}
      else if(baseline===undefined)this.baselines.set(id,{db,lastSeenAt:now});
      else this.baselines.set(id,{db:baseline+(db-baseline)*this.config.baselineAlpha,lastSeenAt:now});
    }
    for(const [id,entry] of this.baselines)if(now-entry.lastSeenAt>2000){this.baselines.delete(id);this.lastHitAt.delete(id)}
    return best;
  }
}
