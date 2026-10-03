export const PITCH_DETECTION_CONFIG=Object.freeze({minFrequency:72,maxFrequency:1400,minRms:.012,minConfidence:.72});
export const STABILIZATION_CONFIG=Object.freeze({frames:5,cents:55});
export function detectPitch(buffer,sampleRate,config=PITCH_DETECTION_CONFIG){
  config={...PITCH_DETECTION_CONFIG,...config};
  let sum=0;for(const value of buffer)sum+=value*value;const level=Math.sqrt(sum/buffer.length);
  if(!buffer?.length||level<config.minRms||!Number.isFinite(sampleRate))return {frequency:null,confidence:0,level};
  const minTau=Math.max(2,Math.floor(sampleRate/config.maxFrequency)),maxTau=Math.min(Math.floor(sampleRate/config.minFrequency),Math.floor(buffer.length/2));
  if(maxTau<=minTau)return {frequency:null,confidence:0,level};
  const difference=new Float64Array(maxTau+1),normalized=new Float64Array(maxTau+1);normalized[0]=1;let cumulative=0;
  for(let tau=1;tau<=maxTau;tau++){let value=0;const stop=buffer.length-maxTau;for(let i=0;i<stop;i++){const delta=buffer[i]-buffer[i+tau];value+=delta*delta}difference[tau]=value;cumulative+=value;normalized[tau]=cumulative?value*tau/cumulative:1}
  let best=-1;for(let tau=minTau;tau<=maxTau;tau++){if(normalized[tau]<.16){while(tau<maxTau&&normalized[tau+1]<normalized[tau])tau++;best=tau;break}}
  if(best<0){let lowest=.28;for(let tau=minTau;tau<=maxTau;tau++)if(normalized[tau]<lowest){lowest=normalized[tau];best=tau}}
  if(best<0)return {frequency:null,confidence:0,level};
  const left=normalized[best-1]??normalized[best],center=normalized[best],right=normalized[best+1]??center,denominator=left-2*center+right,offset=denominator?Math.max(-.5,Math.min(.5,.5*(left-right)/denominator)):0;
  const confidence=Math.max(0,Math.min(1,1-center)),frequency=sampleRate/(best+offset);
  return {frequency:confidence>=config.minConfidence?frequency:null,rawFrequency:frequency,confidence,level};
}
export class PitchStabilizer{
  constructor({frames=STABILIZATION_CONFIG.frames,cents=STABILIZATION_CONFIG.cents,minRms=PITCH_DETECTION_CONFIG.minRms,minConfidence=PITCH_DETECTION_CONFIG.minConfidence}={}){this.frames=frames;this.cents=cents;this.minRms=minRms;this.minConfidence=minConfidence;this.samples=[];this.midi=null}
  reset(){this.samples=[];this.midi=null}
  push(result){const frequency=result?.frequency,confidence=result?.confidence??0,level=result?.level??0;if(!Number.isFinite(frequency)||frequency<=0||level<this.minRms||confidence<this.minConfidence){this.reset();return {...result,frequency:null,stableFrequency:null,stableFrames:0,signal:false}}
    const midi=Math.round(69+12*Math.log2(frequency/440));if(this.midi!==midi)this.reset();else if(this.samples.length){const center=this.samples.slice().sort((a,b)=>a-b)[Math.floor(this.samples.length/2)],cents=Math.abs(1200*Math.log2(frequency/center));if(cents>this.cents)this.reset()}
    this.midi=midi;this.samples.push(frequency);if(this.samples.length>this.frames)this.samples.shift();const sorted=this.samples.slice().sort((a,b)=>a-b),stableFrequency=sorted[Math.floor(sorted.length/2)],stable=this.samples.length>=this.frames;
    return {...result,frequency:stable?stableFrequency:null,stableFrequency:stable?stableFrequency:null,stableFrames:this.samples.length,signal:true}
  }
}

