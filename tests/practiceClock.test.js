import test from 'node:test';
import assert from 'node:assert/strict';
import {PracticeClock} from '../audio/practiceClock.js';
import {activeEventAtTime} from '../audio/timeline.js';

const timestamps=[0,.27,.91,1.18,2.73,3.05,4.8];
const events=timestamps.map((startTime,index)=>({startTime,notes:[{string:'e',fret:index}]}));

test('microphone clock scales irregular note intervals at every supported practice rate',()=>{
  for(const rate of [.5,.75,1]){
    const clock=new PracticeClock(rate);
    clock.start(0);
    for(const realTime of [0,.27/rate,.91/rate,1.18/rate,2.73/rate,3.05/rate,4.8/rate]){
      const musicalTime=clock.update(realTime*1000);
      assert.ok(Math.abs(musicalTime-realTime*rate)<1e-9);
      assert.equal(activeEventAtTime(events,musicalTime),timestamps.indexOf(Number(musicalTime.toFixed(2))));
    }
  }
});

test('audio mode uses media currentTime directly without a second rate scaling',()=>{
  for(const rate of [.5,.75,1]){
    const clock=new PracticeClock(rate);
    assert.equal(clock.getMusicalTime({mediaTime:.91,realTime:8000}),.91);
    assert.equal(activeEventAtTime(events,clock.getMusicalTime({mediaTime:.91})),2);
  }
});

test('changing rate preserves current musical time and only changes later clock movement',()=>{
  const clock=new PracticeClock(1);
  clock.start(0);
  assert.equal(clock.update(10420),10.42);
  assert.equal(clock.setRate(.5,10420),10.42);
  assert.equal(clock.update(11420),10.92);
  assert.equal(clock.setRate(.75,11420),10.92);
  assert.equal(clock.update(12420),11.67);
});

test('pause and resume preserve musical time without counting paused real time',()=>{
  const clock=new PracticeClock(.5);
  clock.start(1000);
  assert.equal(clock.pause(3000),1);
  assert.equal(clock.update(9000),1);
  clock.resume(9000);
  assert.equal(clock.update(11000),2);
});

test('source timestamps remain immutable when clock speed changes',()=>{
  const clock=new PracticeClock(.5),before=events.map(event=>event.startTime);
  clock.start(0);
  clock.update(1820);
  assert.equal(activeEventAtTime(events,clock.time),2);
  clock.setRate(.75,1820);
  clock.update(3153.3333333333335);
  assert.deepEqual(events.map(event=>event.startTime),before);
  assert.deepEqual(before,timestamps);
});

