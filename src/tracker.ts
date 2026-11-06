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
  baseline?: Totals;
  lastRaw?: Totals | null;
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

function subtract(a: Totals, b: Totals): Totals {
  return {
    seconds: Math.max(0, a.seconds - b.seconds),
    distanceKm: Math.max(0, Math.round((a.distanceKm - b.distanceKm) * 100) / 100),
    steps: Math.max(0, a.steps - b.steps),
    calories: Math.max(0, a.calories - b.calories),
  };
}

function totalsFromStatus(s: PadStatus): Totals {
  return { seconds: s.seconds, distanceKm: s.distanceKm, steps: s.steps, calories: s.calories };
}

function countersDecreased(current: Totals, previous: Totals): boolean {
  return (
    current.seconds < previous.seconds ||
    current.distanceKm < previous.distanceKm ||
    current.steps < previous.steps ||
    current.calories < previous.calories
  );
}

function baselineAfterReset(current: Totals, previous: Totals): Totals {
  return {
    seconds: current.seconds < previous.seconds ? 0 : previous.seconds,
    distanceKm: current.distanceKm < previous.distanceKm ? 0 : previous.distanceKm,
    steps: current.steps < previous.steps ? 0 : previous.steps,
    calories: current.calories < previous.calories ? 0 : previous.calories,
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
  private baseline: Totals = ZERO;
  private lastRaw: Totals | null = null;
  private idleBaseline: Totals | null = null;
  private lastSeen = 0;
  private endOnIdle = false;

  get current(): Totals | null {
    if (this.startedAt === null) return null;
    return this.last ? add(this.base, this.last) : this.base;
  }

  update(s: PadStatus, now: number): CompletedWorkout | null {
    const active = ['running', 'countdown', 'stopping', 'paused'].includes(s.state);
    const raw = totalsFromStatus(s);
    if (active) {
      if (this.startedAt === null) {
        this.startedAt = now;
        this.baseline = this.idleBaseline ? baselineAfterReset(raw, this.idleBaseline) : ZERO;
      } else if (this.lastRaw && countersDecreased(raw, this.lastRaw)) {
        if (this.last) this.base = add(this.base, this.last);
        this.baseline = baselineAfterReset(raw, this.lastRaw);
      }
      this.idleSince = null;
      this.lastSeen = now;
      this.last = subtract(raw, this.baseline);
      this.lastRaw = raw;
      return null;
    }
    if (this.startedAt === null) {
      this.idleBaseline = raw;
      return null;
    }
    this.idleSince ??= now;
    if (this.endOnIdle || now - this.idleSince >= IDLE_GRACE_MS) {
      this.idleBaseline = raw;
      return this.finish(this.idleSince);
    }
    return null;
  }

  /** The user pressed Stop: end the workout as soon as the belt is idle, without the grace period. */
  stopRequested() {
    if (this.startedAt !== null) this.endOnIdle = true;
  }

  snapshot(): TrackerSnapshot | null {
    if (this.startedAt === null) return null;
    return {
      startedAt: this.startedAt,
      lastSeen: this.lastSeen,
      base: this.base,
      last: this.last,
      baseline: this.baseline,
      lastRaw: this.lastRaw,
    };
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
    this.baseline = s.baseline ?? ZERO;
    this.lastRaw = s.lastRaw ?? s.last;
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
    if (this.lastRaw) this.idleBaseline = this.lastRaw;
    this.startedAt = null;
    this.idleSince = null;
    this.base = ZERO;
    this.last = null;
    this.baseline = ZERO;
    this.lastRaw = null;
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
