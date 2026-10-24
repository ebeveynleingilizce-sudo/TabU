import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {parseTab} from '../tab/tabParser.js';
import {PracticeClock} from '../audio/practiceClock.js';
import {noteUnderPlayheadAtTime,resolveNoteStatus} from '../practice/noteScoring.js';
import {expectedGuitarNote,matchNote} from '../audio/noteMatcher.js';

const main=readFileSync(new URL('../app/main.js',import.meta.url),'utf8');

test('TAB parser preserves both Mi strings and low-string open/two-digit frets',()=>{
  const tab=parseTab('e|--1---3---5--|\nE|--0---12---22--|');
  assert.deepEqual(tab.events.flatMap(event=>event.notes).filter(note=>note.string==='E').map(note=>note.fret),[0,12,22]);
  assert.deepEqual(tab.events.flatMap(event=>event.notes).filter(note=>note.string==='e').map(note=>note.fret),[1,3,5]);
});

function microphoneClass(getUserMedia,AudioContext,extra={}){
  const source=readFileSync(new URL('../audio/microphone.js',import.meta.url),'utf8').replace(/^import[^\n]*\n/,'').replaceAll('export ','');
  return vm.runInNewContext(source+'\nMicrophoneInput',{
    navigator:{mediaDevices:{getUserMedia,getSupportedConstraints:()=>({echoCancellation:true,noiseSuppression:true,autoGainControl:true}),...extra.mediaDevices}},AudioContext,
    PitchStabilizer:class{reset(){}push(result){return {...result,signal:false,candidateMidi:null,frequency:null}}},GuitarOnsetDetector:class{push(){return false}reset(){}},GuitarNoteOnsetTracker:class{push(){return {newOnset:false,onsetAgeMs:Infinity,onsetId:0}}reset(){}},SpectralFluxDetector:class{push(){return false}reset(){}},TargetFrequencyDeltaDetector:class{push(){return null}reset(){}},ArpeggioAudioMonitor:class{push(){return null}reset(){}},detectPitch(){throw new Error('global pitch detection should be skipped for target mode')},frequencyToNote(){return null},performance:{now(){return 0}},cancelAnimationFrame(){},requestAnimationFrame(){return 1},...extra
  });
}

test('microphone requests exact disabled processing when the browser supports those constraints',async()=>{
  let requested;
  const Input=microphoneClass(async constraints=>{requested=constraints;return {getTracks:()=>[{stop(){}}]}},class{constructor(){throw new Error('audio unavailable')}});
  const input=new Input(()=>{});
  await assert.rejects(input.start(),/audio unavailable/);
  assert.equal(JSON.stringify(requested.audio),JSON.stringify({channelCount:1,echoCancellation:{exact:false},noiseSuppression:{exact:false},autoGainControl:{exact:false}}));
});

test('microphone retries with best-effort disabled processing if exact constraints are rejected',async()=>{
  const calls=[];let stops=0;
  const Input=microphoneClass(async constraints=>{calls.push(constraints);if(calls.length===1)throw Object.assign(new Error('unsupported exact setting'),{name:'OverconstrainedError'});return {getTracks:()=>[{stop(){stops++}}]}},class{constructor(){throw new Error('audio unavailable')} });
  const input=new Input(()=>{});
  await assert.rejects(input.start(),/audio unavailable/);
  assert.equal(calls.length,2);
  assert.equal(JSON.stringify(calls[1].audio),JSON.stringify({channelCount:1,echoCancellation:false,noiseSuppression:false,autoGainControl:false}));
  assert.equal(stops,1);
});

test('microphone analysis records actual track processing settings from getSettings()',async()=>{
  let observed;
  const settings={autoGainControl:true,noiseSuppression:false,echoCancellation:false,channelCount:1,sampleRate:48000};
  const track={kind:'audio',getSettings:()=>settings,stop(){}};
  const stream={getTracks:()=>[track],getAudioTracks:()=>[track]};
  const Input=microphoneClass(async()=>stream,class{
    state='running';sampleRate=48000;
    createMediaStreamSource(){return {connect(){}}}
    createAnalyser(){return {fftSize:2048,frequencyBinCount:1024,getFloatTimeDomainData(buffer){buffer.fill(0)},getFloatFrequencyData(buffer){buffer.fill(-100)}}}
    async close(){}
  });
  const input=new Input(frame=>observed=frame,undefined,()=>[]);
  await input.start();
  assert.deepEqual(JSON.parse(JSON.stringify(observed.audioSettings)),settings,'diagnostics report actual device settings, including when AGC remains enabled');
  input.stop();
});

