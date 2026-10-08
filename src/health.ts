import {
  ExerciseType,
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  insertRecords,
  openHealthConnectSettings,
  requestPermission,
  SdkAvailabilityStatus,
  type HealthConnectRecord,
  type Permission,
} from 'react-native-health-connect';
import type { Workout } from './workouts';

const PERMISSIONS: Permission[] = [
  { accessType: 'write', recordType: 'Steps' },
  { accessType: 'write', recordType: 'Distance' },
  { accessType: 'write', recordType: 'ActiveCaloriesBurned' },
  { accessType: 'write', recordType: 'ExerciseSession' },
];

const RECORDING_METHOD_ACTIVELY_RECORDED = 1;
const RECORDING_METHOD_MANUAL_ENTRY = 3;

let ready: Promise<boolean> | null = null;

async function init() {
  const status = await getSdkStatus();
  if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) return false;
  return initialize();
}

function ensureInit() {
  ready ??= init().catch(() => {
    ready = null;
    return false;
  });
  return ready;
}

export async function hasHealthPermission(): Promise<boolean> {
  if (!(await ensureInit())) return false;
  const granted = await getGrantedPermissions();
  return granted.some((p) => p.accessType === 'write' && p.recordType === 'Steps');
}

/** Returns true if at least steps may be written. */
export async function requestHealthPermission(): Promise<boolean> {
  if (!(await ensureInit())) {
    throw new Error('Health Connect is not available on this phone. Install or update it from the Play Store.');
  }
  const granted = await requestPermission(PERMISSIONS);
  return granted.some((p) => p.accessType === 'write' && p.recordType === 'Steps');
}

export { openHealthConnectSettings };

/**
 * Writes a workout to Health Connect. Records carry a stable clientRecordId,
 * so syncing the same workout twice updates instead of duplicating.
 */
export async function syncWorkout(w: Workout): Promise<void> {
  const granted = new Set((await getGrantedPermissions()).map((p) => `${p.accessType}:${p.recordType}`));
  const can = (type: string) => granted.has(`write:${type}`);
  const metadata = (kind: string) => ({
    clientRecordId: `spx-walkpad-${w.id}-${kind}`,
    clientRecordVersion: w.version ?? 0,
    recordingMethod: w.manual ? RECORDING_METHOD_MANUAL_ENTRY : RECORDING_METHOD_ACTIVELY_RECORDED,
    device: { manufacturer: 'Sperax', model: 'RM-01' },
  });
  const time = { startTime: w.startTime, endTime: w.endTime };
  // Corrected workouts also write zero values so earlier wrong records get overwritten.
  const include = (value: number) => value > 0 || (w.version ?? 0) > 0;

  const records: HealthConnectRecord[] = [];
  if (can('ExerciseSession')) {
    records.push({
      recordType: 'ExerciseSession',
      exerciseType: ExerciseType.WALKING,
      title: 'Walking pad',
      ...time,
      metadata: metadata('session'),
    });
  }
  if (can('Steps') && include(w.steps)) {
    records.push({ recordType: 'Steps', count: w.steps, ...time, metadata: metadata('steps') });
  }
  if (can('Distance') && include(w.distanceKm)) {
    records.push({
      recordType: 'Distance',
      distance: { value: w.distanceKm, unit: 'kilometers' },
      ...time,
      metadata: metadata('distance'),
    });
  }
  if (can('ActiveCaloriesBurned') && include(w.calories)) {
    records.push({
      recordType: 'ActiveCaloriesBurned',
      energy: { value: w.calories, unit: 'kilocalories' },
      ...time,
      metadata: metadata('calories'),
    });
  }
  // insertRecords only accepts one record type per call.
  for (const record of records) await insertRecords([record]);
}
