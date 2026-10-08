// Run with: npm test
import assert from 'node:assert/strict';
import type { PadStatus } from '../src/protocol.ts';
import { IDLE_GRACE_MS, WorkoutTracker } from '../src/tracker.ts';

const status = (state: PadStatus['state'], seconds = 0, steps = 0, distanceKm = 0, calories = 0): PadStatus => ({
  state, stateCode: 0, countdown: null, seconds, distanceKm, steps, calories, speedKmh: 0, vibrationLevel: 0,
});

const t0 = Date.parse('2026-10-07T10:00:00Z');
const at = (s: number) => t0 + s * 1000;

// Walk, pause (pad resets counters on resume), walk again, then stop.
const tr = new WorkoutTracker();
assert.equal(tr.update(status('idle'), at(0)), null);
tr.update(status('countdown'), at(1));
tr.update(status('running', 60, 90, 0.05, 3), at(64));
tr.update(status('stopping', 62, 92, 0.05, 3), at(66));
tr.update(status('idle'), at(70)); // paused, within grace
tr.update(status('countdown'), at(80));
tr.update(status('running', 30, 40, 0.02, 1), at(113));
assert.deepEqual(tr.current, { seconds: 92, steps: 132, distanceKm: 0.07, calories: 4 });
tr.update(status('idle'), at(115));
assert.equal(tr.update(status('idle'), at(115) + IDLE_GRACE_MS - 1000), null);
const done = tr.update(status('idle'), at(115) + IDLE_GRACE_MS);
assert.ok(done);
assert.equal(done.steps, 132);
assert.equal(done.startTime, new Date(at(1)).toISOString());
assert.equal(done.endTime, new Date(at(115)).toISOString());
assert.equal(tr.current, null);

// A few seconds with no steps is discarded.
const tr2 = new WorkoutTracker();
tr2.update(status('running', 5), at(0));
assert.equal(tr2.finish(at(6)), null);

// Disconnect mid-walk still yields the workout.
const tr3 = new WorkoutTracker();
tr3.update(status('running', 120, 200, 0.1, 6), at(120));
assert.equal(tr3.finish(at(121))?.steps, 200);

// Pausing keeps the workout open indefinitely; the pad keeps its counters while paused.
const tr4 = new WorkoutTracker();
tr4.update(status('running', 300, 650, 0.2, 20), at(300));
tr4.update(status('paused', 302, 650, 0.2, 20), at(302));
assert.equal(tr4.update(status('paused', 302, 650, 0.2, 20), at(302) + 10 * 60_000), null);
tr4.update(status('countdown', 302, 650, 0.2, 20), at(1000));
tr4.update(status('running', 600, 1000, 0.4, 35), at(1300));
assert.equal(tr4.finish(at(1301))?.steps, 1000);

// Pressing Stop ends the workout on the first idle update, without the grace period.
const tr5 = new WorkoutTracker();
tr5.update(status('running', 100, 150, 0.1, 5), at(100));
tr5.stopRequested();
assert.equal(tr5.update(status('stopping', 102, 152, 0.1, 5), at(102)), null);
assert.equal(tr5.update(status('idle'), at(105))?.steps, 152);

// A saved snapshot resumes the workout after an app restart.
const tr6 = new WorkoutTracker();
tr6.update(status('running', 20, 300, 0.15, 9), at(200));
const snap = JSON.parse(JSON.stringify(tr6.snapshot()));
const tr7 = new WorkoutTracker();
tr7.restore(snap);
tr7.update(status('running', 80, 380, 0.19, 11), at(260)); // still walking: continues
assert.equal(tr7.current?.steps, 380);
// Restored while the pad is idle and the grace period has passed: ends at last activity.
const tr8 = new WorkoutTracker();
tr8.restore(snap);
const recovered = tr8.update(status('idle'), at(200) + IDLE_GRACE_MS + 5000);
assert.equal(recovered?.steps, 300);
// Ends at last activity (start + the pad's 20 s of elapsed time).
assert.equal(recovered?.endTime, new Date(at(220)).toISOString());

console.log('tracker tests passed');
