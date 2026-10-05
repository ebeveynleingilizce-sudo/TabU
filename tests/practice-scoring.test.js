import test from 'node:test';
import assert from 'node:assert/strict';
import {NOTE_STATUS,createNoteStatuses,noteHitWindow,pendingNoteAtTime,resolveNoteStatus,settleMissedStatuses,finalizeStatuses,allStatusesResolved,summarizeStatuses,noteResultClass,isQualifiedGuitarOnset} from '../practice/noteScoring.js';

const events=[0,.5,1].map((startTime,index)=>({startTime,notes:[{string:'e',fret:index}]}));

test('1: a correct guitar hit turns only its pending TAB note green',()=>{
  const statuses=createNoteStatuses(3),index=pendingNoteAtTime(events,.02,statuses);
  assert.equal(index,0);assert.equal(resolveNoteStatus(statuses,index,NOTE_STATUS.CORRECT),true);
  assert.equal(statuses[0],NOTE_STATUS.CORRECT);assert.equal(noteResultClass(statuses[0]),'correct');
  assert.deepEqual(statuses.slice(1),[NOTE_STATUS.PENDING,NOTE_STATUS.PENDING]);
});
test('2: a reliable wrong pitch locks the target red',()=>{
  const statuses=createNoteStatuses(3),index=pendingNoteAtTime(events,.02,statuses);
  assert.equal(resolveNoteStatus(statuses,index,NOTE_STATUS.WRONG),true);
  assert.equal(statuses[0],NOTE_STATUS.WRONG);assert.equal(noteResultClass(statuses[0]),'wrong');
});
test('3: a target with no hit becomes missed gray only after its late window closes',()=>{
  const statuses=createNoteStatuses(3),window=noteHitWindow(events,0);
  assert.deepEqual(settleMissedStatuses(statuses,events,window.end),[]);
  assert.deepEqual(settleMissedStatuses(statuses,events,window.end+.001),[0]);
  assert.equal(statuses[0],NOTE_STATUS.MISSED);assert.equal(noteResultClass(statuses[0]),'missed');
});
test('4: repeated pitch frames cannot score one target twice or change its locked result',()=>{
  const statuses=createNoteStatuses(3),index=pendingNoteAtTime(events,.02,statuses);
  assert.equal(resolveNoteStatus(statuses,index,NOTE_STATUS.CORRECT),true);
  for(let i=0;i<120;i++)assert.equal(resolveNoteStatus(statuses,index,NOTE_STATUS.WRONG),false);
  assert.equal(statuses[0],NOTE_STATUS.CORRECT);
});
test('5: low-level room noise cannot qualify as a guitar onset',()=>{
  const statuses=createNoteStatuses(3);
  assert.equal(pendingNoteAtTime(events,.02,statuses),0);
  assert.equal(isQualifiedGuitarOnset({level:.009,note:null,confidence:0,stableFrames:0,newOnset:false}),false);
  assert.equal(statuses[0],NOTE_STATUS.PENDING);
});
test('6: a one-frame pitch transient is ignored; stable guitar pitch still needs a new pick onset',()=>{
  assert.equal(isQualifiedGuitarOnset({level:.08,note:{midi:66},confidence:.95,stableFrames:2,newOnset:true}),false);
  assert.equal(isQualifiedGuitarOnset({level:.08,note:{midi:66},confidence:.95,stableFrames:5,newOnset:false}),false);
  assert.equal(isQualifiedGuitarOnset({level:.08,note:{midi:66},confidence:.95,stableFrames:5,newOnset:true}),true);
});
test('7: small early or late timing offsets stay inside a forgiving non-overlapping hit window',()=>{
  const window=noteHitWindow(events,1);
  assert.ok(pendingNoteAtTime(events,window.start+.005,createNoteStatuses(3))===1);
  assert.ok(pendingNoteAtTime(events,window.end-.005,createNoteStatuses(3))===1);
  assert.ok(window.start>noteHitWindow(events,0).end);
});
test('8: an already correct result remains correct after later sound and timeout processing',()=>{
  const statuses=createNoteStatuses(3);resolveNoteStatus(statuses,0,NOTE_STATUS.CORRECT);
  settleMissedStatuses(statuses,events,10);
  assert.equal(statuses[0],NOTE_STATUS.CORRECT);
  assert.deepEqual(statuses,[NOTE_STATUS.CORRECT,NOTE_STATUS.MISSED,NOTE_STATUS.MISSED]);
});
test('9: final summary accounts for every target and computes correct divided by total',()=>{
  const statuses=createNoteStatuses(3);resolveNoteStatus(statuses,0,NOTE_STATUS.CORRECT);resolveNoteStatus(statuses,1,NOTE_STATUS.WRONG);
  finalizeStatuses(statuses);const summary=summarizeStatuses(statuses);
  assert.deepEqual(summary,{total:3,correct:1,wrong:1,missed:1,pending:0,accuracy:33});
  assert.equal(summary.correct+summary.wrong+summary.missed,summary.total);
});
