import {detectPitch,PitchStabilizer,GuitarOnsetDetector} from './pitchDetector.js';import {frequencyToNote,PITCH_TOLERANCE_CENTS} from './noteMatcher.js';
export const MICROPHONE_CONFIG=Object.freeze({fftSize:4096,decimation:4,minRms:.012,minConfidence:.72,stableFrames:5,stableCents:55,attackRms:.02,attackRatio:1.3,onsetWindowMs:420});
export class MicrophoneInput{
  constructor(onFrame,config=MICROPHONE_CONFIG){this.onFrame=onFrame;this.config=config;this.context=null;this.stream=null;this.raf=0;this.buffer=null;this.downsampled=null;this.stabilizer=new PitchStabilizer({frames:config.stableFrames,cents:config.stableCents,minRms:config.minRms,minConfidence:config.minConfidence});this.onsetDetector=new GuitarOnsetDetector({minRms:config.attackRms,riseRatio:config.attackRatio});this.onsetSequence=0;this.deliveredOnsetSequence=0;this.lastOnsetAt=null}
  async start(){
    this.stop();const generation=this.generation;
    try{
    const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false,channelCount:1}});
    if(generation!==this.generation){stream.getTracks().forEach(track=>track.stop());return false}
    this.stream=stream;
    this.context=new AudioContext();if(this.context.state==='suspended')await this.context.resume();
    if(generation!==this.generation)return false;
    const source=this.context.createMediaStreamSource(this.stream);this.analyser=this.context.createAnalyser();this.analyser.fftSize=this.config.fftSize;this.analyser.smoothingTimeConstant=0;source.connect(this.analyser);
    this.buffer=new Float32Array(this.analyser.fftSize);this.downsampled=new Float32Array(this.buffer.length/this.config.decimation);
    const tick=()=>{if(!this.analyser||!this.context)return;this.analyser.getFloatTimeDomainData(this.buffer);for(let i=0;i<this.downsampled.length;i++){let value=0;for(let j=0;j<this.config.decimation;j++)value+=this.buffer[i*this.config.decimation+j];this.downsampled[i]=value/this.config.decimation}
      const raw=detectPitch(this.downsampled,this.context.sampleRate/this.config.decimation,{minRms:this.config.minRms,minConfidence:this.config.minConfidence}),now=performance.now();let attackPower=0;for(let i=this.buffer.length-512;i<this.buffer.length;i++)attackPower+=this.buffer[i]*this.buffer[i];const attackLevel=Math.sqrt(attackPower/512);if(this.onsetDetector.push(attackLevel,now)){this.onsetSequence++;this.lastOnsetAt=now}const stable=this.stabilizer.push(raw),rawFrequency=raw.rawFrequency??raw.frequency,stableFrequency=stable.frequency,onsetAgeMs=this.lastOnsetAt===null?Infinity:now-this.lastOnsetAt,onsetReady=Boolean(stableFrequency&&this.onsetSequence>this.deliveredOnsetSequence&&onsetAgeMs<=this.config.onsetWindowMs);if(onsetReady)this.deliveredOnsetSequence=this.onsetSequence;else if(onsetAgeMs>this.config.onsetWindowMs)this.deliveredOnsetSequence=this.onsetSequence;
      this.onFrame({...stable,detectedFrequency:stableFrequency,rawFrequency,rawNote:frequencyToNote(rawFrequency),note:frequencyToNote(stableFrequency),confidence:raw.confidence,level:raw.level,newOnset:onsetReady,onsetAgeMs,onsetId:this.onsetSequence});if(generation===this.generation)this.raf=requestAnimationFrame(tick)};tick();return generation===this.generation;
    }catch(error){if(generation!==this.generation)return false;this.stop();throw error}
  }
  stop(){this.generation=(this.generation||0)+1;cancelAnimationFrame(this.raf);this.stream?.getTracks().forEach(track=>track.stop());this.context?.close().catch(()=>{});this.stream=null;this.context=null;this.analyser=null;this.stabilizer.reset();this.onsetDetector.reset();this.onsetSequence=0;this.deliveredOnsetSequence=0;this.lastOnsetAt=null}
}

