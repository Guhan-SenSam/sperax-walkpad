// Fitness Machine Service (FTMS, Bluetooth SIG 0x1826) parsing, plus the
// Sperax vendor extension on FFF3 that reports steps and vibration.

export interface TreadmillData {
  speedKmh?: number;
  distanceKm?: number;
  calories?: number;
  seconds?: number;
}

/** Parse a Treadmill Data (0x2ACD) notification. Fields depend on the flags. */
export function parseTreadmillData(b: number[]): TreadmillData {
  if (b.length < 2) return {};
  const flags = b[0] | (b[1] << 8);
  let i = 2;
  const u8 = () => b[i++];
  const u16 = () => {
    const v = b[i] | (b[i + 1] << 8);
    i += 2;
    return v;
  };
  const u24 = () => {
    const v = b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
    i += 3;
    return v;
  };
  const out: TreadmillData = {};
  const bit = (n: number) => (flags & (1 << n)) !== 0;
  const fits = (n: number) => i + n <= b.length;

  if (!bit(0) && fits(2)) out.speedKmh = u16() / 100; // "More data" clear => speed present
  if (bit(1) && fits(2)) u16(); // average speed
  if (bit(2) && fits(3)) out.distanceKm = u24() / 1000;
  if (bit(3) && fits(4)) i += 4; // inclination + ramp angle
  if (bit(4) && fits(4)) i += 4; // elevation gain
  if (bit(5) && fits(1)) u8(); // instantaneous pace
  if (bit(6) && fits(1)) u8(); // average pace
  if (bit(7) && fits(5)) {
    const total = u16();
    i += 3; // energy per hour + per minute
    if (total !== 0xffff) out.calories = total;
  }
  if (bit(8) && fits(1)) u8(); // heart rate
  if (bit(9) && fits(1)) u8(); // metabolic equivalent
  if (bit(10) && fits(2)) out.seconds = u16();
  return out;
}

export type MachineEvent = 'started' | 'stopped' | 'paused' | 'reset' | null;

/** Parse a Fitness Machine Status (0x2ADA) notification. */
export function parseMachineStatus(b: number[]): MachineEvent {
  switch (b[0]) {
    case 0x01:
      return 'reset';
    case 0x02:
      return b[1] === 0x02 ? 'paused' : 'stopped';
    case 0x04:
      return 'started';
    default:
      return null;
  }
}

export type SperaxExtra =
  | { kind: 'steps'; steps: number }
  | { kind: 'vibration'; on: boolean; level: number }
  | null;

/**
 * Sperax FFF3 notifications (from the SPX app's WalkRepository):
 *   [_, 0x02, lo, hi, ...]          steps (16-bit little-endian)
 *   [_, 0x01, state, level, ...]    vibration: state 1 = on, 2 = off
 */
export function parseSperaxExtra(b: number[]): SperaxExtra {
  if (b.length < 4) return null;
  if (b[1] === 0x02) return { kind: 'steps', steps: b[2] | (b[3] << 8) };
  if (b[1] === 0x01) return { kind: 'vibration', on: b[2] === 0x01, level: b[3] };
  return null;
}

/** Parse Supported Speed Range (0x2AD4): min, max, increment in 0.01 km/h. */
export function parseSpeedRange(b: number[]) {
  if (b.length < 4) return null;
  return { min: (b[0] | (b[1] << 8)) / 100, max: (b[2] | (b[3] << 8)) / 100 };
}

export const FtmsCommands = {
  requestControl: [0x00],
  start: [0x07],
  stop: [0x08, 0x01],
  pause: [0x08, 0x02],
  setSpeed: (kmh: number) => {
    const v = Math.round(kmh * 100);
    return [0x02, v & 0xff, (v >> 8) & 0xff];
  },
  // Sperax vendor extension, written to FFF2.
  vibrate: (level: number) => [0xf0, 0x01, 0x01, level],
  stopVibration: [0xf0, 0x01, 0x02],
};
