import { useSoundStore } from "../store/soundStore";

// Native Web Audio oscillator beeps — no audio files to ship/license.
let ctx: AudioContext | null = null;
function getCtx(): AudioContext {
  if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  return ctx;
}

type SoundKind = "click" | "spin" | "win" | "bigwin" | "mlg";

const RECIPES: Record<Exclude<SoundKind, "mlg">, { freq: number; duration: number; type: OscillatorType }> = {
  click: { freq: 440, duration: 0.05, type: "square" },
  spin: { freq: 220, duration: 0.08, type: "triangle" },
  win: { freq: 660, duration: 0.18, type: "sine" },
  bigwin: { freq: 880, duration: 0.3, type: "sine" },
};

export function playSound(kind: SoundKind) {
  const { muted, volume } = useSoundStore.getState();
  if (muted || volume <= 0) return;

  try {
    const audioCtx = getCtx();
    if (kind === "mlg") {
      playMlgHorn(audioCtx, volume);
      return;
    }

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const { freq, duration, type } = RECIPES[kind];

    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(volume * 0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch {
    // Some browsers block AudioContext until a user gesture — silently skip.
  }
}

// Exaggerated "air horn" sweep — two overlapping sawtooth oscillators, each doing a rapid
// descending frequency ramp, classic meme air-horn shape.
function playMlgHorn(audioCtx: AudioContext, volume: number) {
  [0, 0.18].forEach((startOffset) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const start = audioCtx.currentTime + startOffset;
    const duration = 0.35;

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(900, start);
    osc.frequency.exponentialRampToValueAtTime(140, start + duration);
    gain.gain.setValueAtTime(volume * 0.22, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(start);
    osc.stop(start + duration);
  });
}
