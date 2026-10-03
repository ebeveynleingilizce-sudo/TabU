const OPEN_MIDI={e:64,B:59,G:55,D:50,A:45,E:40};

// A lightweight plucked-string voice for the MVP. Replaceable with recorded samples later.
class GuitarSynth{
  constructor(){this.context=null;this.master=null}
  ensureContext(){
    if(!this.context){
      this.context=new AudioContext();
      this.master=this.context.createGain();
      this.master.gain.value=.42;
      this.master.connect(this.context.destination);
    }
    if(this.context.state==='suspended')this.context.resume();
    return this.context;
  }
  playTabNotes(notes=[]){
    if(!notes.length)return;
    const ctx=this.ensureContext(),now=ctx.currentTime;
    for(const note of notes){
      const midi=(OPEN_MIDI[note.string]??64)+Number(note.fret||0);
      const fundamental=440*Math.pow(2,(midi-69)/12);
      const voice=ctx.createGain();
      const filter=ctx.createBiquadFilter();
      filter.type='lowpass';filter.frequency.setValueAtTime(Math.min(9500,fundamental*13),now);filter.frequency.exponentialRampToValueAtTime(Math.max(700,fundamental*3),now+.24);
      voice.gain.setValueAtTime(.0001,now);voice.gain.exponentialRampToValueAtTime(.16,now+.008);voice.gain.exponentialRampToValueAtTime(.0001,now+.72);
      filter.connect(voice);voice.connect(this.master);
      for(const [multiple,volume] of [[1,1],[2,.31],[3,.13],[4,.055]]){
        const osc=ctx.createOscillator(),partial=ctx.createGain();
        osc.type='triangle';osc.frequency.value=fundamental*multiple;partial.gain.value=volume;osc.connect(partial);partial.connect(filter);osc.start(now);osc.stop(now+.74);
      }
      setTimeout(()=>{filter.disconnect();voice.disconnect()},1000);
    }
  }
}

export const guitarSynth=new GuitarSynth();
