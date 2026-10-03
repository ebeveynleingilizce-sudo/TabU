import {detectPitch,PitchStabilizer} from './pitchDetector.js';import {frequencyToNote,PITCH_TOLERANCE_CENTS} from './noteMatcher.js';
export const MICROPHONE_CONFIG=Object.freeze({fftSize:4096,decimation:4,minRms:.012,minConfidence:.72,stableFrames:5,stableCents:55,attackRms:.028,attackRatio:1.5});
export class MicrophoneInput{
  constructor(onFrame,config=MICROPHONE_CONFIG){this.onFrame=onFrame;this.config=config;this.context=null;this.stream=null;this.raf=0;this.buffer=null;this.downsampled=null;this.stabilizer=new PitchStabilizer({frames:config.stableFrames,cents:config.stableCents,minRms:config.minRms,minConfidence:config.minConfidence})}
  async start(){
    this.stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false,channelCount:1}});
    this.context=new AudioContext();if(this.context.state==='suspended')await this.context.resume();
    const source=this.context.createMediaStreamSource(this.stream);this.analyser=this.context.createAnalyser();this.analyser.fftSize=this.config.fftSize;this.analyser.smoothingTimeConstant=0;source.connect(this.analyser);
    this.buffer=new Float32Array(this.analyser.fftSize);this.downsampled=new Float32Array(this.buffer.length/this.config.decimation);
    const tick=()=>{if(!this.analyser||!this.context)return;this.analyser.getFloatTimeDomainData(this.buffer);for(let i=0;i<this.downsampled.length;i++){let value=0;for(let j=0;j<this.config.decimation;j++)value+=this.buffer[i*this.config.decimation+j];this.downsampled[i]=value/this.config.decimation}
      const raw=detectPitch(this.downsampled,this.context.sampleRate/this.config.decimation,{minRms:this.config.minRms,minConfidence:this.config.minConfidence});const stable=this.stabilizer.push(raw),rawFrequency=raw.rawFrequency??raw.frequency,stableFrequency=stable.frequency;
      this.onFrame({...stable,detectedFrequency:stableFrequency,rawFrequency,rawNote:frequencyToNote(rawFrequency),note:frequencyToNote(stableFrequency),confidence:raw.confidence,level:raw.level});this.raf=requestAnimationFrame(tick)};tick();
  }
  stop(){cancelAnimationFrame(this.raf);this.stream?.getTracks().forEach(track=>track.stop());this.context?.close();this.stream=null;this.context=null;this.analyser=null;this.stabilizer.reset()}
}

