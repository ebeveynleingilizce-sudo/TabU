import test from 'node:test';
import assert from 'node:assert/strict';
import {ArpeggioAudioMonitor,TargetFrequencyDeltaDetector} from '../audio/targetPitchDetector.js';

const sampleRate=22050,length=1024,targetFrequency=329.63;
function frame(time,tones){
  const data=new Float32Array(length);
  for(let i=0;i<length;i++)for(const [frequency,amplitude] of tones)data[i]+=amplitude*Math.sin(2*Math.PI*frequency*(time+i/sampleRate));
  return data;
}
function spectrum(highDb,lowDb=-100,size=1024,rate=48000,fft=2048){
  const bins=new Float32Array(size).fill(-120);
  for(let i=1;i<size;i++){const hz=i*rate/fft;if(hz>=45&&hz<=180)bins[i]=lowDb;if(hz>=2000&&hz<=5000)bins[i]=highDb}
  return bins;
}

test('arpeggio target detector responds to a 6 dB target-frequency rise over a ringing bass note',()=>{
  const detector=new TargetFrequencyDeltaDetector(),target={id:1,index:1,frequency:targetFrequency};
  for(const time of [0,.016,.032])assert.equal(detector.push(frame(time,[[110,.12]]),sampleRate,[target],time*1000),null);
  const hit=detector.push(frame(.048,[[110,.12],[targetFrequency,.025]]),sampleRate,[target],48,{bassActive:true,transient:true});
  assert.ok(hit,'target string attack should be found despite the other string still ringing');
  assert.ok(hit.deltaDb>=6,`expected at least 6 dB, got ${hit.deltaDb}`);
  assert.equal(hit.index,1);
});

test('low guitar fundamentals still produce a target delta over a resonating neighboring string',()=>{
  const detector=new TargetFrequencyDeltaDetector(),target={id:3,index:3,frequency:82.41};
  for(const time of [0,.016,.032])detector.push(frame(time,[[110,.1]]),sampleRate,[target],time*1000);
  const hit=detector.push(frame(.048,[[110,.1],[82.41,.07]]),sampleRate,[target],48,{bassActive:true,transient:true});
  assert.ok(hit);assert.ok(hit.deltaDb>=6);
});

test('wrong pitch energy does not trigger the selected target detector',()=>{
  const detector=new TargetFrequencyDeltaDetector(),target={id:2,index:2,frequency:targetFrequency};
  for(const time of [0,.016,.032])detector.push(frame(time,[[110,.08]]),sampleRate,[target],time*1000);
  assert.equal(detector.push(frame(.048,[[110,.08],[392,.04]]),sampleRate,[target],48),null);
});

test('a new arpeggio target can trigger immediately and each target is rate-limited to 100 ms',()=>{
  const detector=new TargetFrequencyDeltaDetector(),first={id:1,index:1,frequency:targetFrequency},second={id:2,index:2,frequency:392};
  for(const time of [0,.016,.032])detector.push(frame(time,[[110,.1]]),sampleRate,[first,second],time*1000);
  const firstHit=detector.push(frame(.048,[[110,.1],[targetFrequency,.025]]),sampleRate,[first,second],48,{bassActive:true,transient:true});
  assert.equal(firstHit?.index,1);
  const secondHit=detector.push(frame(.064,[[110,.1],[targetFrequency,.025],[392,.025]]),sampleRate,[second],64,{bassActive:true,transient:true});
  assert.equal(secondHit?.index,2,'changing target bypasses the previous note cooldown');
});

test('high-band spectral flux detects a light treble attack during sustained bass-band energy',()=>{
  const monitor=new ArpeggioAudioMonitor(),rate=48000,fft=2048;
  assert.equal(monitor.push(spectrum(-100,-32),rate,fft,0).transient,false);
  const bassHit=monitor.push(spectrum(-45,-32),rate,fft,16);
  assert.equal(bassHit.transient,true,'bass pluck has an onset');
  for(const time of [32,48,64,80,96,112,128,144])assert.equal(monitor.push(spectrum(-45,-32),rate,fft,time).transient,false,'ring-out must not make repeated onsets');
  const lightTrebleHit=monitor.push(spectrum(-42,-32),rate,fft,160);
  assert.equal(lightTrebleHit.transient,true,'a 3 dB treble attack remains distinct from the loud bass ring');
  assert.ok(lightTrebleHit.transientFlux>=.2);
});

