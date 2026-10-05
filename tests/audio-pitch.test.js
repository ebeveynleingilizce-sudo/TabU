import test from 'node:test';
import assert from 'node:assert/strict';
import {STANDARD_TUNING,stringFretToMidi,expectedGuitarNote,midiToFrequency,frequencyToMidi,frequencyToNote,centsDifference,matchNote,PITCH_TOLERANCE_CENTS} from '../audio/noteMatcher.js';
import {detectPitch,PitchStabilizer,GuitarOnsetDetector} from '../audio/pitchDetector.js';

const close=(actual,expected,tolerance)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} != ${expected}`);

test('standard tuning model and thin E fret mapping',()=>{
  assert.deepEqual(Object.values(STANDARD_TUNING).map(x=>x.midi),[64,59,55,50,45,40]);
  for(const [fret,midi] of [[0,64],[1,65],[2,66],[3,67],[5,69],[7,71],[12,76]])assert.equal(stringFretToMidi(1,fret),midi);
});
test('all open strings and low E examples use the same MIDI formula',()=>{
  assert.deepEqual([1,2,3,4,5,6].map(string=>stringFretToMidi(string,0)),[64,59,55,50,45,40]);
  assert.equal(stringFretToMidi(6,3),43);
  assert.equal(stringFretToMidi('e',2),66);
});
test('complete fretboard test matrix maps each string and fret to exact notes',()=>{
  const matrix={1:{0:'E4',1:'F4',2:'F#4',3:'G4',5:'A4',7:'B4',12:'E5'},2:{0:'B3',1:'C4',3:'D4',5:'E4',12:'B4'},3:{0:'G3',2:'A3',4:'B3',5:'C4',12:'G4'},4:{0:'D3',2:'E3',3:'F3',5:'G3',12:'D4'},5:{0:'A2',2:'B2',3:'C3',5:'D3',12:'A3'},6:{0:'E2',1:'F2',3:'G2',5:'A2',12:'E3'}};
  for(const [string,frets] of Object.entries(matrix))for(const [fret,label] of Object.entries(frets)){const note=expectedGuitarNote(Number(string),Number(fret));assert.equal(note.label,label,`${string}/${fret}`);close(note.frequency,midiToFrequency(note.midi),1e-9)}
});
test('frequency conversion and exact octave-aware matching',()=>{
  close(midiToFrequency(69),440,.001);close(midiToFrequency(64),329.63,.02);close(midiToFrequency(66),369.99,.02);
  close(frequencyToMidi(midiToFrequency(66)),66,.0001);
  const expected=expectedGuitarNote(1,2);assert.equal(expected.label,'F#4');
  assert.equal(matchNote(frequencyToNote(371),expected),true);
  assert.equal(matchNote(frequencyToNote(midiToFrequency(66)*2),expected),false,'octave-up F# must fail');
  assert.equal(matchNote(frequencyToNote(midiToFrequency(66)/2),expected),false,'octave-down F# must fail');
  assert.equal(PITCH_TOLERANCE_CENTS,49);assert.ok(Math.abs(centsDifference(371,expected.frequency))<49);
});
test('wrong note and octave are rejected; tuning tolerance is bounded in cents',()=>{
  const expected=expectedGuitarNote(1,0),e4=midiToFrequency(64);
  assert.equal(expected.label,'E4');
  assert.equal(matchNote(frequencyToNote(e4),expected),true);
  assert.equal(matchNote(frequencyToNote(midiToFrequency(65)),expected),false,'F4 must fail');
  assert.equal(matchNote(frequencyToNote(midiToFrequency(52)),expected),false,'E3 must fail');
  assert.equal(matchNote(frequencyToNote(midiToFrequency(76)),expected),false,'E5 must fail');
  assert.equal(matchNote(frequencyToNote(midiToFrequency(40)),expected),false,'E2 must fail');
  assert.equal(matchNote(frequencyToNote(e4*2**(48/1200)),expected),true,'inside ±49 cents');
  assert.equal(matchNote(frequencyToNote(e4*2**(51/1200)),expected),false,'outside ±49 cents');
  assert.equal(matchNote(null,expected),false);
});
test('YIN pitch detector handles guitar fundamentals, harmonics and silence',()=>{
  const sampleRate=11025,length=2048;
  const synth=(fundamental,partials=[[1,1]],amplitude=.22)=>Float32Array.from({length},(_,i)=>amplitude*partials.reduce((sum,[harmonic,gain])=>sum+gain*Math.sin(2*Math.PI*fundamental*harmonic*i/sampleRate),0));
  for(const hz of [82.41,329.63,369.99,659.25,1318.51]){const result=detectPitch(synth(hz),sampleRate);assert.ok(result.frequency,`no pitch for ${hz}`);close(result.frequency,hz,hz*.015)}
  const guitarLike=detectPitch(synth(82.41,[[1,.28],[2,1],[3,.3]]),sampleRate);assert.ok(guitarLike.frequency);close(guitarLike.frequency,82.41,2.5);
  const microphoneConfig=detectPitch(synth(329.63),sampleRate,{minRms:.012,minConfidence:.72});assert.ok(microphoneConfig.frequency,'microphone overrides keep default frequency bounds');close(microphoneConfig.frequency,329.63,3);
  assert.equal(detectPitch(new Float32Array(length),sampleRate).frequency,null);
});
test('stabilizer waits for a consistent note and clears on silence',()=>{
  const stabilizer=new PitchStabilizer({frames:5,cents:55,minRms:.012,minConfidence:.72}),pitch={frequency:370,confidence:.95,level:.08};
  for(let i=0;i<4;i++)assert.equal(stabilizer.push(pitch).frequency,null);
  assert.ok(stabilizer.push(pitch).frequency);
  assert.equal(stabilizer.push({frequency:null,confidence:0,level:0}).frequency,null);
  assert.equal(stabilizer.push(pitch).stableFrames,1);
});
test('harmonic octave jumps reset the stability window instead of causing a match',()=>{
  const stabilizer=new PitchStabilizer({frames:5,cents:55,minRms:.012,minConfidence:.72});
  const fsharp={frequency:369.99,confidence:.95,level:.08};
  for(let i=0;i<4;i++)stabilizer.push(fsharp);
  const octaveJump=stabilizer.push({frequency:739.98,confidence:.95,level:.08});
  assert.equal(octaveJump.frequency,null);assert.equal(octaveJump.stableFrames,1);
  for(let i=0;i<4;i++)assert.equal(stabilizer.push(fsharp).frequency,null);
  assert.ok(stabilizer.push(fsharp).frequency);
});



test('one physical string attack creates one onset while its tone rings for two seconds',()=>{
  const detector=new GuitarOnsetDetector({minRms:.02,riseRatio:1.5,refractoryMs:150});
  assert.equal(detector.push(.004,0),false);
  assert.equal(detector.push(.065,20),true);
  let laterOnsets=0;
  for(let time=36;time<=2036;time+=16)if(detector.push(.065,time))laterOnsets++;
  assert.equal(laterOnsets,0);
});
test('ambient low-level noise does not create a guitar onset',()=>{
  const detector=new GuitarOnsetDetector({minRms:.02,riseRatio:1.5});
  let onsets=0;
  for(let time=0;time<2000;time+=16)if(detector.push(.009+Math.sin(time)*.002,time))onsets++;
  assert.equal(onsets,0);
});
test('brief unstable pitch is ignored until the expected pitch stabilizes',()=>{
  const stabilizer=new PitchStabilizer({frames:3,cents:55,minRms:.012,minConfidence:.72}),f=(frequency)=>({frequency,confidence:.94,level:.08});
  assert.equal(stabilizer.push(f(369.99)).frequency,null);
  assert.equal(stabilizer.push(f(392)).frequency,null);
  assert.equal(stabilizer.push(f(392)).frequency,null);
  assert.equal(stabilizer.push(f(392)).frequency,392);
});
test('a fresh pluck can retrigger while the previous string tone still rings',()=>{
  const detector=new GuitarOnsetDetector({minRms:.02,riseRatio:1.3,retriggerRatio:1.28,refractoryMs:150});
  assert.equal(detector.push(.05,0),true);
  for(let time=16;time<=480;time+=16)assert.equal(detector.push(.05,time),false);
  assert.equal(detector.push(.085,500),true);
});
test('microphone attacks near the pitch detection floor still produce an onset',()=>{
  const detector=new GuitarOnsetDetector({minRms:.012,riseRatio:1.3});
  assert.equal(detector.push(.004,0),false);
  assert.equal(detector.push(.016,20),true);
});