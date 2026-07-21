/* Tiny synthesized sound kit — no audio assets, pure Web Audio.
   Optional: children can turn sounds off in Settings (persisted locally). */

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (ctx && ctx.state === "closed") ctx = null;
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  } catch {
    // audio must never break the app — a silent world still works
    return null;
  }
}

export function soundsEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    // localStorage itself THROWS on iOS with "Block All Cookies" enabled —
    // sounds are a nice-to-have, never a reason for a dead button
    return localStorage.getItem("qf_sounds") !== "off";
  } catch {
    return false;
  }
}

export function setSoundsEnabled(on: boolean) {
  try {
    localStorage.setItem("qf_sounds", on ? "on" : "off");
  } catch {}
}

function tone(
  ac: AudioContext,
  freq: number,
  start: number,
  dur: number,
  {
    type = "sine",
    gain = 0.12,
    glideTo,
  }: { type?: OscillatorType; gain?: number; glideTo?: number } = {}
) {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ac.currentTime + start);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, ac.currentTime + start + dur);
  g.gain.setValueAtTime(0, ac.currentTime + start);
  g.gain.linearRampToValueAtTime(gain, ac.currentTime + start + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + start + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(ac.currentTime + start);
  osc.stop(ac.currentTime + start + dur + 0.05);
}

function sparkleNoise(ac: AudioContext, start: number, dur: number, gain = 0.05) {
  const size = Math.floor(ac.sampleRate * dur);
  const buffer = ac.createBuffer(1, size, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < size; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / size);
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = 5000;
  const g = ac.createGain();
  g.gain.value = gain;
  src.connect(filter).connect(g).connect(ac.destination);
  src.start(ac.currentTime + start);
}

export const sfx = {
  click() {
    if (!soundsEnabled()) return;
    const ac = audio();
    if (!ac) return;
    tone(ac, 720, 0, 0.06, { type: "triangle", gain: 0.05 });
  },
  coin() {
    if (!soundsEnabled()) return;
    const ac = audio();
    if (!ac) return;
    tone(ac, 990, 0, 0.09, { type: "square", gain: 0.05 });
    tone(ac, 1485, 0.07, 0.16, { type: "square", gain: 0.05 });
  },
  complete() {
    if (!soundsEnabled()) return;
    const ac = audio();
    if (!ac) return;
    [523.25, 659.25, 783.99].forEach((f, i) => tone(ac, f, i * 0.09, 0.22, { type: "triangle", gain: 0.09 }));
    sparkleNoise(ac, 0.25, 0.3);
  },
  levelUp() {
    if (!soundsEnabled()) return;
    const ac = audio();
    if (!ac) return;
    [392, 523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      tone(ac, f, i * 0.11, 0.3, { type: "sawtooth", gain: 0.055 })
    );
    tone(ac, 1046.5, 0.62, 0.7, { type: "triangle", gain: 0.08 });
    sparkleNoise(ac, 0.6, 0.6, 0.06);
  },
  chest() {
    if (!soundsEnabled()) return;
    const ac = audio();
    if (!ac) return;
    tone(ac, 140, 0, 0.18, { type: "square", gain: 0.06, glideTo: 90 }); // creak
    [659.25, 830.61, 987.77, 1318.5].forEach((f, i) =>
      tone(ac, f, 0.22 + i * 0.07, 0.25, { type: "triangle", gain: 0.07 })
    );
    sparkleNoise(ac, 0.3, 0.5);
  },
  whoosh() {
    if (!soundsEnabled()) return;
    const ac = audio();
    if (!ac) return;
    tone(ac, 300, 0, 0.25, { type: "sine", gain: 0.06, glideTo: 900 });
  },
  /* a tiny happy squeak — the companion answering a poke */
  chirp() {
    if (!soundsEnabled()) return;
    const ac = audio();
    if (!ac) return;
    tone(ac, 740, 0, 0.07, { type: "triangle", gain: 0.05 });
    tone(ac, 988, 0.06, 0.1, { type: "triangle", gain: 0.045 });
  },
  /* The Legend Ceremony's music: a gentle rising theme, ~7s — soft pad
     chords underneath, a harp-like arpeggio climbing above, and a shimmer
     as it resolves. Pure Web Audio, no assets. */
  ceremony() {
    if (!soundsEnabled()) return;
    const ac = audio();
    if (!ac) return;
    // pad: C — Am — F — G — C, warm triangles two octaves down
    const pads: [number[], number][] = [
      [[130.81, 196.0, 261.63], 0], // C3 G3 C4
      [[110.0, 164.81, 261.63], 1.4], // A2 E3 C4
      [[87.31, 174.61, 261.63], 2.8], // F2 F3 C4
      [[98.0, 196.0, 293.66], 4.2], // G2 G3 D4
      [[130.81, 196.0, 329.63], 5.6], // C3 G3 E4
    ];
    for (const [chord, at] of pads)
      for (const f of chord) tone(ac, f, at, 1.7, { type: "triangle", gain: 0.035 });
    // harp arpeggio climbing over it
    const arp = [523.25, 659.25, 783.99, 1046.5, 987.77, 1046.5, 1318.5, 1567.98];
    arp.forEach((f, i) => tone(ac, f, 0.5 + i * 0.55, 0.5, { type: "sine", gain: 0.055 }));
    // resolution: one bright sustained star + shimmer
    tone(ac, 2093, 5.4, 1.4, { type: "sine", gain: 0.05 });
    sparkleNoise(ac, 5.5, 0.9, 0.05);
    sparkleNoise(ac, 1.2, 0.5, 0.03);
  },
  sad() {
    if (!soundsEnabled()) return;
    const ac = audio();
    if (!ac) return;
    tone(ac, 392, 0, 0.2, { type: "triangle", gain: 0.06 });
    tone(ac, 311, 0.18, 0.3, { type: "triangle", gain: 0.06 });
  },
};
