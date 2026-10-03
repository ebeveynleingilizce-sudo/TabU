const NOTE_NAMES=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
export const STANDARD_TUNING=Object.freeze({
  1:Object.freeze({string:1,key:'e',note:'E4',midi:64}),
  2:Object.freeze({string:2,key:'B',note:'B3',midi:59}),
  3:Object.freeze({string:3,key:'G',note:'G3',midi:55}),
  4:Object.freeze({string:4,key:'D',note:'D3',midi:50}),
  5:Object.freeze({string:5,key:'A',note:'A2',midi:45}),
  6:Object.freeze({string:6,key:'E',note:'E2',midi:40})
});
export const PITCH_TOLERANCE_CENTS=35;
const STRING_NUMBER={e:1,B:2,G:3,D:4,A:5,E:6};
export function midiToFrequency(midi){return Number.isFinite(midi)&&midi>=0?440*2**((midi-69)/12):null}
export function stringFretToMidi(string,fret){const stringNumber=typeof string==='number'?string:STRING_NUMBER[string],open=STANDARD_TUNING[stringNumber]?.midi;if(!Number.isInteger(stringNumber)||!Number.isFinite(open)||!Number.isFinite(Number(fret))||Number(fret)<0)return null;return open+Math.round(Number(fret))}
export function midiToNote(midi){if(!Number.isInteger(midi)||midi<0)return null;return {name:NOTE_NAMES[((midi%12)+12)%12],octave:Math.floor(midi/12)-1,midi,frequency:midiToFrequency(midi),label:`${NOTE_NAMES[((midi%12)+12)%12]}${Math.floor(midi/12)-1}`}}
export function frequencyToMidi(frequency){return Number.isFinite(frequency)&&frequency>0?69+12*Math.log2(frequency/440):null}
export function centsDifference(detectedFrequency,expectedFrequency){return Number.isFinite(detectedFrequency)&&detectedFrequency>0&&Number.isFinite(expectedFrequency)&&expectedFrequency>0?1200*Math.log2(detectedFrequency/expectedFrequency):null}
export function frequencyToNote(frequency){const exactMidi=frequencyToMidi(frequency);if(exactMidi===null)return null;const midi=Math.round(exactMidi),note=midiToNote(midi);return {...note,frequency,detectedFrequency:frequency,cents:Math.round(1200*Math.log2(frequency/note.frequency))}}
export function expectedGuitarNote(string,fret){const midi=stringFretToMidi(string,fret);return midi===null?null:midiToNote(midi)}
export function matchNote(detected,expected,toleranceCents=PITCH_TOLERANCE_CENTS){if(!detected||!expected||!Number.isFinite(expected.midi)||!Number.isFinite(toleranceCents)||toleranceCents<0)return false;const measured=detected.detectedFrequency??detected.frequency;if(!Number.isFinite(measured)||measured<=0)return false;const midi=Math.round(frequencyToMidi(measured));return midi===expected.midi&&Math.abs(centsDifference(measured,expected.frequency))<=toleranceCents}

