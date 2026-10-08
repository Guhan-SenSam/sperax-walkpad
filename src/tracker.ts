import type { PadStatus } from './protocol';

export interface Totals {
  seconds: number;
  distanceKm: number;
  steps: number;
  calories: number;
}

export interface CompletedWorkout extends Totals {
  startTime: string;
  endTime: string;
}

/** A workout ends after the belt has been stopped this long (a pause never ends it). */
export const IDLE_GRACE_MS = 30_000;
/** Workouts shorter than this with no steps are discarded as accidental starts. */
const MIN_SECONDS = 15;

/** Serializable tracker state, saved so a workout survives the app being closed. */
export interface TrackerSnapshot {
  startedAt: number;
  lastSeen: number;
  base: Totals;
  last: Totals | null;
}

const ZERO: Totals = { seconds: 0, distanceKm: 0, steps: 0, calories: 0 };

function add(a: Totals, b: Totals): Totals {
  return {
    seconds: a.seconds + b.seconds,
    distanceKm: Math.round((a.distanceKm + b.distanceKm) * 100) / 100,
    steps: a.steps + b.steps,
    calories: a.calories + b.calories,
  };
}

/**
 * Turns the pad's per-run counters into whole workouts. The pad resets its
 * counters when the belt is stopped and started again (not on pause/resume),
 * so each run is a segment and segments are summed until the belt stays idle.
 */
export class WorkoutTracker {
  private startedAt: number | null = null;
  private idleSince: number | null = null;
  private base: Totals = ZERO;
  private last: Totals | null = null;
  private lastSeen = 0;
  private endOnIdle = false;

  get current(): Totals | null {
    if (this.startedAt === null) return null;
    return this.last ? add(this.base, this.last) : this.base;
  }

  update(s: PadStatus, now: number): CompletedWorkout | null {
    const active = ['running', 'countdown', 'stopping', 'paused'].includes(s.state);
    if (active) {
      if (this.startedAt === null) this.startedAt = now;
      this.idleSince = null;
      this.lastSeen = now;
      if (this.last && s.seconds < this.last.seconds) this.base = add(this.base, this.last);
      this.last = { seconds: s.seconds, distanceKm: s.distanceKm, steps: s.steps, calories: s.calories };
      return null;
    }
    if (this.startedAt === null) return null;
    this.idleSince ??= now;
    if (this.endOnIdle) return this.finish(this.idleSince);
    return now - this.idleSince >= IDLE_GRACE_MS ? this.finish(this.idleSince) : null;
  }

  /** The user pressed Stop: end the workout as soon as the belt is idle, without the grace period. */
  stopRequested() {
    if (this.startedAt !== null) this.endOnIdle = true;
  }

  snapshot(): TrackerSnapshot | null {
    if (this.startedAt === null) return null;
    return { startedAt: this.startedAt, lastSeen: this.lastSeen, base: this.base, last: this.last };
  }

  /**
   * Resumes a saved workout. If the pad is still running it continues; if it
   * is idle, the grace period counts from when the pad was last seen active.
   */
  restore(s: TrackerSnapshot) {
    this.startedAt = s.startedAt;
    this.lastSeen = s.lastSeen;
    this.base = s.base;
    this.last = s.last;
    this.idleSince = s.lastSeen;
    this.endOnIdle = false;
  }

  /** When the pad was last seen active, or null if no workout is open. */
  get lastActive(): number | null {
    return this.startedAt === null ? null : this.lastSeen;
  }

  /** Ends the current workout (e.g. on disconnect). */
  finish(end: number): CompletedWorkout | null {
    const totals = this.current;
    const startedAt = this.startedAt;
    this.startedAt = null;
    this.idleSince = null;
    this.base = ZERO;
    this.last = null;
    this.endOnIdle = false;
    if (!totals || startedAt === null) return null;
    if (totals.seconds < MIN_SECONDS && totals.steps === 0) return null;
    return {
      ...totals,
      startTime: new Date(startedAt).toISOString(),
      endTime: new Date(Math.max(end, startedAt + totals.seconds * 1000)).toISOString(),
    };
  }
}
