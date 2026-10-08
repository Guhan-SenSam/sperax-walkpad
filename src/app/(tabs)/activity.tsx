import { router } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../../AppProvider';
import { DayBar, GoalRing, WeekBars } from '../../components/charts';
import { PageTitle, Screen } from '../../components/Screen';
import { Eyebrow, Metric, Panel } from '../../components/ui';
import { dayKey, distance, formatDate, formatDuration, formatTime } from '../../format';
import { colors, fonts, stateAccent } from '../../theme';
import type { Workout } from '../../workouts';

function lastSevenDays(workouts: Workout[]): DayBar[] {
  const totals = new Map<string, number>();
  for (const w of workouts) {
    const k = dayKey(new Date(w.startTime));
    totals.set(k, (totals.get(k) ?? 0) + w.steps);
  }
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return {
      label: d.toLocaleDateString(undefined, { weekday: 'narrow' }),
      title: i === 6 ? 'Today' : d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }),
      value: totals.get(dayKey(d)) ?? 0,
    };
  });
}

/** Workouts from the last `days` calendar days, including today. */
function since(workouts: Workout[], days: number) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return workouts.filter((w) => Date.parse(w.startTime) >= start.getTime());
}

function sum(ws: Workout[]) {
  return ws.reduce(
    (t, w) => ({ steps: t.steps + w.steps, km: t.km + w.distanceKm, secs: t.secs + w.seconds, kcal: t.kcal + w.calories }),
    { steps: 0, km: 0, secs: 0, kcal: 0 },
  );
}

export default function ActivityScreen() {
  const { log, settings, totals, state } = useApp();
  const units = settings.units;
  const week = lastSevenDays(log.workouts);
  const thisWeek = sum(since(log.workouts, 7));
  const allTime = sum(log.workouts);
  // Include the walk in progress so today's ring moves live.
  const inProgress = state === 'running' || state === 'paused' || state === 'countdown' ? (totals?.steps ?? 0) : 0;
  const today = week[6].value + inProgress;
  const accent = stateAccent.running;

  const confirmDelete = (w: Workout) =>
    Alert.alert('Delete workout?', 'This removes it from this app only, not from Health Connect.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => log.deleteWorkout(w.id) },
    ]);

  return (
    <Screen accent={accent}>
      <PageTitle>Activity</PageTitle>

      <Panel style={styles.todayPanel}>
        <GoalRing value={today} goal={settings.stepGoal} color={accent} />
        <View style={{ flex: 1, gap: 6 }}>
          <Eyebrow>Today</Eyebrow>
          <Text style={styles.todayText}>
            {today >= settings.stepGoal
              ? 'Goal reached. Nice work!'
              : `${(settings.stepGoal - today).toLocaleString()} steps to go`}
          </Text>
          <Text style={styles.muted}>Change your daily goal in Settings.</Text>
        </View>
      </Panel>

      <Panel>
        <Eyebrow>Steps per day</Eyebrow>
        <WeekBars days={week} goal={settings.stepGoal} />
      </Panel>

      <Panel>
        <Eyebrow>Last 7 days</Eyebrow>
        <View style={styles.row}>
          <Metric label="Steps" value={thisWeek.steps.toLocaleString()} />
          <Metric label="Distance" value={distance(thisWeek.km, units).value} unit={distance(0, units).unit} />
          <Metric label="Time" value={formatDuration(thisWeek.secs)} />
        </View>
        <Eyebrow>All time</Eyebrow>
        <View style={styles.row}>
          <Metric label="Steps" value={allTime.steps.toLocaleString()} />
          <Metric label="Distance" value={distance(allTime.km, units).value} unit={distance(0, units).unit} />
          <Metric label="Workouts" value={String(log.workouts.length)} />
        </View>
      </Panel>

      <Panel>
        <View style={styles.rowBetween}>
          <Eyebrow>History</Eyebrow>
          <Pressable onPress={() => router.push('/add-workout')} hitSlop={10}>
            <Eyebrow color={accent}>+ Add workout</Eyebrow>
          </Pressable>
        </View>
        {log.workouts.length === 0 && (
          <Text style={styles.muted}>No workouts yet. Start a walk and it will be saved automatically.</Text>
        )}
        {log.workouts.length > 0 && <Text style={styles.muted}>Long-press a workout to delete it.</Text>}
        {log.workouts.map((w) => {
          const d = distance(w.distanceKm, units);
          return (
            <Pressable key={w.id} style={styles.workout} onLongPress={() => confirmDelete(w)}>
              <View style={[styles.bar, { backgroundColor: w.synced ? '#34d399' : colors.faint }]} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.workoutTitle}>{formatDate(w.startTime)}</Text>
                <Text style={styles.muted}>
                  {formatTime(w.seconds)} · {d.value} {d.unit} · {w.calories} kcal
                  {w.manual ? ' · manual' : ''}
                  {w.synced ? ' · synced' : ''}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.workoutSteps}>{w.steps.toLocaleString()}</Text>
                <Eyebrow>steps</Eyebrow>
              </View>
            </Pressable>
          );
        })}
      </Panel>
    </Screen>
  );
}

const styles = StyleSheet.create({
  todayPanel: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  todayText: { fontFamily: fonts.display, color: colors.text, fontSize: 20 },
  muted: { color: colors.muted, fontSize: 13 },
  row: { flexDirection: 'row' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  workout: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.panelBorder,
  },
  bar: { width: 3, alignSelf: 'stretch', borderRadius: 2 },
  workoutTitle: { fontFamily: fonts.medium, color: colors.text, fontSize: 15 },
  workoutSteps: { fontFamily: fonts.display, color: colors.text, fontSize: 22, fontVariant: ['tabular-nums'] },
});
