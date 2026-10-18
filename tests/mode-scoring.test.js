import test from 'node:test';
import assert from 'node:assert/strict';
import {TAB_MODE,normalizeTabMode,createChordProgress,recordChordPitch,chordTimeoutStatus} from '../practice/modeScoring.js';

const chord={notes:[{string:'e',fret:0},{string:'B',fret:1}]};

test('saved TAB mode accepts solo, arpeggio and chord and defaults old records to solo',()=>{
  assert.equal(normalizeTabMode('solo'),TAB_MODE.SOLO);
  assert.equal(normalizeTabMode('arpeggio'),TAB_MODE.ARPEGGIO);
  assert.equal(normalizeTabMode('chord'),TAB_MODE.CHORD);
  assert.equal(normalizeTabMode('unknown'),TAB_MODE.SOLO);
});

test('chord mode waits for each unique chord tone and ignores sustained duplicate pitches',()=>{
  const progress=createChordProgress([chord])[0];
  assert.deepEqual(recordChordPitch(chord,progress,{frequency:329.63}),{result:'partial',hits:1,total:2});
  assert.deepEqual(recordChordPitch(chord,progress,{frequency:329.63}),{result:'partial',hits:1,total:2});
  assert.deepEqual(recordChordPitch(chord,progress,{frequency:261.63}),{result:'correct',hits:2,total:2});
});

test('wrong or incomplete chord attempts resolve red; silence resolves missed',()=>{
  const untouched=createChordProgress([chord])[0],partial=createChordProgress([chord])[0];
  assert.equal(chordTimeoutStatus(untouched),'MISSED');
  recordChordPitch(chord,partial,{frequency:329.63});
  recordChordPitch(chord,partial,{frequency:440});
  assert.equal(chordTimeoutStatus(partial),'WRONG');
});