test('stopping while microphone permission is pending releases the late stream',async()=>{
  let resolve,stops=0,contexts=0;
  const Input=microphoneClass(()=>new Promise(done=>resolve=done),class{constructor(){contexts++;throw new Error('should not start after cancellation')}});
  const input=new Input(()=>{}),pending=input.start();input.stop();
  resolve({getTracks:()=>[{stop(){stops++}}]});
  await pending;
  assert.equal(stops,1);assert.equal(contexts,0);assert.equal(input.stream,null);
});

test('audio initialization failure releases acquired microphone tracks',async()=>{
  let stops=0;
  const Input=microphoneClass(async()=>({getTracks:()=>[{stop(){stops++}}]}),class{constructor(){throw new Error('audio unavailable')}});
  const input=new Input(()=>{});
  await assert.rejects(input.start(),/audio unavailable/);
  assert.equal(stops,1);assert.equal(input.stream,null);
});

test('stopping during AudioContext resume closes context and does not initialize analysis',async()=>{
  let resume,stops=0,closes=0;
  let entered;const resuming=new Promise(done=>entered=done);
  const Input=microphoneClass(async()=>({getTracks:()=>[{stop(){stops++}}]}),class{
    state='suspended';
    resume(){return new Promise(done=>{resume=done;entered()})}
    async close(){closes++}
    createMediaStreamSource(){assert.fail('analysis must not start after stop')}
  });
  const input=new Input(()=>{}),pending=input.start();await resuming;input.stop();resume();
  assert.equal(await pending,false);assert.equal(stops,1);assert.equal(closes,1);
});

test('target-guided microphone mode skips global YIN pitch detection',async()=>{
  let frames=0;
  const Input=microphoneClass(async()=>({getTracks:()=>[{stop(){}}]}),class{
    state='running';sampleRate=22050;
    createMediaStreamSource(){return {connect(){}}}
    createAnalyser(){return {fftSize:2048,frequencyBinCount:1024,getFloatTimeDomainData(buffer){buffer.fill(0)},getFloatFrequencyData(buffer){buffer.fill(-100)}}}
    async close(){}
  });
  const input=new Input(()=>frames++,undefined,()=>[]);
  assert.equal(await input.start(),true);assert.equal(frames,1);input.stop();
});

test('a stabilized onset reads the shared clock and resolves a note once',()=>{
  const source=main.slice(main.indexOf('function handleLivePitch('),main.indexOf('async function toggleMic('));
  let observed;
  const statuses=['PENDING'],practiceClock=new PracticeClock();practiceClock.seek(1.25);
  const context={LIVE_PITCH_TOLERANCE_CENTS:35,lastLiveScoreAt:0,performance:{now(){return 1000}},state:{route:'practice',running:true,step:0},liveTracking:true,practicePhase:'playing',micFrame:null,
    MICROPHONE_CONFIG:{minRms:.012,minConfidence:.72,stableFrames:5},practiceClock,practiceClockEvents:[{startTime:1.25,notes:[{string:'e',fret:0}]}],
    activeTab:{events:[{startTime:1.25,notes:[{string:'e',fret:0}]}]},TAB_MODE:{ARPEGGIO:'arpeggio'},liveStatuses:statuses,sessionCorrect:0,sessionWrong:0,
    NOTE_STATUS:{PENDING:'PENDING',CORRECT:'CORRECT',WRONG:'WRONG',MISSED:'MISSED'},isQualifiedGuitarOnset(){return true},
    noteUnderPlayheadAtTime,resolveNoteStatus,LIVE_PITCH_TOLERANCE_CENTS:35,lastLiveScoreAt:0,performance:{now(){return 1000}},document:{querySelector(){return {clientWidth:440}}},
    settlePracticeNotes(){return 0},canFinishLivePractice(){return false},allStatusesResolved(){return false},updateAudioDebug(){},
    matchNote,expectedGuitarNote,currentExercise(){return {id:'test'}},recordAnswer(){},setNoteFeedback(){},updatePracticeStatusBoard(){}};
  vm.runInNewContext(source+'\nhandleLivePitch({level:.1,note:{midi:64,frequency:329.63},confidence:.9,stableFrames:5,newOnset:true,onsetAgeMs:0});',context);
  observed=practiceClock.getMusicalTime();
  assert.equal(observed,1.25);assert.equal(statuses[0],'CORRECT');assert.equal(context.sessionCorrect,1);
});

