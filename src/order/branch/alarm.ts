// Loud, repeating alarm made with Web Audio (no sound files). Browsers only allow sound after a tap,
// so the branch taps "ابدأ استقبال الطلبات" once at the start of the shift.
let ctx: AudioContext | null = null;

export async function unlockAudio() {
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') await ctx.resume();
}

function tone(freq: number, start: number, dur: number, gain: number) {
  if (!ctx) return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'square'; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(gain, start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g).connect(ctx.destination);
  o.start(start); o.stop(start + dur + 0.05);
}

// new order: two-tone ding-dong; urgent (waiting 2+ minutes): faster, higher, louder; offline: low double beep
export function ring(kind: 'new' | 'urgent' | 'offline') {
  if (!ctx) return;
  const t = ctx.currentTime;
  if (kind === 'new') { tone(880, t, 0.25, 0.35); tone(660, t + 0.3, 0.35, 0.35); }
  else if (kind === 'urgent') { for (let i = 0; i < 4; i++) tone(i % 2 ? 1100 : 1400, t + i * 0.18, 0.15, 0.6); }
  else { tone(300, t, 0.3, 0.4); tone(300, t + 0.45, 0.3, 0.4); }
}

// keep the screen on while the orders page is open (where supported)
export async function keepAwake() {
  try { await (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<unknown> } }).wakeLock?.request('screen'); } catch { /* not supported */ }
}
