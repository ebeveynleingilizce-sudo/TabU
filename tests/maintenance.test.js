import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {parseTab} from '../tab/tabParser.js';
import {PracticeClock} from '../audio/practiceClock.js';

const main=readFileSync(new URL('../app/main.js',import.meta.url),'utf8');

test('TAB parser preserves both Mi strings and low-string open/two-digit frets',()=>{
  const tab=parseTab('e|--1---3---5--|\nE|--0---12---22--|');
  assert.deepEqual(tab.events.flatMap(event=>event.notes).filter(note=>note.string==='E').map(note=>note.fret),[0,12,22]);
  assert.deepEqual(tab.events.flatMap(event=>event.notes).filter(note=>note.string==='e').map(note=>note.fret),[1,3,5]);
});

function microphoneClass(getUserMedia,AudioContext){
  const source=readFileSync(new URL('../audio/microphone.js',import.meta.url),'utf8').replace(/^import[^\n]*\n/,'').replaceAll('export ','');
  return vm.runInNewContext(source+'\nMicrophoneInput',{
    navigator:{mediaDevices:{getUserMedia}},AudioContext,
    PitchStabilizer:class{reset(){}},cancelAnimationFrame(){},requestAnimationFrame(){return 1}
  });
}

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

test('stable microphone frame reads the shared clock without a runtime exception',()=>{
  const source=main.slice(main.indexOf('function handleLivePitch('),main.indexOf('async function toggleMic('));
  let observed;
  const practiceClock=new PracticeClock();practiceClock.seek(1.25);
  const context={state:{route:'practice',running:true},liveTracking:true,practicePhase:'playing',micFrame:null,
    MICROPHONE_CONFIG:{minRms:.012,minConfidence:.72,stableFrames:5},practiceClock,
    syncPracticeStepToClock(time){observed=time;return 0},activeTab:{events:[]}};
  vm.runInNewContext(source+'\nhandleLivePitch({level:.1,note:{midi:64},confidence:.9,stableFrames:5});',context);
  assert.equal(observed,1.25);
});

test('fresh worker install caches every versioned module requested by the app',async()=>{
  const handlers={},cached=new Set(),base='https://example.test/TabU/';
  vm.runInNewContext(readFileSync(new URL('../service-worker.js',import.meta.url),'utf8'),{
    self:{addEventListener(type,handler){handlers[type]=handler},skipWaiting(){}},
    caches:{async open(){return {async addAll(files){files.forEach(file=>cached.add(new URL(file,base).href))}}}},URL
  });
  let pending;handlers.install({waitUntil(promise){pending=promise}});await pending;
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const requests=[new URL(html.match(/src="(app\/main\.js[^" ]*)"/)[1],base).href];
  for(const match of main.matchAll(/from\s*'([^']+\?[^']+)'/g))requests.push(new URL(match[1],base+'app/main.js').href);
  for(const request of requests)assert.ok(cached.has(request),`Missing offline module: ${request}`);
});