test('arpeggio mode scores a target-frequency attack without requiring a global pitch onset',()=>{
  const source=main.slice(main.indexOf('function handleLivePitch('),main.indexOf('async function toggleMic('));
  const statuses=['PENDING'],context={state:{route:'practice',running:true},liveTracking:true,practicePhase:'playing',activeTab:{mode:'arpeggio',events:[{startTime:1,notes:[{string:'A',fret:0}]}]},
    TAB_MODE:{ARPEGGIO:'arpeggio'},liveStatuses:statuses,practiceClock:new PracticeClock(),NOTE_STATUS:{PENDING:'PENDING',CORRECT:'CORRECT',WRONG:'WRONG',MISSED:'MISSED'},
    resolveNoteStatus,performance:{now(){return 2000}},sessionCorrect:0,currentExercise(){return {id:'arp-test'}},recordAnswer(){},setNoteFeedback(){},updateAudioDebug(){},updatePracticeStatusBoard(){},settlePracticeNotes(){return 0},canFinishLivePractice(){return false}};
  context.practiceClock.seek(1);vm.runInNewContext(source+`\nhandleLivePitch({level:.08,note:null,newOnset:false,targetAttack:{index:0,deltaDb:7.4}});`,context);
  assert.deepEqual(statuses,['CORRECT']);assert.equal(context.sessionCorrect,1);
});

test('arpeggio microphone tracks the playhead target and pre-arms the next note frequency',()=>{
  const source=main.slice(main.indexOf('function arpeggioTargetCandidates('),main.indexOf('function fretboardStatuses(')),clock=new PracticeClock();clock.seek(1);
  const events=[{startTime:1,notes:[{string:'e',fret:0}]},{startTime:1.3,notes:[{string:'B',fret:1}]}],context={state:{route:'practice'},practicePhase:'playing',activeTab:{mode:'arpeggio',events},practiceClock:clock,practiceClockEvents:events,liveStatuses:['PENDING','PENDING'],
    TAB_MODE:{ARPEGGIO:'arpeggio'},NOTE_STATUS:{CORRECT:'CORRECT'},document:{querySelector(selector){return selector==='#fretboard-viewport'?{clientWidth:440}:{getBoundingClientRect(){return {width:56}}}}},noteUnderPlayheadAtTime,expectedGuitarNote};
  const candidates=vm.runInNewContext(source+'\narpeggioTargetCandidates()',context);
  assert.equal(candidates[0].index,0);assert.equal(candidates[0].eligible,true);assert.equal(candidates[0].frequency,expectedGuitarNote('e',0).frequency);
  assert.equal(candidates[1].index,1);assert.equal(candidates[1].eligible,false);assert.equal(candidates[1].frequency,expectedGuitarNote('B',1).frequency);
});

