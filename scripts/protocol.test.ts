// Run with: node --experimental-strip-types scripts/protocol.test.ts
// Frames below were captured from a real SPERAX_RM01.
import assert from 'node:assert/strict';
import { PadCommands, FrameParser, parseStatus, toHex } from '../src/protocol.ts';

const hex = (s: string) => s.split(' ').map((b) => parseInt(b, 16));

// Commands we sent that the pad accepted (it acked with D0 <cmd> ...).
assert.equal(toHex(PadCommands.initialize()), 'f5 07 00 01 26 d8 fa');
assert.equal(toHex(PadCommands.status()), 'f5 08 00 19 f0 0a 59 fa');
assert.equal(toHex(PadCommands.totals()), 'f5 07 00 1a e6 ea fa');
assert.equal(toHex(PadCommands.start()), 'f5 0a 00 15 01 02 00 be 98 fa');
assert.equal(toHex(PadCommands.setSpeed(0.4)), 'f5 0a 00 15 01 04 00 5e 61 fa');
assert.equal(toHex(PadCommands.pause()), 'f5 0a 00 15 02 00 00 c3 19 fa');
assert.equal(toHex(PadCommands.stop()), 'f5 0a 00 15 00 00 00 d3 01 fa');

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

// Official SPX notifications contain a 20-byte status prefix without CRC/tail.
const official = new FrameParser();
const [capturedIdle] = official.push(hex('f5 18 00 19 00 00 00 00 00 03 61 00 00 00 00 00 00 00 00 00'));
assert.deepEqual(parseStatus(capturedIdle), {
  state: 'idle', stateCode: 0x00, countdown: null, seconds: 865,
  distanceKm: 0, steps: 0, calories: 0, speedKmh: 0, vibrationLevel: null,
});

const [capturedRunning] = official.push(hex('f5 18 00 19 00 00 10 00 00 03 61 00 00 00 00 00 00 01 00 00'));
assert.equal(parseStatus(capturedRunning)?.speedKmh, 0.1);
assert.equal(parseStatus(capturedRunning)?.state, 'running');

const [capturedStopping] = official.push(hex('f5 18 00 19 00 00 0f 00 00 03 83 00 01 00 01 00 09 02 00 00'));
assert.deepEqual(parseStatus(capturedStopping), {
  state: 'stopping', stateCode: 0x0f, countdown: null, seconds: 899,
  distanceKm: 0.01, steps: 9, calories: 1, speedKmh: 0.2, vibrationLevel: null,
});

// A 20-byte capture split across notifications is reassembled; shorter or invalid prefixes are rejected.
const partial = new FrameParser();
assert.equal(partial.push(hex('f5 18 00 19 00 00 10 00 00 03')).length, 0);
assert.equal(partial.push(hex('61 00 00 00 00 00 00 01 00 00')).length, 1);
assert.equal(parseStatus(partial.push(hex('f5 18 00 19 00 00 ff 00 00 03 61 00 00 00 00 00 00 01 00 00'))[0]), null);
assert.equal(official.push(hex('f5 18 00 19 00 00 10 00 00 03 61 00 00 00 00 00 00 01 00')).length, 0);
assert.equal(parseStatus(hex('f5 18 00 19 00 00 10 00 00 03 61 00 00 00 00 00 00 01 00')), null);

// Complete status frames still require their CRC; corrupting the CRC rejects the frame.
const corrupt = running.slice();
corrupt[corrupt.length - 3] ^= 0x01;
assert.equal(parseStatus(corrupt), null);

console.log('protocol tests passed');
