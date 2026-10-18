import test from 'node:test';
import assert from 'node:assert/strict';
import {TargetFrequencyDeltaDetector} from '../audio/targetPitchDetector.js';

const sampleRate=22050,length=1024,targetFrequency=329.63;
function frame(time,tones){
  const data=new Float32Array(length);
  for(let i=0;i<length;i++)for(const [frequency,amplitude] of tones)data[i]+=amplitude*Math.sin(2*Math.PI*frequency*(time+i/sampleRate));
  return data;
}

test('arpeggio target detector responds to a 6 dB target-frequency rise over a ringing bass note',()=>{
  const detector=new TargetFrequencyDeltaDetector(),target={id:1,index:1,frequency:targetFrequency};
  for(const time of [0,.016,.032])assert.equal(detector.push(frame(time,[[110,.12]]),sampleRate,[target],time*1000),null);
  const hit=detector.push(frame(.048,[[110,.12],[targetFrequency,.025]]),sampleRate,[target],48);
  assert.ok(hit,'target string attack should be found despite the other string still ringing');
  assert.ok(hit.deltaDb>=6,`expected at least 6 dB, got ${hit.deltaDb}`);
  assert.equal(hit.index,1);
});

test('low guitar fundamentals still produce a target delta over a resonating neighboring string',()=>{
  const detector=new TargetFrequencyDeltaDetector(),target={id:3,index:3,frequency:82.41};
  for(const time of [0,.016,.032])detector.push(frame(time,[[110,.1]]),sampleRate,[target],time*1000);
  const hit=detector.push(frame(.048,[[110,.1],[82.41,.07]]),sampleRate,[target],48);
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
  const firstHit=detector.push(frame(.048,[[110,.1],[targetFrequency,.025]]),sampleRate,[first,second],48);
  assert.equal(firstHit?.index,1);
  const secondHit=detector.push(frame(.064,[[110,.1],[targetFrequency,.025],[392,.025]]),sampleRate,[second],64);
  assert.equal(secondHit?.index,2,'changing target bypasses the previous note cooldown');
});