test('a note scores only while the playhead overlaps its visible number',()=>{
  const source=main.slice(main.indexOf('function handleLivePitch('),main.indexOf('async function toggleMic('));
  const events=[{startTime:0,notes:[{string:'e',fret:0}]},{startTime:1,notes:[{string:'e',fret:1}]}];
  const run=(time,pitch,statuses=['PENDING','PENDING'],receivedAt=1000)=>{
    const practiceClock=new PracticeClock();practiceClock.seek(time);
    const context={LIVE_PITCH_TOLERANCE_CENTS:35,lastLiveScoreAt:0,performance:{now(){return receivedAt}},state:{route:'practice',running:true,step:1},liveTracking:true,practicePhase:'playing',micFrame:null,
      MICROPHONE_CONFIG:{minRms:.012,minConfidence:.72,stableFrames:5},practiceClock,practiceClockEvents:events,
      activeTab:{events},TAB_MODE:{ARPEGGIO:'arpeggio'},liveStatuses:statuses,sessionCorrect:0,sessionWrong:0,NOTE_STATUS:{PENDING:'PENDING',CORRECT:'CORRECT',WRONG:'WRONG',MISSED:'MISSED'},
      isQualifiedGuitarOnset(){return true},noteUnderPlayheadAtTime,resolveNoteStatus,settlePracticeNotes(){return 0},canFinishLivePractice(){return false},allStatusesResolved(){return false},
      document:{querySelector(){return {clientWidth:440}}},updateAudioDebug(){},expectedGuitarNote,matchNote,currentExercise(){return {id:'test'}},recordAnswer(){},setNoteFeedback(){},updatePracticeStatusBoard(){}};
    vm.runInNewContext(source+`\nhandleLivePitch({level:.1,note:{midi:${pitch},frequency:${pitch===64?'329.63':pitch===65?'349.23':'369.99'},detectedFrequency:${pitch===64?'329.63':pitch===65?'349.23':'369.99'}},confidence:.9,stableFrames:5,newOnset:true,onsetAgeMs:0});`,context);
    return statuses;
  };
  assert.deepEqual(run(.6,65),['PENDING','PENDING'],'a different note played before the bar reaches it is ignored');
  assert.deepEqual(run(.8,64),['PENDING','WRONG'],'a wrong pitch is scored only on the note under the bar');
  assert.deepEqual(run(.8,65),['PENDING','CORRECT'],'the matching pitch turns green while the bar overlaps the number');
  assert.deepEqual(run(1.5,66),['PENDING','PENDING'],'sound is ignored after the visual zone and bounded analysis allowance expire');
  const retry=['PENDING','PENDING'];
  run(.8,64,retry,1000);assert.deepEqual(retry,['PENDING','WRONG'],'an initial wrong pluck is shown red');
  run(.82,65,retry,1100);assert.deepEqual(retry,['PENDING','CORRECT'],'a corrected retry turns green before the playhead leaves');
});

test('wide-screen scoring starts at the note and allows bounded pitch analysis latency',()=>{
  const events=[{startTime:2,notes:[{string:'e',fret:1}]}],statuses=['PENDING'];
  assert.equal(noteUnderPlayheadAtTime(events,1.9,statuses,{scale:300,width:56,latency:.08}),-1,'latency allowance never scores before the playhead reaches the note');
  assert.equal(noteUnderPlayheadAtTime(events,2.2,statuses,{scale:300,width:56,latency:.18}),0,'pitch analysis latency is allowed briefly as the note clears the playhead');
  assert.equal(noteUnderPlayheadAtTime(events,2.28,statuses,{scale:300,width:56,latency:.18}),-1,'the late scoring allowance stays bounded');
});

test('fresh worker install caches every versioned module requested by the app',async()=>{
  const handlers={},cached=new Set(),base='https://example.test/TabU/';
  vm.runInNewContext(readFileSync(new URL('../service-worker.js',import.meta.url),'utf8'),{
    self:{addEventListener(type,handler){handlers[type]=handler},skipWaiting(){}},
    caches:{async open(){return {async addAll(files){files.forEach(file=>cached.add(new URL(file,base).href))}}}},URL
  });
  let pending;handlers.install({waitUntil(promise){pending=promise}});await pending;
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const mainEntry=html.match(/import\s*\(\s*['"](.\/app\/main\.js[^'"]*)['"]\s*\)/)||html.match(/src="(app\/main\.js[^" ]*)"/);
  assert.ok(mainEntry,'app entry module must be discoverable for offline cache verification');
  const requests=[new URL(mainEntry[1],base).href];
  for(const match of main.matchAll(/from\s*'([^']+\?[^']+)'/g))requests.push(new URL(match[1],base+'app/main.js').href);
  for(const request of requests)assert.ok(cached.has(request),`Missing offline module: ${request}`);
  assert.ok(cached.has(new URL('./audio/targetPitchDetector.js',base).href),'Missing offline arpeggio target detector');
});
