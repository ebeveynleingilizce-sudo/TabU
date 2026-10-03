# TabU Nightly Audit

Date: 2026-10-04

## Musical Correctness Audit

- **TAB → note conversion:** Passed. Standard tuning uses string 1..6 = E4/B3/G3/D3/A2/E2 (MIDI 64/59/55/50/45/40); fret adds semitones. The editor stores string, fret, order (`timeBeats`) and optional `startTime`; note name, MIDI and frequency are derived.
- **Timestamp accuracy:** Irregular timestamps `[0.000, 0.280, 0.930, 1.110, 2.470, 2.810, 4.300]` remain unchanged through the structured save/load model test. They are not converted to equal BPM intervals.
- **Audio/TAB synchronization:** With a timed audio recording, `audio.currentTime` is the master clock. The active event is looked up from timestamps; requestAnimationFrame only redraws. Seeking forward/backward selects the corresponding event immediately. Pause holds the media clock; resume follows it. Playback rate changes use the media element rate, without scaling note timestamps. Five-minute checkpoints passed the deterministic clock lookup test; no browser/hardware five-minute playback soak was run.
- **Pitch detector:** Monophonic YIN-style cumulative-mean-difference detector, downsampled microphone frames, RMS gate, confidence threshold, five-frame median stabilization, and exact MIDI plus cents comparison. Detector range is 72–1400 Hz; RMS floor 0.012, confidence 0.72, stabilization spread 55 cents, acceptance tolerance ±35 cents.
- **Octave errors:** Rejected by exact MIDI comparison. Tests cover E4 against F4, E3, E2 and E5, plus F♯ octave-up/down.
- **Harmonic behavior:** A synthetic E2 waveform with a stronger second harmonic resolves to E2; a detected octave jump clears the stabilizer window. These are synthetic signals, not recorded guitar samples.
- **Noise behavior:** Silence/no-signal frames do not score wrong answers. A signal below RMS threshold remains in listening state.
- **Automatic results:** `node --test` passed 13/13 tests: tuning/fret matrix, frequency and cents matching, octave rejection, harmonic-rich synthetic pitches, noise, stabilization, irregular timestamp selection, forward/backward seeks, pause/rate clock lookups, five-minute checkpoints, and structured editor save/load ordering.
- **REAL-GUITAR VALIDATION:** **MANUAL REAL-GUITAR VALIDATION REQUIRED.** No recorded guitar corpus or live microphone/guitar was available during this run. Test each string/fret matrix entry on a real instrument and at least one phone and laptop microphone; inspect `?debug=1` for expected/detected frequency, cents, RMS, confidence, stable frames and state. The app cannot acoustically prove which physical string was played when the same pitch exists on another string.

## Teacher Workflow Audit

- **TAB creation:** Browser smoke test confirmed title, BPM, fret, string, six-line string-only selector, audio upload control and add action. The fretboard has no fret divisions or fret-number labels. The requested BPM/fret/string controls remain.
- **Correction and deletion:** Added a compact ordered note strip. A teacher can select any entry, change its string/fret and update it without changing its sequence slot; “Son notayı sil” and “Tümünü temizle” are available. Browser smoke test changed note 2 and confirmed later notes retained their order; undo/delete restored the original sequence.
- **Open strings/repeats/string changes:** Fret 0 is stored as zero, repeated notes remain distinct sequence entries, and each entry retains its string. The structured model test covers alternating strings and an open string.
- **Timing:** The “Zamanlamayı ayarla” screen marks notes with the audio clock and permits selecting a mark and adjusting it by 0.01/0.10 seconds. Since the editor hides raw TAB text and the duplicate preview as requested, preview is the saved student practice screen.
- **Save/load:** Structured model round-trip passed with irregular timestamps. Browser-level upload → mark timing → save → reopen with a real audio file was not performed in this audit.

## Student Workflow Audit

- **Listen/visual follow:** The practice screen shows six strings and time-positioned notes. Active-note styling follows the timestamp-selected event for its full interval instead of fading after a short fixed window.
- **Microphone matching:** Expected pitch comes from the active TAB string/fret. Wrong pitch or wrong octave fails; low-level input stays in listening state. With timed backing audio, scoring follows the audio-selected note; without a timed recording, correct notes advance sequentially.
- **Pause/resume/seek/rate:** The implementation is tied to `audio.currentTime`, including `timeupdate`, `seeking` and `seeked` updates. Browser smoke inspection confirmed the practice UI and audio-speed options exist. No live microphone permission was granted and no child session was conducted.
- **Completion:** Sequential non-audio sessions complete after the final note. In timed sessions, the final expected note completes the session when correctly played.

## Known Limits

- Synthetic unit tests do not establish pitch-detection reliability on a real guitar, room noise, phone speaker bleed, or every device microphone. Real instrument validation remains required.
- The current harmonic handling comes from YIN periodicity plus stabilization and octave-aware matching; no dedicated spectral harmonic classifier is claimed.
- A microphone detects pitch, not the physical string/fret position. The TAB UI teaches the position and compares its expected pitch.
- A five-minute deterministic timing lookup test passed, but real media decode/device timing and background tab throttling still need manual browser soak testing.

