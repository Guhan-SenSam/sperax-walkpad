import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MAX_SPEED, MAX_VIBRATION_LEVEL, MIN_SPEED, PadState } from './src/protocol';
import { usePad } from './src/usePad';
import { useWorkouts } from './src/useWorkouts';

const SPEED_STEP = 0.5;
const SPEED_PRESETS = [1, 2, 3, 4, 5, 6];
const LEVELS = Array.from({ length: MAX_VIBRATION_LEVEL }, (_, i) => i + 1);

const STATE_LABEL: Record<PadState, string> = {
  idle: 'Ready',
  countdown: 'Starting',
  running: 'Walking',
  stopping: 'Slowing down',
  vibrating: 'Vibrating',
  unknown: 'Unknown',
};

function formatTime(total: number) {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mmss = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return h > 0 ? `${h}:${mmss}` : mmss;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

export default function App() {
  const log = useWorkouts();
  const pad = usePad({ onStatus: log.onStatus, onDisconnect: log.onDisconnect });
  const s = pad.status;
  // Show whole-workout totals (the pad resets its own counters on pause/resume).
  const totals = log.current ?? s;
  const [target, setTarget] = useState(2.0);
  const pendingStart = useRef(false);

  // The pad starts at a crawl; once the countdown finishes, ramp to the target.
  useEffect(() => {
    if (pendingStart.current && s?.state === 'running') {
      pendingStart.current = false;
      pad.setSpeed(target);
    }
  }, [s?.state]);

  const connected = pad.connection === 'connected';
  const walking = s?.state === 'running' || s?.state === 'countdown';
  const canVibrate = connected && !walking && s?.state !== 'stopping';

  const changeTarget = (kmh: number) => {
    const next = Math.round(Math.min(MAX_SPEED, Math.max(MIN_SPEED, kmh)) * 10) / 10;
    setTarget(next);
    if (s?.state === 'running') pad.setSpeed(next);
  };

  const start = () => {
    if (s?.state === 'vibrating') pad.stopVibration();
    pendingStart.current = true;
    pad.start();
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Walking Pad</Text>

        <View style={styles.card}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>
                {connected ? pad.deviceName : pad.connection === 'disconnected' ? 'Not connected' : `${pad.connection}…`}
              </Text>
              {s && (
                <Text style={styles.state}>
                  {s.countdown ? `Starting in ${s.countdown}` : STATE_LABEL[s.state]}
                </Text>
              )}
            </View>
            {connected ? (
              <Btn label="Disconnect" onPress={pad.disconnect} kind="ghost" />
            ) : (
              <Btn
                label={pad.connection === 'disconnected' ? 'Connect' : 'Searching…'}
                onPress={pad.connect}
                disabled={pad.connection !== 'disconnected'}
              />
            )}
          </View>
          {pad.error && <Text style={styles.error}>{pad.error}</Text>}
        </View>

        <View style={styles.card}>
          <View style={styles.statsGrid}>
            <Stat label="Time" value={totals ? formatTime(totals.seconds) : '--:--'} />
            <Stat label="Speed" value={s ? s.speedKmh.toFixed(1) : '-'} unit="km/h" />
            <Stat label="Distance" value={totals ? totals.distanceKm.toFixed(2) : '-'} unit="km" />
            <Stat label="Steps" value={totals ? String(totals.steps) : '-'} />
            <Stat label="Calories" value={totals ? String(totals.calories) : '-'} unit="kcal" />
            <Stat label="Vibration" value={s?.state === 'vibrating' ? `L${s.vibrationLevel}` : 'Off'} />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.section}>Walk</Text>
          <View style={styles.speedRow}>
            <Btn label="−" onPress={() => changeTarget(target - SPEED_STEP)} disabled={!connected} kind="round" />
            <View style={styles.target}>
              <Text style={styles.targetValue}>{target.toFixed(1)}</Text>
              <Text style={styles.label}>target km/h</Text>
            </View>
            <Btn label="+" onPress={() => changeTarget(target + SPEED_STEP)} disabled={!connected} kind="round" />
          </View>
          <View style={styles.chips}>
            {SPEED_PRESETS.map((v) => (
              <Chip key={v} label={String(v)} active={target === v} onPress={() => changeTarget(v)} disabled={!connected} />
            ))}
          </View>
          <View style={styles.row}>
            <Btn label="Start" onPress={start} disabled={!connected || walking} kind="go" grow />
            <Btn label="Pause" onPress={pad.pause} disabled={!connected || !walking} grow />
            <Btn label="Stop" onPress={pad.stop} disabled={!connected} kind="stop" grow />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.section}>Vibration</Text>
          <Text style={styles.hint}>Only available while the belt is stopped.</Text>
          <View style={styles.chips}>
            {LEVELS.map((l) => (
              <Chip
                key={l}
                label={String(l)}
                active={s?.state === 'vibrating' && s.vibrationLevel === l}
                onPress={() => pad.vibrate(l)}
                disabled={!canVibrate}
              />
            ))}
          </View>
          <Btn label="Vibration off" onPress={pad.stopVibration} disabled={!connected || s?.state !== 'vibrating'} kind="stop" />
        </View>

        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={[styles.section, { flex: 1 }]}>Workouts</Text>
            {log.healthLinked ? (
              <Btn
                label={log.syncing ? 'Syncing…' : 'Sync'}
                onPress={log.syncPending}
                disabled={log.syncing || log.workouts.every((w) => w.synced)}
                kind="ghost"
              />
            ) : (
              <Btn label="Link Health Connect" onPress={log.linkHealth} />
            )}
          </View>
          <Text style={styles.hint}>
            {log.healthLinked
              ? 'Workouts sync to Health Connect automatically when they finish.'
              : 'Saved on this phone. Link Health Connect to share steps with Health Sync, Google Fit and others.'}
          </Text>
          {log.syncError && <Text style={styles.error}>{log.syncError}</Text>}
          {log.workouts.length === 0 && <Text style={styles.label}>No workouts yet.</Text>}
          {log.workouts.map((w) => (
            <Pressable
              key={w.id}
              style={styles.workout}
              onLongPress={() =>
                Alert.alert('Delete workout?', 'This removes it from this app only.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => log.deleteWorkout(w.id) },
                ])
              }
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.workoutTitle}>{formatDate(w.startTime)}</Text>
                <Text style={styles.label}>
                  {formatTime(w.seconds)} · {w.distanceKm.toFixed(2)} km · {w.calories} kcal
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.workoutSteps}>{w.steps}</Text>
                <Text style={styles.label}>{w.synced ? 'steps · synced' : 'steps'}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.statValue}>
        {value}
        {unit && <Text style={styles.unit}> {unit}</Text>}
      </Text>
    </View>
  );
}

