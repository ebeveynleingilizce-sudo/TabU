import {detectPitch,PitchStabilizer,GuitarOnsetDetector,GuitarNoteOnsetTracker,SpectralFluxDetector} from './pitchDetector.js';import {frequencyToNote} from './noteMatcher.js';import {ArpeggioAudioMonitor,TargetFrequencyDeltaDetector} from './targetPitchDetector.js';
export const MICROPHONE_CONFIG=Object.freeze({fftSize:2048,decimation:2,minRms:.012,minConfidence:.72,stableFrames:4,stableCents:55,attackRms:.012,attackRatio:1.3,refractoryMs:60,fluxThreshold:.45,onsetWindowMs:420});
const AUDIO_PROCESSING_CONSTRAINTS=['echoCancellation','noiseSuppression','autoGainControl'];
async function requestMicrophoneStream(mediaDevices){
  const supported=mediaDevices.getSupportedConstraints?.()||{};
  const audio={channelCount:1};
  for(const name of AUDIO_PROCESSING_CONSTRAINTS)audio[name]=supported[name]?{exact:false}:false;
  try{return await mediaDevices.getUserMedia({audio})}
  catch(error){
    const exactWasRejected=AUDIO_PROCESSING_CONSTRAINTS.some(name=>audio[name]&&typeof audio[name]==='object');
    if(!exactWasRejected||!['OverconstrainedError','ConstraintNotSatisfiedError'].includes(error?.name))throw error;
    const fallback={channelCount:1};
    for(const name of AUDIO_PROCESSING_CONSTRAINTS)fallback[name]=false;
    return mediaDevices.getUserMedia({audio:fallback});
  }
}
export class MicrophoneInput{
  constructor(onFrame,config=MICROPHONE_CONFIG,targetProvider=()=>null){this.onFrame=onFrame;this.config=config;this.targetProvider=targetProvider;this.targetDeltaDetector=new TargetFrequencyDeltaDetector({deltaDb:6,minInterHitMs:100});this.arpeggioAudioMonitor=new ArpeggioAudioMonitor();this.context=null;this.stream=null;this.raf=0;this.buffer=null;this.downsampled=null;this.stabilizer=new PitchStabilizer({frames:config.stableFrames,cents:config.stableCents,minRms:config.minRms,minConfidence:config.minConfidence});this.onsetDetector=new GuitarOnsetDetector({minRms:config.attackRms,riseRatio:config.attackRatio,refractoryMs:config.refractoryMs});this.fluxDetector=new SpectralFluxDetector({threshold:config.fluxThreshold,refractoryMs:config.refractoryMs});this.noteOnsetTracker=new GuitarNoteOnsetTracker({windowMs:config.onsetWindowMs});this.pitchCandidateMidi=null;this.pitchCandidateAt=null;this.lastTransientAt=-Infinity;this.targetDeltaDetector.reset();this.frequencyBuffer=null}
  async start(){
    this.stop();const generation=this.generation;
    try{
    const stream=await requestMicrophoneStream(navigator.mediaDevices);
    if(generation!==this.generation){stream.getTracks().forEach(track=>track.stop());return false}
    this.stream=stream;
    this.context=new AudioContext();if(this.context.state==='suspended')await this.context.resume();
    if(generation!==this.generation)return false;
    const source=this.context.createMediaStreamSource(this.stream);this.analyser=this.context.createAnalyser();this.analyser.fftSize=this.config.fftSize;this.analyser.smoothingTimeConstant=0;this.frequencyBuffer=new Float32Array(this.analyser.frequencyBinCount);source.connect(this.analyser);
    this.buffer=new Float32Array(this.analyser.fftSize);this.downsampled=new Float32Array(this.buffer.length/this.config.decimation);
    const tick=()=>{if(!this.analyser||!this.context)return;this.analyser.getFloatTimeDomainData(this.buffer);for(let i=0;i<this.downsampled.length;i++){let value=0;for(let j=0;j<this.config.decimation;j++)value+=this.buffer[i*this.config.decimation+j];this.downsampled[i]=value/this.config.decimation}
      const now=performance.now(),targetPlan=this.targetProvider?.(),targetMode=Array.isArray(targetPlan),targets=targetMode?targetPlan:[],sampleRate=this.context.sampleRate/this.config.decimation;this.analyser.getFloatFrequencyData(this.frequencyBuffer);const arpeggioAudioState=targetMode?this.arpeggioAudioMonitor.push(this.frequencyBuffer,this.context.sampleRate,this.analyser.fftSize,now):null;let targetAttack=this.targetDeltaDetector.push(this.downsampled,sampleRate,targets,now,arpeggioAudioState||{}),raw;if(targetMode){let sum=0;for(const value of this.downsampled)sum+=value*value;raw={frequency:null,rawFrequency:null,confidence:0,level:Math.sqrt(sum/this.downsampled.length)}}else raw=detectPitch(this.downsampled,sampleRate,{minRms:this.config.minRms,minConfidence:this.config.minConfidence});let attackPower=0;for(let i=this.buffer.length-512;i<this.buffer.length;i++)attackPower+=this.buffer[i]*this.buffer[i];const attackLevel=Math.sqrt(attackPower/512),levelOnset=this.onsetDetector.push(attackLevel,now),fluxOnset=this.fluxDetector.push(this.frequencyBuffer,now),transient=levelOnset||fluxOnset,physicalOnset=transient&&now-this.lastTransientAt>=this.config.refractoryMs;if(physicalOnset){this.lastTransientAt=now;this.stabilizer.reset();this.pitchCandidateMidi=null;this.pitchCandidateAt=null}const stable=this.stabilizer.push(raw),rawFrequency=raw.rawFrequency??raw.frequency,stableFrequency=stable.frequency,stableMidi=stableFrequency?Math.round(69+12*Math.log2(stableFrequency/440)):null;
      if(!stable.signal||!Number.isInteger(stable.candidateMidi)){this.pitchCandidateMidi=null;this.pitchCandidateAt=null;this.lastTransientAt=-Infinity}else if(stable.candidateMidi!==this.pitchCandidateMidi){this.pitchCandidateMidi=stable.candidateMidi;this.pitchCandidateAt=now}
      const onset=this.noteOnsetTracker.push({stableMidi,signal:stable.signal,physicalOnset,pitchChangeAt:this.pitchCandidateAt},now);
      this.onFrame({...stable,detectedFrequency:stableFrequency,rawFrequency,rawNote:frequencyToNote(rawFrequency),note:frequencyToNote(stableFrequency),confidence:raw.confidence,level:raw.level,...onset,targetAttack,arpeggioAudioState});if(generation===this.generation)this.raf=requestAnimationFrame(tick)};tick();return generation===this.generation;
    }catch(error){if(generation!==this.generation)return false;this.stop();throw error}
  }
  stop(){this.generation=(this.generation||0)+1;cancelAnimationFrame(this.raf);this.stream?.getTracks().forEach(track=>track.stop());this.context?.close().catch(()=>{});this.stream=null;this.context=null;this.analyser=null;this.stabilizer.reset();this.onsetDetector.reset();this.fluxDetector.reset();this.noteOnsetTracker.reset();this.pitchCandidateMidi=null;this.pitchCandidateAt=null;this.lastTransientAt=-Infinity;this.targetDeltaDetector.reset();this.arpeggioAudioMonitor.reset();this.frequencyBuffer=null}
}

