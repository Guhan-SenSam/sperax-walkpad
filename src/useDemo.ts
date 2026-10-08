import { useEffect, useState } from 'react';
import type { PadState, PadStatus } from './protocol';

// Scripted pad states for previewing the UI without a pad (e.g. in an emulator).
// Demo data never reaches the workout tracker or Health Connect.
const SCRIPT: { state: PadState; secs: number; speed?: number; level?: number }[] = [
  { state: 'idle', secs: 3 },
  { state: 'countdown', secs: 3 },
  { state: 'running', secs: 14, speed: 3.5 },
  { state: 'paused', secs: 4 },
  { state: 'running', secs: 8, speed: 5 },
  { state: 'stopping', secs: 3 },
  { state: 'vibrating', secs: 6, level: 3 },
  { state: 'vibrating', secs: 6, level: 8 },
];
const TOTAL = SCRIPT.reduce((n, s) => n + s.secs, 0);

function statusAt(tick: number, base: { steps: number; seconds: number }): PadStatus {
  let t = tick % TOTAL;
  let i = 0;
  while (t >= SCRIPT[i].secs) t -= SCRIPT[i++].secs;
  const step = SCRIPT[i];
  const speed =
    step.state === 'running' ? step.speed! : step.state === 'stopping' ? Math.max(0, 5 - t * 1.6) : 0;
  return {
    state: step.state,
    stateCode: 0,
    countdown: step.state === 'countdown' ? 3 - t : null,
    seconds: base.seconds,
    distanceKm: Math.round(base.seconds * 0.11) / 100,
    steps: base.steps,
    calories: Math.round(base.seconds / 12),
    speedKmh: Math.round(speed * 10) / 10,
    vibrationLevel: step.level ?? 0,
  };
}

export function useDemo(enabled: boolean): PadStatus | null {
  const [status, setStatus] = useState<PadStatus | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let tick = 0;
    const base = { steps: 1240, seconds: 742 };
    const show = () => setStatus(statusAt(tick, base));
    show();
    const id = setInterval(() => {
      tick++;
      const s = statusAt(tick, base);
      if (s.state === 'running') {
        base.seconds++;
        base.steps += Math.round(s.speedKmh / 2);
      }
      show();
    }, 1000);
    return () => {
      clearInterval(id);
      setStatus(null);
    };
  }, [enabled]);

  return enabled ? status : null;
}
