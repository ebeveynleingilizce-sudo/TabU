import {matchNote,expectedGuitarNote} from '../audio/noteMatcher.js';
export class PracticeEngine{constructor(){this.expected=null}expect(string,fret){this.expected=expectedGuitarNote(string,fret);return this.expected}check(detected){return matchNote(detected,this.expected)}}
