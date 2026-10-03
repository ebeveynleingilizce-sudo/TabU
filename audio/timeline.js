// Audio currentTime is the single timing source. This pure lookup is used on
// every animation frame, so seeking, pausing, resuming and rate changes cannot
// accumulate a second independent playback clock.
export function eventTime(event){
  if(Number.isFinite(event?.startTime))return event.startTime;
  return event?.notes?.map(note=>note.startTime).find(Number.isFinite)??null;
}

const timedCache=new WeakMap();
function timedEvents(events){
  let timed=timedCache.get(events);
  if(!timed){timed=events.map((event,index)=>({index,time:eventTime(event)})).filter(item=>Number.isFinite(item.time)).sort((a,b)=>a.time-b.time||a.index-b.index);timedCache.set(events,timed)}
  return timed;
}

export function activeEventAtTime(events,currentTime){
  if(!Array.isArray(events)||events.length===0)return -1;
  const timed=timedEvents(events);
  if(!timed.length)return -1;
  let active=timed[0];
  for(const item of timed){if(item.time>currentTime)break;active=item}
  return active.index;
}

