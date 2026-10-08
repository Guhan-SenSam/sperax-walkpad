// Run with: node --experimental-strip-types scripts/protocol.test.ts
// Frames below were captured from a real SPERAX_RM01.
import assert from 'node:assert/strict';
import { PadCommands, FrameParser, parseStatus, toHex } from '../src/protocol.ts';

const hex = (s: string) => s.split(' ').map((b) => parseInt(b, 16));

// Commands we sent that the pad accepted (it acked with D0 <cmd> ...).
assert.equal(toHex(PadCommands.status()), 'f5 07 00 19 fa 59 fa');
assert.equal(toHex(PadCommands.totals()), 'f5 07 00 1a e6 ea fa');

// Status while running at 4.0 km/h.
const p = new FrameParser();
const [running] = p.push(hex('f5 18 00 19 00 00 10 00 01 00 1c 00 03 00 04 00 00 28 00 00 00 96 30 fa'));
assert.deepEqual(parseStatus(running), {
  state: 'running', stateCode: 0x10, countdown: null, seconds: 28,
  distanceKm: 0.03, steps: 0, calories: 4, speedKmh: 4, vibrationLevel: 0,
});

// Escaped CRC byte, frame split across two notifications.
assert.equal(p.push(hex('f5 19 00 19 00 00 10 00 01 00 0a 00 01 00')).length, 0);
const [split] = p.push(hex('01 00 00 13 00 00 00 f0 0e c5 fa'));
assert.equal(split.length, 24);
assert.equal(parseStatus(split)!.speedKmh, 1.9);

// Two frames in one notification, the first one corrupted by a dropped byte.
const frames = p.push(hex('f5 0b 00 d0 15 01 00 f0 0f d5 ba 08 00 0e 02 14 47 fa f5 18 00 19 00 00 12 00 01 00 00 00 00 00 00 00 00 00 00 00 00 ca 85 fa'));
const status = frames.map(parseStatus).find(Boolean)!;
assert.equal(status.state, 'countdown');
assert.equal(status.countdown, 2);

// Vibration mode at level 9.
const [vib] = p.push(hex('f5 18 00 19 00 00 50 00 01 00 19 00 02 00 02 00 01 00 00 00 09 d8 5d fa'));
assert.equal(parseStatus(vib)!.state, 'vibrating');
assert.equal(parseStatus(vib)!.vibrationLevel, 9);

console.log('protocol tests passed');
