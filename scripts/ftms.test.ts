// Run with: npm test
// FTMS packets are built from the Bluetooth SIG spec (no hardware capture yet).
import assert from 'node:assert/strict';
import {
  FtmsCommands,
  parseMachineStatus,
  parseSpeedRange,
  parseSperaxExtra,
  parseTreadmillData,
} from '../src/drivers/ftmsParse.ts';

// Flags 0x0484: total distance, expended energy, elapsed time.
// Speed 3.50 km/h, 1234 m, 56 kcal (per hour/minute unknown), 600 s.
assert.deepEqual(
  parseTreadmillData([0x84, 0x04, 0x5e, 0x01, 0xd2, 0x04, 0x00, 0x38, 0x00, 0xff, 0xff, 0xff, 0x58, 0x02]),
  { speedKmh: 3.5, distanceKm: 1.234, calories: 56, seconds: 600 },
);

// "More data" set: no speed; inclination fields are skipped correctly.
assert.deepEqual(parseTreadmillData([0x0d, 0x04, 0x10, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x2c, 0x01]), {
  distanceKm: 0.016,
  seconds: 300,
});

// Truncated packet doesn't throw or invent values.
assert.deepEqual(parseTreadmillData([0x84, 0x04, 0x5e]), {});

assert.equal(parseMachineStatus([0x04]), 'started');
assert.equal(parseMachineStatus([0x02, 0x02]), 'paused');
assert.equal(parseMachineStatus([0x02, 0x01]), 'stopped');

assert.deepEqual(parseSperaxExtra([0x00, 0x02, 0xe8, 0x03]), { kind: 'steps', steps: 1000 });
assert.deepEqual(parseSperaxExtra([0x00, 0x01, 0x01, 0x05]), { kind: 'vibration', on: true, level: 5 });
assert.deepEqual(parseSpeedRange([0x64, 0x00, 0x58, 0x02, 0x0a, 0x00]), { min: 1, max: 6 });
assert.deepEqual(FtmsCommands.setSpeed(3.5), [0x02, 0x5e, 0x01]);

console.log('ftms tests passed');