test('harmonic energy at a later string fundamental is rejected without a fresh onset',()=>{
  const detector=new TargetFrequencyDeltaDetector(),target={id:3,index:3,string:'e',frequency:329.63,eligible:false};
  for(const time of [0,16,32,48])detector.push(frame(time/1000,[[82.41,.12],[329.63,.025]]),sampleRate,[target],time,{bassActive:true,transient:time===0});
  target.eligible=true;
  for(const time of [64,80,96,112])assert.equal(detector.push(frame(time/1000,[[82.41,.12],[329.63,.025]]),sampleRate,[target],time,{bassActive:true,transient:false}),null,'ringing bass harmonic is not a new e-string pluck');
  const hit=detector.push(frame(.128,[[82.41,.12],[329.63,.025],[329.63,.025]]),sampleRate,[target],128,{bassActive:true,transient:true});
  assert.equal(hit?.index,3,'the actual e-string attack can still be detected over the harmonic');
});

test('a real upper-string onset is accepted when bass harmonics mask its fundamental delta',()=>{
  const detector=new TargetFrequencyDeltaDetector(),target={id:4,index:4,string:'B',frequency:246.94};
  // E2's 3rd/6th/9th partials sit almost on B3 and its upper partials. The new
  // B-string attack is deliberately phase-opposed and quieter than the ringing
  // bass partial, so a strict positive dB-delta gate rejects it.
  const bass=[[82.41,.14],[247.23,.04],[329.64,.025],[412.05,.015],[494.46,.01],[741.69,.008]];
  for(const time of [0,.016,.032,.048])detector.push(frame(time,bass),sampleRate,[target],time*1000,{bassActive:true,transient:false});
  const hit=detector.push(frame(.064,[...bass,[246.94,.008,Math.PI]]),sampleRate,[target],64,{bassActive:true,transient:true});
  assert.equal(hit?.index,4,'fresh onset at the scheduled target should survive harmonic masking and gain clamping');
  assert.equal(hit?.bassMasked,true,'diagnostics should identify the bass-masked fallback');
});

test('bass harmonics alone never advance an upper target without a fresh onset',()=>{
  const detector=new TargetFrequencyDeltaDetector(),target={id:5,index:5,string:'e',frequency:329.63},bass=[[82.41,.14],[247.23,.04],[329.64,.025],[494.46,.01]];
  for(const time of [0,.016,.032,.048])detector.push(frame(time,bass),sampleRate,[target],time*1000,{bassActive:true,transient:false});
  assert.equal(detector.push(frame(.064,bass),sampleRate,[target],64,{bassActive:true,transient:false}),null);
});

test('arpeggio analysis record: bass + G/B/e attacks produce no false positives or misses',()=>{
  const detector=new TargetFrequencyDeltaDetector(),monitor=new ArpeggioAudioMonitor(),notes=[
    {id:0,index:0,string:'E',frequency:82.41},
    {id:1,index:1,string:'G',frequency:196},
    {id:2,index:2,string:'B',frequency:246.94},
    {id:3,index:3,string:'e',frequency:329.63}
  ],hits=[],falsePositives=[];
  const targets=current=>notes.map((note,index)=>({...note,eligible:index===current}));
  const push=(time,current,tones,highDb)=>{
    const onset=monitor.push(spectrum(highDb,-30),48000,2048,time);
    return detector.push(frame(time/1000,tones),sampleRate,targets(current),time,{bassActive:true,transient:onset.transient});
  };
  for(const time of [0,16,32])push(time,0,[[110,.14]],-100);
  let hit=push(48,0,[[110,.14],[82.41,.12],[329.63,.025]],-45);if(hit)hits.push(hit.index);
  hit=push(64,1,[[110,.14],[82.41,.12],[329.63,.025]],-45);if(hit)falsePositives.push(hit.index);
  hit=push(80,1,[[110,.14],[82.41,.12],[329.63,.025],[196,.025]],-42);if(hit)hits.push(hit.index);
  hit=push(96,2,[[110,.14],[82.41,.12],[329.63,.025],[196,.025]],-45);if(hit)falsePositives.push(hit.index);
  hit=push(128,2,[[110,.14],[82.41,.12],[329.63,.025],[196,.025],[246.94,.025]],-42);if(hit)hits.push(hit.index);
  hit=push(144,3,[[110,.14],[82.41,.12],[329.63,.025],[196,.025],[246.94,.025]],-45);if(hit)falsePositives.push(hit.index);
  hit=push(176,3,[[110,.14],[82.41,.12],[329.63,.025],[196,.025],[246.94,.025],[329.63,.025]],-42);if(hit)hits.push(hit.index);
  const expected=[0,1,2,3],misses=expected.filter(index=>!hits.includes(index));
  assert.deepEqual(hits,expected,`analysis record: hits=${hits.join(',')} misses=${misses.length} falsePositives=${falsePositives.length}`);
  assert.equal(misses.length,0);assert.equal(falsePositives.length,0);
  console.info(JSON.stringify({analysis:'arpeggio bass-ring synthetic',truePositives:hits.length,falsePositives:falsePositives.length,misses:misses.length,notes:['E2','G3','B3','e4']}));
});
