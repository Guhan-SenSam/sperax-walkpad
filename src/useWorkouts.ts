import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { hasHealthPermission, requestHealthPermission, syncWorkout } from './health';
import type { PadStatus } from './protocol';
import { CompletedWorkout, Totals, WorkoutTracker } from './tracker';
import { Workout, loadLive, loadWorkouts, saveLive, saveWorkouts } from './workouts';

const PERSIST_EVERY_MS = 5000;
// A saved workout older than this is closed on launch instead of resumed.
const STALE_LIVE_MS = 2 * 3600_000;

export interface WorkoutOptions {
  autoSync: boolean;
  onSaved?: (w: Workout) => void;
  onSynced?: (at: string) => void;
}

export function useWorkouts(options: WorkoutOptions) {
  const opts = useRef(options);
  useEffect(() => {
    opts.current = options;
  });
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [current, setCurrent] = useState<Totals | null>(null);
  const [healthLinked, setHealthLinked] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const tracker = useRef(new WorkoutTracker());
  const lastPersist = useRef(0);
  const list = useRef<Workout[]>([]);
  const loaded = useRef<Promise<void> | null>(null);

  const commit = useCallback(async (next: Workout[]) => {
    list.current = next;
    setWorkouts(next);
    await saveWorkouts(next);
  }, []);

  const syncPending = useCallback(async () => {
    await loaded.current;
    const pending = list.current.filter((w) => !w.synced);
    if (pending.length === 0) return;
    setSyncing(true);
    setSyncError(null);
    try {
      for (const w of pending) {
        await syncWorkout(w);
        await commit(list.current.map((x) => (x.id === w.id ? { ...x, synced: true } : x)));
      }
      opts.current.onSynced?.(new Date().toISOString());
    } catch (e: any) {
      setSyncError(`Sync failed: ${e?.message ?? e}`);
    } finally {
      setSyncing(false);
    }
  }, [commit]);

  const record = useCallback(
    async (done: CompletedWorkout, manual = false) => {
      await loaded.current;
      let id = Date.parse(done.startTime);
      while (list.current.some((w) => w.id === String(id))) id++;
      const workout: Workout = { ...done, id: String(id), synced: false, ...(manual && { manual: true }) };
      const next = [workout, ...list.current].sort((a, b) => Date.parse(b.startTime) - Date.parse(a.startTime));
      await commit(next);
      opts.current.onSaved?.(workout);
      if (opts.current.autoSync && (await hasHealthPermission().catch(() => false))) await syncPending();
    },
    [commit, syncPending],
  );

  useEffect(() => {
    loaded.current = loadWorkouts().then((w) => {
      list.current = w;
      setWorkouts(w);
    });
    // Recover a workout that was in progress when the app was closed.
    loadLive()
      .then((snap) => {
        if (!snap) return;
        tracker.current.restore(snap);
        if (Date.now() - snap.lastSeen > STALE_LIVE_MS) {
          const done = tracker.current.finish(snap.lastSeen);
          saveLive(null);
          if (done) record(done);
        } else {
          setCurrent(tracker.current.current);
        }
      })
      .catch(() => {});
    hasHealthPermission()
      .then((ok) => {
        setHealthLinked(ok);
        if (ok && opts.current.autoSync) syncPending();
      })
      .catch(() => setHealthLinked(false));
  }, [syncPending, record]);

  /** Feed every status update from the pad. */
  const onStatus = useCallback(
    (status: PadStatus) => {
      const now = Date.now();
      const done = tracker.current.update(status, now);
      setCurrent(tracker.current.current);
      if (done) {
        saveLive(null).catch(() => {});
        record(done);
      } else if (tracker.current.lastActive !== null && now - lastPersist.current >= PERSIST_EVERY_MS) {
        lastPersist.current = now;
        saveLive(tracker.current.snapshot()).catch(() => {});
      }
    },
    [record],
  );

  /** Call when the pad disconnects so an in-progress workout is still saved. */
  const onDisconnect = useCallback(() => {
    const done = tracker.current.finish(Date.now());
    setCurrent(null);
    saveLive(null).catch(() => {});
    if (done) record(done);
  }, [record]);

  /** The user pressed Stop in the app: save the workout as soon as the belt stops. */
  const stopRequested = useCallback(() => tracker.current.stopRequested(), []);

  // Retry pending syncs whenever the app comes back to the foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && opts.current.autoSync && list.current.some((w) => !w.synced)) {
        hasHealthPermission()
          .then((ok) => (ok ? syncPending() : undefined))
          .catch(() => {});
      }
    });
    return () => sub.remove();
  }, [syncPending]);

  const linkHealth = useCallback(async () => {
    setSyncError(null);
    try {
      const ok = await requestHealthPermission();
      setHealthLinked(ok);
      if (ok) await syncPending();
      else setSyncError('Steps permission was not granted');
    } catch (e: any) {
      setSyncError(e?.message ?? String(e));
    }
  }, [syncPending]);

  const deleteWorkout = useCallback(
    (id: string) => commit(list.current.filter((w) => w.id !== id)),
    [commit],
  );

  /** Logs a walk entered by hand. */
  const addManual = useCallback((w: CompletedWorkout) => record(w, true), [record]);

  const deleteAll = useCallback(() => commit([]), [commit]);

  /** Re-sends every workout, e.g. after clearing data in Health Connect. */
  const resyncAll = useCallback(async () => {
    await commit(list.current.map((w) => ({ ...w, synced: false })));
    await syncPending();
  }, [commit, syncPending]);

  const refreshHealth = useCallback(() => {
    hasHealthPermission()
      .then(setHealthLinked)
      .catch(() => setHealthLinked(false));
  }, []);

  return {
    onStatus,
    onDisconnect,
    stopRequested,
    workouts,
    current,
    healthLinked,
    syncing,
    syncError,
    linkHealth,
    refreshHealth,
    syncPending,
    resyncAll,
    deleteWorkout,
    deleteAll,
    addManual,
  };
}
