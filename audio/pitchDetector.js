export function detectPitch(buffer,sampleRate){
  let rms=0;for(const v of buffer)rms+=v*v;rms=Math.sqrt(rms/buffer.length);
  if(rms<0.012)return {frequency:null,confidence:0,level:rms};
  const min=Math.floor(sampleRate/900),max=Math.min(Math.floor(sampleRate/65),Math.floor(buffer.length/2));
  const correlation=new Float32Array(max+2);
  for(let lag=min;lag<=max;lag++){
    let cross=0,left=0,right=0;
    for(let i=0;i<buffer.length-lag;i++){const a=buffer[i],b=buffer[i+lag];cross+=a*b;left+=a*a;right+=b*b}
    correlation[lag]=left&&right?cross/Math.sqrt(left*right):0;
  }
  // Use the first strong local peak to avoid selecting a later harmonic period (octave errors).
  let best=-1;
  for(let lag=min+1;lag<max;lag++)if(correlation[lag]>.68&&correlation[lag]>=correlation[lag-1]&&correlation[lag]>correlation[lag+1]){best=lag;break}
  if(best<0){let score=-1;for(let lag=min;lag<=max;lag++)if(correlation[lag]>score){score=correlation[lag];best=lag}}
  const previous=correlation[best-1],peak=correlation[best],next=correlation[best+1];
  const denominator=previous-2*peak+next;
  const offset=denominator?Math.max(-.5,Math.min(.5,.5*(previous-next)/denominator)):0;
  return {frequency:sampleRate/(best+offset),confidence:peak,level:rms};
}
