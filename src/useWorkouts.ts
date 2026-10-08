import { useCallback, useEffect, useRef, useState } from 'react';
import { hasHealthPermission, requestHealthPermission, syncWorkout } from './health';
import type { PadStatus } from './protocol';
import { CompletedWorkout, Totals, WorkoutTracker } from './tracker';
import { Workout, loadWorkouts, saveWorkouts } from './workouts';

export function useWorkouts() {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [current, setCurrent] = useState<Totals | null>(null);
  const [healthLinked, setHealthLinked] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const tracker = useRef(new WorkoutTracker());
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
    } catch (e: any) {
      setSyncError(`Sync failed: ${e?.message ?? e}`);
    } finally {
      setSyncing(false);
    }
  }, [commit]);

  const record = useCallback(
    async (done: CompletedWorkout) => {
      await loaded.current;
      const workout: Workout = { ...done, id: String(Date.parse(done.startTime)), synced: false };
      await commit([workout, ...list.current]);
      if (await hasHealthPermission().catch(() => false)) await syncPending();
    },
    [commit, syncPending],
  );

  useEffect(() => {
    loaded.current = loadWorkouts().then((w) => {
      list.current = w;
      setWorkouts(w);
    });
    hasHealthPermission()
      .then((ok) => {
        setHealthLinked(ok);
        if (ok) syncPending();
      })
      .catch(() => setHealthLinked(false));
  }, [syncPending]);

  /** Feed every status update from the pad. */
  const onStatus = useCallback(
    (status: PadStatus) => {
      const done = tracker.current.update(status, Date.now());
      setCurrent(tracker.current.current);
      if (done) record(done);
    },
    [record],
  );

  /** Call when the pad disconnects so an in-progress workout is still saved. */
  const onDisconnect = useCallback(() => {
    const done = tracker.current.finish(Date.now());
    setCurrent(null);
    if (done) record(done);
  }, [record]);

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

  return { onStatus, onDisconnect, workouts, current, healthLinked, syncing, syncError, linkHealth, syncPending, deleteWorkout };
}