type BtnKind = 'primary' | 'ghost' | 'go' | 'stop' | 'round';

function Btn({ label, onPress, disabled, kind = 'primary', grow }: {
  label: string; onPress: () => void; disabled?: boolean; kind?: BtnKind; grow?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        styles[`btn_${kind}`],
        grow && { flex: 1 },
        disabled && styles.disabled,
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text style={[styles.btnText, kind === 'round' && { fontSize: 28 }]}>{label}</Text>
    </Pressable>
  );
}

function Chip({ label, active, onPress, disabled }: {
  label: string; active?: boolean; onPress: () => void; disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.chip, active && styles.chipActive, disabled && styles.disabled]}
    >
      <Text style={[styles.chipText, active && { color: '#0b1220' }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b1220' },
  content: { padding: 16, paddingTop: 56, gap: 12 },
  title: { color: '#fff', fontSize: 28, fontWeight: '700', marginBottom: 4 },
  card: { backgroundColor: '#151e2e', borderRadius: 16, padding: 16, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { color: '#8b97ab', fontSize: 13 },
  state: { color: '#fff', fontSize: 18, fontWeight: '600', marginTop: 2 },
  error: { color: '#ff7a7a', fontSize: 13 },
  section: { color: '#fff', fontSize: 18, fontWeight: '600' },
  hint: { color: '#8b97ab', fontSize: 12, marginTop: -8 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 16 },
  stat: { width: '50%' },
  statValue: { color: '#fff', fontSize: 30, fontWeight: '700', fontVariant: ['tabular-nums'] },
  unit: { color: '#8b97ab', fontSize: 14, fontWeight: '400' },
  speedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  target: { alignItems: 'center' },
  targetValue: { color: '#fff', fontSize: 44, fontWeight: '700', fontVariant: ['tabular-nums'] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minWidth: 44, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10,
    backgroundColor: '#22304a', alignItems: 'center',
  },
  chipActive: { backgroundColor: '#7dd3fc' },
  chipText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  btn: { paddingVertical: 14, paddingHorizontal: 18, borderRadius: 12, alignItems: 'center' },
  btn_primary: { backgroundColor: '#2563eb' },
  btn_ghost: { backgroundColor: '#22304a' },
  btn_go: { backgroundColor: '#16a34a' },
  btn_stop: { backgroundColor: '#dc2626' },
  btn_round: { backgroundColor: '#22304a', width: 64, height: 64, borderRadius: 32, paddingVertical: 0, justifyContent: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  disabled: { opacity: 0.35 },
  workout: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#2a3850',
  },
  workoutTitle: { color: '#fff', fontSize: 15, fontWeight: '600' },
  workoutSteps: { color: '#7dd3fc', fontSize: 20, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
