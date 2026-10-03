import test from 'node:test';
import assert from 'node:assert/strict';
import {activeEventAtTime,eventTime} from '../audio/timeline.js';
import {createStructuredTab} from '../tab/tabRenderer.js';

const times=[0,.280,.930,1.110,2.470,2.810,4.300];
const events=times.map((startTime,index)=>({startTime,notes:[{string:['e','B','G','D','A','E','e'][index],fret:index}]}));

test('irregular timestamps remain the source of active note selection',()=>{
  assert.deepEqual([0,.279,.280,.929,.930,1.109,1.110,2.469,2.470,2.810,4.299,4.300,9].map(t=>activeEventAtTime(events,t)),[0,0,1,1,2,2,3,3,4,5,5,6,6]);
  assert.deepEqual(events.map(event=>eventTime(event)),times);
});

test('forward/backward seek and pause/resume are stateless audio-time lookups',()=>{
  assert.equal(activeEventAtTime(events,5),6);
  assert.equal(activeEventAtTime(events,37),6);
  assert.equal(activeEventAtTime(events,1.11),3);
  // Holding audio.currentTime constant while paused keeps the same note active.
  for(let i=0;i<250;i++)assert.equal(activeEventAtTime(events,1.11),3);
  // Playback rate changes do not rescale note timestamps; the audio clock advances.
  assert.equal(activeEventAtTime(events,.56),1);
  assert.equal(activeEventAtTime(events,1.12),3);
});

test('five minute playback checkpoints use the audio clock without accumulated drift',()=>{
  const longTrack=Array.from({length:601},(_,index)=>({startTime:index*.5,notes:[{startTime:index*.5}]}));
  for(const seconds of [0,30,60,180,300])assert.equal(activeEventAtTime(longTrack,seconds),seconds*2);
  // A time jump backwards changes the note immediately, independent of any frame counter.
  assert.equal(activeEventAtTime(longTrack,30),60);
  assert.equal(activeEventAtTime(longTrack,5),10);
});

test('event note timestamps are a fallback and untimed events are skipped',()=>{
  const fallback=[{notes:[{startTime:0}]},{notes:[{startTime:.28}]},{notes:[{}]},{startTime:.93,notes:[]}];
  assert.equal(activeEventAtTime(fallback,.5),1);
  assert.equal(activeEventAtTime(fallback,.93),3);
  assert.equal(activeEventAtTime([{notes:[{}]}],0),-1);
  assert.equal(activeEventAtTime([],0),-1);
});

test('editor save/load model preserves note order, string, open fret and irregular timestamps',()=>{
  const source=[['e',0,0],['e',1,.28],['B',5,.93],['G',2,1.11],['D',3,2.47],['A',0,2.81],['E',3,4.3]];
  const data=Object.fromEntries(['e','B','G','D','A','E'].map(string=>[string,[]]));
  source.forEach(([string,fret,startTime],timeBeats)=>data[string].push({fret,startTime,timeBeats}));
  const reopened=createStructuredTab(data).events;
  assert.deepEqual(reopened.map(event=>[event.notes[0].string,event.notes[0].fret,event.startTime]),source);
  assert.deepEqual(reopened.map(event=>event.timeBeats),[0,1,2,3,4,5,6]);
});

