/**
 * A short brass-like fanfare synthesized locally with Web Audio: no audio file,
 * no network. Resolves false when the platform blocks autoplay; never retries.
 */
const NOTES: [number, number, number][] = [
  // [frequency Hz, start s, length s]: G4 C5 E5, then a held G5.
  [392, 0, 0.16],
  [523.25, 0.18, 0.16],
  [659.25, 0.36, 0.16],
  [783.99, 0.56, 0.62],
];
export async function playFanfare(volume = 0.12): Promise<boolean> {
  const Context =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Context) return false;
  let context: AudioContext;
  try {
    context = new Context();
    if (context.state === "suspended") await context.resume();
    if (context.state !== "running") {
      void context.close();
      return false;
    }
  } catch {
    return false;
  }
  const master = context.createGain();
  master.gain.value = volume;
  master.connect(context.destination);
  const start = context.currentTime + 0.05;
  for (const [frequency, at, length] of NOTES) {
    const tone = context.createOscillator();
    const body = context.createOscillator();
    const filter = context.createBiquadFilter();
    const envelope = context.createGain();
    tone.type = "sawtooth";
    body.type = "square";
    tone.frequency.value = frequency;
    body.frequency.value = frequency / 2;
    filter.type = "lowpass";
    filter.Q.value = 2;
    const t0 = start + at;
    // A brass "blat": the filter opens quickly, then settles.
    filter.frequency.setValueAtTime(600, t0);
    filter.frequency.exponentialRampToValueAtTime(3200, t0 + 0.05);
    filter.frequency.exponentialRampToValueAtTime(1600, t0 + length);
    envelope.gain.setValueAtTime(0.0001, t0);
    envelope.gain.exponentialRampToValueAtTime(1, t0 + 0.03);
    envelope.gain.setValueAtTime(0.85, t0 + length - 0.05);
    envelope.gain.exponentialRampToValueAtTime(0.0001, t0 + length + 0.08);
    tone.connect(filter);
    body.connect(filter);
    filter.connect(envelope);
    envelope.connect(master);
    for (const o of [tone, body]) {
      o.start(t0);
      o.stop(t0 + length + 0.1);
    }
  }
  const end = NOTES.at(-1)!;
  window.setTimeout(
    () => void context.close().catch(() => undefined),
    (end[1] + end[2] + 0.4) * 1000,
  );
  return true;
}
