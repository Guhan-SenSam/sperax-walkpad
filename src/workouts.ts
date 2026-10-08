import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TrackerSnapshot } from './tracker';

export interface Workout {
  id: string;
  startTime: string; // ISO
  endTime: string; // ISO
  seconds: number;
  distanceKm: number;
  steps: number;
  calories: number;
  synced: boolean;
  /** Bumped when a workout is corrected so Health Connect replaces the old records. */
  version?: number;
  /** Entered by hand rather than recorded from the pad. */
  manual?: boolean;
}

const KEY = 'workouts.v2';
// v1 stored steps and calories swapped; they are fixed and re-synced on load.
const KEY_V1 = 'workouts.v1';

export async function loadWorkouts(): Promise<Workout[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (raw) return JSON.parse(raw);
  const old = await AsyncStorage.getItem(KEY_V1);
  if (!old) return [];
  const fixed = (JSON.parse(old) as Workout[]).map((w) => ({
    ...w,
    steps: w.calories,
    calories: w.steps,
    synced: false,
    version: 1,
  }));
  await saveWorkouts(fixed);
  await AsyncStorage.removeItem(KEY_V1);
  return fixed;
}

export async function saveWorkouts(workouts: Workout[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(workouts));
}

// The workout in progress, saved every few seconds so closing the app can't lose it.
const LIVE_KEY = 'workout.live.v1';

export async function loadLive(): Promise<TrackerSnapshot | null> {
  const raw = await AsyncStorage.getItem(LIVE_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function saveLive(snapshot: TrackerSnapshot | null) {
  if (snapshot) await AsyncStorage.setItem(LIVE_KEY, JSON.stringify(snapshot));
  else await AsyncStorage.removeItem(LIVE_KEY);
}
