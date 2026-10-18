import {expectedGuitarNote,matchNote} from '../audio/noteMatcher.js';

export const TAB_MODE=Object.freeze({SOLO:'solo',ARPEGGIO:'arpeggio',CHORD:'chord'});
export function normalizeTabMode(mode){return Object.values(TAB_MODE).includes(mode)?mode:TAB_MODE.SOLO}
export function createChordProgress(events){return events.map(()=>({hits:new Set(),wrong:false}))}
export function recordChordPitch(event,progress,detected,toleranceCents=35){
  const expected=[...new Map((event?.notes||[]).map(note=>{const pitch=expectedGuitarNote(note.string,note.fret);return [pitch?.midi,{note,pitch}]}).filter(([midi])=>Number.isInteger(midi))).values()];
  if(!expected.length)return {result:'invalid',hits:0,total:0};
  const target=expected.find(({pitch})=>matchNote(detected,pitch,toleranceCents));
  if(!target){progress.wrong=true;return {result:'wrong',hits:progress.hits.size,total:expected.length}}
  progress.hits.add(target.pitch.midi);
  const complete=expected.every(({pitch})=>progress.hits.has(pitch.midi));
  return {result:complete?'correct':'partial',hits:progress.hits.size,total:expected.length};
}
export function chordTimeoutStatus(progress){return progress&&(progress.wrong||progress.hits.size)?'WRONG':'MISSED'}
