/** Minimal sound design: short synthesized cues, no audio assets. */

let ctx: AudioContext | null = null;

function tone(freq: number, start: number, dur: number, gainPeak: number) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, ctx.currentTime + start);
  gain.gain.linearRampToValueAtTime(gainPeak, ctx.currentTime + start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(ctx.currentTime + start);
  osc.stop(ctx.currentTime + start + dur + 0.02);
}

/** Two-note "needs you" cue — quiet and short. */
export function playAttention() {
  try {
    ctx = ctx ?? new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    tone(660, 0, 0.09, 0.05);
    tone(880, 0.11, 0.12, 0.05);
  } catch {
    /* audio unavailable */
  }
}
