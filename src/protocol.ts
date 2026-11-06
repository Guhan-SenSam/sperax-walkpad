// Sperax RM01 walking/vibration pad BLE protocol.
//
// Reverse engineered from the SPX Fitness app (com.spreax.fitness202412,
// FoldRunCommands / CrcTools) and verified against a real SPERAX_RM01.
//
// Transport: service FFF0, write commands to FFF2 (write without response),
// responses arrive as notifications on FFF1.
//
// Frame:  F5 <len> 00 <payload...> <crcLo> <crcHi> FA
//   len  = total frame length in bytes
//   crc  = CRC-16 (init 0xFFFF, reflected poly 0xA327) over F5..payload
// The pad escapes inner bytes 0xFn as F0 0n in what it sends; it accepts
// unescaped frames from us, which avoids its quirky length/CRC handling of
// escaped input.

export const SERVICE_UUID = '0000fff0-0000-1000-8000-00805f9b34fb';
export const NOTIFY_UUID = '0000fff1-0000-1000-8000-00805f9b34fb';
export const WRITE_UUID = '0000fff2-0000-1000-8000-00805f9b34fb';

export const MIN_SPEED = 0.1; // km/h; command resolution observed in SPX traffic
export const MAX_SPEED = 6.0; // km/h; existing app safety ceiling, not verified maximum
export const MAX_VIBRATION_LEVEL = 9;

export function crc16(bytes: number[]): [number, number] {
  let crc = 0xffff;
  for (const b of bytes) {
    crc ^= b;
    for (let i = 0; i < 8; i++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xa327 : crc >>> 1;
    }
  }
  return [crc & 0xff, (crc >>> 8) & 0xff];
}

export function encodeFrame(payload: number[]): number[] {
  const frame = [0xf5, payload.length + 6, 0x00, ...payload];
  const body = [...frame.slice(2), ...crc16(frame)];
  const escaped = escapeInner(body);
  return [0xf5, frame[1] + escaped.length - body.length, ...escaped, 0xfa];
}

function escapeInner(bytes: number[]) {
  return bytes.flatMap((byte) => (byte >= 0xf0 ? [0xf0, byte & 0x0f] : [byte]));
}

export const PadCommands = {
  /** Observed in the official app before its first status poll; necessity unconfirmed. */
  initialize: () => encodeFrame([0x01]),
  /** Poll live status; the pad answers with a 0x19 status frame. */
  status: () => encodeFrame([0x19]),
  /** Lifetime totals. */
  totals: () => encodeFrame([0x1a]),
  /** Start the belt (the pad counts down 3-2-1 first). */
  start: () => encodeFrame([0x15, 0x01, 0x02, 0x00]),
  /** Set belt speed in km/h (pad ramps to it gradually). */
  setSpeed: (kmh: number) =>
    encodeFrame([0x15, 0x01, Math.round(clamp(kmh, MIN_SPEED, MAX_SPEED) * 10), 0x00]),
  pause: () => encodeFrame([0x15, 0x02, 0x00, 0x00]),
  stop: () => encodeFrame([0x15, 0x00, 0x00, 0x00]),
  /** Start vibration or change its level (1..9). Belt must be stopped. */
  vibrate: (level: number) =>
    encodeFrame([0x16, 0x01, clamp(Math.round(level), 1, MAX_VIBRATION_LEVEL)]),
  stopVibration: () => encodeFrame([0x16, 0x00, 0x00]),
};

export type PadState =
  | 'idle'
  | 'countdown'
  | 'running'
  | 'paused'
  | 'stopping'
  | 'vibrating'
  | 'unknown';

export interface PadStatus {
  state: PadState;
  stateCode: number;
  countdown: number | null; // 3, 2, 1 while counting down
  seconds: number;
  distanceKm: number; // device resolution is 10 m
  steps: number;
  calories: number;
  speedKmh: number;
  vibrationLevel: number | null;
}

function stateFromCode(code: number): PadState {
  if (code === 0x00) return 'idle';
  if (code >= 0x11 && code <= 0x13) return 'countdown';
  if (code === 0x10) return 'running';
  if (code === 0x01) return 'paused'; // counters are kept; start resumes
  if (code === 0x0f) return 'stopping';
  if (code === 0x50) return 'vibrating';
  return 'unknown';
}

