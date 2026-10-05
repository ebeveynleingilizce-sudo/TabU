export const NOTE_STATUS=Object.freeze({PENDING:'PENDING',CORRECT:'CORRECT',WRONG:'WRONG',MISSED:'MISSED'});
export const HIT_WINDOW_SECONDS=Object.freeze({early:.18,late:.3});
function targetTime(event){if(Number.isFinite(event?.startTime))return event.startTime;return event?.notes?.map(note=>note.startTime).find(Number.isFinite)??null}
export function createNoteStatuses(count){return Array.from({length:Math.max(0,count)},()=>NOTE_STATUS.PENDING)}
export function noteHitWindow(events,index,{early=HIT_WINDOW_SECONDS.early,late=HIT_WINDOW_SECONDS.late}={}){
  const time=targetTime(events?.[index]);if(!Number.isFinite(time))return null;
  const previous=targetTime(events[index-1]),next=targetTime(events[index+1]);
  const earlyGap=Number.isFinite(previous)?Math.max(0,time-previous):Infinity;
  const lateGap=Number.isFinite(next)?Math.max(0,next-time):Infinity;
  return {start:time-Math.min(early,earlyGap*.45),end:time+Math.min(late,lateGap*.45)};
}
export function pendingNoteAtTime(events,time,statuses){
  for(let index=0;index<events.length;index++){
    if(statuses[index]!==NOTE_STATUS.PENDING)continue;
    const window=noteHitWindow(events,index);
    if(window&&time>=window.start&&time<=window.end)return index;
  }
  return -1;
}
export function resolveNoteStatus(statuses,index,result){
  if(index<0||index>=statuses.length||statuses[index]!==NOTE_STATUS.PENDING)return false;
  if(result!==NOTE_STATUS.CORRECT&&result!==NOTE_STATUS.WRONG)return false;
  statuses[index]=result;return true;
}
export function settleMissedStatuses(statuses,events,time){
  const missed=[];
  for(let index=0;index<events.length;index++){
    if(statuses[index]!==NOTE_STATUS.PENDING)continue;
    const window=noteHitWindow(events,index);
    if(window&&time>window.end){statuses[index]=NOTE_STATUS.MISSED;missed.push(index)}
  }
  return missed;
}
export function finalizeStatuses(statuses){
  for(let index=0;index<statuses.length;index++)if(statuses[index]===NOTE_STATUS.PENDING)statuses[index]=NOTE_STATUS.MISSED;
  return statuses;
}
export function allStatusesResolved(statuses){return statuses.length>0&&statuses.every(status=>status!==NOTE_STATUS.PENDING)}
export function summarizeStatuses(statuses){
  const total=statuses.length,correct=statuses.filter(status=>status===NOTE_STATUS.CORRECT).length,wrong=statuses.filter(status=>status===NOTE_STATUS.WRONG).length,missed=statuses.filter(status=>status===NOTE_STATUS.MISSED).length,pending=statuses.filter(status=>status===NOTE_STATUS.PENDING).length;
  return {total,correct,wrong,missed,pending,accuracy:total?Math.round(correct/total*100):0};
}

export function noteResultClass(status){
  return status===NOTE_STATUS.CORRECT?'correct':status===NOTE_STATUS.WRONG?'wrong':status===NOTE_STATUS.MISSED?'missed':'';
}
export function isQualifiedGuitarOnset(frame,{minRms=.012,minConfidence=.72,stableFrames=5}={}){
  return Boolean(frame?.newOnset&&frame.level>=minRms&&frame.note&&frame.confidence>=minConfidence&&frame.stableFrames>=stableFrames)
}