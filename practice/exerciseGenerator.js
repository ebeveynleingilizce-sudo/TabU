import {strings} from '../app/data.js';
const patterns={Başlangıç:[0,1,2,3],Kolay:[0,2,3,2],Orta:[0,3,5,3,7],İleri:[0,5,7,8,10,8,7,5]};
export function generateExercise(level='Başlangıç'){const string=strings[Math.floor(Math.random()*4)];const frets=patterns[level]||patterns.Başlangıç;return {string,frets,level,title:`${strings.indexOf(string)+1}. telde ${frets.join('-')} çal`,expected:frets[Math.floor(Math.random()*frets.length)]}}