/** Parse an unescaped 0x19 status frame (including F5 header and FA tail). */
export function parseStatus(f: number[]): PadStatus | null {
  if (f[0] !== 0xf5 || f[2] !== 0x00 || f[3] !== 0x19) return null;
  const truncated = f.length === 20 && f[1] >= 0x18 && f[1] <= 0x1a;
  const complete = f.length >= 24 && f[1] === f.length && f[f.length - 1] === 0xfa;
  if (!truncated && !complete) return null;
  if (!f.slice(0, truncated ? 18 : f.length).every((b) => Number.isInteger(b) && b >= 0 && b <= 0xff)) return null;
  if (f[4] !== 0x00 || f[5] !== 0x00 || f[7] !== 0x00) return null;
  if (complete) {
    const [crcLo, crcHi] = crc16(f.slice(0, -3));
    if (f[f.length - 3] !== crcLo || f[f.length - 2] !== crcHi) return null;
  }
  const u16 = (i: number) => (f[i] << 8) | f[i + 1];
  const stateCode = f[6];
  const state = stateFromCode(stateCode);
  if (state === 'unknown') return null;
  return {
    state,
    stateCode,
    countdown: state === 'countdown' ? stateCode - 0x10 : null,
    seconds: u16(9),
    distanceKm: u16(11) / 100,
    calories: u16(13),
    steps: u16(15),
    speedKmh: f[17] / 10,
    vibrationLevel: f.length > 20 ? f[20] : null,
  };
}

/**
 * Reassembles notification chunks into frames. Notifications can contain
 * several frames, or a frame split across chunks, and the pad sometimes
 * drops bytes, so we resync on 0xF5.
 */
export class FrameParser {
  private buf: number[] = [];

  push(chunk: number[]): number[][] {
    this.buf.push(...chunk);
    const frames: number[][] = [];
    for (;;) {
      const start = this.buf.indexOf(0xf5);
      if (start < 0) {
        this.buf = [];
        break;
      }
      if (start > 0) this.buf = this.buf.slice(start);
      if (this.buf.length < 2) break;
      const len = this.buf[1];
      if (len < 6) {
        this.buf = this.buf.slice(1);
        continue;
      }
      const prefix = this.buf.slice(0, 20);
      if (
        this.buf.length >= 20 &&
        isStatusPrefix(prefix) &&
        (this.buf.length === 20 || this.buf[20] === 0xf5)
      ) {
        const decoded = unescape(prefix, false);
        if (decoded) frames.push(decoded);
        this.buf = this.buf.slice(20);
        continue;
      }
      if (this.buf.length < len) break;
      const raw = this.buf.slice(0, len);
      if (raw[len - 1] !== 0xfa) {
        this.buf = this.buf.slice(1);
        continue;
      }
      this.buf = this.buf.slice(len);
      const decoded = unescape(raw);
      if (!decoded) {
        this.buf = this.buf.slice(1);
        continue;
      }
      decoded[1] = decoded.length;
      frames.push(decoded);
    }
    return frames;
  }
}

function isStatusPrefix(bytes: number[]) {
  return bytes.length === 20 && bytes[0] === 0xf5 && bytes[1] >= 0x18 && bytes[1] <= 0x1a && bytes[2] === 0x00 && bytes[3] === 0x19;
}

function unescape(raw: number[], hasTail = true): number[] | null {
  const out = [raw[0]];
  const end = raw.length - (hasTail ? 1 : 0);
  for (let i = 1; i < end; i++) {
    if (raw[i] === 0xf0) {
      if (i + 1 >= end || raw[i + 1] > 0x0f) return null;
      out.push(0xf0 | raw[++i]);
    } else {
      out.push(raw[i]);
    }
  }
  if (hasTail) out.push(raw[raw.length - 1]);
  return out;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

export function toHex(bytes: number[]) {
  return bytes.map((b) => b.toString(16).padStart(2, '0')).join(' ');
}
